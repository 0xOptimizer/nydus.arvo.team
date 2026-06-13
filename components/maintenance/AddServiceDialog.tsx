'use client';

import { useState } from 'react';
import { createService, type ServicePayload } from '@/app/actions/services';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

const TYPES = ['pm2', 'systemd', 'nginx', 'static'];

export function AddServiceDialog({ onCreated }: { onCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState<ServicePayload>({
        name: '', service_type: 'pm2',
        pm2_name: '', systemd_unit: '', fqdn: '', health_url: '', deploy_path: '', git_url: '', branch: 'main',
        port: null,
    });

    const set = (k: keyof ServicePayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

    const submit = async () => {
        if (!form.name.trim()) { setError('Name is required.'); return; }
        setBusy(true); setError(null);
        // Trim empty optionals to null so the backend uses its defaults.
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
        const res = await createService(payload);
        setBusy(false);
        if (res.success) {
            setOpen(false);
            setForm({ name: '', service_type: 'pm2', pm2_name: '', systemd_unit: '', fqdn: '', health_url: '', deploy_path: '', git_url: '', branch: 'main', port: null });
            onCreated();
        } else {
            setError(res.error || 'Failed to create service.');
        }
    };

    const field = (label: string, key: keyof ServicePayload, placeholder = '') => (
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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm"><i className="fa-solid fa-plus mr-2" />Add service</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add managed service</DialogTitle>
                    <DialogDescription>Register a process Nydus operates but didn’t deploy.</DialogDescription>
                </DialogHeader>

                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

                <div className="grid grid-cols-2 gap-3 py-2">
                    {field('Name *', 'name', 'arvo.team')}
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Type *</label>
                        <select
                            value={form.service_type}
                            onChange={e => set('service_type', e.target.value)}
                            className="w-full bg-secondary border border-border text-foreground text-xs p-2 focus:border-primary outline-none"
                        >
                            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    {field('pm2 name', 'pm2_name', 'arvo.team')}
                    {field('systemd unit', 'systemd_unit', 'nydus.service')}
                    {field('FQDN', 'fqdn', 'arvo.team')}
                    {field('Health URL', 'health_url', 'https://arvo.team')}
                    {field('Deploy path', 'deploy_path', '/var/www/arvo.team')}
                    {field('Port', 'port', '3000')}
                    {field('Git URL', 'git_url')}
                    {field('Branch', 'branch', 'main')}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
                    <Button onClick={submit} disabled={busy || !form.name.trim()}>
                        {busy ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Adding…</> : 'Add service'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default AddServiceDialog;
