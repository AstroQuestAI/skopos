/**
 * CosmicFloatingToggle — tiny pill at the bottom-left of every screen
 * that lets ANY visitor (logged-in or not) flip the cosmic theme on/off.
 * Mirrors the in-Profile Switch but as a floating shortcut.
 *
 * Mounted once globally from app/_layout.tsx so it floats above all
 * screens (including PreviewChatLanding and the LoginScreen modal),
 * eliminating the need for the user to ever know about ?cosmic=1.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCosmic, setCosmic } from './useCosmic';
import { cosmicTokens as T } from './tokens';

export const CosmicFloatingToggle: React.FC = () => {
  const on = useCosmic();
  const isWeb = Platform.OS === 'web';
  return (
    <View
      pointerEvents="box-none"
      style={styles.host}
    >
      <Pressable
        onPress={() => setCosmic(!on)}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel={on ? 'Switch to legacy theme' : 'Switch to Cosmic theme'}
        style={({ pressed }) => [
          styles.pill,
          on ? styles.pillOn : styles.pillOff,
          isWeb && (on ? (web.pillOn as any) : (web.pillOff as any)),
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons
          name="sparkles"
          size={13}
          color={on ? T.bgDeep : '#C9A84C'}
          style={{ marginRight: 6 }}
        />
        <Text style={[styles.label, on && styles.labelOn]}>
          {on ? 'Cosmic' : 'Try Cosmic'}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  // Host wrapper sits absolutely at the bottom-left, but is
  // pointer-events: box-none so it never blocks taps elsewhere on the
  // page — only the actual pill captures clicks.
  host: {
    position: 'absolute' as any,
    left: 14, bottom: 14,
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  pillOff: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.55)',
  },
  pillOn: {
    backgroundColor: T.gold,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A6F2E',
    letterSpacing: 0.4,
  },
  labelOn: {
    color: T.bgDeep,
  },
});

const web = {
  pillOff: {
    boxShadow: '0 4px 14px rgba(0,0,0,0.18), 0 0 0 1px rgba(201,168,76,0.30)',
    cursor: 'pointer',
    transition: 'transform .18s ease, box-shadow .18s ease',
  },
  pillOn: {
    backgroundImage: 'linear-gradient(135deg, #E8C96A, #C9A84C)',
    boxShadow:
      '0 0 18px rgba(232,201,106,0.45), 0 4px 14px rgba(201,168,76,0.30), inset 0 1px 0 rgba(255,255,255,0.30)',
    cursor: 'pointer',
    transition: 'transform .18s ease, box-shadow .18s ease',
  },
};

export default CosmicFloatingToggle;
