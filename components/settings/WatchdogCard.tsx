'use client';

import { useState, useEffect, useCallback } from 'react';
import { getWatchdog, setWatchdog } from '@/app/actions/watchdog';
import { Switch } from '@/components/ui/switch';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Section } from '@/components/ui/section';
import { StatusChip, type ChipState } from '@/components/StatusChip';

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

    const alertState: ChipState = alertingNow ? 'ok' : alertsEnabled ? 'warn' : 'unknown';
    const alertLabel = alertingNow
        ? 'Alerting active'
        : inGrace
            ? `Alerts begin in ${graceRemaining}s`
            : alertsEnabled
                ? 'Enabled'
                : 'Disabled';

    if (loading && !status) {
        return <CardSkeleton rows={2} />;
    }

    return (
        <Section
            title="Health Watchdog"
            description="Detects failing targets and optionally recovers them."
            icon="fa-solid fa-shield-dog"
            actions={
                status ? (
                    <StatusChip label={alertLabel} state={alertState} pulse={alertingNow} />
                ) : undefined
            }
            footer={
                status ? (
                    <p className="text-[10px] text-muted-foreground">
                        Fail threshold: <span className="font-mono">{status.fail_threshold ?? '—'}</span> ·
                        Grace window: <span className="font-mono">{status.grace_seconds ?? '—'}s</span>
                    </p>
                ) : undefined
            }
        >
            {!status ? (
                <p className="text-sm text-muted-foreground">
                    Watchdog status unavailable (backend unreachable).
                </p>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium">Alerting</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Resets to off on every backend restart, so reboots start quiet. Detection keeps
                                running while alerting is off.
                                {inGrace && (
                                    <span className="text-amber-500"> Startup grace window active.</span>
                                )}
                            </p>
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
                </div>
            )}
        </Section>
    );
}

export default WatchdogCard;
