'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

const API_URL = 'http://127.0.0.1:4000/api';

export async function getAttachedProjects() {
    try {
        const res = await fetch(`${API_URL}/github-projects`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch attached projects');
        return await res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function attachProject(projectData: any) {
    try {
        const session = await auth();
        console.log(session);
        if (!session?.user?.id) {
            throw new Error('Unauthorized: No user session found');
        }

        const payload = {
            ...projectData,
            owner_discord_id: session.user.id
        };

        const res = await fetch(`${API_URL}/github-projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to attach project');
        
        revalidatePath('/projects');
        return { success: true, uuid: data.uuid };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function detachProject(uuid: string) {
    try {
        const res = await fetch(`${API_URL}/github-projects/${uuid}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        revalidatePath('/projects');
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
