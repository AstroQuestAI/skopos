/**
 * CosmicGlobalStyle — v9.0 LEAN rewrite.
 *
 * What the previous version did (and we no longer do):
 *   ✗ Walked the DOM at runtime to re-tag white surfaces.
 *   ✗ Hard-coded 50+ RN-Web atomic class hashes (brittle on every build).
 *   ✗ Force-painted every legacy gradient through .cosmic descendant rules.
 *
 * What this version does:
 *   ✓ Loads the Plus Jakarta Sans font (web only).
 *   ✓ Adds the `cosmic` class to <html>+<body> for legacy CSS escape hatches.
 *   ✓ Paints the deep-cosmic body background once (gradient + slow gold halo
 *     + a single-layer star field — pure CSS, no JS, no MutationObserver).
 *   ✓ Forces the global text color to cream so any text node that doesn't
 *     specify its own colour reads correctly on the dark backdrop.
 *   ✓ Provides a minimal CSS safety-net for inline `style="background-color:
 *     rgb(255, 255, 255)"` surfaces (translates to a glass tint) so legacy
 *     hand-styled cards in index.tsx don't punch white holes through the
 *     cosmic theme. THIS RULE IS THE ONLY RUNTIME OVERRIDE — the rest of
 *     the app reads cosmic colours from /app/frontend/src/theme.ts and
 *     /app/frontend/src/components/mdTheme.ts.
 *
 * No JS sweeper. No MutationObserver. No resize-tick rerun. The component
 * mounts once, injects ~80 lines of CSS, returns null.
 */
import { useEffect } from 'react';
import { useCosmic } from './useCosmic';

const STYLE_ID     = 'aq-cosmic-global-style';
const FONT_LINK_ID = 'aq-cosmic-font-link';
const FONT_PRE_ID  = 'aq-cosmic-font-preconnect';

