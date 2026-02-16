'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

const API_URL = 'http://127.0.0.1:4000/api';

export async function getProjects() {
  try {
    const session = await auth();
    if (!session?.user?.id) return [];

    const res = await fetch(`${API_URL}/attached-projects?owner_discord_id=${session.user.id}`, { 
      cache: 'no-store' 
    });
    
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  } catch (error) {
    console.error("Fetch Projects Error:", error);
    return [];
  }
}

export async function createProject(formData: FormData) {
  const rawData = {
    project_name: formData.get('project_name'),
    tech_stack: formData.get('tech_stack'),
    github_repository_url: formData.get('github_repository_url'),
    subdomain: formData.get('subdomain'), // Critical for Tunnel DNS
    branch: formData.get('branch') || 'main'
  };

  try {
    const res = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawData),
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create project');
    
    revalidatePath('/projects');
    
    return { 
      success: true, 
      webhook_uuid: data.webhook_uuid,
      webhook_secret: data.webhook_secret 
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteProject(uuid: string) {
    try {
        await fetch(`${API_URL}/projects/${uuid}`, { method: 'DELETE' });
        revalidatePath('/projects');
    } catch (err) {
        console.error("Delete failed:", err);
    }
}