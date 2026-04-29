/**
 * profileStore.ts — v7.0 Zustand profile middleware.
 *
 * Single source of truth for:
 *   • profile  (ProfileInfo)
 *   • access   (AccessMatrix — plan, trial days, features)
 *   • loading / saving / error flags
 *
 * The store calls the API via `src/lib/api.ts`, which stamps every
 * request with the signed-in email + device_id. No direct axios usage.
 *
 * Usage:
 *   const { profile, access, load, save, redeem } = useProfileStore();
 *   useEffect(() => { load(); }, []);
 *
 *   await save({ first_name, last_name, dob, tob, birth_place, birth_lat, birth_lon, ... });
 *   await redeem('BETA3');
 */
import { create } from 'zustand';
import { apiGet, apiPost, apiPut } from '../lib/api';
import { scopedGet, scopedSet, scopedRemove } from '../lib/userScope';
// v7.18.1 — static imports so there's no dynamic-import waterfall on the
// Overview hot path. (Earlier version used `await import(...)` which added
// ~100-300ms per hit on 4G / slow Wi-Fi and made the app feel sluggish.)
import { loadLocalProfile, saveLocalProfile } from '../utils/localProfile';

// ---------------------------------------------------------------------------
// Types (mirror the backend JSON contract).
// ---------------------------------------------------------------------------
export interface ProfileInfo {
  device_id?: string;
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  gender?: 'male' | 'female';
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
  dob?: string;
  tob?: string;
  birth_place?: string;
  birth_lat?: number | null;
  birth_lon?: number | null;
  plan_id?: string;
  plan_expires_at?: string | null;
  personal_details_complete?: boolean;
}

export interface AccessMatrix {
  plan_id: string;
  plan_active: boolean;
  trial: {
    trial_days_left: number;
    is_registered_trial: boolean;
    extensions_days: number;
  };
  registered: boolean;
  features: Record<string, boolean>;
  has_personal_details?: boolean;
}

export interface InitResult {
  profile: ProfileInfo;
  access: AccessMatrix;
}

export interface PersonalDetailsPatch {
  first_name: string;
  last_name?: string;
  gender?: 'male' | 'female' | 'unspecified';
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed' | 'unspecified';
  dob: string;                 // ISO yyyy-mm-dd
  tob?: string;                // HH:mm — v9.5: optional (sunrise fallback)
  birth_place: string;
  birth_lat: number;
  birth_lon: number;
  phone?: string;
  email?: string;
  // v9.5 — TOB-fallback policy. Only meaningful when tob is empty.
  lagna_source?: 'asc' | 'sunrise' | 'moon';
}

// ---------------------------------------------------------------------------
// Store shape.
// ---------------------------------------------------------------------------
interface State {
  profile: ProfileInfo | null;
  access:  AccessMatrix | null;
  loading: boolean;
  saving:  boolean;
  error:   string | null;

  // Actions.
  init:    (opts?: { email?: string; name?: string }) => Promise<InitResult | null>;
  refetch: () => Promise<void>;
  save:    (patch: PersonalDetailsPatch) => Promise<InitResult | null>;
  updateContact: (patch: { name?: string; phone?: string }) => Promise<InitResult | null>;
  redeem:  (code: string) => Promise<{ ok: boolean; message?: string; result?: InitResult }>;
  reset:   () => void;
}

// ---------------------------------------------------------------------------
// Scoped-cache keys (lives under `u:<email>:` namespace via userScope).
// ---------------------------------------------------------------------------
const CK_PROFILE_CACHE = 'profile.v7';

