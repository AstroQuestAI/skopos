/**
 * corpus.ts — loads the read-only classical corpus from the app's
 * bundled JSON assets. Enables the Active Yogas bottom sheet, bhavas
 * cards, yoga-chapter deep-dives, and muhurta shlokas to render WITHOUT
 * hitting the network — massive perceived-speed win.
 *
 * Usage:
 *   import { loadCorpus, findSituationsByYogaName } from '../utils/corpus';
 *   await loadCorpus(); // idempotent, call once near app start
 *   const sits = findSituationsByYogaName('Kesari');
 */
// NOTE: react-native's Metro bundler resolves `require('../../assets/corpus/*.json')`
// at build time and inlines the JSON into the bundle. This is the intended
// Expo path for static data (no network / no AsyncStorage lookup required).

type CorpusState = {
  loaded: boolean;
  version: string | null;
  situations: any[];
  yoga_chapters: any[];
  famous_charts: any[];
  bhavas: any[];
  bhava_chapters: any[];
  concepts: any[];
  muhurta_shlokas: any[];
  situationsByYogaKey: Map<string, any[]>;
};

const EMPTY: CorpusState = {
  loaded: false,
  version: null,
  situations: [],
  yoga_chapters: [],
  famous_charts: [],
  bhavas: [],
  bhava_chapters: [],
  concepts: [],
  muhurta_shlokas: [],
  situationsByYogaKey: new Map(),
};

let state: CorpusState = { ...EMPTY };

function normalizeYogaKey(raw: string | undefined | null): string {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/\byogam?\b/g, '')
    // keep ASCII letters + digits + Telugu block (U+0C00..U+0C7F)
    .replace(/[^a-z0-9\u0C00-\u0C7F]/g, '')
    .trim();
}

function indexSituations(situations: any[]): Map<string, any[]> {
  const idx = new Map<string, any[]>();
  for (const s of situations) {
    const candidates = [s?.title_en, s?.name_en, s?.title_te, s?.yoga_name]
      .filter(Boolean)
      .map(normalizeYogaKey)
      .filter(Boolean);
    for (const k of candidates) {
      const arr = idx.get(k) || [];
      arr.push(s);
      idx.set(k, arr);
    }
  }
  return idx;
}

/**
 * Idempotent — safe to call many times. Lazy-loads all JSON bundles.
 */
export function loadCorpus(): CorpusState {
  if (state.loaded) return state;
  try {
    const manifest = require('../../assets/corpus/manifest.json');
    const situations = require('../../assets/corpus/situations.json');
    const yoga_chapters = require('../../assets/corpus/yoga_chapters.json');
    const famous_charts = require('../../assets/corpus/famous_charts.json');
    const bhavas = require('../../assets/corpus/bhavas.json');
    const bhava_chapters = require('../../assets/corpus/bhava_chapters.json');
    const concepts = require('../../assets/corpus/concepts.json');
    const muhurta_shlokas = require('../../assets/corpus/muhurta_shlokas.json');
    state = {
      loaded: true,
      version: manifest?.version || null,
      situations,
      yoga_chapters,
      famous_charts,
      bhavas,
      bhava_chapters,
      concepts,
      muhurta_shlokas,
      situationsByYogaKey: indexSituations(situations),
    };
  } catch (e) {
    // If bundled corpus is missing for any reason, return empty state;
    // callers should fall back to server fetch.
    // eslint-disable-next-line no-console
    console.warn('[corpus] bundled load failed', e);
    state = { ...EMPTY, loaded: true };
  }
  return state;
}

export function getCorpusVersion(): string | null {
  return state.loaded ? state.version : null;
}

/** Find all situations that describe a given yoga (by name, in any script). */
export function findSituationsByYogaName(rawName: string): any[] {
  const s = loadCorpus();
  const key = normalizeYogaKey(rawName);
  if (!key) return [];
  return s.situationsByYogaKey.get(key) || [];
}

/** Return the yoga chapter doc for a given yoga name, if present. */
export function findYogaChapter(rawName: string): any | null {
  const s = loadCorpus();
  const needle = normalizeYogaKey(rawName);
  for (const y of s.yoga_chapters) {
    const k = normalizeYogaKey(y?.yoga_name || y?.title_en);
    if (k && (k === needle || k.includes(needle) || needle.includes(k))) {
      return y;
    }
  }
  return null;
}

/** Get the bhava (house) interpretation record for house_number 1..12. */
export function findBhavaByNumber(n: number): any | null {
  const s = loadCorpus();
  return s.bhavas.find((b) => b?.house_number === n || b?.bhava_number === n) || null;
}

export function getAllFamousCharts(): any[] {
  return loadCorpus().famous_charts;
}

export function getAllMuhurtaShlokas(): any[] {
  return loadCorpus().muhurta_shlokas;
}
