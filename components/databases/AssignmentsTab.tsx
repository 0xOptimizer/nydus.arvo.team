'use client'

import { useState, useRef } from 'react'
import { useDatabaseContext } from '@/app/databases/context/DatabaseContext'
import {
    grantPrivileges, revokePrivileges,
    getPmaToken
} from '@/app/actions/databases'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RippleButton } from '@/components/RippleButton'

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
        <div>
            {error && (
                <Alert className="mb-6 bg-red-950/30 border-red-900/50 text-red-200 text-xs font-bold">
                    <i className="fa-solid fa-triangle-exclamation mr-2" />{error}
                </Alert>
            )}
            {successMsg && (
                <Alert className="mb-6 bg-emerald-950/30 border-emerald-900/50 text-emerald-200 text-xs font-bold">
                    <i className="fa-solid fa-circle-check mr-2" />{successMsg}
                </Alert>
            )}

            <div className="mb-6">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1">
                    <i className="fa-solid fa-link mr-2 text-primary" />
                    Assign Users to Databases
                </h3>
                <p className="text-xs text-muted-foreground">Drag a user from the left panel and drop them onto a database to assign access.</p>
            </div>

            {pendingAssign && (
                <Card className="p-4 mb-6 border-primary/40 bg-primary/5">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                        <i className="fa-solid fa-arrow-right mr-2 text-primary" />
                        Assign <span className="text-primary font-mono">{pendingAssign.user.username}</span> to <span className="text-primary font-mono">{pendingAssign.db.database_name}</span>
                    </p>
                    <div className="flex items-center gap-3">
                        <select
                            value={assignPriv}
                            onChange={e => setAssignPriv(e.target.value)}
                            className="bg-secondary border border-border text-foreground text-xs font-mono p-2 outline-none focus:border-primary transition-all flex-1 max-w-xs"
                        >
                            {PRIVILEGE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <RippleButton onClick={handleConfirmAssign} disabled={assigning} className="h-9 flex items-center gap-2 px-5">
                            {assigning ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-check" />Confirm</>}
                        </RippleButton>
                        <RippleButton variant="outline" onClick={() => setPendingAssign(null)} className="h-9">Cancel</RippleButton>
                    </div>
                </Card>
            )}

            <div className="flex gap-4 min-h-[500px]">

                <div className="w-1/5 shrink-0">
                    <div className="sticky top-20">
                        <div className="bg-secondary border border-border px-3 py-2 mb-0.5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Users</p>
                        </div>
                        <div className="border border-t-0 border-border bg-card">
                            {dbUsers.length === 0 && (
                                <p className="p-4 text-xs text-muted-foreground italic text-center">No users yet.</p>
                            )}
                            {dbUsers.map((u: any) => (
                                <div
                                    key={u.user_uuid}
                                    draggable
                                    onDragStart={() => setDragUser(u)}
                                    onDragEnd={() => setDragUser(null)}
                                    className={`
                                        px-3 py-2.5 border-b border-border/50 cursor-grab active:cursor-grabbing
                                        select-none transition-all hover:bg-secondary/60
                                        ${dragUser?.user_uuid === u.user_uuid ? 'opacity-40 scale-95' : 'opacity-100'}
                                    `}
                                >
                                    <p className="font-mono text-xs font-semibold text-foreground truncate">{u.username}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {dbCountForUser(u.user_uuid)} database{dbCountForUser(u.user_uuid) !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 space-y-3">
                    {databases.length === 0 && (
                        <div className="border border-dashed border-border p-12 text-center text-muted-foreground text-sm italic">
                            No databases provisioned yet.
                        </div>
                    )}
                    {databases.map((db: any) => {
                        const attached = usersForDatabase(db.database_uuid)
                        const isOver = dragOverDb === db.database_uuid
                        return (
                            <div
                                key={db.database_uuid}
                                onDragOver={e => { e.preventDefault(); setDragOverDb(db.database_uuid) }}
                                onDragLeave={() => setDragOverDb(null)}
                                onDrop={() => handleDrop(db)}
                                className={`
                                    border bg-card transition-all duration-150
                                    ${isOver
                                        ? 'border-primary border-dashed bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]'
                                        : 'border-border'}
                                `}
                            >
                                <div className={`px-4 py-3 border-b flex items-center justify-between transition-colors ${isOver ? 'border-primary/30 bg-primary/5' : 'border-border bg-secondary/40'}`}>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="default" className="text-[10px] font-bold uppercase text-black shrink-0">{db.database_type}</Badge>
                                        <span className="font-mono text-sm font-bold text-foreground">{db.database_name}</span>
                                        {db.allowed_hosts === '*' || db.allowed_hosts === '%'
                                            ? <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-800/50"><i className="fa-solid fa-earth-americas mr-1" />All Hosts</Badge>
                                            : <span className="text-[10px] text-muted-foreground font-mono">{db.allowed_hosts}</span>
                                        }
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isOver && dragUser && (
                                            <span className="text-[10px] text-primary font-bold animate-pulse">
                                                <i className="fa-solid fa-arrow-down mr-1" />Drop to assign {dragUser.username}
                                            </span>
                                        )}
                                        {db.database_type === 'mysql' && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span>
                                                        <RippleButton
                                                            variant="pma"
                                                            onClick={() => handlePmaClick(db)}
                                                            disabled={attached.length === 0}
                                                            className="px-2.5 py-1 text-[10px]"
                                                        >
                                                            <i className="fa-solid fa-table-cells" />
                                                        </RippleButton>
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="text-[10px]">Open phpMyAdmin</TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>

                                <div className="px-4 py-3 min-h-[52px] flex flex-wrap gap-2 items-center">
                                    {attached.length === 0 && !isOver && (
                                        <span className="text-xs text-muted-foreground/50 italic">No users assigned — drag one here</span>
                                    )}
                                    {attached.map((p: any) => (
                                        <div key={p.user_uuid}
                                            className="flex items-center gap-1.5 bg-secondary border border-border px-2.5 py-1 text-xs font-mono">
                                            <span className="text-foreground">{p.username}</span>
                                            <span className="text-muted-foreground/50 text-[10px]">{p.privileges}</span>
                                            <button
                                                onClick={() => handleRevokeAssignment(db.database_uuid, db.database_name, db.database_type, p.user_uuid, p.username)}
                                                disabled={busyKey === `rev-${db.database_uuid}-${p.user_uuid}`}
                                                className="text-muted-foreground hover:text-red-400 transition-colors ml-1 disabled:opacity-50"
                                            >
                                                {busyKey === `rev-${db.database_uuid}-${p.user_uuid}`
                                                    ? <i className="fa-solid fa-spinner fa-spin text-[10px]" />
                                                    : <i className="fa-solid fa-xmark text-[10px]" />}
                                            </button>
                                        </div>
                                    ))}
                                    {isOver && dragUser && !isUserAttached(db.database_uuid, dragUser.user_uuid) && (
                                        <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/40 border-dashed px-2.5 py-1 text-xs font-mono text-primary animate-pulse">
                                            <i className="fa-solid fa-plus text-[10px]" />{dragUser.username}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

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
                                    <p className="text-sm font-mono font-semibold text-foreground">{p.username}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.privileges}</p>
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