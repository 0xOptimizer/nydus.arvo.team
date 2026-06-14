'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStreamDock } from '@/context/StreamDockContext';
import { startSelfTest, getSelftestStatus } from '@/app/actions/selftest';
import { formatRelativeTime } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const VARIANTS = ['static', 'node', 'rebuild', 'webhook', 'rollback'];
const STATUS_POLL_MS = 10_000;

/**
 * Runs the deployment self-test. Single-flight across ALL admins (Discord +
 * dashboard) — we poll GET /api/selftest to disable the button and offer Watch
 * on the live run. Progress + the [RESULT] checklist stream in the bottom dock.
 */
export function SelfTestPanel() {
    const { startRun } = useStreamDock();
    const [starting, setStarting] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [notice, setNotice] = useState<{ kind: 'info' | 'warn' | 'error'; msg: string } | null>(null);
    const [active, setActive] = useState<any | null>(null);  // live run from another admin/session

    const poll = useCallback(async () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        const s = await getSelftestStatus();
        setActive(s.running ? s.active : null);
    }, []);

    useEffect(() => {
        poll();
        const id = setInterval(poll, STATUS_POLL_MS);
        const onVis = () => { if (!document.hidden) poll(); };
        document.addEventListener('visibilitychange', onVis);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
    }, [poll]);

    const toggle = (v: string) =>
        setSelected(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

    const watch = (runId: string) => {
        startRun({ runId, kind: 'selftest', label: 'Self-test running' });
    };

    const run = async () => {
        setStarting(true);
        setNotice(null);
        const variants = selected.length ? selected.join(',') : 'all';
        const res = await startSelfTest(variants);
        setStarting(false);

        if (res.success && res.run_id) {
            startRun({ runId: res.run_id, kind: 'selftest', label: 'Self-test running' });
            setActive({ run_id: res.run_id });
            setNotice({ kind: 'info', msg: 'Self-test started — progress streams in the dock below.' });
        } else if ((res as any).conflict) {
            const a = (res as any).active;
            if (a) setActive(a);
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
                <div className="flex shrink-0 items-center gap-2">
                    {active ? (
                        <Button variant="outline" onClick={() => watch(active.run_id)}>
                            <i className="fa-solid fa-eye mr-2" />Watch
                        </Button>
                    ) : null}
                    <Button onClick={run} disabled={starting || !!active}>
                        {starting
                            ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Starting…</>
                            : <><i className="fa-solid fa-flask mr-2" />Run self-test</>}
                    </Button>
                </div>
            </div>

            {active && (
                <Alert className="mt-4 border-amber-500/40 text-amber-500">
                    <AlertDescription className="text-xs">
                        A self-test is already running
                        {active.started_by && <> (started by {active.started_by}</>}
                        {active.started_at && <>, {formatRelativeTime(active.started_at)}</>}
                        {active.started_by && <>)</>}. Use <strong>Watch</strong> to follow it.
                    </AlertDescription>
                </Alert>
            )}

            {notice && !active && (
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
