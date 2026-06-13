'use client';

import { useState } from 'react';
import { useStreamDock } from '@/context/StreamDockContext';
import { startSelfTest } from '@/app/actions/selftest';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const VARIANTS = ['static', 'node', 'rebuild', 'webhook', 'rollback'];

/**
 * Runs the deployment self-test. Single-flight on the backend — disables the
 * button on 409. Progress + the [RESULT] checklist stream in the bottom dock.
 */
export function SelfTestPanel() {
    const { startRun } = useStreamDock();
    const [running, setRunning] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [notice, setNotice] = useState<{ kind: 'info' | 'warn' | 'error'; msg: string } | null>(null);

    const toggle = (v: string) =>
        setSelected(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

    const run = async () => {
        setRunning(true);
        setNotice(null);
        const variants = selected.length ? selected.join(',') : 'all';
        const res = await startSelfTest(variants);
        setRunning(false);

        if (res.success && res.run_id) {
            startRun({ runId: res.run_id, kind: 'selftest', label: 'Self-test running' });
            setNotice({ kind: 'info', msg: 'Self-test started — progress streams in the dock below.' });
        } else if ((res as any).conflict) {
            setNotice({ kind: 'warn', msg: res.error || 'A self-test is already running.' });
        } else if ((res as any).unavailable) {
            setNotice({ kind: 'warn', msg: res.error || 'Self-test module unavailable.' });
        } else {
            setNotice({ kind: 'error', msg: res.error || 'Failed to start self-test.' });
        }
    };

    return (
        <Card className="p-4 sm:p-6 border-border bg-card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h3 className="text-lg font-bold uppercase tracking-tight">Self-test</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Runs the real deploy pipeline against throwaway fixtures (staging certs), then tears it down.
                        Confirms deploys still work end-to-end.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {VARIANTS.map(v => (
                            <button
                                key={v}
                                onClick={() => toggle(v)}
                                className={cn(
                                    'rounded-sm border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors',
                                    selected.includes(v)
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {v}
                            </button>
                        ))}
                        <span className="self-center pl-1 text-[10px] text-muted-foreground">
                            {selected.length ? '' : '(all variants)'}
                        </span>
                    </div>
                </div>
                <Button onClick={run} disabled={running} className="shrink-0">
                    {running ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Starting…</> : <><i className="fa-solid fa-flask mr-2" />Run self-test</>}
                </Button>
            </div>

            {notice && (
                <Alert
                    variant={notice.kind === 'error' ? 'destructive' : 'default'}
                    className={cn('mt-4', notice.kind === 'warn' && 'border-amber-500/40 text-amber-500')}
                >
                    <AlertDescription>{notice.msg}</AlertDescription>
                </Alert>
            )}
        </Card>
    );
}

export default SelfTestPanel;
