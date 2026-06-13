'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type RunKind = 'deploy' | 'rebuild' | 'selftest';

export interface ActiveRun {
    runId: string;
    kind: RunKind;
    /** Human label, e.g. "Deploying myapp.arvo.team". */
    label: string;
    /** Called once when the run completes successfully (e.g. to refresh a list). */
    onDone?: () => void;
}

interface StreamDockState {
    run: ActiveRun | null;
    /** True while the dock toast is visible (can be dismissed without killing the run). */
    visible: boolean;
    /** Start watching a run. Replaces any currently-watched run. */
    startRun: (run: ActiveRun) => void;
    /** Hide the toast but keep the run/stream alive (re-openable via the pill). */
    dismiss: () => void;
    /** Re-show a dismissed run's toast. */
    reopen: () => void;
    /** Fully clear the run (stream is closed by the dock on unmount of the run). */
    clear: () => void;
}

const StreamDockContext = createContext<StreamDockState | null>(null);

export function StreamDockProvider({ children }: { children: ReactNode }) {
    const [run, setRun]         = useState<ActiveRun | null>(null);
    const [visible, setVisible] = useState(false);

    const startRun = useCallback((next: ActiveRun) => {
        setRun(next);
        setVisible(true);
    }, []);

    const dismiss = useCallback(() => setVisible(false), []);
    const reopen  = useCallback(() => setVisible(true), []);
    const clear   = useCallback(() => { setRun(null); setVisible(false); }, []);

    return (
        <StreamDockContext.Provider value={{ run, visible, startRun, dismiss, reopen, clear }}>
            {children}
        </StreamDockContext.Provider>
    );
}

export function useStreamDock(): StreamDockState {
    const ctx = useContext(StreamDockContext);
    if (!ctx) throw new Error('useStreamDock must be used within a StreamDockProvider');
    return ctx;
}
