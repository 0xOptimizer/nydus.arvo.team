'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDeploymentContext } from '@/app/deployments/context/DeploymentContext';
import { useStreamDock } from '@/context/StreamDockContext';
import { getDeploymentStatus } from '@/app/actions/deployment-control';
import { triggerRebuild } from '@/app/actions/deployments';
import { PageShell } from '@/components/PageShell';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusChip } from '@/components/StatusChip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnvEditor } from '@/components/deployments/EnvEditor';
import { LogsTab } from '@/components/deployments/detail/LogsTab';
import { WebhookTab } from '@/components/deployments/detail/WebhookTab';
import { ActionsTab } from '@/components/deployments/detail/ActionsTab';
import { pm2ChipState, httpChipState, sslChipState, dnsChipState } from '@/lib/health';
import { formatBytes, formatUptime } from '@/lib/format';

const STATUS_POLL_MS = 10_000;

export function DeploymentDetail({ deployment }: { deployment: any }) {
    const uuid = deployment.deployment_uuid;
    const { actorId } = useDeploymentContext();
    const { startRun } = useStreamDock();

    const [status, setStatus] = useState<any | null>(null);
    const [rebuilding, setRebuilding] = useState(false);

    const refresh = useCallback(async () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        const s = await getDeploymentStatus(uuid);
        setStatus(s);
    }, [uuid]);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, STATUS_POLL_MS);
        const onVis = () => { if (!document.hidden) refresh(); };
        document.addEventListener('visibilitychange', onVis);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
    }, [refresh]);

    const liveStatus = status?.status ?? deployment.status;
    const stack = status?.stack ?? deployment.tech_stack;

    const handleRebuild = async () => {
        setRebuilding(true);
        const res = await triggerRebuild(uuid, actorId);
        setRebuilding(false);
        if (res.success && res.run_uuid) {
            startRun({
                runId: res.run_uuid,
                kind: 'rebuild',
                label: `Rebuilding ${deployment.subdomain}.arvo.team`,
                onDone: () => refresh(),
            });
        }
    };

    const meta = (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusBadge status={liveStatus} />
            <StatusChip label="pm2"  state={pm2ChipState(status?.pm2)} />
            <StatusChip label="http" state={httpChipState(status?.http)} />
            <StatusChip label="ssl"  state={sslChipState(status?.ssl)} />
            <StatusChip label="dns"  state={dnsChipState(status?.dns)} />
        </div>
    );

    const actions = (
        <>
            <a href={`https://${deployment.subdomain}.arvo.team`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                    Open site <i className="fa-solid fa-arrow-up-right-from-square ml-1.5 text-xs" />
                </Button>
            </a>
            <Button size="sm" onClick={handleRebuild} disabled={rebuilding}>
                {rebuilding ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Queuing…</> : <><i className="fa-solid fa-rotate mr-2" />Rebuild</>}
            </Button>
        </>
    );

    return (
        <PageShell
            title={deployment.subdomain}
            description={`${deployment.subdomain}.arvo.team`}
            backHref="/deployments"
            meta={meta}
            actions={actions}
        >
            {/* Quick facts */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Fact label="Stack" value={<Badge variant="secondary" className="uppercase font-normal text-xs">{stack}</Badge>} />
                <Fact label="Port" value={<span className="font-mono text-sm">{status?.assigned_port ?? deployment.assigned_port ?? '—'}</span>} />
                <Fact label="SSL" value={<span className="font-mono text-sm">{status?.ssl?.days_left != null ? `${status.ssl.days_left}d left` : '—'}</span>} />
                <Fact label="Disk" value={<span className="font-mono text-sm">{formatBytes(status?.disk_bytes)}</span>} />
                {status?.pm2 && (
                    <>
                        <Fact label="Uptime" value={<span className="font-mono text-sm">{formatUptime(status.pm2.uptime, { since: true })}</span>} />
                        <Fact label="Restarts" value={<span className="font-mono text-sm">{status.pm2.restarts ?? 0}</span>} />
                        <Fact label="CPU" value={<span className="font-mono text-sm">{status.pm2.cpu ?? 0}%</span>} />
                        <Fact label="Memory" value={<span className="font-mono text-sm">{formatBytes(status.pm2.memory)}</span>} />
                    </>
                )}
            </div>

            <Tabs defaultValue="logs" className="w-full">
                <TabsList className="bg-card border border-border">
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                    <TabsTrigger value="env">Env</TabsTrigger>
                    <TabsTrigger value="webhook">Webhook</TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>

                <TabsContent value="logs" className="rounded-sm border border-border bg-card p-4">
                    <LogsTab deploymentUuid={uuid} stack={stack} />
                </TabsContent>
                <TabsContent value="env" className="rounded-sm border border-border bg-card p-4">
                    <EnvEditor deploymentUuid={uuid} />
                </TabsContent>
                <TabsContent value="webhook" className="rounded-sm border border-border bg-card p-4">
                    <WebhookTab deploymentUuid={uuid} />
                </TabsContent>
                <TabsContent value="actions">
                    <ActionsTab deploymentUuid={uuid} stack={stack} />
                </TabsContent>
            </Tabs>
        </PageShell>
    );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-sm border border-border bg-card p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
            <div className="mt-1">{value}</div>
        </div>
    );
}

export default DeploymentDetail;
