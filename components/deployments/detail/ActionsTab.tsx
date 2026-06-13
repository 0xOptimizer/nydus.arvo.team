'use client';

import { useState, useEffect } from 'react';
import {
    processAction, nginxAction, renewSsl, reconcileDns, getDeploymentConfig,
} from '@/app/actions/deployment-control';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

type ActionFn = () => Promise<{ success: boolean; status?: string; detail?: string; error?: string }>;

function ActionGroup({
    title,
    description,
    actions,
    onRun,
    busyKey,
    disabled,
    disabledNote,
}: {
    title: string;
    description: string;
    actions: { key: string; label: string; fn: ActionFn; confirm?: string; danger?: boolean }[];
    onRun: (key: string, fn: ActionFn, confirmMsg?: string) => void;
    busyKey: string | null;
    disabled?: boolean;
    disabledNote?: string;
}) {
    return (
        <div className="rounded-sm border border-border bg-card p-4">
            <h4 className="text-sm font-medium">{title}</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">{disabled && disabledNote ? disabledNote : description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
                {actions.map(a => (
                    <Button
                        key={a.key}
                        variant="outline"
                        size="sm"
                        disabled={disabled || busyKey === a.key}
                        className={a.danger ? 'text-destructive hover:text-destructive' : ''}
                        onClick={() => onRun(a.key, a.fn, a.confirm)}
                    >
                        {busyKey === a.key ? <i className="fa-solid fa-spinner fa-spin" /> : a.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}

export function ActionsTab({ deploymentUuid, stack }: { deploymentUuid: string; stack?: string }) {
    const isNode = stack === 'node';
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [result, setResult]   = useState<{ ok: boolean; msg: string } | null>(null);
    const [config, setConfig]   = useState<any | null>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            const cfg = await getDeploymentConfig(deploymentUuid);
            if (active) setConfig(cfg);
        })();
        return () => { active = false; };
    }, [deploymentUuid]);

    const run = async (key: string, fn: ActionFn, confirmMsg?: string) => {
        if (confirmMsg && !confirm(confirmMsg)) return;
        setBusyKey(key);
        setResult(null);
        const res = await fn();
        setBusyKey(null);
        if (res.success) setResult({ ok: true, msg: res.detail || res.status || 'Done.' });
        else setResult({ ok: false, msg: res.error || 'Action failed.' });
        setTimeout(() => setResult(null), 6000);
    };

    return (
        <div className="space-y-4">
            {result && (
                <Alert variant={result.ok ? 'default' : 'destructive'}>
                    <AlertDescription>{result.msg}</AlertDescription>
                </Alert>
            )}

            <ActionGroup
                title="Process"
                description={isNode ? 'Control the pm2 process for this app.' : 'Process control is only available for node apps.'}
                disabled={!isNode}
                disabledNote="Process control is only available for node apps."
                busyKey={busyKey}
                onRun={run}
                actions={[
                    { key: 'restart', label: 'Restart', fn: () => processAction(deploymentUuid, 'restart') },
                    { key: 'stop',    label: 'Stop',    fn: () => processAction(deploymentUuid, 'stop'), confirm: 'Stop this process?', danger: true },
                    { key: 'start',   label: 'Start',   fn: () => processAction(deploymentUuid, 'start') },
                    { key: 'reload',  label: 'Reload',  fn: () => processAction(deploymentUuid, 'reload') },
                    { key: 'flush',   label: 'Flush logs', fn: () => processAction(deploymentUuid, 'flush') },
                ]}
            />

            <ActionGroup
                title="Nginx"
                description="Manage the nginx site for this deployment."
                busyKey={busyKey}
                onRun={run}
                actions={[
                    { key: 'nginx-reload',  label: 'Reload',  fn: () => nginxAction(deploymentUuid, 'reload') },
                    { key: 'nginx-test',    label: 'Test config', fn: () => nginxAction(deploymentUuid, 'test') },
                    { key: 'nginx-enable',  label: 'Enable',  fn: () => nginxAction(deploymentUuid, 'enable') },
                    { key: 'nginx-disable', label: 'Disable', fn: () => nginxAction(deploymentUuid, 'disable'), confirm: 'Disable this nginx site?', danger: true },
                ]}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ActionGroup
                    title="SSL"
                    description="Renew the certificate (no-op unless within ~30 days of expiry)."
                    busyKey={busyKey}
                    onRun={run}
                    actions={[{ key: 'ssl', label: 'Renew certificate', fn: () => renewSsl(deploymentUuid) }]}
                />
                <ActionGroup
                    title="DNS"
                    description="Force the Cloudflare A record back to the correct IP + proxied."
                    busyKey={busyKey}
                    onRun={run}
                    actions={[{ key: 'dns', label: 'Reconcile DNS', fn: () => reconcileDns(deploymentUuid) }]}
                />
            </div>

            {config && (config.nginx_config || config.package_scripts) && (
                <div className="rounded-sm border border-border bg-card p-4">
                    <h4 className="text-sm font-medium">Configuration</h4>
                    {config.package_scripts && (
                        <div className="mt-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">package scripts</p>
                            <pre className="mt-1 overflow-x-auto rounded-sm border border-border bg-background/40 p-2 font-mono text-xs">
                                {JSON.stringify(config.package_scripts, null, 2)}
                            </pre>
                        </div>
                    )}
                    {config.nginx_config && (
                        <div className="mt-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">nginx config</p>
                            <pre className="mt-1 max-h-64 overflow-auto rounded-sm border border-border bg-background/40 p-2 font-mono text-xs whitespace-pre">
                                {config.nginx_config}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default ActionsTab;
