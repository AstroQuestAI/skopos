/**
 * CosmicPersonalDetailsForm — minimal, glass-themed onboarding.
 *
 * v9.5 — replaces the legacy 9-field PersonalDetailsForm in the cosmic
 * flow. We only ASK for the bare minimum needed to compute a chart:
 *
 *   ✱ Display name      (required — fancy aliases encouraged)
 *   ✱ Date of birth     (required)
 *     Time of birth     (optional — sunrise + Moon-Lagna fallback)
 *   ✱ Birth place       (required, geocoded)
 *
 * Optional fold-out section ("More details — optional") for users who
 * want richer classical predictions:
 *     • Email · Phone · Gender · Marital status
 *
 * When TOB is empty we expose a small "Lagna fallback" toggle:
 *   ◯ Use sunrise of that day as Lagna     (default — accurate transit feel)
 *   ◯ Use the Moon's sign as Lagna         (classical Chandra-Lagna)
 *
 * The submit flow re-uses the existing infrastructure:
 *   • saveLocalProfile()        — privacy-first browser storage
 *   • clearBundle() + chat cache invalidate when chart-affecting fields change
 *   • useProfileStore.save()    — flips personal_details_complete=true
 *
 * The user can re-open this form from the Profile page (Edit), so the
 * submitLabel + initial props mirror the old form's API.
 */
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Pressable,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import type { InitResult } from '../utils/profile';
import { saveLocalProfile } from '../utils/localProfile';
import { useProfileStore } from '../state/profileStore';
import { BACKEND_URL } from '../utils/backendUrl';

const C = theme.cosmic;
const isWeb = Platform.OS === 'web';

interface Initial {
  first_name?: string;
  last_name?: string;
  gender?: 'male' | 'female' | 'unspecified';
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed' | 'unspecified';
  dob?: string;              // ISO yyyy-mm-dd
  tob?: string;              // HH:mm
  birth_place?: string;
  birth_lat?: number | null;
  birth_lon?: number | null;
  phone?: string;
  lagna_source?: 'asc' | 'sunrise' | 'moon';
}

interface Props {
  authUser: { name?: string; email?: string };
  onDone: (res: InitResult) => void;
  onCancel?: () => void;
  onLogout?: () => void;
  initial?: Initial | null;
  submitLabel?: string;
  /** When true the screen renders without the welcome hero — used when
   *  the form is reopened from the Profile page (an "Edit" flow rather
   *  than first-time onboarding). */
  hideHero?: boolean;
}

type CitySuggestion = { name: string; latitude: number; longitude: number };