const COSMIC_CSS = `
/* ─────────── COSMIC THEME — global skin (active when html.cosmic) ─────────── */

html.cosmic, html.cosmic body {
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont,
               'Segoe UI', Roboto, sans-serif !important;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #F5EDD6 !important;
  background-color: #0D0B1E !important;
}

/* Body backdrop — deep indigo→violet, slow rotating gold halo, single
   layered star field. Painted with two pseudo-elements so we don't need
   any extra DOM nodes. */
html.cosmic body {
  min-height: 100vh;
  background:
    radial-gradient(circle at 50% 0%, rgba(79,70,229,0.20) 0%, transparent 50%),
    radial-gradient(circle at 18% 88%, rgba(196,98,45,0.10) 0%, transparent 45%),
    radial-gradient(ellipse at 50% 50%, #1A1535 0%, #0D0B1E 70%) !important;
}
html.cosmic body::before {
  content: "";
  position: fixed; inset: -50% -50% 0 -50%;
  background: conic-gradient(from 0deg at 50% 50%,
    transparent 0deg,
    rgba(201,168,76,.05) 70deg,
    transparent 140deg,
    rgba(196,98,45,.04) 220deg,
    transparent 290deg);
  animation: aq-cosmic-rotate 90s linear infinite;
  pointer-events: none;
  z-index: 0;
}
html.cosmic body::after {
  content: "";
  position: fixed; inset: 0;
  background-image:
    radial-gradient(1px 1px at 8% 14%, rgba(255,255,255,.55), transparent 60%),
    radial-gradient(1px 1px at 19% 64%, rgba(255,255,255,.40), transparent 60%),
    radial-gradient(1.5px 1.5px at 27% 28%, rgba(232,201,106,.55), transparent 60%),
    radial-gradient(1px 1px at 38% 82%, rgba(255,255,255,.45), transparent 60%),
    radial-gradient(1px 1px at 47% 18%, rgba(255,255,255,.50), transparent 60%),
    radial-gradient(1.5px 1.5px at 58% 56%, rgba(232,201,106,.45), transparent 60%),
    radial-gradient(1px 1px at 64% 78%, rgba(255,255,255,.50), transparent 60%),
    radial-gradient(1px 1px at 72% 22%, rgba(255,255,255,.35), transparent 60%),
    radial-gradient(1.5px 1.5px at 81% 68%, rgba(232,201,106,.55), transparent 60%),
    radial-gradient(1px 1px at 89% 38%, rgba(255,255,255,.45), transparent 60%),
    radial-gradient(1px 1px at 94% 86%, rgba(255,255,255,.40), transparent 60%);
  background-repeat: no-repeat;
  pointer-events: none;
  z-index: 0;
}
@keyframes aq-cosmic-rotate { to { transform: rotate(360deg); } }

/* RN-Web mounts the app inside layered <div>s that get an inline white
   background. Make those internal wrapper divs transparent so the body
   backdrop above shows through. We DO NOT touch leaf nodes (cards),
   only the immediate scaffolding. */
html.cosmic, html.cosmic > body,
html.cosmic body > div, html.cosmic body > div > div,
html.cosmic body > div > div > div,
html.cosmic #root, html.cosmic #root > div,
html.cosmic #root > div > div {
  background-color: transparent !important;
  background-image: none !important;
}
html.cosmic { background-color: #0D0B1E !important; }

/* ── SAFETY NET — translate inline-style white surfaces to cosmic glass.
   RN-Web emits inline \`style="background-color: rgb(255, 255, 255)"\`
   for components that hardcode #FFFFFF (legacy index.tsx cards). We
   translate those to a subtle dark-purple glass tint so they read
   correctly without touching the component code. ── */
html.cosmic [style*="background-color: rgb(255, 255, 255)"],
html.cosmic [style*="background-color: rgb(255,255,255)"],
html.cosmic [style*="background-color: rgb(255, 247, 237)"],   /* legacy "cream" */
html.cosmic [style*="background-color: rgb(255,247,237)"],
html.cosmic [style*="background-color: rgb(254, 252, 232)"],   /* yellow-50 */
html.cosmic [style*="background-color: rgb(236, 253, 245)"],   /* emerald-50 */
html.cosmic [style*="background-color: rgb(254, 242, 242)"]    /* red-50 */
{
  background-color: rgba(34, 22, 71, 0.62) !important;
  border-color: rgba(201, 168, 76, 0.18) !important;
}
/* Light-indigo / pale lavender PAGE-CONTAINER surfaces become fully
   transparent so the cosmic backdrop shows through. */
html.cosmic [style*="background-color: rgb(238, 242, 255)"],   /* indigo-50 */
html.cosmic [style*="background-color: rgb(243, 232, 255)"],   /* purple-50 */
html.cosmic [style*="background-color: rgb(224, 231, 255)"],   /* indigo-100 */
html.cosmic [style*="background-color: rgb(250, 245, 255)"]    /* purple-100 */
{
  background-color: transparent !important;
}
/* Translate near-black inline text colours to cream so they remain
   readable on the dark backdrop. We deliberately do NOT touch text
   that already sets a coloured value (gold, indigo, green, etc). */
html.cosmic [style*="color: rgb(15, 23, 42)"],     /* slate-900 */
html.cosmic [style*="color: rgb(31, 41, 55)"],     /* slate-800 */
html.cosmic [style*="color: rgb(17, 24, 39)"],     /* gray-900 */
html.cosmic [style*="color: rgb(0, 0, 0)"]
{
  color: #F5EDD6 !important;
}
html.cosmic [style*="color: rgb(71, 85, 105)"],    /* slate-600 */
html.cosmic [style*="color: rgb(75, 85, 99)"]      /* gray-600 */
{
  color: rgba(245, 237, 214, 0.78) !important;
}

/* Smooth scrolling + thin glass scrollbars on web. */
html.cosmic ::-webkit-scrollbar              { width: 8px; height: 8px; }
html.cosmic ::-webkit-scrollbar-thumb        {
  background: rgba(201, 168, 76, 0.22);
  border-radius: 4px;
}
html.cosmic ::-webkit-scrollbar-thumb:hover  { background: rgba(201, 168, 76, 0.35); }
html.cosmic ::-webkit-scrollbar-track        { background: transparent; }
`;

function ensureFont() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById(FONT_PRE_ID)) {
    const pre = document.createElement('link');
    pre.id = FONT_PRE_ID;
    pre.rel = 'preconnect';
    pre.href = 'https://fonts.gstatic.com';
    pre.crossOrigin = 'anonymous';
    document.head.appendChild(pre);
  }
  if (!document.getElementById(FONT_LINK_ID)) {
    const lnk = document.createElement('link');
    lnk.id = FONT_LINK_ID;
    lnk.rel = 'stylesheet';
    lnk.href =
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(lnk);
  }
}

function ensureStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement('style');
  tag.id = STYLE_ID;
  tag.textContent = COSMIC_CSS;
  document.head.appendChild(tag);
}

function applyClass(active: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('cosmic', active);
  document.body?.classList.toggle('cosmic', active);
}

export function CosmicGlobalStyle() {
  const cosmic = useCosmic();
  useEffect(() => {
    if (!cosmic) {
      applyClass(false);
      return;
    }
    ensureFont();
    ensureStyle();
    applyClass(true);
    return () => applyClass(false);
  }, [cosmic]);
  return null;
}

export default CosmicGlobalStyle;
