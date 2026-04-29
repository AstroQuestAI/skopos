/**
 * AppHeader — v9.0 native cosmic rewrite.
 *
 * Layout (mobile-first, thumb-reachable):
 *   [GuruAvatar | AstroQuest]   ·   [UPGRADE?]  [Trial chip?]  [🏠]  [Avatar]  [⏻]
 *
 *   • The header is a transparent strip — it sits on top of the global
 *     cosmic backdrop, separated from page content by a single
 *     gold-line hairline.
 *   • All chips and icon buttons use the cosmic glass treatment —
 *     no white pills, no indigo fills.
 *   • Upgrade is a saffron→gold gradient pill (only shown when the
 *     caller passes onUpgrade; hidden for paid users).
 */
import React from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GuruAvatar } from './GuruAvatar';
import { theme } from '../theme';

interface ActiveLocation {
  name: string;
  lat: number;
  lon: number;
  tzOffset: number;
}

interface Props {
  /** Kept for API compat — header no longer renders date/time/location. */
  activeLoc: ActiveLocation;
  onChangeLocation: () => void;
  onOpenProfile: () => void;
  onHome?: () => void;
  onLogout?: () => void;
  onUpgrade?: () => void;
  avatarPicture?: string | null;
  avatarInitial?: string;
  statusChip?: { label: string; tone: 'trial' | 'active' | 'expired' };
}

const C = theme.cosmic;
const isWeb = Platform.OS === 'web';

export const AppHeader: React.FC<Props> = ({
  onOpenProfile, onHome, onLogout, onUpgrade,
  avatarPicture, statusChip,
}) => {
  return (
    <View style={[styles.wrap, isWeb && (web.wrap as any)]}>
      {/* Brand */}
      <TouchableOpacity
        onPress={onHome}
        activeOpacity={onHome ? 0.75 : 1}
        style={styles.brand}
      >
        <GuruAvatar size={36} glow={false} />
        <Text style={[styles.brandText, isWeb && (web.brandText as any)]} numberOfLines={1}>
          AstroQuest
        </Text>
      </TouchableOpacity>

      <View style={{ flex: 1 }} />

      {/* Right cluster */}
      <View style={styles.rightWrap}>
        {onUpgrade ? (
          <TouchableOpacity
            onPress={onUpgrade}
            activeOpacity={0.85}
            hitSlop={6}
            style={[styles.upgradePill, isWeb && (web.upgradePill as any)]}
          >
            <Ionicons name="rocket" size={11} color="#1A1535" />
            <Text style={styles.upgradePillText}>UPGRADE</Text>
          </TouchableOpacity>
        ) : null}

        {statusChip && statusChip.tone !== 'active' ? (
          <View style={[
            styles.chipBase,
            statusChip.tone === 'expired' ? styles.chipExpired : styles.chipTrial,
          ]}>
            <Text style={[
              styles.chipText,
              statusChip.tone === 'expired' && { color: C.terracottaLight },
            ]}>{statusChip.label}</Text>
          </View>
        ) : null}

        {onHome ? (
          <TouchableOpacity onPress={onHome} hitSlop={8} style={[styles.iconBtn, isWeb && (web.glass as any)]}>
            <Ionicons name="home" size={16} color={C.cream} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={onOpenProfile} hitSlop={8} activeOpacity={0.75}>
          {avatarPicture ? (
            <Image source={{ uri: avatarPicture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={15} color={C.cream} />
            </View>
          )}
        </TouchableOpacity>

        {onLogout ? (
          <TouchableOpacity onPress={onLogout} hitSlop={8} style={[styles.iconBtn, isWeb && (web.glass as any)]}>
            <Ionicons name="log-out-outline" size={17} color={C.terracottaLight} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(13, 11, 30, 0.55)',
    borderBottomWidth: 1,
    borderBottomColor: C.goldLine,
    gap: 10,
  },
  brand: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minWidth: 110, maxWidth: 170,
  },
  brandText: {
    fontSize: 17, fontWeight: '800', color: C.goldHi,
    letterSpacing: 0.4,
  },
  rightWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  iconBtn: {
    paddingHorizontal: 7, paddingVertical: 6, borderRadius: 10,
    backgroundColor: C.glassSoft,
    borderWidth: 1, borderColor: C.cream10,
  },
  chipBase: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    borderWidth: 1,
  },
  chipTrial:   { backgroundColor: 'rgba(232,201,106,0.14)', borderColor: C.goldLine },
  chipExpired: { backgroundColor: 'rgba(196,98,45,0.14)',   borderColor: 'rgba(224,122,69,0.40)' },
  chipText: {
    fontSize: 10, fontWeight: '800', letterSpacing: 0.5,
    color: C.goldHi,
  },
  upgradePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: C.goldHi,
  },
  upgradePillText: {
    fontSize: 10.5, fontWeight: '900', color: '#1A1535', letterSpacing: 0.7,
  },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.goldLine,
  },
  avatarFallback: {
    backgroundColor: C.glassStrong,
    alignItems: 'center', justifyContent: 'center',
  },
});

const web = {
  wrap: {
    backdropFilter: 'blur(18px) saturate(150%)',
    WebkitBackdropFilter: 'blur(18px) saturate(150%)',
  },
  brandText: {
    backgroundImage: 'linear-gradient(180deg, #E8B86A 0%, #C9A04A 55%, #8A5A1F 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  glass: {
    backdropFilter: 'blur(14px) saturate(140%)',
    WebkitBackdropFilter: 'blur(14px) saturate(140%)',
  },
  upgradePill: {
    backgroundImage: 'linear-gradient(180deg, #F0D586 0%, #C9A84C 100%)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.20) inset, 0 4px 14px rgba(201,168,76,0.25)',
  },
};

export default AppHeader;
