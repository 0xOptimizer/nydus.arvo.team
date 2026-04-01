export default function DatabasesSkeleton() {
    return (
        <div className="flex flex-col gap-6 w-full animate-pulse">
            <div className="flex items-center justify-between">
                <div className="h-7 w-48 rounded-md bg-muted/40" />
                <div className="flex gap-2">
                    <div className="h-8 w-24 rounded-md bg-muted/40" />
                    <div className="h-8 w-24 rounded-md bg-muted/30" />
                </div>
            </div>
            <div className="flex gap-3">
                {[80, 110, 90].map((w, i) => (
                    <div key={i} className="h-7 rounded-full bg-muted/30" style={{ width: w }} />
                ))}
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
                <div className="h-10 bg-muted/30 border-b border-border" />
                {Array.from({ length: 7 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-4 px-4 h-12 border-b border-border/50 last:border-0"
                        style={{ opacity: 1 - i * 0.1 }}
                    >
                        <div className="h-3 w-3 rounded-full bg-muted/40 shrink-0" />
                        <div className="h-3 rounded bg-muted/40" style={{ width: `${120 + (i % 3) * 60}px` }} />
                        <div className="h-3 rounded bg-muted/30 ml-auto" style={{ width: `${60 + (i % 2) * 30}px` }} />
                        <div className="h-3 w-20 rounded bg-muted/25" />
                        <div className="h-6 w-16 rounded-full bg-muted/30" />
                    </div>
                ))}
            </div>
        </div>
    )
}