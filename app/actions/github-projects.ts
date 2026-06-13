'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { fetchWithAuth } from '@/lib/api';

export async function getAttachedProjects() {
    try {
        return await fetchWithAuth('/github-projects');
    } catch (err: any) {
        console.error(err);
        return [];
    }
}

export async function attachProject(projectData: any) {
    try {
        const session = await auth();
        if (!session?.user?.id) throw new Error('Unauthorized: No user session found');

        const payload = { ...projectData, owner_discord_id: session.user.id };
        const data = await fetchWithAuth('/github-projects', { method: 'POST', body: JSON.stringify(payload) });

        revalidatePath('/projects');
        return { success: true, uuid: data.uuid };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function detachProject(uuid: string) {
    try {
        await fetchWithAuth(`/github-projects/${uuid}`, { method: 'DELETE' });
        revalidatePath('/projects');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}