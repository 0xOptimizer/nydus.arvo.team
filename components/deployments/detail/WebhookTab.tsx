'use client';

import { useState, useEffect, useCallback } from 'react';
import { getWebhook, createWebhook, deleteWebhook } from '@/app/actions/deployment-control';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
    };
    return (
        <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</label>
            <div className="flex items-center gap-2">
                <code className={cn('flex-1 truncate rounded-sm border border-border bg-background/40 px-2.5 py-1.5 text-xs', mono && 'font-mono')}>
                    {value}
                </code>
                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={copy}>
                    <i className={cn('fa-solid', copied ? 'fa-check text-green-500' : 'fa-copy')} />
                </Button>
            </div>
        </div>
    );
}

export function WebhookTab({ deploymentUuid }: { deploymentUuid: string }) {
    const [webhook, setWebhook] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy]       = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [error, setError]     = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const wh = await getWebhook(deploymentUuid);
        setWebhook(wh);
        setLoading(false);
    }, [deploymentUuid]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        setBusy(true); setError(null);
        const res = await createWebhook(deploymentUuid);
        if (res.success) setWebhook(res.webhook);
        else setError(res.error || 'Failed to create webhook.');
        setBusy(false);
    };

    const handleDelete = async () => {
        if (!confirm('Delete this webhook? Pushes will no longer auto-deploy.')) return;
        setBusy(true); setError(null);
        const res = await deleteWebhook(deploymentUuid);
        if (res.success) setWebhook(null);
        else setError(res.error || 'Failed to delete webhook.');
        setBusy(false);
    };

    if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>;

    if (!webhook) {
        return (
            <div className="space-y-3">
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <EmptyState
                    icon="fa-solid fa-code-branch"
                    title="No webhook configured"
                    hint="Create a webhook so pushes to your branch rebuild this deployment automatically."
                    action={
                        <Button onClick={handleCreate} disabled={busy}>
                            {busy ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Creating…</> : 'Create webhook'}
                        </Button>
                    }
                />
            </div>
        );
    }

    const pathOnly = typeof webhook.url === 'string' && webhook.url.startsWith('/');

    return (
        <div className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <CopyField label="Payload URL" value={webhook.url} />
            {pathOnly && (
                <p className="text-xs text-amber-500">
                    <i className="fa-solid fa-triangle-exclamation mr-1" />
                    This is a path only — prefix it with your public host (the backend’s WEBHOOK_PUBLIC_BASE is unset).
                </p>
            )}

            <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Secret</label>
                <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-sm border border-border bg-background/40 px-2.5 py-1.5 font-mono text-xs">
                        {revealed ? webhook.secret : '•'.repeat(Math.min(40, (webhook.secret || '').length))}
                    </code>
                    <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => setRevealed(r => !r)}>
                        <i className={cn('fa-solid', revealed ? 'fa-eye-slash' : 'fa-eye')} />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                    <span className="text-muted-foreground">Branch</span>
                    <p className="font-mono">{webhook.branch}</p>
                </div>
                <div>
                    <span className="text-muted-foreground">Events</span>
                    <p className="font-mono">{Array.isArray(webhook.events) ? webhook.events.join(', ') : 'push'}</p>
                </div>
            </div>

            <button onClick={() => setShowHelp(h => !h)} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                <i className={cn('fa-solid mr-1.5 text-[10px]', showHelp ? 'fa-chevron-down' : 'fa-chevron-right')} />
                GitHub setup instructions
            </button>
            {showHelp && (
                <ol className="space-y-1.5 rounded-sm border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                    <li>1. In your GitHub repo, go to <span className="text-foreground">Settings → Webhooks → Add webhook</span>.</li>
                    <li>2. Paste the <span className="text-foreground">Payload URL</span> above.</li>
                    <li>3. Content type: <span className="font-mono text-foreground">application/json</span>.</li>
                    <li>4. Paste the <span className="text-foreground">Secret</span> above.</li>
                    <li>5. Choose <span className="text-foreground">Just the push event</span>, then Add webhook.</li>
                </ol>
            )}

            <div className="pt-1">
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={busy}>
                    {busy ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-trash mr-2" />Delete webhook</>}
                </Button>
            </div>
        </div>
    );
}

export default WebhookTab;
