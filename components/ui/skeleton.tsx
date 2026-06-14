import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils';

/**
 * Loading-state primitives for the Nydus dashboard. These match the existing
 * skeleton aesthetic (animate-pulse + bg-muted/XX, per-row opacity gradient)
 * used by app/deployments/loading-skeleton.tsx, factored into reusable pieces.
 *
 * Loading contract: render these while `loading && !data`, then the real data,
 * then <EmptyState> — never the empty/zero state before the first fetch resolves.
 */

/** Base shimmer block. Size it with className (h-*, w-*, rounded-*) or style. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
    return <div className={cn('animate-pulse rounded bg-muted/40', className)} style={style} />;
}

/** A card matching the standard chrome: header bar + N body rows. */
export function CardSkeleton({
    rows = 4,
    className,
}: {
    rows?: number;
    className?: string;
}) {
    return (
        <div className={cn('overflow-hidden rounded-sm border border-border bg-card', className)}>
            <div className="h-12 animate-pulse border-b border-border bg-muted/20" />
            <div className="space-y-3 p-4 sm:p-6">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between" style={{ opacity: 1 - i * 0.12 }}>
                        <Skeleton className="h-3" style={{ width: 120 + (i % 3) * 24 }} />
                        <Skeleton className="h-3 w-10 bg-muted/25" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Dashboard system-stats row — 4 metric cards. Replaces the 0% flash. */
export function StatRowSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-sm border border-border bg-card p-4">
                    <div className="flex items-baseline justify-between">
                        <Skeleton className="h-2.5 w-16 bg-muted/30" />
                        <Skeleton className="h-2.5 w-8 bg-muted/25" />
                    </div>
                    <Skeleton className="mt-3 h-7 w-20" />
                    <Skeleton className="mt-3 h-1 w-full rounded-full bg-muted/30" />
                </div>
            ))}
        </div>
    );
}

/**
 * Rows for a table body. Reproduces the per-row opacity gradient so it reads as
 * native. Renders `cols` cells of varied widths, last cell pushed right.
 */
export function TableRowsSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    const widths = [160, 80, 64, 96, 72, 110];
    return (
        <div>
            {Array.from({ length: rows }).map((_, r) => (
                <div
                    key={r}
                    className="flex items-center gap-4 border-b border-border/50 px-4 py-3 last:border-0"
                    style={{ opacity: 1 - r * 0.12 }}
                >
                    {Array.from({ length: cols }).map((_, c) => (
                        <Skeleton
                            key={c}
                            className={cn('h-3 bg-muted/30', c === cols - 1 && 'ml-auto')}
                            style={{ width: widths[c % widths.length] }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

/** Vertical list of rows (dot + two text bars + trailing badge). For card lists. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="divide-y divide-border">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ opacity: 1 - i * 0.12 }}>
                    <Skeleton className="h-2 w-2 rounded-full bg-muted/40" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2.5 w-48 bg-muted/25" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full bg-muted/30" />
                </div>
            ))}
        </div>
    );
}
