'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDeploymentDiagnostics } from '@/app/actions/deployment-control';
import { ProcessDiagnostics, LogBlock } from '@/components/DiagnosticsView';
import { StatusChip } from '@/components/StatusChip';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';

/**
 * Crash diagnostics for a deployment — most useful when unhealthy/failed.
 * pm2 logs are empty for a dead process, so this pulls persisted stderr +
 * pm2 status + nginx errors (migration § C).
 */
export function DiagnosticsTab({ deploymentUuid }: { deploymentUuid: string }) {
    const [diag, setDiag] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const d = await getDeploymentDiagnostics(deploymentUuid);
        setDiag(d);
        setLoading(false);
    }, [deploymentUuid]);

    useEffect(() => { load(); }, [load]);

    if (loading && !diag) return <CardSkeleton rows={5} className="border-0" />;
    if (!diag) {
        return (
            <EmptyState
                icon="fa-solid fa-stethoscope"
                title="No diagnostics available"
                hint="The backend returned nothing — it may be unreachable or this stack has no process."
                action={<Button variant="outline" size="sm" onClick={load}>Retry</Button>}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                {diag.stack === 'node' && (
                    <StatusChip
                        label={diag.port_listening ? `port ${diag.assigned_port} listening` : `port ${diag.assigned_port} not listening`}
                        state={diag.port_listening ? 'ok' : 'fail'}
                    />
                )}
                <Button variant="outline" size="sm" className="ml-auto" onClick={load} pending={loading} pendingText="Refreshing…">
                    <i className="fa-solid fa-rotate mr-1.5 text-xs" />Refresh
                </Button>
            </div>

            <ProcessDiagnostics process={diag.process} />
            <LogBlock label="nginx error log" text={diag.nginx_error_log} />
        </div>
    );
}

export default DiagnosticsTab;
