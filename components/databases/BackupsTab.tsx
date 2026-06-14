'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatRowSkeleton, TableRowsSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { PageShell } from '@/components/PageShell'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { staggerContainer, listItem } from '@/lib/motion'
import { getAllRecentBackups } from '@/app/actions/databases'

type Backup = {
    backup_uuid: string
    database_name: string
    target_database_uuid: string
    file_name: string
    file_size_bytes: number | null
    status: string
    created_at: string
}

function formatBytes(bytes: number | null): string {
    if (!bytes) return 'N/A'
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

const STATUS_STYLES: Record<string, string> = {
    completed: 'bg-green-500/10 text-green-600 border border-green-500/20',
    failed:    'bg-red-500/10 text-red-600 border border-red-500/20',
    running:   'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20',
    pending:   'bg-muted text-muted-foreground border border-border',
}

export default function BackupsTab() {
    const [backups, setBackups]     = useState<Backup[]>([])
    const [loading, setLoading]     = useState(true)
    const [filter, setFilter]       = useState('')
    const [error, setError]         = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        const result = await getAllRecentBackups(100)
        if (Array.isArray(result)) {
            setBackups(result)
        } else {
            setError('Failed to load backups.')
            setTimeout(() => setError(null), 6000)
        }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const filtered = filter.trim()
        ? backups.filter(b => b.database_name?.toLowerCase().includes(filter.toLowerCase()))
        : backups

    const completed  = backups.filter(b => b.status === 'completed')
    const failed     = backups.filter(b => b.status === 'failed')
    const totalBytes = completed.reduce((acc, b) => acc + (b.file_size_bytes || 0), 0)

    return (
        <PageShell title="Backups" description="Browse and download recent database backups.">
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {loading && backups.length === 0 ? (
                <StatRowSkeleton count={3} />
            ) : (
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-sm border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Total Backups</p>
                        <AnimatedNumber value={backups.length} className="text-2xl font-semibold mt-1 block" />
                    </div>
                    <div className="rounded-sm border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Success / Failed</p>
                        <p className="text-2xl font-semibold tabular-nums font-mono mt-1">
                            {completed.length}
                            <span className="text-muted-foreground font-normal text-base"> / </span>
                            {failed.length}
                        </p>
                    </div>
                    <div className="rounded-sm border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Total Size</p>
                        <AnimatedNumber value={totalBytes} format={formatBytes} className="text-2xl font-semibold mt-1 block" />
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between gap-3">
                <Input
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="Filter by database name..."
                    className="max-w-sm text-sm"
                />
                <Button variant="outline" size="sm" onClick={load} pending={loading} pendingText="Refresh">
                    <i className="fa-solid fa-rotate-right mr-2" />
                    Refresh
                </Button>
            </div>

            <div className="overflow-hidden rounded-sm border border-border bg-card">
                {loading && filtered.length === 0 ? (
                    <TableRowsSkeleton rows={6} cols={6} />
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon="fa-solid fa-clone"
                        title="No backups found"
                        hint={filter.trim() ? 'No backups match your filter.' : 'Create a backup from the Databases page to see it here.'}
                        className="border-0"
                    />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Database</TableHead>
                                <TableHead>File</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
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
                                {filtered.map(bk => (
                                    <motion.tr
                                        key={bk.backup_uuid}
                                        layout
                                        variants={listItem}
                                        exit="exit"
                                        className="border-b border-border transition-colors hover:bg-secondary/50"
                                    >
                                        <TableCell className="font-mono text-xs py-2.5 max-w-[120px] truncate">
                                            {bk.database_name}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs py-2.5 max-w-[180px] truncate text-muted-foreground">
                                            {bk.file_name}
                                        </TableCell>
                                        <TableCell className="text-xs py-2.5 tabular-nums font-mono">
                                            {formatBytes(bk.file_size_bytes)}
                                        </TableCell>
                                        <TableCell className="py-2.5">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[bk.status] ?? STATUS_STYLES.pending}`}>
                                                {bk.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground py-2.5 whitespace-nowrap">
                                            {formatDate(bk.created_at)}
                                        </TableCell>
                                        <TableCell className="text-right pr-4 py-2.5">
                                            {bk.status === 'completed' && (
                                                <Button
                                                    ripple
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => window.open(`/api/backup/${bk.backup_uuid}`, '_blank')}
                                                >
                                                    <i className="fa-solid fa-download mr-1.5" />
                                                    Download
                                                </Button>
                                            )}
                                        </TableCell>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </motion.tbody>
                    </Table>
                )}
            </div>
        </PageShell>
    )
}
