/**
 * Shared formatting helpers. Used across the dashboard for consistent rendering
 * of dates, byte sizes, durations, and percentages.
 */

/** "Jun 13, 2026" */
export function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Jun 13, 02:14 PM" — the compact variant used in tables. */
export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

/** "3m ago", "2h ago", "5d ago", or a date for older entries. */
export function formatRelativeTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const secs = Math.floor((Date.now() - d.getTime()) / 1000);
    if (secs < 0) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(iso);
}

/** Human-readable byte size: "1.4 GB". `null`/undefined → "—". */
export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return '—';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(k)), units.length - 1);
    const value = bytes / Math.pow(k, i);
    return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

/**
 * Uptime from a process start timestamp (ms epoch) or a raw seconds duration.
 * pm2 reports `uptime` as the start time in ms; pass `{ since: true }` for that.
 */
export function formatUptime(value: number | null | undefined, opts: { since?: boolean } = {}): string {
    if (value === null || value === undefined || isNaN(value)) return '—';
    let secs = opts.since ? Math.floor((Date.now() - value) / 1000) : Math.floor(value);
    if (secs < 0) secs = 0;
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ${mins % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
}

/** "42%" from a 0–100 number (or 0–1 when `{ fraction: true }`). */
export function formatPercent(value: number | null | undefined, opts: { fraction?: boolean; decimals?: number } = {}): string {
    if (value === null || value === undefined || isNaN(value)) return '—';
    const pct = opts.fraction ? value * 100 : value;
    return `${pct.toFixed(opts.decimals ?? 0)}%`;
}
