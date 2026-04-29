/**
 * v7.4.2 — Single source of truth for the backend URL.
 *
 * Hostname-first resolver so that the live PWA always points at the correct
 * backend regardless of stale Vercel env vars or baked-in preview URLs:
 *
 *   1. Runtime hostname check:
 *      - *.preview.emergentagent.com     → use that hostname
 *      - vidhaata.vercel.app / *.vercel.app / vidhaata.app → Render production
 *      - localhost / 127.0.0.1           → honor env var or Render default
 *   2. EXPO_PUBLIC_BACKEND_URL env var (fallback only, for local dev & SSR).
 *      HARDENED: any value containing 'preview.emergentagent.com' or
 *      '__BACKEND_URL_PLACEHOLDER__' is rejected and RENDER_PROD is used.
 *   3. Render production URL as last-resort default.
 *
 * The Render URL is a public, non-secret endpoint — hardcoding it here as a
 * fallback makes the deploy robust to forgotten Vercel env vars and to
 * environments where runtime hostname detection fails.
 */

const RENDER_PROD = 'https://astroquest-backend-rott.onrender.com';
const HETZNER_PROD = 'https://api.astroquest.info';

function _isValidProdEnv(v: string | undefined | null): boolean {
  if (!v) return false;
  if (v === 'undefined') return false;
  if (!v.startsWith('http')) return false;
  // Reject baked-in placeholder & stale preview URLs that are known-bad in prod.
  if (v.includes('__BACKEND_URL_PLACEHOLDER__')) return false;
  if (v.includes('preview.emergentagent.com')) return false;
  return true;
}

function _resolve(): string {
  try {
    if (typeof window !== 'undefined') {
      const host = (window.location && window.location.hostname) || '';
      if (host.includes('preview.emergentagent.com')) {
        return `https://${host}`;
      }
      // v7.9 — custom domain astroquest.info uses Hetzner backend
      if (host === 'astroquest.info' || host === 'www.astroquest.info') {
        return HETZNER_PROD;
      }
      if (host.endsWith('vercel.app') || host === 'vidhaata.app' || host === 'www.vidhaata.app') {
        // While we migrate Render → Hetzner, the Vercel PWA points at
        // Hetzner as the new canonical API. Fall back to Render only if
        // the Hetzner host is unreachable (not detectable at build-time).
        return HETZNER_PROD;
      }
      if (host === 'localhost' || host === '127.0.0.1') {
        const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
        if (_isValidProdEnv(envUrl)) return envUrl as string;
        return HETZNER_PROD;
      }
    }
  } catch { /* ignore */ }
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (_isValidProdEnv(envUrl)) return envUrl as string;
  return HETZNER_PROD;
}

export const BACKEND_URL: string = _resolve();
