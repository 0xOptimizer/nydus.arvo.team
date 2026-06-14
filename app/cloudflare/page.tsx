'use client';

import { useState, useEffect } from 'react';
import { getProjects } from '@/app/actions/projects';
import { getDNSRecords, createSubdomainRecord, deleteDNSRecord } from '@/app/actions/cloudflare';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/ui/section';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Field, FormGrid } from '@/components/ui/field';

export default function DNSPage() {
    // Data State
    const [projects, setProjects] = useState<any[]>([]);
    const [records, setRecords] = useState<any[]>([]);

    // Form State
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [subdomain, setSubdomain] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [page, setPage] = useState<number>(1);

    // UI State
    const [loading, setLoading] = useState<boolean>(true);
    const [creating, setCreating] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            const [projData, dnsData] = await Promise.all([
                getProjects(),
                getDNSRecords(1)
            ]);
            setProjects(projData);
            setRecords(dnsData || []);
            setLoading(false);
        };
        init();
    }, []);

    // Refresh Records when page/search changes
    useEffect(() => {
        const refresh = async () => {
            setLoading(true);
            const data = await getDNSRecords(page, searchQuery);
            setRecords(data || []);
            setLoading(false);
        };
        if (!loading) refresh(); // Skip on first mount to avoid double fetch
    }, [page, searchQuery]);

    // Handle Project Selection & Auto-fill
    const handleProjectSelect = (projectId: string) => {
        setSelectedProject(projectId);

        if (projectId) {
            const project = projects.find(p => p.uuid === projectId);
            if (project) {
                // Sanitize: lowercase, remove non-alphanumeric, max 63 chars
                const sanitized = project.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '')
                    .substring(0, 63);
                setSubdomain(sanitized);
            }
        } else {
            setSubdomain('');
        }
    };

    // Subdomain Validation
    const isValidSubdomain = (name: string) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name);
    const subdomainInvalid = subdomain.length > 0 && !isValidSubdomain(subdomain);

    // Create Action
    const handleCreate = async () => {
        if (!isValidSubdomain(subdomain)) {
            setError("Invalid subdomain format. Use lowercase alphanumeric and hyphens only.");
            return;
        }

        setCreating(true);
        setError(null);

        const project = projects.find(p => p.uuid === selectedProject);
        const comment = project ? `Auto-created for project: ${project.name}` : 'Manual creation via Web UI';

        const res = await createSubdomainRecord(subdomain, comment);

        if (res.success) {
            setSubdomain('');
            setSelectedProject('');
            // Refresh list
            const newData = await getDNSRecords(page, searchQuery);
            setRecords(newData || []);
        } else {
            setError(res.error || "Failed to create record");
        }
        setCreating(false);
    };

    // Delete Action
    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this DNS record? This will break the live site.')) return;

        setLoading(true);
        const res = await deleteDNSRecord(id);
        if (res.success) {
            const newData = await getDNSRecords(page, searchQuery);
            setRecords(newData || []);
        } else {
            alert(res.error);
        }
        setLoading(false);
    };

    const recordColumns: Column<any>[] = [
        {
            key: 'type',
            header: 'Type',
            render: (record) => (
                <Badge variant={record.type === 'A' ? 'default' : 'secondary'} className="text-[10px] font-bold uppercase">
                    {record.type}
                </Badge>
            ),
        },
        {
            key: 'name',
            header: 'Name',
            render: (record) => (
                <span className="font-mono text-sm font-medium text-foreground">{record.name}</span>
            ),
        },
        {
            key: 'content',
            header: 'Content',
            render: (record) => (
                <span className="break-all font-mono text-xs text-muted-foreground">{record.content}</span>
            ),
        },
        {
            key: 'proxy',
            header: 'Proxy',
            render: (record) => (
                <StatusChip
                    label={record.proxied ? 'Proxied' : 'DNS only'}
                    state={record.proxied ? 'ok' : 'unknown'}
                />
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (record) => (
                <div className="flex justify-end">
                    <Button
                        variant="outline"
                        tone="inactive"
                        size="sm"
                        onClick={() => handleDelete(record.id)}
                    >
                        Delete
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <PageShell
            title="Cloudflare"
            description="Manage subdomains and bind them to internal deployments."
        >
            <Section
                title="New record"
                description="Bind a project to a subdomain on arvo.team"
                icon="fa-solid fa-plus-circle"
            >
                <FormGrid cols={2}>
                    <Field
                        label="Project"
                        hint="Picks a default subdomain from the repository name."
                    >
                        <Select value={selectedProject} onValueChange={handleProjectSelect}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Choose a repository…" />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map((p) => (
                                    <SelectItem key={p.uuid} value={p.uuid} className="cursor-pointer">
                                        {p.owner}/{p.name} ({p.branch})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>

                    <Field
                        label="Subdomain"
                        hint="Lowercase letters, numbers, and hyphens only."
                        error={subdomainInvalid ? 'Invalid subdomain format.' : error || undefined}
                    >
                        <div className={`flex transition-opacity duration-300 ${selectedProject ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                            <Input
                                type="text"
                                value={subdomain}
                                onChange={(e) => setSubdomain(e.target.value.toLowerCase().trim())}
                                placeholder="project-name"
                                className="flex-1 rounded-r-none border-r-0 text-right font-mono"
                            />
                            <span className="inline-flex select-none items-center rounded-r-md border border-l-0 border-border bg-secondary px-3 font-mono text-sm text-muted-foreground">
                                .arvo.team
                            </span>
                        </div>
                    </Field>
                </FormGrid>

                <div className="mt-4 flex justify-end">
                    <Button
                        ripple
                        pending={creating}
                        pendingText="Binding…"
                        onClick={handleCreate}
                        disabled={!selectedProject || !subdomain || subdomainInvalid}
                    >
                        <i className="fa-solid fa-plus" /> Bind record
                    </Button>
                </div>
            </Section>

            <Section
                title="Active records"
                description="DNS records managed through Nydus"
                icon="fa-solid fa-globe"
                flush
                actions={
                    <Input
                        type="text"
                        placeholder="Search records…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 w-44 sm:w-64"
                    />
                }
                footer={
                    <div className="flex items-center justify-between gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                            <i className="fa-solid fa-arrow-left" /> Previous
                        </Button>
                        <span className="inline-flex items-center rounded-full border border-border bg-secondary px-4 py-1.5 font-mono text-xs font-bold text-foreground">
                            Page {page}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={records.length < 20} // Simple check, ideally API returns total pages
                            onClick={() => setPage(p => p + 1)}
                        >
                            Next <i className="fa-solid fa-arrow-right" />
                        </Button>
                    </div>
                }
            >
                <DataTable
                    columns={recordColumns}
                    rows={records}
                    getRowId={(record) => record.id}
                    loading={loading}
                    empty={
                        <EmptyState
                            icon="fa-solid fa-globe"
                            title={searchQuery ? 'No matching records' : 'No DNS records found'}
                            hint={
                                searchQuery
                                    ? 'No records match your search. Try a different query.'
                                    : 'Bind a new subdomain above to get started.'
                            }
                        />
                    }
                />
            </Section>
        </PageShell>
    );
}
