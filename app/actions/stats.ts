'use server';

const ENV = process.env.ENVIRONMENT || 'production';
const IS_DEV = ENV === 'development';

const VPS_PUBLIC_IP = process.env.ARVO_VPS_IP || '127.0.0.1';
const VPS_PUBLIC_PORT = process.env.ARVO_VPS_API_PORT || '5013';
const VPS_INTERNAL_IP = process.env.ARVO_VPS_INTERNAL_IP || '127.0.0.1';
const VPS_INTERNAL_PORT = process.env.ARVO_VPS_INTERNAL_API_PORT || '4000';
const AUTH_KEY = process.env.ARVO_NYDUS_API_KEY || '';

const API_BASE = IS_DEV
    ? `http://${VPS_PUBLIC_IP}:${VPS_PUBLIC_PORT}/api`
    : `http://${VPS_INTERNAL_IP}:${VPS_INTERNAL_PORT}/api`;

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    if (IS_DEV) {
        options.headers = { ...(options.headers || {}), 'Content-Type': 'application/json', 'X-Auth-Key': AUTH_KEY };
    } else {
        options.headers = { ...(options.headers || {}), 'Content-Type': 'application/json' };
    }

    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, cache: 'no-store', next: { revalidate: 0 } });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return res.json();
}

export async function getLiveStats() {
    try {
        return await fetchWithAuth('/stats');
    } catch (err) {
        return null;
    }
}