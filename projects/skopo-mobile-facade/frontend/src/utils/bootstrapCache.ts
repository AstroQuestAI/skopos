/**
 * bootstrapCache.ts — localStorage schema + helpers for the v8.4
 * single-shot bootstrap bundle.
 *
 * A returning user hits zero network calls on app open as long as their
 * cached bundle is younger than TTL_MS. The TTL is a 48-hour SLIDING
 * window: every time we read the cache, we bump its cached_at so
 * actively-used sessions essentially never expire. After 48 h of total
 * silence the cache is treated as stale and a fresh /api/bootstrap call
 * is issued.
 *
 * Key format (per-email, privacy-first):
 *   @aq.bundle.<email-lowercased>.v1
 *
 * Value shape (plain JSON):
 *   {
 *     schema_version: 1,
 *     cached_at:  iso-8601,           // bumped on every successful read
 *     created_at: iso-8601,           // set on first write, immutable
 *     ttl_ms:     number,             // 48 h in ms
 *     bundle: { profile, access, chart, today_muhurtas, transits, ... }
 *   }
 *
 * Only this module is allowed to touch the bundle key directly; everyone
 * else goes through the read/write/patch API below.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const BUNDLE_SCHEMA_VERSION = 1;
export const TTL_MS = 48 * 60 * 60 * 1000; // 48 hours sliding window

export interface CachedBundle {
  schema_version: number;
  cached_at: string;
  created_at: string;
  ttl_ms: number;
  bundle: {
    profile?: any;
    access?: any;
    chart?: any;
    today_muhurtas?: any;
    transits?: any;
    // Forward-compat for future slices (panchanga, book_concepts, etc.)
    [k: string]: any;
  };
}

const keyFor = (email: string) =>
  `@aq.bundle.${(email || '').trim().toLowerCase()}.v1`;

// --------------------------------------------------------------------
// READ
// --------------------------------------------------------------------

/**
 * Load the cached bundle for an email. Returns:
 *   - null                       — no cache, or cache key mismatch
 *   - { valid: true,  bundle }   — cache exists AND is within TTL
 *   - { valid: false, bundle }   — cache exists but STALE (caller may
 *                                  still use it optimistically while a
 *                                  fresh bootstrap is in flight)
 */
export async function readBundle(
  email: string,
): Promise<{ valid: boolean; cached_at: string; bundle: CachedBundle['bundle'] } | null> {
  if (!email) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(email));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBundle;
    if (!parsed || parsed.schema_version !== BUNDLE_SCHEMA_VERSION) return null;
    const ageMs = Date.now() - new Date(parsed.cached_at).getTime();
    return {
      valid: ageMs < (parsed.ttl_ms || TTL_MS),
      cached_at: parsed.cached_at,
      bundle: parsed.bundle,
    };
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------
// WRITE  (full replace)
// --------------------------------------------------------------------

/**
 * Write a fresh bundle straight from /api/bootstrap response.
 * Resets created_at. Always updates cached_at to now.
 */
export async function writeBundle(email: string, bundle: CachedBundle['bundle']): Promise<void> {
  if (!email) return;
  const now = new Date().toISOString();
  const envelope: CachedBundle = {
    schema_version: BUNDLE_SCHEMA_VERSION,
    cached_at: now,
    created_at: now,
    ttl_ms: TTL_MS,
    bundle,
  };
  try {
    await AsyncStorage.setItem(keyFor(email), JSON.stringify(envelope));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[bootstrapCache] writeBundle failed', e);
  }
}

// --------------------------------------------------------------------
// PATCH  (surgical update — preserves created_at, bumps cached_at)
// --------------------------------------------------------------------

/**
 * Cache-copy-on-update pattern.
 *
 * Reads the existing bundle, applies `patch` on top of `bundle.*`, and
 * rewrites. Used when a single slice (e.g. access after a payment)
 * needs to be refreshed without re-fetching everything.
 *
 * Returns the merged bundle so callers can hand it straight to setState.
 */
export async function patchBundle(
  email: string,
  patch: Partial<CachedBundle['bundle']>,
): Promise<CachedBundle['bundle'] | null> {
  if (!email) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(email));
    const prev: CachedBundle | null = raw ? JSON.parse(raw) : null;
    const nextBundle = { ...(prev?.bundle ?? {}), ...patch };
    const next: CachedBundle = {
      schema_version: BUNDLE_SCHEMA_VERSION,
      cached_at: new Date().toISOString(),
      created_at: prev?.created_at ?? new Date().toISOString(),
      ttl_ms: prev?.ttl_ms ?? TTL_MS,
      bundle: nextBundle,
    };
    await AsyncStorage.setItem(keyFor(email), JSON.stringify(next));
    return nextBundle;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[bootstrapCache] patchBundle failed', e);
    return null;
  }
}

// --------------------------------------------------------------------
// TOUCH  (refresh cached_at — slides the TTL window)
// --------------------------------------------------------------------

/**
 * Bump cached_at to now without changing any bundle contents. Called
 * after a successful hydrate-from-cache read so an actively-used session
 * never expires.
 */
export async function touchBundle(email: string): Promise<void> {
  if (!email) return;
  try {
    const raw = await AsyncStorage.getItem(keyFor(email));
    if (!raw) return;
    const env = JSON.parse(raw) as CachedBundle;
    env.cached_at = new Date().toISOString();
    await AsyncStorage.setItem(keyFor(email), JSON.stringify(env));
  } catch { /* best-effort */ }
}

// --------------------------------------------------------------------
// CLEAR
// --------------------------------------------------------------------

/**
 * Wipe the bundle for one user. Used on logout or explicit "Refresh my
 * chart" / "Clear my data" actions. NEVER iterates all users — scoped.
 */
export async function clearBundle(email: string): Promise<void> {
  if (!email) return;
  try {
    await AsyncStorage.removeItem(keyFor(email));
  } catch { /* best-effort */ }
}
