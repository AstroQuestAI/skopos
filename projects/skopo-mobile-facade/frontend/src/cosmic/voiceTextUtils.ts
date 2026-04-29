/**
 * voiceTextUtils — pure helpers for voice-mode text shaping.
 *
 * Two responsibilities:
 *
 *   1. cleanAsrTranscript()
 *      Sanitises raw speech-to-text output before sending it to the
 *      LLM — strips filler words ("umm", "uh", "you know"), collapses
 *      whitespace, ensures a sensible ending punctuation, and clamps
 *      the prompt at 100 words so a rambling user never blows up the
 *      LLM context.
 *
 *   2. sanitiseForTTS()
 *      Strips markdown, tables, OPTIONS chips, citation labels, and
 *      [SPOKEN_SUMMARY] tags from an LLM reply, collapses to a single
 *      paragraph, and clamps to ~100 words. The result is what the
 *      browser TTS engine actually speaks. The on-screen chat overlay
 *      keeps the original formatted answer.
 */

const FILLER_PATTERNS: RegExp[] = [
  /\b(umm+|uhh+|uh+|erm+|hmm+|mm+|mhm+|ah+|oh+)\b/gi,
  /\b(you know|kind of|sort of|like,? )\b/gi,
  /\b(basically|literally|honestly|i mean)\b/gi,
];

/**
 * Strip leading/trailing filler, normalise whitespace, ensure terminal
 * punctuation, and clamp to MAX words. Returns "" if nothing useful
 * remains.
 */
export function cleanAsrTranscript(raw: string, maxWords = 100): string {
  if (!raw) return '';
  let s = String(raw).trim();
  // Collapse repeated spaces / newlines
  s = s.replace(/\s+/g, ' ');
  // Strip filler words
  for (const re of FILLER_PATTERNS) s = s.replace(re, '');
  // Strip lone punctuation that filler-removal can leave behind
  s = s.replace(/\s+([,.;!?])/g, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  // Word-clamp
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) s = words.slice(0, maxWords).join(' ');
  // Ensure terminal punctuation (LLMs respond more crisply to a
  // properly-terminated question than to a trailing "...").
  if (s && !/[.!?]$/.test(s)) {
    // If it looks like a question, finish with "?", otherwise ".".
    s += /^(what|why|when|where|who|how|is|are|will|should|can|could|do|does|did)\b/i.test(s) ? '?' : '.';
  }
  return s;
}

/**
 * Convert a fully-formatted LLM reply (markdown, tables, OPTIONS chips,
 * citation labels, [SPOKEN_SUMMARY] block, etc.) into a SHORT, CLEAN
 * paragraph the browser TTS can read aloud naturally.
 *
 * The input may already be the post-stream `spoken_summary` — in which
 * case most of the regexes are no-ops, but the word-clamp still applies.
 */
export function sanitiseForTTS(raw: string, maxWords = 100): string {
  if (!raw) return '';
  let s = String(raw);

  // 1. Drop the SPOKEN_SUMMARY block delimiters (the inner text we KEEP
  //    if no other content is around it).
  const m = s.match(/\[SPOKEN_SUMMARY\]([\s\S]*?)\[\/SPOKEN_SUMMARY\]/i);
  if (m && m[1].trim()) s = m[1];
  // Otherwise just strip the tags.
  s = s.replace(/\[\/?SPOKEN_SUMMARY\]/gi, '');

  // 2. Strip OPTIONS chip lines ("OPTIONS: A | B | C").
  s = s.replace(/^\s*OPTIONS:\s*.*$/gim, '');

  // 3. Strip markdown tables — any line containing 2+ pipe characters.
  s = s.replace(/^\s*\|.*\|.*$/gm, '');
  // …and the table separator rows ("|---|---|").
  s = s.replace(/^\s*[:\-\s|]+$/gm, '');

  // 4. Strip ATX headings ("## …", "### …").
  s = s.replace(/^\s*#{1,6}\s+.*$/gm, '');

  // 5. Strip horizontal rules ("---", "***").
  s = s.replace(/^\s*([-*_]\s?){3,}\s*$/gm, '');

  // 6. Strip emphasis markers but KEEP their inner text.
  s = s.replace(/\*\*(.*?)\*\*/g, '$1');
  s = s.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '$1');
  s = s.replace(/`([^`]+)`/g, '$1');

  // 7. Strip raw URLs and citation labels like "(BPHS 14.1.2)".
  s = s.replace(/https?:\/\/\S+/g, '');
  s = s.replace(/\(\s*(BPHS|Brihat|Phaladeepika|Saravali|Hora|Jaimini|Parashara)[^)]*\)/gi, '');
  s = s.replace(/\[\d+\]/g, ''); // bracketed citation numbers

  // 8. Strip stray bullet markers but preserve the line text.
  s = s.replace(/^\s*[-•*]\s+/gm, '');

  // 9. Strip emoji (keep the spoken stream clean — most browser TTS
  //    pronounces emoji as the unicode word, which is jarring).
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');

  // 10. Collapse all whitespace into single spaces.
  s = s.replace(/\s+/g, ' ').trim();

  // 11. Word-clamp at the END so we keep the most informative early
  //     sentences. Trim to the nearest sentence boundary so we never
  //     stop mid-clause.
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) {
    s = words.slice(0, maxWords).join(' ');
    // Trim trailing partial sentence
    const lastTerminal = Math.max(s.lastIndexOf('.'), s.lastIndexOf('!'), s.lastIndexOf('?'));
    if (lastTerminal > Math.floor(maxWords * 0.5)) {
      s = s.slice(0, lastTerminal + 1);
    } else if (!/[.!?]$/.test(s)) {
      s += '.';
    }
  }

  return s.trim();
}
