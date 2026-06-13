'use server';

import { fetchWithAuth } from '@/lib/api';

export async function getLiveStats() {
    try {
        return await fetchWithAuth('/stats');
    } catch (err) {
        return null;
    }
}