'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { pm2ChipState, httpChipState, sslChipState, dnsChipState } from '@/lib/health';
import { deploymentFqdn } from '@/lib/deployments';

export function DeploymentHealthGrid({ deployments }: { deployments: any[] }) {
    const counts = {
        active:    deployments.filter(d => d.status === 'active').length,
        unhealthy: deployments.filter(d => d.status === 'unhealthy').length,
        failed:    deployments.filter(d => d.status === 'failed').length,
    };

    return (
        <div className="rounded-sm border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Deployment Health
                </h3>
                <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-green-500">{counts.active} active</span>
                    <span className="text-amber-500">{counts.unhealthy} unhealthy</span>
                    <span className="text-red-500">{counts.failed} failed</span>
                </div>
            </div>

            {deployments.length === 0 ? (
                <div className="p-4">
                    <EmptyState
                        icon="fa-solid fa-rocket"
                        title="No deployments yet"
                        hint="Deploy a project from the Deployments page to see its live health here."
                    />
                </div>
            ) : (
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3"
                >
                    {deployments.map((d) => (
                        <motion.div key={d.deployment_uuid} variants={staggerItem}>
                            <Link
                                href={`/deployments/${d.deployment_uuid}`}
                                className="block rounded-sm border border-border bg-background/40 p-3 transition-colors hover:border-primary/40 hover:bg-secondary/30"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate font-mono text-sm">{deploymentFqdn(d)}</span>
                                    <StatusBadge status={d.status} />
                                </div>
                                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <StatusChip label="pm2"  state={pm2ChipState(d.pm2)} />
                                    <StatusChip label="http" state={httpChipState(d.http)} />
                                    <StatusChip label="ssl"  state={sslChipState(d.ssl)} />
                                    <StatusChip label="dns"  state={dnsChipState(d.dns)} />
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
}

export default DeploymentHealthGrid;
