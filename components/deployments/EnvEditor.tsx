'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getEnvLines, updateEnvLine, addEnvLine, deleteEnvLine } from '@/app/actions/deployments';
import { staggerContainer, listItem } from '@/lib/motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TableRowsSkeleton } from '@/components/ui/skeleton';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

    if (loading && envLines.length === 0) {
        return <TableRowsSkeleton rows={5} cols={3} />;
    }

    return (
        <div className="space-y-3">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            {successMsg && <Alert><AlertDescription>{successMsg}</AlertDescription></Alert>}

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-52">Key</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead className="w-20 text-right pr-2">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <motion.tbody
                    className="[&_tr:last-child]:border-0"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                >
                  <AnimatePresence initial={false}>
                    {envLines.map(({ key, value }) => (
                        <motion.tr
                            key={key}
                            layout
                            variants={listItem}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                        >
                            <TableCell className="font-mono text-xs py-2 align-middle">{key}</TableCell>
                            <TableCell className="py-2 align-middle">
                                {editingKey === key ? (
                                    <Input
                                        value={editingValue}
                                        onChange={e => setEditingValue(e.target.value)}
                                        className="font-mono text-xs h-7"
                                        disabled={busy === key}
                                        autoFocus
                                    />
                                ) : (
                                    <span className="font-mono text-xs text-muted-foreground break-all">
                                        {value || <span className="italic opacity-40">empty</span>}
                                    </span>
                                )}
                            </TableCell>
                            <TableCell className="py-2 text-right pr-2 align-middle">
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
                            </TableCell>
                        </motion.tr>
                    ))}
                    {envLines.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={3} className="py-8 text-center text-xs text-muted-foreground">
                                No environment variables found.
                            </TableCell>
                        </TableRow>
                    )}
                  </AnimatePresence>
                </motion.tbody>
            </Table>

            <Separator className="my-3" />

            <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Add Variable</p>
                <div className="flex gap-2 items-start">
                    <div className="w-52 shrink-0 space-y-1">
                        <Input
                            value={newKey}
                            onChange={e => { setNewKey(e.target.value.toUpperCase().trim()); setNewKeyErr(''); }}
                            placeholder="KEY_NAME"
                            className="font-mono text-xs"
                            disabled={busy === '__new__'}
                        />
                        {newKeyErr && <p className="text-xs text-destructive">{newKeyErr}</p>}
                    </div>
                    <Input
                        value={newValue}
                        onChange={e => setNewValue(e.target.value)}
                        placeholder="value"
                        className="font-mono text-xs flex-1"
                        disabled={busy === '__new__'}
                    />
                    <Button variant="outline" size="sm" onClick={handleAdd} disabled={!newKey} pending={busy === '__new__'} className="shrink-0">
                        Add
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default EnvEditor;
