'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDeploymentContext } from '@/app/deployments/context/DeploymentContext';
import { useStreamDock } from '@/context/StreamDockContext';
import {
    triggerDeploy, triggerRebuild,
    getEnvLines, updateEnvLine, addEnvLine, deleteEnvLine,
} from '@/app/actions/deployments';
import { motion, AnimatePresence } from 'motion/react';
import { AnimatedStatusBadge } from '@/components/AnimatedStatusBadge';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { DeployInstructions } from '@/components/deployments/DeployInstructions';
import { formatDateTime } from '@/lib/format';
import { deploymentFqdn, dnsModeLabel } from '@/lib/deployments';
import { staggerContainer, staggerItem, listItem } from '@/lib/motion';
import { Input }                  from '@/components/ui/input';
import { Badge }                  from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button }                 from '@/components/ui/button';
import { SegmentedControl }       from '@/components/ui/segmented';
import { Separator }              from '@/components/ui/separator';
import { TableRowsSkeleton }      from '@/components/ui/skeleton';
import { EmptyState }             from '@/components/EmptyState';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const ENV_KEY_RE   = /^[A-Z_][A-Z0-9_]*$/;
const DOMAIN_RE    = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

function validateSubdomain(s: string): string {
    if (!s) return 'Subdomain is required.';
    if (s.length > 24) return `Max 24 characters. Got ${s.length}.`;
    if (!SUBDOMAIN_RE.test(s)) return 'Lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.';
    return '';
}

function validateDomain(d: string): string {
    if (!d) return 'Domain is required.';
    if (!DOMAIN_RE.test(d)) return 'Enter a valid hostname, e.g. shop.client.com.';
    if (/\.?arvo\.team$/i.test(d)) return 'Domains under arvo.team must use subdomain mode.';
    return '';
}

type DnsMode = 'subdomain' | 'cloudflare' | 'external';

const DNS_MODE_OPTIONS: { value: DnsMode; label: string; hint: string }[] = [
    { value: 'subdomain',  label: 'Subdomain',  hint: 'Hosted at <name>.arvo.team. DNS + SSL fully automated.' },
    { value: 'cloudflare', label: 'Cloudflare', hint: 'Custom domain in your Cloudflare zone (same account). Automated.' },
    { value: 'external',   label: 'External',   hint: 'Custom domain whose DNS you run elsewhere. Point an A record at the server first.' },
];

function validateEnvKey(k: string): string {
    if (!k) return 'Key is required.';
    if (!ENV_KEY_RE.test(k)) return 'Uppercase letters, numbers, and underscores only. Must start with a letter or underscore.';
    return '';
}

