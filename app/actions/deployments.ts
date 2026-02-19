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

export async function getDeployments() {
    try {
        return await fetchWithAuth('/deployments');
    } catch (error: any) {
        console.error('[Next.js Action] getDeployments error:', error.message);
        return [];
    }
}

export async function createDeployment(formData: FormData) {
    const rawData = {
        project_name: formData.get('project_name'),
        tech_stack: formData.get('tech_stack'),
        github_repository_url: formData.get('github_repository_url'),
        subdomain: formData.get('subdomain'),
        branch: formData.get('branch') || 'main',
        nginx_port: formData.get('nginx_port') || 0
    };

    try {
        const data = await fetchWithAuth('/deployments', {
            method: 'POST',
            body: JSON.stringify(rawData)
        });

        revalidatePath('/deployments');

        return { 
            success: true, 
            webhook_uuid: data.webhook_uuid,
            webhook_secret: data.webhook_secret
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteDeployment(uuid: string) {
    try {
        await fetchWithAuth(`/deployments/${uuid}`, { method: 'DELETE' });
        revalidatePath('/deployments');
        return { success: true };
    } catch (err: any) {
        console.error("[Next.js Action] deleteDeployment failed:", err.message || err);
        return { success: false, error: err.message || 'Delete failed' };
    }
}