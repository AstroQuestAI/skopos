/**
 * CosmicHome — v9.2 dashboard for the rebuilt Vidhaata home.
 *
 * Layout (top → bottom):
 *
 *   ┌──────────────────────────────────────────┐
 *   │  Saturday, April 25, 2026             ☰  │   ← Header
 *   │  3 active transits today                  │
 *   ├──────────────────────────────────────────┤
 *   │  ⟡ TODAY'S BRIEFING                       │
 *   │   ◐  Waxing Gibbous                       │   ← TodaysBriefingCard
 *   │      Sat · Tritiya · Rohini               │
 *   │                                           │
 *   │  ▶  Daily Voice Briefing  3:07            │   ← Audio briefing
 *   │                                           │
 *   │  ⌚ AUSPICIOUS TIMINGS                     │   ← AuspiciousTimingsCard
 *   │   ☉ 06:14–07:18  Best                     │
 *   │   ☽ 13:22–14:26  Better                   │
 *   │                                           │
 *   │  ✦ ACTIVE YOGAS · 4                       │   ← YogasCard
 *   │   [Gaja-Kesari] [Budhaditya] …            │
 *   │                                           │
 *   │  ⊕ DOSHAS AT A GLANCE                     │   ← DoshasCard
 *   │   Kuja CLEAR · Sade Sati PRESENT · Sarpa  │
 *   │                                           │
 *   │  ⟁ CURRENT DASHA                          │   ← DashaCard
 *   │   Mahadasha: Jupiter · Antardasha: Mars   │
 *   ├──────────────────────────────────────────┤
 *   │  Floating mic orb (Ask Vidhaata)          │
 *   │  ┌────────────────────────────────────┐   │
 *   │  │ ⊞    ⌚         ✦         ▭    👤 │   │   ← Floating bottom nav
 *   │  └────────────────────────────────────┘   │
 *   └──────────────────────────────────────────┘
 *
 * The legacy ActiveTransits + CosmicInsights props are kept for
 * backward-compatibility but are no longer rendered when the new
 * domain props (`briefing`, `auspiciousSlots`, `yogas`, `doshas`,
 * `dasha`) are provided.
 */

import React from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { CosmicAudioBriefing } from './CosmicAudioBriefing';
import { CosmicBottomNav } from './CosmicBottomNav';
import {
  TodaysBriefingCard,
  AuspiciousTimingsCard,
  YogasCard,
  DoshasCard,
  DashaCard,
  PanchangaStrip,
} from './CosmicHomeSections';
import type { TodaysBriefing, AuspiciousSlot, YogaChip, DoshaState, DashaInfo, PanchangaPill } from './CosmicHomeSections';

const C = theme.cosmic;
const isWeb = Platform.OS === 'web';

// ── Domain types kept for back-compat ─────────────────────────────────
export interface ActiveTransit {
  label: string;
  fromGlyph: string;
  aspectGlyph: string;
  toGlyph: string;
  orbDeg: number;
  tone: 'fav' | 'cau' | 'warn';
  summary: string;
}

export interface CosmicInsight {
  icon: string;
  iconKind?: 'ion' | 'glyph';
  area: string;
  badge: string;
  badgeTone: 'fav' | 'cau' | 'warn';
  headline: string;
  body: string;
  onPress?: () => void;
}

export type CosmicNavKey = 'overview' | 'today' | 'chart' | 'profile';

interface Props {
  userName?: string;
  /** ISO date used for the header. Defaults to today. */
  dateISO?: string;
  briefingDuration?: string;
  briefingUpdatedAt?: string;

  /** Optional headline counter ("3 active transits today"). */
  transitsCount?: number;

  /** New dashboard widgets — each card renders only if data is present. */
  briefing?: TodaysBriefing | null;
  panchanga?: PanchangaPill[];
  auspiciousSlots?: AuspiciousSlot[];
  yogas?: YogaChip[];
  doshas?: DoshaState | null;
  dasha?: DashaInfo | null;

  /** Legacy props (kept for back-compat — rendered only when no new data). */
  transits?: ActiveTransit[];
  insights?: CosmicInsight[];

