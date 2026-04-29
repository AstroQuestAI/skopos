/**
 * useCosmic — feature flag for the "Vidhaata Cosmic" theme.
 *
 * The flag turns ON when:
 *   1. URL contains `?cosmic=1` (or `cosmic=true`), OR
 *   2. localStorage previously persisted `astroquest.cosmic = '1'`.
 *
 * It can be turned OFF by appending `?cosmic=0` to the URL OR by
 * calling the setter returned from `useCosmicSetter()` from any
 * in-app toggle (e.g. the Profile → Appearance switch).
 */

import { useEffect, useState } from 'react';

const LS_KEY = 'astroquest.cosmic';
// Tiny pub/sub so multiple useCosmic() instances stay in sync after
// an in-app toggle. (Without this, only the component that called
// the setter would re-render.)
type Listener = (on: boolean) => void;
const listeners = new Set<Listener>();
function emit(on: boolean) { listeners.forEach((fn) => fn(on)); }

function readUrlFlag(): '1' | '0' | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const v = (url.searchParams.get('cosmic') || '').toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return '1';
    if (v === '0' || v === 'false' || v === 'no' || v === 'off') return '0';
  } catch { /* ignore */ }
  return null;
}

function readStored(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem(LS_KEY) === '1';
  } catch { /* ignore */ }
  return false;
}

function writeStored(on: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.localStorage?.setItem(LS_KEY, '1');
    else    window.localStorage?.removeItem(LS_KEY);
  } catch { /* ignore */ }
}

/**
 * Synchronous read of the cosmic flag — usable outside hooks
 * (e.g. inside the +html.tsx font preload). Returns true if the
 * flag is currently ON.
 *
 * v8.15.7 — cosmic is now the ONLY theme. Always returns true.
 * The legacy ?cosmic=0 escape hatch is preserved internally for
 * developer debugging via setCosmic(false) but the public API
 * always reports "on".
 */
export function isCosmicActive(): boolean {
  return true;
}

/**
 * Programmatic toggle. Updates URL (?cosmic=1 / ?cosmic=0) without
 * reloading, persists to localStorage, and notifies all live useCosmic()
 * hooks so their consumers re-render.
 */
export function setCosmic(on: boolean): void {
  writeStored(on);
  if (typeof window !== 'undefined') {
    (window as any).__AQ_COSMIC__ = on;
    try {
      const url = new URL(window.location.href);
      if (on) url.searchParams.set('cosmic', '1');
      else    url.searchParams.set('cosmic', '0');
      window.history.replaceState({}, '', url.toString());
    } catch { /* ignore */ }
  }
  emit(on);
}

/**
 * React hook — returns whether the cosmic skin should render.
 *
 * v8.15.7 — cosmic is now the ONLY theme. Always returns true so every
 * call site that conditionally rendered cosmic ("if (cosmicOn) ...") now
 * renders cosmic unconditionally, and the legacy theme is dead code that
 * we'll prune in a follow-up. This was the user's explicit direction so
 * we can iterate on the cosmic look without legacy patches showing through.
 */
export function useCosmic(): boolean {
  // Initialize SSR-safe (true on the server too, so SSR markup matches).
  const [active, setActive] = useState<boolean>(true);

  useEffect(() => {
    // Force the .cosmic class on <html> + <body> + globals so the global
    // skin (CosmicGlobalStyle) and the runtime sweeper kick in even on
    // first paint, before any URL/storage processing.
    if (typeof window !== 'undefined') {
      (window as any).__AQ_COSMIC__ = true;
    }
    // Subscribe to programmatic setCosmic() calls anyway so the legacy
    // `setCosmic(false)` developer escape-hatch still works for debugging.
    const handler: Listener = (on) => setActive(on);
    listeners.add(handler);
    // Also keep storage in sync ('1') so reloading retains cosmic.
    writeStored(true);
    return () => { listeners.delete(handler); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return active;
}
