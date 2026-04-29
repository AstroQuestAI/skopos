/**
 * sseChat.ts — v8.7 Vidhaata SSE streaming client.
 *
 * Consumes the `/api/guruji/chat/stream` endpoint and fires callbacks as
 * `meta`, `token`, `done`, and `error` frames arrive. Falls back to the
 * legacy JSON endpoint if the browser doesn't support ReadableStream body
 * (very rare) or the stream request errors out before any token fires.
 *
 * Design constraints:
 *   • Works in Expo React Native Web (Chrome/Safari/Firefox) via
 *     fetch+body.getReader(). We never use EventSource because POST
 *     isn't supported by the built-in EventSource API.
 *   • `withCredentials: true` equivalent is `credentials: 'include'` so
 *     the session_token cookie travels with the request.
 *   • Post-processing (final answer, spoken_summary, sources_used,
 *     suggested_finder, captured_facts) is delivered via the `done`
 *     event's `data` dict — callers should prefer this final dict
 *     over the running concatenation for display.
 */

export interface GurujiMeta {
  sources_used: string[];
  repository_hits: number;
  fell_back_to_general: boolean;
  model?: string;
  depth_level?: string;
}

export interface GurujiDone {
  answer: string;
  spoken_summary: string;
  sources_used: string[];
  repository_hits: number;
  fell_back_to_general: boolean;
  suggested_finder: any | null;
  captured_facts: Array<{ fact_type: string; value: string }>;
  cached?: boolean;
  // v8.12 — Expert Verification Mode (crazyLambo) state. When the codeword
  // activates a session, the backend returns `power_mode:true` plus an
  // ISO-8601 `power_expires_at` timestamp (60 min by default). The UI uses
  // these to render the 🏎️ countdown chip above the composer.
  power_mode?: boolean;
  power_expires_at?: string | null;
  power_just_activated?: boolean;
  power_just_ended?: boolean;
}

export interface StreamCallbacks {
  onMeta?:  (meta: GurujiMeta) => void;
  onToken?: (chunk: string, accumulated: string) => void;
  onDone?:  (result: GurujiDone) => void;
  onError?: (message: string) => void;
  // Cooperative abort — caller can flip this to stop reading.
  signal?:  AbortSignal;
  // v8.9 → v8.10 — reveal-pacer. Controls how raw Claude tokens are fed
  // into the UI. Set typewriter:false to render instantly (old behaviour).
  //
  // Defaults (when typewriter:true):
  //   initialDelayMs: 3000     — show nothing / a "thinking…" indicator
  //                              for the first 3 s so the user feels the
  //                              answer was "already prepared", then we
  //                              start revealing.
  //   wordsPerReveal: 5        — reveal 5 words per tick (scan-reading
  //                              pace), NOT character-by-character.
  //   revealIntervalMs: 220    — ~4.5 ticks/sec → ~22 words/sec normal.
  //                              Slows/speeds-up adaptively based on
  //                              buffer lag and stream-closed state.
  typewriter?: boolean | {
    initialDelayMs?: number;
    wordsPerReveal?: number;
    revealIntervalMs?: number;
  };
}

export interface GurujiChatPayload {
  message: string;
  language?: 'en' | 'te';
  chart_context?: any;
  history?: Array<{ role: string; content: string }>;
  depth_level?: 'concise' | 'balanced' | 'deep';
  marital_status?: string;
  no_cache?: boolean;
}

/**
 * Parse raw SSE byte chunks into (event, data) tuples and dispatch to
 * callbacks. Returns the full accumulated answer + the done payload
 * (or null if the stream ended without a done event).
 */
