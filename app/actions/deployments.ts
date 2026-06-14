'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { fetchWithAuth } from '@/lib/api';

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

export interface DeployParams {
    triggeredBy: string;
    dnsMode?: 'subdomain' | 'cloudflare' | 'external';
    subdomain?: string;   // required for dns_mode 'subdomain'
    domain?: string;      // required for dns_mode 'cloudflare' | 'external'
}

export async function triggerDeploy(projectUuid: string, params: DeployParams) {
    const cookieStore = await cookies();
    const pat = cookieStore.get('nydus_pat')?.value || '';

    const dnsMode = params.dnsMode ?? 'subdomain';

    // Body shape is mode-aware (see FRONTEND_HANDOFF_2026-06-14.md § A).
    const body: Record<string, any> = {
        project_uuid: projectUuid,
        github_pat: pat,
        triggered_by: params.triggeredBy,
    };
    if (dnsMode === 'subdomain') {
        body.subdomain = params.subdomain;
    } else {
        body.dns_mode = dnsMode;
        body.domain = params.domain;
    }

    try {
        const data = await fetchWithAuth('/deploy', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        revalidatePath('/deployments');
        return { success: true, run_uuid: data.run_id as string };
    } catch (err: any) {
        console.error('[triggerDeploy] Error:', err.message);
        return { success: false, error: err.message as string };
    }
}

export async function triggerRebuild(deploymentUuid: string, triggeredBy: string) {
    try {
        const data = await fetchWithAuth(`/deploy/rebuild/${deploymentUuid}`, {
            method: 'POST',
            body: JSON.stringify({ triggered_by: triggeredBy }),
        });
        return { success: true, run_uuid: data.run_id as string };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

export async function getEnvLines(deploymentUuid: string) {
    try {
        // Contract: 200 {"env":[{key,value}, ...]}. Tolerate a bare array too.
        const data = await fetchWithAuth(`/deployments/${deploymentUuid}/env`);
        if (Array.isArray(data)) return data;
        return Array.isArray(data?.env) ? data.env : [];
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
        // Contract: DELETE .../env?key=KEY (query param, no body).
        await fetchWithAuth(
            `/deployments/${deploymentUuid}/env?key=${encodeURIComponent(key)}`,
            { method: 'DELETE' },
        );
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}