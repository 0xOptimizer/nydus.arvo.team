'use server';

import { fetchWithAuth } from '@/lib/api';

/**
 * Per-deployment control plane. See FRONTEND_HANDOFF.md § Control plane.
 * All reads return null on error so the detail page degrades gracefully.
 */

/**
 * Live aggregated status:
 *   { deployment_uuid, subdomain, fqdn, stack, status,
 *     pm2: {status,restarts,uptime,cpu,memory} | null,
 *     http: {ok,code} | {ok:false,code:null,error},
 *     ssl: {days_left|null}, dns: {present,content,proxied,drift},
 *     disk_bytes|null, assigned_port, deployed_at, deployed_by }
 */
export async function getDeploymentStatus(uuid: string): Promise<any | null> {
    try {
        return await fetchWithAuth(`/deployments/${uuid}/status`);
    } catch (err: any) {
        console.error('[control] getDeploymentStatus:', err.message);
        return null;
    }
}

/** { nginx_config: string|null, package_scripts: object|null, env_file_name } */
export async function getDeploymentConfig(uuid: string): Promise<any | null> {
    try {
        return await fetchWithAuth(`/deployments/${uuid}/config`);
    } catch (err: any) {
        console.error('[control] getDeploymentConfig:', err.message);
        return null;
    }
}

/** Node-only. action: start|stop|restart|reload|flush (default restart). */
export async function processAction(uuid: string, action: string = 'restart') {
    try {
        const data = await fetchWithAuth(`/deployments/${uuid}/process`, {
            method: 'POST',
            body: JSON.stringify({ action }),
        });
        return { success: true, status: data.status as string, detail: data.detail as string };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

/** action: reload|enable|disable|test (default reload). */
export async function nginxAction(uuid: string, action: string = 'reload') {
    try {
        const data = await fetchWithAuth(`/deployments/${uuid}/nginx`, {
            method: 'POST',
            body: JSON.stringify({ action }),
        });
        return { success: true, status: data.status as string, detail: data.detail as string };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

export async function renewSsl(uuid: string) {
    try {
        const data = await fetchWithAuth(`/deployments/${uuid}/ssl/renew`, { method: 'POST' });
        return { success: true, status: data.status as string, detail: data.detail as string };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

export async function reconcileDns(uuid: string) {
    try {
        const data = await fetchWithAuth(`/deployments/${uuid}/dns/reconcile`, { method: 'POST' });
        return { success: true, status: data.status as string, detail: data.detail as string };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

/**
 * Existing webhook, or null when none is configured (404) or on error.
 * Shape: { webhook_uuid, url, secret, branch, content_type, events }
 */
export async function getWebhook(uuid: string): Promise<any | null> {
    try {
        return await fetchWithAuth(`/deployments/${uuid}/webhook`);
    } catch {
        return null;
    }
}

/** Idempotent — returns the existing webhook if already configured. */
export async function createWebhook(uuid: string) {
    try {
        const data = await fetchWithAuth(`/deployments/${uuid}/webhook`, { method: 'POST' });
        return { success: true, webhook: data };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

export async function deleteWebhook(uuid: string) {
    try {
        await fetchWithAuth(`/deployments/${uuid}/webhook`, { method: 'DELETE' });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}
