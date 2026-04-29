/**
 * storage.ts — v7.1 USER-SCOPED local persistence.
 *
 * CRITICAL FIX (v7.1): every key is now namespaced with
 *   `u:<email|guest>:`  (via src/lib/userScope.currentScope())
 * so two different Google accounts on the same device get disjoint
 * AsyncStorage buckets. This closes the "cross-user chart bleed" bug
 * where loadLastChart() returned the previous user's chart on mount.
 *
 * Legacy un-scoped keys (pre-v7.1) are kept as constants so cleanup
 * helpers can wipe them on migration / logout.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentScope } from '../lib/userScope';

// ----- logical key names (scoped at runtime) -----
const K_PROFILE       = 'vedic.profile.v1';
const K_LAST_CHART    = 'vedic.lastChart.v1';
const K_CHART_SUMMARY = 'vedic.chartSummary.v1';
const K_CHART_HISTORY = 'vedic.chartHistory.v1';
const K_AYANAMSA      = 'vedic.ayanamsa.v1';       // v7.2 — sidereal system pref

const LOGICAL_KEYS = [K_PROFILE, K_LAST_CHART, K_CHART_SUMMARY, K_CHART_HISTORY, K_AYANAMSA];

// ----- helper — prepend the current-user scope -----
async function sk(key: string): Promise<string> {
  const s = await currentScope(); // e.g. "u:alice@x.com:" or "u:guest:"
  return s + key;
}

export interface StoredProfile {
  date: string;           // YYYY-MM-DD
  time: string;           // HH:MM
  location: string;
  latitude?: number;
  longitude?: number;
  language: 'en' | 'te';
  dateText?: string;      // DD/MM/YYYY (form-friendly)
  timeText?: string;      // HH:MM
  updatedAt: string;      // ISO
}

export interface ChartSummary {
  ascendant: string;
  ascendant_local?: string;
  moon_sign: string;
  moon_sign_local?: string;
  moon_nakshatra: string;
  moon_nakshatra_local?: string;
  current_mahadasha?: string;
  active_yogas: string[];
  generated_at: string;   // ISO
  date: string;
  time: string;
  location: string;
}

export interface ChartHistoryEntry {
  id: string;
  label: string;          // e.g., "DD/MM/YYYY HH:MM — Location"
  date: string;
  time: string;
  location: string;
  generated_at: string;
}

// ---------- Profile ----------
export const saveProfile = async (p: StoredProfile): Promise<void> => {
  try {
    await AsyncStorage.setItem(await sk(K_PROFILE), JSON.stringify(p));
  } catch (e) {
    console.warn('saveProfile failed', e);
  }
};

export const loadProfile = async (): Promise<StoredProfile | null> => {
  try {
    const raw = await AsyncStorage.getItem(await sk(K_PROFILE));
    if (!raw) return null;
    return JSON.parse(raw) as StoredProfile;
  } catch {
    return null;
  }
};

export const clearProfile = async (): Promise<void> => {
  try { await AsyncStorage.removeItem(await sk(K_PROFILE)); } catch {}
};

// ---------- Last chart (full response) ----------
export const saveLastChart = async (chart: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      await sk(K_LAST_CHART),
      JSON.stringify({ chart, saved_at: new Date().toISOString() }),
    );
  } catch (e) {
    console.warn('saveLastChart failed', e);
  }
};

export const loadLastChart = async (): Promise<{ chart: any; saved_at: string } | null> => {
  try {
    const raw = await AsyncStorage.getItem(await sk(K_LAST_CHART));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// ---------- Chart summary ----------
export const saveChartSummary = async (s: ChartSummary): Promise<void> => {
  try {
    await AsyncStorage.setItem(await sk(K_CHART_SUMMARY), JSON.stringify(s));
  } catch (e) {
    console.warn('saveChartSummary failed', e);
  }
};

export const loadChartSummary = async (): Promise<ChartSummary | null> => {
  try {
    const raw = await AsyncStorage.getItem(await sk(K_CHART_SUMMARY));
    if (!raw) return null;
    return JSON.parse(raw) as ChartSummary;
  } catch {
    return null;
  }
};

// ---------- History (last 10) ----------
export const pushChartHistory = async (entry: ChartHistoryEntry): Promise<void> => {
  try {
    const k = await sk(K_CHART_HISTORY);
    const raw = await AsyncStorage.getItem(k);
    let arr: ChartHistoryEntry[] = [];
    if (raw) arr = JSON.parse(raw);
    // Dedup by date+time+location combo
    const key = `${entry.date}|${entry.time}|${entry.location}`;
    arr = arr.filter(x => `${x.date}|${x.time}|${x.location}` !== key);
    arr.unshift(entry);
    arr = arr.slice(0, 10);
    await AsyncStorage.setItem(k, JSON.stringify(arr));
  } catch (e) {
    console.warn('pushChartHistory failed', e);
  }
};

export const loadChartHistory = async (): Promise<ChartHistoryEntry[]> => {
  try {
    const raw = await AsyncStorage.getItem(await sk(K_CHART_HISTORY));
    if (!raw) return [];
    return JSON.parse(raw) as ChartHistoryEntry[];
  } catch {
    return [];
  }
};

// ---------- Ayanamsa preference (v7.2) ----------
// Per-user sidereal system selection. Lahiri is the gold-standard default.
// Persisted locally so the user's chart stays consistent across sessions.
export const saveAyanamsaPref = async (ayanamsa: string): Promise<void> => {
  try {
    if (!ayanamsa) return;
    await AsyncStorage.setItem(await sk(K_AYANAMSA), ayanamsa);
  } catch {}
};

export const loadAyanamsaPref = async (): Promise<string> => {
  try {
    const v = await AsyncStorage.getItem(await sk(K_AYANAMSA));
    return v || 'lahiri';
  } catch {
    return 'lahiri';
  }
};

/**
 * clearAllStorage — wipes BOTH the current-user's scoped entries AND any
 * lingering pre-v7.1 un-scoped legacy keys. Safe to call on logout or
 * when detecting an email-switch.
 */
export const clearAllStorage = async (): Promise<void> => {
  try {
    const scoped = await Promise.all(LOGICAL_KEYS.map(sk));
    await AsyncStorage.multiRemove([...LOGICAL_KEYS, ...scoped]);
  } catch {}
};

/**
 * Nuclear wipe of EVERY user's scoped bucket on this device.
 * Used from handleLogout to make sure the next user starts 100% clean.
 */
export const clearAllUserScopedStorage = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const doomed = keys.filter((k) =>
      LOGICAL_KEYS.some((logical) => k === logical || k.endsWith(':' + logical))
    );
    if (doomed.length) await AsyncStorage.multiRemove(doomed);
  } catch {}
};
