/**
 * voiceEngine.ts — central TTS dispatcher (v9.20).
 *
 * The app speaks via TWO different engines depending on user choice
 * and content language:
 *
 *   1. **browser**   — free OS voices (Web Speech API). Best quality
 *                      for English on Chrome/Android (Google UK English
 *                      Female/Male). Free, offline-capable.
 *
 *   2. **gctts**     — Google Cloud TTS Chirp3-HD voices via the
 *                      backend `/api/tts/speak` endpoint. Required for
 *                      Telugu (browser Telugu voices are unreliable).
 *                      Also a premium option for English narration.
 *
 * The voice preference is stored per language in localStorage:
 *   • `aq_voice_en` → `'browser:Google UK English Female'` (default) or `'gctts:norman'`
 *   • `aq_voice_te` → `'gctts:te_aoede'` (default) — only gctts allowed for Telugu
 *
 * This file exposes:
 *   • detectLang(text)            — 'en' | 'te' from Unicode range
 *   • resolveVoice(lang)          — { engine: 'browser'|'gctts', id: string }
 *   • speakWithEngine(text, opts) — single-shot playback
 *
 * Long replies still use the live-stream queue from piperSpeech.ts.
 */

import { Platform } from 'react-native';
import { getVoicePref, type Lang } from './voicePref';

// Telugu Unicode block: U+0C00 – U+0C7F.
const TELUGU_RE = /[\u0C00-\u0C7F]/;

/** Detect the language of a text fragment. */
export function detectLang(text: string): Lang {
  if (TELUGU_RE.test(text || '')) return 'te';
  return 'en';
}

export interface ResolvedVoice {
  /** The engine to use for this voice. */
  engine: 'browser' | 'gctts';
  /** For 'browser': the SpeechSynthesisVoice name (e.g. 'Google UK English Female').
   *  For 'gctts':   the curated voice id (e.g. 'norman' / 'te_aoede') OR a full Google name. */
  id: string;
  /** Helpful for the browser engine — sets utterance.lang. */
  lang: 'en-GB' | 'en-US' | 'te-IN';
}

/** Resolve the user's saved preference into an engine + id. */
export function resolveVoice(lang: Lang): ResolvedVoice {
  const pref = getVoicePref(lang);
  if (pref.startsWith('browser:')) {
    return {
      engine: 'browser',
      id: pref.slice('browser:'.length),
      lang: lang === 'te' ? 'te-IN' : 'en-GB',
    };
  }
  // gctts:* — strip prefix
  const id = pref.startsWith('gctts:') ? pref.slice('gctts:'.length) : pref;
  // Best-effort lang inference. Telugu voices all start with 'te_' in
  // our curated catalog, plus we know the page language too.
  const inferredLang =
    lang === 'te' || id.startsWith('te_') || id.includes('te-IN')
      ? 'te-IN'
      : id.includes('en-US')
        ? 'en-US'
        : 'en-GB';
  return { engine: 'gctts', id, lang: inferredLang };
}

// ── Browser preview helper ─────────────────────────────────────────
/**
 * Speak a short sample using a specific browser voice (by name) — used
 * by the Settings preview button. Cancels any prior utterance first.
 */
export function previewBrowserVoice(voiceName: string, sample = 'Hello, I am Vidhaata. May the cosmos guide you today.'): void {
  if (typeof window === 'undefined' || !(window as any).speechSynthesis) return;
  const ss = window.speechSynthesis;
  try { ss.cancel?.(); } catch { /* ignore */ }
  const v = (ss.getVoices?.() || []).find((x: SpeechSynthesisVoice) => x.name === voiceName);
  const u = new SpeechSynthesisUtterance(sample);
  if (v) {
    u.voice = v;
    if (v.lang) u.lang = v.lang;
  }
  u.rate = 1.02;
  u.pitch = 1.0;
  try { ss.resume?.(); } catch { /* ignore */ }
  ss.speak(u);
}

/** List available browser TTS voices (returns [] if voices not loaded yet). */
export function listBrowserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !(window as any).speechSynthesis) return [];
  return window.speechSynthesis.getVoices?.() || [];
}

/** Wait until `getVoices()` returns a non-empty list, or timeout. */
export function awaitBrowserVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
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
    const handler = () => {
      if (tryResolve()) ss.removeEventListener?.('voiceschanged', handler as any);
    };
    ss.addEventListener?.('voiceschanged', handler as any);
    setTimeout(() => {
      ss.removeEventListener?.('voiceschanged', handler as any);
      resolve(ss.getVoices?.() || []);
    }, timeoutMs);
  });
}

