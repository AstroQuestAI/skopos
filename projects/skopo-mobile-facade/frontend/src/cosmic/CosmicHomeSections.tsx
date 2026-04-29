/**
 * CosmicHomeSections — v9.2 cards for the rebuilt Vidhaata home.
 *
 * Exports five drop-in cards used by CosmicHome.tsx:
 *
 *   • TodaysBriefingCard — kicker · alignment score · sun/moon orb +
 *     panchanga line (Date · Tithi · Vara · Nakshatra) + italic body
 *     keynote (mirrors screenshot 1).
 *   • AuspiciousTimingsCard — 3-4 hora rows: glyph + orb-style time pill
 *     + tone-coloured rail + summary (screenshot 2 style).
 *   • YogasCard — chips for active yogas, RAG-tinted (green/amber/red).
 *   • DoshasCard — Kuja · Sade Sati · Kala Sarpa (yes / no).
 *   • DashaCard — current Mahadasha + Antardasha with sub-period dates.
 *
 * Tap any card / row to ask Vidhaata a contextual question via onAsk().
 */
import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { MellowText } from './MellowText';
import { tr, trCurrent, type Lang } from './cosmicI18n';

const C = theme.cosmic;
const isWeb = Platform.OS === 'web';

// ── Shared atoms ────────────────────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; style?: any }> = ({ children, style }) => (
  <View style={[a.card, isWeb && (a.cardWeb as any), style]}>{children}</View>
);

const Kicker: React.FC<{ left: string; right?: string }> = ({ left, right }) => (
  <View style={a.kickerRow}>
    <MellowText style={a.kicker} glowColor="#E8C96A" duration={4800} minOpacity={0.78}>{left}</MellowText>
    {right ? <Text style={a.kickerRight}>{right}</Text> : null}
  </View>
);

// ╔════════════════════════════════════════════════════════════════════╗
// ║  TODAY'S BRIEFING                                                  ║
// ╚════════════════════════════════════════════════════════════════════╝
export interface TodaysBriefing {
  /** "Sat · 26 Apr 2026" */
  dateLabel: string;
  /** "Shukla Tritiya" */
  tithi?: string;
  /** "Saturday" / "Shanivara" */
  vara?: string;
  /** "Rohini" */
  nakshatra?: string;
  /** 0..100 */
  alignmentScore?: number;
  /** "Waxing Gibbous" / "New Moon" / etc */
  moonPhase?: string;
  /** Sanskrit name of the Sun for the current hour (e.g. "Aditya"). */
  sunName?: string;
  /** Stage descriptor (e.g. "Midday", "Sunset"). */
  sunStage?: string;
  /** e.g. "72% illuminated · Moon in Cancer · 3 active transits" */
  subtitle?: string;
  /** italic body — single 2-3 line keynote about today */
  keynote?: string;
  /** sun if 06:00-18:00 local, moon otherwise */
  orb?: 'sun' | 'moon';
  onPress?: () => void;
  /** Wide-screen only: inline panchanga strip rendered at the bottom of
      the card. On narrow screens the parent renders <PanchangaStrip />
      as a separate card instead. */
  panchanga?: PanchangaPill[];
}