export const CosmicPersonalDetailsForm: React.FC<Props> = ({
  authUser, onDone, onCancel, onLogout, initial, submitLabel, hideHero,
}) => {
  // ─── Form state ──────────────────────────────────────────────────────
  const initialDisplayName = (
    initial?.first_name ||
    (authUser?.name?.trim().split(/\s+/)?.[0]) ||
    ''
  );

  const [displayName, setDisplayName] = useState(initialDisplayName);

  const [dob, setDob] = useState(initial?.dob || '');           // YYYY-MM-DD
  const [tob, setTob] = useState(initial?.tob || '');           // HH:mm or empty

  const [place, setPlace] = useState(initial?.birth_place || '');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    initial?.birth_lat != null && initial?.birth_lon != null
      ? { lat: Number(initial.birth_lat), lon: Number(initial.birth_lon) }
      : null
  );

  const [moreOpen, setMoreOpen] = useState(false);
  const [email, setEmail] = useState(authUser?.email || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [gender, setGender] = useState<'male' | 'female' | 'unspecified'>(initial?.gender || 'unspecified');
  const [marital, setMarital] = useState<'single' | 'married' | 'divorced' | 'widowed' | 'unspecified'>(
    initial?.marital_status || 'unspecified'
  );

  const [lagnaSource, setLagnaSource] = useState<'sunrise' | 'moon'>(
    initial?.lagna_source === 'moon' ? 'moon' : 'sunrise'
  );

  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const userTypedPlace = useRef(false);

  // City autocomplete (debounced)
  useEffect(() => {
    if (!userTypedPlace.current) return;
    if (place.trim().length < 2) {
      setSuggestions([]); setShowSuggest(false); return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${BACKEND_URL}/api/cities`, { params: { q: place.trim() } });
        setSuggestions(data?.cities || []);
        setShowSuggest(true);
      } catch { /* silent */ }
    }, 250);
    return () => clearTimeout(t);
  }, [place]);

  const pickCity = (c: CitySuggestion) => {
    setPlace(c.name);
    setCoords({ lat: c.latitude, lon: c.longitude });
    setSuggestions([]); setShowSuggest(false);
    userTypedPlace.current = false;
  };

  // ─── Date / time validation helpers ──────────────────────────────────
  const validateDob = (s: string): { ok: boolean; iso?: string; error?: string } => {
    const t = s.trim();
    if (!t) return { ok: false, error: 'Date of birth is required.' };
    // Accept YYYY-MM-DD or DD/MM/YYYY
    let y = 0, m = 0, d = 0;
    let mIso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let mDmy = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (mIso) { y = +mIso[1]; m = +mIso[2]; d = +mIso[3]; }
    else if (mDmy) { d = +mDmy[1]; m = +mDmy[2]; y = +mDmy[3]; }
    else return { ok: false, error: 'Use DD/MM/YYYY format.' };
    if (m < 1 || m > 12) return { ok: false, error: 'Month must be 01–12.' };
    if (d < 1 || d > 31) return { ok: false, error: 'Day must be 01–31.' };
    if (y < 1800 || y > 2100) return { ok: false, error: 'Year must be 1800–2100.' };
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
      return { ok: false, error: 'That date does not exist on the calendar.' };
    }
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { ok: true, iso };
  };

  const validateTob = (s: string): { ok: boolean; norm?: string; error?: string } => {
    const t = s.trim();
    if (!t) return { ok: true, norm: '' };       // optional
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return { ok: false, error: 'Use HH:MM (24h).' };
    const hh = +m[1], mi = +m[2];
    if (hh < 0 || hh > 23) return { ok: false, error: 'Hour must be 00–23.' };
    if (mi < 0 || mi > 59) return { ok: false, error: 'Minute must be 00–59.' };
    return { ok: true, norm: `${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}` };
  };

  // ─── Submit ──────────────────────────────────────────────────────────
  const onSubmit = useCallback(async () => {
    setErrors({});
    const errs: Record<string, string> = {};
    if (!displayName.trim()) errs.displayName = 'Required';
    const vDob = validateDob(dob);
    if (!vDob.ok) errs.dob = vDob.error || 'Invalid';
    const vTob = validateTob(tob);
    if (!vTob.ok) errs.tob = vTob.error || 'Invalid';
    if (!place.trim()) errs.place = 'Required';
    if (!coords) errs.place = 'Pick a city from the suggestions';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const isoDob = vDob.iso!;
      const isoTob = vTob.norm || '';
      const fancyName = displayName.trim();
      const splitParts = fancyName.split(/\s+/);
      const firstName = splitParts[0] || fancyName;
      const lastName = splitParts.slice(1).join(' ') || '';

      const patch: any = {
        first_name: firstName,
        last_name: lastName,
        gender: gender,
        marital_status: marital,
        dob: isoDob,
        tob: isoTob,
        birth_place: place.trim(),
        birth_lat: coords!.lat,
        birth_lon: coords!.lon,
        email: email?.trim() || authUser?.email || undefined,
        phone: phone?.trim() || undefined,
        lagna_source: isoTob ? 'asc' : lagnaSource,
      };

      const storeEmail = (
        authUser?.email ||
        useProfileStore.getState().profile?.email ||
        ''
      ).toLowerCase();
      if (!storeEmail) {
        throw new Error('Missing signed-in email — please re-login and retry.');
      }

      // 1) Save birth-details to localStorage (privacy-first source of truth)
      try {
        await saveLocalProfile(storeEmail, {
          first_name: patch.first_name,
          last_name:  patch.last_name,
          gender:     patch.gender,
          marital_status: patch.marital_status,
          dob:        patch.dob,
          tob:        patch.tob,
          birth_place:patch.birth_place,
          birth_lat:  patch.birth_lat,
          birth_lon:  patch.birth_lon,
          phone:      patch.phone,
        } as any);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[CosmicPersonalDetailsForm] localStorage save failed', e);
      }

      // 2) Bust caches so a fresh chart is computed
      try {
        const { clearBundle } = await import('../utils/bootstrapCache');
        await clearBundle(storeEmail);
      } catch {}
      try {
        const { clearChatCache } = await import('../utils/vidhaataChatCache');
        await clearChatCache(storeEmail);
      } catch {}

      // 3) PUT /profile/personal — flips personal_details_complete=true
      const data = await useProfileStore.getState().save(patch);
      if (!data) throw new Error(useProfileStore.getState().error || 'Save failed');
      onDone(data as InitResult);
    } catch (e: any) {
      Alert.alert('Could not save', e?.response?.data?.detail || e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [displayName, dob, tob, place, coords, gender, marital, phone, email, lagnaSource, authUser, onDone]);

  // ─── UI ──────────────────────────────────────────────────────────────
  const tobEmpty = !tob.trim();

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          {!hideHero ? (
            <View style={s.hero}>
              <Text style={s.kicker}>VIDHAATA</Text>
              <Text style={s.heroTitle}>Tell us a little about you</Text>
              <Text style={s.heroSub}>
                Just a name, a date, a place — and we’ll cast your chart.
                Your data lives on this device only.
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              <Text style={s.kicker}>EDIT</Text>
              <Text style={s.heroTitle}>Birth details</Text>
            </View>
          )}

          {/* Display name */}
          <Field
            label="Your name"
            hint="A nickname or pen-name is best — we discourage real / legal names."
            error={errors.displayName}
          >
            <TextInput
              style={[s.input, isWeb && (s.inputWeb as any)]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. crazyLambo, MoonChild, Aarya"
              placeholderTextColor={C.cream45}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </Field>

          {/* DOB */}
          <Field
            label="Date of birth"
            hint="DD/MM/YYYY"
            error={errors.dob}
          >
            <TextInput
              style={[s.input, isWeb && (s.inputWeb as any)]}
              value={dob}
              onChangeText={setDob}
              placeholder="22/08/1980"
              placeholderTextColor={C.cream45}
              keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
              autoCorrect={false}
            />
          </Field>

          {/* TOB */}
          <Field
            label="Time of birth"
            optional
            hint={tobEmpty
              ? "If unknown, we’ll use sunrise that day at your birth place."
              : "HH:MM (24-hour)"}
            error={errors.tob}
          >
            <TextInput
              style={[s.input, isWeb && (s.inputWeb as any)]}
              value={tob}
              onChangeText={setTob}
              placeholder="14:30  (leave empty if unknown)"
              placeholderTextColor={C.cream45}
              keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
              autoCorrect={false}
            />

            {/* Lagna fallback toggle — visible only when TOB is empty */}
            {tobEmpty ? (
              <View style={s.lagnaBox}>
                <Text style={s.lagnaTitle}>Lagna fallback</Text>
                <Text style={s.lagnaHint}>
                  Without an exact time we estimate the rising sign. Pick the tradition you prefer:
                </Text>
                <View style={s.segRow}>
                  {([
                    { id: 'sunrise', label: 'Sunrise · Lagna', sub: 'Modern default' },
                    { id: 'moon',    label: 'Moon · Chandra-Lagna', sub: 'Classical fallback' },
                  ] as const).map(opt => {
                    const active = lagnaSource === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => setLagnaSource(opt.id)}
                        style={({ pressed }) => [
                          s.lagnaOpt, active && s.lagnaOptActive, pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={[s.lagnaOptTitle, active && s.lagnaOptTitleActive]}>{opt.label}</Text>
                        <Text style={[s.lagnaOptSub, active && s.lagnaOptSubActive]}>{opt.sub}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </Field>

          {/* Place + autocomplete */}
          <Field
            label="Birth place"
            hint="City + country. Pick from suggestions so we can geocode it."
            error={errors.place}
          >
            <TextInput
              style={[s.input, isWeb && (s.inputWeb as any)]}
              value={place}
              onChangeText={(t) => { userTypedPlace.current = true; setPlace(t); setCoords(null); }}
              placeholder="Hyderabad, India"
              placeholderTextColor={C.cream45}
              autoCorrect={false}
            />
            {showSuggest && suggestions.length > 0 ? (
              <View style={s.suggestWrap}>
                {suggestions.slice(0, 6).map((c, i) => (
                  <Pressable
                    key={`${c.name}-${i}`}
                    onPress={() => pickCity(c)}
                    style={({ pressed }) => [s.suggestRow, pressed && { opacity: 0.85 }]}
                  >
                    <Ionicons name="location" size={14} color={C.goldHi} />
                    <Text style={s.suggestText} numberOfLines={1}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {coords ? (
              <Text style={s.coordsBadge}>
                ✓ {coords.lat.toFixed(3)}, {coords.lon.toFixed(3)}
              </Text>
            ) : null}
          </Field>

          {/* Optional fold-out */}
          <Pressable
            onPress={() => setMoreOpen(v => !v)}
            style={({ pressed }) => [s.moreToggle, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name={moreOpen ? 'chevron-down' : 'chevron-forward'} size={16} color={C.goldHi} />
            <Text style={s.moreToggleText}>
              {moreOpen ? 'Hide' : 'More details'} · optional
            </Text>
            <Text style={s.moreToggleHint}>
              {moreOpen ? '' : 'sometimes used in classical predictions'}
            </Text>
          </Pressable>

          {moreOpen ? (
            <View style={[s.card, isWeb && (s.cardWeb as any)]}>
              <Field label="Email" optional>
                <TextInput
                  style={[s.input, isWeb && (s.inputWeb as any), { opacity: authUser?.email ? 0.65 : 1 }]}
                  value={email}
                  onChangeText={setEmail}
                  editable={!authUser?.email}
                  placeholder="you@domain.com"
                  placeholderTextColor={C.cream45}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Field>

              <Field label="Phone" optional>
                <TextInput
                  style={[s.input, isWeb && (s.inputWeb as any)]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+91 …"
                  placeholderTextColor={C.cream45}
                  keyboardType="phone-pad"
                />
              </Field>

              <Field label="Gender" optional>
                <View style={s.segRow}>
                  {(['male', 'female', 'unspecified'] as const).map(g => {
                    const active = gender === g;
                    return (
                      <Pressable key={g}
                        onPress={() => setGender(g)}
                        style={({ pressed }) => [s.seg, active && s.segActive, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={[s.segText, active && s.segTextActive]}>
                          {g === 'unspecified' ? 'Prefer not to say' : g[0].toUpperCase() + g.slice(1)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="Marital status" optional>
                <View style={s.chipsWrap}>
                  {(['single', 'married', 'divorced', 'widowed', 'unspecified'] as const).map(m => {
                    const active = marital === m;
                    return (
                      <Pressable key={m}
                        onPress={() => setMarital(m)}
                        style={({ pressed }) => [s.chip, active && s.chipActive, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>
                          {m === 'unspecified' ? 'Prefer not to say' : m[0].toUpperCase() + m.slice(1)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
            </View>
          ) : null}

          {/* CTAs */}
          <Pressable
            onPress={onSubmit}
            disabled={saving}
            style={({ pressed }) => [s.cta, saving && { opacity: 0.65 }, pressed && { opacity: 0.85 }]}
          >
            {saving
              ? <ActivityIndicator color={C.bgDeep} size="small" />
              : <Text style={s.ctaText}>{submitLabel || 'Cast my chart'}</Text>}
          </Pressable>

          {onCancel ? (
            <Pressable onPress={onCancel} style={({ pressed }) => [s.cancel, pressed && { opacity: 0.85 }]}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
          ) : null}

          {onLogout ? (
            <Pressable onPress={onLogout} style={({ pressed }) => [s.logout, pressed && { opacity: 0.85 }]}>
              <Ionicons name="log-out-outline" size={16} color={C.terracottaLight} />
              <Text style={s.logoutText}>Sign out</Text>
            </Pressable>
          ) : null}

          <Text style={s.footer}>
            Vidhaata  ·  birth details stay on this device
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ──────────────────────────────────────────────────────────────────────
// Field wrapper — renders label / hint / error consistently
const Field: React.FC<{
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}> = ({ label, hint, error, optional, children }) => (
  <View style={s.field}>
    <View style={s.fieldHead}>
      <Text style={s.fieldLabel}>{label}</Text>
      {optional ? <Text style={s.fieldOptional}>optional</Text> : null}
    </View>
    {children}
    {error ? <Text style={s.fieldError}>{error}</Text>
           : hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
  </View>
);

// ──────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgDeep },
  scroll: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 80 },

  hero: { marginTop: 8, marginBottom: 14 },
  kicker: { color: C.cream45, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  heroTitle: { color: C.cream, fontSize: 30, fontWeight: '800', letterSpacing: -0.4, marginTop: 4 },
  heroSub: { color: C.cream65, fontSize: 13, lineHeight: 19, marginTop: 8, maxWidth: 480 },

  field: { marginTop: 18 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  fieldLabel: { color: C.cream80, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  fieldOptional: { color: C.cream45, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, fontStyle: 'italic' },
  fieldHint: { color: C.cream45, fontSize: 11, marginTop: 6, lineHeight: 15 },
  fieldError: { color: C.terracottaLight, fontSize: 11, marginTop: 6, fontWeight: '700' },

  input: {
    height: 48, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: 'rgba(15,8,32,0.55)',
    borderWidth: 1, borderColor: C.cream20,
    color: C.cream, fontSize: 15, fontWeight: '600',
  },
  inputWeb: { outlineStyle: 'none', outlineWidth: 0 } as any,

  // Suggestion list
  suggestWrap: {
    marginTop: 6, borderRadius: 12, overflow: 'hidden',
    backgroundColor: C.glassStrong, borderWidth: 1, borderColor: C.cream20,
  },
  suggestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.cream10,
  },
  suggestText: { color: C.cream, fontSize: 14, flex: 1 },
  coordsBadge: { color: C.okFg, fontSize: 11, fontWeight: '700', marginTop: 6 },

  // Lagna fallback
  lagnaBox: {
    marginTop: 12, padding: 14, borderRadius: 14,
    backgroundColor: C.glassSoft, borderWidth: 1, borderColor: C.goldLine,
  },
  lagnaTitle: { color: C.goldHi, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  lagnaHint: { color: C.cream65, fontSize: 12, lineHeight: 17, marginTop: 6, marginBottom: 10 },
  lagnaOpt: {
    flex: 1, padding: 12, borderRadius: 10,
    backgroundColor: C.cream10, borderWidth: 1, borderColor: C.cream20,
  },
  lagnaOptActive: { backgroundColor: 'rgba(232,201,106,0.18)', borderColor: C.goldLine },
  lagnaOptTitle: { color: C.cream, fontSize: 13, fontWeight: '800' },
  lagnaOptTitleActive: { color: C.goldHi },
  lagnaOptSub: { color: C.cream45, fontSize: 11, marginTop: 3 },
  lagnaOptSubActive: { color: C.cream80 },

  // Segments / chips
  segRow: { flexDirection: 'row', gap: 8 },
  seg: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', backgroundColor: C.cream10,
    borderWidth: 1, borderColor: C.cream20,
  },
  segActive: { backgroundColor: 'rgba(232,201,106,0.18)', borderColor: C.goldLine },
  segText: { color: C.cream80, fontSize: 12, fontWeight: '700' },
  segTextActive: { color: C.goldHi },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: C.cream10, borderWidth: 1, borderColor: C.cream20,
  },
  chipActive: { backgroundColor: 'rgba(232,201,106,0.18)', borderColor: C.goldLine },
  chipText: { color: C.cream80, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: C.goldHi },

  // Optional fold-out
  moreToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 22, paddingVertical: 10,
  },
  moreToggleText: { color: C.goldHi, fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  moreToggleHint: { color: C.cream45, fontSize: 11, marginLeft: 4 },

  card: {
    marginTop: 4, padding: 14, borderRadius: 16,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.cream10,
  },
  cardWeb: {
    backdropFilter: 'blur(28px) saturate(160%)',
    WebkitBackdropFilter: 'blur(28px) saturate(160%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 28px rgba(0,0,0,0.20)',
  } as any,

  // CTAs
  cta: {
    marginTop: 28, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.goldHi,
  },
  ctaText: { color: C.bgDeep, fontSize: 15, fontWeight: '800', letterSpacing: 0.6 },

  cancel: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: C.cream65, fontSize: 13, fontWeight: '700' },

  logout: {
    marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(224,122,69,0.40)',
    backgroundColor: 'rgba(196,98,45,0.10)',
  },
  logoutText: { color: C.terracottaLight, fontSize: 13, fontWeight: '800' },

  footer: { color: C.cream45, fontSize: 11, textAlign: 'center', marginTop: 22 },
});

export default CosmicPersonalDetailsForm;
