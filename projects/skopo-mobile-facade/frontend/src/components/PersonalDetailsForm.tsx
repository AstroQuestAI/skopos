/**
 * PersonalDetailsForm — post-Google onboarding (v6.40 / Phase D).
 *
 * Collected per product spec (June 2026 redesign):
 *   • First name + Last name  (pre-filled from Google displayName)
 *   • Gender                 → Male / Female
 *   • Marital status         → Single / Married / Divorced / Widowed
 *   • DOB, Time of birth, Birth place
 *   • Phone (optional), Email (read-only from Google)
 *
 * Posts to PUT /api/profile/personal. The backend marks
 * personal_details_complete=true so the gate in index.tsx lets the user
 * proceed to the read-only Overview.
 *
 * All dates/times use text inputs (DD/MM/YYYY · HH:MM 24h) with picker
 * buttons so the flow works on web + native without extra platform deps.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { UniversalDateField, UniversalTimeField } from './UniversalDateTime';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GuruAvatar } from './GuruAvatar';
import { theme } from '../theme';
import type { InitResult } from '../utils/profile';
import { saveAyanamsaPref, loadAyanamsaPref } from '../utils/storage';
// v7.19 — route submit through the zustand profile store so birth details
// are persisted to browser localStorage (privacy-first) in addition to
// flipping the backend's personal_details_complete flag. The old direct
// axios.put path skipped the local save, wiping the form data on submit.
import { useProfileStore } from '../state/profileStore';
// v7.19.1 — ALSO save directly to localStorage inside the form as a
// belt-and-suspenders guarantee. If the store's save hiccups for any
// reason (stale email, race with init), the birth details are still
// persisted to the device and the user will not lose their data.
import { saveLocalProfile } from '../utils/localProfile';
// v8.5 — global birth-details store. Single source of truth shared by
// every screen. Re-reads LS on mount + on app-foreground.
import { useBirthDetailsStore, useRefreshBirthDetailsOnFocus, isBirthDetailsComplete } from '../state/birthDetailsStore';

import { BACKEND_URL } from '../utils/backendUrl';

interface Props {
  authUser: { name?: string; email?: string; picture?: string };
  onDone: (res: InitResult) => void;
  onLogout?: () => void;
  /** v6.48 — pre-fill an existing profile so the same form can be used
   *  from the Profile-Edit page. When provided, fields hydrate from
   *  these values instead of the Google name split. */
  initial?: {
    first_name?: string;
    last_name?: string;
    gender?: 'male' | 'female';
    marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
    dob?: string;              // ISO yyyy-mm-dd
    tob?: string;              // HH:mm
    birth_place?: string;
    birth_lat?: number | null;
    birth_lon?: number | null;
    phone?: string;
  } | null;
  /** v6.48 — optional header node (AppHeader) for re-use inside
   *  Profile page; also lets us hide the default hero/intro. */
  header?: React.ReactNode;
  /** v6.48 — hide the top hero block when re-used inside Profile. */
  hideHero?: boolean;
  /** v6.48 — CTA text; onboarding uses the default, profile-edit
   *  overrides to "Save changes". */
  submitLabel?: string;
  /** v6.48 — optional extra content rendered between the phone
   *  field and the submit button (Profile uses this for Access /
   *  Coupon rows). */
  footerExtras?: React.ReactNode;
}

type Gender = 'male' | 'female';
type Marital = 'single' | 'married' | 'divorced' | 'widowed';

