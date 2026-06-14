'use client';

import { useState, useEffect } from 'react';
import { getEnvLines, updateEnvLine, addEnvLine, deleteEnvLine } from '@/app/actions/deployments';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Field, FormGrid } from '@/components/ui/field';
import { EmptyState } from '@/components/EmptyState';

const ENV_KEY_RE = /^[A-Z_][A-Z0-9_]*$/;

function validateEnvKey(k: string): string {
    if (!k) return 'Key is required.';
    if (!ENV_KEY_RE.test(k)) return 'Uppercase letters, numbers, and underscores only. Must start with a letter or underscore.';
    return '';
}

/**
 * Reusable environment-variable editor for a deployment. Extracted from the
 * original DeployTab env dialog so it can live on the deployment detail page.
 */
export function EnvEditor({ deploymentUuid }: { deploymentUuid: string }) {
    const [envLines, setEnvLines]     = useState<{ key: string; value: string }[]>([]);
    const [loading, setLoading]       = useState(true);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [newKey, setNewKey]         = useState('');
    const [newValue, setNewValue]     = useState('');
    const [newKeyErr, setNewKeyErr]   = useState('');
    const [busy, setBusy]             = useState<string | null>(null);
    const [error, setError]           = useState<string | null>(null);
    const [successMsg, setSuccess]    = useState<string | null>(null);

    const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };
    const err   = (msg: string) => { setError(msg);   setTimeout(() => setError(null),   6000); };

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            const lines = await getEnvLines(deploymentUuid);
            if (active) { setEnvLines(Array.isArray(lines) ? lines : []); setLoading(false); }
        })();
        return () => { active = false; };
    }, [deploymentUuid]);

    const handleSave = async (key: string) => {
        setBusy(key);
        const res = await updateEnvLine(deploymentUuid, key, editingValue);
        if (res.success) {
            setEnvLines(prev => prev.map(l => l.key === key ? { ...l, value: editingValue } : l));
            setEditingKey(null);
            flash(`"${key}" updated.`);
        } else err(res.error || 'Failed to update.');
        setBusy(null);
    };

    const handleDelete = async (key: string) => {
        if (!confirm(`Delete "${key}"?`)) return;
        setBusy(key);
        const res = await deleteEnvLine(deploymentUuid, key);
        if (res.success) {
            setEnvLines(prev => prev.filter(l => l.key !== key));
            flash(`"${key}" deleted.`);
        } else err(res.error || 'Failed to delete.');
        setBusy(null);
    };

    const handleAdd = async () => {
        const keyErr = validateEnvKey(newKey);
        if (keyErr) { setNewKeyErr(keyErr); return; }
        setBusy('__new__');
        const res = await addEnvLine(deploymentUuid, newKey, newValue);
        if (res.success) {
            setEnvLines(prev => [...prev, { key: newKey, value: newValue }]);
            setNewKey(''); setNewValue(''); setNewKeyErr('');
            flash(`"${newKey}" added.`);
        } else err(res.error || 'Failed to add.');
        setBusy(null);
    };

    const columns: Column<{ key: string; value: string }>[] = [
        {
            key: 'key',
            header: 'Key',
            className: 'w-52',
            render: ({ key }) => <span className="font-mono text-xs text-foreground">{key}</span>,
        },
        {
            key: 'value',
            header: 'Value',
            render: ({ key, value }) =>
                editingKey === key ? (
                    <Input
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        className="h-7 font-mono text-xs"
                        disabled={busy === key}
                        autoFocus
                    />
                ) : (
                    <span className="font-mono text-xs text-muted-foreground break-all">
                        {value || <span className="italic opacity-40">empty</span>}
                    </span>
                ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: ({ key, value }) => (
                <div className="flex justify-end gap-1">
                    {editingKey === key ? (
                        <>
                            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handleSave(key)} pending={busy === key}>
                                <i className="fa-solid fa-check" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingKey(null)} disabled={busy === key}>
                                <i className="fa-solid fa-xmark" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => { setEditingKey(key); setEditingValue(value); }} disabled={!!busy}>
                                <i className="fa-solid fa-pen" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(key)} disabled={!!busy && busy !== key} pending={busy === key}>
                                <i className="fa-solid fa-trash" />
                            </Button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            {successMsg && <Alert><AlertDescription>{successMsg}</AlertDescription></Alert>}

            <div className="overflow-hidden rounded-sm border border-border">
                <DataTable
                    columns={columns}
                    rows={envLines}
                    getRowId={(l) => l.key}
                    loading={loading}
                    empty={
                        <EmptyState
                            icon="fa-solid fa-file-code"
                            title="No environment variables"
                            hint="Add a variable below to populate this deployment's env file."
                        />
                    }
                />
            </div>

            <div className="rounded-sm border border-border p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add variable</p>
                <FormGrid cols={2} className="mt-3 items-start">
                    <Field label="Key" error={newKeyErr || undefined}>
                        <Input
                            value={newKey}
                            onChange={e => { setNewKey(e.target.value.toUpperCase().trim()); setNewKeyErr(''); }}
                            placeholder="KEY_NAME"
                            className="font-mono text-xs"
                            disabled={busy === '__new__'}
                        />
                    </Field>
                    <Field label="Value">
                        <Input
                            value={newValue}
                            onChange={e => setNewValue(e.target.value)}
                            placeholder="value"
                            className="font-mono text-xs"
                            disabled={busy === '__new__'}
                        />
                    </Field>
                </FormGrid>
                <div className="mt-3 flex justify-end">
                    <Button size="sm" onClick={handleAdd} disabled={!newKey} pending={busy === '__new__'} pendingText="Adding…">
                        <i className="fa-solid fa-plus" /> Add variable
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default EnvEditor;
