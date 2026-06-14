'use server';

import { fetchWithAuth } from '@/lib/api';

/**
 * Health watchdog alerting toggle (migration § D). State is in-memory on the
 * backend — a bot/server restart returns to the default-off state, so always
 * read fresh, never cache.
 *
 * Status shape:
 *   { alerts_enabled, alerting_now,            // alerting_now = enabled AND past grace
 *     grace_seconds, grace_remaining_seconds,
 *     self_heal_enabled, fail_threshold }
 */
export async function getWatchdog(): Promise<any | null> {
    try {
        return await fetchWithAuth('/watchdog');
    } catch (err: any) {
        console.error('[watchdog] getWatchdog:', err.message);
        return null;
    }
}

export async function setWatchdog(patch: { alerts_enabled?: boolean; self_heal_enabled?: boolean }) {
    try {
        const data = await fetchWithAuth('/watchdog', {
            method: 'POST',
            body: JSON.stringify(patch),
        });
        return { success: true, status: data };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}
