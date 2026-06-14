'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { getProjects } from '@/app/actions/projects';
import { getDNSRecords, createSubdomainRecord, deleteDNSRecord } from '@/app/actions/cloudflare';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableRowsSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { PageShell } from '@/components/PageShell';
import { staggerContainer, listItem } from '@/lib/motion';

// --- Main Page Component ---

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

    return (
        <PageShell
            title="Cloudflare"
            description="Manage subdomains and bind them to internal deployments."
            className="max-w-7xl pb-20"
        >
            {/* Create Section */}
            <Card className="rounded-sm border border-border bg-card p-4 sm:p-6">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                    <i className="fa-solid fa-plus-circle mr-2 text-primary"></i>
                    Bind New Subdomain
                </h3>

                {error && (
                    <Alert className="mb-4 bg-red-950/30 border-red-900/50 text-red-200 text-xs font-bold">
                        <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                        {error}
                    </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    {/* Project Selector */}
                    <div className="md:col-span-4">
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Select Project</label>
                        <Select value={selectedProject} onValueChange={handleProjectSelect}>
                            <SelectTrigger className="w-full bg-secondary border-border text-foreground">
                                <SelectValue placeholder="-- Choose a Repository --" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border text-popover-foreground">
                                {projects.map((p) => (
                                    <SelectItem
                                        key={p.uuid}
                                        value={p.uuid}
                                        className="focus:bg-secondary cursor-pointer"
                                    >
                                        {p.owner}/{p.name} ({p.branch})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Subdomain Input (Conditional) */}
                    <div className={`md:col-span-6 transition-all duration-300 ${selectedProject ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">
                            Assigned Subdomain
                            {!isValidSubdomain(subdomain) && subdomain.length > 0 && <span className="text-red-400 ml-2 normal-case italic">(Invalid format)</span>}
                        </label>
                        <div className="flex">
                            <Input
                                type="text"
                                value={subdomain}
                                onChange={(e) => setSubdomain(e.target.value.toLowerCase().trim())}
                                placeholder="project-name"
                                className="flex-1 bg-background border-r-0 text-right font-mono border-border"
                            />
                            <span className="bg-secondary border border-l-0 border-border text-muted-foreground text-sm font-mono p-2 select-none">
                                .arvo.team
                            </span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="md:col-span-2">
                        <Button
                            ripple
                            pending={creating}
                            pendingText=""
                            onClick={handleCreate}
                            disabled={!selectedProject || !subdomain}
                            className="w-full h-10"
                        >
                            Bind Record
                        </Button>
                    </div>
                </div>
            </Card>

            {/* List Section */}
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Active Records
                    </h3>
                    <div className="flex gap-2 justify-end">
                        <Input
                            type="text"
                            placeholder="Search records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-card w-full md:w-64 border-border text-foreground text-xs"
                        />
                    </div>
                </div>

                <Card className="rounded-sm border border-border bg-card overflow-hidden">
                    {loading && records.length === 0 ? (
                        <TableRowsSkeleton rows={5} cols={5} />
                    ) : records.length === 0 ? (
                        <EmptyState
                            icon="fa-solid fa-globe"
                            title="No DNS records found"
                            hint="No records match your criteria. Bind a new subdomain above to get started."
                            className="border-0"
                        />
                    ) : (
                        <Table>
                            <TableHeader className="bg-secondary border-b border-border md:table-header-group hidden">
                                <TableRow className="border-border">
                                    <TableHead className="font-bold text-foreground uppercase text-xs w-24">Type</TableHead>
                                    <TableHead className="font-bold text-foreground uppercase text-xs">Name</TableHead>
                                    <TableHead className="font-bold text-foreground uppercase text-xs">Content</TableHead>
                                    <TableHead className="font-bold text-foreground uppercase text-xs w-32">Proxy</TableHead>
                                    <TableHead className="font-bold text-foreground uppercase text-xs w-24 text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <motion.tbody
                                className="[&_tr:last-child]:border-0"
                                variants={staggerContainer}
                                initial="hidden"
                                animate="show"
                            >
                                <AnimatePresence initial={false}>
                                    {records.map((record: any) => (
                                        <motion.tr
                                            key={record.id}
                                            layout
                                            variants={listItem}
                                            exit="exit"
                                            className="relative block md:table-row border border-border md:border-0 md:border-b hover:bg-secondary transition-colors rounded-none p-4 md:p-0 bg-card md:bg-transparent shadow-sm md:shadow-none"
                                        >
                                                <TableCell className="block md:table-cell p-0 md:p-4 mb-2 md:mb-0 align-middle">
                                                    <Badge variant={record.type === 'A' ? 'default' : 'secondary'} className={`text-xs font-bold uppercase ${record.type === 'A' ? 'text-black' : 'text-muted-foreground'}`}>
                                                        {record.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="block md:table-cell p-0 md:p-4 mb-1 md:mb-0 font-mono text-foreground text-sm md:text-base font-bold md:font-normal align-middle">{record.name}</TableCell>
                                                <TableCell className="block md:table-cell p-0 md:p-4 mb-4 md:mb-0 font-mono text-muted-foreground text-xs break-all align-middle">{record.content}</TableCell>
                                                <TableCell className="absolute md:relative top-4 right-4 md:top-auto md:right-auto block md:table-cell p-0 md:p-4 align-middle">
                                                    {record.proxied ? (
                                                        <span className="text-primary font-bold text-xs"><i className="fa-solid fa-cloud"></i> Proxied</span>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs"><i className="fa-solid fa-cloud"></i> DNS Only</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="block md:table-cell p-0 md:p-4 pt-3 md:pt-4 mt-2 md:mt-0 border-t border-border/50 md:border-0 text-right align-middle">
                                                    <Button
                                                        ripple
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDelete(record.id)}
                                                        className="w-full md:w-auto"
                                                    >
                                                        Delete
                                                    </Button>
                                                </TableCell>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </motion.tbody>
                        </Table>
                    )}
                </Card>

                {/* Pagination */}
                <div className="flex justify-center items-center gap-2 mt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                        Previous
                    </Button>
                    <span className="inline-flex items-center rounded-full border border-border bg-secondary px-4 py-1.5 text-xs font-bold font-mono text-foreground">
                        Page {page}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={records.length < 20} // Simple check, ideally API returns total pages
                        onClick={() => setPage(p => p + 1)}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </PageShell>
    );
}
