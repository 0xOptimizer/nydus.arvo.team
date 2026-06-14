'use client';

import { useState, useEffect } from 'react';
import { getServiceDiagnostics } from '@/app/actions/services';
import { useEventStream } from '@/hooks/useEventStream';
import { LogViewer } from '@/components/LogViewer';
import { ServiceDiagnostics } from '@/components/DiagnosticsView';
import { Section } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Expandable detail panel for a single managed service, shown under its
 * DataTable row. Auto-loads diagnostics on open and holds the live log stream;
 * the row-level process actions (restart/stop/start/delete/edit) live on the
 * table row in ServicesSection so they're always visible.
 */
export function ServiceDetail({ service }: { service: any }) {
    const [showLogs, setShowLogs] = useState(false);
    const [diag, setDiag] = useState<any | null>(null);
    const [diagLoading, setDiagLoading] = useState(false);

    const logUrl = showLogs ? `/api/stream/services/${service.service_uuid}/logs?lines=100` : null;
    const { lines, complete } = useEventStream(logUrl, { format: 'raw', maxLines: 300 });

    useEffect(() => {
        let cancelled = false;
        setDiagLoading(true);
        getServiceDiagnostics(service.service_uuid).then((d) => {
            if (!cancelled) { setDiag(d); setDiagLoading(false); }
        });
        return () => { cancelled = true; };
    }, [service.service_uuid]);

    return (
        <div className="space-y-3 border-t border-border bg-background/40 p-4">
            <Section
                title="Diagnostics"
                icon="fa-solid fa-stethoscope"
                flush
                bodyClassName="p-3"
                actions={
                    <Button variant="outline" size="sm" onClick={() => setShowLogs(s => !s)}>
                        <i className={cn('fa-solid', showLogs ? 'fa-eye-slash' : 'fa-terminal')} />
                        {showLogs ? 'Hide logs' : 'Live logs'}
                    </Button>
                }
            >
                {diagLoading && !diag ? (
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-3 w-full bg-muted/25" />
                        <Skeleton className="h-3 w-3/4 bg-muted/25" />
                    </div>
                ) : (
                    <ServiceDiagnostics diag={diag} />
                )}
            </Section>

            {showLogs && (
                <LogViewer lines={lines} live={!complete} heightClass="h-64" title="logs" />
            )}
        </div>
    );
}

export default ServiceDetail;
