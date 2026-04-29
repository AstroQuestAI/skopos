/**
 * vidhaataChatCache.ts — client-side caching + transcript persistence
 * for the Vidhaata chat (v8.6.1).
 *
 * Two independent features share this file:
 *
 * 1. Q&A CACHE (duplicate-question short-circuit)
 *    Key:   @aq.vidhaata.qa.<email>.v1
 *    Value: { [qa_key]: { answer, sources, suggested_finder, ts } }
 *    Purpose: when the user re-asks an identical question (same chart +
 *    same language + same depth + same marital_status + same normalized
 *    text) we return the prior answer with ZERO network round-trip.
 *    TTL: 7 days sliding (answers referencing dashas/transits go stale
 *    within a week; longer than server cache but short enough to stay
 *    relevant).
 *
 * 2. TRANSCRIPT (full chat resumes across reloads)
 *    Key:   @aq.vidhaata.chat.<email>.v1
 *    Value: { messages: [{role, content, sources?, ...}, ...], ts }
 *    Purpose: last N=20 messages preserved so the chat picks up mid-
 *    thought after an app reload, a browser refresh, or a tab close.
 *    The transcript is ALSO what we send to the backend as `history`
 *    so the LLM sees prior context even across sessions.
 *
 * Both features are PER-EMAIL (one user's cache never leaks to another
 * on the same device) and chart-signature-scoped where relevant (a
 * different chart == different Q&A bucket, preventing cross-chart bleed).
 *
 * Privacy: stays device-local. Aligns with the same LocalStorage-only
 * PII model used for birth details.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// --------------------------- constants ------------------------------------

const QA_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days
const QA_CACHE_MAX_ENTRIES = 60;                    // LRU cap per user
const TRANSCRIPT_MAX_MESSAGES = 20;                 // last-N rolling window

const qaKey = (email: string) =>
  `@aq.vidhaata.qa.${(email || '').trim().toLowerCase()}.v1`;
const transcriptKey = (email: string) =>
  `@aq.vidhaata.chat.${(email || '').trim().toLowerCase()}.v1`;

// --------------------------- types ----------------------------------------

export interface CachedAnswer {
  answer: string;
  sources_used?: string[];
  suggested_finder?: any;
  spoken_summary?: string;
  captured_facts?: any[];
  ts: number;  // ms epoch — used for TTL + LRU eviction
}

export interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  suggested_finder?: any;
  captured_facts?: any[];
  spoken_summary?: string;
  cached_local?: boolean;
}

interface QABlob   { [key: string]: CachedAnswer }
interface TranscriptBlob { messages: TranscriptMessage[]; ts: number }

// --------------------------- helpers --------------------------------------

/**
 * Build a stable cache key from the inputs that determine the answer.
 * Chart-signature-scoped so two users on the same device never share
 * answers even if their questions happen to match.
 */
export function buildQAKey(opts: {
  question: string;
  language: string;
  depth_level?: string;
  marital_status?: string;
  chart_signature: string;
}): string {
  const norm = (opts.question || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  return [
    opts.chart_signature || 'no-chart',
    (opts.language || 'en').toLowerCase(),
    (opts.depth_level || 'balanced').toLowerCase(),
    (opts.marital_status || '').toLowerCase(),
    norm,
  ].join('|');
}

/**
 * Derive a stable "chart signature" from the result bundle. Any change
 * to DOB / TOB / lat / lon invalidates all cached answers for this user.
 */
export function chartSignatureFrom(result: any): string {
  try {
    const bd = result?.birth_details || {};
    const parts = [
      String(bd.date || ''),
      String(bd.time || ''),
      String(bd.latitude ?? ''),
      String(bd.longitude ?? ''),
    ].join('|');
    return parts || 'no-chart';
  } catch {
    return 'no-chart';
  }
}

// --------------------------- Q&A cache ------------------------------------

async function _readQA(email: string): Promise<QABlob> {
  try {
    const raw = await AsyncStorage.getItem(qaKey(email));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed as QABlob : {};
  } catch {
    return {};
  }
}

async function _writeQA(email: string, blob: QABlob): Promise<void> {
  try {
    await AsyncStorage.setItem(qaKey(email), JSON.stringify(blob));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[vidhaataChatCache] QA write failed', e);
  }
}

/**
 * Look up a cached answer for a question. Returns null on miss or if
 * the entry is older than the TTL. Successful reads do NOT bump the
 * timestamp (keeps the cache honest — a stale answer stays stale).
 */
export async function loadQA(
  email: string,
  key: string,
): Promise<CachedAnswer | null> {
  if (!email || !key) return null;
  const blob = await _readQA(email);
  const entry = blob[key];
  if (!entry) return null;
  if (Date.now() - (entry.ts || 0) > QA_CACHE_TTL_MS) {
    // Stale — remove it to avoid indefinite bloat.
    delete blob[key];
    await _writeQA(email, blob);
    return null;
  }
  return entry;
}

/**
 * Store an answer. Runs an LRU trim if the bucket exceeds the cap.
 */
export async function saveQA(
  email: string,
  key: string,
  payload: Omit<CachedAnswer, 'ts'>,
): Promise<void> {
  if (!email || !key || !payload?.answer) return;
  const blob = await _readQA(email);
  blob[key] = { ...payload, ts: Date.now() };
  // LRU: if over cap, drop the oldest entries by ts.
  const entries = Object.entries(blob);
  if (entries.length > QA_CACHE_MAX_ENTRIES) {
    entries.sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
    const toKeep = entries.slice(entries.length - QA_CACHE_MAX_ENTRIES);
    const pruned: QABlob = {};
    for (const [k, v] of toKeep) pruned[k] = v;
    await _writeQA(email, pruned);
    return;
  }
  await _writeQA(email, blob);
}

/**
 * Clear all cached answers for a user. Call on chart change (DOB/TOB/
 * lat/lon edits) or on logout.
 */
export async function clearQA(email: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(qaKey(email));
  } catch { /* best-effort */ }
}

// --------------------------- transcript -----------------------------------

export async function loadTranscript(email: string): Promise<TranscriptMessage[]> {
  if (!email) return [];
  try {
    const raw = await AsyncStorage.getItem(transcriptKey(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TranscriptBlob | null;
    const msgs = parsed?.messages;
    if (!Array.isArray(msgs)) return [];
    // Defensive filter — only keep well-formed entries.
    return msgs.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string');
  } catch {
    return [];
  }
}

export async function saveTranscript(
  email: string,
  messages: TranscriptMessage[],
): Promise<void> {
  if (!email) return;
  try {
    // Always trim to the last N to keep the file small and the
    // backend-replayed history within Claude's context budget.
    const trimmed = (messages || []).slice(-TRANSCRIPT_MAX_MESSAGES);
    const blob: TranscriptBlob = { messages: trimmed, ts: Date.now() };
    await AsyncStorage.setItem(transcriptKey(email), JSON.stringify(blob));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[vidhaataChatCache] transcript write failed', e);
  }
}

export async function clearTranscript(email: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(transcriptKey(email));
  } catch { /* best-effort */ }
}

/**
 * Clear BOTH Q&A cache + transcript for a user. Used on logout/account-
 * switch and on chart-field change (DOB/TOB/lat/lon) since cached
 * answers are no longer valid for the new chart.
 */
export async function clearChatCache(email: string): Promise<void> {
  await Promise.all([clearQA(email), clearTranscript(email)]);
}
