'use client'

import { useState } from 'react'
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
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/EmptyState'
import { PageShell } from '@/components/PageShell'
import { Section } from '@/components/ui/section'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Field, FormGrid } from '@/components/ui/field'

const DB_TYPE_OPTIONS = ['mysql', 'PostgreSQL (coming soon!)', 'NoSQL (coming soon!)']

type QuickGenResult = {
    database_name: string
    username: string
    password: string
    database_uuid: string
    user_uuid: string
}

type SessionBackup = {
    uuid: string
    database_name: string
    database_uuid: string
    created_at: string
}

/** Sortable DataTable header — keeps the click-to-sort behavior inside the shared table grammar. */
function SortHeader({
    label, col, active, asc, onSort,
}: {
    label: string
    col: string
    active: boolean
    asc: boolean
    onSort: (col: string) => void
}) {
    return (
        <button
            type="button"
            onClick={() => onSort(col)}
            className="inline-flex items-center gap-1 uppercase tracking-widest transition-colors hover:text-foreground"
        >
            {label}
            {active && <i className={`fa-solid fa-chevron-${asc ? 'up' : 'down'} text-[8px]`} />}
        </button>
    )
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
    const [backups, setBackups]               = useState<SessionBackup[]>([])

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
    const nameInvalid = newDbName.length > 0 && !isValidDbName(newDbName)
    const effectiveHosts = remoteAccess ? '*' : newDbHosts

    const sortByColumn = (items: any[], col: string, asc: boolean) => {
        return [...items].sort((a, b) => {
            const aVal = col === 'created' ? a.created_at : a['database_' + col] || a[col]
            const bVal = col === 'created' ? b.created_at : b['database_' + col] || b[col]
            if (typeof aVal === 'string') {
                return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
            }
            return asc ? (aVal > bVal ? 1 : -1) : (bVal > aVal ? 1 : -1)
        })
    }

    const toggleDbSort = (col: string) => {
        if (dbSortCol === col) setDbSortAsc(!dbSortAsc)
        else { setDbSortCol(col); setDbSortAsc(true) }
    }
    const toggleBkSort = (col: string) => {
        if (bkSortCol === col) setBkSortAsc(!bkSortAsc)
        else { setBkSortCol(col); setBkSortAsc(true) }
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
                { uuid: res.backup_uuid as string, database_name: db.database_name, database_uuid: db.database_uuid, created_at: new Date().toISOString() },
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

    const dbColumns: Column<any>[] = [
        {
            key: 'name',
            header: <SortHeader label="Name" col="name" active={dbSortCol === 'name'} asc={dbSortAsc} onSort={toggleDbSort} />,
            render: (db) => (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="block max-w-xs truncate font-mono text-sm text-foreground">{db.database_name}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{db.database_name}</TooltipContent>
                </Tooltip>
            ),
        },
        {
            key: 'type',
            header: <SortHeader label="Engine" col="type" active={dbSortCol === 'type'} asc={dbSortAsc} onSort={toggleDbSort} />,
            render: (db) => (
                <Badge variant="secondary" className="text-[10px] font-normal uppercase">{db.database_type}</Badge>
            ),
        },
        {
            key: 'hosts',
            header: <SortHeader label="Hosts" col="hosts" active={dbSortCol === 'hosts'} asc={dbSortAsc} onSort={toggleDbSort} />,
            render: (db) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {db.allowed_hosts === '*' || db.allowed_hosts === '%'
                        ? <span className="text-amber-500"><i className="fa-solid fa-earth-americas mr-1" />All</span>
                        : db.allowed_hosts}
                </span>
            ),
        },
        {
            key: 'users',
            header: <SortHeader label="Users" col="users" active={dbSortCol === 'users'} asc={dbSortAsc} onSort={toggleDbSort} />,
            align: 'center',
            render: (db) => (
                <button
                    type="button"
                    onClick={() => setShowUsersList(db.database_uuid)}
                    className="font-mono text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground"
                >
                    {usersForDatabase(db.database_uuid).length}
                </button>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (db) => (
                <div className="flex items-center justify-end gap-1.5">
                    {db.database_type === 'mysql' && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePmaClick(db)}
                                        disabled={usersForDatabase(db.database_uuid).length === 0 || pmaLoading}
                                    >
                                        <i className="fa-solid fa-table-cells" />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">Open phpMyAdmin</TooltipContent>
                        </Tooltip>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleBackup(db)}
                                    pending={busyKey === `bk-${db.database_uuid}`}
                                >
                                    <i className="fa-solid fa-cloud-arrow-up" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">Create backup</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setRestoreDb(db); setRestorePath('') }}
                                >
                                    <i className="fa-solid fa-rotate-left" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">Restore from backup</TooltipContent>
                    </Tooltip>
                    <Button
                        variant="outline"
                        tone="inactive"
                        size="sm"
                        onClick={() => handleDeleteDb(db)}
                        pending={busyKey === `del-db-${db.database_uuid}`}
                        pendingText="Delete"
                    >
                        Delete
                    </Button>
                </div>
            ),
        },
    ]

    const backupColumns: Column<SessionBackup>[] = [
        {
            key: 'database_name',
            header: <SortHeader label="Database" col="database_name" active={bkSortCol === 'database_name'} asc={bkSortAsc} onSort={toggleBkSort} />,
            render: (bk) => (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="block max-w-[120px] truncate font-mono text-xs text-foreground">{bk.database_name}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{bk.database_name}</TooltipContent>
                </Tooltip>
            ),
        },
        {
            key: 'created',
            header: <SortHeader label="Date" col="created" active={bkSortCol === 'created'} asc={bkSortAsc} onSort={toggleBkSort} />,
            render: (bk) => (
                <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(bk.created_at)}</span>
            ),
        },
        {
            key: 'actions',
            header: 'Action',
            align: 'right',
            render: (bk) => (
                <div className="flex justify-end gap-1.5">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button variant="outline" size="sm" onClick={() => handleDownloadBackup(bk.uuid)}>
                                    <i className="fa-solid fa-download" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">Download backup</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const db = databases.find((d: any) => d.database_uuid === bk.database_uuid)
                                        if (db) { setRestoreDb(db); setRestorePath('') }
                                    }}
                                >
                                    <i className="fa-solid fa-rotate-left" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">Restore</TooltipContent>
                    </Tooltip>
                </div>
            ),
        },
    ]

    return (
        <TooltipProvider>
        <PageShell
            title="Databases"
            description="Provision databases, run backups, and manage access."
            meta={
                <Badge variant="secondary" className="text-[10px] uppercase">
                    {databases.length} database{databases.length === 1 ? '' : 's'}
                </Badge>
            }
            actions={
                <Button
                    ripple
                    onClick={handleQuickGenProvision}
                    disabled={!actorId}
                    pending={expressLoading}
                    pendingText="Provisioning…"
                >
                    <i className="fa-solid fa-bolt" /> Quick Generate
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

            <Section
                title="New database"
                description="Provision a database. For credentials in one click, use Quick Generate."
                icon="fa-solid fa-plus-circle"
            >
                <div className="space-y-4">
                    <FormGrid cols={2}>
                        <Field label="Engine" htmlFor="db-engine">
                            <Select value={newDbType} onValueChange={setNewDbType}>
                                <SelectTrigger id="db-engine">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DB_TYPE_OPTIONS.map(t => (
                                        <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field
                            label="Database name"
                            htmlFor="db-name"
                            required
                            hint="Letters, numbers and underscores; must start with a letter."
                            error={nameInvalid ? 'Invalid format.' : undefined}
                        >
                            <Input
                                id="db-name"
                                value={newDbName}
                                onChange={e => setNewDbName(e.target.value.trim())}
                                placeholder="e.g. app_development"
                                className="font-mono"
                            />
                        </Field>
                    </FormGrid>

                    <Field
                        label="Allowed hosts"
                        htmlFor="db-hosts"
                        hint="Where clients may connect from."
                    >
                        <div className="flex items-center gap-3">
                            {remoteAccess ? (
                                <div className="flex h-9 flex-1 items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-3 font-mono text-sm text-amber-500">
                                    <i className="fa-solid fa-earth-americas mr-2" />All hosts permitted (%)
                                </div>
                            ) : (
                                <Input
                                    id="db-hosts"
                                    value={newDbHosts}
                                    onChange={e => setNewDbHosts(e.target.value.trim())}
                                    placeholder="localhost"
                                    className="flex-1 font-mono"
                                />
                            )}
                            <label className="flex shrink-0 cursor-pointer items-center gap-2">
                                <span className="text-xs text-muted-foreground">Allow all remote</span>
                                <Switch checked={remoteAccess} onCheckedChange={setRemoteAccess} />
                            </label>
                        </div>
                    </Field>

                    <div className="flex justify-end">
                        <Button
                            ripple
                            onClick={handleCreateDb}
                            disabled={!newDbName || !isValidDbName(newDbName) || !actorId}
                            pending={creating}
                            pendingText="Creating…"
                        >
                            <i className="fa-solid fa-plus" /> Create database
                        </Button>
                    </div>
                </div>
            </Section>

            {restoreDb && (
                <Section
                    title="Restore database"
                    description={<>Overwrites <span className="font-mono text-foreground">{restoreDb.database_name}</span> from a backup file.</>}
                    icon="fa-solid fa-rotate-left"
                    className="border-amber-500/40"
                >
                    <Field label="Backup file path" htmlFor="restore-path" hint="Server path to the dump to restore from.">
                        <div className="flex items-center gap-2">
                            <Input
                                id="restore-path"
                                value={restorePath}
                                onChange={e => setRestorePath(e.target.value.trim())}
                                placeholder="/var/backups/nydus/mysql/db_20260101.dump"
                                className="flex-1 font-mono text-xs"
                            />
                            <Button
                                ripple
                                variant="outline"
                                tone="warning"
                                onClick={handleRestore}
                                disabled={!restorePath}
                                pending={restoreLoading}
                                pendingText="Restoring…"
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
                    </Field>
                </Section>
            )}

            <Section
                title="Databases"
                description="Databases provisioned under your account"
                icon="fa-solid fa-database"
                flush
            >
                <DataTable
                    columns={dbColumns}
                    rows={sortByColumn(databases, dbSortCol, dbSortAsc)}
                    getRowId={(db) => db.database_uuid}
                    loading={loading}
                    empty={
                        <EmptyState
                            icon="fa-solid fa-database"
                            title="No databases provisioned yet"
                            hint="Create a database above or use Quick Generate to get started."
                        />
                    }
                />
            </Section>

            <Section
                title="Recent backups"
                description="Backups you created this session"
                icon="fa-solid fa-clone"
                flush
            >
                <DataTable
                    columns={backupColumns}
                    rows={sortByColumn(backups, bkSortCol, bkSortAsc)}
                    getRowId={(bk) => bk.uuid}
                    empty={
                        <EmptyState
                            icon="fa-solid fa-clone"
                            title="No backups yet"
                            hint="Backups you create this session appear here."
                        />
                    }
                />
            </Section>

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
                        <DialogTitle>Database users</DialogTitle>
                        <DialogDescription>
                            Users assigned to this database
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        {usersForDatabase(showUsersList || '').map((u: any) => (
                            <div key={u.user_uuid} className="flex items-center justify-between rounded-sm border border-border bg-secondary/30 p-2">
                                <span className="font-mono text-sm">{u.username}</span>
                                <span className="text-xs text-muted-foreground">{u.privileges}</span>
                            </div>
                        ))}
                        {usersForDatabase(showUsersList || '').length === 0 && (
                            <p className="py-4 text-center text-sm text-muted-foreground">No users assigned.</p>
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
                        <DialogTitle>Select user</DialogTitle>
                        <DialogDescription>
                            Choose which user to log in with for phpMyAdmin
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
