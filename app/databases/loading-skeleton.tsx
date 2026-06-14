import { Skeleton, CardSkeleton } from '@/components/ui/skeleton'

export default function DatabasesSkeleton() {
    return (
        <div className="w-full">
            {/* PageShell header */}
            <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-56 bg-muted/40" />
                    <Skeleton className="h-4 w-72 bg-muted/25" />
                </div>
                <Skeleton className="h-8 w-28 rounded-full bg-muted/30" />
            </div>

            {/* Section bodies */}
            <div className="space-y-6 pt-6">
                <CardSkeleton rows={3} />
                <CardSkeleton rows={6} />
            </div>
        </div>
    )
}
