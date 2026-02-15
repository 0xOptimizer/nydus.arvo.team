'use server';

const API_URL = 'http://127.0.0.1:4000/api';

export async function getServiceLogs(service: string) {
    try {
        const res = await fetch(`${API_URL}/maintenance/logs/${service}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to fetch logs for ${service}`);
        const data = await res.json();
        return { success: true, logs: data.logs };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}