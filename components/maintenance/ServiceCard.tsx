'use client';

import { useState } from 'react';
import { serviceProcessAction, deleteService, getServiceDiagnostics } from '@/app/actions/services';
import { useEventStream } from '@/hooks/useEventStream';
import { LogViewer } from '@/components/LogViewer';
import { ServiceDialog } from '@/components/maintenance/ServiceDialog';
import { ServiceDiagnostics } from '@/components/DiagnosticsView';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function ServiceCard({ service, onChanged }: { service: any; onChanged: () => void }) {
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [result, setResult]   = useState<{ ok: boolean; msg: string } | null>(null);
    const [showLogs, setShowLogs] = useState(false);
    const [diag, setDiag]       = useState<any | null>(null);
    const [showDiag, setShowDiag] = useState(false);
    const [diagLoading, setDiagLoading] = useState(false);

    const enabled = service.enabled === 1 || service.enabled === true;
    const logUrl = showLogs ? `/api/stream/services/${service.service_uuid}/logs?lines=100` : null;
    const { lines, complete } = useEventStream(logUrl, { format: 'raw', maxLines: 300 });

    const toggleDiag = async () => {
        const next = !showDiag;
        setShowDiag(next);
        if (next && !diag) {
            setDiagLoading(true);
            setDiag(await getServiceDiagnostics(service.service_uuid));
            setDiagLoading(false);
        }
    };

    const run = async (key: string, action: string, confirmMsg?: string) => {
        if (confirmMsg && !confirm(confirmMsg)) return;
        setBusyKey(key);
        setResult(null);
        const res = await serviceProcessAction(service.service_uuid, action);
        setBusyKey(null);
        setResult(res.success ? { ok: true, msg: res.detail || res.status || 'Done.' } : { ok: false, msg: res.error || 'Action failed.' });
        setTimeout(() => setResult(null), 6000);
    };

    const handleDelete = async () => {
        if (!confirm(`Delete managed service "${service.name}"? This does not stop the underlying process.`)) return;
        setBusyKey('delete');
        const res = await deleteService(service.service_uuid);
        setBusyKey(null);
        if (res.success) onChanged();
        else setResult({ ok: false, msg: res.error || 'Delete failed.' });
    };

    return (
        <Card className="rounded-sm border-border bg-card p-4 min-w-0">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-2.5">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', enabled ? 'bg-green-500' : 'bg-muted-foreground/40')} />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{service.name}</p>
                        {service.fqdn && <p className="truncate font-mono text-[10px] text-muted-foreground">{service.fqdn}</p>}
                    </div>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px] uppercase font-normal">{service.service_type}</Badge>
            </div>

            {result && (
                <Alert variant={result.ok ? 'default' : 'destructive'} className="mt-3 text-xs">
                    <AlertDescription>{result.msg}</AlertDescription>
                </Alert>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" pending={busyKey === 'restart'} onClick={() => run('restart', 'restart')}>
                    Restart
                </Button>
                <Button variant="outline" size="sm" pending={busyKey === 'stop'} onClick={() => run('stop', 'stop', `Stop ${service.name}?`)}>
                    Stop
                </Button>
                <Button variant="outline" size="sm" pending={busyKey === 'start'} onClick={() => run('start', 'start')}>
                    Start
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowLogs(s => !s)}>
                    <i className={cn('fa-solid mr-1.5 text-xs', showLogs ? 'fa-eye-slash' : 'fa-terminal')} />
                    Logs
                </Button>
                <Button variant="outline" size="sm" onClick={toggleDiag}>
                    <i className="fa-solid fa-stethoscope mr-1.5 text-xs" />
                    Diagnose
                </Button>
                <ServiceDialog
                    mode="edit"
                    service={service}
                    onSaved={onChanged}
                    trigger={
                        <Button variant="outline" size="sm">
                            <i className="fa-solid fa-pen text-xs" />
                        </Button>
                    }
                />
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" pending={busyKey === 'delete'} onClick={handleDelete}>
                    <i className="fa-solid fa-trash" />
                </Button>
            </div>

            {showDiag && (
                <div className="mt-3 rounded-sm border border-border bg-background/40 p-3">
                    {diagLoading && !diag ? (
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-40" />
                            <Skeleton className="h-3 w-full bg-muted/25" />
                            <Skeleton className="h-3 w-3/4 bg-muted/25" />
                        </div>
                    ) : (
                        <ServiceDiagnostics diag={diag} />
                    )}
                </div>
            )}

            {showLogs && (
                <div className="mt-3">
                    <LogViewer lines={lines} live={!complete} heightClass="h-64" title="logs" />
                </div>
            )}
        </Card>
    );
}

export default ServiceCard;
