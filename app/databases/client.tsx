'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
    getDatabases, createDatabase, deleteDatabase,
    getDatabaseUsers, createDatabaseUser, deleteDatabaseUser,
    grantPrivileges, revokePrivileges, getAllPrivileges,
    getPmaToken, performBackup, restoreBackup
} from '@/app/actions/databases';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/ui/section';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Field, FormGrid } from '@/components/ui/field';
import { SegmentedControl } from '@/components/ui/segmented';
import { listItem } from '@/lib/motion';

// --- Constants ---

const TOUHOU_NAMES = [
    'reimu', 'marisa', 'sakuya', 'remilia', 'flandre',
    'youmu', 'yuyuko', 'yukari', 'ran', 'chen',
    'alice', 'patchouli', 'meiling', 'sanae', 'cirno',
    'aya', 'reisen', 'eirin', 'mokou', 'kaguya'
];

const PRIVILEGE_OPTIONS = [
    'ALL PRIVILEGES',
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'SELECT, INSERT, UPDATE, DELETE'
];

const DB_TYPE_OPTIONS = ['mysql'];

type DbTab = 'databases' | 'users' | 'assignments';

// --- Main Component ---

export default function DatabasesClient({ actorId }: { actorId: string }) {
    const [tab, setTab]                 = useState<DbTab>('databases');
    const [databases, setDatabases]     = useState<any[]>([]);
    const [dbUsers, setDbUsers]         = useState<any[]>([]);
    const [privileges, setPrivileges]   = useState<any[]>([]);
    const [loading, setLoading]         = useState(true);

    // Create DB form
    const [newDbName, setNewDbName]         = useState('');
    const [newDbType, setNewDbType]         = useState('mysql');
    const [newDbHosts, setNewDbHosts]       = useState('localhost');
    const [remoteAccess, setRemoteAccess]   = useState(false);
    const [creating, setCreating]           = useState(false);

    // Create user form
    const [newUsername, setNewUsername]     = useState('');
    const [newPassword, setNewPassword]     = useState('');
    const [userDbType, setUserDbType]       = useState('mysql');
    const [creatingUser, setCreatingUser]   = useState(false);

    // Assignments drag state
    const [dragUser, setDragUser]           = useState<any | null>(null);
    const [dragOverDb, setDragOverDb]       = useState<string | null>(null);
    const [pendingAssign, setPendingAssign] = useState<{ user: any; db: any } | null>(null);
    const [assignPriv, setAssignPriv]       = useState('ALL PRIVILEGES');
    const [assigning, setAssigning]         = useState(false);

    // phpMyAdmin modal
    const [pmaDb, setPmaDb]                 = useState<any | null>(null);
    const [pmaUsers, setPmaUsers]           = useState<any[]>([]);
    const [pmaLoading, setPmaLoading]       = useState(false);

    // Restore
    const [restoreDb, setRestoreDb]         = useState<any | null>(null);
    const [restorePath, setRestorePath]     = useState('');
    const [restoreLoading, setRestoreLoading] = useState(false);

    // UI feedback
    const [error, setError]         = useState<string | null>(null);
    const [successMsg, setSuccess]  = useState<string | null>(null);
    const [busyKey, setBusyKey]     = useState<string | null>(null);

    const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };
    const err   = (msg: string) => { setError(msg);   setTimeout(() => setError(null), 6000); };

    const refreshAll = async () => {
        const [dbs, users, privs] = await Promise.all([
            getDatabases(),
            getDatabaseUsers(),
            getAllPrivileges()
        ]);
        setDatabases(Array.isArray(dbs) ? dbs : []);
        setDbUsers(Array.isArray(users) ? users : []);
        setPrivileges(Array.isArray(privs) ? privs : []);
    };

    useEffect(() => {
        (async () => { setLoading(true); await refreshAll(); setLoading(false); })();
    }, []);

    // Derived helpers
    const dbCountForUser = (userUuid: string) =>
        privileges.filter((p: any) => p.user_uuid === userUuid).length;

    const usersForDatabase = (dbUuid: string) =>
        privileges.filter((p: any) => p.database_uuid === dbUuid);

    const isUserAttached = (dbUuid: string, userUuid: string) =>
        privileges.some((p: any) => p.database_uuid === dbUuid && p.user_uuid === userUuid);

    const randomizeName = () => {
        const available = TOUHOU_NAMES.filter(n => !dbUsers.some((u: any) => u.username === `${n}_${actorId}`));
        if (available.length === 0) { err("All Touhou names are taken for your account."); return; }
        const name = available[Math.floor(Math.random() * available.length)];
        setNewUsername(`${name}_${actorId}`);
    };

    const isValidDbName = (n: string) => /^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(n);
    const nameInvalid = newDbName.length > 0 && !isValidDbName(newDbName);
    const usernameTaken = newUsername.length > 0 && dbUsers.some((u: any) => u.username === newUsername);
    const effectiveHosts = remoteAccess ? '*' : newDbHosts;

    // --- Database handlers ---

    const handleCreateDb = async () => {
        if (!isValidDbName(newDbName)) { err("Invalid name. Must start with a letter, alphanumeric and underscores only."); return; }
        if (!actorId) { err("Session not found."); return; }
        setCreating(true);
        const res = await createDatabase(newDbType, newDbName, effectiveHosts, actorId);
        if (res.success) {
            setNewDbName(''); setNewDbHosts('localhost'); setRemoteAccess(false);
            await refreshAll();
            flash(`Database "${newDbName}" created.`);
        } else err(res.error || "Failed to create database.");
        setCreating(false);
    };

    const handleDeleteDb = async (db: any) => {
        if (!confirm(`Delete "${db.database_name}"? This is permanent.`)) return;
        setBusyKey(`del-db-${db.database_uuid}`);
        const res = await deleteDatabase(db.database_uuid, db.database_name, db.database_type, actorId);
        if (res.success) { await refreshAll(); flash(`"${db.database_name}" deleted.`); }
        else err(res.error || "Failed to delete.");
        setBusyKey(null);
    };

    const handleBackup = async (db: any) => {
        setBusyKey(`bk-${db.database_uuid}`);
        const res = await performBackup(db.database_uuid, db.database_type, db.database_name);
        if (res.success) flash(`Backup complete — ${res.backup_uuid}`);
        else err(res.error || "Backup failed.");
        setBusyKey(null);
    };

    const handleRestore = async () => {
        if (!restoreDb || !restorePath.trim()) { err("Backup file path is required."); return; }
        if (!confirm(`Restore "${restoreDb.database_name}"? Existing data will be overwritten.`)) return;
        setRestoreLoading(true);
        const res = await restoreBackup(restoreDb.database_uuid, restoreDb.database_type, restoreDb.database_name, restorePath.trim());
        if (res.success) { setRestorePath(''); setRestoreDb(null); flash("Restore completed."); }
        else err(res.error || "Restore failed.");
        setRestoreLoading(false);
    };

    // --- phpMyAdmin ---

    const handlePmaClick = async (db: any) => {
        const attached = usersForDatabase(db.database_uuid);
        if (attached.length === 0) { err("No users are attached to this database."); return; }
        if (attached.length === 1) {
            await redirectToPma(attached[0].user_uuid);
            return;
        }
        setPmaDb(db);
        setPmaUsers(attached);
    };

    const redirectToPma = async (userUuid: string) => {
        setPmaLoading(true);
        const res = await getPmaToken(userUuid);
        setPmaLoading(false);
        if (!res.success || !res.token) { err("Failed to generate login token."); return; }
        setPmaDb(null);
        setPmaUsers([]);
        window.open(`https://pma.arvo.team/nydus_signon.php?token=${res.token}`, '_blank');
    };

    // --- User handlers ---

    const handleCreateUser = async () => {
        if (!newUsername.trim() || !newPassword.trim()) { err("Username and password are required."); return; }
        if (dbUsers.some((u: any) => u.username === newUsername.trim())) {
            err(`Username "${newUsername.trim()}" already exists.`); return;
        }
        setCreatingUser(true);
        const res = await createDatabaseUser(userDbType, newUsername.trim(), newPassword, actorId);
        if (res.success) { setNewUsername(''); setNewPassword(''); await refreshAll(); flash(`User created — ${res.user_uuid}`); }
        else err(res.error || "Failed to create user.");
        setCreatingUser(false);
    };

    const handleDeleteUser = async (u: any) => {
        if (!confirm(`Delete user "${u.username}"?`)) return;
        setBusyKey(`del-u-${u.user_uuid}`);
        const res = await deleteDatabaseUser(u.user_uuid, userDbType, u.username, actorId);
        if (res.success) { await refreshAll(); flash(`User "${u.username}" deleted.`); }
        else err(res.error || "Failed to delete user.");
        setBusyKey(null);
    };

    // --- Assignments drag-drop ---

    const handleDrop = (db: any) => {
        if (!dragUser) return;
        if (isUserAttached(db.database_uuid, dragUser.user_uuid)) {
            err(`"${dragUser.username}" is already attached to "${db.database_name}".`);
            setDragUser(null); setDragOverDb(null); return;
        }
        setPendingAssign({ user: dragUser, db });
        setAssignPriv('ALL PRIVILEGES');
        setDragUser(null);
        setDragOverDb(null);
    };

    const handleConfirmAssign = async () => {
        if (!pendingAssign) return;
        setAssigning(true);
        const { user, db } = pendingAssign;
        const res = await grantPrivileges(db.database_uuid, db.database_type, db.database_name, user.user_uuid, user.username, assignPriv, actorId);
        if (res.success) { await refreshAll(); flash(`"${user.username}" attached to "${db.database_name}" with ${assignPriv}.`); }
        else err(res.error || "Failed to assign privileges.");
        setPendingAssign(null);
        setAssigning(false);
    };

    const handleRevokeAssignment = async (dbUuid: string, dbName: string, dbType: string, userUuid: string, username: string) => {
        if (!confirm(`Remove "${username}" from "${dbName}"?`)) return;
        setBusyKey(`rev-${dbUuid}-${userUuid}`);
        const res = await revokePrivileges(dbUuid, userUuid, dbType, dbName, username, actorId);
        if (res.success) { await refreshAll(); flash(`"${username}" removed from "${dbName}".`); }
        else err(res.error || "Failed to revoke.");
        setBusyKey(null);
    };

    // --- Columns ---

    const dbColumns: Column<any>[] = [
        {
            key: 'name',
            header: 'Name',
            render: (db) => (
                <span className="font-mono text-sm font-medium text-foreground">{db.database_name}</span>
            ),
        },
        {
            key: 'engine',
            header: 'Engine',
            render: (db) => (
                <Badge variant="secondary" className="text-[10px] font-normal uppercase">{db.database_type}</Badge>
            ),
        },
        {
            key: 'hosts',
            header: 'Hosts',
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
            header: 'Users',
            align: 'center',
            render: (db) => (
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{usersForDatabase(db.database_uuid).length}</span>
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
                                    <Button variant="outline" size="sm" onClick={() => handlePmaClick(db)}
                                        disabled={usersForDatabase(db.database_uuid).length === 0}>
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
                                <Button variant="outline" size="sm" onClick={() => handleBackup(db)}
                                    pending={busyKey === `bk-${db.database_uuid}`}>
                                    <i className="fa-solid fa-cloud-arrow-up" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">Backup</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button variant="outline" size="sm" onClick={() => { setRestoreDb(db); setRestorePath(''); }}>
                                    <i className="fa-solid fa-rotate-left" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">Restore</TooltipContent>
                    </Tooltip>
                    <Button variant="outline" tone="inactive" size="sm" onClick={() => handleDeleteDb(db)}
                        pending={busyKey === `del-db-${db.database_uuid}`} pendingText="Delete">
                        Delete
                    </Button>
                </div>
            ),
        },
    ];

    const userColumns: Column<any>[] = [
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
                const count = dbCountForUser(u.user_uuid);
                return (
                    <div className="flex items-center justify-end gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Badge variant={count > 0 ? 'default' : 'secondary'}
                                        className={`text-[10px] cursor-default ${count > 0 ? 'text-black' : 'text-muted-foreground'}`}>
                                        {count > 0 ? `${count} DB${count > 1 ? 's' : ''}` : 'No DBs'}
                                    </Badge>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">
                                {count > 0 ? `Attached to ${count} database${count > 1 ? 's' : ''}` : 'Not attached to any database'}
                            </TooltipContent>
                        </Tooltip>
                        <Button variant="outline" tone="inactive" size="sm" onClick={() => handleDeleteUser(u)}
                            pending={busyKey === `del-u-${u.user_uuid}`} pendingText="Delete">
                            Delete
                        </Button>
                    </div>
                );
            },
        },
    ];

    return (
        <TooltipProvider>
        <PageShell
            title="Database Manager"
            description="Provision databases, manage users, assign access, and run backups."
            actions={
                <SegmentedControl<DbTab>
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'databases', label: 'Databases' },
                        { value: 'users', label: 'Users' },
                        { value: 'assignments', label: 'Assignments' },
                    ]}
                />
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

            {/* ==================== DATABASES ==================== */}
            {tab === 'databases' && (
                <>
                    <Section
                        title="Provision new database"
                        description="Create a database and choose where clients may connect from."
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
                                    <Input id="db-name" value={newDbName} onChange={(e) => setNewDbName(e.target.value.trim())}
                                        placeholder="my_database" className="font-mono" />
                                </Field>
                            </FormGrid>

                            <Field label="Allowed hosts" htmlFor="db-hosts" hint="Where clients may connect from.">
                                <div className="flex items-center gap-3">
                                    {remoteAccess ? (
                                        <div className="flex h-9 flex-1 items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-3 font-mono text-sm text-amber-500">
                                            <i className="fa-solid fa-earth-americas mr-2" />All hosts permitted (%)
                                        </div>
                                    ) : (
                                        <Input id="db-hosts" value={newDbHosts} onChange={(e) => setNewDbHosts(e.target.value.trim())}
                                            placeholder="localhost" className="flex-1 font-mono" />
                                    )}
                                    <label className="flex shrink-0 cursor-pointer items-center gap-2">
                                        <span className="text-xs text-muted-foreground">All remote</span>
                                        <Switch checked={remoteAccess} onCheckedChange={setRemoteAccess} />
                                    </label>
                                </div>
                            </Field>

                            <div className="flex justify-end">
                                <Button ripple onClick={handleCreateDb}
                                    disabled={!newDbName || !isValidDbName(newDbName) || !actorId}
                                    pending={creating} pendingText="Creating…">
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
                                    <Input id="restore-path" value={restorePath} onChange={(e) => setRestorePath(e.target.value.trim())}
                                        placeholder="/var/backups/nydus/mysql/db_20260101.dump"
                                        className="flex-1 font-mono text-xs" />
                                    <Button ripple variant="outline" tone="warning" onClick={handleRestore} disabled={!restorePath}
                                        pending={restoreLoading} pendingText="Restoring…" className="shrink-0">
                                        Restore
                                    </Button>
                                    <Button variant="outline" onClick={() => { setRestoreDb(null); setRestorePath(''); }} className="shrink-0">
                                        Cancel
                                    </Button>
                                </div>
                            </Field>
                        </Section>
                    )}

                    <Section title="Active databases" description="Databases provisioned under your account" icon="fa-solid fa-database" flush>
                        <DataTable
                            columns={dbColumns}
                            rows={databases}
                            getRowId={(db) => db.database_uuid}
                            loading={loading}
                            empty={
                                <EmptyState
                                    icon="fa-solid fa-database"
                                    title="No databases provisioned yet"
                                    hint="Provision a database above to get started."
                                />
                            }
                        />
                    </Section>
                </>
            )}

            {/* ==================== USERS ==================== */}
            {tab === 'users' && (
                <>
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
                                        <Input id="user-name" value={newUsername} onChange={(e) => setNewUsername(e.target.value.trim())}
                                            placeholder="tewi_1029358398243"
                                            className="flex-1 rounded-r-none border-r-0 font-mono" />
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button type="button" onClick={randomizeName}
                                                    className="shrink-0 rounded-r-md border border-l-0 border-input bg-secondary px-3 text-sm text-muted-foreground transition-colors hover:text-primary">
                                                    <i className="fa-solid fa-shuffle" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-[10px]">Randomize Touhou name</TooltipContent>
                                        </Tooltip>
                                    </div>
                                </Field>
                                <Field label="Password" htmlFor="user-pass" required>
                                    <Input id="user-pass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Strong password" className="font-mono" />
                                </Field>
                            </FormGrid>

                            <div className="flex justify-end">
                                <Button ripple onClick={handleCreateUser}
                                    disabled={!newUsername || !newPassword || !actorId || usernameTaken}
                                    pending={creatingUser} pendingText="Creating…">
                                    <i className="fa-solid fa-user-plus" /> Create user
                                </Button>
                            </div>
                        </div>
                    </Section>

                    <Section title="All database users" description="Every user provisioned under your account" icon="fa-solid fa-users" flush>
                        <DataTable
                            columns={userColumns}
                            rows={dbUsers}
                            getRowId={(u) => u.user_uuid}
                            loading={loading}
                            empty={
                                <EmptyState
                                    icon="fa-solid fa-users"
                                    title="No database users found"
                                    hint="Create a user above to get started."
                                />
                            }
                        />
                    </Section>
                </>
            )}

            {/* ==================== ASSIGNMENTS ==================== */}
            {tab === 'assignments' && (
                <>
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
                                    <EmptyState icon="fa-solid fa-users" title="No users yet" hint="Create a database user to assign access." />
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
                                    />
                                </div>
                            ) : (
                                <div className="space-y-3 p-4 sm:p-6">
                                    {databases.map((db: any) => {
                                        const attached = usersForDatabase(db.database_uuid);
                                        const isOver = dragOverDb === db.database_uuid;
                                        return (
                                            <div
                                                key={db.database_uuid}
                                                onDragOver={(e) => { e.preventDefault(); setDragOverDb(db.database_uuid); }}
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
                                                    {isOver && dragUser && (
                                                        <span className="animate-pulse text-[10px] font-bold text-primary">
                                                            <i className="fa-solid fa-arrow-down mr-1" />Drop to assign {dragUser.username}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex min-h-[52px] flex-wrap items-center gap-2 px-4 py-3">
                                                    {attached.length === 0 && !isOver && (
                                                        <span className="text-xs italic text-muted-foreground/50">No users assigned — drag one here</span>
                                                    )}
                                                    <AnimatePresence initial={false}>
                                                        {attached.map((p: any) => (
                                                            <motion.div key={p.user_uuid}
                                                                layout
                                                                variants={listItem}
                                                                initial="hidden"
                                                                animate="show"
                                                                exit="exit"
                                                                className="flex items-center gap-1.5 rounded-sm border border-border bg-secondary px-2.5 py-1 font-mono text-xs">
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
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Section>
                    </div>
                </>
            )}

            {/* phpMyAdmin user picker modal */}
            <Dialog open={!!pmaDb} onOpenChange={(open) => { if (!open) { setPmaDb(null); setPmaUsers([]); } }}>
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
                            <button key={p.user_uuid}
                                onClick={() => redirectToPma(p.user_uuid)}
                                disabled={pmaLoading}
                                className="flex w-full cursor-pointer items-center justify-between border border-border bg-secondary px-4 py-3 text-left transition-colors hover:bg-border disabled:opacity-50">
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
    );
}
