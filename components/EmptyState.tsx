import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Centered empty/placeholder box for lists that can be empty — used everywhere,
 * since the dev backend is often unreachable and actions fall back to [].
 */
export function EmptyState({
    icon,
    title,
    hint,
    action,
    className,
}: {
    icon: string;       // Font Awesome class, e.g. "fa-solid fa-inbox"
    title: string;
    hint?: string;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center gap-2 rounded-sm border border-dashed border-border px-6 py-10',
                className,
            )}
        >
            <i className={cn(icon, 'text-2xl text-muted-foreground/60')} />
            <p className="text-sm font-medium text-foreground">{title}</p>
            {hint && <p className="text-xs text-muted-foreground max-w-sm">{hint}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

export default EmptyState;
