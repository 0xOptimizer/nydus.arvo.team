'use server';

import { revalidatePath } from 'next/cache';
import { fetchWithAuth, IS_DEV } from '@/lib/api';

// Public-facing server IPs used as the A-record `content` when binding subdomains.
const VPS_PUBLIC_IP   = process.env.ARVO_VPS_IP || '127.0.0.1';
const VPS_INTERNAL_IP = process.env.ARVO_VPS_INTERNAL_IP || '127.0.0.1';

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