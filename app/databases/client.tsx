'use client';

import { useState, useEffect, useRef } from 'react';
import {
    getDatabases, createDatabase, deleteDatabase,
    getDatabaseUsers, createDatabaseUser, deleteDatabaseUser,
    grantPrivileges, revokePrivileges, getAllPrivileges,
    getPmaToken, performBackup, restoreBackup
} from '@/app/actions/databases';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

// --- UI Components ---

const RippleButton = ({ children, onClick, className = '', disabled = false, variant = 'primary' }: any) => {
    const createRipple = (event: any) => {
        const button = event.currentTarget;
        const circle = document.createElement('span');
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;
        const rect = button.getBoundingClientRect();
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - rect.left - radius}px`;
        circle.style.top = `${event.clientY - rect.top - radius}px`;
        circle.classList.add('ripple');
        const existing = button.getElementsByClassName('ripple')[0];
        if (existing) existing.remove();
        button.appendChild(circle);
        if (onClick) onClick(event);
    };

    const baseStyle = "relative overflow-hidden transition-all duration-200 px-4 py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed";
    const variants: any = {
        primary: "bg-primary text-black hover:bg-primary/90",
        danger: "bg-red-900/50 text-red-200 hover:bg-red-900/70 border border-red-700/50",
        warning: "bg-yellow-900/50 text-yellow-200 hover:bg-yellow-900/70 border border-yellow-700/50",
        outline: "bg-secondary text-foreground border border-border hover:bg-border",
        ghost: "bg-transparent text-foreground border border-border hover:bg-secondary",
        pma: "bg-orange-900/50 text-orange-200 hover:bg-orange-900/70 border border-orange-700/50",
    };

    return (
        <button disabled={disabled} onClick={createRipple} className={`${baseStyle} ${variants[variant]} ${className}`}>
            <span className="relative z-10">{children}</span>
            <style jsx global>{`
                span.ripple { position: absolute; border-radius: 50%; transform: scale(0); animation: ripple 600ms linear; background-color: rgba(255, 255, 255, 0.3); pointer-events: none; }
                @keyframes ripple { to { transform: scale(4); opacity: 0; } }
            `}</style>
        </button>
    );
};

// --- Main Component ---

export default function DatabasesClient({ actorId }: { actorId: string }) {
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
    const pmaFormRef                        = useRef<HTMLFormElement>(null);

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

    return (
        <TooltipProvider>
        <div className="space-y-8 max-w-6xl pb-20">

            {/* Header */}
            <div className="pb-6 border-b border-border">
                <h1 className="text-3xl font-bold text-foreground uppercase tracking-tight">Database Manager</h1>
                <p className="text-sm text-muted-foreground mt-2 font-medium">Provision databases, manage users, assign access, and run backups</p>
            </div>

            {/* Alerts */}
            {error && (
                <Alert className="mb-4 bg-red-950/30 border-red-900/50 text-red-200 text-xs font-bold">
                    <i className="fa-solid fa-triangle-exclamation mr-2"></i>{error}
                </Alert>
            )}
            {successMsg && (
                <Alert className="mb-4 bg-emerald-950/30 border-emerald-900/50 text-emerald-200 text-xs font-bold">
                    <i className="fa-solid fa-circle-check mr-2"></i>{successMsg}
                </Alert>
            )}

            {/* Tabs */}
            <Tabs defaultValue="databases">
                <TabsList className="bg-secondary border border-border rounded-none h-9 p-0">
                    <TabsTrigger value="databases" className="rounded-none text-xs font-bold uppercase tracking-widest px-6 h-full data-[state=active]:bg-primary data-[state=active]:text-black">
                        <i className="fa-solid fa-database mr-2" />Databases
                    </TabsTrigger>
                    <TabsTrigger value="users" className="rounded-none text-xs font-bold uppercase tracking-widest px-6 h-full data-[state=active]:bg-primary data-[state=active]:text-black">
                        <i className="fa-solid fa-users mr-2" />Users
                    </TabsTrigger>
                    <TabsTrigger value="assignments" className="rounded-none text-xs font-bold uppercase tracking-widest px-6 h-full data-[state=active]:bg-primary data-[state=active]:text-black">
                        <i className="fa-solid fa-link mr-2" />Assignments
                    </TabsTrigger>
                </TabsList>

                {/* ==================== DATABASES TAB ==================== */}
                <TabsContent value="databases" className="mt-8 space-y-8">

                    {/* Create */}
                    <Card className="p-6 border-border bg-card">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
                            <i className="fa-solid fa-plus-circle mr-2 text-primary"></i>
                            Provision New Database
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Engine</label>
                                <select value={newDbType} onChange={(e) => setNewDbType(e.target.value)}
                                    className="w-full bg-secondary border border-border text-foreground text-sm p-2 focus:border-primary outline-none transition-all">
                                    {DB_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-4">
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">
                                    Database Name
                                    {newDbName.length > 0 && !isValidDbName(newDbName) && <span className="text-red-400 ml-2 normal-case italic">(Invalid format)</span>}
                                </label>
                                <Input value={newDbName} onChange={(e) => setNewDbName(e.target.value.trim())}
                                    placeholder="my_database" className="bg-background border-border font-mono text-sm focus:border-primary" />
                            </div>
                            <div className="md:col-span-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-bold text-muted-foreground uppercase">Allowed Hosts</label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <span className="text-xs text-muted-foreground">All Remote</span>
                                        <Switch checked={remoteAccess} onCheckedChange={setRemoteAccess} />
                                    </label>
                                </div>
                                {remoteAccess ? (
                                    <div className="border border-yellow-800/50 bg-yellow-950/20 px-3 py-2 text-yellow-400 text-xs font-mono flex items-center gap-2">
                                        <i className="fa-solid fa-earth-americas" />All hosts permitted (%)
                                    </div>
                                ) : (
                                    <Input value={newDbHosts} onChange={(e) => setNewDbHosts(e.target.value.trim())}
                                        placeholder="localhost" className="bg-background border-border font-mono text-sm focus:border-primary" />
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <RippleButton onClick={handleCreateDb}
                                    disabled={!newDbName || !isValidDbName(newDbName) || !actorId || creating}
                                    className="w-full h-10 flex items-center justify-center gap-2">
                                    {creating ? <i className="fa-solid fa-spinner fa-spin" /> : 'Create'}
                                </RippleButton>
                            </div>
                        </div>
                    </Card>

                    {/* Restore modal trigger row */}
                    {restoreDb && (
                        <Card className="p-4 border-yellow-800/40 bg-yellow-950/10">
                            <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3">
                                <i className="fa-solid fa-rotate-left mr-2" />Restoring: {restoreDb.database_name}
                            </p>
                            <div className="flex gap-3 items-end">
                                <div className="flex-1">
                                    <Input value={restorePath} onChange={(e) => setRestorePath(e.target.value.trim())}
                                        placeholder="/var/backups/nydus/mysql/db_20260101.dump"
                                        className="bg-background border-border font-mono text-xs focus:border-primary" />
                                </div>
                                <RippleButton variant="warning" onClick={handleRestore} disabled={!restorePath || restoreLoading}
                                    className="h-10 flex items-center gap-2">
                                    {restoreLoading ? <i className="fa-solid fa-spinner fa-spin" /> : 'Restore'}
                                </RippleButton>
                                <RippleButton variant="outline" onClick={() => { setRestoreDb(null); setRestorePath(''); }}
                                    className="h-10">Cancel</RippleButton>
                            </div>
                        </Card>
                    )}

                    {/* List */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Active Databases</h3>
                        <Card className="border-border bg-card overflow-hidden">
                            {loading && databases.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">Loading databases...</div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-secondary border-b border-border">
                                        <TableRow className="border-border">
                                            <TableHead className="font-bold text-foreground uppercase text-xs">Name</TableHead>
                                            <TableHead className="font-bold text-foreground uppercase text-xs w-24">Engine</TableHead>
                                            <TableHead className="font-bold text-foreground uppercase text-xs">Hosts</TableHead>
                                            <TableHead className="font-bold text-foreground uppercase text-xs w-20">Users</TableHead>
                                            <TableHead className="font-bold text-foreground uppercase text-xs text-right pr-4">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {databases.map((db: any) => (
                                            <TableRow key={db.database_uuid} className="border-b border-border hover:bg-secondary/50 transition-colors">
                                                <TableCell className="font-mono text-sm font-semibold text-foreground">{db.database_name}</TableCell>
                                                <TableCell>
                                                    <Badge variant="default" className="text-xs font-bold uppercase text-black">{db.database_type}</Badge>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {db.allowed_hosts === '*' || db.allowed_hosts === '%'
                                                        ? <span className="text-yellow-500"><i className="fa-solid fa-earth-americas mr-1" />All</span>
                                                        : db.allowed_hosts}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="text-xs">{usersForDatabase(db.database_uuid).length}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-4">
                                                    <div className="flex justify-end gap-1.5">
                                                        {db.database_type === 'mysql' && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span>
                                                                        <RippleButton variant="pma" onClick={() => handlePmaClick(db)}
                                                                            disabled={usersForDatabase(db.database_uuid).length === 0}
                                                                            className="px-2.5 py-1 text-[10px]">
                                                                            <i className="fa-solid fa-table-cells" />
                                                                        </RippleButton>
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top" className="text-[10px]">Open phpMyAdmin</TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span>
                                                                    <RippleButton variant="outline" onClick={() => handleBackup(db)}
                                                                        disabled={busyKey === `bk-${db.database_uuid}`}
                                                                        className="px-2.5 py-1 text-[10px]">
                                                                        {busyKey === `bk-${db.database_uuid}` ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-cloud-arrow-up" />}
                                                                    </RippleButton>
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="text-[10px]">Backup</TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span>
                                                                    <RippleButton variant="outline" onClick={() => { setRestoreDb(db); setRestorePath(''); }}
                                                                        className="px-2.5 py-1 text-[10px]">
                                                                        <i className="fa-solid fa-rotate-left" />
                                                                    </RippleButton>
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="text-[10px]">Restore</TooltipContent>
                                                        </Tooltip>
                                                        <RippleButton variant="danger" onClick={() => handleDeleteDb(db)}
                                                            disabled={busyKey === `del-db-${db.database_uuid}`}
                                                            className="px-2.5 py-1 text-[10px]">
                                                            {busyKey === `del-db-${db.database_uuid}` ? <i className="fa-solid fa-spinner fa-spin" /> : 'Delete'}
                                                        </RippleButton>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {databases.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="px-6 py-8 text-center text-muted-foreground italic">
                                                    No databases provisioned yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </Card>
                    </div>
                </TabsContent>

                {/* ==================== USERS TAB ==================== */}
                <TabsContent value="users" className="mt-8 space-y-8">

                    {/* Create */}
                    <Card className="p-6 border-border bg-card">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
                            <i className="fa-solid fa-user-plus mr-2 text-primary"></i>
                            Create Database User
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Engine</label>
                                <select value={userDbType} onChange={(e) => setUserDbType(e.target.value)}
                                    className="w-full bg-secondary border border-border text-foreground text-sm p-2 focus:border-primary outline-none transition-all">
                                    {DB_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-4">
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">
                                    Username
                                    {newUsername.length > 0 && dbUsers.some((u: any) => u.username === newUsername) && <span className="text-red-400 ml-2 normal-case italic">(Taken)</span>}
                                </label>
                                <div className="flex">
                                    <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value.trim())}
                                        placeholder="tewi_1029358398243"
                                        className="bg-background border-border font-mono text-sm focus:border-primary flex-1 border-r-0" />
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button onClick={randomizeName}
                                                className="border border-border border-l-0 bg-secondary px-3 text-muted-foreground hover:text-primary transition-colors text-sm shrink-0">
                                                <i className="fa-solid fa-shuffle" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-[10px]">Randomize Touhou name</TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                            <div className="md:col-span-4">
                                <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Password</label>
                                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Strong password"
                                    className="bg-background border-border font-mono text-sm focus:border-primary" />
                            </div>
                            <div className="md:col-span-2">
                                <RippleButton onClick={handleCreateUser}
                                    disabled={!newUsername || !newPassword || !actorId || creatingUser || dbUsers.some((u: any) => u.username === newUsername)}
                                    className="w-full h-10 flex items-center justify-center gap-2">
                                    {creatingUser ? <i className="fa-solid fa-spinner fa-spin" /> : 'Create'}
                                </RippleButton>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4 border-l-2 border-border pl-3">
                            After creating a user, head to the <strong className="text-foreground">Assignments</strong> tab to attach them to a database.
                        </p>
                    </Card>

                    {/* List */}
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
                                            const count = dbCountForUser(u.user_uuid);
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
                                                                        <Badge variant={count > 0 ? 'default' : 'secondary'}
                                                                            className={`text-xs font-bold cursor-default ${count > 0 ? 'text-black' : 'text-muted-foreground'}`}>
                                                                            {count > 0 ? `${count} DB${count > 1 ? 's' : ''}` : 'No DBs'}
                                                                        </Badge>
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top" className="text-[10px]">
                                                                    {count > 0 ? `Attached to ${count} database${count > 1 ? 's' : ''}` : 'Not attached to any database'}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                            <RippleButton variant="danger" onClick={() => handleDeleteUser(u)}
                                                                disabled={busyKey === `del-u-${u.user_uuid}`}
                                                                className="px-2.5 py-1 text-[10px]">
                                                                {busyKey === `del-u-${u.user_uuid}` ? <i className="fa-solid fa-spinner fa-spin" /> : 'Delete'}
                                                            </RippleButton>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
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
                </TabsContent>

                {/* ==================== ASSIGNMENTS TAB ==================== */}
                <TabsContent value="assignments" className="mt-8">
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1">
                            <i className="fa-solid fa-link mr-2 text-primary"></i>
                            Assign Users to Databases
                        </h3>
                        <p className="text-xs text-muted-foreground">Drag a user from the left panel and drop them onto a database to assign access.</p>
                    </div>

                    {/* Pending assignment confirmation */}
                    {pendingAssign && (
                        <Card className="p-4 mb-6 border-primary/40 bg-primary/5">
                            <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                                <i className="fa-solid fa-arrow-right mr-2 text-primary" />
                                Assign <span className="text-primary font-mono">{pendingAssign.user.username}</span> to <span className="text-primary font-mono">{pendingAssign.db.database_name}</span>
                            </p>
                            <div className="flex items-center gap-3">
                                <select value={assignPriv} onChange={(e) => setAssignPriv(e.target.value)}
                                    className="bg-secondary border border-border text-foreground text-xs font-mono p-2 outline-none focus:border-primary transition-all flex-1 max-w-xs">
                                    {PRIVILEGE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <RippleButton onClick={handleConfirmAssign} disabled={assigning}
                                    className="h-9 flex items-center gap-2 px-5">
                                    {assigning ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-check" />Confirm</>}
                                </RippleButton>
                                <RippleButton variant="outline" onClick={() => setPendingAssign(null)} className="h-9">Cancel</RippleButton>
                            </div>
                        </Card>
                    )}

                    <div className="flex gap-4 min-h-[500px]">

                        {/* Left: Users (20%) */}
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
                                                select-none transition-all hover:bg-secondary/60 group
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

                        {/* Right: Databases (80%) */}
                        <div className="flex-1 space-y-3">
                            {databases.length === 0 && (
                                <div className="border border-dashed border-border p-12 text-center text-muted-foreground text-sm italic">
                                    No databases provisioned yet.
                                </div>
                            )}
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
                                            border bg-card transition-all duration-150
                                            ${isOver
                                                ? 'border-primary border-dashed bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]'
                                                : 'border-border'}
                                        `}
                                    >
                                        {/* Database header */}
                                        <div className={`px-4 py-3 border-b flex items-center justify-between transition-colors ${isOver ? 'border-primary/30 bg-primary/5' : 'border-border bg-secondary/40'}`}>
                                            <div className="flex items-center gap-3">
                                                <Badge variant="default" className="text-[10px] font-bold uppercase text-black shrink-0">{db.database_type}</Badge>
                                                <span className="font-mono text-sm font-bold text-foreground">{db.database_name}</span>
                                                {db.allowed_hosts === '*' || db.allowed_hosts === '%'
                                                    ? <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-800/50"><i className="fa-solid fa-earth-americas mr-1" />All Hosts</Badge>
                                                    : <span className="text-[10px] text-muted-foreground font-mono">{db.allowed_hosts}</span>
                                                }
                                            </div>
                                            {isOver && dragUser && (
                                                <span className="text-[10px] text-primary font-bold animate-pulse">
                                                    <i className="fa-solid fa-arrow-down mr-1" />Drop to assign {dragUser.username}
                                                </span>
                                            )}
                                        </div>

                                        {/* Attached users */}
                                        <div className="px-4 py-3 min-h-[52px] flex flex-wrap gap-2 items-center">
                                            {attached.length === 0 && !isOver && (
                                                <span className="text-xs text-muted-foreground/50 italic">No users assigned — drag one here</span>
                                            )}
                                            {attached.map((p: any) => (
                                                <div key={p.user_uuid}
                                                    className="flex items-center gap-1.5 bg-secondary border border-border px-2.5 py-1 text-xs font-mono group/chip">
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
                                );
                            })}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* phpMyAdmin user picker modal */}
            <Dialog open={!!pmaDb} onOpenChange={(open) => { if (!open) { setPmaDb(null); setPmaUsers([]); } }}>
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
                            <button key={p.user_uuid}
                                onClick={() => redirectToPma(p.user_uuid)}
                                disabled={pmaLoading}
                                className="w-full flex items-center justify-between px-4 py-3 bg-secondary hover:bg-border border border-border transition-colors text-left disabled:opacity-50 cursor-pointer">
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
    );
}