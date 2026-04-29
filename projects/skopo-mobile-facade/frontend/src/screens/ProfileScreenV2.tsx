/**
 * ProfileScreenV2.tsx — v7.14 REWRITE.
 *
 * Delegates the entire form (name / gender / marital / DOB / TOB / place /
 * phone / ayanamsa) to `PersonalDetailsForm`, which:
 *
 *   • Uses NATIVE <input type="date"> / <input type="time"> on web so
 *     Safari, Chrome, Edge, and mobile browsers all get built-in calendar
 *     and clock pickers — including on second-edit (the bug the previous
 *     hand-rolled TextInput-only form had).
 *   • Falls back to @react-native-community/datetimepicker on iOS/Android.
 *   • Uses the onboarding's polished design language that users preferred.
 *
 * Profile-specific extras (Access pill, Coupon redeem, Vidhaata Memory,
 * Device-ID footer) are injected via PersonalDetailsForm's `footerExtras`
 * prop so the form flow stays identical with the signup path.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert,
  StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../state/profileStore';
import { PersonalDetailsForm } from '../components/PersonalDetailsForm';
import { VidhaataMemorySection } from '../components/VidhaataMemorySection';
import { theme } from '../theme';
// v8.15.4 — Cosmic theme switch lives in the Profile footer, no URL needed.
import { CosmicThemeToggle } from '../cosmic/CosmicThemeToggle';

interface Props {
  authUser?:  { name?: string; email?: string; picture?: string } | null;
  onSaved:    () => void;
  onUpgrade?: () => void;
  deviceId?:  string;
}

export const ProfileScreenV2: React.FC<Props> = ({ authUser, onSaved, onUpgrade, deviceId }) => {
  const { profile, access, redeem, refetch } = useProfileStore();

  // ---------- Access pill (FULL / BASIC / TRIAL) ----------
  const planLabel = useMemo(() => {
    if (!access) return 'TRIAL';
    if (access.plan_active) return (access.plan_id || '').toUpperCase() === 'FULL' ? 'FULL' : 'BASIC';
    return 'TRIAL';
  }, [access]);
  const planTint = planLabel === 'FULL' ? '#047857' : planLabel === 'BASIC' ? '#0E7490' : '#B45309';
  const planBg   = planLabel === 'FULL' ? '#DCFCE7' : planLabel === 'BASIC' ? '#CFFAFE' : '#FEF3C7';
  const planSub  = access?.plan_active
    ? 'Active subscription'
    : access && access.trial.trial_days_left > 0
      ? `${access.trial.trial_days_left} day${access.trial.trial_days_left === 1 ? '' : 's'} of trial left`
      : 'Trial ended — upgrade to continue';

  // ---------- Coupon / beta-code redeem ----------
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const onRedeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    const r = await redeem(code);
    setRedeeming(false);
    if (r.ok) {
      Alert.alert('Redeemed ✓', r.message || `Code "${code.toUpperCase()}" applied.`);
      setCode('');
    } else {
      Alert.alert('Invalid code', r.message || 'Please check the code and try again.');
    }
  };

  // ---------- Hydrate PersonalDetailsForm with stored profile ----------
  const initial = useMemo(() => profile ? {
    first_name:    profile.first_name || '',
    last_name:     profile.last_name  || '',
    gender:        (profile.gender as any) || 'male',
    marital_status:(profile.marital_status as any) || 'single',
    dob:           profile.dob || '',
    tob:           profile.tob || '',
    birth_place:   profile.birth_place || '',
    birth_lat:     profile.birth_lat ?? null,
    birth_lon:     profile.birth_lon ?? null,
    phone:         profile.phone || '',
  } : null, [
    profile?.first_name, profile?.last_name, profile?.gender, profile?.marital_status,
    profile?.dob, profile?.tob, profile?.birth_place, profile?.birth_lat, profile?.birth_lon,
    profile?.phone,
  ]);

  // ---------- onDone — PersonalDetailsForm PUTs /profile/personal for us ----------
  // v7.14: After the form saves successfully, pull the fresh profile/access
  // from the backend into the Zustand store so the rest of the app reacts
  // instantly (cached overview, chart, panchanga, etc.).
  const handleDone = useCallback(async (_res: any) => {
    try { await refetch(); } catch { /* best-effort */ }
    onSaved();
  }, [refetch, onSaved]);

  // ---------- footerExtras block ----------
  const footerExtras = (
    <View>
      {/* Signed-in banner (moved to the top of footer so the hero-less
          form still identifies the user clearly). */}
      {authUser?.email ? (
        <View style={styles.idCard}>
          <Ionicons name="person-circle" size={18} color={theme.colors.primary700} />
          <Text style={styles.idCardText}>
            Signed in as{' '}
            <Text style={{ fontWeight: '800' }}>{authUser.name || authUser.email}</Text>
          </Text>
          <Text style={[styles.idCardText, { fontSize: 10.5, color: '#64748B' }]}>{authUser.email}</Text>
        </View>
      ) : null}

      {/* Access Type pill */}
      <View style={styles.extraCard}>
        <Text style={styles.extraLabel}>ACCESS TYPE</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.accessPill, { backgroundColor: planBg, borderColor: planTint }]}>
            <Ionicons
              name={access?.plan_active ? 'shield-checkmark' : 'sparkles'}
              size={14} color={planTint}
            />
            <Text style={[styles.accessPillText, { color: planTint }]}>{planLabel}</Text>
          </View>
          <Text style={styles.accessSub} numberOfLines={2}>{planSub}</Text>
          <TouchableOpacity onPress={onUpgrade} activeOpacity={0.8} style={styles.upgradeBtn}>
            <Ionicons name="rocket" size={13} color="#FFFFFF" />
            <Text style={styles.upgradeBtnText}>{access?.plan_active ? 'Change' : 'Upgrade'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Redeem coupon / beta code */}
      <View style={styles.extraCard}>
        <Text style={styles.extraLabel}>REDEEM CODE / COUPON</Text>
        <View style={{ flexDirection: 'row' }}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="e.g. BETA3"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
            style={styles.input}
          />
          <TouchableOpacity
            onPress={onRedeem}
            disabled={!code.trim() || redeeming}
            activeOpacity={0.8}
            style={[styles.redeemBtn, (!code.trim() || redeeming) && { opacity: 0.5 }]}
          >
            {redeeming
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.redeemBtnText}>Redeem</Text>}
          </TouchableOpacity>
        </View>
        <Text style={styles.extraHint}>
          Invitation codes extend your trial or unlock Full Access.
        </Text>
      </View>

      {/* v8.15.4 — Cosmic theme switch (gold-glow when on) */}
      <View style={{ marginTop: 4, marginBottom: 6 }}>
        <CosmicThemeToggle />
      </View>

      {/* Vidhaata Memory section */}
      <View style={{ marginTop: 4, marginBottom: 10 }}>
        <VidhaataMemorySection authUserEmail={authUser?.email} />
      </View>

      {/* Device ID footer */}
      {(profile?.device_id || deviceId) ? (
        <Text selectable style={styles.deviceId}>
          Device ID · {profile?.device_id || deviceId}
        </Text>
      ) : null}
    </View>
  );

  // ---------- Render ----------
  // PersonalDetailsForm handles its own SafeAreaView + KeyboardAvoidingView.
  return (
    <PersonalDetailsForm
      authUser={{ name: authUser?.name, email: authUser?.email, picture: authUser?.picture }}
      initial={initial}
      hideHero
      submitLabel="Save changes"
      footerExtras={footerExtras}
      onDone={handleDone}
    />
  );
};

