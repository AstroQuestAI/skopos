/**
 * teaser.ts — v6.39 Vidhaata trial-mode content masking.
 *
 * Rules:
 *   • Keep the first ~100 words of the answer.
 *   • Keep at most ONE list (first bullet/numbered block).
 *   • Everything after is replaced by a MASK marker that the chat renderer
 *     converts into a "blurred" teaser block with an upgrade CTA.
 *
 * The marker used is a line containing exactly `[[TEASER_MASK]]` — rendered
 * specially by ChatOverlay.
 */
export const TEASER_MARKER = '[[TEASER_MASK]]';

function _wordsCount(s: string): number {
  return (s.match(/\S+/g) || []).length;
}

/**
 * Truncate to `maxWords` words, but try not to cut mid-sentence.
 * Keeps markdown structure (newlines preserved).
 */
function _truncateAtWords(text: string, maxWords: number): { head: string; cut: boolean } {
  const re = /(\s+)/g;
  let words = 0;
  let pos = 0;
  let lastPeriod = -1;
  const tokens = text.split(re);   // alternates word | sep | word | sep ...
  let out = '';
  for (const tok of tokens) {
    if (!/^\s+$/.test(tok) && tok.length > 0) {
      words += 1;
    }
    if (words > maxWords) break;
    out += tok;
    pos = out.length;
    if (/[.!?]\s*$/.test(out)) lastPeriod = pos;
  }
  if (words <= maxWords) return { head: text, cut: false };
  // Prefer a sentence boundary inside the last 20 chars.
  if (lastPeriod > 0 && pos - lastPeriod < 40) {
    return { head: out.slice(0, lastPeriod).trimEnd(), cut: true };
  }
  return { head: out.trimEnd(), cut: true };
}

/**
 * Apply teaser rules to an assistant reply.
 *   • If the reply is already short + has 0/1 list → unchanged.
 *   • Else, trim at 100 words, keep at most 1 list block, and append
 *     `[[TEASER_MASK]]` as the last line so the renderer can blur it.
 */
export function applyTeaserMask(text: string, maxWords = 100): string {
  if (!text) return text;

  // Find list blocks — consecutive lines starting with "-", "*", "•" or
  // "1." … "9.". We'll preserve the first block we encounter inside the
  // head window, strip any later ones.
  const lines = text.split('\n');
  let listFound = 0;
  let seenFirstListStart = -1;
  let firstListEndExclusive = -1;
  const kept: string[] = [];

  const isListLine = (l: string) => /^\s*([-*•]|\d+\.)\s+\S/.test(l);

  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isListLine(line)) {
      if (!inList) {
        listFound += 1;
        inList = true;
        if (listFound === 1) {
          seenFirstListStart = i;
        }
      }
      if (listFound === 1) kept.push(line);
      // Skip lines from 2nd+ lists entirely.
    } else {
      if (inList) {
        inList = false;
        if (listFound === 1 && firstListEndExclusive === -1) firstListEndExclusive = i;
      }
      if (listFound < 2) kept.push(line);
    }
  }

  const prunedText = kept.join('\n');

  // Now truncate to max 100 words.
  const { head, cut } = _truncateAtWords(prunedText, maxWords);
  const extraLists = listFound > 1 ? (listFound - 1) : 0;
  if (!cut && !extraLists) return head;

  // Append a mask marker — UI will render a blurred placeholder below.
  return `${head}\n\n${TEASER_MARKER}`;
}

export function isTeaserMasked(text: string): boolean {
  return text?.includes(TEASER_MARKER) || false;
}

export function stripTeaserMask(text: string): string {
  if (!text) return text;
  return text.replace(new RegExp(`\\n*${TEASER_MARKER.replace(/[[\]]/g, '\\$&')}\\n*`, 'g'), '').trimEnd();
}
