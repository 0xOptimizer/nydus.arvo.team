'use server';

import { fetchWithAuth } from '@/lib/api';

export async function getServiceLogs(service: string) {
	try {
		const data = await fetchWithAuth(`/maintenance/logs/${encodeURIComponent(service)}`);
		return { success: true, logs: data.logs };
	} catch (err: any) {
		return { success: false, error: err.message };
	}
}