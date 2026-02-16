'use client';

import { useState, useEffect } from 'react';
import { getProjects } from '@/app/actions/projects';
import { getDNSRecords, createSubdomainRecord, deleteDNSRecord } from '@/app/actions/cloudflare';

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

    const baseStyle = "relative overflow-hidden transition-all duration-200 px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm disabled:opacity-50 disabled:cursor-not-allowed";
    const variants: any = {
        primary: "bg-black text-white hover:bg-sky-900",
        danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
        outline: "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
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
        <div className="space-y-8 max-w-6xl mx-auto font-sans pb-20">
            {/* Header */}
            <div className="pb-6 border-b border-gray-100">
                <h1 className="text-3xl font-bold text-sky-900 uppercase tracking-tight">Cloudflare DNS Manager</h1>
                <p className="text-sm text-gray-600 mt-2 font-medium">Manage subdomains and bind them to internal deployments</p>
            </div>

            {/* Create Section */}
            <div className="bg-white border border-gray-200 p-6 shadow-sm rounded-sm">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
                    <i className="fa-solid fa-plus-circle mr-2 text-sky-600"></i>
                    Bind New Subdomain
                </h3>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded flex items-center">
                        <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    {/* Project Selector */}
                    <div className="md:col-span-4">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Project</label>
                        <select 
                            value={selectedProject} 
                            onChange={handleProjectSelect}
                            className="w-full bg-gray-50 border border-gray-300 text-sm rounded-sm p-2.5 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
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
                    <div className={`md:col-span-6 transition-all duration-300 ${selectedProject ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}`}>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Assigned Subdomain 
                            {!isValidSubdomain(subdomain) && subdomain.length > 0 && <span className="text-red-500 ml-2 normal-case italic">(Invalid format)</span>}
                        </label>
                        <div className="flex">
                            <input 
                                type="text" 
                                value={subdomain}
                                onChange={(e) => setSubdomain(e.target.value.toLowerCase().trim())}
                                placeholder="project-name"
                                className="flex-1 bg-white border border-gray-300 border-r-0 text-sm rounded-l-sm p-2.5 focus:ring-sky-500 focus:border-sky-500 outline-none text-right font-mono"
                            />
                            <span className="bg-gray-100 border border-gray-300 text-gray-500 text-sm font-mono p-2.5 rounded-r-sm select-none">
                                .arvo.team
                            </span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="md:col-span-2">
                        <RippleButton 
                            onClick={handleCreate} 
                            disabled={!selectedProject || !subdomain || creating}
                            className="w-full h-[42px] flex items-center justify-center"
                        >
                            {creating ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Bind Record'}
                        </RippleButton>
                    </div>
                </div>
            </div>

            {/* List Section */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Active Records
                    </h3>
                    <div className="flex gap-2">
                         <input 
                            type="text" 
                            placeholder="Search records..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white border border-gray-300 text-xs rounded-sm px-3 py-1.5 focus:border-sky-500 outline-none w-64"
                        />
                    </div>
                </div>

                <div className="bg-white border border-gray-200 shadow-sm overflow-hidden rounded-sm">
                    {loading && records.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">Loading DNS records...</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 font-bold text-gray-500 uppercase text-xs tracking-wider w-24">Type</th>
                                    <th className="px-6 py-3 font-bold text-gray-500 uppercase text-xs tracking-wider">Name</th>
                                    <th className="px-6 py-3 font-bold text-gray-500 uppercase text-xs tracking-wider">Content</th>
                                    <th className="px-6 py-3 font-bold text-gray-500 uppercase text-xs tracking-wider w-32">Proxy</th>
                                    <th className="px-6 py-3 font-bold text-gray-500 uppercase text-xs tracking-wider w-24 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {records.map((record: any) => (
                                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold
                                                ${record.type === 'A' ? 'bg-blue-100 text-blue-800' : 
                                                  record.type === 'CNAME' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {record.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-gray-800">{record.name}</td>
                                        <td className="px-6 py-4 font-mono text-gray-500 text-xs">{record.content}</td>
                                        <td className="px-6 py-4">
                                            {record.proxied ? (
                                                <span className="text-orange-500 font-bold text-xs"><i className="fa-solid fa-cloud"></i> Proxied</span>
                                            ) : (
                                                <span className="text-gray-400 text-xs"><i className="fa-solid fa-cloud"></i> DNS Only</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <RippleButton variant="danger" onClick={() => handleDelete(record.id)} className="px-3 py-1 text-[10px]">
                                                Delete
                                            </RippleButton>
                                        </td>
                                    </tr>
                                ))}
                                {records.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">
                                            No DNS records found matching your criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                <div className="flex justify-center gap-2 mt-4">
                    <RippleButton 
                        variant="outline" 
                        disabled={page === 1} 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                        Previous
                    </RippleButton>
                    <span className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200">
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