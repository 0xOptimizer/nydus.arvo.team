'use server';

import { API_BASE, apiHeaders } from '@/lib/api';

/**
 * Trigger the deployment self-test. See FRONTEND_HANDOFF.md § Self-test.
 *
 * Runs the real deploy pipeline against throwaway fixtures and tears it down.
 * Streams over the existing deploy-logs SSE (format A) at /api/deploy/logs/{run_id}.
 *
 * We always send cert_staging: true — issuing real certs is never exposed in the UI.
 * Distinguishes 409 (single-flight conflict) and 503 (module unavailable) so the
 * caller can disable the button / show the right message.
 *
 * @param variants "all" (default) or a CSV of static,node,rebuild,webhook,rollback.
 */
export async function startSelfTest(variants: string = 'all') {
    try {
        const res = await fetch(`${API_BASE}/selftest`, {
            method: 'POST',
            headers: apiHeaders(),
            body: JSON.stringify({ variants, cert_staging: true }),
            cache: 'no-store',
        });

        const data = await res.json().catch(() => ({}));

        if (res.status === 409) {
            return { success: false, conflict: true, error: data.error || 'A self-test is already running.' };
        }
        if (res.status === 503) {
            return { success: false, unavailable: true, error: data.error || 'Self-test module unavailable.' };
        }
        if (!res.ok) {
            return { success: false, error: data.error || `Request failed with status ${res.status}` };
        }

        // 202 { status, run_id, variants, cert_staging, log_stream }
        return {
            success: true,
            run_id: data.run_id as string,
            variants: data.variants as string[],
            log_stream: data.log_stream as string,
        };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}
