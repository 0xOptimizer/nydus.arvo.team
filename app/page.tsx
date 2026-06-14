'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { PageShell } from '@/components/PageShell';
import { StatusChip } from '@/components/StatusChip';
import { SystemStatsRow } from '@/components/dashboard/SystemStatsRow';
import { DeploymentHealthGrid } from '@/components/dashboard/DeploymentHealthGrid';
import { ServicesStatusCard } from '@/components/dashboard/ServicesStatusCard';
import { RecentAlertsCard } from '@/components/dashboard/RecentAlertsCard';
import { getServerOverview } from '@/app/actions/services';
import { getAlerts, ackAlert } from '@/app/actions/alerts';
import type { AlertItem } from '@/components/AlertRow';

// recharts strip is client-only.
const CloudflareCondensed = dynamic(
    () => import('@/components/dashboard/CloudflareCondensed').then(m => m.CloudflareCondensed),
    { ssr: false },
);

const OVERVIEW_POLL_MS = 15_000;

export default function DashboardPage() {
    const [overview, setOverview] = useState<any | null>(null);
    const [alerts, setAlerts]     = useState<AlertItem[]>([]);
    const [loading, setLoading]   = useState(true);

    const refresh = useCallback(async () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        const [ov, al] = await Promise.all([getServerOverview(), getAlerts({ limit: 8 })]);
        setOverview(ov);
        setAlerts(al);
        setLoading(false);
    }, []);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, OVERVIEW_POLL_MS);
        const onVis = () => { if (!document.hidden) refresh(); };
        document.addEventListener('visibilitychange', onVis);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
    }, [refresh]);

    const handleAck = async (uuid: string) => {
        setAlerts(prev => prev.filter(a => a.alert_uuid !== uuid));
        await ackAlert(uuid);
    };

    const deployments = overview?.deployments ?? [];
    const services    = overview?.managed_services ?? [];
    const online      = !!overview;

    return (
        <PageShell
            title="Dashboard"
            description="Live server overview — deployments, services, and traffic at a glance."
            meta={<StatusChip label={online ? 'live' : 'offline'} state={online ? 'ok' : 'unknown'} pulse={online} />}
        >
            <SystemStatsRow system={overview?.system ?? null} loading={loading && !overview} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <DeploymentHealthGrid deployments={deployments} loading={loading && !overview} />
                    <CloudflareCondensed />
                </div>
                <div className="space-y-6">
                    <RecentAlertsCard alerts={alerts} onAck={handleAck} loading={loading && !overview} />
                    <ServicesStatusCard services={services} loading={loading && !overview} />
                </div>
            </div>
        </PageShell>
    );
}
