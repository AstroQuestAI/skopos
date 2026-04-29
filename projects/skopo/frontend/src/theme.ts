/**
 * theme.ts — Vidhaata Cosmic palette (single source of truth).
 *
 * v9.0 — "no more tinkering" rewrite. Every component imports tokens
 * from here, so swapping these values cascades across AppHeader,
 * OverviewTab, BIRTH DETAILS card, Charts, Profile/Subscription modals
 * etc. without touching component layout code.
 *
 * Palette: Deep Indigo / Violet (primary)  +  Burnished Gold (accent).
 * Aesthetic: glossy, glassy, classy — frosted-glass cards over a
 * deep-cosmic backdrop, dull-glossy gold for marquee text.
 */
import { TextStyle } from 'react-native';

// ── Cosmic primitives (kept lowercase to discourage hex-hunting elsewhere) ──
const COSMIC = {
  // v9.4.3: mellowed the violet — desaturated and slightly deeper so
  // the cards lift off the background as glass instead of shouting.
  bgDeep:    '#0A0816',  // page backdrop (was #0D0B1E)
  bgMid:     '#15112A',  // (was #1A1535)
  bgPanel:   '#1E1838',  // raised surface (was #231D45)

  // Glass tints — lower alpha for more dimming/glass feel.
  glass:        'rgba(30, 24, 56, 0.50)',     // was rgba(34, 22, 71, 0.62)
  glassSoft:    'rgba(30, 24, 56, 0.32)',     // was 0.45
  glassStrong:  'rgba(30, 24, 56, 0.68)',     // was 0.78

  // Cream / parchment text + muted variants
  cream:    '#F5EDD6',
  cream80:  'rgba(245, 237, 214, 0.80)',
  cream65:  'rgba(245, 237, 214, 0.65)',
  cream45:  'rgba(245, 237, 214, 0.45)',
  cream20:  'rgba(245, 237, 214, 0.20)',
  cream10:  'rgba(245, 237, 214, 0.10)',

  // Burnished gold family — DULL glossy, not bright
  goldHi:   '#E8C96A',
  gold:     '#C9A84C',
  goldLo:   '#8A6F2E',
  goldFaint:'rgba(201, 168, 76, 0.18)',
  goldLine: 'rgba(201, 168, 76, 0.30)',

  // Terracotta accent (used very sparingly for warmth)
  terracotta:     '#C4622D',
  terracottaLight:'#E07A45',

  // Status — soft cosmic-friendly
  okFg:     '#A6DFB0',  okBg: 'rgba(126, 184, 138, 0.16)',
  warnFg:   '#E8C96A',  warnBg:'rgba(232, 201, 106, 0.14)',
  badFg:    '#E07A45',  badBg: 'rgba(196, 98, 45, 0.14)',
};

export const theme = {
  cosmic: COSMIC,
  colors: {
    // ── Brand: indigo→violet (deeper, richer than legacy) ──
    primary900: '#0D0B1E',
    primary800: '#1A1535',
    primary700: '#231D45',
    primary600: '#4F46E5',  // kept vivid — used for the SectionBanner ribbon
    primary500: '#6366F1',
    primary400: '#818CF8',
    primary100: COSMIC.goldFaint,   // light fills become gold-tint
    primary50:  COSMIC.bgDeep,      // page-level "light bg" → solid deep cosmic

    // ── Accent: gold (replaces saffron) ──
    saffron700: COSMIC.goldHi,
    saffron600: COSMIC.gold,
    saffron500: COSMIC.gold,
    saffron400: COSMIC.terracottaLight,
    saffron300: COSMIC.goldHi,
    saffron100: COSMIC.goldFaint,
    saffron50:  COSMIC.glassSoft,

    // ── Neutrals ──
    ink:        COSMIC.cream,    // primary text → cream on dark
    body:       COSMIC.cream,
    muted:      COSMIC.cream80,
    hint:       COSMIC.cream65,
    faint:      COSMIC.cream45,
    divider:    COSMIC.cream10,
    surface:    COSMIC.glass,    // card backgrounds → glass
    canvas:     COSMIC.bgDeep,   // root canvas → deep cosmic

    // ── Status ──
    success:    COSMIC.okFg,    successBg: COSMIC.okBg,
    danger:     COSMIC.badFg,   dangerBg:  COSMIC.badBg,
    warn:       COSMIC.warnFg,  warnBg:    COSMIC.warnBg,

    // ── Convenience aliases ──
    brand:      COSMIC.gold,
    brandSoft:  COSMIC.goldFaint,
    accent:     COSMIC.terracottaLight,
    accentSoft: COSMIC.goldFaint,

    // ── Cosmic-specific extensions (new) ──
    gold:       COSMIC.gold,
    goldHi:     COSMIC.goldHi,
    goldLine:   COSMIC.goldLine,
    glass:      COSMIC.glass,
    glassSoft:  COSMIC.glassSoft,
    glassStrong:COSMIC.glassStrong,
    cream:      COSMIC.cream,
    cream80:    COSMIC.cream80,
    cream45:    COSMIC.cream45,
  },
  radii: { xs: 6, sm: 8, md: 10, lg: 14, xl: 20, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 28 },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.28,
      shadowRadius: 22,
      elevation: 6,
    },
  },
  text: {
    title:    { fontSize: 22, fontWeight: '800', color: COSMIC.cream,   letterSpacing: 0.2 } as TextStyle,
    subtitle: { fontSize: 13, color: COSMIC.cream80, fontWeight: '500' } as TextStyle,
    body:     { fontSize: 14, color: COSMIC.cream,   lineHeight: 20 } as TextStyle,
    caption:  { fontSize: 11, color: COSMIC.cream65, letterSpacing: 0.4 } as TextStyle,
    label:    { fontSize: 12, color: COSMIC.cream80, fontWeight: '600' } as TextStyle,
  },
};

export type Theme = typeof theme;
