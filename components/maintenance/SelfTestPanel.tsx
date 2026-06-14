'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStreamDock } from '@/context/StreamDockContext';
import { startSelfTest, getSelftestStatus } from '@/app/actions/selftest';
import { formatRelativeTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { SegmentedControl } from '@/components/ui/segmented';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const VARIANTS = ['static', 'node', 'rebuild', 'webhook', 'rollback'] as const;
type Variant = (typeof VARIANTS)[number];
const STATUS_POLL_MS = 10_000;

/**
 * Runs the deployment self-test. Single-flight across ALL admins (Discord +
 * dashboard) — we poll GET /api/selftest to disable the button and offer Watch
 * on the live run. Progress + the [RESULT] checklist stream in the bottom dock.
 */
export function SelfTestPanel() {
    const { startRun } = useStreamDock();
    const [starting, setStarting] = useState(false);
    const [selected, setSelected] = useState<Variant[]>([]);
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
        <Section
            title="Self-test"
            description="Runs the real deploy pipeline against throwaway fixtures, then tears it down."
            icon="fa-solid fa-flask"
            actions={
                <div className="flex items-center gap-2">
                    {active ? (
                        <Button variant="outline" onClick={() => watch(active.run_id)}>
                            <i className="fa-solid fa-eye" /> Watch
                        </Button>
                    ) : null}
                    <Button ripple onClick={run} disabled={!!active} pending={starting} pendingText="Starting…">
                        <i className="fa-solid fa-flask" /> Run self-test
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Confirms deploys still work end-to-end using staging certs. Pick variants to scope the
                    run, or leave all unselected to test everything.
                </p>

                <div className="flex flex-wrap items-center gap-1.5">
                    <SegmentedControl<Variant>
                        multiple
                        size="sm"
                        value={selected}
                        onChange={(v) => setSelected(v)}
                        options={VARIANTS.map(v => ({ value: v, label: v }))}
                    />
                    <span className="self-center pl-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {selected.length ? `${selected.length} selected` : 'All variants'}
                    </span>
                </div>

                {active && (
                    <Alert className="border-amber-500/40 text-amber-500">
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
                        className={cn(notice.kind === 'warn' && 'border-amber-500/40 text-amber-500')}
                    >
                        <AlertDescription>{notice.msg}</AlertDescription>
                    </Alert>
                )}
            </div>
        </Section>
    );
}

export default SelfTestPanel;
