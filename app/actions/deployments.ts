'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const ENV          = process.env.ENVIRONMENT || 'production';
const IS_DEV       = ENV === 'development';

const VPS_PUBLIC_IP       = process.env.ARVO_VPS_IP || '127.0.0.1';
const VPS_PUBLIC_PORT     = process.env.ARVO_VPS_API_PORT || '5013';
const VPS_INTERNAL_IP     = process.env.ARVO_VPS_INTERNAL_IP || '127.0.0.1';
const VPS_INTERNAL_PORT   = process.env.ARVO_VPS_INTERNAL_API_PORT || '4000';
const AUTH_KEY            = process.env.ARVO_NYDUS_API_KEY || '';

const API_BASE = IS_DEV
    ? `http://${VPS_PUBLIC_IP}:${VPS_PUBLIC_PORT}/api`
    : `http://${VPS_INTERNAL_IP}:${VPS_INTERNAL_PORT}/api`;

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    if (IS_DEV) {
        options.headers = {
            ...(options.headers || {}),
            'Content-Type': 'application/json',
            'X-Auth-Key': AUTH_KEY,
        };
    } else {
        options.headers = {
            ...(options.headers || {}),
            'Content-Type': 'application/json',
        };
    }

    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, cache: 'no-store' });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return res.json();
}

export async function getDeployments() {
    try {
        return await fetchWithAuth('/deployments');
    } catch (err: any) {
        console.error('[deployments] getDeployments:', err.message);
        return [];
    }
}

export async function getDeployment(deploymentUuid: string) {
    try {
        return await fetchWithAuth(`/deployments/${deploymentUuid}`);
    } catch (err: any) {
        console.error('[deployments] getDeployment:', err.message);
        return null;
    }
}

export async function triggerDeploy(
    projectUuid: string,
    subdomain: string,
    triggeredBy: string,
) {
    const cookieStore = await cookies();
    const pat = cookieStore.get('nydus_pat')?.value || '';

    try {
        console.log('[triggerDeploy] Calling backend with:', { projectUuid, subdomain, triggeredBy });
        const data = await fetchWithAuth('/deploy', {
            method: 'POST',
            body: JSON.stringify({
                project_uuid:  projectUuid,
                subdomain,
                github_pat: pat,
                triggered_by:  triggeredBy,
            }),
        });
        console.log('[triggerDeploy] Backend response:', JSON.stringify(data, null, 2));
        console.log('[triggerDeploy] run_id field:', data.run_id);
        console.log('[triggerDeploy] All keys in response:', Object.keys(data));
        revalidatePath('/deployments');
        return { success: true, run_uuid: data.run_id as string };
    } catch (err: any) {
        console.error('[triggerDeploy] Error:', err.message, err);
        return { success: false, error: err.message as string };
    }
}

export async function triggerRebuild(deploymentUuid: string, triggeredBy: string) {
    try {
        const data = await fetchWithAuth(`/deploy/rebuild/${deploymentUuid}`, {
            method: 'POST',
            body: JSON.stringify({ triggered_by: triggeredBy }),
        });
        return { success: true, run_uuid: data.run_uuid as string };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

export async function getEnvLines(deploymentUuid: string) {
    try {
        return await fetchWithAuth(`/deployments/${deploymentUuid}/env`);
    } catch (err: any) {
        console.error('[deployments] getEnvLines:', err.message);
        return [];
    }
}

export async function updateEnvLine(deploymentUuid: string, key: string, value: string) {
    try {
        await fetchWithAuth(`/deployments/${deploymentUuid}/env`, {
            method: 'PUT',
            body: JSON.stringify({ key, value }),
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

export async function addEnvLine(deploymentUuid: string, key: string, value: string) {
    try {
        await fetchWithAuth(`/deployments/${deploymentUuid}/env`, {
            method: 'POST',
            body: JSON.stringify({ key, value }),
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

export async function deleteEnvLine(deploymentUuid: string, key: string) {
    try {
        await fetchWithAuth(`/deployments/${deploymentUuid}/env`, {
            method: 'DELETE',
            body: JSON.stringify({ key }),
        });
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}