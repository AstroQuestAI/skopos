/**
 * CosmicBirthChartPage — matches reference screenshot 3.
 *
 *   YOUR STARS
 *   Birth Chart
 *
 *   ┌────────────────────────────────────┐
 *   │ MOON SIGN                          │
 *   │ Dhanu                              │
 *   │ Nakshatra · Purva Ashadha          │
 *   └────────────────────────────────────┘
 *
 *   ┌────────────────────────────────────┐
 *   │ BORN UNDER                         │
 *   │ Date   1980-08-22                  │
 *   │ Time   12:30                       │
 *   │ Place  Nellore                     │
 *   └────────────────────────────────────┘
 *
 *   LIVE PLANETARY TRANSITS
 *   ┌──────────────────────────────────────────┐
 *   │ ✦   Surya                                │
 *   │     Mesha                                │
 *   └──────────────────────────────────────────┘
 */
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import { MellowText } from './MellowText';

const C = theme.cosmic;
const isWeb = Platform.OS === 'web';

export interface TransitRow {
  planetLocal: string;        // "Surya"
  signLocal: string;          // "Mesha"
  glyph?: string;             // ✦ / ☉ / ☽
  retrograde?: boolean;
}

interface Props {
  moonSignLocal?: string;     // "Dhanu"
  moonNakshatraLocal?: string;// "Purva Ashadha"
  /** 1..4 nakshatra pada the Moon falls in. */
  moonNakshatraPada?: number | string;
  dob?: string;
  tob?: string;
  place?: string;
  transits: TransitRow[];
}

const PLANET_GLYPHS: Record<string, string> = {
  Sun: '☉', Surya: '☉', Moon: '☽', Chandra: '☽',
  Mars: '♂', Mangala: '♂', Kuja: '♂',
  Mercury: '☿', Budha: '☿',
  Jupiter: '♃', Guru: '♃', Brihaspati: '♃',
  Venus: '♀', Shukra: '♀',
  Saturn: '♄', Shani: '♄',
  Rahu: '☊', Ketu: '☋',
};

// Vedic rāśi → Unicode zodiac glyph for the hero rashi disc.
const RASHI_GLYPHS: Record<string, string> = {
  Mesha: '♈',  Vrishabha: '♉', Mithuna: '♊', Karkata: '♋',
  Karkataka: '♋', Karka: '♋',
  Simha: '♌',  Kanya: '♍',     Tula: '♎',    Vrischika: '♏',
  Dhanu: '♐',  Makara: '♑',    Kumbha: '♒',  Meena: '♓',
};