  // Handlers
  onOpenMenu: () => void;
  onAskVidhaata: () => void;
  onPlayBriefing?: () => void;
  /** v9.18 — current location label shown in Today's Briefing header. */
  locationLabel?: string;
  /**
   * v9.11 — Composes the speech text for the audio briefing card.
   * Audio card now plays directly via Piper TTS without leaving Home,
   * so this returns the spoken copy on demand.
   */
  getSpeechText?: () => string | Promise<string>;
  /** v9.11 — fired right before audio plays (e.g. to cancel any
   *  active Web Speech utterance from the Vidhaata overlay). */
  onBeforePlayBriefing?: () => void;
  /** v9.20 — current UI language; passed to the audio briefing card
   *  so it picks the Telugu voice when in Telugu mode. */
  language?: 'en' | 'te';
  /** Tap on the floating bottom nav → secondary screens. */
  onNavigate?: (key: CosmicNavKey) => void;
  /** Active key used to highlight the floating nav icon. */
  activeNav?: CosmicNavKey;
}

// ── Helpers ─────────────────────────────────────────────────────────────
function formatHumanDate(iso?: string): string {
  try {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  } catch { return ''; }
}

// ── Main ────────────────────────────────────────────────────────────────
export const CosmicHome: React.FC<Props> = ({
  userName, dateISO, briefingDuration = '3:07', briefingUpdatedAt = '6:00 AM',
  transitsCount,
  briefing, panchanga, auspiciousSlots, yogas, doshas, dasha,
  transits, insights,
  onOpenMenu, onAskVidhaata, onPlayBriefing, onNavigate, activeNav,
  getSpeechText, onBeforePlayBriefing, locationLabel, language = 'en',
}) => {
  const { width } = useWindowDimensions();
  const narrow = width < 480;
  const wide   = width >= 720;        // tablet / desktop
  // v9.9 — time-of-day greeting (replaces the static "Good morning"
  // string that lived here forever). Dynamic on every render so the
  // card stays correct as the user reads through their day.
  const _h = new Date().getHours();
  const greetWord =
    _h >= 5 && _h < 12  ? 'Good morning'   :
    _h >= 12 && _h < 17 ? 'Good afternoon' :
    _h >= 17 && _h < 21 ? 'Good evening'   :
                          'Pranam'; // late night / pre-dawn salutation
  const greet = userName ? `${greetWord}, ${userName.split(' ')[0]}` : 'Your Daily Briefing';

  // Determine if any "new" dashboard data is available so we know whether
  // to render the new cards or fall back to the legacy transits/insights.
  const hasNewData = !!(briefing || (auspiciousSlots && auspiciousSlots.length) ||
    (yogas && yogas.length) || doshas || dasha);

  const tCount = transitsCount ?? (transits ? transits.length : (yogas?.length ?? 0));

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingHorizontal: narrow ? 16 : 22 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerDate}>{formatHumanDate(dateISO)}</Text>
            <Text style={s.headerSubtitle}>
              {tCount} active transit{tCount === 1 ? '' : 's'} today
            </Text>
          </View>
          <Pressable
            onPress={onOpenMenu}
            hitSlop={10}
            style={[s.menuBtn, isWeb && (sWeb.glass as any)]}
            accessibilityLabel="Open menu"
          >
            <Ionicons name="menu" size={22} color={C.cream} />
          </Pressable>
        </View>

        {/* ── New dashboard cards ── */}
        {hasNewData ? (
          <>
            {/* On wide screens panchanga lives INSIDE the briefing card.
                On phones it renders as a separate strip below. */}
            {briefing ? (
              <TodaysBriefingCard {...briefing} locationLabel={locationLabel} panchanga={wide ? panchanga : undefined} />
            ) : null}

            {/* 6 panchanga pills — only shown standalone on narrow screens.
                v9.8 — also passes the active tithi & vara so the strip can
                render the positive-toned "Today's Tithi" description card
                directly underneath the pills. */}
            {!wide && panchanga && panchanga.length > 0 ? (
              <PanchangaStrip
                pills={panchanga}
                tithi={briefing?.tithi}
                vara={briefing?.vara}
                onAskTithi={panchanga[0]?.onPress}
              />
            ) : null}

            {/* Voice briefing — keep below today's briefing for "scan → listen". */}
            <CosmicAudioBriefing
              title={greet}
              subtitle="Your cosmic briefing is ready"
              getSpeechText={getSpeechText}
              language={language}
              onBeforePlay={onBeforePlayBriefing}
              onPlay={onPlayBriefing}
            />

            {auspiciousSlots && auspiciousSlots.length > 0 ? (
              <AuspiciousTimingsCard slots={auspiciousSlots} updatedAt={briefingUpdatedAt} />
            ) : null}

            {yogas && yogas.length > 0 ? (
              <YogasCard yogas={yogas} onAskAll={() => onAskVidhaata()} />
            ) : null}

            {doshas ? (
              <DoshasCard
                kuja={doshas.kuja}
                sani={doshas.sani}
                sarpa={doshas.sarpa}
                onAsk={doshas.onAsk}
              />
            ) : null}

            {dasha ? <DashaCard {...dasha} /> : null}
          </>
        ) : (
          // Legacy fallback (kept until callers all migrate).
          <>
            <CosmicAudioBriefing
              title={greet}
              subtitle="Your cosmic briefing is ready"
              getSpeechText={getSpeechText}
              onBeforePlay={onBeforePlayBriefing}
              onPlay={onPlayBriefing}
            />
            {transits && transits.length > 0 ? (
              <View style={[s.card, isWeb && (sWeb.glass as any)]}>
                <Text style={s.cardKicker}>ACTIVE TRANSITS</Text>
                {transits.map((t, i) => (
                  <Text key={i} style={s.legacyLine}>
                    {t.fromGlyph} {t.aspectGlyph} {t.toGlyph} — {t.summary}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        )}

        {/* spacer for the floating CTA + bottom nav */}
        <View style={{ height: 168 }} />
      </ScrollView>

      {/* ── Floating bottom nav (glass pill + center mic orb above) ── */}
      <View pointerEvents="box-none" style={s.floatLayer}>
        <CosmicBottomNav
          active={activeNav}
          onAsk={onAskVidhaata}
          onNavigate={(k) => onNavigate?.(k)}
        />
      </View>
    </View>
  );
};

// ── Floating bottom nav ────────────────────────────────────────────────
interface BottomNavProps {
  active?: CosmicNavKey;
  onNavigate?: (key: CosmicNavKey) => void;
  onAsk: () => void;
}

const NAV_ITEMS: Array<{ key: CosmicNavKey; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { key: 'today',   icon: 'sunny-outline',  label: 'Today' },
  { key: 'guruji',  icon: 'mic-outline',    label: 'Vidhaata' },
  { key: 'chart',   icon: 'planet-outline', label: 'Chart' },
  { key: 'profile', icon: 'person-outline', label: 'Profile' },
];

const BottomNav: React.FC<BottomNavProps> = ({ active, onNavigate, onAsk }) => {
  return (
    <View style={n.wrap} pointerEvents="box-none">
      <View style={[n.bar, isWeb && (n.barWeb as any)]}>
        {NAV_ITEMS.map((it) => (
          <NavIcon
            key={it.key}
            item={it}
            active={active === it.key}
            onPress={() => {
              if (it.key === 'guruji') onAsk();
              else onNavigate?.(it.key);
            }}
          />
        ))}
      </View>
    </View>
  );
};

const NavIcon: React.FC<{
  item: typeof NAV_ITEMS[number];
  active?: boolean;
  onPress?: () => void;
}> = ({ item, active, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [n.cell, pressed && { opacity: 0.7 }]}
    accessibilityLabel={item.label}
  >
    <Ionicons name={item.icon} size={22} color={active ? theme.cosmic.goldHi : theme.cosmic.cream65} />
    <Text style={[n.cellLabel, active && n.cellLabelActive]} numberOfLines={1}>{item.label}</Text>
  </Pressable>
);

// ── Styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgDeep },
  scroll: { paddingTop: 10, paddingBottom: 24 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 18,
  },
  headerDate: {
    fontSize: 19,
    fontWeight: '700',
    color: C.cream,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: C.cream65,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  menuBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.glassSoft,
    borderWidth: 1, borderColor: C.cream10,
  },

  card: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: C.glass,
    marginBottom: 14,
  },
  cardKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: C.goldHi,
    marginBottom: 8,
  },
  legacyLine: { color: C.cream80, fontSize: 13, marginBottom: 4 },

  floatLayer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
  },
  floatRow: {
    paddingHorizontal: 0,
    paddingBottom: 0,
    alignItems: 'stretch',
  },
});

const sWeb = {
  glass: {
    backdropFilter: 'blur(28px) saturate(160%)',
    WebkitBackdropFilter: 'blur(28px) saturate(160%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 28px rgba(0,0,0,0.20)',
  },
};

// ── Bottom-nav styles ──────────────────────────────────────────────────
const n = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(11,8,32,0.92)',
    borderTopWidth: 1, borderTopColor: 'rgba(232,201,106,0.18)',
  },
  barWeb: {
    backdropFilter: 'blur(24px) saturate(160%)',
    WebkitBackdropFilter: 'blur(24px) saturate(160%)',
    boxShadow: '0 -8px 28px rgba(0,0,0,0.45)',
  } as any,

  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minWidth: 56,
  },
  cellLabel: {
    color: C.cream65,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  cellLabelActive: { color: C.goldHi, fontWeight: '800' },
});

export default CosmicHome;
