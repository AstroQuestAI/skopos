/**
 * mdTheme — v9.0 Cosmic palette for Vidhaata responses + brand surfaces.
 *
 * Replaces the legacy "warm classical" palette (maroon H1 / saffron H2 /
 * cream tables) with the Cosmic equivalents (gold-glow H1, gold-line
 * tables on glass, cream body text on the deep-cosmic backdrop).
 *
 * Same shape/keys as before so every consumer (OverviewTab, charts table,
 * Vidhaata markdown) continues to compile without changes.
 */
import { Platform } from 'react-native';

export const BRAND = {
  text:     '#F5EDD6',                       // cream — body text on glass
  faint:    'rgba(245, 237, 214, 0.55)',
  saffron:  '#E8C96A',                       // H2 / accent → gold
  maroon:   '#E8C96A',                       // H1 → gold (was maroon)
  cream:    'rgba(34, 22, 71, 0.62)',        // "card" bg → glass tint
  goldLine: 'rgba(201, 168, 76, 0.30)',      // hairlines / dividers
  hairline: 'rgba(245, 237, 214, 0.10)',
  emerald:  '#A6DFB0',
  amber:    '#E8C96A',
  rose:     '#E07A45',
} as const;

export const mdStyles = {
  body: { color: BRAND.text, fontSize: 14, lineHeight: 22 },

  heading1: { color: BRAND.maroon, fontSize: 17, fontWeight: '800',
              marginTop: 12, marginBottom: 6,
              borderBottomWidth: 2, borderBottomColor: BRAND.goldLine, paddingBottom: 3 },
  heading2: { color: BRAND.saffron, fontSize: 15, fontWeight: '800',
              marginTop: 12, marginBottom: 6,
              borderBottomWidth: 1, borderBottomColor: BRAND.goldLine, paddingBottom: 2 },
  heading3: { color: BRAND.saffron, fontSize: 14, fontWeight: '700',
              marginTop: 9, marginBottom: 4 },

  strong: { fontWeight: '800', color: BRAND.text },
  em:     { fontStyle: 'italic', color: BRAND.faint },

  bullet_list:      { marginVertical: 4 },
  ordered_list:     { marginVertical: 4 },
  list_item:        { marginVertical: 3 },
  bullet_list_icon: { color: BRAND.saffron, marginRight: 6 },

  blockquote: { borderLeftColor: BRAND.goldLine, borderLeftWidth: 3,
                paddingHorizontal: 12, paddingVertical: 6,
                marginVertical: 6, backgroundColor: BRAND.cream, borderRadius: 6 },

  code_inline: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                 backgroundColor: BRAND.cream, color: BRAND.maroon,
                 paddingHorizontal: 4, borderRadius: 4, fontSize: 13 },
  fence: { backgroundColor: BRAND.cream, padding: 8, borderRadius: 6,
           fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
           color: BRAND.text, marginVertical: 6,
           borderWidth: 1, borderColor: BRAND.goldLine },

  // Cosmic table — glass background, gold-line headers, cream cells.
  table: { borderWidth: 1, borderColor: BRAND.goldLine, borderRadius: 10,
           marginVertical: 10, overflow: 'hidden',
           backgroundColor: BRAND.cream },
  thead: { backgroundColor: 'rgba(232, 201, 106, 0.10)',
           borderBottomWidth: 1.3, borderBottomColor: BRAND.goldLine },
  th:    { padding: 9, fontWeight: '800', fontSize: 12.5,
           color: BRAND.saffron,
           borderRightWidth: 1, borderRightColor: BRAND.goldLine,
           textAlign: 'left' },
  tr:    { borderBottomWidth: 1, borderColor: BRAND.hairline },
  td:    { padding: 8, fontSize: 13, color: BRAND.text,
           borderRightWidth: 1, borderRightColor: BRAND.hairline },

  hr:        { backgroundColor: BRAND.goldLine, height: 1.5, marginVertical: 10 },
  paragraph: { marginTop: 4, marginBottom: 6 },
} as const;
