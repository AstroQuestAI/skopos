/**
 * profile.ts — client for the /api/profile/* subscription module.
 *
 * Responsibilities:
 *   • Generate + persist a stable Device ID in AsyncStorage.
 *   • Call /profile/init on app start to upsert the profile and fetch access.
 *   • Thin wrappers for plans, coupon validate, order create, order verify.
 *
 * MOCKED payment flow is honoured end-to-end — the verify endpoint accepts
 * `simulate: 'success' | 'failure'` until real Razorpay keys are wired.
 *
 * Teaser-mode (v6.37): during the 3-day Vidhaata trial, the chat overlay
 * limits the user to TEASER_DAILY_LIMIT messages/day. The count is tracked
 * per-device in AsyncStorage so it survives app restarts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import { BACKEND_URL } from './backendUrl';

const K_DEVICE_ID = '@astroquest.deviceId.v1';
const K_TEASER_COUNT = '@astroquest.teaserCount.v1';

export const TEASER_DAILY_LIMIT = 5;

// --- Device ID -------------------------------------------------------------

function _randomId(): string {
  // 16 hex chars — good enough; not a security boundary, just a stable ref.
  let out = '';
  const chars = 'abcdef0123456789';
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `aq_${Date.now().toString(36)}_${out}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(K_DEVICE_ID);
    if (existing) return existing;
    const id = _randomId();
    await AsyncStorage.setItem(K_DEVICE_ID, id);
    return id;
  } catch {
    // Last-resort ephemeral fallback
    return _randomId();
  }
}

/**
 * v6.49 — called on logout so the next user on the same browser
 * doesn't inherit the previous user's device-id (and therefore
 * their profile, trial state, redeemed coupons, etc).
 *
 * v6.52 — expanded to ALSO wipe the `vedic.*` keys used by
 * /app/frontend/src/utils/storage.ts (StoredProfile / lastChart /
 * chartSummary / chartHistory) and the persistent apiCache disk
 * layer (@apicache:v1:*). Without this, the previous user's chart
 * was re-hydrated on the next user's first render — which is the
 * "two browsers show the same Overview data" bug.
 */
export async function resetDeviceId(): Promise<void> {
  try {
    // Primary device identifiers.
    await AsyncStorage.removeItem(K_DEVICE_ID);
    await AsyncStorage.removeItem(K_TEASER_COUNT);
    await AsyncStorage.removeItem(K_AUTH_EMAIL);

    // Legacy / namespaced profile keys (both spellings).
    await AsyncStorage.removeItem('@astroquest.localProfile.v1');
    await AsyncStorage.removeItem('@astroquest.lastChart.v1');
    await AsyncStorage.removeItem('@astroquest.chartSummary.v1');
    await AsyncStorage.removeItem('@astroquest.history.v1');

    // The REAL keys used by storage.ts — these were being missed.
    await AsyncStorage.removeItem('vedic.profile.v1');
    await AsyncStorage.removeItem('vedic.lastChart.v1');
    await AsyncStorage.removeItem('vedic.chartSummary.v1');
    await AsyncStorage.removeItem('vedic.chartHistory.v1');

    // Sweep every persistent apiCache entry (calculate-chart, transits,
    // today-muhurtas, finder responses…). These are body-hashed and
    // therefore technically per-user, but two users with similar birth
    // details could still hit the same entry — cleaner to drop them all.
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith('@apicache:v1:'));
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  } catch { /* ignore */ }
}

// --- Types -----------------------------------------------------------------

export interface PlanInfo {
  plan_id: string;
  name: string;
  price_inr: number;
  duration_days: number;
  features: string[];
  description?: string;
  sort?: number;
}

export interface AccessMatrix {
  plan_id: string;
  plan_active: boolean;
  plan_expires_at: string | null;
  registered: boolean;
  needs_signin: boolean;
  trial: {
    days_since_install: number;
    trial_days_left: number;
    trial_start?: string;
    trial_end?: string;
    extensions_days?: number;
    is_registered_trial?: boolean;
    // Back-compat aliases (always equal to trial_days_left in v6.38).
    vidhata_days_left: number;
    overview_days_left: number;
  };
  features: {
    overview: boolean;
    today: boolean;
    charts: boolean;
    similar: boolean;
    vidhata: boolean;
  };
}

export interface ProfileInfo {
  device_id: string;
  phone?: string | null;
  name?: string | null;
  email?: string | null;
  first_seen_at?: string;
  plan_id: string;
  plan_expires_at?: string | null;
}

export interface InitResult {
  profile: ProfileInfo;
  access: AccessMatrix;
}

export interface CouponInfo {
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  base_amount: number;
  discount: number;
  final_amount: number;
  plan_id: string;
}

export interface OrderInfo {
  order_id: string;
  amount_paise: number;
  currency: string;
  plan: PlanInfo;
  final_amount: number;
  discount: number;
  coupon: string | null;
  mock: boolean;
  key_id: string;
}

// --- API wrappers ---------------------------------------------------------

