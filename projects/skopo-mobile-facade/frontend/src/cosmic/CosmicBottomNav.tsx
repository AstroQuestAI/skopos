/**
 * CosmicBottomNav — floating glass-pill bottom navigation with a gold
 * mic ORB floating above the centre slot (matches reference screenshot
 * 2 — the design the user re-confirmed in v9.4.2).
 *
 * Layout:
 *   ┌──────────────────────────────────────────┐
 *   │              ╭──────╮                    │   ← floating mic orb
 *   │              │  🎙   │                    │     (golden, glowing)
 *   │              ╰──────╯                    │
 *   │   ╔═══════════════════════════════════╗  │
 *   │   ║  ⊕     ⌚     ╳     ▦     👤     ║  │   ← glass pill, 4 tabs
 *   │   ║Overview Today      Charts Profile║  │     (orb sits over the
 *   │   ╚═══════════════════════════════════╝  │      empty centre slot)
 *   └──────────────────────────────────────────┘
 *
 * The orb is a separate Pressable so its hit-target stays large and
 * never collides with the inner tab presses.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

const C = theme.cosmic;
const isWeb = Platform.OS === 'web';

export type CosmicNavKey = 'overview' | 'today' | 'chart' | 'profile' | 'settings';

// v9.5 — Overview is hidden (kept in the type for back-compat). Tabs are
// Today / Charts (mic) / Profile / Settings — matching the 5 home modes
// the app currently exposes. To bring Overview back, just re-add it.
const ITEMS: Array<{ key: CosmicNavKey; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { key: 'today',    icon: 'time-outline',     label: 'Today' },
  { key: 'chart',    icon: 'apps-outline',     label: 'Charts' },
  // [center: floating mic orb]
  { key: 'profile',  icon: 'person-outline',   label: 'Profile' },
  { key: 'settings', icon: 'settings-outline', label: 'Settings' },
];

interface Props {
  active?: CosmicNavKey;
  onNavigate?: (key: CosmicNavKey) => void;
  onAsk: () => void;
}

export const CosmicBottomNav: React.FC<Props> = ({ active, onNavigate, onAsk }) => {
  const left  = ITEMS.slice(0, 2);
  const right = ITEMS.slice(2);
  return (
    <View style={s.wrap} pointerEvents="box-none">
      {/* Glass pill */}
      <View style={[s.bar, isWeb && (s.barWeb as any)]}>
        {left.map((it) => (
          <NavIcon key={it.key} item={it} active={active === it.key} onPress={() => onNavigate?.(it.key)} />
        ))}
        <View style={s.middleSpacer} />
        {right.map((it) => (
          <NavIcon key={it.key} item={it} active={active === it.key} onPress={() => onNavigate?.(it.key)} />
        ))}
      </View>

      {/* Floating mic orb above the centre slot */}
      <Pressable
        onPress={onAsk}
        accessibilityLabel="Ask Vidhaata"
        style={({ pressed }) => [s.orb, isWeb && (s.orbWeb as any), pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <Ionicons name="mic" size={24} color="#1A0F3D" />
        <Text style={s.orbSparkle}>✦</Text>
      </Pressable>
    </View>
  );
};

const NavIcon: React.FC<{
  item: typeof ITEMS[number];
  active?: boolean;
  onPress?: () => void;
}> = ({ item, active, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [s.cell, pressed && { opacity: 0.85 }]}
    accessibilityLabel={item.label}
  >
    <View style={[s.iconBubble, active && s.iconBubbleActive]}>
      <Ionicons name={item.icon} size={18} color={active ? '#1A0F3D' : C.cream} />
    </View>
    <Text style={[s.cellLabel, active && s.cellLabelActive]} numberOfLines={1}>{item.label}</Text>
  </Pressable>
);

const s = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 36, // headroom for the orb
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 32,
    backgroundColor: 'rgba(34,22,71,0.86)',
    borderWidth: 1, borderColor: C.cream10,
    width: '100%',
  },
  barWeb: {
    backdropFilter: 'blur(24px) saturate(160%)',
    WebkitBackdropFilter: 'blur(24px) saturate(160%)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
  } as any,
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minWidth: 56,
  },
  iconBubble: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(245,237,214,0.06)',
    borderWidth: 1, borderColor: 'rgba(245,237,214,0.10)',
  },
  iconBubbleActive: {
    backgroundColor: '#E8C96A',
    borderColor: '#E8C96A',
  },
  cellLabel: {
    color: C.cream65,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  cellLabelActive: { color: C.goldHi },

  middleSpacer: { width: 72 },

  orb: {
    position: 'absolute',
    top: 4,           // sits inside the headroom we reserved
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E8C96A',
    borderWidth: 2, borderColor: 'rgba(255,236,180,0.85)',
  },
  orbWeb: {
    backgroundImage: 'radial-gradient(circle at 50% 35%, #FFE8A6 0%, #F2C75A 45%, #C9851F 100%)',
    boxShadow: '0 0 48px rgba(242,199,90,0.65), 0 18px 36px rgba(201,133,31,0.55), inset 0 1px 0 rgba(255,255,255,0.40)',
    cursor: 'pointer',
  } as any,
  orbSparkle: {
    position: 'absolute',
    top: 10, right: 14,
    color: '#1A0F3D', fontSize: 10, fontWeight: '900',
    opacity: 0.9,
  },
});

export default CosmicBottomNav;
