/**
 * voice.ts — Web Speech API wrapper (free, no keys, no cost).
 *
 * Provides two capabilities for the Vidhaata chat composer:
 *   1. Speech-to-text (STT) via window.SpeechRecognition.
 *   2. Text-to-speech (TTS) via window.speechSynthesis.
 *
 * Language mapping: our app uses 'en' | 'te' internally. We map to BCP-47
 * locale codes that Chrome/Edge/Safari understand (en-IN, te-IN).
 *
 * Graceful degradation: if the browser doesn't support Web Speech, all
 * methods become no-ops and `isSupported()` returns false so the UI can
 * hide the mic button.
 */

export type AppLang = 'en' | 'te';

function langToLocale(lang: AppLang): string {
  if (lang === 'te') return 'te-IN';
  // Prefer Indian English accent on Indian devices, fall back to en-US.
  return 'en-IN';
}

function _getSR(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function isSTTSupported(): boolean {
  return !!_getSR();
}

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && !!(window as any).speechSynthesis;
}

export function isVoiceSupported(): boolean {
  return isSTTSupported() || isTTSSupported();
}

/** Start a one-shot listening session. Resolves with the final transcript. */
export function listenOnce(
  lang: AppLang,
  onPartial?: (text: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const SR = _getSR();
    if (!SR) {
      reject(new Error('Speech recognition not supported on this browser.'));
      return;
    }
    try {
      const rec = new SR();
      rec.lang = langToLocale(lang);
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      let finalText = '';
      let resolved = false;

      rec.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) {
            finalText += r[0].transcript;
          } else {
            interim += r[0].transcript;
          }
        }
        if (onPartial) onPartial((finalText + ' ' + interim).trim());
      };

      rec.onerror = (e: any) => {
        if (resolved) return;
        resolved = true;
        reject(new Error(e?.error || 'speech-error'));
      };

      rec.onend = () => {
        if (resolved) return;
        resolved = true;
        resolve(finalText.trim());
      };

      // Expose stop handle for the caller.
      (listenOnce as any)._active = rec;

      rec.start();
    } catch (e: any) {
      reject(e);
    }
  });
}

/** Abort the currently active listening session, if any. */
export function stopListening(): void {
  try {
    const rec = (listenOnce as any)._active;
    if (rec && typeof rec.stop === 'function') rec.stop();
  } catch { /* ignore */ }
}

// ----------------------------------------------------------------- TTS ------

/**
 * Pick the best-available voice for the requested locale. Browsers populate
 * the voice list asynchronously, so we poll briefly the first time.
 */
function pickVoice(lang: AppLang): Promise<SpeechSynthesisVoice | null> {
  return new Promise((resolve) => {
    if (!isTTSSupported()) return resolve(null);
    const synth = (window as any).speechSynthesis as SpeechSynthesis;
    const locale = langToLocale(lang);

    const tryPick = (): SpeechSynthesisVoice | null => {
      const voices = synth.getVoices();
      if (!voices || voices.length === 0) return null;
      // Exact locale match first
      let v = voices.find(v => v.lang?.toLowerCase() === locale.toLowerCase());
      if (v) return v;
      // Prefix match (te-* / en-*)
      const prefix = locale.split('-')[0];
      v = voices.find(v => (v.lang || '').toLowerCase().startsWith(prefix));
      if (v) return v;
      // Any en-* voice as final fallback (Telugu TTS is less common).
      return voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || voices[0] || null;
    };

    const immediate = tryPick();
    if (immediate) return resolve(immediate);

    // First call may need voiceschanged event
    let tries = 0;
    const iv = setInterval(() => {
      tries += 1;
      const v = tryPick();
      if (v || tries > 20) {
        clearInterval(iv);
        resolve(v);
      }
    }, 100);
  });
}

/** Speak `text` in the given app language. Cancels any ongoing utterance. */
export async function speak(text: string, lang: AppLang): Promise<void> {
  if (!isTTSSupported() || !text?.trim()) return;
  try {
    const synth = (window as any).speechSynthesis as SpeechSynthesis;
    // Cancel anything in the queue so assistants don't pile up.
    try { synth.cancel(); } catch { /* ignore */ }
    const voice = await pickVoice(lang);
    const utt = new SpeechSynthesisUtterance(stripForSpeech(text));
    utt.lang = langToLocale(lang);
    if (voice) utt.voice = voice;
    utt.rate = 0.98;
    utt.pitch = 1.0;
    utt.volume = 1.0;
    synth.speak(utt);
  } catch { /* ignore */ }
}

/** Immediately stop any ongoing speech. */
export function stopSpeaking(): void {
  try {
    if (!isTTSSupported()) return;
    const synth = (window as any).speechSynthesis as SpeechSynthesis;
    synth.cancel();
  } catch { /* ignore */ }
}

/** Remove markdown / emoji / table markup so TTS doesn't read "asterisk". */
function stripForSpeech(text: string): string {
  return (text || '')
    // Remove markdown bold/italic/code markers
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    // Remove markdown headings
    .replace(/^#{1,6}\s+/gm, '')
    // Collapse pipe-tables into commas
    .replace(/\|/g, ', ')
    // Strip URLs
    .replace(/https?:\/\/\S+/g, '')
    // Drop the "RAG" / source chips lines
    .replace(/\[Source:[^\]]+\]/g, '')
    // Collapse multiple newlines/spaces
    .replace(/\s+/g, ' ')
    .trim();
}
