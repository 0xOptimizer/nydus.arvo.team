'use server';

import { API_BASE, apiHeaders, fetchWithAuth } from '@/lib/api';

/**
 * Poll the self-test state for button enablement (migration § C). Single-flight
 * across all admins (Discord + dashboard).
 *   { running: false, active: null }
 *   { running: true, active: { run_id, started_by, started_at, age_seconds, log_stream } }
 */
export async function getSelftestStatus(): Promise<{ running: boolean; active: any | null }> {
    try {
        const data = await fetchWithAuth('/selftest');
        return { running: !!data?.running, active: data?.active ?? null };
    } catch {
        return { running: false, active: null };
    }
}

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
            // The 409 now identifies the live run so the UI can offer "Watch".
            return { success: false, conflict: true, error: data.error || 'A self-test is already running.', active: data.active ?? null };
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
