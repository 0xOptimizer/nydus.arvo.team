'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useDatabaseContext } from '@/app/databases/context/DatabaseContext'
import { createDatabaseUser, deleteDatabaseUser } from '@/app/actions/databases'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/EmptyState'
import { PageShell } from '@/components/PageShell'
import { AccessTabs } from '@/components/databases/AccessTabs'
import { Section } from '@/components/ui/section'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Field, FormGrid } from '@/components/ui/field'

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

    const usernameTaken = newUsername.length > 0 && dbUsers.some((u: any) => u.username === newUsername)

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

    const columns: Column<any>[] = [
        {
            key: 'username',
            header: 'Username',
            render: (u) => (
                <span className="font-mono text-sm font-medium text-foreground">{u.username}</span>
            ),
        },
        {
            key: 'uuid',
            header: 'UUID',
            className: 'hidden md:table-cell',
            headClassName: 'hidden md:table-cell',
            render: (u) => (
                <span className="font-mono text-[10px] text-muted-foreground">{u.user_uuid}</span>
            ),
        },
        {
            key: 'created',
            header: 'Created',
            className: 'hidden md:table-cell',
            headClassName: 'hidden md:table-cell',
            render: (u) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                </span>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (u) => {
                const count = dbCountForUser(u.user_uuid)
                return (
                    <div className="flex items-center justify-end gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Badge
                                        variant={count > 0 ? 'default' : 'secondary'}
                                        className={`text-[10px] cursor-default ${count > 0 ? 'text-black' : 'text-muted-foreground'}`}
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
                            variant="outline"
                            tone="inactive"
                            size="sm"
                            onClick={() => handleDeleteUser(u)}
                            pending={busyKey === `del-u-${u.user_uuid}`}
                            pendingText="Delete"
                        >
                            Delete
                        </Button>
                    </div>
                )
            },
        },
    ]

    return (
        <TooltipProvider>
        <PageShell
            title="Users"
            description="Create database users and manage their access."
            meta={
                <Badge variant="secondary" className="text-[10px] uppercase">
                    {dbUsers.length} user{dbUsers.length === 1 ? '' : 's'}
                </Badge>
            }
        >
            <AccessTabs active="users" />

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
                title="Create database user"
                description="New users start unattached — link them to a database in Assignments."
                icon="fa-solid fa-user-plus"
            >
                <div className="space-y-4">
                    <FormGrid cols={2}>
                        <Field label="Engine" htmlFor="user-engine">
                            <Select value={userDbType} onValueChange={setUserDbType}>
                                <SelectTrigger id="user-engine">
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
                            label="Username"
                            htmlFor="user-name"
                            required
                            error={usernameTaken ? 'That username is already taken.' : undefined}
                        >
                            <div className="flex">
                                <Input
                                    id="user-name"
                                    value={newUsername}
                                    onChange={e => setNewUsername(e.target.value.trim())}
                                    placeholder="tewi_1029358398243"
                                    className="flex-1 rounded-r-none border-r-0 font-mono"
                                />
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={randomizeName}
                                            className="shrink-0 rounded-r-md border border-l-0 border-input bg-secondary px-3 text-sm text-muted-foreground transition-colors hover:text-primary"
                                        >
                                            <i className="fa-solid fa-shuffle" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-[10px]">Randomize Touhou name</TooltipContent>
                                </Tooltip>
                            </div>
                        </Field>
                        <Field label="Password" htmlFor="user-pass" required>
                            <Input
                                id="user-pass"
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="Strong password"
                                className="font-mono"
                            />
                        </Field>
                        <Field label="Access" htmlFor="user-access" hint="Where this user may connect from.">
                            <Select value={hostMode} onValueChange={(v) => setHostMode(v as 'remote' | 'localhost' | 'custom')}>
                                <SelectTrigger id="user-access">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="remote">Anywhere (%)</SelectItem>
                                    <SelectItem value="localhost">Localhost</SelectItem>
                                    <SelectItem value="custom">Custom…</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                    </FormGrid>

                    {hostMode === 'custom' && (
                        <Field
                            label="Allowed hosts"
                            htmlFor="user-hosts"
                            hint="Comma-separated, e.g. 10.0.0.5, 192.168.1.%"
                        >
                            <Input
                                id="user-hosts"
                                value={customHosts}
                                onChange={e => setCustomHosts(e.target.value)}
                                placeholder="%"
                                className="font-mono"
                            />
                        </Field>
                    )}

                    <div className="flex justify-end">
                        <Button
                            ripple
                            onClick={handleCreateUser}
                            disabled={!newUsername || !newPassword || !actorId || usernameTaken}
                            pending={creatingUser}
                            pendingText="Creating…"
                        >
                            <i className="fa-solid fa-user-plus" /> Create user
                        </Button>
                    </div>
                </div>
            </Section>

            <Section title="Database users" description="Every user provisioned under your account" icon="fa-solid fa-users" flush>
                <DataTable
                    columns={columns}
                    rows={dbUsers}
                    getRowId={(u) => u.user_uuid}
                    loading={loading}
                    empty={
                        <EmptyState
                            icon="fa-solid fa-users"
                            title="No database users yet"
                            hint="Create a user above, then attach it to a database in Assignments."
                            action={
                                <Button asChild variant="outline" size="sm">
                                    <Link href="/databases/assignments">Go to Assignments</Link>
                                </Button>
                            }
                        />
                    }
                />
            </Section>
        </PageShell>
        </TooltipProvider>
    )
}
