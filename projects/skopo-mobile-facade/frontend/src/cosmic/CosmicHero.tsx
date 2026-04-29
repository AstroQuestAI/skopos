/**
 * CosmicHero — the "Today's Briefing" card from theme26/.
 *
 * A glass card with:
 *   - top row: date + cosmic alignment score pill
 *   - moon row: glowing moon orb + phase name + description line
 *   - cosmic quote: italic divider with a planet glyph + a one-line
 *     personalised reading
 *
 * All text is data-driven via props so it can speak the user's actual
 * mahadasha / nakshatra / sign on render. Renders only on web for the
 * full glass effect (RN Native fallback returns a plain dark card).
 */

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { cosmicTokens as T } from './tokens';

interface Props {
  greeting?: string;          // "Today's Briefing · 6:00 AM"
  scorePill?: string;         // "84"
  scoreLabel?: string;        // "Cosmic Alignment"
  phaseTitle?: string;        // "Waxing Gibbous"
  phaseSub?: string;          // "72% illuminated · Moon in Cancer · 3 active transits"
  // The italic cosmic-quote at the bottom of the card.
  quotePlanet?: string;       // "♃ Jupiter"
  quoteText?: string;         // "trines your natal Venus — a day of unexpected abundance…"
}

export function CosmicHero({
  greeting = "Today's Briefing",
  scorePill = '—',
  scoreLabel = 'Cosmic Alignment',
  phaseTitle = 'Waxing Gibbous',
  phaseSub = '',
  quotePlanet,
  quoteText,
}: Props) {
  const isWeb = Platform.OS === 'web';
  return (
    <View style={[styles.card, isWeb && (webOnly.card as any)]}>
      <View style={styles.topRow}>
        <Text style={styles.date}>{greeting}</Text>
        <View style={[styles.scorePill, isWeb && (webOnly.scorePill as any)]}>
          <Text style={styles.scoreNum}>{scorePill}</Text>
          <Text style={styles.scoreLabel}> {scoreLabel.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.moonRow}>
        <View style={[styles.moon, isWeb && (webOnly.moon as any)]} />
        <View style={styles.moonInfo}>
          <Text style={styles.moonH3}>MOON PHASE</Text>
          <Text style={[styles.phaseName, isWeb && (webOnly.glow as any)]}>{phaseTitle}</Text>
          {phaseSub ? <Text style={styles.phasePct}>{phaseSub}</Text> : null}
        </View>
      </View>
      {(quotePlanet || quoteText) ? (
        <View style={[styles.quote, isWeb && (webOnly.quote as any)]}>
          <Text style={styles.quoteText}>
            {quotePlanet ? <Text style={[styles.quotePlanet, isWeb && (webOnly.glow as any)]}>{quotePlanet} </Text> : null}
            {quoteText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// RN Stylesheet (cross-platform safe)
const styles = StyleSheet.create({
  card: {
    padding: 22,
    paddingBottom: 22,
    borderRadius: 24,
    backgroundColor: 'rgba(34,22,71,0.62)',
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  date: {
    fontSize: 10,
    fontWeight: '600',
    color: T.textMu,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: T.rPill,
    backgroundColor: 'rgba(201,168,76,0.14)',
  },
  scoreNum: {
    fontSize: 13,
    fontWeight: '700',
    color: T.goldLight,
    letterSpacing: 1,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: T.goldLight,
    letterSpacing: 1.6,
  },
  moonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  moon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: T.goldLight,
  },
  moonInfo: { flex: 1 },
  moonH3: {
    fontSize: 11,
    fontWeight: '600',
    color: T.goldLight,
    letterSpacing: 2,
    marginBottom: 4,
  },
  phaseName: {
    fontSize: 18,
    fontWeight: '700',
    color: T.text,
    marginBottom: 4,
  },
  phasePct: {
    fontSize: 11,
    color: T.text2,
  },
  quote: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 2,
    borderLeftColor: T.gold,
    borderRadius: 10,
    backgroundColor: 'rgba(201,168,76,0.06)',
  },
  quoteText: {
    fontSize: 13,
    lineHeight: 20,
    color: T.text,
    fontStyle: 'italic',
  },
  quotePlanet: {
    color: T.gold,
    fontWeight: '700',
    fontStyle: 'normal',
  },
});

// Web-only enhancements (glass blur, glow, planet radial gradient).
const webOnly = {
  card: {
    backgroundImage:
      'linear-gradient(180deg,rgba(34,22,71,0.62) 0%,rgba(26,16,55,0.50) 100%)',
    backdropFilter: 'blur(32px) saturate(160%)',
    WebkitBackdropFilter: 'blur(32px) saturate(160%)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 28px rgba(0,0,0,0.20)',
  },
  scorePill: {
    backgroundImage: 'linear-gradient(135deg, rgba(232,201,106,0.22), rgba(201,168,76,0.10))',
    boxShadow: '0 0 14px rgba(201,168,76,0.18)',
  },
  // Refined planet: golden-amber gibbous with a thin orbital ring.
  moon: {
    backgroundImage:
      'radial-gradient(circle at 30% 28%, #fff5d8 0%, #f0d486 22%, #d29a4a 55%, #6b4a1e 92%)',
    boxShadow:
      'inset -22px -8px 28px rgba(13,8,32,0.85), inset 6px 4px 9px rgba(255,255,255,0.45), 0 0 42px rgba(232,201,106,0.40), 0 0 110px rgba(232,201,106,0.18)',
  },
  glow: {
    textShadow:
      '0 0 1px rgba(245,237,214,0.5), 0 0 16px rgba(201,168,76,0.12)',
  },
  quote: {
    backgroundImage: 'linear-gradient(90deg,rgba(201,168,76,0.08),transparent 80%)',
  },
};

export default CosmicHero;
