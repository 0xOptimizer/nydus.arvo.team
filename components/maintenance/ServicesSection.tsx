'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { getServices, serviceProcessAction, deleteService } from '@/app/actions/services';
import { ServiceDetail } from '@/components/maintenance/ServiceCard';
import { ServiceDialog, AddServiceDialog } from '@/components/maintenance/ServiceDialog';
import { RecoverAllButton } from '@/components/maintenance/RecoverAllButton';
import { EmptyState } from '@/components/EmptyState';
import { Section } from '@/components/ui/section';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/StatusChip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { scaleIn } from '@/lib/motion';

export function ServicesSection() {
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading]   = useState(true);
    const [busy, setBusy] = useState<{ id: string; key: string } | null>(null);
    const [result, setResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        const data = await getServices();
        setServices(data);
        setLoading(false);
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const run = async (svc: any, key: string, action: string, confirmMsg?: string) => {
        if (confirmMsg && !confirm(confirmMsg)) return;
        setBusy({ id: svc.service_uuid, key });
        setResult(null);
        const res = await serviceProcessAction(svc.service_uuid, action);
        setBusy(null);
        setResult({
            id: svc.service_uuid,
            ok: res.success,
            msg: res.success ? (res.detail || res.status || 'Done.') : (res.error || 'Action failed.'),
        });
        setTimeout(() => setResult((r) => (r?.id === svc.service_uuid ? null : r)), 6000);
    };

    const handleDelete = async (svc: any) => {
        if (!confirm(`Delete managed service "${svc.name}"? This does not stop the underlying process.`)) return;
        setBusy({ id: svc.service_uuid, key: 'delete' });
        const res = await deleteService(svc.service_uuid);
        setBusy(null);
        if (res.success) {
            if (expanded === svc.service_uuid) setExpanded(null);
            refresh();
        } else {
            setResult({ id: svc.service_uuid, ok: false, msg: res.error || 'Delete failed.' });
        }
    };

    const isBusy = (id: string, key: string) => busy?.id === id && busy.key === key;

    const columns: Column<any>[] = [
        {
            key: 'service',
            header: 'Service',
            render: (s) => {
                const enabled = s.enabled === 1 || s.enabled === true;
                return (
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-foreground">{s.name}</span>
                            <StatusChip
                                label={enabled ? 'Enabled' : 'Disabled'}
                                state={enabled ? 'ok' : 'unknown'}
                                pulse={enabled}
                                className="shrink-0"
                            />
                        </div>
                        {s.fqdn && (
                            <p className="truncate font-mono text-[10px] text-muted-foreground">{s.fqdn}</p>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'type',
            header: 'Type',
            render: (s) => (
                <Badge variant="secondary" className="text-[10px] font-normal uppercase">
                    {s.service_type}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (s) => {
                const id = s.service_uuid;
                const isOpen = expanded === id;
                return (
                    <div className="flex flex-wrap justify-end gap-1.5">
                        <Button variant="outline" size="sm" pending={isBusy(id, 'restart')} pendingText="…" onClick={() => run(s, 'restart', 'restart')}>
                            Restart
                        </Button>
                        <Button variant="outline" size="sm" pending={isBusy(id, 'stop')} pendingText="…" onClick={() => run(s, 'stop', 'stop', `Stop ${s.name}?`)}>
                            Stop
                        </Button>
                        <Button variant="outline" size="sm" pending={isBusy(id, 'start')} pendingText="…" onClick={() => run(s, 'start', 'start')}>
                            Start
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setExpanded(isOpen ? null : id)}>
                            <i className={isOpen ? 'fa-solid fa-chevron-up' : 'fa-solid fa-stethoscope'} />
                            {isOpen ? 'Close' : 'Diagnose'}
                        </Button>
                        <ServiceDialog
                            mode="edit"
                            service={s}
                            onSaved={refresh}
                            trigger={
                                <Button variant="outline" size="sm" aria-label="Edit service">
                                    <i className="fa-solid fa-pen" />
                                </Button>
                            }
                        />
                        <Button
                            variant="outline"
                            tone="inactive"
                            size="sm"
                            aria-label="Delete service"
                            pending={isBusy(id, 'delete')}
                            onClick={() => handleDelete(s)}
                        >
                            <i className="fa-solid fa-trash" />
                        </Button>
                    </div>
                );
            },
        },
    ];

    const expandedService = services.find((s) => s.service_uuid === expanded) || null;

    return (
        <Section
            title="Managed services"
            description="Sites and processes Nydus operates but didn’t deploy."
            icon="fa-solid fa-server"
            flush
            actions={
                <div className="flex items-center gap-2">
                    <RecoverAllButton />
                    <AddServiceDialog onCreated={refresh} />
                </div>
            }
        >
            {result && (
                <div className="px-4 pt-4 sm:px-6">
                    <Alert variant={result.ok ? 'default' : 'destructive'} className="text-xs">
                        <AlertDescription>{result.msg}</AlertDescription>
                    </Alert>
                </div>
            )}

            <DataTable
                columns={columns}
                rows={services}
                getRowId={(s) => s.service_uuid}
                loading={loading}
                empty={
                    <EmptyState
                        icon="fa-solid fa-server"
                        title="No managed services"
                        hint="Add one (the main site, the bot, nginx) to control it here. Requires the control-plane migration on the server."
                        action={<AddServiceDialog onCreated={refresh} />}
                    />
                }
            />

            <AnimatePresence initial={false}>
                {expandedService && (
                    <motion.div
                        key={expandedService.service_uuid}
                        variants={scaleIn}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                    >
                        <ServiceDetail service={expandedService} />
                    </motion.div>
                )}
            </AnimatePresence>
        </Section>
    );
}

export default ServicesSection;
