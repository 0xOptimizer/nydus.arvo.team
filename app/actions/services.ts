'use server';

import { revalidatePath } from 'next/cache';
import { fetchWithAuth } from '@/lib/api';

/**
 * Managed services + server-wide overview. See FRONTEND_HANDOFF.md §
 * Control plane — server-wide & managed services. These depend on the
 * reliability/control-plane migration; until applied, /services may be
 * empty or 500 — all reads degrade to []/null.
 */

/**
 * ManagedService:
 *   { service_uuid, name, service_type: pm2|systemd|nginx|static,
 *     pm2_name, systemd_unit, fqdn, health_url, deploy_path, port,
 *     git_url, branch, enabled, created_at, updated_at }
 */
export async function getServices(): Promise<any[]> {
    try {
        const data = await fetchWithAuth('/services');
        return Array.isArray(data) ? data : [];
    } catch (err: any) {
        console.error('[services] getServices:', err.message);
        return [];
    }
}

export interface ServicePayload {
    name: string;
    service_type: string; // pm2|systemd|nginx|static
    pm2_name?: string | null;
    systemd_unit?: string | null;
    fqdn?: string | null;
    health_url?: string | null;
    deploy_path?: string | null;
    port?: number | null;
    git_url?: string | null;
    branch?: string | null;
}

export async function createService(payload: ServicePayload) {
    try {
        const data = await fetchWithAuth('/services', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        revalidatePath('/maintenance');
        return { success: true, service_uuid: data.service_uuid as string };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

export async function deleteService(serviceUuid: string) {
    try {
        await fetchWithAuth(`/services/${serviceUuid}`, { method: 'DELETE' });
        revalidatePath('/maintenance');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

/** action: start|stop|restart|reload|flush (default restart). */
export async function serviceProcessAction(serviceUuid: string, action: string = 'restart') {
    try {
        const data = await fetchWithAuth(`/services/${serviceUuid}/process`, {
            method: 'POST',
            body: JSON.stringify({ action }),
        });
        return { success: true, status: data.status as string, detail: data.detail as string };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

/**
 * One-call dashboard payload:
 *   { system: <same as /stats>, deployments: [<like /status, no disk_bytes>],
 *     managed_services: [ManagedService] }
 */
export async function getServerOverview(): Promise<any | null> {
    try {
        return await fetchWithAuth('/server/overview');
    } catch (err: any) {
        console.error('[services] getServerOverview:', err.message);
        return null;
    }
}

/** { pm2: [...], nginx_sites: [...], certs: [...] } */
export async function runDiscover(): Promise<any | null> {
    try {
        return await fetchWithAuth('/server/discover');
    } catch (err: any) {
        console.error('[services] runDiscover:', err.message);
        return null;
    }
}
