'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDeploymentContext } from '@/app/deployments/context/DeploymentContext';
import { useStreamDock } from '@/context/StreamDockContext';
import { getDeploymentStatus } from '@/app/actions/deployment-control';
import { triggerRebuild } from '@/app/actions/deployments';
import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/ui/section';
import { EmptyState } from '@/components/EmptyState';
import { AnimatedStatusBadge } from '@/components/AnimatedStatusBadge';
import { AnimatedStatusChip } from '@/components/AnimatedStatusChip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnvEditor } from '@/components/deployments/EnvEditor';
import { LogsTab } from '@/components/deployments/detail/LogsTab';
import { WebhookTab } from '@/components/deployments/detail/WebhookTab';
import { ActionsTab } from '@/components/deployments/detail/ActionsTab';
import { DiagnosticsTab } from '@/components/deployments/detail/DiagnosticsTab';
import { pm2ChipState, httpChipState, sslChipState, dnsChipState } from '@/lib/health';
import { formatBytes, formatUptime } from '@/lib/format';
import { deploymentFqdn, deploymentName, dnsModeLabel } from '@/lib/deployments';

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
    const isUnhealthy = liveStatus === 'unhealthy' || liveStatus === 'failed';
    const stack = status?.stack ?? deployment.tech_stack;
    const dnsMode = status?.dns_mode ?? deployment.dns_mode ?? 'subdomain';
    const fqdn = deploymentFqdn({ fqdn: status?.fqdn ?? deployment.fqdn, subdomain: deployment.subdomain });

    const handleRebuild = async () => {
        setRebuilding(true);
        const res = await triggerRebuild(uuid, actorId);
        setRebuilding(false);
        if (res.success && res.run_uuid) {
            startRun({
                runId: res.run_uuid,
                kind: 'rebuild',
                label: `Rebuilding ${fqdn}`,
                onDone: () => refresh(),
            });
        }
    };

    const meta = (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <AnimatedStatusBadge status={liveStatus} />
            {dnsMode !== 'subdomain' && (
                <Badge variant="outline" className="font-normal text-[10px] uppercase">{dnsModeLabel(dnsMode)}</Badge>
            )}
            <AnimatedStatusChip label="pm2"  state={pm2ChipState(status?.pm2)} />
            <AnimatedStatusChip label="http" state={httpChipState(status?.http)} />
            <AnimatedStatusChip label="ssl"  state={sslChipState(status?.ssl)} />
            <AnimatedStatusChip label="dns"  state={dnsChipState(status?.dns)} />
        </div>
    );

    const actions = (
        <>
            <Button asChild variant="outline" size="sm">
                <a href={`https://${fqdn}`} target="_blank" rel="noopener noreferrer">
                    <i className="fa-solid fa-arrow-up-right-from-square" /> Open site
                </a>
            </Button>
            <Button ripple size="sm" onClick={handleRebuild} pending={rebuilding} pendingText="Queuing…">
                <i className="fa-solid fa-rotate" /> Rebuild
            </Button>
        </>
    );

    return (
        <PageShell
            title={deploymentName(deployment)}
            description={fqdn}
            backHref="/deployments"
            meta={meta}
            actions={actions}
        >
            {/* Quick facts */}
            <Section title="Runtime" description="Live process and certificate stats" icon="fa-solid fa-gauge-high">
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
            </Section>

            <Tabs defaultValue={isUnhealthy ? 'diagnose' : 'logs'} className="w-full space-y-4">
                <TabsList className="bg-card border border-border">
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                    <TabsTrigger value="env">Env</TabsTrigger>
                    <TabsTrigger value="webhook">Webhook</TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                    <TabsTrigger value="diagnose">
                        Diagnose
                        {isUnhealthy && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="logs">
                    <Section title="Logs" description="Live and replayed output for this deployment" icon="fa-solid fa-terminal">
                        <LogsTab deploymentUuid={uuid} stack={stack} />
                    </Section>
                </TabsContent>
                <TabsContent value="env">
                    <Section title="Environment" description="Variables written to this deployment's env file" icon="fa-solid fa-file-code">
                        <EnvEditor deploymentUuid={uuid} />
                    </Section>
                </TabsContent>
                <TabsContent value="webhook">
                    <Section title="Webhook" description="Auto-deploy on push to your branch" icon="fa-solid fa-code-branch">
                        <WebhookTab deploymentUuid={uuid} />
                    </Section>
                </TabsContent>
                <TabsContent value="actions">
                    <ActionsTab deploymentUuid={uuid} stack={stack} dnsMode={dnsMode} />
                </TabsContent>
                <TabsContent value="diagnose">
                    <Section title="Diagnostics" description="Crash output and health checks for troubleshooting" icon="fa-solid fa-stethoscope">
                        <DiagnosticsTab deploymentUuid={uuid} />
                    </Section>
                </TabsContent>
            </Tabs>
        </PageShell>
    );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-sm border border-border bg-background/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
            <div className="mt-1">{value}</div>
        </div>
    );
}

/** Full-width not-found state for an unknown deployment uuid. */
export function DeploymentNotFound() {
    return (
        <PageShell title="Deployment" backHref="/deployments">
            <EmptyState
                icon="fa-solid fa-circle-question"
                title="Deployment not found"
                hint="It may have been deleted, or the ID is incorrect."
            />
        </PageShell>
    );
}

export default DeploymentDetail;
