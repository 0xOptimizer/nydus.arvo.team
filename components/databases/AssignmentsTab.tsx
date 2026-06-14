'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { useDatabaseContext } from '@/app/databases/context/DatabaseContext'
import {
    grantPrivileges, revokePrivileges,
    getPmaToken
} from '@/app/actions/databases'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/EmptyState'
import { PageShell } from '@/components/PageShell'
import { Section } from '@/components/ui/section'
import { Field } from '@/components/ui/field'
import { staggerContainer, staggerItem, listItem } from '@/lib/motion'

const PRIVILEGE_OPTIONS = [
    'ALL PRIVILEGES',
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'SELECT, INSERT, UPDATE, DELETE'
]

export default function AssignmentsTab() {
    const { databases, dbUsers, privileges, actorId, refresh } = useDatabaseContext()

    const [dragUser, setDragUser]           = useState<any | null>(null)
    const [dragOverDb, setDragOverDb]       = useState<string | null>(null)
    const [pendingAssign, setPendingAssign] = useState<{ user: any; db: any } | null>(null)
    const [assignPriv, setAssignPriv]       = useState('ALL PRIVILEGES')
    const [assigning, setAssigning]         = useState(false)
    const [busyKey, setBusyKey]             = useState<string | null>(null)
    const [error, setError]                 = useState<string | null>(null)
    const [successMsg, setSuccess]          = useState<string | null>(null)

    const [pmaDb, setPmaDb]       = useState<any | null>(null)
    const [pmaUsers, setPmaUsers] = useState<any[]>([])
    const [pmaLoading, setPmaLoading] = useState(false)

    const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000) }
    const err   = (msg: string) => { setError(msg);   setTimeout(() => setError(null), 6000) }

    const usersForDatabase = (dbUuid: string) =>
        privileges.filter((p: any) => p.database_uuid === dbUuid)

    const dbCountForUser = (userUuid: string) =>
        privileges.filter((p: any) => p.user_uuid === userUuid).length

    const isUserAttached = (dbUuid: string, userUuid: string) =>
        privileges.some((p: any) => p.database_uuid === dbUuid && p.user_uuid === userUuid)

    const handleDrop = (db: any) => {
        if (!dragUser) return
        if (isUserAttached(db.database_uuid, dragUser.user_uuid)) {
            err(`"${dragUser.username}" is already attached to "${db.database_name}".`)
            setDragUser(null); setDragOverDb(null); return
        }
        setPendingAssign({ user: dragUser, db })
        setAssignPriv('ALL PRIVILEGES')
        setDragUser(null)
        setDragOverDb(null)
    }

    const handleConfirmAssign = async () => {
        if (!pendingAssign) return
        setAssigning(true)
        const { user, db } = pendingAssign
        const res = await grantPrivileges(
            db.database_uuid, db.database_type, db.database_name,
            user.user_uuid, user.username, assignPriv, actorId
        )
        if (res.success) {
            await refresh()
            flash(`"${user.username}" attached to "${db.database_name}" with ${assignPriv}.`)
        } else err(res.error || 'Failed to assign privileges.')
        setPendingAssign(null)
        setAssigning(false)
    }

    const handleRevokeAssignment = async (
        dbUuid: string, dbName: string, dbType: string,
        userUuid: string, username: string
    ) => {
        if (!confirm(`Remove "${username}" from "${dbName}"?`)) return
        setBusyKey(`rev-${dbUuid}-${userUuid}`)
        const res = await revokePrivileges(dbUuid, userUuid, dbType, dbName, username, actorId)
        if (res.success) { await refresh(); flash(`"${username}" removed from "${dbName}".`) }
        else err(res.error || 'Failed to revoke.')
        setBusyKey(null)
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

    return (
        <TooltipProvider>
        <PageShell
            title="Assignments"
            description="Drag a user from the left onto a database to grant access."
            meta={
                <Badge variant="secondary" className="text-[10px] uppercase">
                    {privileges.length} grant{privileges.length === 1 ? '' : 's'}
                </Badge>
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

            {pendingAssign && (
                <Section className="border-primary/40 bg-primary/5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <Field
                            label="Privileges"
                            hint={
                                <>
                                    Granting to <span className="font-mono text-foreground">{pendingAssign.user.username}</span> on{' '}
                                    <span className="font-mono text-foreground">{pendingAssign.db.database_name}</span>
                                </>
                            }
                            className="flex-1 sm:max-w-xs"
                        >
                            <Select value={assignPriv} onValueChange={setAssignPriv}>
                                <SelectTrigger className="font-mono text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PRIVILEGE_OPTIONS.map(p => (
                                        <SelectItem key={p} value={p} className="font-mono text-xs">{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <div className="flex shrink-0 gap-2">
                            <Button ripple onClick={handleConfirmAssign} pending={assigning} pendingText="Granting…">
                                <i className="fa-solid fa-check" /> Confirm
                            </Button>
                            <Button variant="outline" onClick={() => setPendingAssign(null)}>Cancel</Button>
                        </div>
                    </div>
                </Section>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">

                {/* Users palette */}
                <Section title="Users" description="Drag onto a database" icon="fa-solid fa-users" flush className="self-start">
                    {dbUsers.length === 0 ? (
                        <div className="p-4 sm:p-6">
                            <EmptyState
                                icon="fa-solid fa-users"
                                title="No users yet"
                                hint="Create a database user to assign access."
                                action={
                                    <Button asChild variant="outline" size="sm">
                                        <Link href="/databases/users">Create a user</Link>
                                    </Button>
                                }
                            />
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {dbUsers.map((u: any) => (
                                <div
                                    key={u.user_uuid}
                                    draggable
                                    onDragStart={() => setDragUser(u)}
                                    onDragEnd={() => setDragUser(null)}
                                    className={`
                                        cursor-grab select-none px-4 py-2.5 transition-all active:cursor-grabbing hover:bg-secondary/60
                                        ${dragUser?.user_uuid === u.user_uuid ? 'scale-95 opacity-40' : 'opacity-100'}
                                    `}
                                >
                                    <p className="truncate font-mono text-xs font-medium text-foreground">{u.username}</p>
                                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                                        {dbCountForUser(u.user_uuid)} database{dbCountForUser(u.user_uuid) !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                {/* Databases drop targets */}
                <Section title="Databases" description="Drop a user here to grant access" icon="fa-solid fa-database" flush>
                    {databases.length === 0 ? (
                        <div className="p-4 sm:p-6">
                            <EmptyState
                                icon="fa-solid fa-database"
                                title="No databases provisioned yet"
                                hint="Provision a database first, then drag users here to assign access."
                                action={
                                    <Button asChild variant="outline" size="sm">
                                        <Link href="/databases">Go to Databases</Link>
                                    </Button>
                                }
                            />
                        </div>
                    ) : (
                        <motion.div
                            className="space-y-3 p-4 sm:p-6"
                            variants={staggerContainer}
                            initial="hidden"
                            animate="show"
                        >
                            {databases.map((db: any) => {
                                const attached = usersForDatabase(db.database_uuid)
                                const isOver = dragOverDb === db.database_uuid
                                return (
                                    <motion.div
                                        key={db.database_uuid}
                                        variants={staggerItem}
                                        onDragOver={e => { e.preventDefault(); setDragOverDb(db.database_uuid) }}
                                        onDragLeave={() => setDragOverDb(null)}
                                        onDrop={() => handleDrop(db)}
                                        className={`
                                            rounded-sm border bg-card transition-all duration-150
                                            ${isOver
                                                ? 'border-dashed border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]'
                                                : 'border-border'}
                                        `}
                                    >
                                        <div className={`flex items-center justify-between border-b px-4 py-3 transition-colors ${isOver ? 'border-primary/30 bg-primary/5' : 'border-border bg-secondary/40'}`}>
                                            <div className="flex items-center gap-3">
                                                <Badge variant="secondary" className="shrink-0 text-[10px] font-bold uppercase">{db.database_type}</Badge>
                                                <span className="font-mono text-sm font-bold text-foreground">{db.database_name}</span>
                                                {db.allowed_hosts === '*' || db.allowed_hosts === '%'
                                                    ? <Badge variant="outline" className="text-[10px] text-amber-500"><i className="fa-solid fa-earth-americas mr-1" />All hosts</Badge>
                                                    : <span className="font-mono text-[10px] text-muted-foreground">{db.allowed_hosts}</span>
                                                }
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isOver && dragUser && (
                                                    <span className="animate-pulse text-[10px] font-bold text-primary">
                                                        <i className="fa-solid fa-arrow-down mr-1" />Drop to assign {dragUser.username}
                                                    </span>
                                                )}
                                                {db.database_type === 'mysql' && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span>
                                                                <Button
                                                                    ripple
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handlePmaClick(db)}
                                                                    disabled={attached.length === 0}
                                                                >
                                                                    <i className="fa-solid fa-table-cells" /> Open
                                                                </Button>
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-[10px]">Open phpMyAdmin</TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex min-h-[52px] flex-wrap items-center gap-2 px-4 py-3">
                                            {attached.length === 0 && !isOver && (
                                                <span className="text-xs italic text-muted-foreground/50">No users assigned — drag one here</span>
                                            )}
                                            <AnimatePresence initial={false}>
                                                {attached.map((p: any) => (
                                                    <motion.div
                                                        key={p.user_uuid}
                                                        layout
                                                        variants={listItem}
                                                        initial="hidden"
                                                        animate="show"
                                                        exit="exit"
                                                        className="flex items-center gap-1.5 rounded-sm border border-border bg-secondary px-2.5 py-1 font-mono text-xs"
                                                    >
                                                        <span className="text-foreground">{p.username}</span>
                                                        <span className="text-[10px] text-muted-foreground/50">{p.privileges}</span>
                                                        <button
                                                            onClick={() => handleRevokeAssignment(db.database_uuid, db.database_name, db.database_type, p.user_uuid, p.username)}
                                                            disabled={busyKey === `rev-${db.database_uuid}-${p.user_uuid}`}
                                                            className="ml-1 text-muted-foreground transition-colors hover:text-red-500 disabled:opacity-50"
                                                            aria-label={`Remove ${p.username}`}
                                                        >
                                                            {busyKey === `rev-${db.database_uuid}-${p.user_uuid}`
                                                                ? <i className="fa-solid fa-spinner fa-spin text-[10px]" />
                                                                : <i className="fa-solid fa-xmark text-[10px]" />}
                                                        </button>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                            {isOver && dragUser && !isUserAttached(db.database_uuid, dragUser.user_uuid) && (
                                                <div className="flex animate-pulse items-center gap-1.5 rounded-sm border border-dashed border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-xs text-primary">
                                                    <i className="fa-solid fa-plus text-[10px]" />{dragUser.username}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </motion.div>
                    )}
                </Section>
            </div>

            <Dialog open={!!pmaDb} onOpenChange={open => { if (!open) { setPmaDb(null); setPmaUsers([]) } }}>
                <DialogContent className="max-w-sm border-border bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-bold uppercase tracking-wider">
                            <i className="fa-solid fa-table-cells mr-2 text-orange-400" />
                            Open phpMyAdmin
                        </DialogTitle>
                    </DialogHeader>
                    <p className="mb-4 text-xs text-muted-foreground">
                        Multiple users are attached to <span className="font-mono text-foreground">{pmaDb?.database_name}</span>. Select which account to log in with.
                    </p>
                    <div className="space-y-2">
                        {pmaUsers.map((p: any) => (
                            <button
                                key={p.user_uuid}
                                onClick={() => redirectToPma(p.user_uuid)}
                                disabled={pmaLoading}
                                className="flex w-full cursor-pointer items-center justify-between border border-border bg-secondary px-4 py-3 text-left transition-colors hover:bg-border disabled:opacity-50"
                            >
                                <div>
                                    <p className="font-mono text-sm font-semibold text-foreground">{p.username}</p>
                                    <p className="mt-0.5 text-[10px] text-muted-foreground">{p.privileges}</p>
                                </div>
                                {pmaLoading
                                    ? <i className="fa-solid fa-spinner fa-spin text-muted-foreground" />
                                    : <i className="fa-solid fa-arrow-up-right-from-square text-muted-foreground" />}
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </PageShell>
        </TooltipProvider>
    )
}
