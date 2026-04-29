/**
 * apiCache.ts — v7.1 USER-SCOPED request cache.
 *
 * v7.1 (breaking): cache keys now bake in the current-user scope
 *   `u:<email|guest>:`  → two different Google accounts on the same device
 *   can NEVER share a cached response. PREFIX bumped to `@apicache:v2:` so
 *   any legacy poisoned entries from v1 are ignored.
 *
 * Two layers:
 *   1. In-memory LRU (instant rehit within the same app run)
 *   2. AsyncStorage persistent cache (survives app restarts)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosRequestConfig } from 'axios';
import { currentScope } from '../lib/userScope';

const PREFIX = '@apicache:v2:';          // v2 invalidates v1 cross-user bleed
const LEGACY_PREFIX = '@apicache:v1:';   // wiped on first run
const MEM_MAX = 80;
type Entry = { value: any; expiresAt: number };
const mem = new Map<string, Entry>();

const now = () => Date.now();

// ---------------------------------------------------------------------------
// One-time cleanup of legacy v1 entries (possible cross-user bleed).
// ---------------------------------------------------------------------------
let _legacyWiped = false;
async function wipeLegacyOnce(): Promise<void> {
  if (_legacyWiped) return;
  _legacyWiped = true;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const doomed = keys.filter((k) => k.startsWith(LEGACY_PREFIX));
    if (doomed.length) await AsyncStorage.multiRemove(doomed);
  } catch { /* ignore */ }
}

function memGet(key: string): any | null {
  const e = mem.get(key);
  if (!e) return null;
  if (e.expiresAt && e.expiresAt < now()) {
    mem.delete(key);
    return null;
  }
  mem.delete(key);
  mem.set(key, e);
  return e.value;
}

function memSet(key: string, value: any, ttlMs: number) {
  if (mem.size >= MEM_MAX) {
    const firstKey = mem.keys().next().value;
    if (firstKey !== undefined) mem.delete(firstKey);
  }
  mem.set(key, { value, expiresAt: ttlMs > 0 ? now() + ttlMs : 0 });
}

async function diskGet(key: string): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry;
    if (parsed.expiresAt && parsed.expiresAt < now()) {
      AsyncStorage.removeItem(PREFIX + key).catch(() => {});
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

async function diskSet(key: string, value: any, ttlMs: number) {
  try {
    const payload: Entry = {
      value,
      expiresAt: ttlMs > 0 ? now() + ttlMs : 0,
    };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(payload));
  } catch { /* ignore */ }
}

function stableStringify(x: any): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x);
  if (Array.isArray(x)) return '[' + x.map(stableStringify).join(',') + ']';
  const keys = Object.keys(x).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(x[k])).join(',') + '}';
}

export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Build a cache key that is both scope-aware (per signed-in user) and
 * content-aware (hashed body).  Example:
 *   `u:alice@x.com:calc-chart-v2:9f2c0b1e`
 */
async function makeScopedKey(scope: string, body: any): Promise<string> {
  const sc = await currentScope();            // "u:alice@x.com:" or "u:guest:"
  return `${sc}${scope}:${hashString(stableStringify(body ?? {}))}`;
}

/** Legacy export — kept for backwards compat but no longer used internally. */
export function makeKey(scope: string, body: any): string {
  return `${scope}:${hashString(stableStringify(body ?? {}))}`;
}

export type CacheOpts = {
  ttlMs: number;
  swr?: boolean;
  scope: string;
};

export async function cachedPost<T = any>(
  url: string,
  body: any,
  opts: CacheOpts,
  axiosConfig?: AxiosRequestConfig,
): Promise<T> {
  wipeLegacyOnce();
  const key = await makeScopedKey(opts.scope, { url, body });

  const memHit = memGet(key);
  if (memHit != null) return memHit as T;

  const diskHit = await diskGet(key);
  if (diskHit != null) {
    memSet(key, diskHit, opts.ttlMs);
    if (opts.swr) {
      axios.post(url, body, axiosConfig).then((r) => {
        memSet(key, r.data, opts.ttlMs);
        diskSet(key, r.data, opts.ttlMs);
      }).catch(() => {});
    }
    return diskHit as T;
  }

  try {
    const r = await axios.post(url, body, axiosConfig);
    memSet(key, r.data, opts.ttlMs);
    diskSet(key, r.data, opts.ttlMs);
    return r.data as T;
  } catch (err) {
    const expired = await AsyncStorage.getItem(PREFIX + key).catch(() => null);
    if (expired) {
      try {
        const parsed = JSON.parse(expired) as Entry;
        if (parsed?.value) return parsed.value as T;
      } catch { /* ignore */ }
    }
    throw err;
  }
}

export async function cachedGet<T = any>(
  url: string,
  opts: CacheOpts,
  axiosConfig?: AxiosRequestConfig,
): Promise<T> {
  wipeLegacyOnce();
  const key = await makeScopedKey(opts.scope, { url });
  const memHit = memGet(key);
  if (memHit != null) return memHit as T;
  const diskHit = await diskGet(key);
  if (diskHit != null) {
    memSet(key, diskHit, opts.ttlMs);
    return diskHit as T;
  }
  const r = await axios.get(url, axiosConfig);
  memSet(key, r.data, opts.ttlMs);
  diskSet(key, r.data, opts.ttlMs);
  return r.data as T;
}

/** Clear one scope across ALL users (rarely needed — prefer clearAll). */
export async function clearScope(scope: string): Promise<void> {
  for (const k of Array.from(mem.keys())) {
    if (k.includes(':' + scope + ':')) mem.delete(k);
  }
  try {
    const keys = await AsyncStorage.getAllKeys();
    const targets = keys.filter((k) => k.startsWith(PREFIX) && k.includes(':' + scope + ':'));
    if (targets.length) await AsyncStorage.multiRemove(targets);
  } catch { /* ignore */ }
}

/** Nuke EVERY cached response (used on logout / email-switch). */
export async function clearAll(): Promise<void> {
  mem.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const targets = keys.filter((k) => k.startsWith(PREFIX) || k.startsWith(LEGACY_PREFIX));
    if (targets.length) await AsyncStorage.multiRemove(targets);
  } catch { /* ignore */ }
}

export const TTL = {
  FOREVER: 0,
  MIN_5: 5 * 60 * 1000,
  HOUR_1: 60 * 60 * 1000,
  HOUR_24: 24 * 60 * 60 * 1000,
  DAY_7: 7 * 24 * 60 * 60 * 1000,
} as const;
