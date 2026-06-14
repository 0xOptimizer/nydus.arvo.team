'use client';

import { AnimatePresence, motion } from 'motion/react';
import { AlertRow, type AlertItem } from '@/components/AlertRow';
import { EmptyState } from '@/components/EmptyState';
import { ListSkeleton } from '@/components/ui/skeleton';
import { staggerContainer } from '@/lib/motion';

export function RecentAlertsCard({
    alerts,
    onAck,
    loading,
}: {
    alerts: AlertItem[];
    onAck?: (uuid: string) => void;
    loading?: boolean;
}) {
    const isLoading = loading && alerts.length === 0;
    return (
        <div className="rounded-sm border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Recent Alerts
                </h3>
                <i className="fa-solid fa-bell text-xs text-muted-foreground" />
            </div>

            {isLoading ? (
                <ListSkeleton rows={4} />
            ) : alerts.length === 0 ? (
                <div className="p-4">
                    <EmptyState icon="fa-solid fa-check-double" title="No recent alerts" />
                </div>
            ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="show" className="divide-y divide-border">
                    <AnimatePresence initial={false}>
                        {alerts.map((a) => (
                            <AlertRow key={a.alert_uuid} alert={a} onAck={onAck} />
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
}

export default RecentAlertsCard;
