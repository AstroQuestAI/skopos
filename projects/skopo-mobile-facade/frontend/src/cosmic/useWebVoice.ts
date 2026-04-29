/**
 * useWebVoice — Web Speech API wrapper (Phase 1 voice for the PWA).
 *
 * Provides:
 *   • startListening() / stopListening()  — webkitSpeechRecognition wrapper
 *   • speak(text)                         — speechSynthesis wrapper
 *   • state machine: 'idle' | 'listening' | 'thinking' | 'speaking'
 *   • amplitude (0..1) sampled from microphone via WebAudio while
 *     listening, and from a fake oscillator while speaking. The orb
 *     UI subscribes to this so the glow pulses with the user's voice.
 *
 * On non-web platforms or browsers without webkitSpeechRecognition,
 * `supported` is false and the hook degrades to a no-op (UI shows
 * "voice not supported, please type").
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Options {
  /** Locale, e.g. "en-US", "te-IN". Defaults to "en-US". */
  lang?: string;
  /** Called every time we get a final transcript chunk. */
  onTranscript?: (text: string) => void;
  /** Called when the speech recognition errors out. */
  onError?: (e: any) => void;
}

interface UseWebVoice {
  supported: boolean;
  state: VoiceState;
  amplitude: number;          // 0..1 — drives the orb glow
  interim: string;            // running transcript while speaking
  startListening: () => Promise<void>;
  stopListening: () => void;
  speak: (text: string, lang?: string) => Promise<void>;
  cancelSpeaking: () => void;
  setState: (s: VoiceState) => void;
  /** Pre-warms speechSynthesis with a silent utterance — must be
      called from inside a user gesture handler so subsequent speak()
      calls (after async API responses) aren't blocked. */
  primeTTS: () => void;
}

// v9.7 — persistent per-device voice pin. The Settings page exposes a
// picker so users can override the auto-scorer with a specific voice
// (e.g. "Microsoft Aria Online" on Edge, "Ava (Enhanced)" on macOS).
const VOICE_PIN_KEY = 'astroquest.tts.pinnedVoiceName.v1';
export function getPinnedVoiceName(): string | null {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(VOICE_PIN_KEY) : null; }
  catch { return null; }
}
export function setPinnedVoiceName(name: string | null) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!name) localStorage.removeItem(VOICE_PIN_KEY);
    else       localStorage.setItem(VOICE_PIN_KEY, name);
  } catch {}
}

/**
 * List every TTS voice the OS / browser exposes. Returns an empty list
 * if voices haven't loaded yet (Chrome populates them async — call
 * `awaitVoicesReady()` first if you need them on cold start).
 */
export function listTTSVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !(window as any).speechSynthesis) return [];
  return window.speechSynthesis.getVoices?.() || [];
}

/** Resolves once `getVoices()` returns a non-empty list (or after 1500ms). */
export function awaitVoicesReady(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !(window as any).speechSynthesis) {
      resolve([]); return;
    }
    const ss = window.speechSynthesis;
    const tryResolve = () => {
      const v = ss.getVoices?.() || [];
      if (v.length) { resolve(v); return true; }
      return false;
    };
    if (tryResolve()) return;
    const handler = () => { if (tryResolve()) ss.removeEventListener?.('voiceschanged', handler as any); };
    ss.addEventListener?.('voiceschanged', handler as any);
    setTimeout(() => { ss.removeEventListener?.('voiceschanged', handler as any); resolve(ss.getVoices?.() || []); }, timeoutMs);
  });
}

/** Speak a short preview phrase using a specific voice — used by the picker. */
export function previewTTSVoice(voiceName: string, sample = 'Hello, I am Vidhaata. May the cosmos guide you today.') {
  if (typeof window === 'undefined' || !(window as any).speechSynthesis) return;
  const ss = window.speechSynthesis;
  try { ss.cancel?.(); } catch {}
  const v = (ss.getVoices?.() || []).find((x: SpeechSynthesisVoice) => x.name === voiceName);
  const u = new SpeechSynthesisUtterance(sample);
  if (v) { u.voice = v; if (v.lang) u.lang = v.lang; }
  u.rate = 1.02; u.pitch = 1.0;
  try { ss.resume?.(); } catch {}
  ss.speak(u);
}

