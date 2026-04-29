/**
 * userPrefs.ts — small AsyncStorage-backed settings store for user-tweakable
 * display / generation preferences. Read/written by:
 *   ChatOverlay.tsx       (gurujiDepth)
 *
 * v8.4 — matchThresholdPct removed with Similar Charts hard-delete.
 * v6.28. Loaded synchronously from an in-memory cache after the first
 * read so the UI never flashes a wrong default on a quick tab switch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type GurujiDepth = 'concise' | 'balanced' | 'deep';

export interface UserPrefs {
  /** Answer verbosity hint sent to the GuruJi chat endpoint. */
  gurujiDepth: GurujiDepth;
}

const DEFAULTS: UserPrefs = {
  gurujiDepth: 'balanced',
};

const STORAGE_KEY = '@user_prefs:v1';

let cache: UserPrefs | null = null;

/** Idempotent — safe to call many times from any component mount. */
export async function loadUserPrefs(): Promise<UserPrefs> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cache = { ...DEFAULTS, ...parsed };
      return cache as UserPrefs;
    }
  } catch { /* fall through to defaults */ }
  cache = { ...DEFAULTS };
  return cache;
}

export async function setUserPref<K extends keyof UserPrefs>(
  key: K,
  value: UserPrefs[K],
): Promise<UserPrefs> {
  const prefs = await loadUserPrefs();
  const next = { ...prefs, [key]: value } as UserPrefs;
  cache = next;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* best effort */ }
  return next;
}

export function getCachedPrefs(): UserPrefs {
  return cache ?? { ...DEFAULTS };
}

export const MATCH_THRESHOLD_OPTIONS: number[] = [30, 40, 50, 70];
export const GURUJI_DEPTH_OPTIONS: { key: GurujiDepth; labelEn: string; labelTe: string }[] = [
  { key: 'concise',  labelEn: 'Concise',  labelTe: 'సంక్షిప్తం' },
  { key: 'balanced', labelEn: 'Balanced', labelTe: 'సమతుల్యం' },
  { key: 'deep',     labelEn: 'Deep',     labelTe: 'లోతైన' },
];
