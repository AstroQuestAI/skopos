/**
 * CosmicSettingsPage — settings sibling of CosmicProfilePage.
 *
 *   YOU
 *   Settings
 *
 *   ┌─────────────────────────────┐
 *   │ ACCOUNT                     │
 *   │ Email   you@example.com     │
 *   └─────────────────────────────┘
 *
 *   ┌─────────────────────────────┐
 *   │ SUBSCRIPTION                │
 *   │ Plan    Trial · 5 days left │
 *   │ ☆  Upgrade · Full Access  > │
 *   └─────────────────────────────┘
 *
 *   ┌─────────────────────────────┐
 *   │ COUPONS                     │
 *   │ [ENTER CODE     ] [Redeem]  │
 *   │ Beta codes: BETA3, BETA7    │
 *   └─────────────────────────────┘
 *
 *   ┌─────────────────────────────┐
 *   │ VIDHAATA CACHE              │
 *   │ ↻  Clear chat history     > │
 *   └─────────────────────────────┘
 *
 *   ┌─────────────────────────────┐
 *   │ UI SETTINGS                 │
 *   │ Language     [EN] [TE]      │
 *   │ Ayanamsa     [Lahiri] [...] │
 *   └─────────────────────────────┘
 *
 *   Vidhaata · powered by classical Vedic texts
 */
import React, { useState, useEffect } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import {
  awaitBrowserVoices, listBrowserVoices, rankBrowserVoices,
  fetchVoiceCatalog, previewVoice, type CatalogVoice,
} from './voiceEngine';
import { getVoicePref, setVoicePref, type Lang as PrefLang } from './voicePref';
import { trCurrent } from './cosmicI18n';

const C = theme.cosmic;
const isWeb = Platform.OS === 'web';

export interface AyanamsaOption { id: string; label: string; description?: string; }

interface Props {
  email?: string | null;
  planLabel?: string;        // e.g. "Trial · 5 days left" or "FULL · expires 2026-08-12"
  planActive?: boolean;
  onUpgrade?: () => void;

  // Coupons
  onRedeemCoupon?: (code: string) => Promise<{ ok: boolean; message: string }>;

  // Vidhaata cache
  onClearChatCache?: () => Promise<void> | void;

  // UI settings
  language?: 'en' | 'te';
  onLanguageChange?: (lang: 'en' | 'te') => void;

  ayanamsa?: string;
  ayanamsaOptions?: AyanamsaOption[];
  onAyanamsaChange?: (id: string) => void;
}

