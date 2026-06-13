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