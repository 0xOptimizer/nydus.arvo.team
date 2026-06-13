import { cn } from '@/lib/utils';

/**
 * Deployment / generic status pill. Colors are complete static class strings so
 * Tailwind v4's scanner can see them (no dynamic concatenation).
 *
 * Statuses per contract: pending | active | failed | unhealthy.
 * `unhealthy` = site live but health check not returning 200 → amber.
 */
const STATUS_STYLES: Record<string, string> = {
    active:    'bg-green-500/10 text-green-500 border-green-500/30',
    failed:    'bg-red-500/10 text-red-500 border-red-500/30',
    pending:   'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    unhealthy: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    // managed-service / process states reuse the same palette
    online:    'bg-green-500/10 text-green-500 border-green-500/30',
    stopped:   'bg-red-500/10 text-red-500 border-red-500/30',
    errored:   'bg-red-500/10 text-red-500 border-red-500/30',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
    const style = STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground border-border';
    return (
        <span
            className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium border',
                style,
                className,
            )}
        >
            {status}
        </span>
    );
}

export default StatusBadge;
