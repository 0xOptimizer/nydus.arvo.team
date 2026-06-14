'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useDeploymentContext } from '@/app/deployments/context/DeploymentContext';
import { useStreamDock } from '@/context/StreamDockContext';
import {
    triggerDeploy, triggerRebuild,
    getEnvLines, updateEnvLine, addEnvLine, deleteEnvLine,
} from '@/app/actions/deployments';
import { AnimatedStatusBadge } from '@/components/AnimatedStatusBadge';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { DeployInstructions } from '@/components/deployments/DeployInstructions';
import { formatDateTime } from '@/lib/format';
import { deploymentFqdn, deploymentName, dnsModeLabel } from '@/lib/deployments';
import { PageShell }              from '@/components/PageShell';
import { Section }                from '@/components/ui/section';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Field, FormGrid }        from '@/components/ui/field';
import { Input }                  from '@/components/ui/input';
import { Badge }                  from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button }                 from '@/components/ui/button';
import { SegmentedControl }       from '@/components/ui/segmented';
import { EmptyState }             from '@/components/EmptyState';
import { Skeleton }               from '@/components/ui/skeleton';
import { staggerContainer, staggerItem, listItem } from '@/lib/motion';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

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

    // --- Summary metrics ---
    const summary = [
        { label: 'Total',     value: deployments.length,                                       color: 'text-foreground' },
        { label: 'Active',    value: deployments.filter(d => d.status === 'active').length,    color: 'text-green-500' },
        { label: 'Unhealthy', value: deployments.filter(d => d.status === 'unhealthy').length, color: 'text-amber-500' },
        { label: 'Failed',    value: deployments.filter(d => d.status === 'failed').length,    color: 'text-red-500' },
        { label: 'Pending',   value: deployments.filter(d => d.status === 'pending').length,   color: 'text-yellow-500' },
    ];

    // --- Env dialog table columns ---
    const envColumns: Column<{ key: string; value: string }>[] = [
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
                        disabled={envBusy === key}
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
                            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handleEnvSave(key)} pending={envBusy === key}>
                                <i className="fa-solid fa-check" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingKey(null)} disabled={envBusy === key}>
                                <i className="fa-solid fa-xmark" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={() => handleEnvEdit(key, value)} disabled={!!envBusy}>
                                <i className="fa-solid fa-pen" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => handleEnvDelete(key)} disabled={!!envBusy && envBusy !== key} pending={envBusy === key}>
                                <i className="fa-solid fa-trash" />
                            </Button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <PageShell
            title="Deployments"
            description="Deploy attached projects and manage their domains, builds, and runtime."
            meta={
                <Badge variant="secondary" className="text-[10px] uppercase">
                    {deployments.length} live
                </Badge>
            }
            actions={
                <Button
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    pending={loading}
                    pendingText="Refreshing…"
                >
                    <i className="fa-solid fa-rotate" /> Refresh
                </Button>
            }
        >
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

            <DeployInstructions />

            {/* Summary */}
            <Section title="Overview" description="Status of your deployments at a glance" icon="fa-solid fa-chart-simple">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    {summary.map(({ label, value, color }) => (
                        <div key={label} className="rounded-sm border border-border bg-background/40 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                            <AnimatedNumber value={value} className={`mt-1.5 block text-2xl font-bold ${color}`} />
                        </div>
                    ))}
                </div>
            </Section>

            {/* Deploy a project */}
            <Section
                title="Deploy a project"
                description="Pick an attached repository to launch a new deployment"
                icon="fa-solid fa-folder"
            >
                {loading && projects.length === 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between rounded-sm border border-border bg-background/40 p-3"
                                style={{ opacity: 1 - i * 0.15 }}
                            >
                                <div className="space-y-1.5">
                                    <Skeleton className="h-3.5 w-28" />
                                    <Skeleton className="h-2.5 w-20 bg-muted/30" />
                                </div>
                                <Skeleton className="h-8 w-20 rounded-full" />
                            </div>
                        ))}
                    </div>
                ) : projects.length === 0 ? (
                    <EmptyState
                        icon="fa-solid fa-folder-open"
                        title="No attached projects"
                        hint="Attach a GitHub repository on the Projects page to deploy it here."
                        action={
                            <Button asChild variant="outline" size="sm">
                                <Link href="/projects">
                                    <i className="fa-solid fa-arrow-right" /> Go to Projects
                                </Link>
                            </Button>
                        }
                    />
                ) : (
                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    >
                        {projects.map((p) => (
                            <motion.div
                                key={p.project_uuid}
                                variants={staggerItem}
                                className="flex items-center justify-between gap-2 rounded-sm border border-border bg-background/40 p-3 transition-colors hover:border-primary/40"
                            >
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-foreground">{p.name}</div>
                                    <div className="truncate text-[10px] text-muted-foreground">
                                        {p.owner_login}{p.default_branch ? ` • ${p.default_branch}` : ''}
                                    </div>
                                </div>
                                <Button ripple size="sm" onClick={() => openDeployDialog(p)} className="shrink-0">
                                    <i className="fa-solid fa-rocket" /> Deploy
                                </Button>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </Section>

            {/* Deployments */}
            <Section
                title="Deployments"
                description="Live deployments and their runtime status"
                icon="fa-solid fa-rocket"
            >
                {loading && deployments.length === 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-sm border border-border bg-background/40 p-4"
                                style={{ opacity: 1 - i * 0.15 }}
                            >
                                <div className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-5 w-16 rounded-full bg-muted/30" />
                                </div>
                                <Skeleton className="mt-3 h-3 w-24 bg-muted/30" />
                                <Skeleton className="mt-4 h-8 w-full bg-muted/20" />
                            </div>
                        ))}
                    </div>
                ) : deployments.length === 0 ? (
                    <EmptyState
                        icon="fa-solid fa-rocket"
                        title="No deployments yet"
                        hint="Deploy an attached project above to see it listed here."
                    />
                ) : (
                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
                    >
                        <AnimatePresence initial={false}>
                            {deployments.map((d) => {
                                const fqdn = deploymentFqdn(d);
                                return (
                                    <motion.div
                                        key={d.deployment_uuid}
                                        variants={listItem}
                                        exit="exit"
                                        layout
                                        className="flex flex-col rounded-sm border border-border bg-background/40 p-4 transition-colors hover:border-primary/40"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <a
                                                href={`https://${fqdn}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex min-w-0 items-center gap-1.5 font-mono text-sm text-foreground hover:underline"
                                            >
                                                <span className="truncate">{fqdn}</span>
                                                <i className="fa-solid fa-arrow-up-right-from-square shrink-0 text-[10px] text-muted-foreground" />
                                            </a>
                                            <AnimatedStatusBadge status={d.status} />
                                        </div>

                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                            <Badge variant="secondary" className="text-[10px] font-normal uppercase">{d.tech_stack}</Badge>
                                            {d.dns_mode && d.dns_mode !== 'subdomain' && (
                                                <Badge variant="outline" className="text-[10px] font-normal uppercase">{dnsModeLabel(d.dns_mode)}</Badge>
                                            )}
                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Port</p>
                                                <p className="font-mono text-xs text-foreground">{d.assigned_port ?? '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Deployed</p>
                                                <p className="font-mono text-xs text-foreground">{formatDateTime(d.deployed_at)}</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                                            <Button asChild variant="ghost" size="sm" className="flex-1">
                                                <Link href={`/deployments/${d.deployment_uuid}`}>
                                                    <i className="fa-solid fa-sliders" /> Manage
                                                </Link>
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => openEnvDialog(d)} aria-label="Environment variables">
                                                <i className="fa-solid fa-file-code" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openRebuildDialog(d)}
                                                disabled={d.status === 'pending'}
                                                pending={busyKey === `rebuild-${d.deployment_uuid}`}
                                                aria-label="Rebuild"
                                            >
                                                <i className="fa-solid fa-rotate" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </motion.div>
                )}
            </Section>

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

                        <Field
                            label="Domain mode"
                            hint={DNS_MODE_OPTIONS.find(o => o.value === dnsMode)?.hint}
                        >
                            <SegmentedControl
                                options={DNS_MODE_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
                                value={dnsMode}
                                onChange={(v) => { setDnsMode(v); setTargetErr(''); }}
                                disabled={deploying}
                            />
                        </Field>

                        {dnsMode === 'subdomain' ? (
                            <Field
                                label="Subdomain"
                                hint="Max 24 characters, lowercase letters, numbers, and hyphens."
                                error={targetErr || undefined}
                                required
                            >
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={subdomain}
                                        onChange={e => { setSubdomain(e.target.value.toLowerCase().trim()); setTargetErr(''); }}
                                        placeholder="my-project"
                                        className="font-mono"
                                        disabled={deploying}
                                    />
                                    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">.arvo.team</span>
                                </div>
                            </Field>
                        ) : (
                            <Field
                                label="Custom domain"
                                hint="A fully-qualified hostname, e.g. shop.client.com."
                                error={targetErr || undefined}
                                required
                            >
                                <Input
                                    value={domain}
                                    onChange={e => { setDomain(e.target.value.toLowerCase().trim()); setTargetErr(''); }}
                                    placeholder="shop.client.com"
                                    className="font-mono"
                                    disabled={deploying}
                                />
                            </Field>
                        )}

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
                            ripple
                            onClick={handleDeploy}
                            disabled={dnsMode === 'subdomain' ? !subdomain : !domain}
                            pending={deploying}
                            pendingText="Starting…"
                        >
                            <i className="fa-solid fa-rocket" /> Start deployment
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
                        <DialogTitle>Rebuild — {rebuildTarget ? deploymentName(rebuildTarget) : ''}</DialogTitle>
                        <DialogDescription>
                            Re-runs install and build steps for{' '}
                            <span className="font-mono">{rebuildTarget ? deploymentFqdn(rebuildTarget) : ''}</span>.
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
                            ripple
                            onClick={handleRebuild}
                            pending={busyKey === `rebuild-${rebuildTarget?.deployment_uuid}`}
                            pendingText="Queuing…"
                        >
                            <i className="fa-solid fa-rotate" /> Rebuild
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
                        <DialogTitle>Environment variables</DialogTitle>
                        <DialogDescription>
                            <span className="font-mono">{envDeployment ? deploymentFqdn(envDeployment) : ''}</span>
                            {' · '}
                            <span className="font-mono text-xs">{envDeployment?.env_file_name}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="overflow-hidden rounded-sm border border-border">
                            <DataTable
                                columns={envColumns}
                                rows={envLines}
                                getRowId={(l) => l.key}
                                loading={envLoading}
                                skeletonRows={4}
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
                                        onChange={e => {
                                            setNewKey(e.target.value.toUpperCase().trim());
                                            setNewKeyErr('');
                                        }}
                                        placeholder="KEY_NAME"
                                        className="font-mono text-xs"
                                        disabled={envBusy === '__new__'}
                                    />
                                </Field>
                                <Field label="Value">
                                    <Input
                                        value={newValue}
                                        onChange={e => setNewValue(e.target.value)}
                                        placeholder="value"
                                        className="font-mono text-xs"
                                        disabled={envBusy === '__new__'}
                                    />
                                </Field>
                            </FormGrid>
                            <div className="mt-3 flex justify-end">
                                <Button
                                    size="sm"
                                    onClick={handleEnvAdd}
                                    disabled={!newKey}
                                    pending={envBusy === '__new__'}
                                    pendingText="Adding…"
                                >
                                    <i className="fa-solid fa-plus" /> Add variable
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeEnvDialog}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    );
}
