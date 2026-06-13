import { cn } from '@/lib/utils';

/**
 * Tiny dot+label health chip for control-plane signals (pm2 / HTTP / SSL / DNS).
 * Static class strings only, for Tailwind v4's scanner.
 */
export type ChipState = 'ok' | 'warn' | 'fail' | 'unknown';

const DOT: Record<ChipState, string> = {
    ok:      'bg-green-500',
    warn:    'bg-amber-500',
    fail:    'bg-red-500',
    unknown: 'bg-muted-foreground/50',
};

const TEXT: Record<ChipState, string> = {
    ok:      'text-green-500',
    warn:    'text-amber-500',
    fail:    'text-red-500',
    unknown: 'text-muted-foreground',
};

export function StatusChip({
    label,
    state,
    className,
    pulse = false,
}: {
    label: string;
    state: ChipState;
    className?: string;
    pulse?: boolean;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide',
                TEXT[state],
                className,
            )}
        >
            <span className="relative inline-flex">
                {pulse && state === 'ok' && (
                    <span className={cn('absolute inline-flex h-1.5 w-1.5 rounded-full opacity-75 animate-ping', DOT[state])} />
                )}
                <span className={cn('inline-block h-1.5 w-1.5 rounded-full', DOT[state])} />
            </span>
            {label}
        </span>
    );
}

export default StatusChip;
