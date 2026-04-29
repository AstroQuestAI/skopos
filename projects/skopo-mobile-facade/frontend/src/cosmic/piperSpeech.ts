/**
 * piperSpeech.ts — fetch + play neural TTS audio from the backend.
 *
 * The browser's built-in `speechSynthesis` API only exposes a small
 * set of "compact" macOS voices that sound robotic. To get
 * studio-quality narration we run Piper (rhasspy/piper) on the
 * backend (CPU-only ONNX inference, ~600 ms / sentence) and stream
 * the WAV result to an HTMLAudioElement.
 *
 * Used by:
 *   • CosmicAudioBriefing  — the "Daily Briefing" card on Home
 *   • Reveal screen voice-overs (future)
 *
 * The voice overlay (Ask Vidhaata) still uses Web Speech because it
 * needs ASR + barge-in interruption; we'll port it later.
 */

import { Platform } from 'react-native';
import { BACKEND_URL } from '../utils/backendUrl';
import { getPiperVoice, getVoicePref, getCachedGreetingUrl, setCachedGreeting, type Lang } from './voicePref';

// v9.20 — `PiperVoice` is now any backend voice id (curated id like
// 'norman' / 'te_aoede', OR a fully-qualified Google name like
// 'en-GB-Chirp3-HD-Algieba'). Kept as a string alias for clarity.
export type PiperVoice = string;

/**
 * Resolve the user's saved voice preference for a language into a
 * backend voice id. If the user picked a 'browser:*' voice for English,
 * we fall back to the gctts default 'norman' for the briefing /
 * streaming pipelines (which can only play backend audio).
 */
export function getBackendVoiceId(lang: Lang = 'en'): string {
  const pref = getVoicePref(lang);
  if (pref.startsWith('gctts:')) return pref.slice('gctts:'.length);
  // Browser-only pref → use a sensible gctts default for backend playback.
  return lang === 'te' ? 'te_aoede' : 'norman';
}

let _audio: HTMLAudioElement | null = null;
let _abort: AbortController | null = null;

interface PlayOptions {
  voice?: PiperVoice;
  speed?: number;          // 1.0 = normal, 1.2 = 20% faster, 0.9 = slower
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

/** Cancel any in-flight request + stop currently-playing audio. */
export function stopPiper(): void {
  try { _abort?.abort(); } catch {}
  _abort = null;
  if (_audio) {
    try { _audio.pause(); _audio.src = ''; } catch {}
    _audio = null;
  }
}

/**
 * Fetch a Piper-rendered WAV from the backend and play it.
 * Resolves after audio playback ends. Rejects on network/decode error.
 */
export async function playPiperSpeech(
  text: string,
  opts: PlayOptions = {},
): Promise<void> {
  if (Platform.OS !== 'web') {
    // Native (iOS/Android) — Web Audio is browser-only. The mobile app
    // will use a native TTS plug later.
    opts.onError?.(new Error('Piper playback only supported on web'));
    return;
  }
  const cleaned = (text || '').trim();
  if (!cleaned) return;

  // Cancel any prior playback.
  stopPiper();

  const ctrl = new AbortController();
  _abort = ctrl;

  try {
    opts.onStart?.();
    const resp = await fetch(`${BACKEND_URL}/api/tts/speak`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleaned,
        voice: opts.voice || 'alba',
        speed: opts.speed ?? 1.0,
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      throw new Error(`TTS HTTP ${resp.status}: ${detail.slice(0, 160)}`);
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    _audio = audio;

    await new Promise<void>((resolve, reject) => {
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(url);
        if (_audio === audio) _audio = null;
        opts.onEnd?.();
        resolve();
      });
      audio.addEventListener('error', (e) => {
        URL.revokeObjectURL(url);
        if (_audio === audio) _audio = null;
        opts.onError?.(e);
        reject(e);
      });
      audio.play().catch((err) => {
        URL.revokeObjectURL(url);
        if (_audio === audio) _audio = null;
        opts.onError?.(err);
        reject(err);
      });
    });
  } catch (err) {
    if ((err as any)?.name === 'AbortError') return; // user-initiated cancel
    opts.onError?.(err);
    throw err;
  } finally {
    if (_abort === ctrl) _abort = null;
  }
}

/** Returns true if a request is in flight or audio is playing. */
export function isPiperBusy(): boolean {
  return !!(_abort || (_audio && !_audio.paused));
}

/**
 * Lower-level helper for components that want to control playback
 * themselves (pause/seek/scrub). Fetches the WAV from the backend and
 * returns an object-URL the caller can attach to an <audio> element.
 *
 * Caller is responsible for `URL.revokeObjectURL(url)` when done.
 */
