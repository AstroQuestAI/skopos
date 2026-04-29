/**
 * useBootstrap.ts — the single source of truth for app-wide data
 * hydration. v8.4.
 *
 *   1. On mount (after sign-in), read the LS cache for this email.
 *   2. If cached AND within TTL (48 h sliding) → return immediately
 *      (stage = 'ready'), touch the cache to slide the window.
 *   3. If cached but STALE → return it immediately for optimistic
 *      render, and silently kick off /api/bootstrap to refresh.
 *   4. If no cache at all → progressive spinner with 3 stages
 *      ('verifying' → 'generating' → 'loading_texts' → 'ready')
 *      while /api/bootstrap runs, then write-through to LS.
 *
 * Exposes a `forceRefresh(birthDetails?)` action so callers can trigger
 * a full bundle recompute (used when DOB / TOB / location change).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../utils/backendUrl';
import { getOrCreateDeviceId } from '../utils/profile';
import { loadLocalProfile } from '../utils/localProfile';
import {
  readBundle,
  writeBundle,
  touchBundle,
  clearBundle,
} from '../utils/bootstrapCache';

export type BootstrapStage =
  | 'idle'           // no user yet, or waiting for authUser.email
  | 'verifying'      // checking cache + deriving device_id + auth email
  | 'generating'     // POST /api/bootstrap is in flight
  | 'loading_texts'  // response arrived, last-mile save to LS + setState
  | 'ready'          // data is on screen
  | 'error';         // /api/bootstrap rejected and no cache to fall back to

export interface BootstrapBundle {
  profile?: any;
  access?: any;
  chart?: any;
  today_muhurtas?: any;
  transits?: any;
  [k: string]: any;
}

export interface UseBootstrapArgs {
  authUser: { email?: string; name?: string } | null;
  // Fallback: if the caller already knows the user's birth details
  // (e.g. just submitted the form) pass them to avoid a re-read of LS.
  birthDetailsOverride?: any | null;
}

export interface UseBootstrapReturn {
  stage: BootstrapStage;
  bundle: BootstrapBundle | null;
  error: string | null;
  lastUpdatedAt: string | null;
  /** Force a full backend recompute. Call after DOB/TOB/location edits. */
  forceRefresh: (birthDetails?: any) => Promise<void>;
  /** Merge a partial patch into the cached bundle (cache-copy-on-update). */
  patchLocal: (patch: Partial<BootstrapBundle>) => void;
}

// Small helper — pull birth details from either the caller's override
// or the user's localStorage. Returns null if incomplete.
async function resolveBirthDetails(email: string, override?: any | null) {
  const src = override || (await loadLocalProfile(email));
  if (!src) return null;
  // v9.5 — TOB is OPTIONAL. Only require dob + lat/lon. When tob is empty
  // the backend computes a sunrise fallback (or Moon-Lagna depending on
  // src.lagna_source).
  if (!src.dob || !src.birth_lat || !src.birth_lon) return null;
  const tz =
    typeof src.timezone_offset === 'number'
      ? src.timezone_offset
      : 5.5; // default IST — the backend also falls back to 5.5
  return {
    first_name: src.first_name || '',
    last_name: src.last_name || '',
    date: src.dob,
    time: src.tob || '',           // empty → backend sunrise fallback
    location: src.birth_place || '',
    latitude: src.birth_lat,
    longitude: src.birth_lon,
    timezone_offset: tz,
    language: src.language || 'en',
    ayanamsa: src.ayanamsa || 'lahiri',
    lagna_source: (src.lagna_source as any) || 'asc',
  };
}

