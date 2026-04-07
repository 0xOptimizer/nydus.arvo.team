export default function DeploymentsSkeleton() {
    return (
        <div className="flex flex-col gap-6 w-full animate-pulse">
            <div className="flex items-center justify-between">
                <div className="h-7 w-52 rounded-md bg-muted/40" />
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 space-y-4">
                    <div className="border border-border rounded-sm bg-card">
                        <div className="h-12 border-b border-border bg-muted/20" />
                    </div>

                    <div className="rounded-sm border border-border overflow-hidden">
                        <div className="h-10 bg-muted/30 border-b border-border" />
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-4 px-4 h-12 border-b border-border/50 last:border-0"
                                style={{ opacity: 1 - i * 0.15 }}
                            >
                                <div className="h-3 rounded bg-muted/40" style={{ width: 160 }} />
                                <div className="h-5 w-16 rounded-full bg-muted/30" />
                                <div className="h-3 w-12 rounded bg-muted/25" />
                                <div className="h-5 w-14 rounded-sm bg-muted/30" />
                                <div className="h-3 w-24 rounded bg-muted/20 ml-auto" />
                                <div className="flex gap-1">
                                    <div className="h-7 w-7 rounded-md bg-muted/30" />
                                    <div className="h-7 w-7 rounded-md bg-muted/25" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-full lg:w-80 space-y-4">
                    <div className="border border-border rounded-sm bg-card">
                        <div className="h-12 border-b border-border bg-muted/20" />
                        <div className="p-4 space-y-3">
                            {[100, 80, 70, 60].map((w, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="h-3 rounded bg-muted/30" style={{ width: w }} />
                                    <div className="h-3 w-6 rounded bg-muted/25" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}