// ===========================================================================
// Styles — only for the footerExtras block; form fields are styled by
// PersonalDetailsForm itself.
// ===========================================================================
const styles = StyleSheet.create({
  idCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.primary100, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14, marginTop: 4,
    flexWrap: 'wrap',
  },
  idCardText: { fontSize: 12, color: theme.colors.primary800, fontWeight: '600' },
  extraCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1,
    borderColor: theme.colors.primary100, padding: 12, marginTop: 8, marginBottom: 12,
  },
  extraLabel: {
    fontSize: 11, color: '#64748B', fontWeight: '800',
    letterSpacing: 0.8, marginBottom: 7,
  },
  accessPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14, borderWidth: 1.2,
  },
  accessPillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  accessSub: { flex: 1, marginHorizontal: 10, fontSize: 11.5, color: '#475569' },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.primary700,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
  },
  upgradeBtnText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.5 },
  input: {
    flex: 1,
    borderWidth: 1, borderColor: theme.colors.primary100,
    backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 11, fontSize: 14, color: '#0F172A',
  },
  redeemBtn: {
    marginLeft: 8, backgroundColor: theme.colors.primary700,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', minWidth: 80,
  },
  redeemBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  extraHint: { fontSize: 11, color: '#64748B', marginTop: 6, lineHeight: 15 },
  deviceId: {
    fontSize: 10, color: '#94A3B8', marginTop: 14, marginBottom: 8,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default ProfileScreenV2;
