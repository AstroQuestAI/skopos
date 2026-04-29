/**
 * userScope.ts — v7.0 foundation.
 *
 * Central helper for the two universal identity tokens we attach to EVERY
 * backend call and every AsyncStorage write:
 *
 *   • authEmail   — the signed-in Google user's email (null for guests)
 *   • deviceId    — per-browser stable UUID; REGENERATED on logout
 *
 * Rule of thumb:
 *   1.  When authEmail is present, the server uses email-first resolution —
 *       so two users sharing a browser can NEVER see each other's rows.
 *   2.  All local caches (profile / chart / panchanga / apiCache) are
 *       namespaced `u:<email>:<key>` so different logins have disjoint
 *       AsyncStorage buckets. Guest data lives under `u:guest:`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const K_DEVICE_ID  = '@astroquest.deviceId.v1';
const K_AUTH_EMAIL = '@astroquest.authEmail.v2';

// ---------------------------------------------------------------------------
// deviceId
// ---------------------------------------------------------------------------
function _uuid(): string {
  // lightweight UUID v4 — no external dep
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(K_DEVICE_ID);
  if (!id) {
    id = _uuid();
    await AsyncStorage.setItem(K_DEVICE_ID, id);
  }
  return id;
}

/** Called from handleLogout so the NEXT user gets a brand-new deviceId. */
export async function rotateDeviceId(): Promise<string> {
  const fresh = _uuid();
  await AsyncStorage.setItem(K_DEVICE_ID, fresh);
  return fresh;
}

// ---------------------------------------------------------------------------
// authEmail
// ---------------------------------------------------------------------------
export async function getAuthEmail(): Promise<string | null> {
  const v = await AsyncStorage.getItem(K_AUTH_EMAIL);
  return v ? v.toLowerCase() : null;
}

export async function setAuthEmail(email: string | null): Promise<void> {
  if (email) await AsyncStorage.setItem(K_AUTH_EMAIL, email.toLowerCase());
  else       await AsyncStorage.removeItem(K_AUTH_EMAIL);
}

// ---------------------------------------------------------------------------
// scope — current user bucket
// ---------------------------------------------------------------------------
/** "u:alice@example.com:" for signed-in users, "u:guest:" otherwise. */
export async function currentScope(): Promise<string> {
  const e = await getAuthEmail();
  return `u:${e || 'guest'}:`;
}

/**
 * Scoped AsyncStorage reader — returns null when nothing saved FOR THIS USER,
 * even if another user has something under the same logical key.
 */
export async function scopedGet(key: string): Promise<string | null> {
  const s = await currentScope();
  return AsyncStorage.getItem(s + key);
}

export async function scopedSet(key: string, value: string): Promise<void> {
  const s = await currentScope();
  await AsyncStorage.setItem(s + key, value);
}

export async function scopedRemove(key: string): Promise<void> {
  const s = await currentScope();
  await AsyncStorage.removeItem(s + key);
}

// ---------------------------------------------------------------------------
// Purge — nuclear option on logout / email-change.
// ---------------------------------------------------------------------------
/**
 * Wipes ALL user-scoped buckets, the device-id, the auth-email, the legacy
 * namespaced keys and every apiCache disk entry. Called from handleLogout.
 *
 * v7.19.3 + v8.4 — PRIVACY-FIRST exception: we deliberately PRESERVE
 *   • @astroquest.localProfile.<email>.v1   (user's birth details)
 *   • @astroquest.chart.<email>.<hash>.v1   (their cached computed chart)
 *   • @aq.bundle.<email>.v1                 (their /api/bootstrap bundle)
 *
 * Rationale: birth details live only on the user's own device (GDPR). On
 * logout we want to clear AUTH/session/API-cache state so the next signer-
 * inner doesn't see anyone else's data, but we must not destroy the
 * current user's birth-details copy — otherwise relogin forces them to
 * re-enter everything. The data is keyed per-email, so a different user
 * signing in won't accidentally see this user's profile. A dedicated
 * "Clear my data" button (Profile screen) is the explicit opt-in wipe.
 */
export async function purgeAllUserState(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const doomed = keys.filter((k) => {
    // Preserve per-email birth details + chart cache + bundle cache.
    if (k.startsWith('@astroquest.localProfile.')) return false;
    if (k.startsWith('@astroquest.chart.'))        return false;
    if (k.startsWith('@aq.bundle.'))               return false;
    return (
      k.startsWith('u:') ||
      k.startsWith('@apicache:') ||
      k.startsWith('vedic.') ||
      k.startsWith('@astroquest.')
    );
  });
  if (doomed.length) await AsyncStorage.multiRemove(doomed);
}

// ---------------------------------------------------------------------------
// Debug helper — used from ProfileScreen footer for support tickets.
// ---------------------------------------------------------------------------
export async function currentIdentity(): Promise<{ email: string | null; deviceId: string; scope: string }> {
  return {
    email:    await getAuthEmail(),
    deviceId: await getDeviceId(),
    scope:    await currentScope(),
  };
}
