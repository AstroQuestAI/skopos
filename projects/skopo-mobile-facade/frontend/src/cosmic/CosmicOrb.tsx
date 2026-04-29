/**
 * CosmicOrb — the "Vidhaata is listening" panel from theme26/.
 *
 * A glass card with a glowing gold orb (3 pulsing rings + radial-gradient
 * core), a short prompt, and a gold-gradient "Ask Vidhaata" button.
 * Tapping the button calls onAsk() — wire it to your chat overlay.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cosmicTokens as T } from './tokens';

interface Props {
  title?: string;
  subtitle?: string;
  cta?: string;
  onAsk?: () => void;
}

export function CosmicOrb({
  title = 'Vidhaata is listening',
  subtitle = 'Tap to ask anything about your day, your chart, or a moment that needs guidance.',
  cta = 'Ask Vidhaata',
  onAsk,
}: Props) {
  const isWeb = Platform.OS === 'web';
  return (
    <View style={[styles.card, isWeb && (webOnly.card as any)]}>
      <View style={styles.orbStack}>
        {/* concentric rings */}
        <View style={[styles.ring, isWeb && (webOnly.ring1 as any)]} />
        <View style={[styles.ring, styles.ring2, isWeb && (webOnly.ring2 as any)]} />
        <View style={[styles.ring, styles.ring3, isWeb && (webOnly.ring3 as any)]} />
        {/* sweeping gradient (web only — animated via CSS keyframes injected globally) */}
        {isWeb ? <View style={[styles.sweep, webOnly.sweep as any]} /> : null}
        {/* glowing gold core */}
        <View style={[styles.core, isWeb && (webOnly.core as any)]} />
      </View>

      <Text style={[styles.h3, isWeb && (webOnly.glow as any)]}>{title}</Text>
      <Text style={styles.p}>{subtitle}</Text>

      <Pressable
        onPress={onAsk}
        style={({ pressed }) => [
          styles.askBtn,
          isWeb && (webOnly.askBtn as any),
          pressed && { opacity: 0.9 },
        ]}
      >
        <Ionicons name="mic-outline" size={14} color={T.bgDeep} style={{ marginRight: 6 }} />
        <Text style={styles.askBtnText}>{cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: T.rCard,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: 'rgba(35,29,69,0.55)',
    alignItems: 'center',
    gap: 14,
  },
  orbStack: {
    position: 'relative',
    width: 96,
    height: 96,
  },
  ring: {
    position: 'absolute',
    inset: 0 as any,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.32)',
  },
  ring2: { top: 6, left: 6, right: 6, bottom: 6, borderColor: 'rgba(201,168,76,0.22)' },
  ring3: { top: 14, left: 14, right: 14, bottom: 14, borderColor: 'rgba(201,168,76,0.15)' },
  sweep: {
    position: 'absolute',
    inset: 0 as any,
    borderRadius: 48,
  },
  core: {
    position: 'absolute',
    top: 20, left: 20, right: 20, bottom: 20,
    borderRadius: 28,
    backgroundColor: T.goldLight,
  },
  h3: {
    fontSize: 13.5,
    fontWeight: '600',
    color: T.text,
    textAlign: 'center',
    marginTop: 4,
  },
  p: {
    fontSize: 11.5,
    lineHeight: 17,
    color: T.text2,
    textAlign: 'center',
    maxWidth: 240,
  },
  askBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: T.rPill,
    backgroundColor: T.gold,
    marginTop: 4,
  },
  askBtnText: {
    color: T.bgDeep,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.4,
  },
});

const webOnly = {
  card: {
    backgroundImage:
      'linear-gradient(180deg,rgba(35,29,69,0.55) 0%,rgba(26,21,53,0.45) 100%)',
    backdropFilter: 'blur(28px) saturate(150%)',
    WebkitBackdropFilter: 'blur(28px) saturate(150%)',
    boxShadow:
      '0 0 22px rgba(201,168,76,0.16), 0 0 70px rgba(201,168,76,0.06), inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  ring1: { animation: 'aq-ring-pulse 2.4s ease-in-out infinite' },
  ring2: { animation: 'aq-ring-pulse 2.4s ease-in-out infinite', animationDelay: '0.4s' },
  ring3: { animation: 'aq-ring-pulse 2.4s ease-in-out infinite', animationDelay: '0.8s' },
  sweep: {
    backgroundImage:
      'conic-gradient(from 0deg, transparent 0deg, rgba(232,201,106,0.42) 60deg, transparent 120deg)',
    animation: 'aq-sweep 4s linear infinite',
  },
  core: {
    backgroundImage:
      'radial-gradient(circle at 35% 30%, #E8C96A, #C9A84C 55%, #8A6F2E)',
    boxShadow:
      '0 0 24px rgba(232,201,106,0.50), 0 0 64px rgba(201,168,76,0.22), inset -8px -6px 14px rgba(13,11,30,0.4)',
  },
  glow: {
    textShadow:
      '0 0 1px rgba(245,237,214,0.5), 0 0 16px rgba(201,168,76,0.10)',
  },
  askBtn: {
    backgroundImage: 'linear-gradient(135deg,#E8C96A,#C9A84C)',
    boxShadow:
      '0 4px 14px rgba(201,168,76,0.22), 0 0 0 1px rgba(232,201,106,0.28)',
    cursor: 'pointer',
    transition: 'transform .18s ease, box-shadow .18s ease',
  },
};

export default CosmicOrb;
