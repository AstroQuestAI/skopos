/**
 * CosmicOnboardingFlow — first-time onboarding flow.
 *
 * Multi-step wheel-driven UX (matches the user's reference SS1 + SS2):
 *
 *   ●●●●○        ← progress dots
 *   ─────────────
 *   What should we call you?
 *   [ TextInput                 ]
 *   "A nickname or pen-name…"
 *
 *                      ↓
 *
 *   When were you born?
 *   ┌───────────────────────────┐
 *   │  March    11   1991       │
 *   │  April    12   1992       │
 *   │ ╭ June    15   1995 ╮     │   ← center, gold-tinted
 *   │  July     16   1996       │
 *   │  August   17   1997       │
 *   └───────────────────────────┘
 *
 *                      ↓
 *
 *   What time were you born?
 *   ┌──────────────┐
 *   │ HH    MM     │
 *   │ ╭ 14 : 30 ╮ │
 *   └──────────────┘
 *   "I don't know my birth time"  →
 *      ◯ Moon · Chandra-Lagna  (default)
 *      ◯ Sunrise · Lagna
 *
 *                      ↓
 *
 *   Where were you born?
 *   [ City autocomplete           ]
 *   ✓ Hyderabad, India · 17.385, 78.487
 *
 *                      ↓
 *
 *   "Welcome, AstroQuest"
 *   Your cosmic blueprint is ready.
 *
 *   ⊙  Sun Sign        Simha       ♌
 *   ⊕  Lagna           Dhanu       ♐
 *   ☾  Rasi            Vrishchika  ♏
 *   ✦  Nakshatra       Anuradha
 *   ¹  Pada            3
 *
 *   [  Begin My Cosmic Journey ✦  ]
 *
 * The flow saves to localStorage + flips personal_details_complete=true
 * before the reveal screen mounts (so the cosmic Home is fully ready
 * when the user taps the final CTA).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, Platform, Pressable,
  ActivityIndicator, Alert, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { BACKEND_URL } from '../utils/backendUrl';
import { saveLocalProfile } from '../utils/localProfile';
import { useProfileStore } from '../state/profileStore';
import type { InitResult } from '../utils/profile';
import { WheelPicker } from './WheelPicker';

const C = theme.cosmic;
const isWeb = Platform.OS === 'web';
const STEPS = ['name', 'dob', 'tob', 'place', 'reveal'] as const;
type Step = typeof STEPS[number];

// ── Zodiac glyph map (Sanskrit names → Unicode glyph) ──────────
const ZODIAC_GLYPH: Record<string, string> = {
  Mesha: '♈', Vrishabha: '♉', Mithuna: '♊', Karka: '♋',
  Simha: '♌', Kanya: '♍', Tula: '♎', Vrishchika: '♏',
  Dhanu: '♐', Makara: '♑', Kumbha: '♒', Meena: '♓',
};

interface Props {
  authUser: { name?: string; email?: string };
  onDone: (res: InitResult) => void;
  onLogout?: () => void;
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export const CosmicOnboardingFlow: React.FC<Props> = ({ authUser, onDone, onLogout }) => {
  // ── Form state ───────────────────────────────────────────────
  const initialName = (authUser?.name?.trim().split(/\s+/)?.[0]) || '';
  const [name, setName]   = useState(initialName);
  const [month, setMonth] = useState<string>('June');
  const [day, setDay]     = useState<number>(15);
  const [year, setYear]   = useState<number>(1995);

  const [tobUnknown, setTobUnknown] = useState(false);
  const [hour, setHour]   = useState<number>(12);
  const [minute, setMinute] = useState<number>(30);
  const [lagnaSource, setLagnaSource] = useState<'moon' | 'sunrise'>('moon');

  const [place, setPlace] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [suggestions, setSuggestions] = useState<{ name: string; latitude: number; longitude: number }[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const userTypedPlace = useRef(false);

  const [step, setStep] = useState<Step>('name');
  const [submitting, setSubmitting] = useState(false);
  const [revealResult, setRevealResult] = useState<any | null>(null);

  // ── Day options depend on month/year ─────────────────────────
  const days = useMemo(() => {
    const mIdx = MONTHS.indexOf(month);
    const last = new Date(year, mIdx + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) => i + 1);
  }, [month, year]);

  // Clamp day if it overflows after month/year change.
  useEffect(() => {
    if (day > days.length) setDay(days.length);
  }, [days, day]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: now - 1900 + 1 }, (_, i) => 1900 + i).reverse();
  }, []);

  const hours   = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  // ── City autocomplete (debounced) ────────────────────────────
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

  const pickCity = (c: { name: string; latitude: number; longitude: number }) => {
    setPlace(c.name);
    setCoords({ lat: c.latitude, lon: c.longitude });
    setSuggestions([]); setShowSuggest(false);
    userTypedPlace.current = false;
  };

  // ── Step navigation ──────────────────────────────────────────
  const stepIdx = STEPS.indexOf(step);
  const canAdvance = (() => {
    switch (step) {
      case 'name':  return name.trim().length >= 1;
      case 'dob':   return true;
      case 'tob':   return true;
      case 'place': return !!coords;
      case 'reveal':return false;
      default: return false;
    }
  })();
  const next = async () => {
    if (step === 'place') return submit();
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };
  const prev = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  };

  // ── Submit (called when user finishes step 4) ────────────────
  const submit = async () => {
    if (!coords) return;
    setSubmitting(true);
    try {
      const dob = `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const tob = tobUnknown ? '' : `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const lagna_source = tobUnknown ? lagnaSource : 'asc';

      const fancyName = name.trim();
      const splitParts = fancyName.split(/\s+/);
      const firstName = splitParts[0] || fancyName;
      const lastName  = splitParts.slice(1).join(' ') || '';

      const storeEmail = (authUser?.email || useProfileStore.getState().profile?.email || '').toLowerCase();
      if (!storeEmail) throw new Error('Missing signed-in email — please re-login.');

      // 1) Save to localStorage (privacy-first)
      try {
        await saveLocalProfile(storeEmail, {
          first_name: firstName, last_name: lastName,
          gender: 'unspecified' as any,
          marital_status: 'unspecified' as any,
          dob, tob,
          birth_place: place.trim(),
          birth_lat: coords.lat, birth_lon: coords.lon,
          phone: '',
          lagna_source,
        } as any);
      } catch { /* non-blocking */ }

      // 2) Bust caches
      try { const { clearBundle } = await import('../utils/bootstrapCache'); await clearBundle(storeEmail); } catch {}

      // 3) PUT /profile/personal — flips personal_details_complete=true
      const data = await useProfileStore.getState().save({
        first_name: firstName, last_name: lastName,
        gender: 'unspecified', marital_status: 'unspecified',
        dob, tob,
        birth_place: place.trim(),
        birth_lat: coords.lat, birth_lon: coords.lon,
        email: authUser?.email,
        lagna_source,
      } as any);
      if (!data) throw new Error(useProfileStore.getState().error || 'Save failed');

      // 4) Compute the chart NOW so the reveal screen is ready.
      try {
        const resp = await axios.post(`${BACKEND_URL}/api/calculate-chart`, {
          date: dob, time: tob, location: place.trim(),
          latitude: coords.lat, longitude: coords.lon,
          timezone_offset: 5.5, language: 'en', ayanamsa: 'lahiri',
          lagna_source,
        });
        setRevealResult(resp.data);
      } catch {
        setRevealResult({}); // graceful fallback — reveal page will show "—"
      }

      setStep('reveal');
      // Hand off to the parent so the cosmic shell gets the new profile/access
      // — but DO NOT call onDone yet. The user still needs to tap "Begin My
      // Cosmic Journey" to finish onboarding. We pass the parent the data
      // when they tap that final CTA.
      (revealHandoffRef as any).current = data;
    } catch (e: any) {
      Alert.alert('Could not save', e?.response?.data?.detail || e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const revealHandoffRef = useRef<InitResult | null>(null);

  // ── Render ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Progress dots */}
        <View style={s.dots}>
          {STEPS.map((id, i) => (
            <View key={id} style={[s.dot, i === stepIdx && s.dotActive]} />
          ))}
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'name' && (
            <Step
              icon="person-circle-outline"
              title="What should we call you?"
              subtitle="A nickname or pen-name is best — we discourage real or legal names."
            >
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. crazyLambo, MoonChild, Aarya"
                placeholderTextColor={C.cream45}
                autoCapitalize="words"
                autoCorrect={false}
                style={[s.input, isWeb && (s.inputWeb as any)]}
                onSubmitEditing={() => canAdvance && next()}
                returnKeyType="next"
              />
            </Step>
          )}

          {step === 'dob' && (
            <Step
              icon="sunny-outline"
              title="When were you born?"
              subtitle="Your birth date reveals your Sun sign — the core of your cosmic identity."
            >
              <View style={s.wheelRow}>
                <WheelPicker
                  items={MONTHS}
                  value={month}
                  onChange={(v) => setMonth(v as string)}
                  width={140}
                />
                <WheelPicker
                  items={days}
                  value={day}
                  onChange={(v) => setDay(v as number)}
                  width={70}
                />
                <WheelPicker
                  items={years}
                  value={year}
                  onChange={(v) => setYear(v as number)}
                  width={92}
                />
              </View>
            </Step>
          )}

          {step === 'tob' && (
            <Step
              icon="time-outline"
              title="What time were you born?"
              subtitle={tobUnknown
                ? "No problem — we'll use a classical Vedic fallback below."
                : "Time of birth pins your Lagna — the rising sign at that moment."}
            >
              {!tobUnknown ? (
                <View style={s.wheelRow}>
                  <WheelPicker
                    items={hours}
                    value={hour}
                    onChange={(v) => setHour(v as number)}
                    width={80}
                    formatItem={(v) => String(v).padStart(2, '0')}
                  />
                  <Text style={s.colon}>:</Text>
                  <WheelPicker
                    items={minutes}
                    value={minute}
                    onChange={(v) => setMinute(v as number)}
                    width={80}
                    formatItem={(v) => String(v).padStart(2, '0')}
                  />
                </View>
              ) : (
                <View style={s.lagnaBox}>
                  <Text style={s.lagnaTitle}>Lagna fallback</Text>
                  <Text style={s.lagnaHint}>
                    Without an exact time we estimate the rising sign. Pick the tradition you prefer:
                  </Text>
                  <View style={s.segRow}>
                    {([
                      { id: 'moon',    label: 'Chandra-Lagna',  sub: 'Classical · default' },
                      { id: 'sunrise', label: 'Sunrise · Lagna', sub: 'Modern' },
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
              )}

              <Pressable
                onPress={() => setTobUnknown(v => !v)}
                style={({ pressed }) => [s.tobToggle, pressed && { opacity: 0.85 }]}
              >
                <Ionicons
                  name={tobUnknown ? 'checkmark-circle' : 'help-circle-outline'}
                  size={16}
                  color={tobUnknown ? C.goldHi : C.cream65}
                />
                <Text style={s.tobToggleText}>
                  {tobUnknown ? 'Using a Lagna fallback' : "I don't know my birth time"}
                </Text>
              </Pressable>
            </Step>
          )}

          {step === 'place' && (
            <Step
              icon="location-outline"
              title="Where were you born?"
              subtitle="The city pins your latitude / longitude — needed for an accurate chart."
            >
              <TextInput
                value={place}
                onChangeText={(t) => { userTypedPlace.current = true; setPlace(t); setCoords(null); }}
                placeholder="Hyderabad, India"
                placeholderTextColor={C.cream45}
                style={[s.input, isWeb && (s.inputWeb as any)]}
                autoCorrect={false}
                onSubmitEditing={() => canAdvance && next()}
                returnKeyType="next"
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
              ) : (
                <Text style={s.fieldHint}>Pick a city from the suggestions so we can geocode it.</Text>
              )}
            </Step>
          )}

          {step === 'reveal' && (
            <RevealScreen
              name={name.trim() || 'Cosmic'}
              chart={revealResult}
              tobFallback={tobUnknown}
              lagnaSource={lagnaSource}
              onBegin={() => onDone(revealHandoffRef.current!)}
            />
          )}

          {step !== 'reveal' && (
            <View style={{ marginTop: 28 }}>
              <Pressable
                onPress={next}
                disabled={!canAdvance || submitting}
                style={({ pressed }) => [
                  s.cta,
                  (!canAdvance || submitting) && { opacity: 0.45 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                {submitting
                  ? <ActivityIndicator color={C.bgDeep} size="small" />
                  : (
                    <Text style={s.ctaText}>
                      {step === 'place'   ? 'Reveal my chart  →'  :
                       step === 'tob'     ? 'Continue  →'         :
                       step === 'dob'     ? 'Continue  →'         :
                                            'Continue  →'}
                    </Text>
                  )}
              </Pressable>

              {step !== 'name' ? (
                <Pressable onPress={prev} style={({ pressed }) => [s.back, pressed && { opacity: 0.85 }]}>
                  <Ionicons name="chevron-back" size={14} color={C.cream65} />
                  <Text style={s.backText}>Back</Text>
                </Pressable>
              ) : (
                onLogout ? (
                  <Pressable onPress={onLogout} style={({ pressed }) => [s.back, pressed && { opacity: 0.85 }]}>
                    <Text style={s.backText}>Sign out</Text>
                  </Pressable>
                ) : null
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── Step wrapper ─────────────────────────────────────────────────
const Step: React.FC<{ icon: any; title: string; subtitle: string; children: React.ReactNode }> = ({
  icon, title, subtitle, children,
}) => (
  <View style={s.stepWrap}>
    <View style={s.iconCircle}>
      <Ionicons name={icon} size={26} color={C.goldHi} />
    </View>
    <Text style={s.title}>{title}</Text>
    <Text style={s.subtitle}>{subtitle}</Text>
    <View style={{ marginTop: 30 }}>{children}</View>
  </View>
);

// ── Reveal screen (5 cards) ─────────────────────────────────────
interface RevealProps {
  name: string;
  chart: any;
  tobFallback: boolean;
  lagnaSource: 'moon' | 'sunrise';
  onBegin: () => void;
}
const RevealScreen: React.FC<RevealProps> = ({ name, chart, tobFallback, lagnaSource, onBegin }) => {
  const c = chart || {};
  const cd = c.chart_data || {};
  const sun = (cd.planets || []).find((p: any) => p.name === 'Surya' || p.name === 'Sun') as any;
  const moon = (cd.planets || []).find((p: any) => p.name === 'Chandra' || p.name === 'Moon') as any;
  const sunSign  = sun?.sign || sun?.sign_local || '—';
  const lagna    = c.ascendant_sign || cd.ascendant_sign || '—';
  const rasi     = c.moon_sign || moon?.sign || moon?.sign_local || '—';
  const nak      = c.moon_nakshatra || moon?.nakshatra || moon?.nakshatra_local || '—';
  const pada     = moon?.nakshatra_pada || c.moon_nakshatra_pada || '—';

  const cards: { icon: any; label: string; value: string; glyph?: string; ring: 'gold' | 'violet' | 'blue' | 'rose' | 'green' }[] = [
    { icon: 'sunny',         label: 'Sun Sign',        value: sunSign, glyph: ZODIAC_GLYPH[sunSign], ring: 'gold' },
    { icon: 'add-circle',    label: 'Lagna · Rising',  value: lagna,   glyph: ZODIAC_GLYPH[lagna],   ring: 'rose' },
    { icon: 'moon',          label: 'Rasi · Moon Sign',value: rasi,    glyph: ZODIAC_GLYPH[rasi],    ring: 'violet' },
    { icon: 'sparkles',      label: 'Nakshatra',       value: String(nak),                            ring: 'blue' },
    { icon: 'star',          label: 'Nakshatra Pada',  value: String(pada),                            ring: 'green' },
  ];

  return (
    <View style={s.revealWrap}>
      <View style={s.revealOrb}>
        <Ionicons name="sparkles" size={42} color={C.goldHi} />
      </View>
      <Text style={s.welcome}>Welcome, {name}</Text>
      <Text style={s.welcomeSub}>Your cosmic blueprint is ready.</Text>
      <Text style={s.welcomeSub}>Here is what the stars reveal about you:</Text>

      {tobFallback ? (
        <View style={s.fallbackBadge}>
          <Ionicons name="information-circle" size={14} color={C.goldHi} />
          <Text style={s.fallbackText}>
            {lagnaSource === 'moon' ? 'Moon-Lagna chart  ·  no exact birth time' : 'Sunrise-Lagna chart  ·  no exact birth time'}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: 18, gap: 12 }}>
        {cards.map((card, i) => (
          <View key={i} style={[s.revealCard, isWeb && (s.cardWeb as any)]}>
            <View style={[s.revealIconCircle, ringStyle(card.ring)]}>
              <Ionicons name={card.icon} size={20} color={C.goldHi} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.revealLabel}>{card.label}</Text>
              <Text style={s.revealValue}>{card.value}</Text>
            </View>
            {card.glyph ? <Text style={s.revealGlyph}>{card.glyph}</Text> : null}
          </View>
        ))}
      </View>

      <Pressable
        onPress={onBegin}
        style={({ pressed }) => [s.cta, s.ctaReveal, pressed && { opacity: 0.85 }]}
      >
        <Text style={s.ctaText}>Begin My Cosmic Journey  ✦</Text>
      </Pressable>
    </View>
  );
};

const ringStyle = (tone: string) => {
  switch (tone) {
    case 'gold':   return { borderColor: 'rgba(232,201,106,0.50)' };
    case 'violet': return { borderColor: 'rgba(159,122,234,0.45)' };
    case 'blue':   return { borderColor: 'rgba(122,160,234,0.45)' };
    case 'rose':   return { borderColor: 'rgba(234,122,180,0.45)' };
    case 'green':  return { borderColor: 'rgba(122,234,180,0.45)' };
  }
  return {};
};

// ── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgDeep },
  scroll: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 80 },

  dots: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    paddingTop: 14, paddingBottom: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.cream20 },
  dotActive: { width: 22, height: 6, borderRadius: 3, backgroundColor: C.goldHi },

  stepWrap: { alignItems: 'center', marginTop: 10 },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(232,201,106,0.10)',
    borderWidth: 1, borderColor: C.goldLine,
    marginBottom: 18,
  },
  title: { color: C.cream, fontSize: 28, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center', maxWidth: 360 },
  subtitle: { color: C.cream65, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 10, maxWidth: 360 },

  input: {
    width: '100%', maxWidth: 480,
    height: 56, paddingHorizontal: 18, borderRadius: 14,
    backgroundColor: 'rgba(15,8,32,0.55)',
    borderWidth: 1, borderColor: C.cream20,
    color: C.cream, fontSize: 16, fontWeight: '600',
    textAlign: 'center',
  },
  inputWeb: { outlineStyle: 'none', outlineWidth: 0 } as any,

  // Wheel area
  wheelRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 22,
    backgroundColor: 'rgba(15,8,32,0.55)',
    borderWidth: 1, borderColor: C.cream10,
  },
  colon: { color: C.cream, fontSize: 26, fontWeight: '700', marginHorizontal: 4 },

  // Lagna fallback box
  lagnaBox: {
    marginTop: 6, padding: 14, borderRadius: 14,
    backgroundColor: C.glassSoft, borderWidth: 1, borderColor: C.goldLine,
    width: '100%', maxWidth: 480,
  },
  lagnaTitle: { color: C.goldHi, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  lagnaHint: { color: C.cream65, fontSize: 12, lineHeight: 17, marginTop: 6, marginBottom: 10 },
  segRow: { flexDirection: 'row', gap: 8 },
  lagnaOpt: {
    flex: 1, padding: 12, borderRadius: 10,
    backgroundColor: C.cream10, borderWidth: 1, borderColor: C.cream20,
  },
  lagnaOptActive: { backgroundColor: 'rgba(232,201,106,0.18)', borderColor: C.goldLine },
  lagnaOptTitle: { color: C.cream, fontSize: 13, fontWeight: '800' },
  lagnaOptTitleActive: { color: C.goldHi },
  lagnaOptSub: { color: C.cream45, fontSize: 11, marginTop: 3 },
  lagnaOptSubActive: { color: C.cream80 },

  tobToggle: {
    marginTop: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center',
  },
  tobToggleText: { color: C.cream65, fontSize: 13, fontWeight: '700' },

  // Suggestions
  suggestWrap: {
    marginTop: 6, borderRadius: 12, overflow: 'hidden',
    backgroundColor: C.glassStrong, borderWidth: 1, borderColor: C.cream20,
    width: '100%', maxWidth: 480,
  },
  suggestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.cream10,
  },
  suggestText: { color: C.cream, fontSize: 14, flex: 1 },
  coordsBadge: { color: C.okFg, fontSize: 12, fontWeight: '700', marginTop: 8, alignSelf: 'center' },
  fieldHint: { color: C.cream45, fontSize: 12, marginTop: 8, alignSelf: 'center' },

  // CTA — gradient amber pill (we use a flat gold for native; web gets a gradient via boxShadow glow).
  cta: {
    height: 54, borderRadius: 27,
    paddingHorizontal: 28,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
    width: '100%', maxWidth: 360,
    backgroundColor: C.goldHi,
    ...(isWeb ? {
      backgroundImage: 'linear-gradient(90deg, #E8C96A 0%, #E8B66A 50%, #E08750 100%)',
      boxShadow: '0 6px 22px rgba(232,182,106,0.30)',
    } as any : {}),
  } as any,
  // Reveal screen variant — a touch slimmer + extra top breathing room.
  ctaReveal: {
    marginTop: 26, height: 52, borderRadius: 26,
    maxWidth: 320,
  } as any,
  ctaText: { color: C.bgDeep, fontSize: 14.5, fontWeight: '700', letterSpacing: 0.3 },

  back: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 14, marginTop: 6,
  },
  backText: { color: C.cream65, fontSize: 13, fontWeight: '700' },

  // Reveal screen
  revealWrap: { paddingTop: 8, alignItems: 'center' },
  revealOrb: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(232,201,106,0.10)',
    borderWidth: 1, borderColor: C.goldLine,
    marginBottom: 14,
    ...(isWeb ? { boxShadow: '0 0 64px rgba(232,201,106,0.35)' } as any : {}),
  } as any,
  welcome: { color: C.goldHi, fontSize: 30, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  welcomeSub: { color: C.cream65, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6, maxWidth: 380 },

  fallbackBadge: {
    marginTop: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(232,201,106,0.10)', borderWidth: 1, borderColor: C.goldLine,
  },
  fallbackText: { color: C.goldHi, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },

  revealCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 18,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.cream10,
    width: '100%', maxWidth: 520,
  },
  cardWeb: {
    backdropFilter: 'blur(28px) saturate(160%)',
    WebkitBackdropFilter: 'blur(28px) saturate(160%)',
  } as any,
  revealIconCircle: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderWidth: 1.5,
  },
  revealLabel: { color: C.cream65, fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  revealValue: { color: C.cream, fontSize: 22, fontWeight: '800', marginTop: 2 },
  revealGlyph: { color: C.goldHi, fontSize: 32, fontWeight: '600', marginRight: 6 },
});

export default CosmicOnboardingFlow;