// v6.51 — client-side email getter used by profile reads.
// Kept simple: the AsyncStorage key is maintained by index.tsx when
// authUser changes (login/logout), so every profile API call tacks on
// the authenticated email for the server's email-first resolver.
const K_AUTH_EMAIL = '@astroquest.authEmail.v1';
export async function setAuthEmail(email: string | null): Promise<void> {
  try {
    if (email) await AsyncStorage.setItem(K_AUTH_EMAIL, email);
    else await AsyncStorage.removeItem(K_AUTH_EMAIL);
  } catch { /* ignore */ }
}
async function _getAuthEmail(): Promise<string | undefined> {
  try { return (await AsyncStorage.getItem(K_AUTH_EMAIL)) || undefined; }
  catch { return undefined; }
}

export async function initProfile(opts: { email?: string; name?: string } = {}): Promise<InitResult> {
  const device_id = await getOrCreateDeviceId();
  const { data } = await axios.post(`${BACKEND_URL}/api/profile/init`, {
    device_id, ...opts,
  });

  // v7.19.4 — PRIVACY-FIRST hydrate: the backend no longer stores birth
  // details (PII lives only on the device). Merge the browser-local copy
  // over the sparse server profile so the app has everything it needs to
  // build a chart without a round-trip to MongoDB. Mirrors the same merge
  // inside useProfileStore.init() so both init paths behave identically.
  try {
    const email = (opts?.email || data?.profile?.email || '').toLowerCase();
    if (email) {
      // Dynamic import to avoid a circular module graph (localProfile has
      // its own AsyncStorage helpers and doesn't need profile.ts).
      const { loadLocalProfile } = await import('./localProfile');
      const local = await loadLocalProfile(email);
      if (local && local.dob && local.tob && local.birth_lat && local.birth_lon) {
        (data as any).profile = {
          ...data.profile,
          first_name:      local.first_name,
          last_name:       local.last_name,
          name:            `${local.first_name} ${local.last_name}`.trim(),
          gender:          local.gender,
          marital_status:  local.marital_status,
          dob:             local.dob,
          tob:             local.tob,
          birth_place:     local.birth_place,
          birth_lat:       local.birth_lat,
          birth_lon:       local.birth_lon,
          phone:           local.phone || (data.profile as any)?.phone || '',
          personal_details_complete: true,
        };
        if ((data as any).access) {
          (data as any).access.has_personal_details = true;
        }
      } else {
        // No usable local copy → force the form to show (the backend flag
        // alone is not trustworthy after the PII purge — a user may have
        // `personal_details_complete=true` in Mongo but nothing on this
        // device, so we route them through onboarding on every new device).
        (data as any).profile = {
          ...data.profile,
          dob: '', tob: '', birth_place: '',
          birth_lat: null, birth_lon: null,
          personal_details_complete: false,
        };
        if ((data as any).access) {
          (data as any).access.has_personal_details = false;
        }
      }
    }
  } catch (e) {
    // Non-fatal: fall through with whatever the backend gave us.
    // eslint-disable-next-line no-console
    console.warn('[initProfile] local hydrate failed', e);
  }

  return data as InitResult;
}

export async function fetchMe(): Promise<InitResult> {
  const device_id = await getOrCreateDeviceId();
  const email = await _getAuthEmail();
  const { data } = await axios.get(`${BACKEND_URL}/api/profile/me`, {
    params: email ? { device_id, email } : { device_id },
  });

  // v7.19.4 — same privacy-first hydrate as initProfile(). Birth details
  // live only on the device; merge the local copy over the server's
  // intentionally-sparse profile.
  try {
    const useEmail = (email || data?.profile?.email || '').toLowerCase();
    if (useEmail) {
      const { loadLocalProfile } = await import('./localProfile');
      const local = await loadLocalProfile(useEmail);
      if (local && local.dob && local.tob && local.birth_lat && local.birth_lon) {
        (data as any).profile = {
          ...data.profile,
          first_name:      local.first_name,
          last_name:       local.last_name,
          name:            `${local.first_name} ${local.last_name}`.trim(),
          gender:          local.gender,
          marital_status:  local.marital_status,
          dob:             local.dob,
          tob:             local.tob,
          birth_place:     local.birth_place,
          birth_lat:       local.birth_lat,
          birth_lon:       local.birth_lon,
          phone:           local.phone || (data.profile as any)?.phone || '',
          personal_details_complete: true,
        };
        if ((data as any).access) {
          (data as any).access.has_personal_details = true;
        }
      }
    }
  } catch { /* silent */ }

  return data as InitResult;
}

export async function updateProfile(patch: { name?: string; email?: string; phone?: string }): Promise<InitResult> {
  const device_id = await getOrCreateDeviceId();
  const email = patch.email || (await _getAuthEmail());
  const body: any = { device_id, ...patch };
  if (email && !body.email) body.email = email;
  const { data } = await axios.put(`${BACKEND_URL}/api/profile/me`, body);
  return data as InitResult;
}

