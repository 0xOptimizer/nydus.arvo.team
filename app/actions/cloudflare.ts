'use server';

import { revalidatePath } from 'next/cache';

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
    // Only attach X-Auth-Key if in development/public mode
    if (IS_DEV) {
        options.headers = {
            ...(options.headers || {}),
            'Content-Type': 'application/json',
            'X-Auth-Key': AUTH_KEY
        };
    } else {
        options.headers = {
            ...(options.headers || {}),
            'Content-Type': 'application/json'
        };
    }

    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, cache: 'no-store' });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    return res.json();
}

export async function getDNSRecords(page: number = 1, search: string = '') {
    try {
        const query = new URLSearchParams({ page: page.toString(), per_page: '20' });
        if (search) query.append('name', search);
        return await fetchWithAuth(`/cloudflare/records?${query}`);
    } catch (error: any) {
        return { success: false, error: error.message, result: [] };
    }
}

export async function createSubdomainRecord(subdomain: string, comment: string = '') {
    try {
        const payload = {
            type: 'A',
            name: `${subdomain}.arvo.team`,
            content: IS_DEV ? VPS_PUBLIC_IP : VPS_INTERNAL_IP,
            proxied: true,
            ttl: 1,
            comment
        };
        const data = await fetchWithAuth(`/cloudflare/records`, { method: 'POST', body: JSON.stringify(payload) });
        revalidatePath('/dns');
        return { success: true, result: data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteDNSRecord(recordId: string) {
    try {
        await fetchWithAuth(`/cloudflare/records/${recordId}`, { method: 'DELETE' });
        revalidatePath('/dns');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getCloudflareAnalytics(days: number = 30) {
    try {
        const result = await fetchWithAuth(`/cloudflare/dynamic-analytics?days=${days}`, { signal: AbortSignal.timeout(8000) });
        return {
            data: result.data || [],
            granularity: result.granularity || (days <= 3 ? 'hourly' : 'daily')
        };
    } catch (error: unknown) {
        console.error('[Next.js Action] Fetch Error:', error);
        return { data: [], granularity: 'error' };
    }
}