export const CosmicSettingsPage: React.FC<Props> = ({
  email,
  planLabel,
  planActive,
  onUpgrade,
  onRedeemCoupon,
  onClearChatCache,
  language = 'en',
  onLanguageChange,
  ayanamsa,
  ayanamsaOptions = [],
  onAyanamsaChange,
}) => {
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // v9.20 — Per-language voice picker state
  const [voicePrefEn, setVoicePrefEn] = useState<string>(getVoicePref('en'));
  const [voicePrefTe, setVoicePrefTe] = useState<string>(getVoicePref('te'));
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [catalog, setCatalog] = useState<CatalogVoice[]>([]);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  useEffect(() => {
    let alive = true;
    awaitBrowserVoices(2000).then((v) => { if (alive) setBrowserVoices(v); });
    fetchVoiceCatalog().then((c) => { if (alive) setCatalog(c); });
    return () => { alive = false; };
  }, []);

  // Helpers used by the voice cards.
  const tryPreview = async (key: string, doIt: () => Promise<void> | void) => {
    if (previewing) return;
    setPreviewing(key);
    try { await doIt(); } catch (e) { console.warn('[settings-preview]', e); }
    finally { setTimeout(() => setPreviewing((p) => (p === key ? null : p)), 600); }
  };

  const handleRedeem = async () => {
    const c = code.trim();
    if (!c) return;
    if (!onRedeemCoupon) return;
    setRedeeming(true);
    setRedeemMsg(null);
    try {
      const res = await onRedeemCoupon(c);
      setRedeemMsg({ ok: !!res.ok, text: res.message || (res.ok ? 'Code redeemed.' : 'Could not redeem code.') });
      if (res.ok) setCode('');
    } catch (e: any) {
      setRedeemMsg({ ok: false, text: e?.response?.data?.detail || e?.message || 'Could not redeem code.' });
    } finally {
      setRedeeming(false);
    }
  };

  const handleClearCache = async () => {
    if (!onClearChatCache) return;
    const proceed = () => (async () => {
      setClearing(true);
      try {
        await onClearChatCache();
        setCleared(true);
        setTimeout(() => setCleared(false), 2400);
      } catch {} finally {
        setClearing(false);
      }
    })();
    if (isWeb) {
      // Use confirm() on web; Alert.alert is no-op on RN-web in some setups.
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm('Clear Vidhaata chat cache and transcript?')) {
        proceed();
      }
    } else {
      Alert.alert(
        'Clear Vidhaata cache?',
        'This will remove your saved chat transcript and answer cache.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: proceed },
        ],
      );
    }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <Text style={s.kicker}>YOU</Text>
      <Text style={s.title}>Settings</Text>

      {/* ── Account ───────────────────────────────────────── */}
      <View style={[s.card, isWeb && (s.cardWeb as any)]}>
        <Text style={s.cardKicker}>ACCOUNT</Text>
        <View style={s.row}>
          <Text style={s.rowLabel}>Email</Text>
          <Text style={s.rowValue} numberOfLines={1}>{email || '—'}</Text>
        </View>
      </View>

      {/* ── Subscription ──────────────────────────────────── */}
      <View style={[s.card, isWeb && (s.cardWeb as any)]}>
        <Text style={s.cardKicker}>SUBSCRIPTION</Text>
        <View style={s.row}>
          <Text style={s.rowLabel}>Plan</Text>
          <View style={[s.statusChip, planActive ? s.statusChipOk : s.statusChipNeutral]}>
            <Text style={[s.statusChipText, planActive ? s.statusChipTextOk : s.statusChipTextNeutral]}>
              {planLabel || 'Free'}
            </Text>
          </View>
        </View>
        {onUpgrade ? (
          <Pressable
            onPress={onUpgrade}
            style={({ pressed }) => [s.action, pressed && { opacity: 0.85 }]}
          >
            <View style={s.actionIcon}>
              <Ionicons name="rocket" size={18} color={C.goldHi} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionTitle}>{planActive ? 'Manage subscription' : 'Upgrade · Full Access'}</Text>
              <Text style={s.actionSub}>{planActive ? 'View plan, expiry, billing' : 'Unlock unlimited Vidhaata · ₹199/mo'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.cream45} />
          </Pressable>
        ) : null}
      </View>

      {/* ── Coupons ──────────────────────────────────────── */}
      <View style={[s.card, isWeb && (s.cardWeb as any)]}>
        <Text style={s.cardKicker}>COUPONS</Text>
        <View style={s.couponRow}>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="ENTER CODE"
            placeholderTextColor={C.cream45}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[s.input, isWeb && (s.inputWeb as any)]}
            editable={!redeeming}
          />
          <Pressable
            onPress={handleRedeem}
            disabled={!code.trim() || redeeming}
            style={({ pressed }) => [
              s.redeemBtn,
              (!code.trim() || redeeming) && { opacity: 0.45 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {redeeming
              ? <ActivityIndicator size="small" color={C.bgDeep} />
              : <Text style={s.redeemBtnText}>Redeem</Text>}
          </Pressable>
        </View>
        {redeemMsg ? (
          <Text style={[s.redeemMsg, redeemMsg.ok ? s.redeemMsgOk : s.redeemMsgErr]}>
            {redeemMsg.text}
          </Text>
        ) : (
          <Text style={s.couponHint}>Beta codes: BETA3, BETA7 · Developer code unlocks Full Access</Text>
        )}
      </View>

      {/* ── Vidhaata cache ───────────────────────────────── */}
      <View style={[s.card, isWeb && (s.cardWeb as any)]}>
        <Text style={s.cardKicker}>VIDHAATA CACHE</Text>
        <Pressable
          onPress={handleClearCache}
          disabled={clearing}
          style={({ pressed }) => [s.action, pressed && { opacity: 0.85 }]}
        >
          <View style={[s.actionIcon, s.actionIconWarm]}>
            <Ionicons name="trash" size={18} color={C.terracottaLight} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.actionTitle}>{cleared ? 'Cache cleared' : 'Clear chat history'}</Text>
            <Text style={s.actionSub}>
              {clearing ? 'Clearing…' : 'Removes saved transcript & answer cache'}
            </Text>
          </View>
          {clearing
            ? <ActivityIndicator size="small" color={C.cream65} />
            : <Ionicons name="chevron-forward" size={18} color={C.cream45} />}
        </Pressable>
      </View>

      {/* ── UI Settings ──────────────────────────────────── */}
      <View style={[s.card, isWeb && (s.cardWeb as any)]}>
        <Text style={s.cardKicker}>UI SETTINGS</Text>

        <Text style={s.fieldLabel}>Language</Text>
        <View style={s.segRow}>
          {([
            { id: 'en', label: 'English' },
            { id: 'te', label: 'తెలుగు' },
          ] as const).map(opt => {
            const active = language === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => onLanguageChange?.(opt.id)}
                style={({ pressed }) => [
                  s.segBtn, active && s.segBtnActive, pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[s.segBtnText, active && s.segBtnTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {ayanamsaOptions.length > 0 ? (
          <>
            <Text style={[s.fieldLabel, { marginTop: 14 }]}>Ayanamsa</Text>
            <View style={s.chipsWrap}>
              {ayanamsaOptions.map(opt => {
                const active = ayanamsa === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => onAyanamsaChange?.(opt.id)}
                    style={({ pressed }) => [
                      s.chip, active && s.chipActive, pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {(() => {
              const sel = ayanamsaOptions.find(o => o.id === ayanamsa);
              const desc = sel?.description || 'Lahiri is the gold-standard used across India.';
              return <Text style={s.helpText}>{desc}</Text>;
            })()}
          </>
        ) : null}

        {/* v9.20 — Voice picker — per language. English uses free Web
            Speech API voices (Google UK English Female/Male) by
            default; Telugu uses paid Google Cloud Chirp3-HD voices. */}
        {Platform.OS === 'web' ? (
          <>
            {/* ── ENGLISH VOICE ─────────────────────────────────── */}
            <Text style={[s.fieldLabel, { marginTop: 18 }]}>{trCurrent('English voice')}</Text>
            <Text style={[s.helpText, { marginBottom: 8 }]}>
              {trCurrent('Used for the Daily Briefing and Vidhaata in English. Free OS voices play instantly; cosmic neural voices use Google Cloud TTS for studio quality.')}
            </Text>

            {/* Free OS browser voices (Google UK English etc.) */}
            <Text style={s.subKicker}>{trCurrent('FREE · OS / BROWSER')}</Text>
            <View style={{ gap: 6 }}>
              {(() => {
                const ranked = rankBrowserVoices(browserVoices, 'en').slice(0, 8);
                if (ranked.length === 0) {
                  return (
                    <Text style={s.helpText}>
                      No browser voices available yet. On Chrome / Android, enable “Google” voices via the system TTS settings.
                    </Text>
                  );
                }
                return ranked.map((v) => {
                  const prefVal = `browser:${v.name}`;
                  const active = voicePrefEn === prefVal;
                  const isPreviewing = previewing === prefVal;
                  return (
                    <Pressable
                      key={`${v.name}-${v.lang}`}
                      onPress={() => {
                        setVoicePref('en', prefVal);
                        setVoicePrefEn(prefVal);
                        tryPreview(prefVal, () => previewVoice({ engine: 'browser', id: v.name, lang: v.lang }));
                      }}
                      style={({ pressed }) => [
                        pVoiceCard.row, active && pVoiceCard.rowActive, pressed && { opacity: 0.85 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[pVoiceCard.label, active && pVoiceCard.labelActive]} numberOfLines={1}>
                          {v.name}
                        </Text>
                        <Text style={pVoiceCard.sub} numberOfLines={1}>
                          {v.lang}{v.localService ? ' · offline' : ' · cloud'}
                        </Text>
                      </View>
                      {isPreviewing ? (
                        <ActivityIndicator size="small" color={C.goldHi} />
                      ) : (
                        <Ionicons
                          name={active ? 'checkmark-circle' : 'play-circle-outline'}
                          size={22}
                          color={active ? C.goldHi : 'rgba(245,237,214,0.45)'}
                        />
                      )}
                    </Pressable>
                  );
                });
              })()}
            </View>

            {/* Paid Google Cloud Chirp3-HD English voices */}
            <Text style={[s.subKicker, { marginTop: 14 }]}>{trCurrent('NEURAL · GOOGLE CLOUD')}</Text>
            <View style={{ gap: 6 }}>
              {catalog.filter((v) => v.lang.startsWith('en')).map((v) => {
                const prefVal = `gctts:${v.id}`;
                const active = voicePrefEn === prefVal;
                const isPreviewing = previewing === prefVal;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => {
                      setVoicePref('en', prefVal);
                      setVoicePrefEn(prefVal);
                      tryPreview(prefVal, () => previewVoice({ engine: 'gctts', id: v.id, lang: v.lang }));
                    }}
                    style={({ pressed }) => [
                      pVoiceCard.row, active && pVoiceCard.rowActive, pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[pVoiceCard.label, active && pVoiceCard.labelActive]}>{v.label}</Text>
                      <Text style={pVoiceCard.sub} numberOfLines={1}>{v.sub}</Text>
                    </View>
                    {isPreviewing ? (
                      <ActivityIndicator size="small" color={C.goldHi} />
                    ) : (
                      <Ionicons
                        name={active ? 'checkmark-circle' : 'play-circle-outline'}
                        size={22}
                        color={active ? C.goldHi : 'rgba(245,237,214,0.45)'}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* ── TELUGU VOICE ──────────────────────────────────── */}
            <Text style={[s.fieldLabel, { marginTop: 22 }]}>{trCurrent('Telugu voice (తెలుగు)')}</Text>
            <Text style={[s.helpText, { marginBottom: 8 }]}>
              {trCurrent('Studio-quality Google Chirp3-HD voices for Telugu — used for Daily Briefing and Vidhaata when the app is in Telugu mode.')}
            </Text>
            <View style={{ gap: 6 }}>
              {catalog.filter((v) => v.lang.startsWith('te')).map((v) => {
                const prefVal = `gctts:${v.id}`;
                const active = voicePrefTe === prefVal;
                const isPreviewing = previewing === prefVal;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => {
                      setVoicePref('te', prefVal);
                      setVoicePrefTe(prefVal);
                      tryPreview(prefVal, () => previewVoice({ engine: 'gctts', id: v.id, lang: v.lang }));
                    }}
                    style={({ pressed }) => [
                      pVoiceCard.row, active && pVoiceCard.rowActive, pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[pVoiceCard.label, active && pVoiceCard.labelActive]}>{v.label}</Text>
                      <Text style={pVoiceCard.sub} numberOfLines={1}>{v.sub}</Text>
                    </View>
                    {isPreviewing ? (
                      <ActivityIndicator size="small" color={C.goldHi} />
                    ) : (
                      <Ionicons
                        name={active ? 'checkmark-circle' : 'play-circle-outline'}
                        size={22}
                        color={active ? C.goldHi : 'rgba(245,237,214,0.45)'}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Text style={[s.helpText, { marginTop: 8 }]}>
              Tap a voice card to set + preview it. The choice applies to all voice features in this language.
            </Text>
          </>
        ) : null}
      </View>

      <Text style={s.footer}>Vidhaata  ·  powered by classical Vedic texts</Text>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgDeep },
  scroll: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 140 },
  kicker: { color: C.cream45, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: C.cream, fontSize: 38, fontWeight: '800', letterSpacing: -0.5, marginTop: 4, marginBottom: 6 },

  card: {
    padding: 18, borderRadius: 18,
    backgroundColor: C.glass,
    marginTop: 16,
  },
  cardWeb: {
    backdropFilter: 'blur(28px) saturate(160%)',
    WebkitBackdropFilter: 'blur(28px) saturate(160%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 28px rgba(0,0,0,0.20)',
  } as any,
  cardKicker: { color: C.goldHi, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
  },
  rowLabel: { color: C.cream65, fontSize: 14 },
  rowValue: { color: C.cream, fontSize: 14, fontWeight: '700', maxWidth: '65%' },

  statusChip: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1,
  },
  statusChipOk: { backgroundColor: 'rgba(232,201,106,0.14)', borderColor: C.goldLine },
  statusChipNeutral: { backgroundColor: C.cream10, borderColor: C.cream20 },
  statusChipText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  statusChipTextOk: { color: C.goldHi },
  statusChipTextNeutral: { color: C.cream80 },

  action: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginTop: 8 },
  actionIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(232,201,106,0.14)',
    borderWidth: 1, borderColor: C.goldLine,
    marginRight: 14,
  },
  actionIconWarm: {
    backgroundColor: 'rgba(196,98,45,0.18)',
    borderColor: 'rgba(224,122,69,0.40)',
  },
  actionTitle: { color: C.cream, fontSize: 15, fontWeight: '700' },
  actionSub: { color: C.cream65, fontSize: 12, marginTop: 2 },

  // Coupon input row
  couponRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  input: {
    flex: 1, height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(15,8,32,0.55)',
    borderWidth: 1, borderColor: C.cream20,
    color: C.cream,
    fontSize: 14, fontWeight: '700', letterSpacing: 1.2,
  },
  inputWeb: { outlineStyle: 'none', outlineWidth: 0 } as any,
  redeemBtn: {
    height: 44, paddingHorizontal: 18, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.goldHi,
  },
  redeemBtnText: { color: C.bgDeep, fontSize: 14, fontWeight: '800', letterSpacing: 0.4 },
  couponHint: { color: C.cream45, fontSize: 11, marginTop: 10, lineHeight: 15 },
  redeemMsg: { fontSize: 12, marginTop: 10, lineHeight: 16, fontWeight: '700' },
  redeemMsgOk: { color: C.okFg },
  redeemMsgErr: { color: C.terracottaLight },

  // UI settings
  fieldLabel: { color: C.cream65, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8, marginTop: 2 },
  segRow: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.cream10,
    borderWidth: 1, borderColor: C.cream20,
  },
  segBtnActive: {
    backgroundColor: 'rgba(232,201,106,0.18)',
    borderColor: C.goldLine,
  },
  segBtnText: { color: C.cream80, fontSize: 13, fontWeight: '700' },
  segBtnTextActive: { color: C.goldHi },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.cream10,
    borderWidth: 1, borderColor: C.cream20,
  },
  chipActive: {
    backgroundColor: 'rgba(232,201,106,0.18)',
    borderColor: C.goldLine,
  },
  chipText: { color: C.cream80, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: C.goldHi },

  // v9.20 — sub-section kicker (used inside the voice picker sections)
  subKicker: {
    color: C.cream65, fontSize: 10, fontWeight: '800', letterSpacing: 1.2,
    marginTop: 8, marginBottom: 6,
  },

  helpText: { color: C.cream45, fontSize: 11, marginTop: 10, lineHeight: 15 },

  // v9.7 — Voice picker rows
  voiceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.cream10,
    borderWidth: 1, borderColor: C.cream20,
  },
  voiceRowActive: {
    backgroundColor: 'rgba(232,201,106,0.14)',
    borderColor: C.goldLine,
  },
  voiceName: { color: C.cream, fontSize: 13, fontWeight: '700' },
  voiceMeta: { color: C.cream45, fontSize: 11, marginTop: 2 },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: C.goldHi,
  },
  previewBtnText: { color: C.bgDeep, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },

  footer: { color: C.cream45, fontSize: 12, textAlign: 'center', marginTop: 26 },
});

// v9.13 — Piper voice picker (cards)
const pVoiceCard = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 12,
    borderRadius: 14,
    backgroundColor: C.cream10,
    borderWidth: 1, borderColor: C.cream20,
  },
  rowActive: {
    backgroundColor: 'rgba(232,201,106,0.14)',
    borderColor: C.goldLine,
  },
  label: { color: C.cream, fontSize: 14, fontWeight: '800' },
  labelActive: { color: C.goldHi },
  sub:   { color: C.cream45, fontSize: 11, marginTop: 2 },
});

export default CosmicSettingsPage;
