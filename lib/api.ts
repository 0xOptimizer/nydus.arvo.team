/**
 * Shared Nydus backend API client.
 *
 * IMPORTANT: this module must NOT carry the 'use server' directive — it exports
 * constants and synchronous helpers, which that directive forbids. Server actions
 * ('use server' files) and route handlers may freely import from it.
 *
 * The backend exposes two interfaces:
 *   - internal (no auth, private network) — used in production (internal IP:4000)
 *   - public  (auth required via X-Auth-Key) — used in development (public IP:5013)
 *
 * Per the backend contract, X-Auth-Key is sent on EVERY request: it's required on
 * the public interface and harmless on the internal one, so always sending it is
 * correct (and future-proofs us if auth is ever enabled internally).
 */

const ENV    = process.env.ENVIRONMENT || 'production';
export const IS_DEV = ENV === 'development';

const VPS_PUBLIC_IP     = process.env.ARVO_VPS_IP || '127.0.0.1';
const VPS_PUBLIC_PORT   = process.env.ARVO_VPS_API_PORT || '5013';
const VPS_INTERNAL_IP   = process.env.ARVO_VPS_INTERNAL_IP || '127.0.0.1';
const VPS_INTERNAL_PORT = process.env.ARVO_VPS_INTERNAL_API_PORT || '4000';

export const AUTH_KEY = process.env.ARVO_NYDUS_API_KEY || '';

/** Base URL including the `/api` prefix, e.g. `http://127.0.0.1:5013/api`. */
export const API_BASE = IS_DEV
    ? `http://${VPS_PUBLIC_IP}:${VPS_PUBLIC_PORT}/api`
    : `http://${VPS_INTERNAL_IP}:${VPS_INTERNAL_PORT}/api`;

/**
 * Standard headers for backend requests. Always includes X-Auth-Key.
 * @param extra additional headers to merge (override Content-Type if needed).
 */
export function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'X-Auth-Key': AUTH_KEY,
        ...extra,
    };
}

/** Headers for the upstream SSE proxy fetch (route handlers). */
export function upstreamSseHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', 'X-Auth-Key': AUTH_KEY };
}

/**
 * Fetch a JSON endpoint on the backend. Throws `Error(data.error || status)` on
 * non-2xx. Always no-store (these are live control-plane reads/writes).
 *
 * @param endpoint path beginning with `/`, relative to API_BASE (e.g. `/deployments`).
 */
export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: apiHeaders((options.headers as Record<string, string>) || {}),
        cache: 'no-store',
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    return res.json();
}