export async function streamGurujiChat(
  endpoint: string,
  payload: GurujiChatPayload,
  cb: StreamCallbacks = {},
): Promise<{ accumulated: string; done: GurujiDone | null; errored: boolean }> {
  let accumulated = '';
  let done: GurujiDone | null = null;
  let errored = false;

  // Abort if fetch/ReadableStream isn't available (shouldn't happen on
  // any modern Expo Web build, but belt-and-suspenders).
  if (typeof fetch !== 'function' || typeof TextDecoder === 'undefined') {
    cb.onError?.('Streaming is not supported in this browser.');
    return { accumulated: '', done: null, errored: true };
  }

  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(payload),
      signal: cb.signal,
    });
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'aborted' : (e?.message || 'network error');
    cb.onError?.(msg);
    return { accumulated: '', done: null, errored: true };
  }

  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => '');
    cb.onError?.(`HTTP ${resp.status}: ${txt.slice(0, 200)}`);
    return { accumulated: '', done: null, errored: true };
  }

  // Sanity-check content type so we don't try to parse JSON as SSE.
  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('event-stream') && !ct.includes('text/plain')) {
    // Backend returned a JSON dict (e.g. the clarifier short-circuit
    // or an error payload). Parse it as if it were the `done` event.
    try {
      const j = await resp.json();
      const doneDict: GurujiDone = {
        answer: j.answer || '',
        spoken_summary: j.spoken_summary || '',
        sources_used: j.sources_used || [],
        repository_hits: j.repository_hits || 0,
        fell_back_to_general: !!j.fell_back_to_general,
        suggested_finder: j.suggested_finder ?? null,
        captured_facts: Array.isArray(j.captured_facts) ? j.captured_facts : [],
        cached: !!j.cached,
      };
      cb.onToken?.(doneDict.answer, doneDict.answer);
      cb.onDone?.(doneDict);
      return { accumulated: doneDict.answer, done: doneDict, errored: false };
    } catch {
      cb.onError?.('Unexpected non-SSE, non-JSON response from /guruji/chat/stream');
      return { accumulated: '', done: null, errored: true };
    }
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';

  // ═══════════════════════════════════════════════════════════════════════
  // v8.10 — Word-batch reveal pacer with initial "thinking" delay
  // ═══════════════════════════════════════════════════════════════════════
  // Prior (v8.9) character-by-character reveal still felt "dazzling" because
  // every frame changed the DOM. Now we:
  //   1. Hold back ALL text for an initial `initialDelayMs` (default 3 s)
  //      so the user sees the "Vidhaata is thinking…" indicator; by the
  //      time we start painting, a chunk of the answer is already queued.
  //   2. Reveal in whole-word batches (default 5 words per tick every
  //      220 ms → ~22 words/sec) — this matches scan-reading tempo and
  //      feels like the user is scrolling through already-written text.
  //   3. Never split mid-word — find the Nth whitespace run forward from
  //      position 0 and cut there. Preserves markdown structure.
  //   4. Adaptive catch-up: when the raw arrival gets ahead (buffer
  //      holds > 15 words), we double the batch size per tick to drain
  //      without lagging.
  //   5. After stream closes: shorten tick interval and double batch so
  //      remaining content settles within ~800 ms.
  const twCfg: { initialDelayMs: number; wordsPerReveal: number; revealIntervalMs: number } | null = (() => {
    if (!cb.typewriter) return null;
    if (cb.typewriter === true) return { initialDelayMs: 3000, wordsPerReveal: 5, revealIntervalMs: 220 };
    const o = cb.typewriter as any;
    return {
      initialDelayMs:   o?.initialDelayMs   ?? 3000,
      wordsPerReveal:   o?.wordsPerReveal   ?? 5,
      revealIntervalMs: o?.revealIntervalMs ?? 220,
    };
  })();

  let rawBuffer = '';              // not-yet-revealed chars (paced queue)
  let finalDone: GurujiDone | null = null;
  let finalDoneFired = false;       // have we called cb.onDone yet?
  let streamClosed = false;         // server stopped sending frames
  let pacerInterval: any = null;
  const pacerStartedAt = Date.now();

  // Count whitespace-delimited words in a string.
  function countWords(s: string): number {
    const m = s.match(/\S+/g);
    return m ? m.length : 0;
  }

  // Return the end index (exclusive) in `s` after N complete words
  // PLUS any trailing whitespace. If fewer than N words exist, returns
  // s.length.
  function sliceNWords(s: string, n: number): number {
    if (n <= 0) return 0;
    let count = 0;
    let i = 0;
    const L = s.length;
    while (i < L) {
      // skip leading whitespace
      while (i < L && /\s/.test(s[i])) i++;
      if (i >= L) break;
      // consume the word
      while (i < L && !/\s/.test(s[i])) i++;
      count++;
      if (count >= n) {
        // include any trailing whitespace so the next word doesn't
        // get an orphan leading space.
        while (i < L && /\s/.test(s[i])) i++;
        return i;
      }
    }
    return L;
  }

  function ensurePacer() {
    if (pacerInterval || !twCfg) return;
    pacerInterval = setInterval(() => {
      const elapsed = Date.now() - pacerStartedAt;
      // Honour the initial "thinking" delay unless the stream is
      // ALREADY closed and has finished generating (in that case show
      // immediately — the user would otherwise stare at a finished
      // reply sitting hidden in the buffer).
      if (!streamClosed && elapsed < twCfg.initialDelayMs) return;

      if (rawBuffer.length === 0) {
        if (streamClosed && !finalDoneFired && finalDone) {
          finalDoneFired = true;
          try { cb.onDone?.(finalDone); } catch {}
          if (pacerInterval) { clearInterval(pacerInterval); pacerInterval = null; }
        }
        return;
      }

      // How many words this tick? Default N, doubled when we're behind
      // or draining after stream close.
      const bufferedWords = countWords(rawBuffer);
      let n = twCfg.wordsPerReveal;
      if (streamClosed) n = Math.max(n, Math.ceil(bufferedWords / 8));
      else if (bufferedWords > 15) n = n * 2;

      const cut = sliceNWords(rawBuffer, n);
      if (cut === 0) return;
      const slice = rawBuffer.slice(0, cut);
      rawBuffer = rawBuffer.slice(cut);
      accumulated += slice;
      try { cb.onToken?.(slice, accumulated); } catch {}
    }, twCfg.revealIntervalMs);
  }

  function pushToken(chunk: string) {
    if (!chunk) return;
    if (!twCfg) {
      // Pacer disabled — act like before (instant).
      accumulated += chunk;
      try { cb.onToken?.(chunk, accumulated); } catch {}
      return;
    }
    rawBuffer += chunk;
    ensurePacer();
  }

  function markStreamClosed(result: GurujiDone | null) {
    finalDone = result;
    streamClosed = true;
    if (!twCfg) {
      if (result && !finalDoneFired) {
        finalDoneFired = true;
        try { cb.onDone?.(result); } catch {}
      }
      return;
    }
    ensurePacer(); // in case no tokens ever fired
  }

  try {
    while (true) {
      const { value, done: readerDone } = await reader.read();
      if (readerDone) break;
      buf += decoder.decode(value, { stream: true });

      // SSE frames are \n\n delimited. Drain every complete frame we see.
      let idx: number;
      // eslint-disable-next-line no-cond-assign
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const { event, data } = parseSSEFrame(frame);
        if (!event) continue;
        if (event === 'meta') {
          try { cb.onMeta?.(JSON.parse(data) as GurujiMeta); } catch {}
        } else if (event === 'token') {
          try {
            const j = JSON.parse(data);
            pushToken(j?.chunk ?? '');
          } catch {}
        } else if (event === 'done') {
          try { done = JSON.parse(data) as GurujiDone; } catch {}
          markStreamClosed(done);
        } else if (event === 'error') {
          let msg = 'stream error';
          try { msg = (JSON.parse(data).message || msg); } catch {}
          cb.onError?.(msg);
          errored = true;
        }
      }
    }
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      cb.onError?.(e?.message || 'stream read failed');
      errored = true;
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  // v8.9 — ensure the typewriter drains fully before we resolve.
  // If stream ended without a `done` event, synthesise a best-effort
  // close so the pacer can still fire onDone once the buffer is empty.
  if (twCfg) {
    if (!streamClosed) markStreamClosed(done);
    // Wait up to ~4 s for the pacer to drain the remaining buffer.
    // v8.12 bugfix — `FRAME_MS` was referenced but never defined, which
    // caused a `ReferenceError` that crashed the stream consumer for
    // SHORT replies (e.g. the single-token `crazyLambo` activation
    // confirmation), making the UI appear to error out even though the
    // backend returned the correct payload. Define it inline here.
    const DRAIN_TIMEOUT_MS = 4000;
    const FRAME_MS = 50;
    const t0 = Date.now();
    while (!finalDoneFired && (Date.now() - t0) < DRAIN_TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, FRAME_MS));
    }
    // Safety: if the pacer didn't fire onDone, flush remaining buffer
    // and fire onDone now so the caller isn't stuck waiting.
    if (!finalDoneFired) {
      if (rawBuffer) {
        accumulated += rawBuffer;
        try { cb.onToken?.(rawBuffer, accumulated); } catch {}
        rawBuffer = '';
      }
      if (done) { try { cb.onDone?.(done); } catch {} }
      finalDoneFired = true;
    }
    if (pacerInterval) { clearInterval(pacerInterval); pacerInterval = null; }
  }

  return { accumulated, done, errored };
}

/** Pull `event: X` and `data: Y` lines out of an SSE frame. */
function parseSSEFrame(frame: string): { event: string; data: string } {
  let event = 'message';
  const dataLines: string[] = [];
  for (const raw of frame.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line) continue;
    if (line.startsWith(':')) continue; // comment / keep-alive
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).replace(/^\s/, '');
    if (field === 'event') event = val;
    else if (field === 'data') dataLines.push(val);
  }
  return { event, data: dataLines.join('\n') };
}