export async function fetchPiperAudioUrl(
  text: string,
  voice: PiperVoice = 'alba',
  speed: number = 1.0,
  signal?: AbortSignal,
): Promise<string> {
  if (Platform.OS !== 'web') throw new Error('Piper playback web-only');
  const cleaned = (text || '').trim();
  if (!cleaned) throw new Error('Empty text');
  const resp = await fetch(`${BACKEND_URL}/api/tts/speak`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: cleaned, voice, speed }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`TTS HTTP ${resp.status}: ${detail.slice(0, 160)}`);
  }
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}

/**
 * Greeting-aware fetcher: uses the daily-cached WAV if it matches the
 * requested text+voice, otherwise fetches fresh from /api/tts/speak
 * and caches the response under today's key. Used by the audio
 * briefing card so subsequent taps in the same day are instant.
 */
export async function fetchGreetingAudioUrl(
  text: string,
  voice: PiperVoice = getPiperVoice() as PiperVoice,
  speed: number = 1.0,
  signal?: AbortSignal,
): Promise<string> {
  if (Platform.OS !== 'web') throw new Error('Piper playback web-only');
  const cleaned = (text || '').trim();
  if (!cleaned) throw new Error('Empty text');

  // Cache hit?
  const hit = getCachedGreetingUrl(cleaned, voice);
  if (hit) {
    console.log('[greeting] cache HIT — instant playback');
    return hit;
  }

  // Cache miss → fetch + cache.
  const resp = await fetch(`${BACKEND_URL}/api/tts/speak`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: cleaned, voice, speed }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`TTS HTTP ${resp.status}: ${detail.slice(0, 160)}`);
  }
  const blob = await resp.blob();
  // Persist in background so playback isn't blocked.
  setCachedGreeting(cleaned, voice, blob).catch(() => {});
  return URL.createObjectURL(blob);
}

/**
 * Pre-render the greeting audio in the background so it's ready when
 * the user taps Play. Idempotent — does nothing if the cache is
 * already warm for today's text+voice.
 */
