import { Skeleton, CardSkeleton, TableRowsSkeleton } from '@/components/ui/skeleton';

export default function DeploymentsSkeleton() {
    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-52 bg-muted/40" />
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 space-y-4">
                    <div className="rounded-sm border border-border bg-card">
                        <div className="h-12 animate-pulse border-b border-border bg-muted/20" />
                    </div>

                    <div className="overflow-hidden rounded-sm border border-border bg-card">
                        <div className="h-10 animate-pulse border-b border-border bg-muted/30" />
                        <TableRowsSkeleton rows={5} cols={6} />
                    </div>
                </div>

                <div className="w-full lg:w-80 space-y-4">
                    <CardSkeleton rows={4} />
                </div>
            </div>
        </div>
    );
}
