'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatRowSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { PageShell } from '@/components/PageShell'
import { Section } from '@/components/ui/section'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/StatusBadge'
import { AnimatedNumber } from '@/components/AnimatedNumber'
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

    const columns: Column<Backup>[] = [
        {
            key: 'database',
            header: 'Database',
            render: (bk) => (
                <span className="block max-w-[140px] truncate font-mono text-xs text-foreground">{bk.database_name}</span>
            ),
        },
        {
            key: 'file',
            header: 'File',
            render: (bk) => (
                <span className="block max-w-[200px] truncate font-mono text-xs text-muted-foreground">{bk.file_name}</span>
            ),
        },
        {
            key: 'size',
            header: 'Size',
            render: (bk) => (
                <span className="font-mono text-xs tabular-nums">{formatBytes(bk.file_size_bytes)}</span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (bk) => <StatusBadge status={bk.status} />,
        },
        {
            key: 'created',
            header: 'Created',
            render: (bk) => (
                <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(bk.created_at)}</span>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (bk) => (
                bk.status === 'completed' ? (
                    <Button
                        ripple
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/api/backup/${bk.backup_uuid}`, '_blank')}
                    >
                        <i className="fa-solid fa-download" /> Download
                    </Button>
                ) : <span className="text-xs text-muted-foreground/50">—</span>
            ),
        },
    ]

    return (
        <PageShell
            title="Backups"
            description="Browse and download recent database backups."
            actions={
                <Button variant="outline" size="sm" onClick={load} pending={loading} pendingText="Refreshing…">
                    <i className="fa-solid fa-rotate" /> Refresh
                </Button>
            }
        >
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {loading && backups.length === 0 ? (
                <StatRowSkeleton count={3} />
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Section bodyClassName="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total backups</p>
                        <AnimatedNumber value={backups.length} className="mt-2 block text-2xl font-semibold" />
                    </Section>
                    <Section bodyClassName="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Success / Failed</p>
                        <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
                            <span className="text-green-500">{completed.length}</span>
                            <span className="text-base font-normal text-muted-foreground"> / </span>
                            <span className="text-red-500">{failed.length}</span>
                        </p>
                    </Section>
                    <Section bodyClassName="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total size</p>
                        <AnimatedNumber value={totalBytes} format={formatBytes} className="mt-2 block text-2xl font-semibold" />
                    </Section>
                </div>
            )}

            <Section
                title="Recent backups"
                description="Most recent backups across your databases"
                icon="fa-solid fa-clone"
                flush
                actions={
                    <Input
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder="Filter by database…"
                        className="h-8 w-44 sm:w-64"
                    />
                }
            >
                <DataTable
                    columns={columns}
                    rows={filtered}
                    getRowId={(bk) => bk.backup_uuid}
                    loading={loading}
                    skeletonRows={6}
                    empty={
                        <EmptyState
                            icon="fa-solid fa-clone"
                            title={filter.trim() ? 'No matching backups' : 'No backups yet'}
                            hint={filter.trim() ? 'No backups match your filter.' : 'Create a backup from the Databases page to see it here.'}
                            action={
                                !filter.trim() ? (
                                    <Button asChild variant="outline" size="sm">
                                        <Link href="/databases">Go to Databases</Link>
                                    </Button>
                                ) : undefined
                            }
                        />
                    }
                />
            </Section>
        </PageShell>
    )
}