export const TodaysBriefingCard: React.FC<TodaysBriefing & { locationLabel?: string }> = ({
  dateLabel, tithi, vara, nakshatra, alignmentScore = 84,
  moonPhase = 'Waxing Gibbous', sunName, sunStage,
  subtitle, keynote, orb = 'moon', onPress, panchanga,
  locationLabel,
}) => {
  const subtitleLine = subtitle
    ?? `${vara ?? ''}${vara && tithi ? ' · ' : ''}${tithi ?? ''}${(vara || tithi) && nakshatra ? ' · ' : ''}${nakshatra ?? ''}`;
  // When orb is the sun, prefer the Sanskrit name; for the moon we fall
  // back to the phase string (Waxing Moon, etc.).
  const heroTitle = orb === 'sun' ? (sunName || 'Aditya') : moonPhase;
  const heroKicker = orb === 'sun' ? `SUN · ${sunStage || 'Midday'}` : trCurrent('MOON PHASE');
  // v9.18 — show CURRENT location on the right side of the kicker
  // (uses just the city portion to keep the header compact). Falls
  // back to no location row if `locationLabel` is empty.
  const headerLeft = `${trCurrent("TODAY'S BRIEFING")} · ${dateLabel}`;
  const cityOnly = (locationLabel || '').split(',')[0].trim();
  const headerRight = cityOnly ? `📍 ${cityOnly}` : undefined;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ marginBottom: 14 }, pressed && { opacity: 0.95 }]}>
      <Card>
        <Kicker left={headerLeft} right={undefined} />
        {/* v9.18c — Location chip in the top-right corner.
            Replaces the "Cosmic Alignment" score (which was a fluff
            metric and was colliding with the kicker right slot). */}
        {cityOnly ? (
          <View style={a.alignChip}>
            <Text style={a.locPin}>📍</Text>
            <Text style={a.locName} numberOfLines={1}>{cityOnly}</Text>
          </View>
        ) : null}

        <View style={tb.row}>
          {/* Sun/Moon orb */}
          <View style={tb.orbWrap}>
            {orb === 'sun' ? <SunOrb size={92} /> : <MoonOrb size={92} phase={moonPhase} />}
          </View>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={a.kicker}>{heroKicker}</Text>
            <MellowText style={tb.title} glowColor="#F2C75A" duration={3800} minOpacity={0.82}>
              {heroTitle}
            </MellowText>
            <Text style={tb.sub}>{subtitleLine || ' '}</Text>
          </View>
        </View>

        {keynote ? (
          <View style={tb.keynoteRow}>
            <View style={tb.keyRail} />
            <Text style={tb.keynote}>
              <Text style={tb.keynoteAccent}>{trCurrent('♃ Today ')}</Text>
              {keynote}
            </Text>
          </View>
        ) : null}

        {/* Inline panchanga strip — rendered ONLY on wide screens. The
            parent decides when to pass this; on phones the same data
            lives in a separate <PanchangaStrip /> card below. */}
        {panchanga && panchanga.length > 0 ? (
          <View style={tb.inlinePanchanga}>
            <PanchangaStrip pills={panchanga} tithi={tithi} vara={vara} />
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
};

// Stylised moon — gradient-lit ellipse with dotted orbit ring.
const MoonOrb: React.FC<{ size: number; phase?: string }> = ({ size }) => (
  <View style={[mo.wrap, { width: size + 18, height: size + 18 }]}>
    <View style={[mo.ring, { width: size + 18, height: size + 18, borderRadius: (size + 18) / 2 }, isWeb && (mo.ringWeb as any)]} />
    <View
      style={[
        mo.disc,
        { width: size, height: size, borderRadius: size / 2 },
        isWeb && (mo.discWeb as any),
      ]}
    />
  </View>
);

const SunOrb: React.FC<{ size: number }> = ({ size }) => (
  <View style={[mo.wrap, { width: size + 18, height: size + 18 }]}>
    <View style={[mo.ring, { width: size + 18, height: size + 18, borderRadius: (size + 18) / 2 }, isWeb && (mo.ringWeb as any)]} />
    <View
      style={[
        mo.sunDisc,
        { width: size, height: size, borderRadius: size / 2 },
        isWeb && (mo.sunDiscWeb as any),
      ]}
    />
  </View>
);

// ╔════════════════════════════════════════════════════════════════════╗
// ║  AUSPICIOUS TIMINGS                                                ║
// ╚════════════════════════════════════════════════════════════════════╝
export interface AuspiciousSlot {
  glyph: string;       // hora ruler glyph e.g. ☉ ☽ ♂ ♀ ♃
  startEnd: string;    // "06:14 – 07:18"
  rating: 'Best' | 'Better' | 'Good' | 'Avoid';
  summary: string;     // "Travel · new starts · puja"
  onPress?: () => void;
}

const RATING_TONE: Record<AuspiciousSlot['rating'], { rail: string; pill: string; pillBg: string }> = {
  Best:   { rail: '#A6DFB0', pill: '#A6DFB0', pillBg: 'rgba(126,184,138,0.16)' },
  Better: { rail: '#A6DFB0', pill: '#A6DFB0', pillBg: 'rgba(126,184,138,0.10)' },
  Good:   { rail: '#E8C96A', pill: '#E8C96A', pillBg: 'rgba(232,201,106,0.14)' },
  Avoid:  { rail: '#E07A45', pill: '#E07A45', pillBg: 'rgba(196,98,45,0.16)' },
};

export const AuspiciousTimingsCard: React.FC<{ slots: AuspiciousSlot[]; updatedAt?: string }> = ({
  slots, updatedAt = '6:00 AM',
}) => {
  // v9.18 — Show ONLY upcoming windows in the next 6 hours. Past
  // horas (already elapsed today) are filtered out so the card
  // surfaces only what's actionable for the user right now.
  const upcoming = React.useMemo(() => {
    try {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const cutoffMin = nowMin + 6 * 60;
      const parseStart = (se: string): number => {
        const m = (se || '').match(/^\s*(\d{1,2}):(\d{2})/);
        if (!m) return -1;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      };
      const parseEnd = (se: string): number => {
        const m = (se || '').match(/[-–—]\s*(\d{1,2}):(\d{2})/);
        if (!m) return -1;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      };
      return (slots || []).filter((sl) => {
        const e = parseEnd(sl.startEnd);
        const s = parseStart(sl.startEnd);
        if (e < 0 || s < 0) return true; // unparseable → show, don't hide
        return e >= nowMin && s <= cutoffMin;
      });
    } catch {
      return slots || [];
    }
  }, [slots]);

  return (
    <Card style={{ marginBottom: 14 }}>
      <Kicker left={trCurrent('AUSPICIOUS TIMINGS · NEXT 6H')} right={`${trCurrent('Updated')} ${updatedAt}`} />
      {upcoming.length === 0 ? (
        <Text style={a.empty}>{trCurrent('No high-rated horas in the next 6 hours.')}</Text>
      ) : (
        upcoming.map((sl, i) => {
          const tn = RATING_TONE[sl.rating];
          return (
            <Pressable
              key={`${sl.startEnd}-${i}`}
              onPress={sl.onPress}
              style={({ pressed }) => [au.row, pressed && { opacity: 0.92 }]}
            >
              <View style={[au.rail, { backgroundColor: tn.rail }]} />
              <View style={{ flex: 1 }}>
                <View style={au.head}>
                  <Text style={au.glyph}>{sl.glyph}</Text>
                  <View style={[au.timePill, { backgroundColor: tn.pillBg, borderColor: tn.pill + '55' }]}>
                    <Text style={[au.timeText, { color: tn.pill }]}>{sl.startEnd}</Text>
                  </View>
                  <View style={[au.ratingPill, { backgroundColor: tn.pillBg, borderColor: tn.pill + '55', marginLeft: 'auto' }]}>
                    <Text style={[au.ratingText, { color: tn.pill }]}>{sl.rating}</Text>
                  </View>
                </View>
                <Text style={au.summary}>{sl.summary}</Text>
              </View>
            </Pressable>
          );
        })
      )}
    </Card>
  );
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║  YOGAS                                                             ║
// ╚════════════════════════════════════════════════════════════════════╝
export interface YogaChip {
  name: string;
  polarity: 'good' | 'mixed' | 'bad';
  description?: string;
  onPress?: () => void;
}

const POL_TONE: Record<YogaChip['polarity'], { fg: string; bg: string }> = {
  good:  { fg: '#A6DFB0', bg: 'rgba(126,184,138,0.16)' },
  mixed: { fg: '#E8C96A', bg: 'rgba(232,201,106,0.14)' },
  bad:   { fg: '#E07A45', bg: 'rgba(196,98,45,0.14)' },
};

export const YogasCard: React.FC<{ yogas: YogaChip[]; onAskAll?: () => void }> = ({ yogas, onAskAll }) => (
  <Card style={{ marginBottom: 14 }}>
    <Kicker left={`${trCurrent('ACTIVE YOGAS')} · ${yogas.length}`} right={onAskAll ? trCurrent('Ask Vidhaata →') : undefined} />
    {yogas.length === 0 ? (
      <Text style={a.empty}>{trCurrent('No notable yogas active in your chart today.')}</Text>
    ) : (
      <View style={yo.wrap}>
        {yogas.slice(0, 12).map((y, i) => {
          const tn = POL_TONE[y.polarity];
          return (
            <Pressable
              key={`${y.name}-${i}`}
              onPress={y.onPress}
              style={({ pressed }) => [
                yo.chip, { backgroundColor: tn.bg, borderColor: tn.fg + '55' },
                pressed && { opacity: 0.92 },
              ]}
            >
              <View style={[yo.dot, { backgroundColor: tn.fg }]} />
              <Text style={[yo.label, { color: tn.fg }]} numberOfLines={1}>{y.name}</Text>
            </Pressable>
          );
        })}
      </View>
    )}
    {yogas.length > 0 ? (
      <Text style={yo.legend}>green = benefic · gold = mixed · orange = malefic — tap a yoga to ask Vidhaata</Text>
    ) : null}
  </Card>
);

// ╔════════════════════════════════════════════════════════════════════╗
// ║  DOSHAS                                                            ║
// ╚════════════════════════════════════════════════════════════════════╝
export interface DoshaState {
  /** Mangal / Kuja Dosha */
  kuja: boolean;
  /** Sade Sati / Sani */
  sani: boolean;
  /** Kala Sarpa */
  sarpa: boolean;
  onAsk?: (which: 'kuja' | 'sani' | 'sarpa') => void;
}

const DoshaCell: React.FC<{ label: string; sub: string; on: boolean; onPress?: () => void }> = ({
  label, sub, on, onPress,
}) => (
  <Pressable onPress={onPress} style={({ pressed }) => [do_.cell, pressed && { opacity: 0.92 }]}>
    <View style={[do_.statusDot, { backgroundColor: on ? '#E07A45' : '#A6DFB0' }]} />
    <Text style={do_.label}>{label}</Text>
    <Text style={[do_.status, { color: on ? '#E07A45' : '#A6DFB0' }]}>{on ? trCurrent('PRESENT') : trCurrent('CLEAR')}</Text>
    <Text style={do_.sub}>{sub}</Text>
  </Pressable>
);

export const DoshasCard: React.FC<DoshaState> = ({ kuja, sani, sarpa, onAsk }) => (
  <Card style={{ marginBottom: 14 }}>
    <Kicker left={trCurrent('DOSHAS AT A GLANCE')} />
    <View style={do_.row}>
      <DoshaCell label="Kuja"      sub={trCurrent('Mangal Dosha')} on={kuja}  onPress={() => onAsk?.('kuja')} />
      <DoshaCell label={trCurrent('AshtamaShani')} sub={trCurrent('Arthaa · Saturn cycle')} on={sani}  onPress={() => onAsk?.('sani')} />
      <DoshaCell label="Sarpa"     sub={trCurrent('Kala Sarpa')}   on={sarpa} onPress={() => onAsk?.('sarpa')} />
    </View>
  </Card>
);

// ╔════════════════════════════════════════════════════════════════════╗
// ║  DASHA                                                             ║
// ╚════════════════════════════════════════════════════════════════════╝
export interface DashaInfo {
  mahaPlanet?: string;
  mahaStart?: string;     // "Mar 2018"
  mahaEnd?: string;       // "Mar 2034"
  mahaRemaining?: string; // "8y 2m left"
  antarPlanet?: string;
  antarStart?: string;
  antarEnd?: string;
  antarRemaining?: string;
  onAsk?: (kind: 'maha' | 'antar') => void;
}

export const DashaCard: React.FC<DashaInfo> = ({
  mahaPlanet, mahaStart, mahaEnd, mahaRemaining,
  antarPlanet, antarStart, antarEnd, antarRemaining, onAsk,
}) => (
  <Card style={{ marginBottom: 14 }}>
    <Kicker left={trCurrent('CURRENT DASHA')} right="Vimśottarī" />
    <View style={da.row}>
      <Pressable onPress={() => onAsk?.('maha')} style={({ pressed }) => [da.cell, pressed && { opacity: 0.92 }]}>
        <Text style={da.cellKicker}>{trCurrent('MAHADASHA')}</Text>
        <Text style={da.cellPlanet}>{mahaPlanet || '—'}</Text>
        <Text style={da.cellRange}>{mahaStart || '—'}  →  {mahaEnd || '—'}</Text>
        {mahaRemaining ? <View style={da.remPill}><Text style={da.remText}>{mahaRemaining}</Text></View> : null}
      </Pressable>
      <View style={da.divider} />
      <Pressable onPress={() => onAsk?.('antar')} style={({ pressed }) => [da.cell, pressed && { opacity: 0.92 }]}>
        <Text style={da.cellKicker}>{trCurrent('ANTARDASHA')}</Text>
        <Text style={da.cellPlanet}>{antarPlanet || '—'}</Text>
        <Text style={da.cellRange}>{antarStart || '—'}  →  {antarEnd || '—'}</Text>
        {antarRemaining ? <View style={da.remPill}><Text style={da.remText}>{antarRemaining}</Text></View> : null}
      </Pressable>
    </View>
    <Text style={da.hint}>Tap a period to ask Vidhaata for a detailed reading →</Text>
  </Card>
);

// ─────────────────────────────────────────────────────────────────────
// styles
// ─────────────────────────────────────────────────────────────────────
const a = StyleSheet.create({
  card: {
    padding: 16, borderRadius: 22,
    backgroundColor: C.glass,
    overflow: 'hidden',
  },
  cardWeb: {
    backdropFilter: 'blur(28px) saturate(160%)',
    WebkitBackdropFilter: 'blur(28px) saturate(160%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 28px rgba(0,0,0,0.20)',
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  kicker: {
    fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, color: C.goldHi,
  },
  // v9.18 — bumped so the 📍 location is clearly readable + gold-tinted
  kickerRight: { fontSize: 12, color: C.goldHi, fontWeight: '700', letterSpacing: 0.3 },
  empty: { color: C.cream65, fontSize: 13, paddingVertical: 8 },
  alignChip: {
    position: 'absolute', top: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(232,201,106,0.10)',
    borderWidth: 1, borderColor: C.goldLine,
    maxWidth: 160,
  },
  alignNum: { color: C.goldHi, fontSize: 13, fontWeight: '900', letterSpacing: 0.4 },
  alignLabel: { color: C.goldHi, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  // v9.18c — Location chip (replaces "Cosmic Alignment" pill)
  locPin: { fontSize: 13 },
  locName: { color: C.goldHi, fontSize: 12, fontWeight: '800', letterSpacing: 0.3, maxWidth: 130 },
});

const tb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  orbWrap: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: 26, fontWeight: '800', color: C.cream, letterSpacing: -0.4, marginTop: 2,
  },
  // v9.18 — bumped from 12.5→15 so Day · Tithi · Nakshatra is comfortably readable.
  sub: { color: C.cream80, fontSize: 15, marginTop: 6, lineHeight: 21, fontWeight: '600' },
  keynoteRow: {
    flexDirection: 'row', marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(245,237,214,0.06)',
  },
  keyRail: { width: 2, borderRadius: 1, backgroundColor: C.gold, marginRight: 10, alignSelf: 'stretch' },
  keynote: { color: C.cream80, fontSize: 13.5, lineHeight: 20, fontStyle: 'italic', flex: 1 },
  keynoteAccent: { color: C.goldHi, fontStyle: 'normal', fontWeight: '700' },
  inlinePanchanga: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(245,237,214,0.10)',
    marginHorizontal: -4,
  },
});