export function useWebVoice(opts: Options = {}): UseWebVoice {
  const { lang = 'en-US', onTranscript, onError } = opts;
  const [state, setState] = useState<VoiceState>('idle');
  const [amplitude, setAmplitude] = useState(0);
  const [interim, setInterim] = useState('');
  const [supported, setSupported] = useState(false);

  const recogRef     = useRef<any>(null);
  const audioCtxRef  = useRef<any>(null);
  const analyserRef  = useRef<any>(null);
  const rafRef       = useRef<number | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const speakingTimerRef = useRef<number | null>(null);
  // v9.11 — Piper neural TTS playback handles (separate from Web
  // Speech). We track them here so cancelSpeaking() can halt either
  // engine cleanly.
  const piperAbortRef = useRef<AbortController | null>(null);
  const piperAudioRef = useRef<HTMLAudioElement | null>(null);
  // Silence-detection timer — when no new interim result lands within
  // SILENCE_MS, we manually stop recognition and emit whatever we have.
  const silenceTimerRef = useRef<number | null>(null);
  const lastFinalRef    = useRef<string>('');
  const lastInterimRef  = useRef<string>('');
  const SILENCE_MS = 1800;

  // ── Detect Web Speech API support ────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') { setSupported(false); return; }
    const W: any = typeof window !== 'undefined' ? window : {};
    const sr = W.SpeechRecognition || W.webkitSpeechRecognition;
    const ss = W.speechSynthesis;
    setSupported(!!sr && !!ss);
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────
  useEffect(() => () => {
    try { recogRef.current?.stop?.(); } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { audioCtxRef.current?.close?.(); } catch {}
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (speakingTimerRef.current) clearInterval(speakingTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    try { (window as any)?.speechSynthesis?.cancel?.(); } catch {}
  }, []);

  // ── Live mic amplitude meter ─────────────────────────────────────
  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const W: any = window;
      const Ctx = W.AudioContext || W.webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length); // 0..1
        setAmplitude(Math.min(1, rms * 2.5));     // amplify a touch
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      // mic permission denied or hw issue — fall back to faux pulse
      console.warn('[useWebVoice] mic meter unavailable', e);
    }
  }, []);

  const stopMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    streamRef.current = null;
    try { audioCtxRef.current?.close?.(); } catch {}
    audioCtxRef.current = null;
    setAmplitude(0);
  }, []);

  // ── Listening (ASR) ──────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (!supported) return;
    const W: any = window;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = lang;
    // v9.7 — Android Chrome quirks:
    //   • `continuous: true` is broken — the engine fires onend
    //     immediately before the user even speaks. Force false on Android.
    //   • Built-in end-of-speech detection actually works on Android,
    //     so let it run instead of our manual silence timer.
    //   • Running getUserMedia() at the same time as the recognizer
    //     fights for the mic on most Android devices and triggers
    //     "audio-capture" errors. Skip the meter on Android — the orb
    //     amplitude oscillator falls back to its faux pulse anyway.
    const ua = (W.navigator?.userAgent || '').toLowerCase();
    const isAndroid = ua.includes('android');
    const isMobile  = isAndroid || ua.includes('iphone') || ua.includes('ipad') || /mobi/i.test(ua);
    recog.continuous     = !isAndroid;
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    recogRef.current = recog;

    setInterim('');
    lastFinalRef.current = '';
    lastInterimRef.current = '';
    setState('listening');
    if (!isMobile) {
      // Desktop only — the visualiser meter looks great there.
      await startMeter();
    }

    const armSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      // v9.7 — give Android a much longer cushion. The engine takes
      // ~500ms to warm up + the user often pauses to think for 2-3s
      // before speaking. Our old 1.8s timer was killing recognition
      // before the first word landed.
      const ms = isAndroid ? 6000 : SILENCE_MS;
      silenceTimerRef.current = window.setTimeout(() => {
        // Manually stop — onend will fire and emit the accumulated text.
        try { recog.stop(); } catch {}
      }, ms);
    };

    recog.onresult = (event: any) => {
      let interimText = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) {
        lastFinalRef.current = (lastFinalRef.current + ' ' + finalText).trim();
      }
      lastInterimRef.current = interimText;
      // Show running interim under the orb.
      setInterim((lastFinalRef.current + ' ' + interimText).trim());
      // Reset silence timer on every new chunk.
      armSilenceTimer();
    };
    recog.onerror = (e: any) => {
      console.warn('[useWebVoice] recog error', e?.error || e);
      // v9.7 — surface a HUMAN-readable message via onError so the
      // overlay can render it. Silent failures on Android are the most
      // common "voice doesn't work" complaint.
      const code: string = e?.error || 'unknown';
      const friendly = (() => {
        switch (code) {
          case 'not-allowed':
          case 'service-not-allowed':
            return 'Microphone permission was denied. Tap the lock icon in the address bar and allow microphone access, then try again.';
          case 'audio-capture':
            return "Couldn't access the microphone. On Android, close any other app using the mic (e.g. Google Assistant, WhatsApp call) and reload this page.";
          case 'no-speech':
            return "I didn't hear anything. Tap the mic and speak a little louder.";
          case 'network':
            return 'Speech recognition needs an internet connection — check your network and try again.';
          case 'aborted':
            return ''; // user-initiated stop, don't shout at them
          default:
            return `Voice error: ${code}. Type your question instead and Vidhaata will answer.`;
        }
      })();
      if (friendly) onError?.(new Error(friendly));
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      setState('idle');
      stopMeter();
    };
    recog.onend = () => {
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      stopMeter();
      // Emit the accumulated transcript exactly once, then go idle so the
      // consumer can flip to 'thinking' / 'speaking'.
      const finalText = (lastFinalRef.current || lastInterimRef.current).trim();
      lastFinalRef.current = '';
      lastInterimRef.current = '';
      setInterim('');
      setState((s) => (s === 'listening' ? 'idle' : s));
      if (finalText) {
        onTranscript?.(finalText);
      }
    };
    // Fire an initial silence timer so a user who taps the orb but never
    // speaks gets a graceful auto-stop.
    armSilenceTimer();
    try {
      recog.start();
    } catch (e: any) {
      console.warn('[useWebVoice] start failed', e);
      // Android sometimes throws "InvalidStateError" if recog.start() is
      // called before the previous instance fully released. One retry
      // after a short tick usually works.
      setTimeout(() => {
        try { recog.start(); } catch (e2) {
          onError?.(new Error("Couldn't start voice recognition. Type your question instead."));
          setState('idle');
        }
      }, 300);
    }
  }, [supported, lang, onTranscript, onError, startMeter, stopMeter]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    try { recogRef.current?.stop?.(); } catch {}
    stopMeter();
    setState('idle');
  }, [stopMeter]);

  // v9.7 — pick the most natural-sounding voice the engine offers.
  // Premium voices like "Google UK English Female", "Microsoft Aria
  // Online", "Samantha" / "Daniel" (macOS) sound MUCH closer to ElevenLabs
  // than the default robotic voice Chrome ships with. We cache the pick
  // so we don't re-rank on every utterance.
  const pickBestVoice = useCallback((preferLang = 'en-US'): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !(window as any).speechSynthesis) return null;
    const all: SpeechSynthesisVoice[] = window.speechSynthesis.getVoices?.() || [];
    if (!all.length) return null;
    // v9.7 — honour the user's pinned voice from Settings, if any.
    const pinned = getPinnedVoiceName();
    if (pinned) {
      const exact = all.find(v => v.name === pinned);
      if (exact) return exact;
    }
    const wantTe = preferLang.startsWith('te');
    // v9.17 — STRICT Telugu pool. Earlier we let Hindi voices
    // (Lekha/Veena) be picked as a "better than nothing" fallback,
    // but Hindi voices don't recognise Telugu Unicode and produce
    // gibberish. So we now ONLY use voices that explicitly speak
    // Telugu; if the OS has none installed, we leave `pool` empty
    // and the speak() path will fall back to the browser's default
    // engine (which at least pronounces Telugu syllables correctly,
    // even if robotically).
    let candidates: SpeechSynthesisVoice[] = [];
    if (wantTe) {
      candidates = all.filter(v => v.lang.startsWith('te'));
      // No fallback to Hindi — that path produced gibberish.
    } else {
      candidates = all.filter(v => v.lang.startsWith('en'));
    }
    const pool = candidates.length ? candidates : (wantTe ? [] : all);
    // Score each voice — premium / female / "Aria"-class first.
    const score = (v: SpeechSynthesisVoice): number => {
      const n = (v.name || '').toLowerCase();
      let s = 0;
      // Premium / online voices are noticeably better than local fallbacks
      if (n.includes('online')) s += 5;
      if (n.includes('premium') || n.includes('enhanced') || n.includes('natural')) s += 4;
      if (n.includes('neural'))  s += 4;
      // v9.14 — Telugu-specific preferences (Mac/iOS ship "Veena"-like
      // voices for Indic langs; Microsoft has SHRUTI/MOHAN). These all
      // score better than the basic eSpeak fallback.
      if (wantTe) {
        if (n.includes('shruti'))  s += 5;   // Microsoft Hindi/Telugu female
        if (n.includes('kalpana')) s += 5;   // Microsoft Telugu female
        if (n.includes('mohan'))   s += 4;   // Microsoft Telugu male
        if (n.includes('chitra'))  s += 4;   // Apple Tamil/Indic female
        if (n.includes('lekha'))   s += 4;
        if (n.includes('rishi'))   s += 4;
        if (n.includes('raveena')) s += 4;
        if (n.includes('veena'))   s += 4;
        // Penalise generic eSpeak / "default" engines for Telugu —
        // they sound notoriously robotic.
        if (n.includes('espeak'))  s -= 4;
      }
      // Vidhaata-persona shaping: prefer warm, clear female voices (English path)
      if (n.includes('aria'))    s += 4;
      if (n.includes('jenny'))   s += 3;
      if (n.includes('samantha')) s += 3;
      if (n.includes('serena'))  s += 3;
      if (n.includes('nora'))    s += 2;
      if (n.includes('karen'))   s += 2;
      if (n.includes('female'))  s += 2;
      if (n.includes('google'))  s += 2;
      if (n.includes('microsoft')) s += 2;
      // Penalise low-quality fallback voices
      if (n.includes('eddy')      ) s -= 2;
      if (n.includes('robot')     ) s -= 4;
      if (n.includes('whisper')   ) s -= 3;   // some macOS "whisper" voice is a novelty effect
      // English regional preference: en-US > en-GB > others
      if (!wantTe) {
        if (v.lang === 'en-US') s += 2;
        else if (v.lang === 'en-GB') s += 1;
      } else {
        // Telugu regional preference: te-IN over te (no region)
        if (v.lang === 'te-IN') s += 2;
      }
      return s;
    };
    pool.sort((a, b) => score(b) - score(a));
    return pool[0] || null;
  }, []);
  // Chrome / Safari require a *fresh* user-activation gesture to call
  // `speechSynthesis.speak()`. By the time an LLM reply lands (often
  // 3-6 s later) the activation window has closed and `speak()` is
  // silently dropped — so we proactively "prime" the engine on the
  // tap-to-talk gesture by speaking a silent utterance. After that,
  // subsequent speak() calls are honoured for the rest of the page
  // session in most engines.
  //
  // v9.6 — additionally fire a silent KEEP-ALIVE utterance every 8 s
  // while the orb is open (state !== 'idle'). Empirically this is the
  // smallest interval that survives Chrome's user-activation expiry +
  // its known 14-second-silence speech-pause bug. Without this the
  // orb sits in "thinking…" forever and never speaks the LLM reply.
  const primedRef     = useRef<boolean>(false);
  const keepAliveRef  = useRef<number | null>(null);
  const fireSilent = useCallback(() => {
    if (typeof window === 'undefined' || !(window as any).speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0; u.rate = 1; u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }, []);
  const startKeepAlive = useCallback(() => {
    if (keepAliveRef.current != null) return;
    keepAliveRef.current = window.setInterval(() => {
      // resume() is a no-op when not paused but pulls Chrome back from
      // its 14-sec auto-pause. Then top up the activation queue.
      try { (window as any).speechSynthesis?.resume?.(); } catch {}
      fireSilent();
    }, 8000) as unknown as number;
  }, [fireSilent]);
  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current != null) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);
  const primeTTS = useCallback(() => {
    if (typeof window === 'undefined' || !(window as any).speechSynthesis) return;
    try {
      // Always re-prime on tap — gestures are cheap, and Chrome may
      // have rotated activation since the last time the user tapped.
      fireSilent();
      primedRef.current = true;
      // Make sure the engine isn't paused at the moment of priming.
      try { (window as any).speechSynthesis?.resume?.(); } catch {}
      // Pre-load voices — some browsers populate voices async, and the
      // first `speak()` after a cold start drops the utterance silently
      // if voices aren't yet there.
      try { (window as any).speechSynthesis?.getVoices?.(); } catch {}
      startKeepAlive();
    } catch (e) {
      console.warn('[useWebVoice] prime failed', e);
    }
  }, [fireSilent, startKeepAlive]);

  const speak = useCallback(async (text: string, ttsLang = 'en-US') => {
    if (!supported || !text) return;

    // v9.20 — Voice engine dispatch:
    //   English  → user pref may be 'browser:*' (Web Speech) or 'gctts:*'
    //              (Google Cloud TTS via backend).
    //   Telugu   → always 'gctts:*' (Google Chirp3-HD), browser Telugu
    //              voices are unreliable and produce garbled output.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolveVoice, detectLang } = require('./voiceEngine');
    const langCode: 'en' | 'te' = ttsLang.startsWith('te') ? 'te' : detectLang(text);
    const resolved: { engine: 'browser' | 'gctts'; id: string; lang: string } = resolveVoice(langCode);

    // Backend (gctts) path — works for both English and Telugu.
    if (resolved.engine === 'gctts') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { fetchPiperAudioUrl, playPiperStreamed, splitForStream } = require('./piperSpeech');
        const ctrl = new AbortController();
        piperAbortRef.current = ctrl;

        // v9.14 — for long replies, split into sentences and stream them.
        const chunks: string[] = splitForStream(text);
        if (chunks.length >= 2) {
          setState('speaking');
          await playPiperStreamed(text, {
            voice: resolved.id,
            speed: 1.0,
            onAmplitude: (v: number) => setAmplitude(v),
            onError: (e: any) => console.warn('[stream] segment error', e),
          });
          setAmplitude(0);
          setState('idle');
          return;
        }

        // Short reply — single-fetch path.
        const url: string = await fetchPiperAudioUrl(text, resolved.id, 1.0, ctrl.signal);
        const a = new Audio(url);
        piperAudioRef.current = a;

        // Drive the orb pulse from the audio element.
        setState('speaking');
        if (speakingTimerRef.current) clearInterval(speakingTimerRef.current);
        let t = 0;
        speakingTimerRef.current = window.setInterval(() => {
          t += 0.18;
          const v = 0.45 + 0.4 * Math.abs(Math.sin(t * 4.2)) + 0.1 * Math.sin(t * 11);
          setAmplitude(Math.min(1, v));
        }, 50);

        await new Promise<void>((resolve) => {
          const cleanup = () => {
            if (speakingTimerRef.current) {
              clearInterval(speakingTimerRef.current);
              speakingTimerRef.current = null;
            }
            setAmplitude(0);
            setState('idle');
            try { URL.revokeObjectURL(url); } catch {}
            if (piperAudioRef.current === a) piperAudioRef.current = null;
            resolve();
          };
          a.addEventListener('ended', cleanup);
          a.addEventListener('error', cleanup);
          a.play().catch((err) => { console.warn('[piper] play() rejected', err); cleanup(); });
        });
        return;
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('[piper] failed → falling back to Web Speech', err?.message || err);
        } else {
          // user cancelled — DON'T fall through, just return.
          return;
        }
      }
    }

    return new Promise<void>((resolve) => {
      // Clamp very long replies — Chrome silently drops utterances
      // longer than ~4000 chars. We chunk them at sentence boundaries.
      const MAX = 3500;
      const safeText = text.length > MAX ? text.slice(0, MAX) + '…' : text;

      const u = new SpeechSynthesisUtterance(safeText);
      u.lang = ttsLang;
      u.rate = 1.02;     // a hair brisker than 1.0 — feels less robotic
      u.pitch = 1.0;
      // v9.7 — use the best available natural voice for the language.
      // Falls back to the engine default if nothing premium is found.
      try {
        // v9.20 — prefer the EXACT browser voice the user picked in
        // Settings (resolved.id), falling back to the auto-scorer.
        const all: SpeechSynthesisVoice[] = (window as any).speechSynthesis?.getVoices?.() || [];
        const pickedByName = resolved.engine === 'browser'
          ? all.find((vv) => vv.name === resolved.id)
          : null;
        const v = pickedByName || pickBestVoice(ttsLang);
        if (v) {
          u.voice = v;
          // Some engines need the lang to match the voice's lang exactly
          // or they ignore the voice= override.
          if (v.lang) u.lang = v.lang;
        }
      } catch { /* ignore */ }

      let started = false;
      let retried = false;
      u.onstart = () => {
        started = true;
        setState('speaking');
        // Faux amplitude oscillator while speaking (Web Speech API
        // doesn't expose audio data, so we fake a 4-6 Hz pulse).
        if (speakingTimerRef.current) clearInterval(speakingTimerRef.current);
        let t = 0;
        speakingTimerRef.current = window.setInterval(() => {
          t += 0.18;
          const a = 0.45 + 0.4 * Math.abs(Math.sin(t * 4.2)) + 0.1 * Math.sin(t * 11);
          setAmplitude(Math.min(1, a));
        }, 50);
      };
      const cleanup = () => {
        if (speakingTimerRef.current) {
          clearInterval(speakingTimerRef.current);
          speakingTimerRef.current = null;
        }
        setAmplitude(0);
        setState('idle');
        resolve();
      };
      u.onend = cleanup;
      u.onerror = (ev: any) => {
        console.warn('[useWebVoice] TTS onerror', ev?.error || ev);
        cleanup();
      };
      const ss = (window as any).speechSynthesis;
      try {
        // Make absolutely sure voices are warm. If not, calling speak()
        // immediately after a cold load drops the utterance.
        try { ss?.getVoices?.(); } catch {}
        try { ss?.resume?.(); } catch {}
        // Speak directly — DO NOT cancel() first. Cancelling and then
        // queuing in the same tick is dropped by Chrome (race in their
        // audio pipeline). We rely on consecutive speak()s queuing.
        ss.speak(u);

        // Fallback A: if onstart never fires within 2.5s, the gesture
        // expired or the queue stalled — try ONCE more with a fresh
        // re-prime + resume() + new utterance.
        setTimeout(() => {
          if (started || retried) return;
          retried = true;
          console.warn('[useWebVoice] TTS onstart never fired — retrying once');
          try { ss?.resume?.(); } catch {}
          try { ss?.cancel?.(); } catch {}
          // Top-up activation with a silent utterance, then queue the
          // real one again. This is what gets us back from Chrome's
          // post-await user-activation expiry.
          fireSilent();
          const u2 = new SpeechSynthesisUtterance(safeText);
          u2.lang = ttsLang; u2.rate = 1.0; u2.pitch = 1.0;
          u2.onstart = u.onstart;
          u2.onend   = u.onend;
          u2.onerror = u.onerror as any;
          try { ss.speak(u2); } catch (e2) { console.warn('[useWebVoice] retry speak failed', e2); }
          // Fallback B: if even the retry fails to start within 2.5s,
          // give up and unlock the UI.
          setTimeout(() => {
            if (!started) {
              console.warn('[useWebVoice] TTS retry never fired — giving up');
              cleanup();
            }
          }, 2500);
        }, 2500);
      } catch (e) {
        console.warn('[useWebVoice] speak failed', e);
        cleanup();
      }
    });
  }, [supported, fireSilent]);

  const cancelSpeaking = useCallback(() => {
    // v9.11 — abort any in-flight Piper request + stop its <audio>.
    try { piperAbortRef.current?.abort(); } catch {}
    piperAbortRef.current = null;
    const pa = piperAudioRef.current;
    if (pa) {
      try { pa.pause(); pa.src = ''; } catch {}
      piperAudioRef.current = null;
    }
    // v9.14 — also halt any sentence-streamed playback (long replies).
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { stopPiperStream } = require('./piperSpeech');
      stopPiperStream();
    } catch {}
    try { window.speechSynthesis.cancel(); } catch {}
    if (speakingTimerRef.current) {
      clearInterval(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }
    setAmplitude(0);
    setState('idle');
    // v9.6 — also stop the TTS keep-alive when the user explicitly
    // cancels / closes the overlay. Otherwise silent utterances keep
    // queuing in the background and waste the engine's user-activation
    // budget for the next session.
    stopKeepAlive();
    primedRef.current = false;
  }, [stopKeepAlive]);

  // Tear down the keep-alive timer on unmount.
  useEffect(() => {
    return () => {
      stopKeepAlive();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    supported,
    state,
    amplitude,
    interim,
    startListening,
    stopListening,
    speak,
    cancelSpeaking,
    setState,
    primeTTS,
  };
}