export function useBootstrap({
  authUser,
  birthDetailsOverride,
}: UseBootstrapArgs): UseBootstrapReturn {
  const [stage, setStage] = useState<BootstrapStage>('idle');
  const [bundle, setBundle] = useState<BootstrapBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  // Guard against stale closures when the user switches accounts quickly.
  const runIdRef = useRef(0);

  const patchLocal = useCallback(
    (patch: Partial<BootstrapBundle>) => {
      setBundle((prev) => ({ ...(prev || {}), ...patch }));
      // Also push into LS so the next page open sees the patched version
      // without waiting for /api/bootstrap.
      const email = (authUser?.email || '').toLowerCase();
      if (email) {
        // Fire-and-forget; any failure here is non-fatal.
        import('../utils/bootstrapCache').then(({ patchBundle }) => {
          void patchBundle(email, patch);
        });
      }
    },
    [authUser?.email],
  );

  const runBootstrap = useCallback(
    async (birthDetailsOv?: any) => {
      const email = (authUser?.email || '').toLowerCase();
      if (!email) {
        setStage('idle');
        return;
      }
      const myRunId = ++runIdRef.current;

      setStage('verifying');
      setError(null);

      const device_id = await getOrCreateDeviceId();

      // Cache-first: hydrate from LS if available.
      const cached = await readBundle(email);
      if (cached) {
        // Always paint the cached bundle immediately — even if stale.
        // Staleness just means we'll also kick off a background refresh.
        if (myRunId !== runIdRef.current) return;
        setBundle(cached.bundle);
        setLastUpdatedAt(cached.cached_at);
        if (cached.valid) {
          // Warm hit: slide the TTL window and we're done. No network.
          await touchBundle(email);
          if (myRunId !== runIdRef.current) return;
          setStage('ready');
          return;
        }
        // Stale cache — we'll paint it now but still hit the wire below.
      }

      // Assemble the /api/bootstrap payload. Birth details must exist,
      // else we can't compute a chart — return with ready+no-chart and
      // let the app's personal-details-form gate route the user.
      const bd = await resolveBirthDetails(email, birthDetailsOv);
      if (!bd) {
        if (myRunId !== runIdRef.current) return;
        // No birth details yet. We're "ready" in the sense that we
        // know what to show (the onboarding form) — downstream UI
        // can decide based on `bundle?.chart == null`.
        setStage('ready');
        return;
      }

      setStage('generating');
      try {
        const { data } = await axios.post(
          `${BACKEND_URL}/api/bootstrap`,
          {
            device_id,
            email: authUser?.email,
            name: authUser?.name,
            birth_details: bd,
            include_chart: true,
            include_muhurtas: true,
            include_transits: true,
          },
          { timeout: 45_000 },
        );
        if (myRunId !== runIdRef.current) return;

        const nextBundle: BootstrapBundle = {
          profile: data.profile,
          access: data.access,
          chart: data.chart,
          today_muhurtas: data.today_muhurtas,
          transits: data.transits,
        };

        setStage('loading_texts');
        await writeBundle(email, nextBundle);

        if (myRunId !== runIdRef.current) return;
        setBundle(nextBundle);
        setLastUpdatedAt(new Date().toISOString());
        setStage('ready');
      } catch (e: any) {
        if (myRunId !== runIdRef.current) return;
        // eslint-disable-next-line no-console
        console.warn('[bootstrap] /api/bootstrap failed', e?.message || e);
        if (cached) {
          // We already painted the stale cache. Keep it on screen and
          // surface the error softly.
          setError(e?.response?.data?.detail || e?.message || 'Refresh failed');
          setStage('ready');
        } else {
          setError(e?.response?.data?.detail || e?.message || 'Could not load your data');
          setStage('error');
        }
      }
    },
    [authUser?.email, authUser?.name],
  );

  // Auto-run when authUser.email changes.
  useEffect(() => {
    void runBootstrap(birthDetailsOverride);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.email]);

  const forceRefresh = useCallback(
    async (birthDetails?: any) => {
      const email = (authUser?.email || '').toLowerCase();
      if (email) await clearBundle(email); // nuke cache so runBootstrap hits wire
      await runBootstrap(birthDetails);
    },
    [authUser?.email, runBootstrap],
  );

  return { stage, bundle, error, lastUpdatedAt, forceRefresh, patchLocal };
}
