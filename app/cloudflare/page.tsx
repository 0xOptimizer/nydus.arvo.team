'use client';

import { useState, useEffect } from 'react';
import { getProjects } from '@/app/actions/projects';
import { getDNSRecords, createSubdomainRecord, deleteDNSRecord } from '@/app/actions/cloudflare';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// --- UI Components ---

const RippleButton = ({ children, onClick, className, disabled, variant = 'primary' }: any) => {
    const createRipple = (event: any) => {
        const button = event.currentTarget;
        const circle = document.createElement('span');
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;
        const rect = button.getBoundingClientRect();
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - rect.left - radius}px`;
        circle.style.top = `${event.clientY - rect.top - radius}px`;
        circle.classList.add('ripple');
        const existing = button.getElementsByClassName('ripple')[0];
        if (existing) existing.remove();
        button.appendChild(circle);
        if (onClick) onClick(event);
    };

    const baseStyle = "relative overflow-hidden transition-all duration-200 px-4 py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed";
    const variants: any = {
        primary: "bg-primary text-black hover:bg-primary/90",
        danger: "bg-red-900/50 text-red-200 hover:bg-red-900/70 border border-red-700/50",
        outline: "bg-secondary text-foreground border border-border hover:bg-border"
    };

    return (
        <button disabled={disabled} onClick={createRipple} className={`${baseStyle} ${variants[variant]} ${className}`}>
            <span className="relative z-10">{children}</span>
            <style jsx global>{`
                span.ripple { position: absolute; border-radius: 50%; transform: scale(0); animation: ripple 600ms linear; background-color: rgba(255, 255, 255, 0.3); pointer-events: none; }
                @keyframes ripple { to { transform: scale(4); opacity: 0; } }
            `}</style>
        </button>
    );
};

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
    const handleProjectSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const projectId = e.target.value;
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
        <div className="space-y-8 max-w-6xl pb-20">
            {/* Header */}
            <div className="pb-6 border-b border-border">
                <h1 className="text-3xl font-bold text-foreground uppercase tracking-tight">Cloudflare DNS Manager</h1>
                <p className="text-sm text-muted-foreground mt-2 font-medium">Manage subdomains and bind them to internal deployments</p>
            </div>

            {/* Create Section */}
            <Card className="p-6 border-border bg-card">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
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
                        <select
                            value={selectedProject}
                            onChange={handleProjectSelect}
                            className="w-full bg-secondary border border-border text-foreground text-sm p-2 focus:ring-primary focus:border-primary outline-none transition-all"
                        >
                            <option value="">-- Choose a Repository --</option>
                            {projects.map((p) => (
                                <option key={p.uuid} value={p.uuid}>
                                    {p.owner}/{p.name} ({p.branch})
                                </option>
                            ))}
                        </select>
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
                        <RippleButton
                            onClick={handleCreate}
                            disabled={!selectedProject || !subdomain || creating}
                            className="w-full h-10 flex items-center justify-center"
                        >
                            {creating ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Bind Record'}
                        </RippleButton>
                    </div>
                </div>
            </Card>

            {/* List Section */}
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                        Active Records
                    </h3>
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            placeholder="Search records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-card w-full md:w-64 border-border text-foreground text-xs"
                        />
                    </div>
                </div>

                <Card className="border-border bg-card overflow-hidden">
                    {loading && records.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">Loading DNS records...</div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-secondary border-b border-border md:block hidden">
                                <TableRow className="border-border">
                                    <TableHead className="font-bold text-foreground uppercase text-xs w-24">Type</TableHead>
                                    <TableHead className="font-bold text-foreground uppercase text-xs">Name</TableHead>
                                    <TableHead className="font-bold text-foreground uppercase text-xs">Content</TableHead>
                                    <TableHead className="font-bold text-foreground uppercase text-xs w-32">Proxy</TableHead>
                                    <TableHead className="font-bold text-foreground uppercase text-xs w-24 text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {records.map((record: any) => (
                                    <TableRow key={record.id} className="relative block md:table-row border border-border md:border-0 md:border-b hover:bg-secondary transition-colors rounded-none p-4 md:p-0 bg-card md:bg-transparent shadow-sm md:shadow-none">
                                        <TableCell className="block md:table-cell p-0 md:p-4 mb-2 md:mb-0 align-middle">
                                            <Badge variant={record.type === 'A' ? 'default' : 'secondary'}className={`text-xs font-bold uppercase ${record.type === 'A' ? 'text-black' : 'text-muted-foreground'}`}>
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
                                            <RippleButton
                                                variant="danger"
                                                onClick={() => handleDelete(record.id)}
                                                className="w-full md:w-auto px-3 py-2 md:py-1 text-xs md:text-[10px]"
                                            >
                                                Delete
                                            </RippleButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {records.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="px-6 py-8 text-center text-muted-foreground italic">
                                            No DNS records found matching your criteria.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </Card>

                {/* Pagination */}
                <div className="flex justify-center gap-2 mt-4">
                    <RippleButton
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                        Previous
                    </RippleButton>
                    <span className="px-4 py-2 text-sm font-bold text-foreground bg-secondary border border-border">
                        Page {page}
                    </span>
                    <RippleButton
                        variant="outline"
                        disabled={records.length < 20} // Simple check, ideally API returns total pages
                        onClick={() => setPage(p => p + 1)}
                    >
                        Next
                    </RippleButton>
                </div>
            </div>
        </div>
    );
}