/**
 * localProfile.ts — v7.16 PRIVACY-FIRST birth-details storage.
 *
 * Birth data (dob, tob, birth_place, lat, lon, gender, marital, name, phone)
 * lives ONLY in the browser via AsyncStorage (localStorage on web). The
 * backend never sees a persisted copy — chart calculations and Vidhaata
 * chats receive the details as request-body context on demand.
 *
 * The store is keyed by the signed-in email so two users sharing a browser
 * don't cross-pollute their charts. Anonymous sessions use the `__anon__`
 * key.
 *
 * This file also hosts the chart cache (computed chart JSON), so repeated
 * logins don't trigger the expensive /api/calculate-chart round-trip.
 * The cache is keyed by a hash of the birth details — if you change DOB
 * the cache invalidates automatically.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------- shape ----------
export interface LocalProfileData {
  first_name:     string;
  last_name:      string;
  gender:         'male' | 'female' | 'unspecified' | '';
  marital_status: 'single' | 'married' | 'divorced' | 'widowed' | 'unspecified' | '';
  dob:            string;       // YYYY-MM-DD
  tob:            string;       // HH:MM — v9.5: may be empty (sunrise fallback used)
  birth_place:    string;
  birth_lat:      number;
  birth_lon:      number;
  phone?:         string;
  // v9.5 — TOB-fallback policy (used only when tob === ""):
  //   'asc'     — N/A (only used when tob is provided)
  //   'sunrise' — compute Lagna from local sunrise of the birth date
  //   'moon'    — classical Chandra-Lagna (Moon's sign as house 1)
  lagna_source?:  'asc' | 'sunrise' | 'moon';
  // v7.16 — computed profile hash for chart-cache invalidation.
  // Not guaranteed present for pre-existing localStorage entries.
  __hash?:        string;
  __savedAt?:     string;       // ISO timestamp
}

// ---------- keys ----------
const LP_KEY = (email: string) => `@astroquest.localProfile.${email.toLowerCase()}.v1`;
const CH_KEY = (email: string, hash: string) =>
  `@astroquest.chart.${email.toLowerCase()}.${hash}.v1`;
// Old chart cache wildcard prefix so we can evict stale entries on save.
const CH_PREFIX = (email: string) =>
  `@astroquest.chart.${email.toLowerCase()}.`;

// ---------- hash ----------
// Tiny non-crypto hash — good enough for cache invalidation. We avoid
// Node's crypto lib because this module runs in the browser.
function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  // 32-bit unsigned hex
  return (h >>> 0).toString(16);
}

/** Derive a stable hash of the birth details only (ignores name, phone).
 *  Chart math depends on dob, tob, lat, lon — nothing else. */
export function birthDetailsHash(p: Partial<LocalProfileData> | null | undefined): string {
  if (!p) return '';
  const core = [
    (p.dob || '').trim(),
    (p.tob || '').trim(),
    String(p.birth_lat ?? ''),
    String(p.birth_lon ?? ''),
    (p.gender || '').trim(),
  ].join('|');
  return djb2(core);
}

// ---------- profile CRUD ----------

export async function saveLocalProfile(
  email: string,
  data: LocalProfileData,
): Promise<LocalProfileData> {
  const stamped: LocalProfileData = {
    ...data,
    __hash: birthDetailsHash(data),
    __savedAt: new Date().toISOString(),
  };
  try {
    await AsyncStorage.setItem(LP_KEY(email || '__anon__'), JSON.stringify(stamped));
  } catch (e) {
    console.warn('[localProfile] save failed:', e);
  }
  return stamped;
}

export async function loadLocalProfile(
  email: string,
): Promise<LocalProfileData | null> {
  try {
    const raw = await AsyncStorage.getItem(LP_KEY(email || '__anon__'));
    if (!raw) return null;
    return JSON.parse(raw) as LocalProfileData;
  } catch {
    return null;
  }
}

export async function clearLocalProfile(email: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(LP_KEY(email || '__anon__'));
    // Also sweep chart caches for this user.
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const pref = CH_PREFIX(email || '__anon__');
        const toKill: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(pref)) toKill.push(k);
        }
        toKill.forEach((k) => { try { window.localStorage.removeItem(k); } catch {} });
      }
    } catch { /* best-effort */ }
  } catch (e) {
    console.warn('[localProfile] clear failed:', e);
  }
}

// ---------- chart cache CRUD ----------

export interface CachedChart<T = any> {
  chart: T;
  computedAt: string;   // ISO
  hash: string;         // birthDetailsHash
}

export async function saveCachedChart<T>(
  email: string, hash: string, chart: T,
): Promise<void> {
  const entry: CachedChart<T> = {
    chart, computedAt: new Date().toISOString(), hash,
  };
  try {
    // Evict old caches for this user that don't match this hash.
    if (typeof window !== 'undefined' && window.localStorage) {
      const pref = CH_PREFIX(email || '__anon__');
      const current = CH_KEY(email || '__anon__', hash);
      const toKill: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(pref) && k !== current) toKill.push(k);
      }
      toKill.forEach((k) => { try { window.localStorage.removeItem(k); } catch {} });
    }
    await AsyncStorage.setItem(CH_KEY(email || '__anon__', hash), JSON.stringify(entry));
  } catch (e) {
    console.warn('[localProfile] chart cache save failed:', e);
  }
}

export async function loadCachedChart<T = any>(
  email: string, hash: string,
): Promise<CachedChart<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(CH_KEY(email || '__anon__', hash));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedChart<T>;
    // Defensive — if the cached hash doesn't match the requested one, drop.
    if (parsed?.hash !== hash) return null;
    return parsed;
  } catch {
    return null;
  }
}
