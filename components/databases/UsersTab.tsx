'use client'

import { useState } from 'react'
import { useDatabaseContext } from '@/app/databases/context/DatabaseContext'
import { createDatabaseUser, deleteDatabaseUser } from '@/app/actions/databases'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RippleButton } from '@/components/RippleButton'

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

    const handleCreateUser = async () => {
        if (!newUsername.trim() || !newPassword.trim()) { err('Username and password are required.'); return }
        if (dbUsers.some((u: any) => u.username === newUsername.trim())) {
            err(`Username "${newUsername.trim()}" already exists.`); return
        }
        setCreatingUser(true)
        const res = await createDatabaseUser(userDbType, newUsername.trim(), newPassword, actorId)
        if (res.success) {
            setNewUsername('')
            setNewPassword('')
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
        <div className="space-y-8">
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

            <Card className="p-6 border-border bg-card">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
                    <i className="fa-solid fa-user-plus mr-2 text-primary" />
                    Create Database User
                </h3>
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
                    <div className="md:col-span-4">
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
                    <div className="md:col-span-4">
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
                        <RippleButton
                            onClick={handleCreateUser}
                            disabled={!newUsername || !newPassword || !actorId || creatingUser || dbUsers.some((u: any) => u.username === newUsername)}
                            className="w-full h-10 flex items-center justify-center gap-2"
                        >
                            {creatingUser ? <i className="fa-solid fa-spinner fa-spin" /> : 'Create'}
                        </RippleButton>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4 border-l-2 border-border pl-3">
                    After creating a user, head to the <strong className="text-foreground">Assignments</strong> page to attach them to a database.
                </p>
            </Card>

            <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">All Database Users</h3>
                <Card className="border-border bg-card overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">Loading users...</div>
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
                            <TableBody>
                                {dbUsers.map((u: any) => {
                                    const count = dbCountForUser(u.user_uuid)
                                    return (
                                        <TableRow key={u.user_uuid} className="border-b border-border hover:bg-secondary/50 transition-colors">
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
                                                    <RippleButton
                                                        variant="danger"
                                                        onClick={() => handleDeleteUser(u)}
                                                        disabled={busyKey === `del-u-${u.user_uuid}`}
                                                        className="px-2.5 py-1 text-[10px]"
                                                    >
                                                        {busyKey === `del-u-${u.user_uuid}`
                                                            ? <i className="fa-solid fa-spinner fa-spin" />
                                                            : 'Delete'}
                                                    </RippleButton>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {dbUsers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="px-6 py-8 text-center text-muted-foreground italic">
                                            No database users found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </Card>
            </div>
        </div>
        </TooltipProvider>
    )
}