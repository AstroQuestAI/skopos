/**
 * Google Identity Services (GIS) helper — v7.10 / v7.12.
 *
 * v7.12: renderGoogleButton() — imperative initializer that paints Google's
 *        trusted Sign-in button directly into a DOM node. No custom wrapper
 *        button anymore (that caused a double-button on-screen). The
 *        component that mounts the target div just wires its own
 *        onCredential callback and GIS handles the rest.
 *
 * Web-only. PWA ships as `expo export --platform web` per v8.7.
 */

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GIS_SCRIPT_ID = 'astroquest-gis-client-v1';

export const GOOGLE_CLIENT_ID: string =
  (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();

type GoogleAccountsId = {
  initialize: (cfg: {
    client_id: string;
    callback: (resp: { credential?: string }) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    ux_mode?: 'popup' | 'redirect';
    use_fedcm_for_prompt?: boolean;
    context?: 'signin' | 'signup' | 'use';
  }) => void;
  prompt: (cb?: (n: any) => void) => void;
  disableAutoSelect: () => void;
  renderButton: (
    el: HTMLElement,
    cfg: {
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'small' | 'medium' | 'large';
      type?: 'standard' | 'icon';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      width?: number | string;
      logo_alignment?: 'left' | 'center';
    },
  ) => void;
  cancel: () => void;
};
type GoogleAccounts = { id: GoogleAccountsId };
type GoogleNS = { accounts: GoogleAccounts };

declare global {
  interface Window {
    google?: GoogleNS;
  }
}

/** Inject Google's `gsi/client` script tag exactly once. */
export async function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.google?.accounts?.id) return;

  const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve) => {
      if (window.google?.accounts?.id) return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => resolve(), { once: true });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.id = GIS_SCRIPT_ID;
    s.src = GIS_SCRIPT_URL;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(s);
  });
}

export type GoogleButtonOpts = {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'small' | 'medium' | 'large';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  width?: number;
};

/**
 * Initialize GIS and paint the official Google button into `mountEl`.
 * The button is rendered ONCE per mount; calling again after a successful
 * sign-in is a no-op because the parent typically unmounts the login UI.
 *
 * @param mountEl       DOM node to render the button into
 * @param onCredential  Called with the signed ID-token JWT on success
 * @param onError       Called with a human-readable string on init / popup
 *                      failure; caller can surface it in an alert
 * @param opts          Button styling overrides
 */
export async function renderGoogleButton(
  mountEl: HTMLElement,
  onCredential: (idToken: string) => void,
  onError?: (msg: string) => void,
  opts?: GoogleButtonOpts,
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!GOOGLE_CLIENT_ID) {
    onError?.('EXPO_PUBLIC_GOOGLE_CLIENT_ID is not configured');
    return;
  }

  try {
    await loadGoogleIdentityScript();
  } catch (e: any) {
    onError?.(e?.message || 'Could not load Google sign-in');
    return;
  }

  const gis = window.google?.accounts?.id;
  if (!gis) {
    onError?.('Google Identity Services failed to initialize');
    return;
  }

  try {
    gis.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => {
        const tok = (resp?.credential || '').trim();
        if (!tok) {
          onError?.('No credential returned from Google');
          return;
        }
        onCredential(tok);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
      context: 'signin',
    });

    // Clear any stale button before rendering again.
    mountEl.innerHTML = '';
    gis.renderButton(mountEl, {
      type: 'standard',
      theme: opts?.theme || 'filled_blue',
      size: opts?.size || 'large',
      text: opts?.text || 'continue_with',
      shape: opts?.shape || 'pill',
      logo_alignment: 'left',
      width: opts?.width || 320,
    });
  } catch (e: any) {
    onError?.(e?.message || 'Google sign-in initialization failed');
  }
}

/** Manually dismiss any on-screen Google one-tap prompt. */
export function cancelGoogleSignIn(): void {
  try {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      window.google.accounts.id.cancel();
    }
  } catch { /* ignore */ }
}
