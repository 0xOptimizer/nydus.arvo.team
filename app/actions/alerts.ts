'use server';

import { fetchWithAuth } from '@/lib/api';

/**
 * Alerts / notifications feed. The notification UI reads these endpoints (not
 * Discord). See FRONTEND_HANDOFF.md § Alerts.
 *
 * Alert object:
 *   { alert_uuid, level: info|success|warning|error|critical,
 *     source: deploy|rebuild|watchdog|monitor|control|database|webhook,
 *     title, message, target (nullable), is_critical, acknowledged_at, created_at }
 */
export interface AlertsQuery {
    limit?: number;
    unacknowledged?: boolean;
    level?: string;
}

export async function getAlerts(opts: AlertsQuery = {}): Promise<any[]> {
    try {
        const query = new URLSearchParams();
        if (opts.limit !== undefined) query.set('limit', String(opts.limit));
        if (opts.unacknowledged) query.set('unacknowledged', 'true');
        if (opts.level) query.set('level', opts.level);
        const qs = query.toString();
        const data = await fetchWithAuth(`/alerts${qs ? `?${qs}` : ''}`);
        return Array.isArray(data) ? data : [];
    } catch (err: any) {
        console.error('[alerts] getAlerts:', err.message);
        return [];
    }
}

/** Unacknowledged count for the bell badge. Returns 0 on error. */
export async function getAlertCount(): Promise<number> {
    try {
        const data = await fetchWithAuth('/alerts/count');
        return Number(data?.unacknowledged) || 0;
    } catch {
        return 0;
    }
}

export async function ackAlert(alertUuid: string) {
    try {
        await fetchWithAuth(`/alerts/${alertUuid}/ack`, { method: 'POST' });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

export async function ackAllAlerts() {
    try {
        await fetchWithAuth('/alerts/ack-all', { method: 'POST' });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}
