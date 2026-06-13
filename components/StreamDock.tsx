'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStreamDock } from '@/context/StreamDockContext';
import { useEventStream } from '@/hooks/useEventStream';
import { LogViewer } from '@/components/LogViewer';
import { dockSlide } from '@/lib/motion';
import { computeProgress, hasErrorLine, parseSelfTestResult } from '@/lib/deployProgress';
import { cn } from '@/lib/utils';

/**
 * Global bottom-docked toast that streams deploy/rebuild/self-test logs (SSE
 * format A) with an inferred stage progress bar. Lives at the app shell level so
 * the stream survives route changes. Only one run is watched at a time.
 */
export function StreamDock() {
    const { run, visible, dismiss, reopen, clear } = useStreamDock();

    // Connect whenever there's a run. The stream stays alive while dismissed
    // (this component stays mounted; only its presentation changes).
    const url = run ? `/api/deploy/logs/${run.runId}` : null;

    const { lines, complete, error } = useEventStream(url, {
        format: 'json-line',
        maxLines: 500,
        onDone: () => run?.onDone?.(),
    });

    const [expanded, setExpanded] = useState(false);

    // Reset expansion when a new run starts.
    useEffect(() => { setExpanded(false); }, [run?.runId]);

    // Auto-collapse the expanded view a moment after a successful finish.
    useEffect(() => {
        if (complete && !error) {
            const t = setTimeout(() => setExpanded(false), 4000);
            return () => clearTimeout(t);
        }
    }, [complete, error]);

    const failed = !!error || hasErrorLine(lines);
    const progress = useMemo(() => computeProgress(lines, complete), [lines, complete]);
    const selfTest = run?.kind === 'selftest' ? parseSelfTestResult(lines) : null;

    const lastLine = lines.length ? lines[lines.length - 1] : 'Connecting…';

    if (!run) return null;

    const barColor = failed ? 'bg-red-500' : complete ? 'bg-green-500' : 'bg-primary';
    const statusDot = failed
        ? 'bg-red-500'
        : complete
            ? 'bg-green-500'
            : 'bg-primary animate-pulse';
    const fraction = failed ? Math.max(progress.fraction, 0.08) : progress.fraction;

    return (
        <>
            {/* Re-open pill when dismissed */}
            <AnimatePresence>
                {!visible && (
                    <motion.button
                        key="pill"
                        variants={dockSlide}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        onClick={reopen}
                        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-xs shadow-lg"
                    >
                        <span className={cn('h-2 w-2 rounded-full', statusDot)} />
                        <span className="font-medium">{run.label}</span>
                        <span className="font-mono text-muted-foreground">{Math.round(fraction * 100)}%</span>
                    </motion.button>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {visible && (
                    <motion.div
                        key="dock"
                        variants={dockSlide}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="fixed bottom-4 right-4 z-50 w-[min(92vw,28rem)] overflow-hidden rounded-sm border border-border bg-card shadow-xl"
                    >
                        {/* Header */}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                            <span className={cn('h-2 w-2 shrink-0 rounded-full', statusDot)} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold">{run.label}</p>
                                <p className="truncate font-mono text-[10px] text-muted-foreground">
                                    {failed ? 'Failed' : complete ? 'Completed' : (progress.stageLabel ?? 'Working…')}
                                    {' · '}
                                    {Math.round(fraction * 100)}%
                                </p>
                            </div>
                            <button
                                onClick={() => setExpanded(e => !e)}
                                className="rounded-sm px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground"
                                title={expanded ? 'Collapse' : 'Expand'}
                            >
                                <i className={cn('fa-solid text-xs', expanded ? 'fa-chevron-down' : 'fa-chevron-up')} />
                            </button>
                            <button
                                onClick={complete || failed ? clear : dismiss}
                                className="rounded-sm px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground"
                                title={complete || failed ? 'Close' : 'Hide (keeps running)'}
                            >
                                <i className="fa-solid fa-xmark text-xs" />
                            </button>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1 w-full bg-background/60">
                            <motion.div
                                className={cn('h-full', barColor, !progress.determinate && !complete && 'animate-pulse')}
                                animate={{ width: `${Math.round(fraction * 100)}%` }}
                                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                            />
                        </div>

                        {/* Body */}
                        {expanded ? (
                            <div className="space-y-2 p-3">
                                <LogViewer lines={lines} live={!complete && !failed} heightClass="h-56" />
                                {selfTest && (
                                    <div className="space-y-1 rounded-sm border border-border bg-background/40 p-2">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                            Result — {selfTest.passed}/{selfTest.total} passed
                                        </p>
                                        {selfTest.steps.map((s) => (
                                            <div key={s.step} className="flex items-start gap-2 text-xs">
                                                <i className={cn(
                                                    'fa-solid mt-0.5',
                                                    s.ok ? 'fa-circle-check text-green-500' : 'fa-circle-xmark text-red-500',
                                                )} />
                                                <span className="font-mono">{s.step}</span>
                                                {s.detail && <span className="truncate text-muted-foreground">{s.detail}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="px-3 pb-2.5 pt-2">
                                <p className="truncate font-mono text-[10px] text-muted-foreground">{lastLine}</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

export default StreamDock;
