/**
 * voicePref.ts — persisted voice preferences + daily greeting cache.
 *
 * v9.20 — Per-language voice picker:
 *   - `aq_voice_en`  → preferred English voice (browser:* OR gctts:<id>)
 *   - `aq_voice_te`  → preferred Telugu voice (gctts:<id>)
 *
 * "browser:" prefix means use the OS's free Web Speech API voice
 * (e.g. "Google UK English Male" — works offline, $0 cost).
 *
 * "gctts:" prefix means call the backend `/api/tts/speak` endpoint
 * which routes through Google Cloud TTS Chirp3-HD voices.
 *
 * Defaults:
 *   English → 'browser:Google UK English Female' (free, high quality)
 *   Telugu  → 'gctts:te_aoede' (warm female Telugu Chirp3-HD)
 *
 * The daily greeting cache stores Piper/Google-rendered audio under
 * a date+voice key so subsequent same-day taps are instant. Old
 * entries auto-evict.
 */

export type Lang = 'en' | 'te';

/** A voice descriptor stored in localStorage.
 *  Format: '<engine>:<id>'  — e.g. 'browser:Google UK English Male' or 'gctts:norman'. */
export type VoicePref = string;

const VOICE_KEY_EN = 'aq_voice_en';
const VOICE_KEY_TE = 'aq_voice_te';
const LEGACY_VOICE_KEY = 'aq_piper_voice';   // pre-v9.20
const GREETING_KEY_PREFIX = 'aq_greeting_';   // aq_greeting_2026-02-18_<voiceId>

const DEFAULT_VOICE_EN: VoicePref = 'browser:Google UK English Female';
const DEFAULT_VOICE_TE: VoicePref = 'gctts:te_aoede';

const isWeb = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

// ── Per-language voice preference ───────────────────────────────────
export function getVoicePref(lang: Lang): VoicePref {
  if (!isWeb) return lang === 'te' ? DEFAULT_VOICE_TE : DEFAULT_VOICE_EN;
  try {
    const key = lang === 'te' ? VOICE_KEY_TE : VOICE_KEY_EN;
    const v = localStorage.getItem(key);
    if (v && (v.startsWith('browser:') || v.startsWith('gctts:'))) return v;

    // Legacy migration: old single-key 'aq_piper_voice' (alba/ryan/norman).
    if (lang === 'en') {
      const legacy = localStorage.getItem(LEGACY_VOICE_KEY);
      if (legacy === 'alba' || legacy === 'ryan' || legacy === 'norman') {
        return `gctts:${legacy}`;
      }
    }
  } catch { /* ignore */ }
  return lang === 'te' ? DEFAULT_VOICE_TE : DEFAULT_VOICE_EN;
}

export function setVoicePref(lang: Lang, pref: VoicePref): void {
  if (!isWeb) return;
  try {
    const key = lang === 'te' ? VOICE_KEY_TE : VOICE_KEY_EN;
    localStorage.setItem(key, pref);
    // New voice → invalidate any cached greeting audio so the user
    // hears the change next time they tap play.
    evictAllGreetingCache();
  } catch { /* ignore */ }
}

// ── Daily greeting audio cache ─────────────────────────────────────
//
// Stored as base64-encoded MP3 in a localStorage key.

function todayKey(voicePref: VoicePref): string {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10); // YYYY-MM-DD
  // sanitize voice for use in a key
  const safe = voicePref.replace(/[^a-zA-Z0-9_:-]/g, '_');
  return `${GREETING_KEY_PREFIX}${ymd}_${safe}`;
}

function evictAllGreetingCache(): void {
  if (!isWeb) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(GREETING_KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => { try { localStorage.removeItem(k); } catch { /* */ } });
  } catch { /* ignore */ }
}

function evictStaleGreetingCache(voicePref: VoicePref): void {
  if (!isWeb) return;
  try {
    const fresh = todayKey(voicePref);
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(GREETING_KEY_PREFIX) && k !== fresh) keys.push(k);
    }
    keys.forEach((k) => { try { localStorage.removeItem(k); } catch { /* */ } });
  } catch { /* ignore */ }
}

interface CachedGreeting {
  text: string;
  audio: string;       // base64
  voice: VoicePref;
  cachedAt: string;
}

export function getCachedGreetingUrl(text: string, voicePref: VoicePref): string | null {
  if (!isWeb) return null;
  evictStaleGreetingCache(voicePref);
  try {
    const raw = localStorage.getItem(todayKey(voicePref));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedGreeting;
    if (!parsed?.audio) return null;
    if (parsed.text !== text) return null;
    if (parsed.voice !== voicePref) return null;
    const bin = atob(parsed.audio);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    // Default to mp3; the cached blob's MIME doesn't really matter
    // since HTMLAudio probes from the bytes themselves.
    const blob = new Blob([arr], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn('[greetingCache] read failed', e);
    return null;
  }
}

export async function setCachedGreeting(
  text: string,
  voicePref: VoicePref,
  blob: Blob,
): Promise<void> {
  if (!isWeb) return;
  try {
    const arrayBuf = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + CHUNK)) as any,
      );
    }
    const b64 = btoa(binary);

    const payload: CachedGreeting = {
      text, audio: b64, voice: voicePref,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(todayKey(voicePref), JSON.stringify(payload));
    evictStaleGreetingCache(voicePref);
  } catch (e) {
    console.warn('[greetingCache] write failed (likely quota)', e);
  }
}

// ── BACKWARDS COMPAT — legacy helpers used elsewhere in the app ──
//
// The rest of the codebase still imports `getPiperVoice()` /
// `setPiperVoice()` / type `PiperVoiceId`. We keep these as thin
// shims pointing at the new English preference so nothing breaks.
//
// `getPiperVoice()` returns just the curated voice id ('alba' / 'ryan'
// / 'norman' / etc.), stripping the 'gctts:' / 'browser:' prefix.

export type PiperVoiceId = 'alba' | 'ryan' | 'norman';

export function getPiperVoice(): PiperVoiceId {
  const pref = getVoicePref('en');
  if (pref.startsWith('gctts:')) {
    const id = pref.slice(6);
    if (id === 'alba' || id === 'ryan' || id === 'norman') return id;
  }
  return 'norman';   // safe default
}

export function setPiperVoice(v: PiperVoiceId): void {
  setVoicePref('en', `gctts:${v}`);
}