const mo = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 1, borderColor: 'rgba(232,201,106,0.30)',
    borderStyle: Platform.OS === 'web' ? ('dashed' as any) : 'solid',
  },
  ringWeb: {
    borderStyle: 'dashed',
  },
  disc: {
    backgroundColor: '#EFE3B6',
  },
  discWeb: {
    backgroundImage: 'radial-gradient(circle at 65% 40%, #FFF8DA 0%, #E5D294 50%, #6E5320 100%)',
    boxShadow: '0 0 30px rgba(232,201,106,0.45), inset -8px -10px 28px rgba(0,0,0,0.50)',
  },
  sunDisc: {
    backgroundColor: '#F2C75A',
  },
  sunDiscWeb: {
    backgroundImage: 'radial-gradient(circle at 50% 45%, #FFE8A6 0%, #F2C75A 45%, #C9851F 100%)',
    boxShadow: '0 0 36px rgba(242,199,90,0.55), inset 0 0 20px rgba(255,236,180,0.45)',
  },
});

const au = StyleSheet.create({
  row: {
    flexDirection: 'row', paddingVertical: 12, gap: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(245,237,214,0.06)',
  },
  rail: { width: 3, borderRadius: 2, alignSelf: 'stretch', opacity: 0.85 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  glyph: { color: C.cream, fontSize: 16, fontWeight: '700' },
  timePill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1,
  },
  timeText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4, fontVariant: ['tabular-nums'] },
  ratingPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  ratingText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  summary: { color: C.cream80, fontSize: 13, marginTop: 6, lineHeight: 18 },
});