export default function DeployTab() {
    const { deployments, projects, actorId, loading, refresh } = useDeploymentContext();
    const { startRun } = useStreamDock();

    const [formCollapsed, setFormCollapsed] = useState(true);
    const [error, setError]                 = useState<string | null>(null);
    const [successMsg, setSuccess]          = useState<string | null>(null);
    const [busyKey, setBusyKey]             = useState<string | null>(null);

    const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };
    const err   = (msg: string) => { setError(msg);   setTimeout(() => setError(null),   6000); };

    // --- Deploy dialog ---
    const [deployProject, setDeployProject] = useState<any | null>(null);
    const [dnsMode, setDnsMode]             = useState<DnsMode>('subdomain');
    const [subdomain, setSubdomain]         = useState('');
    const [domain, setDomain]               = useState('');
    const [targetErr, setTargetErr]         = useState('');
    const [deploying, setDeploying]         = useState(false);
    const [deployError, setDeployError]     = useState<string | null>(null);

    const openDeployDialog = (project: any) => {
        setDeployProject(project);
        setDnsMode('subdomain');
        setSubdomain('');
        setDomain('');
        setTargetErr('');
        setDeploying(false);
        setDeployError(null);
    };

    const closeDeployDialog = () => {
        setDeployProject(null);
        setDeploying(false);
        setDeployError(null);
    };

    const handleDeploy = async () => {
        const isSubdomain = dnsMode === 'subdomain';
        const e = isSubdomain ? validateSubdomain(subdomain) : validateDomain(domain);
        if (e) { setTargetErr(e); return; }

        setDeploying(true);
        setDeployError(null);
        const res = await triggerDeploy(deployProject.project_uuid, {
            triggeredBy: actorId,
            dnsMode,
            subdomain: isSubdomain ? subdomain : undefined,
            domain: isSubdomain ? undefined : domain,
        });

        if (!res.success) {
            setDeploying(false);
            const errorMsg = res.error || 'Deploy failed.';
            setDeployError(errorMsg);
            err(errorMsg);
            return;
        }

        // Hand the live log stream to the global dock toast.
        const target = isSubdomain ? `${subdomain}.arvo.team` : domain;
        if (res.run_uuid) {
            startRun({
                runId: res.run_uuid,
                kind: 'deploy',
                label: `Deploying ${target}`,
                onDone: () => refresh(),
            });
        }
        closeDeployDialog();
        flash(`Deployment started for ${target}`);
    };

    // --- Rebuild dialog ---
    const [rebuildTarget, setRebuildTarget] = useState<any | null>(null);

    const openRebuildDialog = (deployment: any) => setRebuildTarget(deployment);
    const closeRebuildDialog = () => setRebuildTarget(null);

    const handleRebuild = async () => {
        if (!rebuildTarget) return;
        const target = rebuildTarget;
        setBusyKey(`rebuild-${target.deployment_uuid}`);

        const res = await triggerRebuild(target.deployment_uuid, actorId);
        setBusyKey(null);
        setRebuildTarget(null);

        if (!res.success) {
            err(res.error || 'Rebuild failed.');
            return;
        }

        if (res.run_uuid) {
            startRun({
                runId: res.run_uuid,
                kind: 'rebuild',
                label: `Rebuilding ${deploymentFqdn(target)}`,
                onDone: () => refresh(),
            });
        }
        flash(`Rebuild started for ${deploymentFqdn(target)}`);
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

                    <DeployInstructions />

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
                                {loading && projects.length === 0 ? (
                                    <TableRowsSkeleton rows={3} cols={4} />
                                ) : projects.length === 0 ? (
                                    <div className="p-4 sm:p-6">
                                        <EmptyState
                                            icon="fa-solid fa-folder-open"
                                            title="No attached projects found"
                                            hint="Attach a project to deploy it here."
                                        />
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
                                        <motion.tbody
                                            className="[&_tr:last-child]:border-0"
                                            variants={staggerContainer}
                                            initial="hidden"
                                            animate="show"
                                        >
                                            {projects.map((p: any) => (
                                                <motion.tr
                                                    key={p.project_uuid}
                                                    variants={staggerItem}
                                                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                                >
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
                                                </motion.tr>
                                            ))}
                                        </motion.tbody>
                                    </Table>
                                )}
                            </>
                        )}
                    </div>

                    {/* Deployments table */}
                    <div className="border border-border rounded-sm bg-card">
                        <div className="flex items-center justify-between border-b border-border p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Deployments</p>
                        </div>

                        {loading && deployments.length === 0 ? (
                            <TableRowsSkeleton rows={5} cols={6} />
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
                                <motion.tbody
                                    className="[&_tr:last-child]:border-0"
                                    variants={staggerContainer}
                                    initial="hidden"
                                    animate="show"
                                >
                                  <AnimatePresence initial={false}>
                                    {deployments.map((d: any) => (
                                        <motion.tr
                                            key={d.deployment_uuid}
                                            layout
                                            variants={listItem}
                                            initial="hidden"
                                            animate="show"
                                            exit="exit"
                                            className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                        >
                                            <TableCell className="py-2.5">
                                                <a
                                                    href={`https://${deploymentFqdn(d)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-mono text-sm hover:underline inline-flex items-center gap-1.5"
                                                >
                                                    {deploymentFqdn(d)}
                                                    <i className="fa-solid fa-arrow-up-right-from-square text-xs text-muted-foreground" />
                                                </a>
                                            </TableCell>
                                            <TableCell className="py-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Badge variant="secondary" className="font-normal text-xs uppercase">
                                                        {d.tech_stack}
                                                    </Badge>
                                                    {d.dns_mode && d.dns_mode !== 'subdomain' && (
                                                        <Badge variant="outline" className="font-normal text-[10px] uppercase">
                                                            {dnsModeLabel(d.dns_mode)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground py-2.5">
                                                {d.assigned_port ?? '—'}
                                            </TableCell>
                                            <TableCell className="py-2.5">
                                                <AnimatedStatusBadge status={d.status} />
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground py-2.5 whitespace-nowrap">
                                                {formatDateTime(d.deployed_at)}
                                            </TableCell>
                                            <TableCell className="text-right pr-4 py-2.5">
                                                <div className="flex justify-end gap-1">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Link href={`/deployments/${d.deployment_uuid}`}>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0"
                                                                >
                                                                    <i className="fa-solid fa-sliders" />
                                                                </Button>
                                                            </Link>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">
                                                            Manage deployment
                                                        </TooltipContent>
                                                    </Tooltip>
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
                                                                    disabled={d.status === 'pending'}
                                                                    pending={busyKey === `rebuild-${d.deployment_uuid}`}
                                                                >
                                                                    <i className="fa-solid fa-rotate" />
                                                                </Button>
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">Rebuild</TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                        </motion.tr>
                                    ))}
                                  </AnimatePresence>
                                </motion.tbody>
                            </Table>
                        )}
                        {!loading && deployments.length === 0 && (
                            <div className="p-4 sm:p-6">
                                <EmptyState
                                    icon="fa-solid fa-rocket"
                                    title="No deployments yet"
                                    hint="Deploy a project above to see it listed here."
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Right column */}
                <div className="w-full lg:w-80 space-y-4">
                    <div className="border border-border rounded-sm bg-card">
                        <div className="flex items-center justify-between border-b border-border p-4">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Summary</h3>
                        </div>
                        <div className="p-4 sm:p-6 space-y-3">
                            {[
                                { label: 'Total',     value: deployments.length,                                       color: '' },
                                { label: 'Active',    value: deployments.filter(d => d.status === 'active').length,    color: 'text-green-500' },
                                { label: 'Unhealthy', value: deployments.filter(d => d.status === 'unhealthy').length, color: 'text-amber-500' },
                                { label: 'Failed',    value: deployments.filter(d => d.status === 'failed').length,    color: 'text-red-500' },
                                { label: 'Pending',   value: deployments.filter(d => d.status === 'pending').length,   color: 'text-yellow-500' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">{label}</span>
                                    <AnimatedNumber value={value} className={`text-sm font-medium ${color}`} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Deploy dialog (form only — logs stream in the bottom dock) */}
            <Dialog
                open={!!deployProject}
                onOpenChange={open => { if (!open) closeDeployDialog(); }}
            >
                <DialogContent className="sm:max-w-lg shadow-none">
                    <DialogHeader>
                        <DialogTitle>Deploy {deployProject?.name}</DialogTitle>
                        <DialogDescription>
                            Choose how this deployment is addressed, then provide its hostname.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {deployError && (
                            <Alert variant="destructive">
                                <AlertDescription>{deployError}</AlertDescription>
                            </Alert>
                        )}

                        {/* DNS mode selector */}
                        <div>
                            <label className="block text-xs text-muted-foreground mb-1.5">Domain mode</label>
                            <SegmentedControl
                                options={DNS_MODE_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
                                value={dnsMode}
                                onChange={(v) => { setDnsMode(v); setTargetErr(''); }}
                                disabled={deploying}
                            />
                            <p className="mt-1.5 text-[11px] text-muted-foreground">
                                {DNS_MODE_OPTIONS.find(o => o.value === dnsMode)?.hint}
                            </p>
                        </div>

                        {dnsMode === 'subdomain' ? (
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1.5">
                                    Subdomain{' '}
                                    <span className="text-muted-foreground">(max 24 chars, lowercase)</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={subdomain}
                                        onChange={e => { setSubdomain(e.target.value.toLowerCase().trim()); setTargetErr(''); }}
                                        placeholder="my-project"
                                        className="font-mono"
                                        disabled={deploying}
                                    />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">.arvo.team</span>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1.5">Custom domain</label>
                                <Input
                                    value={domain}
                                    onChange={e => { setDomain(e.target.value.toLowerCase().trim()); setTargetErr(''); }}
                                    placeholder="shop.client.com"
                                    className="font-mono"
                                    disabled={deploying}
                                />
                            </div>
                        )}
                        {targetErr && <p className="text-xs text-destructive mt-1">{targetErr}</p>}

                        {dnsMode === 'external' && (
                            <Alert>
                                <AlertDescription className="text-xs">
                                    <i className="fa-solid fa-circle-info mr-1.5" />
                                    Point an <span className="font-mono">A</span> record for{' '}
                                    <span className="font-mono">{domain || 'your domain'}</span> at the server IP{' '}
                                    <strong>before</strong> deploying. The run fails fast (no cert) until DNS resolves —
                                    just redeploy once it does.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDeployDialog} disabled={deploying}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDeploy}
                            disabled={dnsMode === 'subdomain' ? !subdomain : !domain}
                            pending={deploying}
                            pendingText="Starting..."
                        >
                            Start Deployment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rebuild dialog (confirm only — logs stream in the bottom dock) */}
            <Dialog
                open={!!rebuildTarget}
                onOpenChange={open => { if (!open) closeRebuildDialog(); }}
            >
                <DialogContent className="sm:max-w-lg shadow-none">
                    <DialogHeader>
                        <DialogTitle>Rebuild — {rebuildTarget?.subdomain}</DialogTitle>
                        <DialogDescription>
                            Re-runs install and build steps for{' '}
                            <span className="font-mono">{rebuildTarget?.subdomain}.arvo.team</span>.
                            This does not affect your nginx or SSL configuration.
                        </DialogDescription>
                    </DialogHeader>

                    <p className="text-sm text-muted-foreground py-2">
                        The rebuild will re-install dependencies and run the build command for this deployment.
                        Progress will stream in the status dock at the bottom of the screen.
                    </p>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeRebuildDialog}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRebuild}
                            pending={busyKey === `rebuild-${rebuildTarget?.deployment_uuid}`}
                            pendingText="Queuing..."
                        >
                            Rebuild
                        </Button>
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
                            <TableRowsSkeleton rows={4} cols={3} />
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
                                                                    pending={envBusy === key}
                                                                >
                                                                    <i className="fa-solid fa-check" />
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
                                                                    disabled={!!envBusy && envBusy !== key}
                                                                    pending={envBusy === key}
                                                                >
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
                                                <TableCell
                                                    colSpan={3}
                                                    className="py-8 text-center text-xs text-muted-foreground"
                                                >
                                                    No environment variables found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                      </AnimatePresence>
                                    </motion.tbody>
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
                                            disabled={!newKey}
                                            pending={envBusy === '__new__'}
                                            className="shrink-0"
                                        >
                                            Add
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
