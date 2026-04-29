/**
 * Cosmic theme tokens — extracted from /app/uat/theme26/.
 *
 * These are the canonical color / radius / shadow values for the
 * "Vidhaata Cosmic" theme. Importing these in a Cosmic component
 * keeps it visually identical to the static UAT prototype.
 */

export const cosmicTokens = {
  // Backgrounds
  bgDeep:    '#0D0B1E',
  bgMid:     '#1A1535',
  bgSurface: '#231D45',

  // Gold accent palette
  gold:       '#C9A84C',
  goldLight:  '#E8C96A',
  goldDim:    '#8A6F2E',

  // Terracotta accent
  terracotta:      '#C4622D',
  terracottaLight: '#E07A45',

  // Text
  text:   '#F5EDD6',
  text2:  'rgba(245,237,214,0.6)',
  textMu: 'rgba(245,237,214,0.35)',

  // Surfaces (glass)
  glass:       'rgba(255,255,255,0.07)',
  glassStrong: 'rgba(255,255,255,0.12)',

  // Borders
  border:    'rgba(201,168,76,0.20)',
  borderSub: 'rgba(255,255,255,0.15)',

  // Status (favorable / cautionary)
  fav:    '#a6dfb0',
  favBg:  'rgba(126,184,138,0.12)',
  cau:    '#E07A45',
  cauBg:  'rgba(196,98,45,0.12)',

  // Radii
  rCard:   20,
  rPill:   100,
  rBubble: 18,

  // Glow box-shadows (for use via web CSS)
  glowSoft:   '0 0 22px rgba(201,168,76,0.16), 0 0 70px rgba(201,168,76,0.06)',
  glowStrong: '0 0 30px rgba(232,201,106,0.32), 0 0 80px rgba(201,168,76,0.12)',

  // RN box-shadow approximation
  shadowGold: {
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 6,
  },

  // Type
  fontFamily:
    "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

export type CosmicTokens = typeof cosmicTokens;
