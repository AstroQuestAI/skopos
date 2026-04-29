/**
 * api.ts — v7.0 API middleware.
 *
 * Single entry-point for ALL backend calls. Stamps every request with
 *   • device_id  (from userScope.getDeviceId)
 *   • email      (from userScope.getAuthEmail)
 * so the server's email-first resolver uniquely identifies the user.
 *
 * This is the ONLY axios instance that should talk to /api/profile/*.
 * Prevents the scattered-callsite drift that caused the v6.x bugs.
 */
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getAuthEmail, getDeviceId } from './userScope';

import { BACKEND_URL } from '../utils/backendUrl';

export const api: AxiosInstance = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000,
});

// --------------------------------------------------------------------------
// Request interceptor — attach identity on every call.
// --------------------------------------------------------------------------
api.interceptors.request.use(async (config) => {
  const [deviceId, email] = await Promise.all([getDeviceId(), getAuthEmail()]);
  // For GET/DELETE → query params. For POST/PUT → body merge.
  const method = (config.method || 'get').toLowerCase();
  if (method === 'get' || method === 'delete') {
    config.params = { device_id: deviceId, ...(email ? { email } : {}), ...(config.params || {}) };
  } else {
    const body = (config.data && typeof config.data === 'object' && !Array.isArray(config.data)) ? config.data : {};
    config.data = { device_id: deviceId, ...(email ? { email } : {}), ...body };
  }
  return config;
});

// --------------------------------------------------------------------------
// Typed helpers — one call-pattern across the app.
// --------------------------------------------------------------------------
export async function apiGet<T = any>(path: string, opts?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.get<T>(path, opts);
  return data;
}

export async function apiPost<T = any>(path: string, body?: any, opts?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.post<T>(path, body || {}, opts);
  return data;
}

export async function apiPut<T = any>(path: string, body?: any, opts?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.put<T>(path, body || {}, opts);
  return data;
}
