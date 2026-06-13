'use client';

import { motion } from 'motion/react';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { formatBytes } from '@/lib/format';
import { cn } from '@/lib/utils';

interface SystemStats {
    cpu?: number;
    ram_percent?: number; ram_total?: number; ram_remaining?: number;
    disk_percent?: number; disk_total?: number; disk_remaining?: number;
    inodes_used?: number; inodes_total?: number;
}

function StatCard({ label, percent, detail }: { label: string; percent: number; detail: string }) {
    const danger = percent >= 90;
    const warn = percent >= 75;
    const barColor = danger ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-primary';
    return (
        <motion.div variants={staggerItem} className="rounded-sm border border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
                <span className="text-xs font-mono text-muted-foreground">{detail}</span>
            </div>
            <div className="mt-2 flex items-end gap-1">
                <AnimatedNumber value={percent} format={(n) => n.toFixed(0)} className="text-2xl font-bold" />
                <span className="mb-0.5 text-sm text-muted-foreground">%</span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-background/60">
                <motion.div
                    className={cn('h-full', barColor)}
                    animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                    transition={{ type: 'spring', stiffness: 90, damping: 20 }}
                />
            </div>
        </motion.div>
    );
}

export function SystemStatsRow({ system }: { system: SystemStats | null }) {
    const s = system ?? {};
    const ramUsed = (s.ram_total ?? 0) - (s.ram_remaining ?? 0);
    const diskUsed = (s.disk_total ?? 0) - (s.disk_remaining ?? 0);
    const inodePct = s.inodes_total ? ((s.inodes_used ?? 0) / s.inodes_total) * 100 : 0;

    return (
        <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
            <StatCard label="CPU"    percent={s.cpu ?? 0}          detail={`avg ${(s.cpu ?? 0).toFixed(0)}%`} />
            <StatCard label="Memory" percent={s.ram_percent ?? 0}  detail={`${formatBytes(ramUsed)} / ${formatBytes(s.ram_total)}`} />
            <StatCard label="Disk"   percent={s.disk_percent ?? 0} detail={`${formatBytes(diskUsed)} / ${formatBytes(s.disk_total)}`} />
            <StatCard label="Inodes" percent={inodePct}            detail={`${(s.inodes_used ?? 0).toLocaleString()}`} />
        </motion.div>
    );
}

export default SystemStatsRow;
