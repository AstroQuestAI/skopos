/**
 * CosmicSkinSweeper — DEPRECATED in v9.0.
 *
 * The previous version walked the DOM at runtime to re-tag every light
 * surface, then relied on CosmicGlobalStyle to repaint the tagged nodes.
 * That design caused flashes on resize and required a 2-second polling
 * tick because RN-Web breakpoint flips don't generate mutation events.
 *
 * v9.0 replaces all of that with:
 *   • A new cosmic palette in /app/frontend/src/theme.ts and
 *     /app/frontend/src/components/mdTheme.ts (single source of truth
 *     for AppHeader, OverviewTab, Charts, Profile/Subscription modals).
 *   • A lean static CSS safety-net in CosmicGlobalStyle.tsx that catches
 *     the few hand-styled inline white surfaces in legacy screens.
 *
 * Nothing observes the DOM anymore. This stub remains so existing imports
 * (e.g. from app/_layout.tsx) keep compiling — it is a no-op.
 */
import React from 'react';

export function CosmicSkinSweeper(): React.ReactElement | null {
  return null;
}

export default CosmicSkinSweeper;
