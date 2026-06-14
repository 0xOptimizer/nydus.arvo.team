import { Skeleton, TableRowsSkeleton } from '@/components/ui/skeleton'

export default function DatabasesSkeleton() {
    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-48 bg-muted/40" />
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-24 rounded-full bg-muted/40" />
                    <Skeleton className="h-8 w-24 rounded-full bg-muted/30" />
                </div>
            </div>

            <div className="flex gap-3">
                {[80, 110, 90].map((w, i) => (
                    <Skeleton key={i} className="h-7 rounded-full bg-muted/30" style={{ width: w }} />
                ))}
            </div>

            <div className="overflow-hidden rounded-sm border border-border bg-card">
                <div className="h-10 animate-pulse border-b border-border bg-muted/30" />
                <TableRowsSkeleton rows={7} cols={5} />
            </div>
        </div>
    )
}
