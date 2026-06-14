'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useDatabaseContext } from '@/app/databases/context/DatabaseContext'
import {
    createDatabase, deleteDatabase,
    performBackup, restoreBackup,
    quickgenProvision, getPmaToken
} from '@/app/actions/databases'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableRowsSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { PageShell } from '@/components/PageShell'
import { staggerContainer, listItem } from '@/lib/motion'

const DB_TYPE_OPTIONS = ['mysql', 'PostgreSQL (coming soon!)', 'NoSQL (coming soon!)']

type QuickGenResult = {
    database_name: string
    username: string
    password: string
    database_uuid: string
    user_uuid: string
}

export default function DatabasesTab() {
    const { databases, privileges, actorId, loading, refresh } = useDatabaseContext()

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
    const [backups, setBackups]               = useState<any[]>([])

    const [formCollapsed, setFormCollapsed]   = useState(true)
    const [dbSortCol, setDbSortCol]           = useState('name')
    const [dbSortAsc, setDbSortAsc]           = useState(true)
    const [bkSortCol, setBkSortCol]           = useState('created')
    const [bkSortAsc, setBkSortAsc]           = useState(false)
    const [showUsersList, setShowUsersList]   = useState<string | null>(null)
    const [pmaDb, setPmaDb]                   = useState<any | null>(null)
    const [pmaUsers, setPmaUsers]             = useState<any[]>([])
    const [pmaLoading, setPmaLoading]         = useState(false)

    const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000) }
    const err   = (msg: string) => { setError(msg);   setTimeout(() => setError(null), 6000) }

    const usersForDatabase = (dbUuid: string) =>
        privileges.filter((p: any) => p.database_uuid === dbUuid)

    const isValidDbName = (n: string) => /^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(n)
    const effectiveHosts = remoteAccess ? '*' : newDbHosts

    const sortByColumn = (items: any[], col: string, asc: boolean) => {
        return [...items].sort((a, b) => {
            let aVal = col === 'created' ? a.created_at : a['database_' + col] || a[col]
            let bVal = col === 'created' ? b.created_at : b['database_' + col] || b[col]
            if (typeof aVal === 'string') {
                return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
            }
            return asc ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1)
        })
    }

    const handlePmaClick = async (db: any) => {
        const attached = usersForDatabase(db.database_uuid)
        if (attached.length === 0) { err('No users are attached to this database.'); return }
        if (attached.length === 1) {
            setPmaLoading(true)
            const res = await getPmaToken(attached[0].user_uuid)
            setPmaLoading(false)
            if (!res.success || !res.token) { err('Failed to generate login token.'); return }
            window.open(`https://pma.arvo.team/nydus_signon.php?server=2&token=${res.token}`, '_blank')
            return
        }
        setPmaDb(db)
        setPmaUsers(attached)
    }

    const handlePmaUserSelect = async (userUuid: string) => {
        setPmaLoading(true)
        const res = await getPmaToken(userUuid)
        setPmaLoading(false)
        if (!res.success || !res.token) { err('Failed to generate login token.'); return }
        setPmaDb(null)
        setPmaUsers([])
        window.open(`https://pma.arvo.team/nydus_signon.php?server=2&token=${res.token}`, '_blank')
    }

    const handleDownloadBackup = async (backupUuid: string) => {
        const link = document.createElement('a')
        link.href = `/api/backup/${backupUuid}`
        link.download = `backup_${backupUuid}.sql.gz`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

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
            setBackups(prev => [
                { uuid: res.backup_uuid, database_name: db.database_name, database_uuid: db.database_uuid, created_at: new Date().toISOString() },
                ...prev
            ])
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

    const formatDate = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    return (
        <TooltipProvider>
        <PageShell title="Databases" description="Provision databases, run backups, and manage access.">

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
                {/* Left Column */}
                <div className="flex-1 space-y-4">
                    {/* New Database Card */}
                    <div className="rounded-sm border border-border bg-card">
                        <div className="flex items-center justify-between border-b border-border p-4 cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => setFormCollapsed(!formCollapsed)}>
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">New Database</h3>
                            <i className={`fa-solid ${formCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'} text-xs text-muted-foreground`} />
                        </div>
                        {!formCollapsed && (
                        <div className="p-4 sm:p-6 space-y-4">
                            <div className="flex gap-3">
                                <div className="w-28 shrink-0">
                                    <label className="block text-xs text-muted-foreground mb-1.5">Engine</label>
                                    <select
                                        value={newDbType}
                                        onChange={e => setNewDbType(e.target.value)}
                                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                    >
                                        {DB_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-muted-foreground mb-1.5">
                                        Database name <span className="text-muted-foreground">(letters, numbers, _, - only)</span>
                                        {newDbName.length > 0 && !isValidDbName(newDbName) &&
                                            <span className="text-destructive ml-2">(invalid)</span>}
                                    </label>
                                    <Input
                                        value={newDbName}
                                        onChange={e => setNewDbName(e.target.value.trim())}
                                        placeholder="e.g. app_development"
                                        className="font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs text-muted-foreground">Allowed hosts</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Allow all remote</span>
                                        <Switch checked={remoteAccess} onCheckedChange={setRemoteAccess} />
                                    </div>
                                </div>
                                {remoteAccess ? (
                                    <div className="h-9 flex items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground font-mono">
                                        % — all hosts permitted
                                    </div>
                                ) : (
                                    <Input
                                        value={newDbHosts}
                                        onChange={e => setNewDbHosts(e.target.value.trim())}
                                        placeholder="localhost"
                                        className="font-mono"
                                    />
                                )}
                            </div>

                            <div className="flex justify-end pt-1">
                                <Button
                                    variant="outline"
                                    onClick={handleCreateDb}
                                    disabled={!newDbName || !isValidDbName(newDbName) || !actorId}
                                    pending={creating}
                                    pendingText="Creating..."
                                >
                                    Create database
                                </Button>
                            </div>
                        </div>
                    )}
                    </div>

                    {/* Databases Table */}
                    <div className="rounded-sm border border-border bg-card">
                        <div className="flex items-center justify-between border-b border-border p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Databases</p>
                        </div>
                        {loading && databases.length === 0 ? (
                            <TableRowsSkeleton rows={5} cols={5} />
                        ) : databases.length === 0 ? (
                            <EmptyState
                                icon="fa-solid fa-database"
                                title="No databases provisioned yet"
                                hint="Create a database above or use Quick Generate to get started."
                                className="border-0"
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="cursor-pointer hover:bg-secondary/50" onClick={() => {
                                            if (dbSortCol === 'name') setDbSortAsc(!dbSortAsc)
                                            else { setDbSortCol('name'); setDbSortAsc(true) }
                                        }}>
                                            Name {dbSortCol === 'name' && <i className={`fa-solid fa-chevron-${dbSortAsc ? 'up' : 'down'} text-xs ml-1 inline`} />}
                                        </TableHead>
                                        <TableHead className="w-20 cursor-pointer hover:bg-secondary/50" onClick={() => {
                                            if (dbSortCol === 'type') setDbSortAsc(!dbSortAsc)
                                            else { setDbSortCol('type'); setDbSortAsc(true) }
                                        }}>
                                            Engine {dbSortCol === 'type' && <i className={`fa-solid fa-chevron-${dbSortAsc ? 'up' : 'down'} text-xs ml-1 inline`} />}
                                        </TableHead>
                                        <TableHead className="cursor-pointer hover:bg-secondary/50" onClick={() => {
                                            if (dbSortCol === 'hosts') setDbSortAsc(!dbSortAsc)
                                            else { setDbSortCol('hosts'); setDbSortAsc(true) }
                                        }}>
                                            Hosts {dbSortCol === 'hosts' && <i className={`fa-solid fa-chevron-${dbSortAsc ? 'up' : 'down'} text-xs ml-1 inline`} />}
                                        </TableHead>
                                        <TableHead className="w-16 text-center cursor-pointer hover:bg-secondary/50" onClick={() => {
                                            if (dbSortCol === 'users') setDbSortAsc(!dbSortAsc)
                                            else { setDbSortCol('users'); setDbSortAsc(true) }
                                        }}>
                                            Users {dbSortCol === 'users' && <i className={`fa-solid fa-chevron-${dbSortAsc ? 'up' : 'down'} text-xs ml-1 inline`} />}
                                        </TableHead>
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
                                        {sortByColumn(databases, dbSortCol, dbSortAsc).map((db: any) => (
                                            <motion.tr
                                                key={db.database_uuid}
                                                layout
                                                variants={listItem}
                                                exit="exit"
                                                className="border-b border-border transition-colors hover:bg-secondary/50"
                                            >
                                                <TableCell className="font-mono text-sm py-2.5">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="truncate block max-w-xs">{db.database_name}</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">{db.database_name}</TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell className="py-2.5">
                                                    <Badge variant="secondary" className="font-normal uppercase text-xs">
                                                        {db.database_type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground py-2.5">
                                                    {db.allowed_hosts === '*' || db.allowed_hosts === '%'
                                                        ? 'All'
                                                        : db.allowed_hosts}
                                                </TableCell>
                                                <TableCell className="text-center py-2.5 text-xs text-muted-foreground tabular-nums cursor-pointer hover:text-foreground" onClick={() => setShowUsersList(db.database_uuid)}>
                                                    {usersForDatabase(db.database_uuid).length}
                                                </TableCell>
                                                <TableCell className="text-right pr-4 py-2.5">
                                                    <div className="flex justify-end gap-1 items-center">
                                                        {db.database_type === 'mysql' && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="icon"
                                                                            onClick={() => handlePmaClick(db)}
                                                                            disabled={usersForDatabase(db.database_uuid).length === 0 || pmaLoading}
                                                                            pending={pmaLoading}
                                                                            className="h-7 w-7"
                                                                        >
                                                                            <i className="fa-solid fa-table" />
                                                                        </Button>
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top">phpMyAdmin</TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="icon"
                                                                        onClick={() => handleBackup(db)}
                                                                        pending={busyKey === `bk-${db.database_uuid}`}
                                                                        className="h-7 w-7"
                                                                    >
                                                                        <i className="fa-solid fa-save" />
                                                                    </Button>
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">Create backup</TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="icon"
                                                                        onClick={() => { setRestoreDb(db); setRestorePath('') }}
                                                                        className="h-7 w-7"
                                                                    >
                                                                        <i className="fa-solid fa-undo" />
                                                                    </Button>
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">Restore from backup</TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="icon"
                                                                        onClick={() => handleDeleteDb(db)}
                                                                        pending={busyKey === `del-db-${db.database_uuid}`}
                                                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                                                    >
                                                                        <i className="fa-solid fa-trash" />
                                                                    </Button>
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">Delete database</TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                </TableCell>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </motion.tbody>
                            </Table>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="w-full lg:w-80 space-y-4">
                    {/* Quick Generate Card */}
                    <div className="flex flex-col rounded-sm border border-border bg-card">
                        <div className="p-4 sm:p-6">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quick Generate</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                                Provisions a database and dedicated user with remote access enabled. Name, credentials, and password are auto-generated.
                            </p>
                        </div>
                        <Separator />
                        <div className="flex-1 flex flex-col justify-center p-4 pt-5 gap-3">
                            <Button
                                ripple
                                variant="outline"
                                onClick={handleQuickGenProvision}
                                disabled={!actorId}
                                pending={expressLoading}
                                pendingText="Provisioning..."
                                className="w-full h-12"
                            >
                                <i className="fa-solid fa-bolt mr-2" />Quick Generate
                            </Button>
                        </div>
                    </div>

                    {/* Recent Backups Card */}
                    <div className="rounded-sm border border-border bg-card">
                        <div className="flex items-center justify-between border-b border-border p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recent Backups</p>
                        </div>
                        {backups.length === 0 ? (
                            <EmptyState
                                icon="fa-solid fa-clone"
                                title="No backups yet"
                                hint="Backups you create this session appear here."
                                className="border-0"
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="cursor-pointer hover:bg-secondary/50" onClick={() => {
                                            if (bkSortCol === 'database_name') setBkSortAsc(!bkSortAsc)
                                            else { setBkSortCol('database_name'); setBkSortAsc(true) }
                                        }}>
                                            Database {bkSortCol === 'database_name' && <i className={`fa-solid fa-chevron-${bkSortAsc ? 'up' : 'down'} text-xs ml-1 inline`} />}
                                        </TableHead>
                                        <TableHead className="cursor-pointer hover:bg-secondary/50" onClick={() => {
                                            if (bkSortCol === 'created') setBkSortAsc(!bkSortAsc)
                                            else { setBkSortCol('created'); setBkSortAsc(true) }
                                        }}>
                                            Date {bkSortCol === 'created' && <i className={`fa-solid fa-chevron-${bkSortAsc ? 'up' : 'down'} text-xs ml-1 inline`} />}
                                        </TableHead>
                                        <TableHead className="text-right pr-4">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <motion.tbody
                                    className="[&_tr:last-child]:border-0"
                                    variants={staggerContainer}
                                    initial="hidden"
                                    animate="show"
                                >
                                    <AnimatePresence initial={false}>
                                        {sortByColumn(backups, bkSortCol, bkSortAsc).map((bk: any) => (
                                            <motion.tr
                                                key={bk.uuid}
                                                layout
                                                variants={listItem}
                                                exit="exit"
                                                className="border-b border-border transition-colors hover:bg-secondary/50"
                                            >
                                                <TableCell className="font-mono text-xs py-2.5 max-w-[90px] truncate">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="truncate block">{bk.database_name}</span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">{bk.database_name}</TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground py-2.5 whitespace-nowrap">
                                                    {formatDate(bk.created_at)}
                                                </TableCell>
                                                <TableCell className="text-right pr-4 py-2.5">
                                                    <div className="flex justify-end gap-1">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="icon"
                                                                        onClick={() => handleDownloadBackup(bk.uuid)}
                                                                        className="h-6 w-6"
                                                                    >
                                                                        <i className="fa-solid fa-download" />
                                                                    </Button>
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">Download backup</TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="icon"
                                                                        onClick={() => {
                                                                            const db = databases.find((d: any) => d.database_uuid === bk.database_uuid)
                                                                            if (db) { setRestoreDb(db); setRestorePath('') }
                                                                        }}
                                                                        className="h-6 w-6"
                                                                    >
                                                                        <i className="fa-solid fa-undo" />
                                                                    </Button>
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">Restore</TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                </TableCell>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </motion.tbody>
                            </Table>
                        )}
                    </div>
                </div>
            </div>

            {restoreDb && (
                <div className="rounded-sm border border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border p-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Restore — <span className="font-mono normal-case tracking-normal text-foreground">{restoreDb.database_name}</span>
                        </h3>
                    </div>
                    <div className="p-4 sm:p-6">
                        <div className="flex gap-2 items-center">
                            <Input
                                value={restorePath}
                                onChange={e => setRestorePath(e.target.value.trim())}
                                placeholder="/var/backups/nydus/mysql/db_20260101.dump"
                                className="flex-1 font-mono text-xs"
                            />
                            <Button
                                variant="outline"
                                onClick={handleRestore}
                                disabled={!restorePath}
                                pending={restoreLoading}
                                pendingText="Restoring..."
                                className="shrink-0"
                            >
                                Restore
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => { setRestoreDb(null); setRestorePath('') }}
                                className="shrink-0"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Dialog open={!!quickGenResult} onOpenChange={open => { if (!open) setQuickGenResult(null) }}>
                <DialogContent className="sm:max-w-md shadow-none">
                    <DialogHeader>
                        <DialogTitle>Database provisioned</DialogTitle>
                        <DialogDescription>
                            Save these credentials now. The password will not be shown again.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1.5">Database name</p>
                            <p className="font-mono text-sm bg-muted rounded-md px-3 py-2 select-all">
                                {quickGenResult?.database_name}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1.5">Username</p>
                            <p className="font-mono text-sm bg-muted rounded-md px-3 py-2 select-all">
                                {quickGenResult?.username}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1.5">Password</p>
                            <p className="font-mono text-sm bg-muted rounded-md px-3 py-2 select-all break-all">
                                {quickGenResult?.password}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQuickGenResult(null)}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!showUsersList} onOpenChange={open => { if (!open) setShowUsersList(null) }}>
                <DialogContent className="sm:max-w-md shadow-none">
                    <DialogHeader>
                        <DialogTitle>Database Users</DialogTitle>
                        <DialogDescription>
                            Users assigned to this database
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        {usersForDatabase(showUsersList || '').map((u: any) => (
                            <div key={u.user_uuid} className="flex items-center justify-between p-2 rounded border border-border bg-secondary/30">
                                <span className="font-mono text-sm">{u.username}</span>
                                <span className="text-xs text-muted-foreground">{u.privileges}</span>
                            </div>
                        ))}
                        {usersForDatabase(showUsersList || '').length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">No users assigned.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowUsersList(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!pmaDb} onOpenChange={open => { if (!open) { setPmaDb(null); setPmaUsers([]) } }}>
                <DialogContent className="sm:max-w-md shadow-none">
                    <DialogHeader>
                        <DialogTitle>Select User</DialogTitle>
                        <DialogDescription>
                            Choose which user to login with for phpMyAdmin
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        {pmaUsers.map((u: any) => (
                            <Button
                                key={u.user_uuid}
                                variant="outline"
                                onClick={() => handlePmaUserSelect(u.user_uuid)}
                                pending={pmaLoading}
                                pendingText={u.username}
                                className="w-full justify-start font-mono"
                            >
                                {u.username}
                            </Button>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setPmaDb(null); setPmaUsers([]) }}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </PageShell>
        </TooltipProvider>
    )
}