// ---------------------------------------------------------------------------
// Store implementation.
// ---------------------------------------------------------------------------
export const useProfileStore = create<State>((set, get) => ({
  profile: null,
  access:  null,
  loading: false,
  saving:  false,
  error:   null,

  // ------------------------------------------------------------------ init
  init: async (opts = {}) => {
    set({ loading: true, error: null });
    try {
      // Optimistic hydrate from the current-user's scoped cache, if any.
      const cached = await scopedGet(CK_PROFILE_CACHE);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as InitResult;
          set({ profile: parsed.profile, access: parsed.access });
        } catch { /* ignore */ }
      }
      // Fresh fetch (server is email-first, so this is always correct).
      const data = await apiPost<InitResult>('/profile/init', opts);

      // v7.16 — Merge browser-local birth details over the (intentionally
      // sparse) server profile. The backend no longer stores birth data;
      // the client is the source of truth for dob/tob/birth_place/etc.
      // v7.18.3 — If localStorage is EMPTY, force has_personal_details=false
      // regardless of what backend says. For returning users who had data
      // in the old DB (now purged) but no local copy yet, this re-routes
      // them to the onboarding form instead of hanging on "Building chart…".
      try {
        const email = (opts?.email || data.profile?.email || '').toLowerCase();
        if (email) {
          const local = await loadLocalProfile(email);
          if (local && local.dob && local.tob && local.birth_lat && local.birth_lon) {
            data.profile = {
              ...data.profile,
              first_name:      local.first_name,
              last_name:       local.last_name,
              name:            `${local.first_name} ${local.last_name}`.trim(),
              gender:          local.gender,
              marital_status:  local.marital_status,
              dob:             local.dob,
              tob:             local.tob,
              birth_place:     local.birth_place,
              birth_lat:       local.birth_lat,
              birth_lon:       local.birth_lon,
              phone:           local.phone || '',
              personal_details_complete: true,
            } as any;
            if (data.access) {
              (data.access as any).has_personal_details = true;
            }
          } else {
            // No local profile → this browser doesn't have the user's data.
            // Override the backend flag so the app sends them to the form.
            (data.profile as any) = {
              ...data.profile,
              dob: '', tob: '', birth_place: '',
              birth_lat: null, birth_lon: null,
              personal_details_complete: false,
            };
            if (data.access) {
              (data.access as any).has_personal_details = false;
            }
          }
        }
      } catch { /* best-effort — fall through with server-only profile */ }

      set({ profile: data.profile, access: data.access, loading: false });
      await scopedSet(CK_PROFILE_CACHE, JSON.stringify(data));
      return data;
    } catch (e: any) {
      set({ error: e?.message || 'init failed', loading: false });
      return null;
    }
  },

  // ------------------------------------------------------------------ refetch
  refetch: async () => {
    try {
      const data = await apiGet<InitResult>('/profile/me');
      set({ profile: data.profile, access: data.access });
      await scopedSet(CK_PROFILE_CACHE, JSON.stringify(data));
    } catch (e: any) {
      set({ error: e?.message || 'refetch failed' });
    }
  },

  // ------------------------------------------------------------------ save personal details
  save: async (patch) => {
    set({ saving: true, error: null });
    try {
      // v7.16 — PRIVACY: write birth details to the browser FIRST so even if
      // the backend call fails the user's data stays with them.
      try {
        const email = (patch.email || get().profile?.email || '').toLowerCase();
        if (email) {
          await saveLocalProfile(email, {
            first_name: patch.first_name, last_name: patch.last_name,
            gender: patch.gender, marital_status: patch.marital_status,
            dob: patch.dob, tob: patch.tob, birth_place: patch.birth_place,
            birth_lat: patch.birth_lat, birth_lon: patch.birth_lon,
            phone: patch.phone,
          });
        }
      } catch { /* non-fatal */ }

      // Backend call flips personal_details_complete=true so the access
      // matrix unlocks read-only tabs. Backend no longer persists birth
      // fields (v7.16 — see routes/profile_routes.py).
      const data = await apiPut<InitResult>('/profile/personal', patch);

      // Merge the browser-local birth details back into the returned
      // profile (the server's copy is intentionally sparse now).
      const merged: InitResult = {
        ...data,
        profile: {
          ...data.profile,
          first_name: patch.first_name,
          last_name:  patch.last_name,
          name: `${patch.first_name} ${patch.last_name}`.trim(),
          gender: patch.gender,
          marital_status: patch.marital_status,
          dob: patch.dob, tob: patch.tob,
          birth_place: patch.birth_place,
          birth_lat: patch.birth_lat, birth_lon: patch.birth_lon,
          phone: patch.phone || '',
          personal_details_complete: true,
        } as any,
      };
      if (merged.access) (merged.access as any).has_personal_details = true;

      set({ profile: merged.profile, access: merged.access, saving: false });
      await scopedSet(CK_PROFILE_CACHE, JSON.stringify(merged));
      return merged;
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'save failed';
      set({ error: msg, saving: false });
      return null;
    }
  },

  // ------------------------------------------------------------------ update contact only
  updateContact: async (patch) => {
    set({ saving: true, error: null });
    try {
      const data = await apiPut<InitResult>('/profile/me', patch);
      set({ profile: data.profile, access: data.access, saving: false });
      await scopedSet(CK_PROFILE_CACHE, JSON.stringify(data));
      return data;
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'update failed';
      set({ error: msg, saving: false });
      return null;
    }
  },

  // ------------------------------------------------------------------ redeem code
  redeem: async (code) => {
    const c = code.trim().toUpperCase();
    if (!c) return { ok: false, message: 'Code required' };
    try {
      const data = await apiPost<InitResult & { message?: string }>(
        '/profile/trial/redeem', { code: c }
      );
      set({ profile: data.profile, access: data.access });
      await scopedSet(CK_PROFILE_CACHE, JSON.stringify({ profile: data.profile, access: data.access }));
      return { ok: true, message: data.message, result: data };
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'redeem failed';
      return { ok: false, message: msg };
    }
  },

  // ------------------------------------------------------------------ reset (used on logout)
  reset: () => {
    set({ profile: null, access: null, error: null, loading: false, saving: false });
    // Best-effort delete of the scoped cache. We don't await here because
    // purgeAllUserState() called from handleLogout will wipe it anyway.
    scopedRemove(CK_PROFILE_CACHE).catch(() => {});
  },
}));
