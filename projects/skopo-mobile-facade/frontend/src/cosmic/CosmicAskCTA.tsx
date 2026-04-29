/**
 * CosmicAskCTA — sticky gold→amber gradient mic pill that lives at the
 * bottom of the home/briefing surface. Tap = open the Vidhaata chat.
 *
 * Mirrors the mobile POC's "Ask AstroGuide" CTA exactly: full-width
 * rounded pill, horizontal gold→amber linear gradient, soft glow halo
 * underneath, mic icon + label + sparkle.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cosmicTokens as T } from './tokens';

interface Props {
  label?: string;
  onPress?: () => void;
}

export const CosmicAskCTA: React.FC<Props> = ({
  label = 'Ask Vidhaata',
  onPress,
}) => {
  const isWeb = Platform.OS === 'web';
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pill,
          isWeb && (web.pill as any),
          pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name="mic" size={16} color={T.bgDeep} style={{ marginRight: 8 }} />
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sparkle}>  ✦</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: T.gold,
  },
  label: {
    color: T.bgDeep,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  sparkle: {
    color: T.bgDeep,
    fontSize: 14,
    fontWeight: '700',
  },
});

const web = {
  pill: {
    backgroundImage: 'linear-gradient(90deg, #F2C75A 0%, #E8A24A 50%, #DD7E3F 100%)',
    boxShadow:
      '0 0 30px rgba(232,201,106,0.35), 0 8px 24px rgba(221,126,63,0.30), inset 0 1px 0 rgba(255,255,255,0.30)',
    cursor: 'pointer',
    transition: 'transform .18s ease, box-shadow .18s ease',
  },
};

export default CosmicAskCTA;