export async function prefetchGreeting(
  text: string,
  voice: PiperVoice = getPiperVoice() as PiperVoice,
): Promise<void> {
  if (Platform.OS !== 'web') return;
  const cleaned = (text || '').trim();
  if (!cleaned) return;
  // Quick hit check — avoid even a single fetch if cache is warm.
  const hit = getCachedGreetingUrl(cleaned, voice);
  if (hit) {
    try { URL.revokeObjectURL(hit); } catch {}
    console.log('[greeting] prefetch — already warm for today');
    return;
  }
  try {
    const resp = await fetch(`${BACKEND_URL}/api/tts/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleaned, voice, speed: 1.0 }),
    });
    if (!resp.ok) return;
    const blob = await resp.blob();
    await setCachedGreeting(cleaned, voice, blob);
    console.log('[greeting] prefetch — warmed cache (' + Math.round(blob.size / 1024) + ' KB)');
  } catch (e) {
    console.warn('[greeting] prefetch failed', e);
  }
}

// ── v9.14 — Phase D: streamed playback ───────────────────────────
//
// For long Vidhaata replies (200+ chars), splitting into sentences
// and playing them in order gives sub-second start latency: as soon
// as sentence #1 is rendered (~600ms), it begins playing while #2/#3
// render in parallel. The user hears Vidhaata "thinking aloud"
// instead of waiting for the full WAV.

/** Split text into bite-sized utterances (~1-2 sentences each). */
export function splitForStream(text: string): string[] {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  // Sentence-aware split, but keep terminal punctuation. The negative
  // lookbehind protects abbreviations like "Mr." / "e.g." crudely.
  const parts = cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z\u0900-\u0DFF])/g)
    .map((s) => s.trim())
    .filter(Boolean);
  // Coalesce very short fragments with the previous one so each
  // request has enough text to amortize Piper's per-call overhead.
  const out: string[] = [];
  for (const p of parts) {
    if (out.length && (out[out.length - 1].length + p.length) < 80) {
      out[out.length - 1] += ' ' + p;
    } else {
      out.push(p);
    }
  }
  return out;
}

interface StreamPlayOptions {
  voice?: PiperVoice;
  speed?: number;
  onSentenceStart?: (i: number, total: number) => void;
  onProgress?: (i: number, total: number) => void;
  onAmplitude?: (v: number) => void;     // for orb pulse
  onError?: (e: any) => void;
}

let _streamAudio: HTMLAudioElement | null = null;
let _streamCtrl: AbortController | null = null;

/** Halt any active streamed playback. */
export function stopPiperStream(): void {
  try { _streamCtrl?.abort(); } catch {}
  _streamCtrl = null;
  if (_streamAudio) {
    try { _streamAudio.pause(); _streamAudio.src = ''; } catch {}
    _streamAudio = null;
  }
  // v9.16 — also drain the live sentence queue (used for end-to-end
  // streaming WHILE the LLM is still emitting tokens).
  _liveQueue.length = 0;
  _liveCancelled = true;
  if (_liveAudio) {
    try { _liveAudio.pause(); _liveAudio.src = ''; } catch {}
    _liveAudio = null;
  }
  _liveActive = false;
}

// ── v9.16 — Live sentence queue ──────────────────────────────────────
//
// Used by the chat SSE handler to fire TTS the *instant* a sentence
// finishes streaming from the LLM, without waiting for the full reply.
// This compounds with playPiperStreamed-style overlap to give true
// end-to-end streaming: user typically hears audio ~1.5 s after the
// first sentence-ending period reaches the browser, even on a
// 6-sentence reply.
//
// API:
//   liveStreamReset(voice)    — call at start of a new reply
//   liveStreamPush(sentence)  — enqueue a fully-completed sentence
//   liveStreamFlush()         — call when the LLM stream is done
//                               (no-op; queue drains naturally)
//   stopPiperStream()         — also drains this queue
//
// All methods are no-ops if Platform is not web.

const _liveQueue: string[] = [];
let _liveActive = false;
let _liveAudio: HTMLAudioElement | null = null;
let _liveVoice: PiperVoice = 'alba';
let _liveSpeed: number = 1.0;
let _liveCancelled = false;
let _liveAmplitudeCb: ((v: number) => void) | null = null;
let _liveAmplitudeTimer: number | null = null;

const _startLiveAmpPulse = () => {
  if (_liveAmplitudeTimer != null || !_liveAmplitudeCb) return;
  let t = 0;
  _liveAmplitudeTimer = window.setInterval(() => {
    t += 0.18;
    const v = 0.45 + 0.4 * Math.abs(Math.sin(t * 4.2)) + 0.1 * Math.sin(t * 11);
    _liveAmplitudeCb?.(Math.min(1, v));
  }, 50);
};
const _stopLiveAmpPulse = () => {
  if (_liveAmplitudeTimer != null) {
    clearInterval(_liveAmplitudeTimer);
    _liveAmplitudeTimer = null;
  }
  _liveAmplitudeCb?.(0);
};

const _liveDrain = async (): Promise<void> => {
  if (_liveActive) return;
  _liveActive = true;
  try {
    while (_liveQueue.length && !_liveCancelled) {
      const sentence = _liveQueue.shift();
      if (!sentence) continue;
      try {
        const url = await fetchPiperAudioUrl(sentence, _liveVoice, _liveSpeed);
        if (_liveCancelled) {
          try { URL.revokeObjectURL(url); } catch {}
          break;
        }
        const a = new Audio(url);
        _liveAudio = a;
        _startLiveAmpPulse();
        await new Promise<void>((resolve) => {
          const cleanup = () => {
            try { URL.revokeObjectURL(url); } catch {}
            if (_liveAudio === a) _liveAudio = null;
            resolve();
          };
          a.addEventListener('ended', cleanup);
          a.addEventListener('error', cleanup);
          a.play().catch((err) => { console.warn('[liveStream] play() rejected', err); cleanup(); });
        });
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.warn('[liveStream] sentence failed', e);
        // Continue with next sentence.
      }
    }
  } finally {
    _stopLiveAmpPulse();
    _liveActive = false;
  }
};

/** Reset state for a fresh reply. Call before pushing the first sentence. */
export function liveStreamReset(
  voice: PiperVoice = getPiperVoice() as PiperVoice,
  speed: number = 1.0,
  onAmplitude?: (v: number) => void,
): void {
  if (Platform.OS !== 'web') return;
  // Halt any prior playback first.
  stopPiperStream();
  _liveQueue.length = 0;
  _liveCancelled = false;
  _liveActive = false;
  _liveVoice = voice;
  _liveSpeed = speed;
  _liveAmplitudeCb = onAmplitude || null;
}

/** Enqueue a completed sentence; drain runs automatically. */
export function liveStreamPush(sentence: string): void {
  if (Platform.OS !== 'web') return;
  const s = (sentence || '').trim();
  if (!s) return;
  _liveQueue.push(s);
  if (!_liveActive) _liveDrain();
}

/** Optional explicit flush — currently a no-op (queue drains naturally). */
export function liveStreamFlush(): void { /* no-op */ }


/**
 * Sentence-streamed playback: fetches each sentence in parallel (up
 * to a concurrency cap), plays them sequentially. Returns when ALL
 * audio has finished playing or the stream is aborted.
 */
export async function playPiperStreamed(
  text: string,
  opts: StreamPlayOptions = {},
): Promise<void> {
  if (Platform.OS !== 'web') {
    opts.onError?.(new Error('streamed playback web-only'));
    return;
  }
  stopPiperStream();   // halt any previous stream

  const sentences = splitForStream(text);
  if (!sentences.length) return;

  const voice  = opts.voice ?? (getPiperVoice() as PiperVoice);
  const speed  = opts.speed ?? 1.0;
  const total  = sentences.length;
  const ctrl   = new AbortController();
  _streamCtrl  = ctrl;

  // Concurrency cap — we kick off up to 3 fetches in parallel so the
  // backend isn't hammered for very long replies (still keeps audio
  // arriving faster than we can play it).
  const PARALLEL = 3;
  const urls: (string | null)[] = new Array(total).fill(null);
  const errs: any[] = new Array(total).fill(null);

  let nextFetch = 0;
  const fetchOne = async () => {
    while (true) {
      const i = nextFetch++;
      if (i >= total || ctrl.signal.aborted) return;
      try {
        const url = await fetchPiperAudioUrl(sentences[i], voice, speed, ctrl.signal);
        urls[i] = url;
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        errs[i] = e;
      }
    }
  };
  // Kick off the worker pool — they self-claim indexes via nextFetch.
  const workers = Array.from({ length: Math.min(PARALLEL, total) }, () => fetchOne());

  // Player loop: walks the urls[] array in order, awaits each entry to
  // become non-null, plays it through, then moves on.
  let amplitudeTimer: number | null = null;
  const startPulse = () => {
    if (amplitudeTimer != null) return;
    let t = 0;
    amplitudeTimer = window.setInterval(() => {
      t += 0.18;
      const v = 0.45 + 0.4 * Math.abs(Math.sin(t * 4.2)) + 0.1 * Math.sin(t * 11);
      opts.onAmplitude?.(Math.min(1, v));
    }, 50);
  };
  const stopPulse = () => {
    if (amplitudeTimer != null) {
      clearInterval(amplitudeTimer);
      amplitudeTimer = null;
    }
    opts.onAmplitude?.(0);
  };

  try {
    for (let i = 0; i < total; i++) {
      if (ctrl.signal.aborted) break;
      // Wait for fetch to land (poll urls[i]; max 15s safety timeout).
      const start = Date.now();
      while (urls[i] == null && errs[i] == null && !ctrl.signal.aborted) {
        if (Date.now() - start > 15000) {
          errs[i] = new Error('TTS fetch timeout');
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      if (ctrl.signal.aborted) break;
      if (errs[i] || !urls[i]) {
        opts.onError?.(errs[i] || new Error('Empty audio chunk'));
        continue; // skip this sentence, continue with the rest
      }

      opts.onSentenceStart?.(i, total);
      opts.onProgress?.(i, total);

      const url = urls[i] as string;
      const a = new Audio(url);
      _streamAudio = a;
      startPulse();

      await new Promise<void>((resolve) => {
        const cleanup = () => {
          a.removeEventListener('ended', cleanup);
          a.removeEventListener('error', cleanup);
          try { URL.revokeObjectURL(url); } catch {}
          if (_streamAudio === a) _streamAudio = null;
          resolve();
        };
        a.addEventListener('ended', cleanup);
        a.addEventListener('error', cleanup);
        // If user aborts, end this segment immediately.
        const onAbort = () => { try { a.pause(); } catch {}; cleanup(); };
        ctrl.signal.addEventListener('abort', onAbort, { once: true });
        a.play().catch((err) => { console.warn('[stream] play() rejected', err); cleanup(); });
      });
    }
  } finally {
    stopPulse();
    // Drain remaining workers (they observe ctrl.signal).
    try { ctrl.abort(); } catch {}
    await Promise.allSettled(workers).catch(() => {});
    // Revoke any urls we never reached.
    for (let i = 0; i < total; i++) {
      if (urls[i]) { try { URL.revokeObjectURL(urls[i] as string); } catch {} }
    }
    if (_streamCtrl === ctrl) _streamCtrl = null;
    if (_streamAudio) _streamAudio = null;
  }
}
