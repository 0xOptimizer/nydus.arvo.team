'use client';

import { motion } from 'motion/react';
import { AlertRow, type AlertItem } from '@/components/AlertRow';
import { EmptyState } from '@/components/EmptyState';
import { staggerContainer } from '@/lib/motion';

export function RecentAlertsCard({
    alerts,
    onAck,
}: {
    alerts: AlertItem[];
    onAck?: (uuid: string) => void;
}) {
    return (
        <div className="rounded-sm border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Recent Alerts
                </h3>
                <i className="fa-solid fa-bell text-xs text-muted-foreground" />
            </div>

            {alerts.length === 0 ? (
                <div className="p-4">
                    <EmptyState icon="fa-solid fa-check-double" title="No recent alerts" />
                </div>
            ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="show" className="divide-y divide-border">
                    {alerts.map((a) => (
                        <AlertRow key={a.alert_uuid} alert={a} onAck={onAck} />
                    ))}
                </motion.div>
            )}
        </div>
    );
}

export default RecentAlertsCard;