export async function fetchPlans(): Promise<PlanInfo[]> {
  const { data } = await axios.get(`${BACKEND_URL}/api/profile/plans`);
  return (data?.plans || []).filter((p: PlanInfo) => p.plan_id !== 'guest');
}

export async function validateCoupon(code: string, plan_id: string): Promise<CouponInfo> {
  const { data } = await axios.post(`${BACKEND_URL}/api/profile/coupons/validate`, { code, plan_id });
  return data as CouponInfo;
}

export async function createOrder(plan_id: string, coupon?: string, gateway: 'razorpay_mock' | 'play_mock' = 'razorpay_mock'): Promise<OrderInfo> {
  const device_id = await getOrCreateDeviceId();
  const { data } = await axios.post(`${BACKEND_URL}/api/profile/payments/create-order`, {
    device_id, plan_id, coupon, gateway,
  });
  return data as OrderInfo;
}

export async function verifyOrder(order_id: string, simulate: 'success' | 'failure' = 'success'): Promise<InitResult & { status: string }> {
  const device_id = await getOrCreateDeviceId();
  const { data } = await axios.post(`${BACKEND_URL}/api/profile/payments/verify`, {
    order_id, device_id, simulate,
    payment_id: `pay_mock_${Math.random().toString(36).slice(2, 10)}`,
    signature: 'mock_signature',
  });
  return data as InitResult & { status: string };
}

// ── Razorpay Payments (v8.6) — auto-verifies via webhook + client handshake ──
export interface RazorpayOrderInfo {
  order_id: string;
  receipt: string;
  amount: number;
  amount_paise: number;
  currency: 'INR';
  key_id: string;          // 'SIMULATE' or the real rzp_test_* / rzp_live_* key
  simulate: boolean;       // true when backend is in scaffold / SIMULATE_ mode
  plan: PlanInfo;
  discount: number;
  coupon?: string | null;
}

export async function createRazorpayOrder(
  plan_id: string,
  coupon?: string,
  email?: string,
): Promise<RazorpayOrderInfo> {
  const device_id = await getOrCreateDeviceId();
  const { data } = await axios.post(`${BACKEND_URL}/api/profile/payments/razorpay/create-order`, {
    device_id, plan_id, coupon, email,
  });
  return data as RazorpayOrderInfo;
}

export async function verifyRazorpayPayment(
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string,
): Promise<{ status: string; new_expiry?: string }> {
  const device_id = await getOrCreateDeviceId();
  const { data } = await axios.post(`${BACKEND_URL}/api/profile/payments/razorpay/verify`, {
    device_id, razorpay_order_id, razorpay_payment_id, razorpay_signature,
  });
  return data;
}

export async function simulateRazorpayOutcome(
  order_id: string,
  outcome: 'success' | 'failure',
  email?: string,
): Promise<{ status: string; new_expiry?: string }> {
  const device_id = await getOrCreateDeviceId();
  // v8.1 — include email so the backend can fall back to email-based order
  // matching if this browser's device_id rotated between order creation
  // and the simulate click.
  const resolvedEmail = email || (await _getAuthEmail()) || undefined;
  const { data } = await axios.post(`${BACKEND_URL}/api/profile/payments/razorpay/simulate`, {
    device_id, order_id, outcome, email: resolvedEmail,
  });
  return data;
}

export async function getRazorpayStatus(order_id: string): Promise<{ status: string; paid_at?: string }> {
  const device_id = await getOrCreateDeviceId();
  const { data } = await axios.get(`${BACKEND_URL}/api/profile/payments/razorpay/status`, {
    params: { order_id, device_id },
  });
  return data;
}

// Dynamically load the Razorpay Checkout script on web. No-op on native.
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/**
 * v6.38 — redeem a trial-extension coupon (BETA3 / BETA7) or the developer
 * master unlock code (ASTROQUEST-DEV-FOREVER). Single-use per device for beta
 * codes; the dev code is reusable and grants Full Access for ~10 years.
 */
export async function redeemTrialCode(code: string): Promise<InitResult & { ok: boolean; message: string; kind: string }> {
  const device_id = await getOrCreateDeviceId();
  const { data } = await axios.post(`${BACKEND_URL}/api/profile/trial/redeem`, {
    device_id, code: code.trim().toUpperCase(),
  });
  return data;
}

// --- Teaser-mode daily limit tracking ------------------------------------

interface TeaserCounter { date: string; count: number; }

function _today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getTeaserUsage(): Promise<TeaserCounter> {
  try {
    const raw = await AsyncStorage.getItem(K_TEASER_COUNT);
    if (raw) {
      const parsed = JSON.parse(raw) as TeaserCounter;
      if (parsed.date === _today()) return parsed;
    }
  } catch {}
  return { date: _today(), count: 0 };
}

export async function bumpTeaserUsage(): Promise<TeaserCounter> {
  const current = await getTeaserUsage();
  const next: TeaserCounter = { date: _today(), count: current.count + 1 };
  try { await AsyncStorage.setItem(K_TEASER_COUNT, JSON.stringify(next)); } catch {}
  return next;
}
