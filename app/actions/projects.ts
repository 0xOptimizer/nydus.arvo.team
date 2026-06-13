'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { fetchWithAuth } from '@/lib/api';

export async function getProjects() {
    try {
        const session = await auth();
        if (!session?.user?.id) return [];
        return await fetchWithAuth(`/attached-projects?owner_discord_id=${session.user.id}`);
    } catch (err) {
        console.error('Fetch Projects Error:', err);
        return [];
    }
}

export async function createProject(formData: FormData) {
    const rawData = {
        project_name: formData.get('project_name'),
        tech_stack: formData.get('tech_stack'),
        github_repository_url: formData.get('github_repository_url'),
        subdomain: formData.get('subdomain'),
        branch: formData.get('branch') || 'main'
    };

    try {
        const data = await fetchWithAuth('/projects', { method: 'POST', body: JSON.stringify(rawData) });
        revalidatePath('/projects');
        return { success: true, webhook_uuid: data.webhook_uuid, webhook_secret: data.webhook_secret };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function deleteProject(uuid: string) {
    try {
        await fetchWithAuth(`/projects/${uuid}`, { method: 'DELETE' });
        revalidatePath('/projects');
        return { success: true };
    } catch (err: any) {
        console.error('Delete failed:', err.message || err);
        return { success: false, error: err.message || 'Delete failed' };
    }
}