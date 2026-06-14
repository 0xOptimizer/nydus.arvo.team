'use client';

import { useState } from 'react';
import { recoverServer } from '@/app/actions/services';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * "Recover all" — recreates any lost active node deployment + enabled pm2
 * managed service on its stored port/path (migration § B). Shows the report.
 */
export function RecoverAllButton() {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<any | null>(null);

    const run = async () => {
        setBusy(true);
        setResult(null);
        setOpen(true);
        const res = await recoverServer();
        setBusy(false);
        setResult(res);
    };

    return (
        <>
            <Button variant="outline" size="sm" onClick={run} pending={busy} pendingText="Recovering…">
                <i className="fa-solid fa-heart-pulse mr-1.5" />
                Recover all
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Service recovery</DialogTitle>
                        <DialogDescription>
                            Recreates lost processes on their stored ports; healthy ones are left alone.
                        </DialogDescription>
                    </DialogHeader>

                    {busy ? (
                        <div className="space-y-2 py-2">
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-4 w-24 bg-muted/25" />
                                <Skeleton className="h-4 w-20 bg-muted/25" />
                            </div>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-8 w-full bg-muted/20" style={{ opacity: 1 - i * 0.15 }} />
                            ))}
                        </div>
                    ) : result && !result.success ? (
                        <p className="py-4 text-sm text-destructive">{result.error || 'Recovery failed.'}</p>
                    ) : result ? (
                        <div className="space-y-3 py-1">
                            <div className="flex items-center gap-4 text-sm">
                                <span className={cn('font-bold', result.status === 'ok' ? 'text-green-500' : 'text-amber-500')}>
                                    {result.status === 'ok' ? 'OK' : 'Partial'}
                                </span>
                                <span className="text-green-500">{result.recovered ?? 0} recovered</span>
                                <span className="text-red-500">{result.failed ?? 0} failed</span>
                            </div>
                            <div className="max-h-72 space-y-1 overflow-y-auto">
                                {(result.report ?? []).map((r: any, i: number) => (
                                    <div key={r.target ?? i} className="flex items-start gap-2 rounded-sm border border-border bg-background/40 px-2.5 py-1.5 text-xs">
                                        <i className={cn('fa-solid mt-0.5', r.ok ? 'fa-circle-check text-green-500' : 'fa-circle-xmark text-red-500')} />
                                        <span className="font-mono">{r.target}</span>
                                        {r.detail && <span className="ml-auto text-muted-foreground">{r.detail}</span>}
                                    </div>
                                ))}
                                {(!result.report || result.report.length === 0) && (
                                    <p className="text-xs text-muted-foreground">Nothing needed recovery.</p>
                                )}
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </>
    );
}

export default RecoverAllButton;
