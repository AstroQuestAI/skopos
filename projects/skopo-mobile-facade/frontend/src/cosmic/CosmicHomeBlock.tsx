/**
 * CosmicHomeBlock — the top section of the cosmic-themed Overview.
 *
 * Composes:
 *   • Greeting line ("Ayushmaan Bhava, <Name>. The skies are aligned…")
 *   • Two-column row (hero "Today's Briefing" + orb "Vidhaata is listening")
 *
 * Adapts to the user's actual chart data when available (current
 * mahadasha, moon nakshatra, ascendant). Falls back to neutral copy
 * otherwise so it still looks polished pre-chart.
 *
 * This component is rendered ABOVE the legacy OverviewTab when the
 * cosmic flag is on — keeping the old tab content intact below.
 */

import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CosmicHero } from './CosmicHero';
import { CosmicAudioBriefing } from './CosmicAudioBriefing';
import { CosmicAskCTA } from './CosmicAskCTA';
import { cosmicTokens as T } from './tokens';

interface ChartLike {
  chart_data?: { ascendant_sign?: string };
  moon_sign?: string;
  moon_nakshatra?: string;
  dasha_info?: {
    current_mahadasha?: { planet?: string; planet_local?: string };
  };
}

interface Props {
  firstName?: string;
  result?: ChartLike | null;
  panchanga?: any;
  /** Called when user taps "Ask Vidhaata" CTA (open chat overlay). */
  onAsk?: () => void;
}

const PLANET_GLYPH: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mars: '♂', Mercury: '☿',
  Jupiter: '♃', Venus: '♀', Saturn: '♄', Rahu: '☊', Ketu: '☋',
};

function computeBriefing(result?: ChartLike | null) {
  const dashaPlanet = result?.dasha_info?.current_mahadasha?.planet || '';
  const moonSign = result?.moon_sign || '';
  const moonNak = result?.moon_nakshatra || '';
  // Quote line — tries to be specific; otherwise a friendly neutral.
  if (dashaPlanet) {
    const glyph = PLANET_GLYPH[dashaPlanet] || '✦';
    return {
      planet: `${glyph} ${dashaPlanet}`,
      text:
        moonSign
          ? `is your current Mahadasha lord; the Moon transits ${moonSign}${moonNak ? ` (${moonNak})` : ''} — a window for clarity and grounded action.`
          : `is your current Mahadasha lord — its themes shape every conversation today.`,
    };
  }
  return {
    planet: '☽ The Moon',
    text:
      moonNak
        ? `is in ${moonNak} — your intuition is sharp this morning. Lean into stillness before speaking.`
        : `is on the move — pay attention to which conversations open today.`,
  };
}

function nowGreeting(): string {
  // "Today's Briefing · 6:00 AM"
  try {
    const now = new Date();
    const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `Today's Briefing · ${time}`;
  } catch {
    return "Today's Briefing";
  }
}

function dayHeader(): string {
  // "Saturday · April 25 · Waxing Gibbous" (no real moon-phase API yet)
  try {
    const now = new Date();
    return now.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  } catch { return 'Today'; }
}

export function CosmicHomeBlock({ firstName, result, panchanga, onAsk }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const isWeb = Platform.OS === 'web';

  const brief = useMemo(() => computeBriefing(result), [result]);
  const ascendant = result?.chart_data?.ascendant_sign;
  const phaseSub = useMemo(() => {
    const parts: string[] = [];
    if (result?.moon_sign) parts.push(`Moon in ${result.moon_sign}`);
    if (ascendant)        parts.push(`${ascendant} rising`);
    if (panchanga?.tithi || panchanga?.tithi_name) {
      parts.push(panchanga.tithi || panchanga.tithi_name);
    }
    return parts.slice(0, 3).join(' · ');
  }, [result, ascendant, panchanga]);

  const phaseTitle =
    panchanga?.nakshatra || panchanga?.nakshatra_name ||
    result?.moon_nakshatra ||
    'Today\u2019s Sky';

  const greetingName = (firstName || 'Seeker').trim();

  return (
    <View style={styles.wrap}>
      {/* greeting line — ayushmaan bhava */}
      <View style={styles.greeting}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.eyebrowDot, isWeb && (webOnly.eyebrowDot as any)]} />
          <Text style={styles.eyebrow}>{dayHeader()}</Text>
        </View>
        <Text style={[styles.h2, isWeb && (webOnly.h2 as any)]}>
          Ayushmaan Bhava, <Text style={[styles.h2Em, isWeb && (webOnly.h2Em as any)]}>{greetingName}</Text>.
        </Text>
        <Text style={styles.sub}>
          {ascendant
            ? `${ascendant} is rising on your eastern horizon — a day shaped by ${ascendant.toLowerCase()}'s themes.`
            : 'The skies are speaking softly — settle in and listen.'}
        </Text>
      </View>

      {/* two-column on wide, stacked on phone */}
      <View style={[styles.row, isWide && styles.rowWide]}>
        <View style={[styles.col, isWide && styles.colHero]}>
          <CosmicHero
            greeting={nowGreeting()}
            scorePill="✦"
            scoreLabel="Cosmic Alignment"
            phaseTitle={phaseTitle}
            phaseSub={phaseSub}
            quotePlanet={brief.planet}
            quoteText={brief.text}
          />
        </View>
        <View style={[styles.col, isWide && styles.colOrb]}>
          <CosmicAudioBriefing
            title={`Good ${greetingTime()}, ${greetingName.split(' ')[0]}`}
            subtitle="Your cosmic briefing is ready"
            duration="3:07"
          />
        </View>
      </View>

      {/* sticky-style "Ask Vidhaata" CTA — gold-amber gradient mic pill */}
      <CosmicAskCTA label="Ask Vidhaata" onPress={onAsk} />
    </View>
  );
}

function greetingTime(): string {
  try {
    const h = new Date().getHours();
    if (h < 5)  return 'evening';
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  } catch { return 'morning'; }
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  greeting: { marginBottom: 14 },
  eyebrowRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 8, gap: 8,
  },
  eyebrowDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: T.gold,
  },
  eyebrow: {
    fontSize: 10, fontWeight: '600', letterSpacing: 3,
    color: T.gold, textTransform: 'uppercase',
  },
  h2: {
    fontSize: 24, fontWeight: '700', color: T.text,
    lineHeight: 30, letterSpacing: -0.4,
  },
  h2Em: {
    color: T.goldLight, fontWeight: '700',
  },
  sub: {
    marginTop: 8, fontSize: 13.5, lineHeight: 20, color: T.text2, maxWidth: 600,
  },
  row: { flexDirection: 'column', gap: 14 },
  rowWide: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  colHero: { flex: 7 },
  colOrb:  { flex: 5 },
});

const webOnly = {
  eyebrowDot: {
    boxShadow: '0 0 8px #C9A84C',
    animation: 'aq-pulse-dot 1.8s ease-in-out infinite',
  },
  h2: {
    textShadow:
      '0 0 1px rgba(245,237,214,0.5), 0 0 16px rgba(201,168,76,0.10), 0 0 32px rgba(201,168,76,0.05)',
  },
  h2Em: {
    backgroundImage: 'linear-gradient(135deg,#E8C96A,#C9A84C 60%,#E07A45)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    filter: 'drop-shadow(0 0 8px rgba(201,168,76,0.22))',
  },
};

export default CosmicHomeBlock;
