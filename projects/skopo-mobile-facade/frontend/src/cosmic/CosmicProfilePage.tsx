/**
 * CosmicProfilePage — matches reference screenshot 4.
 *
 *   YOU
 *   Profile
 *
 *   ┌──────────────┐
 *   │      L       │   ← gold-ringed avatar with first-letter
 *   └──────────────┘
 *        Lucky
 *      ☾ Dhanu (chip)
 *
 *   ┌─────────────────────────────┐
 *   │ BIRTH DETAILS               │
 *   │ Date  1980-08-22            │
 *   │ Time  12:30                 │
 *   │ Place Nellore               │
 *   └─────────────────────────────┘
 *
 *   ┌─────────────────────────────┐
 *   │ VIDHAATA                    │
 *   │ ↻  Re-enter birth details  > │
 *   │     Recompute your chart     │
 *   └─────────────────────────────┘
 *
 *   Vidhaata · powered by classical Vedic texts
 */
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

const C = theme.cosmic;
const isWeb = Platform.OS === 'web';

interface Props {
  name?: string;
  moonSignLocal?: string;     // "Dhanu"
  dob?: string;               // YYYY-MM-DD
  tob?: string;               // HH:MM
  place?: string;             // "Nellore"
  // v9.18 — full chart-derived details for the Birth Details card
  lagna?: string;             // Ascendant sign (e.g. "Mesha")
  sunSign?: string;           // Solar sign (e.g. "Vrishabha")
  moonSign?: string;          // Rasi (e.g. "Dhanu")
  nakshatra?: string;         // Janma nakshatra (e.g. "Purva Ashadha")
  pada?: number | string;     // 1-4
  onReenter?: () => void;
  onOpenSettings?: () => void;
  onSignOut?: () => void;
}

export const CosmicProfilePage: React.FC<Props> = ({
  name, moonSignLocal, dob, tob, place,
  lagna, sunSign, moonSign, nakshatra, pada,
  onReenter, onOpenSettings, onSignOut,
}) => {
  const initial = (name?.trim()?.[0] || '✦').toUpperCase();
  return (
    <ScrollView style={s.root} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <Text style={s.kicker}>YOU</Text>
      <Text style={s.title}>Profile</Text>

      {/* Avatar */}
      <View style={s.avatarWrap}>
        <View style={[s.avatar, isWeb && (s.avatarWeb as any)]}>
          <Text style={s.avatarLetter}>{initial}</Text>
        </View>
        <Text style={s.name}>{name || 'Seeker'}</Text>
        {moonSignLocal ? (
          <View style={s.rashiChip}>
            <Text style={s.rashiText}>☾  {moonSignLocal}</Text>
          </View>
        ) : null}
      </View>

      {/* Birth details card */}
      <View style={[s.card, isWeb && (s.cardWeb as any)]}>
        <Text style={s.cardKicker}>BIRTH DETAILS</Text>
        <Row label="Date of Birth"  value={dob || '—'} />
        <Row label="Time of Birth"  value={tob || '—'} />
        <Row label="Place of Birth" value={place || '—'} />
        {(lagna || sunSign || moonSign || nakshatra || pada != null) ? (
          <>
            <View style={s.divider} />
            <Text style={[s.cardKicker, { marginTop: 8 }]}>CHART POINTS</Text>
            <Row label="Lagna (Asc)" value={lagna || '—'} />
            <Row label="Sun Sign"    value={sunSign || '—'} />
            <Row label="Moon Sign"   value={moonSign || moonSignLocal || '—'} />
            <Row label="Nakshatra"   value={nakshatra || '—'} />
            <Row label="Pada"        value={pada != null && pada !== '' ? String(pada) : '—'} />
          </>
        ) : null}
      </View>

      {/* Vidhaata actions */}
      <View style={[s.card, isWeb && (s.cardWeb as any)]}>
        <Text style={s.cardKicker}>VIDHAATA</Text>
        <Pressable onPress={onReenter} style={({ pressed }) => [s.action, pressed && { opacity: 0.85 }]}>
          <View style={s.actionIcon}>
            <Ionicons name="refresh" size={18} color={C.terracottaLight} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.actionTitle}>Re-enter birth details</Text>
            <Text style={s.actionSub}>Recompute your chart</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.cream45} />
        </Pressable>
        {onOpenSettings ? (
          <Pressable onPress={onOpenSettings} style={({ pressed }) => [s.action, { marginTop: 4 }, pressed && { opacity: 0.85 }]}>
            <View style={s.actionIcon}>
              <Ionicons name="settings-outline" size={18} color={C.goldHi} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionTitle}>Settings</Text>
              <Text style={s.actionSub}>Subscription, coupons, language, cache</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.cream45} />
          </Pressable>
        ) : null}
      </View>

      {onSignOut ? (
        <Pressable onPress={onSignOut} style={({ pressed }) => [s.signOut, pressed && { opacity: 0.85 }]}>
          <Ionicons name="log-out-outline" size={18} color="#E07A45" />
          <Text style={s.signOutText}>Sign out</Text>
        </Pressable>
      ) : null}

      <Text style={s.footer}>Vidhaata  ·  powered by classical Vedic texts</Text>
    </ScrollView>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={s.row}>
    <Text style={s.rowLabel}>{label}</Text>
    <Text style={s.rowValue}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgDeep },
  scroll: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 140 },
  kicker: { color: C.cream45, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: C.cream, fontSize: 38, fontWeight: '800', letterSpacing: -0.5, marginTop: 4, marginBottom: 18 },

  avatarWrap: { alignItems: 'center', marginVertical: 16 },
  avatar: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0F0820',
    borderWidth: 2, borderColor: C.gold,
  },
  avatarWeb: {
    boxShadow: '0 0 28px rgba(232,201,106,0.32), inset 0 1px 0 rgba(255,255,255,0.08)',
  } as any,
  avatarLetter: { fontSize: 44, fontWeight: '800', color: C.goldHi },
  name: { color: C.cream, fontSize: 24, fontWeight: '700', marginTop: 14, letterSpacing: -0.2 },
  rashiChip: {
    marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(232,201,106,0.14)',
    borderWidth: 1, borderColor: C.goldLine,
  },
  rashiText: { color: C.goldHi, fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },

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
  divider: { height: 1, backgroundColor: 'rgba(232,201,106,0.18)', marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { color: C.cream65, fontSize: 14 },
  rowValue: { color: C.cream, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },

  action: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  actionIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(196,98,45,0.18)',
    borderWidth: 1, borderColor: 'rgba(224,122,69,0.40)',
    marginRight: 14,
  },
  actionTitle: { color: C.cream, fontSize: 15, fontWeight: '700' },
  actionSub: { color: C.cream65, fontSize: 12, marginTop: 2 },

  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 18, paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(224,122,69,0.40)',
    backgroundColor: 'rgba(196,98,45,0.10)',
  },
  signOutText: { color: '#E07A45', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },

  footer: { color: C.cream45, fontSize: 12, textAlign: 'center', marginTop: 26 },
});

export default CosmicProfilePage;
