'use client';

import { motion } from 'motion/react';
import { staggerItem } from '@/lib/motion';
import { alertLevelStyle } from '@/lib/alerts';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface AlertItem {
    alert_uuid: string;
    level: string;
    source?: string;
    title: string;
    message: string;
    target?: string | null;
    is_critical?: number;
    acknowledged_at?: string | null;
    created_at: string;
}

/**
 * A single alert row, shared by the notification dropdown and the dashboard's
 * recent-alerts card. Clicking acknowledges (and the parent removes it).
 */
export function AlertRow({
    alert,
    onAck,
    className,
}: {
    alert: AlertItem;
    onAck?: (uuid: string) => void;
    className?: string;
}) {
    const style = alertLevelStyle(alert.level);

    return (
        <motion.button
            variants={staggerItem}
            onClick={() => onAck?.(alert.alert_uuid)}
            className={cn(
                'flex w-full items-start gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40',
                style.border,
                className,
            )}
        >
            <i className={cn('fa-solid mt-0.5 text-sm', style.icon, style.text)} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{alert.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {formatRelativeTime(alert.created_at)}
                    </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{alert.message}</p>
                {alert.target && (
                    <p className="truncate font-mono text-[10px] text-muted-foreground/70">{alert.target}</p>
                )}
            </div>
        </motion.button>
    );
}

export default AlertRow;
