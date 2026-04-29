/**
 * birthDetailsStore.ts — single source of truth for the user's birth
 * details. v8.5.
 *
 * Problem it solves:
 *   PersonalDetailsForm previously owned birth details in component-local
 *   useState. Every unmount lost the values; every remount re-initialized
 *   from `initial` prop (which was undefined from the gate), so fields
 *   appeared empty even though LS had the data. Sibling pages (Overview,
 *   Charts, Muhurtas) had no way to see the birth details at all.
 *
 * Solution:
 *   A tiny zustand store that:
 *     • reads from `@astroquest.localProfile.<email>.v1` on `refresh()`
 *     • persists back to LS on `save()`
 *     • is THE place every screen subscribes to for name / dob / tob /
 *       place / lat / lon / gender / marital / phone
 *
 * Lifecycle:
 *   _layout.tsx and index.tsx call `refresh(email)` whenever the auth
 *   user changes OR the app comes back to foreground / a screen mounts.
 *   A dedicated `useRefreshBirthDetailsOnFocus()` hook wraps this so
 *   callers don't have to wire effects themselves.
 */
import { create } from 'zustand';
import { saveLocalProfile, loadLocalProfile, type LocalProfileData as LocalProfile } from '../utils/localProfile';

export type Gender        = 'Male' | 'Female' | 'Other' | '';
export type MaritalStatus = 'Single' | 'Married' | 'Divorced' | 'Widowed' | '';

export interface BirthDetails {
  first_name:    string;
  last_name:     string;
  gender:        Gender;
  marital_status: MaritalStatus;
  dob:           string;          // "YYYY-MM-DD"
  tob:           string;          // "HH:MM" — v9.5: may be empty (sunrise fallback used)
  birth_place:   string;
  birth_lat:     number | null;
  birth_lon:     number | null;
  phone:         string;
  language:      string;
  ayanamsa:      string;
  // v9.5 — fallback choice when TOB is missing. Backend uses this in
  // /calculate-chart to decide between sunrise-Asc and Chandra-Lagna.
  lagna_source:  'asc' | 'sunrise' | 'moon';
}

export const EMPTY_BIRTH_DETAILS: BirthDetails = {
  first_name: '', last_name: '',
  gender: '', marital_status: '',
  dob: '', tob: '',
  birth_place: '',
  birth_lat: null, birth_lon: null,
  phone: '',
  language: 'en',
  ayanamsa: 'lahiri',
  lagna_source: 'asc',
};

export function isBirthDetailsComplete(bd: BirthDetails | null | undefined): boolean {
  if (!bd) return false;
  // v9.5 — TOB is OPTIONAL. We only require dob + birth coordinates +
  // birth place. When tob is empty the backend falls back to sunrise (or
  // Moon-Lagna depending on `lagna_source`).
  return !!(bd.dob && bd.birth_lat != null && bd.birth_lon != null && bd.birth_place);
}

interface State {
  email:         string | null;
  birth:         BirthDetails;
  loaded:        boolean;  // true once refresh() has run at least once
  refreshing:    boolean;  // guards against concurrent LS reads

  // actions
  refresh: (email: string | null | undefined) => Promise<BirthDetails>;
  save:    (email: string, patch: Partial<BirthDetails>) => Promise<BirthDetails>;
  clear:   () => void;
}

export const useBirthDetailsStore = create<State>((set, get) => ({
  email:      null,
  birth:      EMPTY_BIRTH_DETAILS,
  loaded:     false,
  refreshing: false,

  refresh: async (email) => {
    const lower = (email || '').trim().toLowerCase();
    if (!lower) {
      set({ email: null, birth: EMPTY_BIRTH_DETAILS, loaded: true });
      return EMPTY_BIRTH_DETAILS;
    }
    if (get().refreshing) return get().birth;
    set({ refreshing: true });
    try {
      const local = (await loadLocalProfile(lower)) as Partial<LocalProfile> | null;
      const next: BirthDetails = {
        first_name:     local?.first_name     ?? '',
        last_name:      local?.last_name      ?? '',
        gender:         (local?.gender         as Gender)        ?? '',
        marital_status: (local?.marital_status as MaritalStatus) ?? '',
        dob:            local?.dob            ?? '',
        tob:            local?.tob            ?? '',
        birth_place:    local?.birth_place    ?? '',
        birth_lat:      local?.birth_lat ?? null,
        birth_lon:      local?.birth_lon ?? null,
        phone:          local?.phone          ?? '',
        language:       (local as any)?.language ?? 'en',
        ayanamsa:       (local as any)?.ayanamsa ?? 'lahiri',
      };
      set({ email: lower, birth: next, loaded: true, refreshing: false });
      return next;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[birthDetailsStore] refresh failed', e);
      set({ refreshing: false, loaded: true });
      return get().birth;
    }
  },

  save: async (email, patch) => {
    const lower = email.trim().toLowerCase();
    if (!lower) throw new Error('email required to save birth details');
    const merged: BirthDetails = { ...get().birth, ...patch };
    // Only persist the server-shaped subset (never store `language` or
    // `ayanamsa` — those are UI prefs saved elsewhere).
    await saveLocalProfile(lower, {
      first_name:     merged.first_name,
      last_name:      merged.last_name,
      gender:         merged.gender || undefined,
      marital_status: merged.marital_status || undefined,
      dob:            merged.dob,
      tob:            merged.tob,
      birth_place:    merged.birth_place,
      birth_lat:      merged.birth_lat ?? 0,
      birth_lon:      merged.birth_lon ?? 0,
      phone:          merged.phone || undefined,
    } as any);
    set({ email: lower, birth: merged, loaded: true });
    return merged;
  },

  clear: () => set({ email: null, birth: EMPTY_BIRTH_DETAILS, loaded: false }),
}));

// --------------------------------------------------------------------
// Convenience hook — call this at the top of any screen that wants to
// auto-refresh birth details from LS whenever the screen mounts / the
// app comes back to foreground. Makes the "read LS every time the user
// visits the page" behaviour the user asked for trivial to opt into.
// --------------------------------------------------------------------
import { useEffect } from 'react';
import { AppState } from 'react-native';

export function useRefreshBirthDetailsOnFocus(email: string | null | undefined) {
  const refresh = useBirthDetailsStore((s) => s.refresh);
  useEffect(() => {
    if (!email) return;
    // Initial refresh on mount.
    void refresh(email);
    // Re-refresh when the tab regains focus (web) or the app foregrounds.
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void refresh(email);
    });
    return () => sub.remove();
  }, [email, refresh]);
}