/** Filter+score browser voices: surface premium / Google / Microsoft on top. */
export function rankBrowserVoices(
  voices: SpeechSynthesisVoice[],
  preferLang: 'en' | 'te' = 'en',
): SpeechSynthesisVoice[] {
  const wantTe = preferLang === 'te';
  const candidates = voices.filter((v) => {
    const l = (v.lang || '').toLowerCase();
    return wantTe ? l.startsWith('te') : l.startsWith('en');
  });
  const score = (v: SpeechSynthesisVoice): number => {
    const n = (v.name || '').toLowerCase();
    let s = 0;
    if (n.includes('online'))    s += 5;
    if (n.includes('premium') || n.includes('enhanced') || n.includes('natural') || n.includes('neural')) s += 4;
    // Google UK English voices on Chrome are very high quality.
    if (n.includes('google uk'))  s += 6;
    if (n.includes('google us'))  s += 5;
    if (n.includes('google'))     s += 4;
    if (n.includes('microsoft'))  s += 2;
    if (n.includes('aria') || n.includes('jenny')) s += 3;
    if (n.includes('samantha') || n.includes('serena') || n.includes('ava')) s += 3;
    if (n.includes('female'))     s += 1;
    if (n.includes('espeak'))     s -= 5;
    if (v.lang === 'en-GB' && !wantTe) s += 2;
    if (v.lang === 'en-US' && !wantTe) s += 1;
    return s;
  };
  return candidates.slice().sort((a, b) => score(b) - score(a));
}

// ── Voice catalog (server-fed) ─────────────────────────────────────
import { BACKEND_URL } from '../utils/backendUrl';

export interface CatalogVoice {
  id: string;        // 'norman', 'te_aoede', …
  name: string;      // full Google name
  label: string;
  sub: string;
  lang: string;
  gender: 'MALE' | 'FEMALE';
  engine: 'gctts';
}
let _catalog: CatalogVoice[] | null = null;
let _catalogPromise: Promise<CatalogVoice[]> | null = null;

export async function fetchVoiceCatalog(): Promise<CatalogVoice[]> {
  if (_catalog) return _catalog;
  if (_catalogPromise) return _catalogPromise;
  _catalogPromise = (async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/tts/voices`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      _catalog = (j?.voices || []) as CatalogVoice[];
      return _catalog;
    } catch (e) {
      console.warn('[voiceEngine] catalog fetch failed', e);
      _catalog = [];
      return _catalog;
    } finally {
      _catalogPromise = null;
    }
  })();
  return _catalogPromise;
}

// ── Speak helpers (high-level) ──────────────────────────────────────
//
// These are intentionally thin — most speak()-style flows live in
// useWebVoice (Vidhaata overlay) or piperSpeech (briefing/streaming).
// We only need a one-shot helper for the Settings preview button.

export async function previewVoice(pref: { engine: 'browser' | 'gctts'; id: string; lang?: string }): Promise<void> {
  if (Platform.OS !== 'web') return;
  if (pref.engine === 'browser') {
    const sample = pref.lang?.startsWith('te')
      ? 'నమస్కారం, నేను విధాత. మీకు శుభమగుగాక.'
      : 'Hello, I am Vidhaata. May the cosmos guide you today.';
    previewBrowserVoice(pref.id, sample);
    return;
  }
  // gctts → fetch from backend and play.
  const text = pref.lang?.startsWith('te')
    ? 'నమస్కారం, నేను విధాత. విశ్వం మీకు మార్గదర్శకం అవుగాక.'
    : pref.id === 'norman'
      ? 'Greetings traveller. The cosmos unfolds before you, vast and patient.'
      : pref.id === 'ryan'
        ? 'Hello. This is Ryan. Today is a good day for steady, grounded action.'
        : 'Hello, dear seeker. May the cosmos guide you with warmth and clarity today.';
  try {
    const r = await fetch(`${BACKEND_URL}/api/tts/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: pref.id, speed: 1.0 }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    const cleanup = () => { try { URL.revokeObjectURL(url); } catch { /* */ } };
    a.addEventListener('ended', cleanup);
    a.addEventListener('error', cleanup);
    await a.play();
  } catch (e) {
    console.warn('[voiceEngine] preview failed', e);
  }
}
