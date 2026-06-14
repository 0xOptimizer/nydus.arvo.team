import { Skeleton, TableRowsSkeleton } from '@/components/ui/skeleton';

/**
 * Suspense fallback for the deployments list. Mirrors the restructured DeployTab
 * layout — page header, Overview stat grid, the "Deploy a project" table, and the
 * "Deployments" table — so there's no layout shift when the real page hydrates.
 */
function SectionShell({
    headerWidth,
    children,
}: {
    headerWidth: string;
    children: React.ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
            <div className="flex items-center gap-2.5 border-b border-border p-4">
                <Skeleton className="h-3.5 w-3.5 rounded-sm bg-muted/30" />
                <div className="space-y-1.5">
                    <Skeleton className={`h-2.5 ${headerWidth} bg-muted/40`} />
                    <Skeleton className="h-2.5 w-48 bg-muted/20" />
                </div>
            </div>
            {children}
        </div>
    );
}

export default function DeploymentsSkeleton() {
    return (
        <div className="w-full">
            {/* Page header */}
            <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-56 bg-muted/40" />
                    <Skeleton className="h-3.5 w-72 bg-muted/25" />
                </div>
                <Skeleton className="h-8 w-28 rounded-full bg-muted/30" />
            </div>

            <div className="space-y-6 pt-6">
                {/* Overview — 5 stat tiles */}
                <SectionShell headerWidth="w-24">
                    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 sm:p-6 lg:grid-cols-5">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="rounded-sm border border-border bg-background/40 p-3">
                                <Skeleton className="h-2.5 w-14 bg-muted/30" />
                                <Skeleton className="mt-2.5 h-7 w-10 bg-muted/30" />
                            </div>
                        ))}
                    </div>
                </SectionShell>

                {/* Deploy a project table */}
                <SectionShell headerWidth="w-32">
                    <TableRowsSkeleton rows={3} cols={2} />
                </SectionShell>

                {/* Deployments table */}
                <SectionShell headerWidth="w-28">
                    <TableRowsSkeleton rows={5} cols={6} />
                </SectionShell>
            </div>
        </div>
    );
}
