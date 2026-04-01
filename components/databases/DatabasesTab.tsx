'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDatabaseContext } from '@/app/databases/context/DatabaseContext'
import {
    createDatabase, deleteDatabase,
    performBackup, restoreBackup,
    quickgenProvision, getAllRecentBackups,
    getPmaToken
} from '@/app/actions/databases'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { RippleButton } from '@/components/RippleButton'

const DB_TYPE_OPTIONS = [
    { value: 'mysql', label: 'MySQL' },
    { value: 'postgresql', label: 'PostgreSQL (coming soon!)', disabled: true },
    { value: 'nosql', label: 'NoSQL (coming soon!)', disabled: true }
]

type QuickGenResult = {
    database_name: string
    username: string
    password: string
    database_uuid: string
    user_uuid: string
}

type Backup = {
    backup_uuid: string
    database_name: string
    database_uuid: string
    file_name: string
    file_size_bytes: number | null
    status: string
    created_at: string
}

type SortConfig = {
    key: string
    direction: 'asc' | 'desc'
}

function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatBytes(bytes: number | null): string {
    if (!bytes) return 'N/A'
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function DatabasesTab() {
    const { databases, dbUsers, privileges, actorId, loading, refresh } = useDatabaseContext()

    const [newDbName, setNewDbName]           = useState('')
    const [newDbType, setNewDbType]           = useState('mysql')
    const [newDbHosts, setNewDbHosts]         = useState('localhost')
    const [remoteAccess, setRemoteAccess]     = useState(false)
    const [creating, setCreating]             = useState(false)
    const [expressLoading, setExpressLoading] = useState(false)
    const [quickGenResult, setQuickGenResult] = useState<QuickGenResult | null>(null)
    const [restoreDb, setRestoreDb]           = useState<any | null>(null)
    const [restorePath, setRestorePath]       = useState('')
    const [restoreLoading, setRestoreLoading] = useState(false)
    const [error, setError]                   = useState<string | null>(null)
    const [successMsg, setSuccess]            = useState<string | null>(null)
    const [busyKey, setBusyKey]               = useState<string | null>(null)
    const [backups, setBackups]               = useState<Backup[]>([])
    const [backupsLoading, setBackupsLoading] = useState(true)
    const [formCollapsed, setFormCollapsed]   = useState(true)
    const [pmaDb, setPmaDb]                   = useState<any | null>(null)
    const [pmaUsers, setPmaUsers]             = useState<any[]>([])
    const [pmaLoading, setPmaLoading]         = useState(false)
    const [dbSortConfig, setDbSortConfig]     = useState<SortConfig>({ key: 'database_name', direction: 'asc' })
    const [backupSortConfig, setBackupSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' })

    const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000) }
    const err   = (msg: string) => { setError(msg);   setTimeout(() => setError(null), 6000) }

    const loadBackups = useCallback(async () => {
        setBackupsLoading(true)
        const result = await getAllRecentBackups(20)
        if (Array.isArray(result)) {
            setBackups(result)
        }
        setBackupsLoading(false)
    }, [])

    useEffect(() => { loadBackups() }, [loadBackups])

    const usersForDatabase = (dbUuid: string) =>
        privileges.filter((p: any) => p.database_uuid === dbUuid)

    const isValidDbName = (n: string) => /^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(n)
    const effectiveHosts = remoteAccess ? '*' : newDbHosts

    const sortData = (data: any[], sortConfig: SortConfig) => {
        const sorted = [...data].sort((a, b) => {
            const aVal = a[sortConfig.key]
            const bVal = b[sortConfig.key]
            if (aVal === bVal) return 0
            const comparison = aVal < bVal ? -1 : 1
            return sortConfig.direction === 'asc' ? comparison : -comparison
        })
        return sorted
    }

    const handleDbSort = (key: string) => {
        setDbSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }))
    }

    const handleBackupSort = (key: string) => {
        setBackupSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }))
    }

    const sortedDatabases = sortData(databases, dbSortConfig)
    const sortedBackups = sortData(backups, backupSortConfig)

    const handleCreateDb = async () => {
        if (!isValidDbName(newDbName)) { err('Invalid name. Must start with a letter, alphanumeric and underscores only.'); return }
        setCreating(true)
        const res = await createDatabase(newDbType, newDbName, effectiveHosts, actorId)
        if (res.success) {
            setNewDbName(''); setNewDbHosts('localhost'); setRemoteAccess(false)
            await refresh()
            flash(`Database "${newDbName}" created.`)
        } else err(res.error || 'Failed to create database.')
        setCreating(false)
    }

    const handleQuickGenProvision = async () => {
        if (!actorId) { err('No actor ID available.'); return }
        setExpressLoading(true)
        const res = await quickgenProvision(actorId)
        if (res.success) {
            await refresh()
            setQuickGenResult({
                database_name: res.database_name ?? '',
                username: res.username ?? '',
                password: res.password ?? '',
                database_uuid: res.database_uuid ?? '',
                user_uuid: res.user_uuid ?? '',
            })
        } else {
            err(res.error || 'Quick generate failed.')
        }
        setExpressLoading(false)
    }

    const handleDeleteDb = async (db: any) => {
        if (!confirm(`Delete "${db.database_name}"? This is permanent.`)) return
        setBusyKey(`del-db-${db.database_uuid}`)
        const res = await deleteDatabase(db.database_uuid, db.database_name, db.database_type, actorId)
        if (res.success) { await refresh(); flash(`"${db.database_name}" deleted.`) }
        else err(res.error || 'Failed to delete.')
        setBusyKey(null)
    }

    const handleBackup = async (db: any) => {
        setBusyKey(`bk-${db.database_uuid}`)
        const res = await performBackup(db.database_uuid, db.database_type, db.database_name)
        if (res.success) {
            await loadBackups()
            flash(`Backup complete — ${res.backup_uuid}`)
        } else err(res.error || 'Backup failed.')
        setBusyKey(null)
    }

    const handleRestore = async () => {
        if (!restoreDb || !restorePath.trim()) { err('Backup file path is required.'); return }
        if (!confirm(`Restore "${restoreDb.database_name}"? Existing data will be overwritten.`)) return
        setRestoreLoading(true)
        const res = await restoreBackup(restoreDb.database_uuid, restoreDb.database_type, restoreDb.database_name, restorePath.trim())
        if (res.success) { setRestorePath(''); setRestoreDb(null); flash('Restore completed.') }
        else err(res.error || 'Restore failed.')
        setRestoreLoading(false)
    }

    const handlePmaClick = async (db: any) => {
        const attached = usersForDatabase(db.database_uuid)
        if (attached.length === 0) { err('No users are attached to this database.'); return }
        if (attached.length === 1) { await redirectToPma(attached[0].user_uuid); return }
        setPmaDb(db)
        setPmaUsers(attached)
    }

    const redirectToPma = async (userUuid: string) => {
        setPmaLoading(true)
        const res = await getPmaToken(userUuid)
        setPmaLoading(false)
        if (!res.success || !res.token) { err('Failed to generate login token.'); return }
        setPmaDb(null)
        setPmaUsers([])
        window.open(`https://pma.arvo.team/nydus_signon.php?server=2&token=${res.token}`, '_blank')
    }

    const handleDownloadBackup = async (backup: Backup) => {
        try {
            const response = await fetch(`/api/backup/${backup.backup_uuid}`)
            if (!response.ok) { err('Download failed'); return }
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = backup.file_name || `backup_${backup.backup_uuid}.sql.gz`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
        } catch (e) {
            err('Failed to download backup')
        }
    }

    return (
        <TooltipProvider>
        <div className="space-y-4">

            {error && (
                <Alert className="bg-red-950/30 border-red-900/50 text-red-200 text-xs font-bold">
                    <i className="fa-solid fa-triangle-exclamation mr-2" />{error}
                </Alert>
            )}
            {successMsg && (
                <Alert className="bg-emerald-950/30 border-emerald-900/50 text-emerald-200 text-xs font-bold">
                    <i className="fa-solid fa-circle-check mr-2" />{successMsg}
                </Alert>
            )}

            <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                    <Card className="p-6 border-border bg-card">
                        <button
                            onClick={() => setFormCollapsed(!formCollapsed)}
                            className="w-full text-left flex items-center justify-between mb-4 group hover:opacity-80 transition-opacity"
                        >
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                                <i className="fa-solid fa-database mr-2 text-primary" />
                                Create Database
                            </h3>
                            <i className={`fa-solid fa-chevron-${formCollapsed ? 'down' : 'up'} text-muted-foreground group-hover:text-foreground transition-colors`} />
                        </button>

                        {!formCollapsed && (
                            <>
                                <div className="space-y-4">
                                    <div className="flex gap-3">
                                        <div className="w-40 shrink-0">
                                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2 tracking-widest">Engine</label>
                                            <select
                                                value={newDbType}
                                                onChange={e => setNewDbType(e.target.value)}
                                                className="w-full bg-secondary border border-border text-foreground text-sm p-2 focus:border-primary outline-none transition-all disabled:opacity-50"
                                            >
                                                {DB_TYPE_OPTIONS.map(t => (
                                                    <option key={t.value} value={t.value} disabled={t.disabled}>
                                                        {t.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2 tracking-widest">
                                                Database Name
                                                <span className="text-muted-foreground/60 ml-1">(letters, numbers, _ only)</span>
                                            </label>
                                            <Input
                                                value={newDbName}
                                                onChange={e => setNewDbName(e.target.value.trim())}
                                                placeholder="e.g. app_development"
                                                className="bg-background border-border font-mono text-sm focus:border-primary"
                                            />
                                            {newDbName.length > 0 && !isValidDbName(newDbName) &&
                                                <p className="text-red-400 text-xs mt-1">Invalid name format</p>
                                            }
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Allowed Hosts</label>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-2 cursor-help">
                                                        <Switch checked={remoteAccess} onCheckedChange={setRemoteAccess} />
                                                        <span className="text-xs text-muted-foreground">Allow remote</span>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="text-[10px]">Allow connections from any host</TooltipContent>
                                            </Tooltip>
                                        </div>
                                        {remoteAccess ? (
                                            <div className="h-9 flex items-center rounded bg-secondary border border-border px-3 text-sm text-muted-foreground font-mono">
                                                * — all hosts permitted
                                            </div>
                                        ) : (
                                            <Input
                                                value={newDbHosts}
                                                onChange={e => setNewDbHosts(e.target.value.trim())}
                                                placeholder="localhost"
                                                className="bg-background border-border font-mono text-sm focus:border-primary"
                                            />
                                        )}
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <RippleButton
                                            onClick={handleCreateDb}
                                            disabled={!newDbName || !isValidDbName(newDbName) || !actorId || creating}
                                            className="h-10 px-6 flex items-center gap-2"
                                        >
                                            {creating ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-plus" />}
                                            {creating ? 'Creating...' : 'Create Database'}
                                        </RippleButton>
                                    </div>
                                </div>
                            </>
                        )}
                    </Card>
                </div>

                <div className="w-80 shrink-0 flex flex-col">
                    <Card className="p-6 border-border bg-card flex flex-col h-full">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-2">
                            <i className="fa-solid fa-bolt mr-2 text-primary" />
                            Quick Generate
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                            Auto-provision a database and user with remote access and random credentials.
                        </p>
                        <RippleButton
                            onClick={handleQuickGenProvision}
                            disabled={!actorId || expressLoading}
                            className="w-full flex-1 flex items-center justify-center gap-2 mt-auto"
                        >
                            {expressLoading
                                ? <><i className="fa-solid fa-spinner fa-spin" />Provisioning...</>
                                : <><i className="fa-solid fa-magic" />Generate Now</>
                            }
                        </RippleButton>
                    </Card>
                </div>
            </div>

            {restoreDb && (
                <Card className="p-6 border-border bg-card">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                        <i className="fa-solid fa-rotate-left mr-2 text-primary" />
                        Restore — <span className="font-mono text-muted-foreground">{restoreDb.database_name}</span>
                    </p>
                    <div className="flex gap-2 items-center">
                        <Input
                            value={restorePath}
                            onChange={e => setRestorePath(e.target.value.trim())}
                            placeholder="/var/backups/nydus/mysql/db_20260101.sql.gz"
                            className="flex-1 font-mono text-xs bg-background border-border focus:border-primary"
                        />
                        <RippleButton
                            onClick={handleRestore}
                            disabled={!restorePath || restoreLoading}
                            className="h-9 px-4 flex items-center gap-2 shrink-0"
                        >
                            {restoreLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-check" />}
                            {restoreLoading ? 'Restoring' : 'Restore'}
                        </RippleButton>
                        <RippleButton
                            variant="outline"
                            onClick={() => { setRestoreDb(null); setRestorePath('') }}
                            className="h-9 px-4 shrink-0"
                        >
                            Cancel
                        </RippleButton>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-2">
                    <p className="text-sm font-bold text-foreground uppercase tracking-wider">
                        <i className="fa-solid fa-table-cells-large mr-2 text-primary" />
                        All Databases
                    </p>
                    <Card className="border-border bg-card overflow-hidden">
                        {loading && databases.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-xs">Loading databases...</div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-secondary border-b border-border">
                                    <TableRow className="border-border">
                                        <TableHead className="font-bold text-foreground uppercase text-xs cursor-pointer hover:text-primary transition-colors" onClick={() => handleDbSort('database_name')}>
                                            <i className={`fa-solid fa-arrows-sort-${dbSortConfig.key === 'database_name' ? (dbSortConfig.direction === 'asc' ? 'up' : 'down') : 'up-down'} mr-1`} />
                                            Name
                                        </TableHead>
                                        <TableHead className="font-bold text-foreground uppercase text-xs cursor-pointer hover:text-primary transition-colors w-20" onClick={() => handleDbSort('database_type')}>
                                            <i className={`fa-solid fa-arrows-sort-${dbSortConfig.key === 'database_type' ? (dbSortConfig.direction === 'asc' ? 'up' : 'down') : 'up-down'} mr-1`} />
                                            Engine
                                        </TableHead>
                                        <TableHead className="font-bold text-foreground uppercase text-xs cursor-pointer hover:text-primary transition-colors" onClick={() => handleDbSort('allowed_hosts')}>
                                            <i className={`fa-solid fa-arrows-sort-${dbSortConfig.key === 'allowed_hosts' ? (dbSortConfig.direction === 'asc' ? 'up' : 'down') : 'up-down'} mr-1`} />
                                            Hosts
                                        </TableHead>
                                        <TableHead className="font-bold text-foreground uppercase text-xs text-center w-12">Users</TableHead>
                                        <TableHead className="font-bold text-foreground uppercase text-xs text-right pr-4">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedDatabases.map((db: any) => (
                                        <TableRow key={db.database_uuid} className="border-b border-border hover:bg-secondary/50 transition-colors">
                                            <TableCell className="font-mono text-sm font-semibold text-foreground py-2.5 max-w-xs">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="truncate block">{db.database_name}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="text-[10px]">{db.database_name}</TooltipContent>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell className="py-2.5">
                                                <Badge variant="secondary" className="font-mono uppercase text-xs">{db.database_type}</Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground py-2.5">
                                                {db.allowed_hosts === '*' || db.allowed_hosts === '%' ? 'All' : db.allowed_hosts}
                                            </TableCell>
                                            <TableCell className="text-center py-2.5 text-xs text-muted-foreground tabular-nums">
                                                <button
                                                    onClick={() => {
                                                        const users = usersForDatabase(db.database_uuid)
                                                        if (users.length === 0) { err('No users attached'); return }
                                                        setPmaUsers(users)
                                                        setPmaDb(db)
                                                    }}
                                                    className="hover:text-primary transition-colors cursor-pointer"
                                                >
                                                    {usersForDatabase(db.database_uuid).length}
                                                </button>
                                            </TableCell>
                                            <TableCell className="text-right pr-4 py-2.5">
                                                <div className="flex justify-end gap-1 items-center">
                                                    {db.database_type === 'mysql' && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <RippleButton
                                                                    variant="outline"
                                                                    onClick={() => handlePmaClick(db)}
                                                                    disabled={usersForDatabase(db.database_uuid).length === 0}
                                                                    className="h-7 px-2 text-[10px]"
                                                                >
                                                                    <i className="fa-solid fa-table-cells" />
                                                                </RippleButton>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="text-[10px]">phpMyAdmin</TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <RippleButton
                                                                variant="outline"
                                                                onClick={() => handleBackup(db)}
                                                                disabled={busyKey === `bk-${db.database_uuid}`}
                                                                className="h-7 px-2 text-[10px]"
                                                            >
                                                                {busyKey === `bk-${db.database_uuid}`
                                                                    ? <i className="fa-solid fa-spinner fa-spin" />
                                                                    : <i className="fa-solid fa-database" />}
                                                            </RippleButton>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-[10px]">Create backup</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <RippleButton
                                                                variant="outline"
                                                                onClick={() => { setRestoreDb(db); setRestorePath('') }}
                                                                className="h-7 px-2 text-[10px]"
                                                            >
                                                                <i className="fa-solid fa-arrow-rotate-left" />
                                                            </RippleButton>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-[10px]">Restore backup</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <RippleButton
                                                                variant="outline"
                                                                onClick={() => handleDeleteDb(db)}
                                                                disabled={busyKey === `del-db-${db.database_uuid}`}
                                                                className="h-7 px-2 text-[10px] text-destructive hover:text-destructive"
                                                            >
                                                                {busyKey === `del-db-${db.database_uuid}`
                                                                    ? <i className="fa-solid fa-spinner fa-spin" />
                                                                    : <i className="fa-solid fa-trash" />}
                                                            </RippleButton>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-[10px]">Delete database</TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {sortedDatabases.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="px-6 py-10 text-center text-muted-foreground text-xs italic">
                                                No databases provisioned yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </Card>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-foreground uppercase tracking-wider">
                            <i className="fa-solid fa-save mr-2 text-primary" />
                            Recent Backups
                        </p>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button onClick={loadBackups} disabled={backupsLoading} className="text-muted-foreground hover:text-foreground transition-colors">
                                    <i className={`fa-solid fa-rotate-right ${backupsLoading ? 'fa-spin' : ''}`} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">Refresh backups</TooltipContent>
                        </Tooltip>
                    </div>
                    <Card className="border-border bg-card overflow-hidden">
                        <Table>
                            <TableHeader className="bg-secondary border-b border-border">
                                <TableRow className="border-border">
                                    <TableHead className="font-bold text-foreground uppercase text-xs cursor-pointer hover:text-primary transition-colors" onClick={() => handleBackupSort('database_name')}>
                                        <i className={`fa-solid fa-arrows-sort-${backupSortConfig.key === 'database_name' ? (backupSortConfig.direction === 'asc' ? 'up' : 'down') : 'up-down'} mr-1`} />
                                        Database
                                    </TableHead>
                                    <TableHead className="font-bold text-foreground uppercase text-xs cursor-pointer hover:text-primary transition-colors" onClick={() => handleBackupSort('file_size_bytes')}>
                                        <i className={`fa-solid fa-arrows-sort-${backupSortConfig.key === 'file_size_bytes' ? (backupSortConfig.direction === 'asc' ? 'up' : 'down') : 'up-down'} mr-1`} />
                                        Size
                                    </TableHead>
                                    <TableHead className="font-bold text-foreground uppercase text-xs text-right pr-3">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {backupsLoading && backups.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">
                                            Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : backups.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">
                                            No backups yet.
                                        </TableCell>
                                    </TableRow>
                                ) : sortedBackups.map((bk) => (
                                    <TableRow key={bk.backup_uuid} className="border-b border-border hover:bg-secondary/50 transition-colors">
                                        <TableCell className="font-mono text-xs py-2.5 max-w-[90px] truncate">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span>{bk.database_name}</span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="text-[10px]">{bk.database_name}</TooltipContent>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground py-2.5 tabular-nums">
                                            {formatBytes(bk.file_size_bytes)}
                                        </TableCell>
                                        <TableCell className="text-right pr-3 py-2.5">
                                            {bk.status === 'completed' ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <RippleButton
                                                            variant="outline"
                                                            onClick={() => handleDownloadBackup(bk)}
                                                            className="h-6 px-2 text-[10px]"
                                                        >
                                                            <i className="fa-solid fa-download" />
                                                        </RippleButton>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="text-[10px]">Download backup</TooltipContent>
                                                </Tooltip>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">{bk.status}</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            </div>

            <Dialog open={!!quickGenResult} onOpenChange={open => { if (!open) setQuickGenResult(null) }}>
                <DialogContent className="bg-card border-border max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold uppercase tracking-wider">
                            <i className="fa-solid fa-check-circle mr-2 text-emerald-400" />
                            Database Provisioned
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-2">
                            Save these credentials now. The password will not be shown again.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Database name</p>
                            <p className="font-mono text-sm bg-secondary rounded px-3 py-2 select-all text-foreground border border-border">
                                {quickGenResult?.database_name}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Username</p>
                            <p className="font-mono text-sm bg-secondary rounded px-3 py-2 select-all text-foreground border border-border">
                                {quickGenResult?.username}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Password</p>
                            <p className="font-mono text-sm bg-secondary rounded px-3 py-2 select-all text-foreground border border-border break-all">
                                {quickGenResult?.password}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <RippleButton onClick={() => setQuickGenResult(null)} className="h-9 px-6">
                            <i className="fa-solid fa-check mr-2" />
                            Done
                        </RippleButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!pmaDb} onOpenChange={open => { if (!open) { setPmaDb(null); setPmaUsers([]) } }}>
                <DialogContent className="bg-card border-border max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold uppercase tracking-wider">
                            <i className="fa-solid fa-table-cells mr-2 text-orange-400" />
                            Open phpMyAdmin
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-muted-foreground mb-4">
                        Multiple users are attached to <span className="font-mono text-foreground">{pmaDb?.database_name}</span>. Select which account to log in with.
                    </p>
                    <div className="space-y-2">
                        {pmaUsers.map((p: any) => (
                            <button
                                key={p.user_uuid}
                                onClick={() => redirectToPma(p.user_uuid)}
                                disabled={pmaLoading}
                                className="w-full flex items-center justify-between px-4 py-3 bg-secondary hover:bg-border border border-border transition-colors text-left disabled:opacity-50 cursor-pointer"
                            >
                                <div>
                                    <p className="text-xs font-bold text-foreground uppercase tracking-wider">{p.username}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{p.user_uuid}</p>
                                </div>
                                {pmaLoading
                                    ? <i className="fa-solid fa-spinner fa-spin text-muted-foreground" />
                                    : <i className="fa-solid fa-arrow-up-right-from-square text-muted-foreground" />}
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
        </TooltipProvider>
    )
}