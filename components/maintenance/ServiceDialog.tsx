'use client';

import { useState } from 'react';
import { createService, updateService, type ServicePayload } from '@/app/actions/services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const TYPES = ['pm2', 'systemd', 'nginx', 'static'];

type Form = ServicePayload & { enabled?: boolean };

function emptyForm(): Form {
    return {
        name: '', service_type: 'pm2',
        pm2_name: '', systemd_unit: '', fqdn: '', health_url: '', deploy_path: '', git_url: '', branch: 'main',
        port: null, enabled: true,
    };
}

function fromService(s: any): Form {
    return {
        name: s.name ?? '',
        service_type: s.service_type ?? 'pm2',
        pm2_name: s.pm2_name ?? '',
        systemd_unit: s.systemd_unit ?? '',
        fqdn: s.fqdn ?? '',
        health_url: s.health_url ?? '',
        deploy_path: s.deploy_path ?? '',
        git_url: s.git_url ?? '',
        branch: s.branch ?? 'main',
        port: s.port ?? null,
        enabled: s.enabled === 1 || s.enabled === true,
    };
}

/**
 * Create (POST) or edit (PUT) a managed service. In edit mode, prompts to fill
 * deploy_path + port for pm2 services so recovery/monitoring work (migration § B).
 */
export function ServiceDialog({
    mode,
    service,
    onSaved,
    trigger,
}: {
    mode: 'create' | 'edit';
    service?: any;
    onSaved: () => void;
    trigger?: React.ReactNode;
}) {
    const isEdit = mode === 'edit';
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<Form>(() => isEdit && service ? fromService(service) : emptyForm());

    const set = (k: keyof Form, v: any) => setForm(prev => ({ ...prev, [k]: v }));

    // Re-seed when (re)opening so edits start from current data.
    const onOpenChange = (next: boolean) => {
        if (next) { setForm(isEdit && service ? fromService(service) : emptyForm()); setError(null); }
        setOpen(next);
    };

    const needsRecoveryFields = form.service_type === 'pm2' && (!form.deploy_path || !form.port);

    const submit = async () => {
        if (!form.name.trim()) { setError('Name is required.'); return; }
        setBusy(true); setError(null);

        const payload: ServicePayload = {
            name: form.name.trim(),
            service_type: form.service_type,
            pm2_name: form.pm2_name || null,
            systemd_unit: form.systemd_unit || null,
            fqdn: form.fqdn || null,
            health_url: form.health_url || null,
            deploy_path: form.deploy_path || null,
            git_url: form.git_url || null,
            branch: form.branch || null,
            port: form.port ? Number(form.port) : null,
        };

        const res = isEdit
            ? await updateService(service.service_uuid, { ...payload, enabled: form.enabled })
            : await createService(payload);

        setBusy(false);
        if (res.success) { setOpen(false); onSaved(); }
        else setError(res.error || `Failed to ${isEdit ? 'update' : 'create'} service.`);
    };

    const field = (label: string, key: keyof Form, placeholder = '') => (
        <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</label>
            <Input
                value={(form[key] as string) ?? ''}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="font-mono text-xs"
            />
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                {trigger ?? <Button size="sm"><i className="fa-solid fa-plus mr-2" />Add service</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEdit ? `Edit ${service?.name}` : 'Add managed service'}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? 'Patch this service. Fill deploy path + port so recovery and monitoring work.'
                            : 'Register a process Nydus operates but didn’t deploy.'}
                    </DialogDescription>
                </DialogHeader>

                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                {isEdit && needsRecoveryFields && (
                    <Alert className="border-amber-500/40 text-amber-500">
                        <AlertDescription className="text-xs">
                            This pm2 service is missing deploy path and/or port — it can’t be recovered after a reboot until both are set.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid grid-cols-2 gap-3 py-2">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Name *</label>
                        <Input
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            placeholder="arvo.team"
                            className="font-mono text-xs"
                            disabled={isEdit}
                        />
                        {isEdit && <p className="mt-1 text-[10px] text-muted-foreground">Name is unique and can’t be changed here.</p>}
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Type *</label>
                        <select
                            value={form.service_type}
                            onChange={e => set('service_type', e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    {field('pm2 name', 'pm2_name', 'arvo.team')}
                    {field('systemd unit', 'systemd_unit', 'nydus.service')}
                    {field('FQDN', 'fqdn', 'arvo.team')}
                    {field('Health URL', 'health_url', 'https://arvo.team')}
                    <div className={cn(needsRecoveryFields && 'rounded-sm ring-1 ring-amber-500/30 p-0.5')}>
                        {field('Deploy path', 'deploy_path', '/var/www/arvo.team')}
                    </div>
                    <div className={cn(needsRecoveryFields && 'rounded-sm ring-1 ring-amber-500/30 p-0.5')}>
                        {field('Port', 'port', '3001')}
                    </div>
                    {field('Git URL', 'git_url')}
                    {field('Branch', 'branch', 'main')}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
                    <Button
                        onClick={submit}
                        disabled={!form.name.trim()}
                        pending={busy}
                        pendingText={isEdit ? 'Saving…' : 'Adding…'}
                    >
                        {isEdit ? 'Save changes' : 'Add service'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Back-compat alias for the create-mode dialog. */
export function AddServiceDialog({ onCreated }: { onCreated: () => void }) {
    return <ServiceDialog mode="create" onSaved={onCreated} />;
}

export default ServiceDialog;
