'use client';

import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * Scrollable terminal-style log pane with auto-scroll-to-bottom. Shared by the
 * deploy/rebuild stream dock, deployment-detail log tabs, and managed-service
 * logs. Extracted from the original DeployTab LogViewer.
 */
export function LogViewer({
    lines,
    live,
    heightClass = 'h-80',
    title,
    className,
}: {
    lines: string[];
    live: boolean;
    heightClass?: string;
    title?: string;
    className?: string;
}) {
    const ref = useRef<HTMLPreElement>(null);

    useEffect(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [lines]);

    return (
        <div className={cn('relative w-full', className)}>
            <div className="absolute top-0 right-0 z-10 flex items-center gap-2 bg-secondary px-2 py-1 text-[9px] font-bold uppercase">
                {live && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />}
                {title ?? (live ? 'Live' : 'Completed')}
            </div>
            <pre
                ref={ref}
                className={cn(
                    'w-full overflow-y-auto whitespace-pre-wrap break-words border border-border bg-background/40 p-4 pt-8 font-mono text-xs text-white',
                    heightClass,
                )}
            >
                {lines.length === 0 ? 'Waiting for output...' : lines.join('\n')}
            </pre>
        </div>
    );
}

export default LogViewer;
