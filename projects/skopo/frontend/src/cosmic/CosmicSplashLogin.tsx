/**
 * CosmicSplashLogin — v9.0 clean native rewrite.
 *
 * The first screen any unauthenticated visitor sees:
 *   ── 4-dot page indicator (1st pip gold-filled)
 *   ── dense native starfield (no global CSS dependency)
 *   ── Sri Chakram artwork (bundled brand asset, no border / no halo)
 *   ── "Vidhaata" wordmark — small, dull glossy gold gradient
 *   ── tagline (cream, muted)
 *   ── three glass auth pills:
 *        • Continue with Google  (gold-bordered, primary)
 *        • Continue with Phone   (plain glass)
 *        • Continue as Guest     (plain glass)
 *   ── footer: Terms / Privacy disclaimer
 *
 * Pure presentation — caller wires the onXxx handlers to existing
 * auth flows. Self-contained: no DOM walker, no global CSS hooks.
 */

import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SRI_CHAKRAM = require('../../assets/cosmic/sri-chakram.png');

interface Props {
  onGoogle?: () => void;
  onPhone?: () => void;
  onGuest?: () => void;
  onTermsPress?: () => void;
  /** 0..3 — which onboarding pip is highlighted. */
  step?: number;
}

// ── Pseudo-random star positions (deterministic so they don't jitter). ──
// 64 stars spread across the screen at varied opacity/size for depth.
const STARS: { top: string; left: string; size: number; opacity: number }[] =
  Array.from({ length: 64 }).map((_, i) => {
    // Simple LCG for determinism without importing a PRNG.
    const x = (i * 9301 + 49297) % 233280;
    const y = (i * 17389 + 9176) % 233280;
    const z = (i * 2521 + 11) % 233280;
    return {
      top:     `${(x / 233280) * 100}%`,
      left:    `${(y / 233280) * 100}%`,
      size:    1 + ((z / 233280) * 1.6),         // 1..2.6 px
      opacity: 0.25 + ((z / 233280) * 0.55),     // 0.25..0.80
    };
  });

const Starfield: React.FC = React.memo(() => (
  <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
    {STARS.map((s, i) => (
      <View
        key={i}
        style={{
          position: 'absolute',
          // RN-Web accepts % strings here; on native they coerce to 0 (acceptable).
          top: s.top as any,
          left: s.left as any,
          width: s.size,
          height: s.size,
          borderRadius: s.size / 2,
          backgroundColor: i % 7 === 0 ? '#E8C96A' : '#FFFFFF',
          opacity: s.opacity,
        }}
      />
    ))}
  </View>
));

