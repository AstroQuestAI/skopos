/**
 * CosmicDrawer — slide-in side menu for the new minimal home.
 *
 * Mounted as a Modal so it overlays everything. The drawer panel slides
 * from the right, occupies ~80% of the viewport width on phones, has a
 * scrim behind it, and is dismissed by tapping the scrim or the close
 * button. Each menu row is a Pressable that fires the corresponding
 * navigation handler — the parent decides what each does (open Charts
 * tab, open Profile modal, fire onLogout, etc.).
 */
import React from 'react';
import {
  Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

const C = theme.cosmic;
const isWeb = Platform.OS === 'web';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SRI_CHAKRAM = require('../../assets/cosmic/sri-chakram.png');

export interface DrawerItem {
  id: string;
  label: string;
  icon: any;            // Ionicon name
  tone?: 'default' | 'danger' | 'gold';
  onPress: () => void;
  badge?: string;       // optional right-side chip (e.g. "FULL")
}

interface Props {
  visible: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
  avatarUri?: string | null;
  /** Right-side chip on the user header — e.g. "Trial · 5 days left" */
  statusLabel?: string;
  items: DrawerItem[];
}

export const CosmicDrawer: React.FC<Props> = ({
  visible, onClose, userName, userEmail, avatarUri, statusLabel, items,
}) => {
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(340, width - 48);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.scrim}>
        {/* Tap-to-dismiss scrim */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[s.panel, { width: panelWidth }, isWeb && (web.panel as any)]}>
          {/* Close + brand row */}
          <View style={s.brandRow}>
            <Image source={SRI_CHAKRAM} style={s.brandLogo} />
            <Text style={[s.brandText, isWeb && (web.brand as any)]}>Vidhaata</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={C.cream} />
            </Pressable>
          </View>

          {/* User card */}
          <View style={s.userCard}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Ionicons name="person" size={18} color={C.cream} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.userName} numberOfLines={1}>{userName || 'Guest'}</Text>
              {userEmail ? <Text style={s.userEmail} numberOfLines={1}>{userEmail}</Text> : null}
            </View>
            {statusLabel ? (
              <View style={s.statusChip}><Text style={s.statusChipText}>{statusLabel}</Text></View>
            ) : null}
          </View>

          {/* Menu items */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
            {items.map((it) => {
              const danger = it.tone === 'danger';
              const gold   = it.tone === 'gold';
              return (
                <Pressable
                  key={it.id}
                  onPress={() => { onClose(); setTimeout(it.onPress, 120); }}
                  style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                >
                  <View style={[
                    s.rowIcon,
                    danger && { backgroundColor: 'rgba(196,98,45,0.14)', borderColor: 'rgba(224,122,69,0.40)' },
                    gold   && { backgroundColor: 'rgba(232,201,106,0.16)', borderColor: 'rgba(201,168,76,0.45)' },
                  ]}>
                    <Ionicons
                      name={it.icon}
                      size={16}
                      color={danger ? '#E07A45' : gold ? C.goldHi : C.cream}
                    />
                  </View>
                  <Text style={[
                    s.rowLabel,
                    danger && { color: '#E07A45' },
                    gold   && { color: C.goldHi },
                  ]}>{it.label}</Text>
                  {it.badge ? (
                    <View style={s.rowBadge}>
                      <Text style={s.rowBadgeText}>{it.badge}</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={14} color={C.cream45} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={s.versionText}>Vidhaata · v9.1</Text>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(13, 11, 30, 0.62)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  panel: {
    height: '100%',
    backgroundColor: '#150F2E',
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 22,
    borderLeftWidth: 1,
    borderLeftColor: C.goldLine,
  },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: C.cream10,
  },
  brandLogo: { width: 32, height: 32, resizeMode: 'contain' },
  brandText: {
    fontSize: 18, fontWeight: '800', color: C.goldHi, letterSpacing: 0.4,
    fontFamily: Platform.select({ web: '"Plus Jakarta Sans", "Cinzel", Georgia, serif', default: undefined }),
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.glassSoft,
    borderWidth: 1, borderColor: C.cream10,
  },
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 14,
    backgroundColor: C.glass,
    marginTop: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.cream10,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1.5, borderColor: C.goldLine,
  },
  avatarFallback: {
    backgroundColor: C.glassStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  userName: { color: C.cream, fontSize: 14, fontWeight: '700' },
  userEmail: { color: C.cream65, fontSize: 11.5, marginTop: 2 },
  statusChip: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(232,201,106,0.14)',
    borderWidth: 1, borderColor: C.goldLine,
  },
  statusChipText: { color: C.goldHi, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 6,
    borderRadius: 12,
  },
  rowPressed: { backgroundColor: C.glassSoft },
  rowIcon: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.glassSoft,
    borderWidth: 1, borderColor: C.cream10,
    marginRight: 12,
  },
  rowLabel: { flex: 1, color: C.cream, fontSize: 14, fontWeight: '600' },
  rowBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(232,201,106,0.14)',
    borderWidth: 1, borderColor: C.goldLine,
  },
  rowBadgeText: { color: C.goldHi, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },

  versionText: {
    color: C.cream45,
    fontSize: 10.5,
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.4,
  },
});

const web = {
  panel: {
    backdropFilter: 'blur(28px) saturate(160%)',
    WebkitBackdropFilter: 'blur(28px) saturate(160%)',
    boxShadow: '-12px 0 48px rgba(0,0,0,0.45)',
  },
  brand: {
    backgroundImage: 'linear-gradient(180deg, #E8B86A 0%, #C9A04A 55%, #8A5A1F 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
};

export default CosmicDrawer;