const yo = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 12, fontWeight: '700' },
  legend: { fontSize: 10.5, color: C.cream45, marginTop: 10, fontStyle: 'italic' },
});

const do_ = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cell: {
    flex: 1, padding: 12, borderRadius: 14,
    backgroundColor: 'rgba(34,22,71,0.45)',
    borderWidth: 1, borderColor: C.cream10,
    alignItems: 'center', gap: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  label: { color: C.cream, fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  status: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7, marginTop: 2 },
  sub: { color: C.cream45, fontSize: 10.5, fontWeight: '600', textAlign: 'center', marginTop: 2 },
});

const da = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', marginTop: 4 },
  cell: { flex: 1, paddingVertical: 6, paddingHorizontal: 6, gap: 4 },
  divider: { width: 1, backgroundColor: C.cream10, marginHorizontal: 4 },
  cellKicker: { color: C.goldHi, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  cellPlanet: { color: C.cream, fontSize: 18, fontWeight: '700', letterSpacing: -0.2, marginTop: 2 },
  cellRange: { color: C.cream65, fontSize: 11, fontVariant: ['tabular-nums'], marginTop: 4 },
  remPill: {
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(232,201,106,0.14)',
    borderWidth: 1, borderColor: C.goldLine,
  },
  remText: { color: C.goldHi, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  hint: { color: C.cream45, fontSize: 11, fontStyle: 'italic', marginTop: 12 },
});