export const CosmicSplashLogin: React.FC<Props> = ({
  onGoogle, onPhone, onGuest, onTermsPress, step = 0,
}) => {
  const isWeb = Platform.OS === 'web';
  const { width, height } = useWindowDimensions();
  const narrow = width < 480;
  const short  = height < 720;
  const artSize = narrow ? 200 : 230;

  return (
    <View style={styles.root}>
      {/* Solid deep-cosmic backdrop — no halos. */}
      <View pointerEvents="none" style={styles.backdrop} />
      <Starfield />

      {/* 4-dot page indicator */}
      <View style={styles.pipRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.pip,
              i === step ? styles.pipActive : styles.pipDim,
              isWeb && i === step ? (web.pipActive as any) : null,
            ]}
          />
        ))}
      </View>

      {/* center stack */}
      <View style={styles.center}>
        {/* Sri Chakram — flush, no border / circle / halo */}
        <Image
          source={SRI_CHAKRAM}
          style={[
            { width: artSize, height: artSize, resizeMode: 'contain' },
            isWeb && (web.chakramShadow as any),
          ]}
          accessibilityLabel="Sri Chakram"
        />

        {/* wordmark — smaller, dull glossy gold */}
        <Text style={[styles.wordmark, isWeb && (web.wordmark as any), narrow && { fontSize: 28 }]}>
          Vidhaata
        </Text>

        {/* tagline */}
        <Text style={[styles.tagline, narrow && { fontSize: 13 }]}>
          Your personal guide to the cosmos.{'\n'}
          Let the stars illuminate your path.
        </Text>
      </View>

      {/* auth buttons */}
      <View style={[styles.btnStack, short && { gap: 10 }]}>
        <Pressable
          onPress={onGoogle}
          style={({ pressed }) => [
            styles.btn, styles.btnPrimary,
            isWeb && (web.btnPrimary as any),
            pressed && { opacity: 0.92 },
          ]}
        >
          <Text style={[styles.gIcon, isWeb && (web.glow as any)]}>G</Text>
          <Text style={[styles.btnLabel, styles.btnLabelGold, isWeb && (web.glow as any)]}>
            Continue with Google
          </Text>
        </Pressable>

        <Pressable
          onPress={onPhone}
          style={({ pressed }) => [
            styles.btn, styles.btnGlass,
            isWeb && (web.btnGlass as any),
            pressed && { opacity: 0.92 },
          ]}
        >
          <Ionicons name="phone-portrait-outline" size={16} color={theme.cosmic.cream} style={{ marginRight: 10 }} />
          <Text style={styles.btnLabel}>Continue with Phone</Text>
        </Pressable>

        <Pressable
          onPress={onGuest}
          style={({ pressed }) => [
            styles.btn, styles.btnGlass,
            isWeb && (web.btnGlass as any),
            pressed && { opacity: 0.92 },
          ]}
        >
          <Ionicons name="person-outline" size={16} color={theme.cosmic.cream} style={{ marginRight: 10 }} />
          <Text style={styles.btnLabel}>Continue as Guest</Text>
        </Pressable>
      </View>

      {/* footer */}
      <Text style={styles.footer}>
        By continuing, you agree to our{' '}
        <Text onPress={onTermsPress} style={styles.footerLink}>Terms of Service</Text>
        {'\n'}and <Text onPress={onTermsPress} style={styles.footerLink}>Privacy Policy</Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 28,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.cosmic.bgDeep,
  },
  // Solid deep-cosmic backdrop covering the full screen — no gradients, no halos.
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.cosmic.bgDeep,
  },

  // page-indicator pips
  pipRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  pip:    { height: 4, borderRadius: 2 },
  pipActive: { width: 26, backgroundColor: theme.cosmic.gold },
  pipDim:    { width: 18, backgroundColor: 'rgba(245,237,214,0.18)' },

  // center stack
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', gap: 14 },

  wordmark: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.cosmic.gold,
    letterSpacing: 0.6,
    marginTop: 18,
    fontFamily: Platform.select({
      web: '"Plus Jakarta Sans", "Cinzel", Georgia, serif',
      default: undefined,
    }),
  },
  tagline: {
    fontSize: 14,
    color: theme.cosmic.cream65,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 2,
  },

  // auth buttons
  btnStack: { width: '100%', maxWidth: 420, gap: 12 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  btnPrimary: {
    backgroundColor: 'rgba(34, 22, 71, 0.55)',
    borderWidth: 1.5,
    borderColor: theme.cosmic.gold,
  },
  btnGlass: {
    backgroundColor: 'rgba(34, 22, 71, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(245,237,214,0.18)',
  },
  gIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.cosmic.gold,
    marginRight: 12,
    fontFamily: Platform.select({ web: 'Georgia, serif', default: undefined }),
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.cosmic.cream,
    letterSpacing: 0.2,
  },
  btnLabelGold: { color: theme.cosmic.gold },

  // footer
  footer: {
    fontSize: 11.5,
    color: 'rgba(245,237,214,0.45)',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 20,
  },
  footerLink: { color: 'rgba(245,237,214,0.70)', textDecorationLine: 'underline' as any },
});

// ── Web-only embellishments (subtle gloss + chakram glow). ──
// On web we add a soft gold drop-shadow so the chakram feels lit
// without painting any visible halo behind it. The wordmark gets a
// burnished gold→amber→bronze gradient (no glowing text-shadow).
const web = {
  pipActive: { boxShadow: '0 0 8px rgba(232,201,106,0.55)' },
  chakramShadow: {
    filter:
      'drop-shadow(0 0 14px rgba(201,168,76,0.32)) drop-shadow(0 6px 18px rgba(0,0,0,0.45))',
  },
  // Burnished gold → amber → bronze. Clipped to text so we get a metallic feel.
  wordmark: {
    backgroundImage:
      'linear-gradient(180deg, #E8B86A 0%, #C9A04A 45%, #8A5A1F 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    // Subtle highlight + soft inset for the "glossy not glowing" feel.
    textShadow: '0 1px 0 rgba(255,235,170,0.22), 0 0 1px rgba(0,0,0,0.45)',
  },
  btnPrimary: {
    backdropFilter: 'blur(28px) saturate(150%)',
    WebkitBackdropFilter: 'blur(28px) saturate(150%)',
    boxShadow:
      '0 0 0 1px rgba(232,201,106,0.50), 0 0 22px rgba(232,201,106,0.20), inset 0 1px 0 rgba(255,255,255,0.06)',
    cursor: 'pointer',
    transition: 'transform .18s ease, box-shadow .18s ease, opacity .18s ease',
  },
  btnGlass: {
    backdropFilter: 'blur(20px) saturate(140%)',
    WebkitBackdropFilter: 'blur(20px) saturate(140%)',
    boxShadow: '0 4px 14px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
    cursor: 'pointer',
    transition: 'transform .18s ease, box-shadow .18s ease, opacity .18s ease',
  },
  glow: {
    textShadow: '0 0 12px rgba(232,201,106,0.30)',
  },
};

export default CosmicSplashLogin;
