'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDeploymentContext } from '@/app/deployments/context/DeploymentContext';
import {
    triggerDeploy, triggerRebuild,
    getEnvLines, updateEnvLine, addEnvLine, deleteEnvLine,
} from '@/app/actions/deployments';
import { Input }                  from '@/components/ui/input';
import { Badge }                  from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button }                 from '@/components/ui/button';
import { Separator }              from '@/components/ui/separator';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const ENV_KEY_RE   = /^[A-Z_][A-Z0-9_]*$/;
const MAX_LOG_LINES = 500;

function validateSubdomain(s: string): string {
    if (!s) return 'Subdomain is required.';
    if (s.length > 24) return `Max 24 characters. Got ${s.length}.`;
    if (!SUBDOMAIN_RE.test(s)) return 'Lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.';
    return '';
}

function validateEnvKey(k: string): string {
    if (!k) return 'Key is required.';
    if (!ENV_KEY_RE.test(k)) return 'Uppercase letters, numbers, and underscores only. Must start with a letter or underscore.';
    return '';
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        active:  'bg-green-500/10 text-green-500 border-green-500/30',
        failed:  'bg-red-500/10 text-red-500 border-red-500/30',
        pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium border ${styles[status] ?? 'bg-muted text-muted-foreground border-border'}`}>
            {status}
        </span>
    );
}

function LogViewer({ logs, complete }: { logs: string[]; complete: boolean }) {
    const ref = useRef<HTMLPreElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [logs]);

    return (
        <div className="relative w-full">
            <div className="absolute top-0 right-0 bg-secondary px-2 py-1 text-[9px] font-bold uppercase z-10 flex items-center gap-2">
                {!complete && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                )}
                {complete ? 'Completed' : 'Live'}
            </div>
            <pre
                ref={ref}
                className="bg-background/40 text-white w-full h-80 p-4 pt-8 text-xs overflow-y-auto whitespace-pre-wrap break-words border border-border font-mono"
            >
                {logs.length === 0 ? 'Waiting for output...' : logs.join('\n')}
            </pre>
        </div>
    );
}

function useLogStream(runUuid: string | null, onDone?: () => void) {
    const [logs, setLogs]         = useState<string[]>([]);
    const [complete, setComplete] = useState(false);
    const esRef                   = useRef<EventSource | null>(null);

    useEffect(() => {
        if (!runUuid) return;

        setLogs([]);
        setComplete(false);

        const es = new EventSource(`/api/deploy/logs/${runUuid}`);
        esRef.current = es;

        console.log('[useLogStream] Connecting to:', `/api/deploy/logs/${runUuid}`);

        es.onopen = () => {
            console.log('[useLogStream] EventSource connected');
            setLogs(prev => [...prev, '[INFO] Connected to log stream...']);
        };

        es.onmessage = (event) => {
            console.log('[useLogStream] Message received:', event.data.substring(0, 100));
            if (event.data === '[done]') {
                console.log('[useLogStream] Deploy completed');
                es.close();
                esRef.current = null;
                setComplete(true);
                onDone?.();
                return;
            }
            if (event.data === '[keepalive]') return;
            try {
                const parsed = JSON.parse(event.data);
                if (parsed.line) {
                    setLogs(prev => {
                        const next = [...prev, parsed.line as string];
                        return next.length > MAX_LOG_LINES
                            ? next.slice(next.length - MAX_LOG_LINES)
                            : next;
                    });
                }
            } catch (parseErr) {
                console.warn('[useLogStream] Parse error:', parseErr, 'Data:', event.data);
            }
        };

        es.onerror = (err) => {
            console.error('[useLogStream] EventSource error:', err);
            es.close();
            esRef.current = null;
            setLogs(prev => [...prev, '[ERROR] Connection to log stream lost. Check browser console for details.']);
            setComplete(true);
        };

        return () => {
            console.log('[useLogStream] Cleaning up EventSource');
            es.close();
            esRef.current = null;
        };
    }, [runUuid]);

    const close = useCallback(() => {
        esRef.current?.close();
        esRef.current = null;
    }, []);

    return { logs, complete, close };
}

export default function DeployTab() {
    const { deployments, projects, actorId, loading, refresh } = useDeploymentContext();

    const [formCollapsed, setFormCollapsed] = useState(true);
    const [error, setError]                 = useState<string | null>(null);
    const [successMsg, setSuccess]          = useState<string | null>(null);
    const [busyKey, setBusyKey]             = useState<string | null>(null);

    const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };
    const err   = (msg: string) => { setError(msg);   setTimeout(() => setError(null),   6000); };

    const formatDate = (iso: string | null) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    };

    // --- Deploy dialog ---
    const [deployProject, setDeployProject] = useState<any | null>(null);
    const [subdomain, setSubdomain]         = useState('');
    const [subdomainErr, setSubdomainErr]   = useState('');
    const [deploying, setDeploying]         = useState(false);
    const [deployRunUuid, setDeployRunUuid] = useState<string | null>(null);
    const [deployError, setDeployError]     = useState<string | null>(null);

    const {
        logs:     deployLogs,
        complete: deployComplete,
        close:    closeDeployStream,
    } = useLogStream(deployRunUuid, () => refresh());

    const openDeployDialog = (project: any) => {
        setDeployProject(project);
        setSubdomain('');
        setSubdomainErr('');
        setDeployRunUuid(null);
        setDeploying(false);
        setDeployError(null);
    };

    const closeDeployDialog = () => {
        closeDeployStream();
        setDeployProject(null);
        setDeployRunUuid(null);
        setDeploying(false);
        setDeployError(null);
    };

    const handleDeploy = async () => {
        const e = validateSubdomain(subdomain);
        if (e) { setSubdomainErr(e); return; }

        console.log('[DeployTab] Starting deploy for:', subdomain);
        setDeploying(true);
        setDeployError(null);
        const res = await triggerDeploy(deployProject.project_uuid, subdomain, actorId);

        console.log('[DeployTab] Deploy response:', res);

        if (!res.success) {
            console.error('[DeployTab] Deploy failed:', res.error);
            setDeploying(false);
            const errorMsg = res.error || 'Deploy failed.';
            setDeployError(errorMsg);
            err(errorMsg);
            return;
        }

        console.log('[DeployTab] Setting deployRunUuid to:', res.run_uuid);
        setDeployRunUuid(res.run_uuid ?? null);
    };

    // --- Rebuild dialog ---
    const [rebuildTarget, setRebuildTarget]   = useState<any | null>(null);
    const [rebuildRunUuid, setRebuildRunUuid] = useState<string | null>(null);

    const {
        logs:     rebuildLogs,
        complete: rebuildComplete,
        close:    closeRebuildStream,
    } = useLogStream(rebuildRunUuid);

    const openRebuildDialog = (deployment: any) => {
        setRebuildTarget(deployment);
        setRebuildRunUuid(null);
    };

    const closeRebuildDialog = () => {
        closeRebuildStream();
        setRebuildTarget(null);
        setRebuildRunUuid(null);
    };

    const handleRebuild = async () => {
        if (!rebuildTarget) return;
        setBusyKey(`rebuild-${rebuildTarget.deployment_uuid}`);

        const res = await triggerRebuild(rebuildTarget.deployment_uuid, actorId);
        setBusyKey(null);

        if (!res.success) {
            err(res.error || 'Rebuild failed.');
            setRebuildTarget(null);
            return;
        }

        setRebuildRunUuid(res.run_uuid ?? null);
    };

    // --- Env dialog ---
    const [envDeployment, setEnvDeployment] = useState<any | null>(null);
    const [envLines, setEnvLines]           = useState<{ key: string; value: string }[]>([]);
    const [envLoading, setEnvLoading]       = useState(false);
    const [editingKey, setEditingKey]       = useState<string | null>(null);
    const [editingValue, setEditingValue]   = useState('');
    const [newKey, setNewKey]               = useState('');
    const [newValue, setNewValue]           = useState('');
    const [newKeyErr, setNewKeyErr]         = useState('');
    const [envBusy, setEnvBusy]             = useState<string | null>(null);

    const openEnvDialog = async (deployment: any) => {
        setEnvDeployment(deployment);
        setEnvLines([]);
        setEnvLoading(true);
        setEditingKey(null);
        setNewKey('');
        setNewValue('');
        setNewKeyErr('');

        const lines = await getEnvLines(deployment.deployment_uuid);
        setEnvLines(Array.isArray(lines) ? lines : []);
        setEnvLoading(false);
    };

    const closeEnvDialog = () => {
        setEnvDeployment(null);
        setEnvLines([]);
        setEditingKey(null);
    };

    const handleEnvEdit = (key: string, value: string) => {
        setEditingKey(key);
        setEditingValue(value);
    };

    const handleEnvSave = async (key: string) => {
        if (!envDeployment) return;
        setEnvBusy(key);
        const res = await updateEnvLine(envDeployment.deployment_uuid, key, editingValue);
        if (res.success) {
            setEnvLines(prev => prev.map(l => l.key === key ? { ...l, value: editingValue } : l));
            setEditingKey(null);
            flash(`"${key}" updated.`);
        } else {
            err(res.error || 'Failed to update.');
        }
        setEnvBusy(null);
    };

    const handleEnvDelete = async (key: string) => {
        if (!envDeployment || !confirm(`Delete "${key}"?`)) return;
        setEnvBusy(key);
        const res = await deleteEnvLine(envDeployment.deployment_uuid, key);
        if (res.success) {
            setEnvLines(prev => prev.filter(l => l.key !== key));
            flash(`"${key}" deleted.`);
        } else {
            err(res.error || 'Failed to delete.');
        }
        setEnvBusy(null);
    };

    const handleEnvAdd = async () => {
        const keyErr = validateEnvKey(newKey);
        if (keyErr) { setNewKeyErr(keyErr); return; }
        if (!envDeployment) return;

        setEnvBusy('__new__');
        const res = await addEnvLine(envDeployment.deployment_uuid, newKey, newValue);
        if (res.success) {
            setEnvLines(prev => [...prev, { key: newKey, value: newValue }]);
            setNewKey('');
            setNewValue('');
            setNewKeyErr('');
            flash(`"${newKey}" added.`);
        } else {
            err(res.error || 'Failed to add.');
        }
        setEnvBusy(null);
    };

    return (
        <TooltipProvider>
        <div className="space-y-4">

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {successMsg && (
                <Alert>
                    <AlertDescription>{successMsg}</AlertDescription>
                </Alert>
            )}

            <div className="flex flex-col lg:flex-row gap-4">

                {/* Left column */}
                <div className="flex-1 space-y-4">

                    {/* Deploy new project card */}
                    <div className="border border-border rounded-sm bg-card">
                        <div
                            className="p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                            onClick={() => setFormCollapsed(!formCollapsed)}
                        >
                            <h3 className="text-sm font-medium">
                                Deploy a Project
                                {formCollapsed
                                    ? <i className="fa-solid fa-chevron-right ml-2 text-xs text-muted-foreground inline" />
                                    : <i className="fa-solid fa-chevron-down ml-2 text-xs text-muted-foreground inline" />
                                }
                            </h3>
                        </div>

                        {!formCollapsed && (
                            <>
                                <Separator />
                                {loading ? (
                                    <div className="p-8 text-center text-sm text-muted-foreground">
                                        Loading projects...
                                    </div>
                                ) : projects.length === 0 ? (
                                    <div className="p-8 text-center text-sm text-muted-foreground">
                                        No attached projects found.
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Project</TableHead>
                                                <TableHead>Owner</TableHead>
                                                <TableHead>Branch</TableHead>
                                                <TableHead className="text-right pr-4">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {projects.map((p: any) => (
                                                <TableRow key={p.project_uuid}>
                                                    <TableCell className="font-mono text-sm py-2.5">
                                                        {p.name}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground py-2.5">
                                                        {p.owner_login}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground py-2.5">
                                                        {p.default_branch}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-4 py-2.5">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openDeployDialog(p)}
                                                        >
                                                            Deploy
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </>
                        )}
                    </div>

                    {/* Deployments table */}
                    <div className="border border-border rounded-sm bg-card">
                        <div className="p-4 pb-0">
                            <p className="text-sm font-medium">Deployments</p>
                        </div>

                        {loading && deployments.length === 0 ? (
                            <div className="p-8 text-center text-sm text-muted-foreground">
                                Loading...
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Subdomain</TableHead>
                                        <TableHead>Stack</TableHead>
                                        <TableHead>Port</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Deployed</TableHead>
                                        <TableHead className="text-right pr-4">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {deployments.map((d: any) => (
                                        <TableRow key={d.deployment_uuid}>
                                            <TableCell className="py-2.5">
                                                <a
                                                    href={`https://${d.subdomain}.arvo.team`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-mono text-sm hover:underline inline-flex items-center gap-1.5"
                                                >
                                                    {d.subdomain}.arvo.team
                                                    <i className="fa-solid fa-arrow-up-right-from-square text-xs text-muted-foreground" />
                                                </a>
                                            </TableCell>
                                            <TableCell className="py-2.5">
                                                <Badge variant="secondary" className="font-normal text-xs uppercase">
                                                    {d.tech_stack}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground py-2.5">
                                                {d.assigned_port ?? '—'}
                                            </TableCell>
                                            <TableCell className="py-2.5">
                                                <StatusBadge status={d.status} />
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground py-2.5 whitespace-nowrap">
                                                {formatDate(d.deployed_at)}
                                            </TableCell>
                                            <TableCell className="text-right pr-4 py-2.5">
                                                <div className="flex justify-end gap-1">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0"
                                                                    onClick={() => openEnvDialog(d)}
                                                                >
                                                                    <i className="fa-solid fa-file-code" />
                                                                </Button>
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">
                                                            Environment variables
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0"
                                                                    onClick={() => openRebuildDialog(d)}
                                                                    disabled={
                                                                        d.status === 'pending' ||
                                                                        busyKey === `rebuild-${d.deployment_uuid}`
                                                                    }
                                                                >
                                                                    {busyKey === `rebuild-${d.deployment_uuid}`
                                                                        ? <i className="fa-solid fa-spinner fa-spin" />
                                                                        : <i className="fa-solid fa-rotate" />
                                                                    }
                                                                </Button>
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">Rebuild</TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {deployments.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={6}
                                                className="px-6 py-10 text-center text-sm text-muted-foreground"
                                            >
                                                No deployments yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>

                {/* Right column */}
                <div className="w-full lg:w-80 space-y-4">
                    <div className="border border-border rounded-sm bg-card">
                        <div className="p-4">
                            <h3 className="text-sm font-medium">Summary</h3>
                        </div>
                        <Separator />
                        <div className="p-4 space-y-3">
                            {[
                                { label: 'Total',   value: deployments.length,                                    color: '' },
                                { label: 'Active',  value: deployments.filter(d => d.status === 'active').length,  color: 'text-green-500' },
                                { label: 'Failed',  value: deployments.filter(d => d.status === 'failed').length,  color: 'text-red-500' },
                                { label: 'Pending', value: deployments.filter(d => d.status === 'pending').length, color: 'text-yellow-500' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">{label}</span>
                                    <span className={`text-sm font-mono font-medium tabular-nums ${color}`}>
                                        {value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Deploy dialog */}
            <Dialog
                open={!!deployProject}
                onOpenChange={open => { if (!open) closeDeployDialog(); }}
            >
                <DialogContent className="sm:max-w-lg shadow-none">
                    <DialogHeader>
                        <DialogTitle>
                            {deployRunUuid
                                ? `Deploying — ${deployProject?.name}`
                                : `Deploy ${deployProject?.name}`
                            }
                        </DialogTitle>
                        {!deployRunUuid && (
                            <DialogDescription>
                                Assign a subdomain. Your project will be available at{' '}
                                <span className="font-mono">yoursubdomain.arvo.team</span>.
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {!deployRunUuid ? (
                        <div className="space-y-4 py-2">
                            {deployError && (
                                <Alert variant="destructive">
                                    <AlertDescription>{deployError}</AlertDescription>
                                </Alert>
                            )}
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1.5">
                                    Subdomain{' '}
                                    <span className="text-muted-foreground">(max 24 chars, lowercase)</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={subdomain}
                                        onChange={e => {
                                            setSubdomain(e.target.value.toLowerCase().trim());
                                            setSubdomainErr('');
                                        }}
                                        placeholder="my-project"
                                        className="font-mono"
                                        disabled={deploying}
                                    />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                                        .arvo.team
                                    </span>
                                </div>
                                {subdomainErr && (
                                    <p className="text-xs text-destructive mt-1">{subdomainErr}</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="py-2 space-y-2">
                            <LogViewer logs={deployLogs} complete={deployComplete} />
                            {deployComplete && (
                                <p className="text-xs text-muted-foreground text-center">
                                    Deployment finished. You may close this window.
                                </p>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        {!deployRunUuid ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={closeDeployDialog}
                                    disabled={deploying}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleDeploy}
                                    disabled={deploying || !subdomain}
                                >
                                    {deploying
                                        ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Starting...</>
                                        : 'Start Deployment'
                                    }
                                </Button>
                            </>
                        ) : (
                            <Button variant="outline" onClick={closeDeployDialog}>
                                {deployComplete ? 'Close' : 'Close (running in background)'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rebuild dialog */}
            <Dialog
                open={!!rebuildTarget}
                onOpenChange={open => { if (!open) closeRebuildDialog(); }}
            >
                <DialogContent className="sm:max-w-lg shadow-none">
                    <DialogHeader>
                        <DialogTitle>
                            Rebuild — {rebuildTarget?.subdomain}
                        </DialogTitle>
                        {!rebuildRunUuid && (
                            <DialogDescription>
                                Re-runs install and build steps for{' '}
                                <span className="font-mono">{rebuildTarget?.subdomain}.arvo.team</span>.
                                This does not affect your nginx or SSL configuration.
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {rebuildRunUuid ? (
                        <div className="py-2 space-y-2">
                            <LogViewer logs={rebuildLogs} complete={rebuildComplete} />
                            {rebuildComplete && (
                                <p className="text-xs text-muted-foreground text-center">
                                    Rebuild finished. You may close this window.
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground py-2">
                            The rebuild will re-install dependencies and run the build command for this deployment.
                        </p>
                    )}

                    <DialogFooter>
                        {!rebuildRunUuid ? (
                            <>
                                <Button variant="outline" onClick={closeRebuildDialog}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleRebuild}
                                    disabled={busyKey === `rebuild-${rebuildTarget?.deployment_uuid}`}
                                >
                                    {busyKey === `rebuild-${rebuildTarget?.deployment_uuid}`
                                        ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Queuing...</>
                                        : 'Rebuild'
                                    }
                                </Button>
                            </>
                        ) : (
                            <Button variant="outline" onClick={closeRebuildDialog}>
                                {rebuildComplete ? 'Close' : 'Close (running in background)'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Env dialog */}
            <Dialog
                open={!!envDeployment}
                onOpenChange={open => { if (!open) closeEnvDialog(); }}
            >
                <DialogContent className="sm:max-w-2xl shadow-none">
                    <DialogHeader>
                        <DialogTitle>Environment Variables</DialogTitle>
                        <DialogDescription>
                            <span className="font-mono">{envDeployment?.subdomain}.arvo.team</span>
                            {' · '}
                            <span className="font-mono text-xs">{envDeployment?.env_file_name}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2">
                        {envLoading ? (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                Loading...
                            </div>
                        ) : (
                            <>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-52">Key</TableHead>
                                            <TableHead>Value</TableHead>
                                            <TableHead className="w-20 text-right pr-2">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {envLines.map(({ key, value }) => (
                                            <TableRow key={key}>
                                                <TableCell className="font-mono text-xs py-2 align-middle">
                                                    {key}
                                                </TableCell>
                                                <TableCell className="py-2 align-middle">
                                                    {editingKey === key ? (
                                                        <Input
                                                            value={editingValue}
                                                            onChange={e => setEditingValue(e.target.value)}
                                                            className="font-mono text-xs h-7"
                                                            disabled={envBusy === key}
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span className="font-mono text-xs text-muted-foreground break-all">
                                                            {value || (
                                                                <span className="italic opacity-40">empty</span>
                                                            )}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="py-2 text-right pr-2 align-middle">
                                                    <div className="flex justify-end gap-1">
                                                        {editingKey === key ? (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() => handleEnvSave(key)}
                                                                    disabled={envBusy === key}
                                                                >
                                                                    {envBusy === key
                                                                        ? <i className="fa-solid fa-spinner fa-spin" />
                                                                        : <i className="fa-solid fa-check" />
                                                                    }
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() => setEditingKey(null)}
                                                                    disabled={envBusy === key}
                                                                >
                                                                    <i className="fa-solid fa-xmark" />
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0"
                                                                    onClick={() => handleEnvEdit(key, value)}
                                                                    disabled={!!envBusy}
                                                                >
                                                                    <i className="fa-solid fa-pen" />
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                                                    onClick={() => handleEnvDelete(key)}
                                                                    disabled={!!envBusy}
                                                                >
                                                                    {envBusy === key
                                                                        ? <i className="fa-solid fa-spinner fa-spin" />
                                                                        : <i className="fa-solid fa-trash" />
                                                                    }
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {envLines.length === 0 && (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={3}
                                                    className="py-8 text-center text-xs text-muted-foreground"
                                                >
                                                    No environment variables found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>

                                <Separator className="my-3" />

                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground font-medium">
                                        Add Variable
                                    </p>
                                    <div className="flex gap-2 items-start">
                                        <div className="w-52 shrink-0 space-y-1">
                                            <Input
                                                value={newKey}
                                                onChange={e => {
                                                    setNewKey(e.target.value.toUpperCase().trim());
                                                    setNewKeyErr('');
                                                }}
                                                placeholder="KEY_NAME"
                                                className="font-mono text-xs"
                                                disabled={envBusy === '__new__'}
                                            />
                                            {newKeyErr && (
                                                <p className="text-xs text-destructive">{newKeyErr}</p>
                                            )}
                                        </div>
                                        <Input
                                            value={newValue}
                                            onChange={e => setNewValue(e.target.value)}
                                            placeholder="value"
                                            className="font-mono text-xs flex-1"
                                            disabled={envBusy === '__new__'}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleEnvAdd}
                                            disabled={!newKey || envBusy === '__new__'}
                                            className="shrink-0"
                                        >
                                            {envBusy === '__new__'
                                                ? <i className="fa-solid fa-spinner fa-spin" />
                                                : 'Add'
                                            }
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeEnvDialog}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
        </TooltipProvider>
    );
}