// ── PanchangaStrip — 6 glassy pills (Tithi · Nakshatra · Moon · Sunrise · Sunset · Rahu Kaal) ──
export interface PanchangaPill {
  kicker: string;     // "TITHI"
  value: string;      // "Shukla Dashami"
  /** orange = caution (Rahu Kaal); gold = Nakshatra; default cream */
  tone?: 'cream' | 'gold' | 'caution';
  /** Tap → typically opens Vidhaata chat with a contextual question. */
  onPress?: () => void;
}

interface PanchangaStripProps {
  pills: PanchangaPill[];
  /** Optional Tithi name (e.g. "Shukla Tritiya"). When provided we
   *  render a small positive-toned description card right under the
   *  pills explaining what the tithi means today. */
  tithi?: string | null;
  vara?: string | null;
  /** Tap → opens Vidhaata with a contextual question about the tithi. */
  onAskTithi?: () => void;
}

export const PanchangaStrip: React.FC<PanchangaStripProps> = ({ pills, tithi, vara, onAskTithi }) => {
  // v9.8 — lazily look up positive-toned copy for the active tithi.
  let tithiCopy: { headline: string; description: string; paksha: string; name: string; tone: string } | null = null;
  if (tithi) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { lookupTithi } = require('./panchangaCopy');
      tithiCopy = lookupTithi(tithi);
    } catch { /* ignore */ }
  }
  return (
    <View>
      <View style={ps.row}>
        {pills.map((p, i) => {
          const colour =
            p.tone === 'gold'    ? '#F2C75A' :
            p.tone === 'caution' ? '#E07A45' : C.cream;
          return (
            <Pressable
              key={i}
              onPress={p.onPress}
              style={({ pressed }) => [ps.pill, isWeb && (ps.pillWeb as any), pressed && { opacity: 0.85 }]}
              accessibilityRole={p.onPress ? 'button' : undefined}
              accessibilityLabel={`${p.kicker}: ${p.value}`}
            >
              <Text style={ps.kicker}>{p.kicker}</Text>
              <MellowText
                style={[ps.value, { color: colour }]}
                glowColor={colour}
                duration={4200}
                minOpacity={0.82}
              >
                {p.value}
              </MellowText>
            </Pressable>
          );
        })}
      </View>

      {tithiCopy ? (
        <Pressable
          onPress={onAskTithi}
          style={({ pressed }) => [ps.tithiCard, isWeb && (ps.tithiCardWeb as any), pressed && { opacity: 0.92 }]}
          accessibilityRole={onAskTithi ? 'button' : undefined}
          accessibilityLabel={`Today's tithi: ${tithiCopy.name}. ${tithiCopy.headline}.`}
        >
          <View style={ps.tithiHead}>
            <Text style={ps.tithiKicker}>{trCurrent("TODAY'S TITHI")}</Text>
            <View style={[
              ps.toneBadge,
              tithiCopy.tone === 'auspicious' ? ps.toneBadgeAusp : ps.toneBadgeGentle,
            ]}>
              <Text style={[
                ps.toneBadgeText,
                tithiCopy.tone === 'auspicious' ? ps.toneBadgeTextAusp : ps.toneBadgeTextGentle,
              ]}>
                {tithiCopy.tone === 'auspicious' ? trCurrent('AUSPICIOUS') : trCurrent('GENTLE')}
              </Text>
            </View>
          </View>
          <MellowText
            style={ps.tithiTitle}
            glowColor="#F2C75A"
            duration={4400}
            minOpacity={0.84}
          >
            {`${tithiCopy.paksha === 'shukla' ? 'Shukla' :
                tithiCopy.paksha === 'krishna' ? 'Krishna' : ''} ${tithiCopy.name}`.trim()}
            {' — '}
            <Text style={{ color: C.cream80, fontWeight: '600' }}>{tithiCopy.headline}</Text>
          </MellowText>
          <Text style={ps.tithiDesc}>{tithiCopy.description}</Text>
          {onAskTithi ? (
            <Text style={ps.tithiCta}>{trCurrent('Tap to ask Vidhaata about today  ›')}</Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
};

const ps = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'stretch',
    gap: 6,
    marginTop: 4, marginBottom: 14,
  },
  pill: {
    flex: 1,
    paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(38,26,80,0.55)',
    borderWidth: 1, borderColor: 'rgba(245,237,214,0.10)',
    alignItems: 'center', justifyContent: 'center',
    minWidth: 50,
  },
  pillWeb: {
    backdropFilter: 'blur(18px) saturate(150%)',
    WebkitBackdropFilter: 'blur(18px) saturate(150%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.20)',
  } as any,
  kicker: {
    color: 'rgba(245,237,214,0.55)',
    fontSize: 9, fontWeight: '700', letterSpacing: 1.0,
    marginBottom: 6,
  },
  value: {
    fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2,
    textAlign: 'center',
  },

  // v9.8 — Today's Tithi description card under the strip
  tithiCard: {
    marginTop: 4, marginBottom: 18,
    padding: 16, borderRadius: 18,
    backgroundColor: 'rgba(38,26,80,0.65)',
    borderWidth: 1, borderColor: 'rgba(245,237,214,0.10)',
  },
  tithiCardWeb: {
    backdropFilter: 'blur(22px) saturate(160%)',
    WebkitBackdropFilter: 'blur(22px) saturate(160%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 18px rgba(0,0,0,0.22)',
  } as any,
  tithiHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  tithiKicker: {
    color: 'rgba(245,237,214,0.55)',
    fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase',
  },
  toneBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    borderWidth: 1,
  },
  toneBadgeAusp: {
    backgroundColor: 'rgba(126,184,138,0.12)',
    borderColor: 'rgba(126,184,138,0.40)',
  },
  toneBadgeGentle: {
    backgroundColor: 'rgba(159,122,234,0.12)',
    borderColor: 'rgba(159,122,234,0.40)',
  },
  toneBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  toneBadgeTextAusp: { color: '#A6DFB0' },
  toneBadgeTextGentle: { color: '#C4B0F2' },
  tithiTitle: {
    color: '#F2C75A', fontSize: 17, fontWeight: '800', letterSpacing: -0.3,
    lineHeight: 22, marginBottom: 8,
  },
  tithiDesc: {
    color: 'rgba(245,237,214,0.78)',
    fontSize: 13, lineHeight: 19, fontWeight: '500',
  },
  tithiCta: {
    color: 'rgba(232,201,106,0.72)',
    fontSize: 11, fontWeight: '700', letterSpacing: 0.4,
    marginTop: 10,
  },
});
