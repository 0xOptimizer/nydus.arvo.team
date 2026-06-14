'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useDatabaseContext } from '@/app/databases/context/DatabaseContext'
import { createDatabaseUser, deleteDatabaseUser } from '@/app/actions/databases'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableRowsSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { PageShell } from '@/components/PageShell'
import { staggerContainer, listItem } from '@/lib/motion'

const TOUHOU_NAMES = [
    'reimu', 'marisa', 'sakuya', 'remilia', 'flandre',
    'youmu', 'yuyuko', 'yukari', 'ran', 'chen',
    'alice', 'patchouli', 'meiling', 'sanae', 'cirno',
    'aya', 'reisen', 'eirin', 'mokou', 'kaguya'
]

const DB_TYPE_OPTIONS = ['mysql']

export default function UsersTab() {
    const { dbUsers, privileges, actorId, loading, refresh } = useDatabaseContext()

    const [newUsername, setNewUsername]   = useState('')
    const [newPassword, setNewPassword]   = useState('')
    const [userDbType, setUserDbType]     = useState('mysql')
    const [hostMode, setHostMode]         = useState<'remote' | 'localhost' | 'custom'>('remote')
    const [customHosts, setCustomHosts]   = useState('')
    const [creatingUser, setCreatingUser] = useState(false)
    const [busyKey, setBusyKey]           = useState<string | null>(null)
    const [error, setError]               = useState<string | null>(null)
    const [successMsg, setSuccess]        = useState<string | null>(null)

    const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000) }
    const err   = (msg: string) => { setError(msg);   setTimeout(() => setError(null), 6000) }

    const dbCountForUser = (userUuid: string) =>
        privileges.filter((p: any) => p.user_uuid === userUuid).length

    const randomizeName = () => {
        const available = TOUHOU_NAMES.filter(n =>
            !dbUsers.some((u: any) => u.username === `${n}_${actorId}`)
        )
        if (available.length === 0) { err('All Touhou names are taken for your account.'); return }
        const name = available[Math.floor(Math.random() * available.length)]
        setNewUsername(`${name}_${actorId}`)
    }

    // Map the host selector to the backend `allowed_hosts` value.
    // remote → "%", localhost → "localhost", custom → CSV (defaults to "%" if blank).
    const resolveAllowedHosts = () => {
        if (hostMode === 'localhost') return 'localhost'
        if (hostMode === 'custom')    return customHosts.trim() || '%'
        return '%'
    }

    const handleCreateUser = async () => {
        if (!newUsername.trim() || !newPassword.trim()) { err('Username and password are required.'); return }
        if (dbUsers.some((u: any) => u.username === newUsername.trim())) {
            err(`Username "${newUsername.trim()}" already exists.`); return
        }
        setCreatingUser(true)
        const res = await createDatabaseUser(userDbType, newUsername.trim(), newPassword, actorId, resolveAllowedHosts())
        if (res.success) {
            setNewUsername('')
            setNewPassword('')
            setCustomHosts('')
            setHostMode('remote')
            await refresh()
            flash(`User created — ${res.user_uuid}`)
        } else err(res.error || 'Failed to create user.')
        setCreatingUser(false)
    }

    const handleDeleteUser = async (u: any) => {
        if (!confirm(`Delete user "${u.username}"?`)) return
        setBusyKey(`del-u-${u.user_uuid}`)
        const res = await deleteDatabaseUser(u.user_uuid, userDbType, u.username, actorId)
        if (res.success) { await refresh(); flash(`User "${u.username}" deleted.`) }
        else err(res.error || 'Failed to delete user.')
        setBusyKey(null)
    }

    return (
        <TooltipProvider>
        <PageShell title="Users" description="Create database users and manage their access.">
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

            <div className="rounded-sm border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border p-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <i className="fa-solid fa-user-plus mr-2 text-primary" />
                        Create Database User
                    </h3>
                </div>
                <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Engine</label>
                        <select
                            value={userDbType}
                            onChange={e => setUserDbType(e.target.value)}
                            className="w-full bg-secondary border border-border text-foreground text-sm p-2 focus:border-primary outline-none transition-all"
                        >
                            {DB_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">
                            Username
                            {newUsername.length > 0 && dbUsers.some((u: any) => u.username === newUsername) &&
                                <span className="text-red-400 ml-2 normal-case italic">(Taken)</span>}
                        </label>
                        <div className="flex">
                            <Input
                                value={newUsername}
                                onChange={e => setNewUsername(e.target.value.trim())}
                                placeholder="tewi_1029358398243"
                                className="bg-background border-border font-mono text-sm focus:border-primary flex-1 border-r-0"
                            />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={randomizeName}
                                        className="border border-border border-l-0 bg-secondary px-3 text-muted-foreground hover:text-primary transition-colors text-sm shrink-0"
                                    >
                                        <i className="fa-solid fa-shuffle" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[10px]">Randomize Touhou name</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Password</label>
                        <Input
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Strong password"
                            className="bg-background border-border font-mono text-sm focus:border-primary"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Access</label>
                        <select
                            value={hostMode}
                            onChange={e => setHostMode(e.target.value as 'remote' | 'localhost' | 'custom')}
                            className="w-full bg-secondary border border-border text-foreground text-sm p-2 focus:border-primary outline-none transition-all"
                        >
                            <option value="remote">Anywhere (%)</option>
                            <option value="localhost">Localhost</option>
                            <option value="custom">Custom…</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <Button
                            ripple
                            variant="outline"
                            onClick={handleCreateUser}
                            disabled={!newUsername || !newPassword || !actorId || dbUsers.some((u: any) => u.username === newUsername)}
                            pending={creatingUser}
                            pendingText="Creating..."
                            className="w-full h-10"
                        >
                            Create
                        </Button>
                    </div>
                </div>
                {hostMode === 'custom' && (
                    <div className="mt-4">
                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">
                            Allowed hosts <span className="normal-case italic text-muted-foreground">(comma-separated, e.g. 10.0.0.5, 192.168.1.%)</span>
                        </label>
                        <Input
                            value={customHosts}
                            onChange={e => setCustomHosts(e.target.value)}
                            placeholder="%"
                            className="bg-background border-border font-mono text-sm focus:border-primary"
                        />
                    </div>
                )}
                <p className="text-xs text-muted-foreground mt-4 border-l-2 border-border pl-3">
                    After creating a user, head to the <strong className="text-foreground">Assignments</strong> page to attach them to a database.
                </p>
                </div>
            </div>

            <div className="rounded-sm border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border p-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">All Database Users</h3>
                </div>
                {loading && dbUsers.length === 0 ? (
                    <TableRowsSkeleton rows={5} cols={4} />
                ) : dbUsers.length === 0 ? (
                    <EmptyState
                        icon="fa-solid fa-users"
                        title="No database users found"
                        hint="Create a user above to get started."
                        className="border-0"
                    />
                ) : (
                    <Table>
                        <TableHeader className="bg-secondary border-b border-border">
                            <TableRow className="border-border">
                                <TableHead className="font-bold text-foreground uppercase text-xs">Username</TableHead>
                                <TableHead className="font-bold text-foreground uppercase text-xs hidden md:table-cell">UUID</TableHead>
                                <TableHead className="font-bold text-foreground uppercase text-xs hidden md:table-cell">Created</TableHead>
                                <TableHead className="font-bold text-foreground uppercase text-xs text-right pr-4">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <motion.tbody
                            className="[&_tr:last-child]:border-0"
                            variants={staggerContainer}
                            initial="hidden"
                            animate="show"
                        >
                            <AnimatePresence initial={false}>
                                {dbUsers.map((u: any) => {
                                    const count = dbCountForUser(u.user_uuid)
                                    return (
                                        <motion.tr
                                            key={u.user_uuid}
                                            layout
                                            variants={listItem}
                                            exit="exit"
                                            className="border-b border-border transition-colors hover:bg-secondary/50"
                                        >
                                            <TableCell className="font-mono text-sm font-semibold text-foreground">{u.username}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground hidden md:table-cell">{u.user_uuid}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground hidden md:table-cell">
                                                {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                                            </TableCell>
                                            <TableCell className="text-right pr-4">
                                                <div className="flex justify-end items-center gap-2">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span>
                                                                <Badge
                                                                    variant={count > 0 ? 'default' : 'secondary'}
                                                                    className={`text-xs font-bold cursor-default ${count > 0 ? 'text-black' : 'text-muted-foreground'}`}
                                                                >
                                                                    {count > 0 ? `${count} DB${count > 1 ? 's' : ''}` : 'No DBs'}
                                                                </Badge>
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-[10px]">
                                                            {count > 0
                                                                ? `Attached to ${count} database${count > 1 ? 's' : ''}`
                                                                : 'Not attached to any database'}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <Button
                                                        ripple
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeleteUser(u)}
                                                        pending={busyKey === `del-u-${u.user_uuid}`}
                                                        pendingText="Delete"
                                                    >
                                                        Delete
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </motion.tr>
                                    )
                                })}
                            </AnimatePresence>
                        </motion.tbody>
                    </Table>
                )}
            </div>
        </PageShell>
        </TooltipProvider>
    )
}