export const PersonalDetailsForm: React.FC<Props> = ({
  authUser, onDone, onLogout, initial, header, hideHero, submitLabel, footerExtras,
}) => {
  const initialParts = (authUser?.name || '').trim().split(/\s+/);
  const defFirst = initialParts.slice(0, -1).join(' ') || initialParts[0] || '';
  const defLast  = initialParts.length > 1 ? initialParts[initialParts.length - 1] : '';

  const [firstName, setFirstName] = useState(initial?.first_name || defFirst);
  const [lastName,  setLastName]  = useState(initial?.last_name  || defLast);
  const [gender,    setGender]    = useState<Gender>(initial?.gender || 'male');
  const [marital,   setMarital]   = useState<Marital>(initial?.marital_status || 'single');
  const [dob,       setDob]       = useState<Date | null>(initial?.dob ? new Date(initial.dob) : null);
  const [tob,       setTob]       = useState<Date | null>(() => {
    if (!initial?.tob) return null;
    const [hh, mm] = initial.tob.split(':').map((s) => parseInt(s, 10));
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      const d = new Date(); d.setHours(hh, mm, 0, 0); return d;
    }
    return null;
  });
  const [dobText,   setDobText]   = useState(initial?.dob || '');
  const [tobText,   setTobText]   = useState(initial?.tob || '');
  const [place,     setPlace]     = useState(initial?.birth_place || '');
  const [coords,    setCoords]    = useState<{ lat: number; lon: number } | null>(
    initial?.birth_lat != null && initial?.birth_lon != null
      ? { lat: Number(initial.birth_lat), lon: Number(initial.birth_lon) }
      : null
  );
  const [phone,     setPhone]     = useState(initial?.phone || '');
  const [suggestions, setSuggestions] = useState<Array<{ name: string; latitude: number; longitude: number }>>([]);
  const [showDobPick, setShowDobPick] = useState(false);
  const [showTobPick, setShowTobPick] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  // v8.4.2 / v8.5.2 — READ-ONLY MODE toggle. Once a user has a complete
  // profile on disk, re-opening the Profile page should show it LOCKED
  // (like a passport page). An explicit "Edit" button unlocks the fields,
  // preventing accidental edits + killing the autocomplete popup that
  // kept reappearing on every mount.
  //
  // v8.5.2 fix: initialise from the `initial` prop so re-mounts (e.g.
  // Home ↔ Profile navigation) don't flash unlocked for a frame before
  // the store-hydration effect flips readOnly back to true. Previously
  // this racing caused the Save/Edit button to oscillate after 2-3
  // context switches and showed "Save & continue" without the user
  // tapping anything.
  const initialIsComplete = !!(
    initial?.dob && initial?.tob &&
    initial?.birth_lat != null && initial?.birth_lon != null &&
    initial?.birth_place
  );
  const [readOnly, setReadOnly] = useState<boolean>(initialIsComplete);
  // Track whether the user has actively typed into the place field.
  // Autocomplete only fires on USER typing — never on programmatic
  // setPlace (e.g. from LS hydrate), which used to pop the suggestions
  // dropdown and confuse users.
  const userTypedPlaceRef = React.useRef(false);
  // Snapshot of the original birth details we hydrated from disk.
  // On save we diff against this to decide whether the chart needs a
  // backend recompute.
  // v8.5.2 — seed from `initial` if provided so the first save's dirty-
  // detection diff works on profile revisits (previously this was null
  // on mount, forcing chartAffected=true and a bootstrap rebuild even
  // for no-op saves).
  const originalRef = React.useRef<{
    dob: string; tob: string; birth_lat: number | null; birth_lon: number | null;
  } | null>(initialIsComplete ? {
    dob:       initial!.dob!,
    tob:       initial!.tob!,
    birth_lat: Number(initial!.birth_lat),
    birth_lon: Number(initial!.birth_lon),
  } : null);

  // v8.5 — SINGLE SOURCE OF TRUTH: subscribe to the global birth-details
  // store. Re-reads LS whenever the screen mounts OR the app returns to
  // foreground — so navigating away and back to this screen ALWAYS
  // reflects the latest persisted values. No more stale component-local
  // state.
  useRefreshBirthDetailsOnFocus(authUser?.email);
  const storeBirth = useBirthDetailsStore((s) => s.birth);
  const storeLoaded = useBirthDetailsStore((s) => s.loaded);

  // v8.5.1 — Hydration guard. `hasHydratedRef` tracks whether we've
  // already copied store → local form state once for this mount.
  //   • First mount: hasHydrated=false, readOnly=false. We run hydrate
  //     (previously a buggy `if (!readOnly) return;` bailed out here
  //     before running hydrate — this was the root cause of data
  //     clearing on profile revisit).
  //   • After a successful hydrate with complete data we flip
  //     readOnly=true so the form locks as expected.
  //   • While locked (readOnly=true) any fresh store pushes still
  //     re-hydrate (safe — the store is authoritative).
  //   • Once the user taps Edit (readOnly flips to false AND we've
  //     already hydrated), the effect short-circuits so typing is
  //     never clobbered mid-edit.
  const hasHydratedRef = React.useRef(false);
  useEffect(() => {
    if (!storeLoaded) return;
    if (hasHydratedRef.current && !readOnly) return; // user is editing

    // v8.5.2 — hydrate from the global store EVEN when `initial` was
    // provided by the caller. The store is the authoritative mirror of
    // LocalStorage; `initial` only survives the first mount, after which
    // subsequent renders of the form rely on this effect.
    if (storeBirth.first_name)     setFirstName(storeBirth.first_name);
    if (storeBirth.last_name)      setLastName(storeBirth.last_name);
    if (storeBirth.gender)         setGender(storeBirth.gender as Gender);
    if (storeBirth.marital_status) setMarital(storeBirth.marital_status as Marital);
    if (storeBirth.dob) {
      const d = new Date(storeBirth.dob);
      if (!isNaN(d.getTime())) { setDob(d); setDobText(storeBirth.dob); }
    }
    if (storeBirth.tob) {
      const [hh, mm] = storeBirth.tob.split(':').map((s) => parseInt(s, 10));
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        const t = new Date(); t.setHours(hh, mm, 0, 0);
        setTob(t); setTobText(storeBirth.tob);
      }
    }
    if (storeBirth.birth_place) setPlace(storeBirth.birth_place);
    if (storeBirth.birth_lat != null && storeBirth.birth_lon != null) {
      setCoords({ lat: Number(storeBirth.birth_lat), lon: Number(storeBirth.birth_lon) });
    }
    if (storeBirth.phone) setPhone(storeBirth.phone);

    // Snapshot + lock only when the store has COMPLETE data.
    if (isBirthDetailsComplete(storeBirth)) {
      originalRef.current = {
        dob: storeBirth.dob,
        tob: storeBirth.tob,
        birth_lat: Number(storeBirth.birth_lat),
        birth_lon: Number(storeBirth.birth_lon),
      };
      setReadOnly(true);
    }
    hasHydratedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeBirth, storeLoaded, readOnly]);

  // v7.2 — Sidereal ayanamsa preference. Lahiri is the gold-standard
  // default for Indian astrology; advanced users may pick another.
  const [ayanamsa, setAyanamsa] = useState<string>('lahiri');
  const [ayanamsaOptions, setAyanamsaOptions] = useState<Array<{id:string;label:string;description:string}>>([
    { id: 'lahiri', label: 'Lahiri (Chitrapaksha)', description: 'Govt. of India default — recommended' },
  ]);

  useEffect(() => {
    // Hydrate saved preference + fetch full option list.
    (async () => {
      try { const saved = await loadAyanamsaPref(); if (saved) setAyanamsa(saved); } catch {}
    })();
    (async () => {
      try {
        const { data } = await axios.get(`${BACKEND_URL}/api/ayanamsa-options`);
        if (Array.isArray(data?.options) && data.options.length > 0) {
          setAyanamsaOptions(data.options);
        }
      } catch { /* silent */ }
    })();
  }, []);

  // --- Location autocomplete (same backend endpoint the main form uses).
  // v8.4.2 — only fire when the user has ACTIVELY typed (not on
  // programmatic hydrate from LS) and only when the form is editable.
  // Previously the effect popped suggestions on every mount.
  useEffect(() => {
    if (readOnly) { setSuggestions([]); return; }
    if (!userTypedPlaceRef.current) { setSuggestions([]); return; }
    if (place.length < 3) { setSuggestions([]); return; }
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${BACKEND_URL}/api/cities`, { params: { q: place } });
        if (!stale) setSuggestions(data?.results || data?.cities || data || []);
      } catch { /* silent */ }
    }, 260);
    return () => { stale = true; clearTimeout(t); };
  }, [place, readOnly]);

  const pickSuggestion = (s: { name: string; latitude: number; longitude: number }) => {
    setPlace(s.name);
    setCoords({ lat: s.latitude, lon: s.longitude });
    setSuggestions([]);
  };

  const fmtDob = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const fmtTob = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  // --- Submit ---
  // v7.19 — Route through the zustand profile store. The store's save()
  // action writes the birth details to browser localStorage FIRST (PII
  // never leaves the device) and then hits the backend to flip
  // personal_details_complete=true. The previous direct axios.put path
  // skipped the local save entirely, so the form data was wiped on
  // submit and the user got stuck on the Profile screen.
  //
  // v8.4 — DIRTY-FIELD DETECTION: compare the new birth details against
  // what's already on disk. If dob / tob / birth_lat / birth_lon changed,
  // the /api/bootstrap cache is INVALID (it contains a chart that no
  // longer matches), so we clear the bundle cache here — the next mount
  // of useBootstrap will hit the wire and rebuild from scratch. Cosmetic
  // edits (name, phone, gender, marital_status) do NOT clear the bundle.
  const submit = useCallback(async () => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = 'Required';
    if (!lastName.trim())  errs.lastName  = 'Required';
    if (!dob)              errs.dob       = 'Required';
    if (!tob)              errs.tob       = 'Required';
    if (!place.trim())     errs.place     = 'Required';
    // v7.19 — coords are required (chart math needs lat/lon). If the
    // user typed a place but never picked a suggestion, nudge them.
    if (!coords)           errs.place     = 'Pick a city from the suggestions';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const iso_dob = `${dob!.getFullYear()}-${String(dob!.getMonth() + 1).padStart(2, '0')}-${String(dob!.getDate()).padStart(2, '0')}`;
      const iso_tob = fmtTob(tob!);
      const patch = {
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        gender,
        marital_status: marital,
        dob: iso_dob,
        tob: iso_tob,
        birth_place: place.trim(),
        birth_lat: coords!.lat,
        birth_lon: coords!.lon,
        email: authUser?.email || undefined,
        phone: phone.trim() || undefined,
      };

      // v7.19.1 — STEP 1 (always first): persist birth details to the
      // browser. This is the source of truth for returning-user hydration
      // in profileStore.init(). Never let the submit leave this function
      // without a successful local save, else we regress to the bug where
      // the form wiped its own data on submit.
      const storeEmail = (authUser?.email || useProfileStore.getState().profile?.email || '').toLowerCase();
      if (!storeEmail) {
        throw new Error('Missing signed-in email — please re-login and retry.');
      }

      // v8.4 — read the previous local profile so we can diff and decide
      // whether to nuke the /api/bootstrap cache.
      // v8.4.2 — prefer the in-memory snapshot `originalRef` captured on
      // hydrate; falls back to a fresh LS read on first-time save.
      let chartAffected = false;
      try {
        const snap = originalRef.current;
        if (!snap) {
          const { loadLocalProfile: _load } = await import('../utils/localProfile');
          const prev = await _load(storeEmail);
          if (!prev) {
            chartAffected = true; // first save — nothing to diff
          } else {
            chartAffected = (
              prev.dob !== patch.dob ||
              prev.tob !== patch.tob ||
              prev.birth_lat !== patch.birth_lat ||
              prev.birth_lon !== patch.birth_lon
            );
          }
        } else {
          chartAffected = (
            snap.dob !== patch.dob ||
            snap.tob !== patch.tob ||
            snap.birth_lat !== patch.birth_lat ||
            snap.birth_lon !== patch.birth_lon
          );
        }
      } catch { chartAffected = true; /* assume worst case */ }

      try {
        await saveLocalProfile(storeEmail, {
          first_name: patch.first_name, last_name: patch.last_name,
          gender: patch.gender, marital_status: patch.marital_status,
          dob: patch.dob, tob: patch.tob, birth_place: patch.birth_place,
          birth_lat: patch.birth_lat, birth_lon: patch.birth_lon,
          phone: patch.phone,
        });
        // eslint-disable-next-line no-console
        console.log('[PersonalDetailsForm] ✔ saved to localStorage for', storeEmail);
      } catch (lsErr) {
        // eslint-disable-next-line no-console
        console.warn('[PersonalDetailsForm] localStorage save failed', lsErr);
      }

      // v8.4 — If chart-relevant fields changed, invalidate the cached
      // bundle so the next useBootstrap run fetches a fresh chart +
      // transits + muhurtas.
      if (chartAffected) {
        try {
          const { clearBundle } = await import('../utils/bootstrapCache');
          await clearBundle(storeEmail);
          // eslint-disable-next-line no-console
          console.log('[PersonalDetailsForm] 🧹 bootstrap cache cleared — chart fields changed');
        } catch { /* best-effort */ }
        // v8.6.1 — Also wipe the Vidhaata chat cache (Q&A + transcript).
        // Cached answers reference the OLD chart (Lagna, Navamsa,
        // dashas) so they become misleading once DOB/TOB/lat/lon change.
        try {
          const { clearChatCache } = await import('../utils/vidhaataChatCache');
          await clearChatCache(storeEmail);
          // eslint-disable-next-line no-console
          console.log('[PersonalDetailsForm] 🧹 Vidhaata chat cache cleared — chart fields changed');
        } catch { /* best-effort */ }
      }

      // STEP 2: hit the backend via the zustand store to flip
      // personal_details_complete=true. The store also re-saves to
      // localStorage (idempotent) and updates its cached profile.
      const data = await useProfileStore.getState().save(patch);
      if (!data) throw new Error(useProfileStore.getState().error || 'save failed');

      // v8.4.2 — update snapshot + re-lock the form on a successful save.
      originalRef.current = {
        dob: patch.dob,
        tob: patch.tob,
        birth_lat: patch.birth_lat,
        birth_lon: patch.birth_lon,
      };
      setReadOnly(true);

      // v8.4.2 — when a chart-affecting field changed, the parent needs
      // to re-bootstrap. We already cleared the LS bundle above; the
      // alert + onDone callback will prompt the parent's useBootstrap to
      // repaint. The alert is the user-visible "Recalculating your
      // chart…" confirmation the user asked for.
      if (chartAffected) {
        Alert.alert(
          'Birth details updated',
          'Your date, time, or location changed — we are recalculating your chart now. Give us a moment.',
        );
      }

      onDone(data as InitResult);
    } catch (e: any) {
      Alert.alert('Could not save', e?.response?.data?.detail || e?.message || 'Please try again.');
    } finally { setSaving(false); }
  }, [firstName, lastName, gender, marital, dob, tob, place, coords, phone, authUser, onDone]);

  const GenderBtn: React.FC<{ v: Gender; icon: string; label: string }> = ({ v, icon, label }) => (
    <TouchableOpacity
      onPress={() => setGender(v)}
      activeOpacity={0.85}
      style={[s.segBtn, gender === v && s.segBtnActive]}
    >
      <Ionicons name={icon as any} size={16} color={gender === v ? '#FFFFFF' : theme.colors.muted} />
      <Text style={[s.segText, gender === v && s.segTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const MaritalBtn: React.FC<{ v: Marital; label: string }> = ({ v, label }) => (
    <TouchableOpacity
      onPress={() => setMarital(v)}
      activeOpacity={0.85}
      style={[s.chip, marital === v && s.chipActive]}
    >
      <Text style={[s.chipText, marital === v && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: header ? '#F8FAFC' : theme.colors.primary50 }}
      // v6.49 — when embedded inside the Profile page (header === AppHeader),
      // skip the top safe-area inset so the AppHeader bar can sit flush with
      // the top of the screen. Otherwise keep all edges (standard onboarding).
      edges={header ? ['bottom', 'left', 'right'] : undefined}
    >
      {/* v6.48 — optional injected header (AppHeader from Profile page). */}
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
          stickyHeaderIndices={[0]}
        >
          {/* v8.4.3 — STICKY TOP HEADER: user identity + a single toggle
              button that drives the Edit ↔ Save flow. Lives above the
              scroll content, is "sticky" so it stays visible as the
              user scrolls. Only this button can unlock the form — taps
              or double-taps on fields themselves never do. */}
          <View style={{
            backgroundColor: theme.colors.canvas,
            paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
            borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
            flexDirection: 'row', alignItems: 'center', gap: 12,
            zIndex: 10,
          }}>
            <GuruAvatar size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: theme.colors.primary800 }}>
                {firstName || authUser?.name || 'Your profile'} {lastName || ''}
              </Text>
              {authUser?.email ? (
                <Text numberOfLines={1} style={{ fontSize: 11, color: theme.colors.muted, marginTop: 1 }}>
                  {authUser.email}
                </Text>
              ) : null}
            </View>
            {readOnly ? (
              <TouchableOpacity
                onPress={() => {
                  setReadOnly(false);
                  userTypedPlaceRef.current = false;
                }}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: theme.colors.primary700,
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
                }}
              >
                <Ionicons name="create-outline" size={15} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={submit}
                disabled={saving}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: saving ? theme.colors.muted : '#059669',
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                      {originalRef.current ? 'Save' : 'Save & continue'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Hero — hidden when embedded inside the Profile page. */}
          {!hideHero ? (
            <View style={s.hero}>
              <GuruAvatar size={58} glow />
              <Text style={s.title}>Welcome to Vidhaata</Text>
              <Text style={s.subtitle}>
                Tell us a few birth details — Vidhaata needs these to build your chart.
                Your data stays private to your Google account.
              </Text>
            </View>
          ) : null}

          {/* v8.6.3 — "Your birth details are saved" banner MOVED TO THE
              TOP (right under the sticky Edit/Save header) so users see
              the read-only hint the moment they open Profile. Previously
              it was buried at the bottom of the form — invisible until
              they scrolled past every field. */}
          {readOnly ? (
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#FEF3C7',
              borderRadius: 10, padding: 10,
              marginHorizontal: 18, marginTop: 14, marginBottom: 4,
              borderWidth: 1, borderColor: '#FCD34D',
            }}>
              <Ionicons name="lock-closed" size={14} color="#92400E" style={{ marginRight: 8 }} />
              <Text style={{ flex: 1, fontSize: 12.5, color: '#92400E', lineHeight: 17 }}>
                Your birth details are saved on this device. Tap <Text style={{ fontWeight: '800' }}>Edit</Text> in the header above to change them — changing date, time or location will recalculate your chart.
              </Text>
            </View>
          ) : null}

          {/* v8.4.2 — lock all form fields when readOnly. pointerEvents
              blocks taps + opacity gives a visual "saved / locked" cue.
              The Edit button in the sticky header above is the ONLY way
              to unlock the view. Double-clicks / long-presses / focus
              events on fields themselves NEVER unlock. */}
          <View
            pointerEvents={readOnly ? 'none' : 'auto'}
            style={readOnly ? { opacity: 0.78 } : undefined}
          >

          {/* v8.6.3 — breathe between the sticky profile-card header
              above and the first form row. Prior layout had the First
              Name field jammed up against the email address (see user
              screenshot) which looked cramped. */}
          {/* Name */}
          <View style={[s.row2, { marginTop: 14 }]}>
            <Field label="First Name" error={errors.firstName}>
              <TextInput
                value={firstName} onChangeText={setFirstName}
                placeholder="e.g. Rama" placeholderTextColor={theme.colors.faint}
                style={s.input}
              />
            </Field>
            <Field label="Last Name" error={errors.lastName}>
              <TextInput
                value={lastName} onChangeText={setLastName}
                placeholder="e.g. Kumar" placeholderTextColor={theme.colors.faint}
                style={s.input}
              />
            </Field>
          </View>

          {/* Email (read-only) */}
          <Field label="Email (from Google)">
            <View style={[s.input, { backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <Ionicons name="lock-closed" size={13} color={theme.colors.hint} />
              <Text style={{ flex: 1, color: theme.colors.muted, fontSize: 14 }} numberOfLines={1}>
                {authUser?.email || '—'}
              </Text>
            </View>
          </Field>

          {/* Gender */}
          <Field label="Gender">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <GenderBtn v="male"   icon="male"   label="Male" />
              <GenderBtn v="female" icon="female" label="Female" />
            </View>
          </Field>

          {/* Marital */}
          <Field label="Marital Status">
            <View style={s.chipsRow}>
              <MaritalBtn v="single"   label="Single" />
              <MaritalBtn v="married"  label="Married" />
              <MaritalBtn v="divorced" label="Divorced" />
              <MaritalBtn v="widowed"  label="Widowed" />
            </View>
          </Field>

          {/* DOB + TOB — v8.6.2: stacked full-width so each of the 5
              dropdowns (Day · Mon · Year · Hour · Min) gets equal,
              comfortable width instead of being crammed into a 50%
              column that truncated the labels to "2f v Ju: v 19 v". */}
          <Field label="Date of Birth" error={errors.dob}>
            {Platform.OS === 'web' ? (
              <UniversalDateField
                value={
                  dob
                    ? `${dob.getFullYear()}-${String(dob.getMonth()+1).padStart(2,'0')}-${String(dob.getDate()).padStart(2,'0')}`
                    : ''
                }
                onChange={(iso) => {
                  if (!iso) { setDob(null); setDobText(''); return; }
                  const [y, m, d] = iso.split('-').map(Number);
                  if (!y || !m || !d) return;
                  const dt = new Date(y, m - 1, d);
                  setDob(dt); setDobText(fmtDob(dt));
                }}
                maxYear={new Date().getFullYear()}
                minYear={1900}
              />
            ) : (
              <TouchableOpacity
                style={[s.input, s.pickerLike]}
                onPress={() => setShowDobPick(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="calendar" size={14} color={theme.colors.primary700} />
                <Text style={dob ? s.pickerValue : s.pickerPlaceholder}>
                  {dob ? fmtDob(dob) : 'DD/MM/YYYY'}
                </Text>
              </TouchableOpacity>
            )}
          </Field>
          <Field label="Time of Birth" error={errors.tob}>
            {Platform.OS === 'web' ? (
              <UniversalTimeField
                value={
                  tob
                    ? `${String(tob.getHours()).padStart(2,'0')}:${String(tob.getMinutes()).padStart(2,'0')}`
                    : ''
                }
                onChange={(hhmm) => {
                  if (!hhmm) { setTob(null); setTobText(''); return; }
                  const [hh, mm] = hhmm.split(':').map(Number);
                  const dt = new Date(2025, 0, 1, hh, mm);
                  setTob(dt); setTobText(fmtTob(dt));
                }}
              />
            ) : (
              <TouchableOpacity
                style={[s.input, s.pickerLike]}
                onPress={() => setShowTobPick(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="time" size={14} color={theme.colors.primary700} />
                <Text style={tob ? s.pickerValue : s.pickerPlaceholder}>
                  {tob ? fmtTob(tob) : 'HH:MM (24h)'}
                </Text>
              </TouchableOpacity>
            )}
          </Field>
          {showDobPick && Platform.OS !== 'web' ? (
            <DateTimePicker
              value={dob || new Date(1990, 0, 1)}
              mode="date" display="default"
              maximumDate={new Date()}
              onChange={(_, d) => {
                setShowDobPick(Platform.OS === 'ios');
                if (d) { setDob(d); setDobText(fmtDob(d)); }
              }}
            />
          ) : null}
          {showTobPick && Platform.OS !== 'web' ? (
            <DateTimePicker
              value={tob || new Date(2025, 0, 1, 12, 0)}
              mode="time" display="default" is24Hour
              onChange={(_, d) => {
                setShowTobPick(Platform.OS === 'ios');
                if (d) { setTob(d); setTobText(fmtTob(d)); }
              }}
            />
          ) : null}

          {/* Birth place — v7.14.1: no position-relative wrap here because
              it was creating a stacking context that occluded native date
              picker popups (Chrome/Safari render the calendar via the
              input's stacking context). Instead, the suggestion dropdown
              itself carries a z-index and is absolutely positioned. The
              Phone field below gets extra top-padding so there's no
              collision. */}
          <Field label="Birth Place" error={errors.place}>
            <View style={{ position: 'relative', zIndex: 2 }}>
              <TextInput
                value={place}
                onChangeText={(t) => {
                  // v8.4.2 — only mark typed when ACTUAL keystroke happens.
                  // Programmatic setPlace (from LS hydrate) does NOT set
                  // this flag, so autocomplete stays silent on mount.
                  userTypedPlaceRef.current = true;
                  setPlace(t);
                  if (coords) setCoords(null);
                }}
                editable={!readOnly}
                placeholder="Start typing city…" placeholderTextColor={theme.colors.faint}
                style={[s.input, readOnly && { opacity: 0.65 }]}
              />
              {suggestions.length > 0 ? (
                <View style={s.suggestions} pointerEvents="auto">
                  {suggestions.slice(0, 5).map((sg, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => pickSuggestion(sg)}
                      style={[s.suggestionItem, i === Math.min(4, suggestions.length - 1) && { borderBottomWidth: 0 }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="location-sharp" size={13} color={theme.colors.saffron600} />
                      <Text style={s.suggestionText} numberOfLines={1}>{sg.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
            {coords ? (
              // v8.4.1 — render as a self-contained pill with explicit block
              // layout + breathing room below. Previously the floating text
              // collided with the PHONE label because the parent relative
              // container was shrinking to the input's height.
              <View style={{
                marginTop: 8, marginBottom: 4,
                paddingHorizontal: 10, paddingVertical: 6,
                alignSelf: 'flex-start',
                backgroundColor: '#ECFDF5',
                borderRadius: 8,
                borderWidth: 1, borderColor: '#A7F3D0',
              }}>
                <Text style={{ fontSize: 11, color: '#047857', fontWeight: '700' }}>
                  ✓ Coordinates locked · {coords.lat.toFixed(3)}°, {coords.lon.toFixed(3)}°
                </Text>
              </View>
            ) : null}
          </Field>

          {/* Phone — v7.14.1: 14px spacer keeps dropdown from visually
              colliding with this field's label. */}
          <View style={{ height: 14 }} />
          <Field label="Phone (optional)">
            <TextInput
              value={phone} onChangeText={setPhone}
              placeholder="+91 …" placeholderTextColor={theme.colors.faint}
              keyboardType="phone-pad"
              style={s.input}
            />
          </Field>

          {/* v7.2 — Ayanamsa (sidereal zero-point). Lahiri is the
              gold-standard Indian default. Horizontal chips let the user
              scroll through the others. */}
          <Field label="Ayanamsa (Sidereal System)">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.ayanamsaRow}>
              {ayanamsaOptions.map((opt) => {
                const active = ayanamsa === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => { setAyanamsa(opt.id); saveAyanamsaPref(opt.id).catch(() => {}); }}
                    activeOpacity={0.85}
                    style={[s.ayaChip, active && s.ayaChipActive]}
                  >
                    <Text style={[s.ayaChipText, active && s.ayaChipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={s.ayaHint} numberOfLines={2}>
              {ayanamsaOptions.find(o => o.id === ayanamsa)?.description || 'Lahiri is the default used across India. Change only if your astrologer prefers another system.'}
            </Text>
          </Field>

          {/* v6.48 — extra content injected by Profile page (Access + Coupon). */}
          </View>
          {footerExtras}

          {/* v8.4.3 — bottom Edit/Save buttons REMOVED. The sticky
              top header owns the toggle. Birth-details lock banner
              still lives here so the user sees the status inline. */}
          {/* v8.6.3 — this banner was MOVED to the top of the form
              (right under the sticky Edit/Save header) so it's visible
              without scrolling. The bottom placement is redundant and
              has been removed. */}

          {onLogout && !hideHero ? (
            <TouchableOpacity onPress={onLogout} style={{ alignSelf: 'center', marginTop: 14, paddingVertical: 8 }}>
              <Text style={{ color: theme.colors.hint, fontSize: 12.5 }}>Sign out</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={s.legal}>
            All fields are stored encrypted against your Google account. You can edit them anytime from Profile.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Field: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
  <View style={{ marginBottom: 12, flex: 1 }}>
    <Text style={s.label}>{label}</Text>
    {children}
    {error ? <Text style={s.errorText}>{error}</Text> : null}
  </View>
);

export default PersonalDetailsForm;

const s = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 50 },
  hero: { alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 22, fontWeight: '800', color: theme.cosmic.goldHi, marginTop: 10 },
  subtitle: {
    fontSize: 13, color: theme.colors.muted, textAlign: 'center',
    lineHeight: 19, marginTop: 6, paddingHorizontal: 8,
  },
  row2: { flexDirection: 'row', gap: 10 },

  label: {
    fontSize: 12, fontWeight: '700', color: theme.colors.muted,
    letterSpacing: 0.2, marginBottom: 5, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: theme.colors.canvas,
    borderRadius: theme.radii.md, paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: 1, borderColor: theme.colors.divider,
    fontSize: 14, color: theme.colors.ink,
  },
  pickerLike: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerValue: { fontSize: 14, color: theme.colors.ink, fontWeight: '600' },
  pickerPlaceholder: { fontSize: 14, color: theme.colors.faint },

  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: theme.radii.md,
    backgroundColor: theme.colors.canvas, borderWidth: 1, borderColor: theme.colors.divider,
  },
  segBtnActive: { backgroundColor: theme.colors.primary700, borderColor: theme.colors.primary700 },
  segText: { fontSize: 13, fontWeight: '700', color: theme.colors.muted },
  segTextActive: { color: '#FFFFFF' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.canvas, borderWidth: 1, borderColor: theme.colors.divider,
  },
  chipActive: {
    backgroundColor: theme.colors.saffron100, borderColor: theme.colors.saffron400,
  },
  chipText: { fontSize: 12.5, fontWeight: '700', color: theme.colors.muted },
  chipTextActive: { color: theme.colors.saffron700 },

  suggestions: {
    // v6.49 — absolute-positioned so the dropdown floats ABOVE the next
    // field (previously it was inline and collided with the Phone field
    // label — see user screenshot).
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: theme.radii.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: theme.colors.primary100,
    overflow: 'hidden',
    shadowColor: theme.colors.primary900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 8,
    zIndex: 999,
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: theme.colors.divider,
  },
  suggestionText: { fontSize: 13.5, color: theme.colors.body, flex: 1, fontWeight: '500' },

  submitBtn: {
    marginTop: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.primary700, paddingVertical: 14,
    borderRadius: theme.radii.lg,
    shadowColor: theme.colors.primary900, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },

  errorText: { color: theme.colors.danger, fontSize: 11.5, marginTop: 3, fontWeight: '600' },
  legal: {
    marginTop: 18, fontSize: 11, color: theme.colors.hint, textAlign: 'center',
    lineHeight: 15, paddingHorizontal: 16,
  },

  // v7.2 — Ayanamsa chips
  // v7.14 — Added minHeight + lineHeight + alignSelf:center so each chip
  // is self-sized vertically, NOT stretched by the horizontal ScrollView's
  // implicit alignItems:stretch (which was making pills render as tall bars
  // with the text sitting at the bottom — see user screenshot).
  ayanamsaRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingRight: 4, paddingVertical: 4,
  },
  ayaChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.canvas, borderWidth: 1, borderColor: theme.colors.divider,
    height: 34, justifyContent: 'center', alignSelf: 'center',
  },
  ayaChipActive: { backgroundColor: theme.colors.primary700, borderColor: theme.colors.primary700 },
  ayaChipText: {
    fontSize: 12.5, fontWeight: '700', color: theme.colors.muted,
    lineHeight: 16, includeFontPadding: false as any,
  },
  ayaChipTextActive: { color: '#FFFFFF' },
  ayaHint: {
    fontSize: 11, color: theme.colors.hint, marginTop: 6, marginLeft: 2,
    fontStyle: 'italic', lineHeight: 15,
  },
});