export const CosmicBirthChartPage: React.FC<Props> = ({
  moonSignLocal, moonNakshatraLocal, moonNakshatraPada, dob, tob, place, transits,
}) => {
  const rashiGlyph = (moonSignLocal && RASHI_GLYPHS[moonSignLocal]) || '✦';
  return (
    <ScrollView style={s.root} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <Text style={s.kicker}>YOUR STARS</Text>
      <MellowText style={s.title} glowColor="#F5EDD6" duration={4400} minOpacity={0.86}>
        Birth Chart
      </MellowText>

      <View style={[s.heroCard, isWeb && (s.cardWeb as any)]}>
        <Text style={s.cardKicker}>MOON SIGN</Text>

        {/* Rāśi glyph in a glossy gold/orange/yellow disc */}
        <View style={s.rashiDiscWrap}>
          <View style={[s.rashiRing, isWeb && (s.rashiRingWeb as any)]} />
          <View style={[s.rashiDisc, isWeb && (s.rashiDiscWeb as any)]}>
            <MellowText style={s.rashiGlyph} glowColor="#F2C75A" duration={3600} minOpacity={0.78}>
              {rashiGlyph}
            </MellowText>
          </View>
        </View>

        <MellowText style={s.heroValue} glowColor="#F2C75A" duration={3800} minOpacity={0.82}>
          {moonSignLocal || '—'}
        </MellowText>
        <View style={s.heroRow}>
          <View style={s.heroCell}>
            <Text style={s.heroCellKicker}>NAKSHATRA</Text>
            <MellowText style={s.heroCellValue} glowColor="#F2C75A" duration={4200} minOpacity={0.84}>
              {moonNakshatraLocal || '—'}
            </MellowText>
          </View>
          <View style={s.heroCellDivider} />
          <View style={s.heroCell}>
            <Text style={s.heroCellKicker}>PADA</Text>
            <MellowText style={s.heroCellValue} glowColor="#F2C75A" duration={4600} minOpacity={0.84}>
              {moonNakshatraPada ? String(moonNakshatraPada) : '—'}
            </MellowText>
          </View>
        </View>
      </View>

      <View style={[s.card, isWeb && (s.cardWeb as any)]}>
        <Text style={s.cardKicker}>BORN UNDER</Text>
        <Row label="Date"  value={dob || '—'} />
        <Row label="Time"  value={tob || '—'} />
        <Row label="Place" value={place || '—'} />
      </View>

      <Text style={[s.cardKicker, { marginTop: 26, paddingLeft: 4, marginBottom: 12 }]}>LIVE PLANETARY TRANSITS</Text>
      {transits.length === 0 ? (
        <Text style={s.empty}>Transits will appear once the chart is computed.</Text>
      ) : (
        transits.map((t, i) => (
          <View key={`${t.planetLocal}-${i}`} style={[s.transitCard, isWeb && (s.cardWeb as any)]}>
            <View style={s.transitGlyph}>
              <Text style={s.transitGlyphText}>{t.glyph || PLANET_GLYPHS[t.planetLocal] || '✦'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <MellowText style={s.transitPlanet} glowColor="#F5EDD6" duration={4800} minOpacity={0.88}>
                {`${t.planetLocal}${t.retrograde ? ' ℞' : ''}`}
              </MellowText>
              <Text style={s.transitSign}>{t.signLocal}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={s.row}>
    <Text style={s.rowLabel}>{label}</Text>
    <Text style={s.rowValue}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgDeep },
  scroll: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 140 },
  kicker: { color: C.cream45, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: C.cream, fontSize: 38, fontWeight: '800', letterSpacing: -0.5, marginTop: 4, marginBottom: 22 },

  heroCard: {
    padding: 22, borderRadius: 22,
    backgroundColor: 'rgba(26, 18, 56, 0.62)',  // softer violet, more glass
    borderWidth: 1, borderColor: C.goldLine,
    marginBottom: 18,
    alignItems: 'center',
  },
  card: { padding: 18, borderRadius: 18, backgroundColor: 'rgba(38, 26, 80, 0.45)' },
  cardWeb: {
    backdropFilter: 'blur(28px) saturate(140%)',
    WebkitBackdropFilter: 'blur(28px) saturate(140%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 28px rgba(0,0,0,0.20)',
  } as any,
  cardKicker: { color: C.goldHi, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10, alignSelf: 'flex-start' },

  // Rāśi glyph disc — gold/orange/yellow gradient with breathing ring.
  rashiDiscWrap: {
    width: 156, height: 156,
    alignItems: 'center', justifyContent: 'center',
    marginVertical: 8,
  },
  rashiRing: {
    position: 'absolute',
    width: 156, height: 156, borderRadius: 78,
    backgroundColor: 'rgba(232,201,106,0.10)',
    borderWidth: 1, borderColor: 'rgba(242,199,90,0.35)',
  },
  rashiRingWeb: {
    boxShadow: '0 0 60px rgba(242,199,90,0.30), inset 0 0 24px rgba(232,201,106,0.20)',
  } as any,
  rashiDisc: {
    width: 124, height: 124, borderRadius: 62,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E8C96A',
    borderWidth: 2, borderColor: 'rgba(255,236,180,0.75)',
  },
  rashiDiscWeb: {
    backgroundImage: 'radial-gradient(circle at 50% 35%, #FFE8A6 0%, #F2C75A 45%, #C9851F 100%)',
    boxShadow: '0 0 40px rgba(242,199,90,0.55), 0 12px 32px rgba(201,133,31,0.35), inset 0 2px 0 rgba(255,255,255,0.4)',
  } as any,
  rashiGlyph: {
    fontSize: 64, fontWeight: '800',
    color: '#1A0F3D',
    lineHeight: 70,
  },

  heroValue: { color: C.goldHi, fontSize: 28, fontWeight: '800', letterSpacing: -0.3, marginVertical: 4, textAlign: 'center' },
  heroRow: {
    flexDirection: 'row', alignItems: 'stretch',
    marginTop: 14,
    width: '100%',
  },
  heroCell: { flex: 1, paddingVertical: 4, alignItems: 'center' },
  heroCellDivider: {
    width: 1, marginHorizontal: 14,
    backgroundColor: 'rgba(245,237,214,0.12)',
  },
  heroCellKicker: { color: 'rgba(245,237,214,0.50)', fontSize: 10, fontWeight: '800', letterSpacing: 1.0, marginBottom: 4 },
  heroCellValue:  { color: C.goldHi, fontSize: 16, fontWeight: '700', letterSpacing: -0.1, textAlign: 'center' },
  heroSub: { fontSize: 14, marginTop: 8 },
  cream65: { color: C.cream65 },
  gold: { color: C.goldHi, fontWeight: '700' },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { color: C.cream65, fontSize: 14 },
  rowValue: { color: C.cream, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },

  empty: { color: C.cream65, fontSize: 13, paddingVertical: 8 },
  transitCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 16,
    backgroundColor: C.glass,
    marginBottom: 10,
  },
  transitGlyph: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(232,201,106,0.16)',
    borderWidth: 1, borderColor: C.goldLine,
    marginRight: 14,
  },
  transitGlyphText: { color: C.goldHi, fontSize: 18, fontWeight: '800' },
  transitPlanet: { color: C.cream, fontSize: 18, fontWeight: '700' },
  transitSign: { color: C.cream65, fontSize: 13, marginTop: 2 },
});

export default CosmicBirthChartPage;
