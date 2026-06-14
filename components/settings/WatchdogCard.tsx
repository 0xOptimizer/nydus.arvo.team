'use client';

import { useState, useEffect, useCallback } from 'react';
import { getWatchdog, setWatchdog } from '@/app/actions/watchdog';
import { Switch } from '@/components/ui/switch';
import { CardSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const POLL_MS = 15_000;

/**
 * Watchdog alerting toggle (migration § D). Backend state is in-memory and
 * resets to default-off on restart, so we always read fresh and poll to keep
 * the grace-window countdown live.
 */
export function WatchdogCard() {
    const [status, setStatus] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        const s = await getWatchdog();
        setStatus(s);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
        const id = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
        return () => clearInterval(id);
    }, [load]);

    const patch = async (key: 'alerts_enabled' | 'self_heal_enabled', value: boolean) => {
        setBusy(key);
        const res = await setWatchdog({ [key]: value });
        if (res.success) setStatus(res.status);
        setBusy(null);
    };

    const alertsEnabled = !!status?.alerts_enabled;
    const alertingNow = !!status?.alerting_now;
    const graceRemaining = status?.grace_remaining_seconds ?? 0;

    // enabled but still in the startup grace window
    const inGrace = alertsEnabled && !alertingNow && graceRemaining > 0;

    if (loading && !status) {
        return <CardSkeleton rows={2} />;
    }

    return (
        <div className="rounded-sm border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border p-4">
                <i className="fa-solid fa-shield-dog text-base text-muted-foreground" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Health Watchdog</h3>
            </div>

            {!status ? (
                <p className="p-4 sm:p-6 text-sm text-muted-foreground">Watchdog status unavailable (backend unreachable).</p>
            ) : (
                <div className="space-y-5 p-4 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium">Alerting</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Resets to off on every backend restart, so reboots start quiet. Detection keeps
                                running while alerting is off.
                            </p>
                            <div className="mt-2 flex items-center gap-2 text-xs">
                                <span className={cn('inline-block h-1.5 w-1.5 rounded-full',
                                    alertingNow ? 'bg-green-500' : alertsEnabled ? 'bg-amber-500' : 'bg-muted-foreground/40')} />
                                <span className={cn('font-medium',
                                    alertingNow ? 'text-green-500' : alertsEnabled ? 'text-amber-500' : 'text-muted-foreground')}>
                                    {alertingNow
                                        ? 'Alerting active'
                                        : inGrace
                                            ? `Enabled — alerts begin in ${graceRemaining}s (startup grace)`
                                            : alertsEnabled
                                                ? 'Enabled'
                                                : 'Disabled'}
                                </span>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            {busy === 'alerts_enabled' && (
                                <i className="fa-solid fa-spinner fa-spin text-xs text-muted-foreground" />
                            )}
                            <Switch
                                checked={alertsEnabled}
                                disabled={busy === 'alerts_enabled'}
                                onCheckedChange={(v) => patch('alerts_enabled', v)}
                            />
                        </div>
                    </div>

                    {status.self_heal_enabled !== undefined && (
                        <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
                            <div>
                                <p className="text-sm font-medium">Self-heal</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Automatically recover failed targets when the watchdog detects them down.
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {busy === 'self_heal_enabled' && (
                                    <i className="fa-solid fa-spinner fa-spin text-xs text-muted-foreground" />
                                )}
                                <Switch
                                    checked={!!status.self_heal_enabled}
                                    disabled={busy === 'self_heal_enabled'}
                                    onCheckedChange={(v) => patch('self_heal_enabled', v)}
                                />
                            </div>
                        </div>
                    )}

                    <p className="text-[10px] text-muted-foreground">
                        Fail threshold: <span className="font-mono">{status.fail_threshold ?? '—'}</span> ·
                        Grace window: <span className="font-mono">{status.grace_seconds ?? '—'}s</span>
                    </p>
                </div>
            )}
        </div>
    );
}

export default WatchdogCard;
