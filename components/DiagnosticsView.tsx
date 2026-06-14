'use client';

import { StatusBadge } from '@/components/StatusBadge';
import { formatUptime } from '@/lib/format';
import { cn } from '@/lib/utils';

/** A labelled, scrollable log block. Renders nothing if text is empty. */
export function LogBlock({ label, text, className }: { label: string; text?: string | null; className?: string }) {
    if (!text) return null;
    return (
        <div className={className}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
            <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-sm border border-border bg-background/40 p-2 font-mono text-xs text-white">
                {text}
            </pre>
        </div>
    );
}

/** Renders a pm2 process diagnostics object (shared by deployment + service). */
export function ProcessDiagnostics({ process }: { process: any }) {
    if (!process) {
        return <p className="text-sm text-muted-foreground">No process attached (not a node/pm2 target).</p>;
    }
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                {process.status && <span className="flex items-center gap-1.5">status <StatusBadge status={process.status} /></span>}
                {process.exit_code !== undefined && process.exit_code !== null && (
                    <span>exit <span className="font-mono text-foreground">{process.exit_code}</span></span>
                )}
                {process.restarts !== undefined && (
                    <span>restarts <span className="font-mono text-foreground">{process.restarts}</span></span>
                )}
                {process.unstable_restarts !== undefined && (
                    <span>unstable <span className="font-mono text-foreground">{process.unstable_restarts}</span></span>
                )}
                {process.uptime ? <span>uptime <span className="font-mono text-foreground">{formatUptime(process.uptime, { since: true })}</span></span> : null}
                {process.pm2_name && <span className="font-mono text-muted-foreground">{process.pm2_name}</span>}
            </div>
            <LogBlock label="stderr (crash)" text={process.error_log} />
            <LogBlock label="stdout" text={process.output_log} />
            {process.error_log_path && (
                <p className="font-mono text-[10px] text-muted-foreground">{process.error_log_path}</p>
            )}
        </div>
    );
}

/** Renders a service diagnostics object by service_type. */
export function ServiceDiagnostics({ diag }: { diag: any }) {
    if (!diag) return <p className="text-sm text-muted-foreground">No diagnostics available.</p>;
    if (diag.service_type === 'pm2') return <ProcessDiagnostics process={diag.process} />;
    if (diag.service_type === 'systemd') {
        return (
            <div className="space-y-3">
                {diag.unit && <p className="font-mono text-xs text-muted-foreground">unit: {diag.unit}</p>}
                <LogBlock label="systemctl status" text={diag.status} />
                <LogBlock label="journal" text={diag.journal} />
            </div>
        );
    }
    return <LogBlock label="nginx error log" text={diag.nginx_error_log} />;
}

export default ServiceDiagnostics;
