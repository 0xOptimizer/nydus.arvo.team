'use client';

import { useState, useEffect } from 'react';
import {
    getDatabases,
    createDatabase,
    deleteDatabase,
    getDatabaseUsers,
    createDatabaseUser,
    deleteDatabaseUser,
    grantPrivileges,
    revokePrivileges,
    performBackup,
    restoreBackup
} from '@/app/actions/databases';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

// --- UI Primitives ---

const RippleButton = ({ children, onClick, className = '', disabled = false, variant = 'primary' }: any) => {
    const fire = (e: any) => {
        const btn = e.currentTarget;
        const circle = document.createElement('span');
        const d = Math.max(btn.clientWidth, btn.clientHeight);
        const r = d / 2;
        const rect = btn.getBoundingClientRect();
        circle.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - rect.left - r}px;top:${e.clientY - rect.top - r}px`;
        circle.classList.add('_rpl');
        btn.querySelector('._rpl')?.remove();
        btn.appendChild(circle);
        if (onClick) onClick(e);
    };
    const base = "relative overflow-hidden transition-all duration-150 px-4 py-2 text-[11px] font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed select-none";
    const v: any = {
        primary: "bg-primary text-black hover:brightness-110",
        danger:  "bg-transparent text-red-400 border border-red-800/60 hover:bg-red-950/40 hover:border-red-600",
        warning: "bg-transparent text-yellow-400 border border-yellow-800/60 hover:bg-yellow-950/40 hover:border-yellow-600",
        ghost:   "bg-transparent text-foreground border border-border hover:bg-secondary",
        outline: "bg-secondary text-foreground border border-border hover:bg-border",
    };
    return (
        <>
            <style jsx global>{`
                ._rpl{position:absolute;border-radius:50%;transform:scale(0);animation:_rpl 550ms linear;background:rgba(255,255,255,.18);pointer-events:none;}
                @keyframes _rpl{to{transform:scale(4);opacity:0;}}
            `}</style>
            <button disabled={disabled} onClick={fire} className={`${base} ${v[variant]} ${className}`}>
                <span className="relative z-10 flex items-center gap-1.5">{children}</span>
            </button>
        </>
    );
};

const FieldLabel = ({ children }: any) => (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{children}</p>
);

const MonoBadge = ({ children, className = '' }: any) => (
    <span className={`inline-block font-mono text-[10px] px-1.5 py-0.5 border rounded-sm ${className}`}>{children}</span>
);

const StatusDot = ({ active }: { active: boolean }) => (
    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${active ? 'bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.4)]' : 'bg-zinc-600'}`} />
);

const SectionDivider = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 my-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 shrink-0">{label}</span>
        <div className="flex-1 border-t border-border/50" />
    </div>
);

// --- Main Component ---

export default function DatabasesClient({ actorId }: { actorId: string }) {
    const [databases, setDatabases]   = useState<any[]>([]);
    const [dbUsers, setDbUsers]       = useState<any[]>([]);
    const [selectedDb, setSelectedDb] = useState<any | null>(null);
    const [loading, setLoading]       = useState(true);

    // Create DB form
    const [newDbName, setNewDbName]       = useState('');
    const [newDbType, setNewDbType]       = useState('mysql');
    const [newDbHosts, setNewDbHosts]     = useState('localhost');
    const [remoteAccess, setRemoteAccess] = useState(false);
    const [creating, setCreating]         = useState(false);

    // Create user form
    const [newUsername, setNewUsername]   = useState('');
    const [newPassword, setNewPassword]   = useState('');
    const [userDbType, setUserDbType]     = useState('mysql');
    const [creatingUser, setCreatingUser] = useState(false);

    // Grant form
    const [grantUserUuid, setGrantUserUuid] = useState('');
    const [grantUsername, setGrantUsername] = useState('');
    const [grantPriv, setGrantPriv]         = useState('ALL PRIVILEGES');
    const [grantLoading, setGrantLoading]   = useState(false);

    // Restore
    const [restorePath, setRestorePath]       = useState('');
    const [restoreLoading, setRestoreLoading] = useState(false);

    // UI feedback
    const [error, setError]     = useState<string | null>(null);
    const [successMsg, setSuccess] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };
    const err   = (msg: string) => { setError(msg);   setTimeout(() => setError(null), 6000); };

    const refreshAll = async () => {
        const [dbs, users] = await Promise.all([getDatabases(), getDatabaseUsers()]);
        setDatabases(Array.isArray(dbs) ? dbs : []);
        setDbUsers(Array.isArray(users) ? users : []);
    };

    useEffect(() => {
        (async () => { setLoading(true); await refreshAll(); setLoading(false); })();
    }, []);

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
        if (!isValidDbName(newDbName)) { err("Invalid name. Must start with a letter, alphanumeric + underscores only."); return; }
        if (!actorId) { err("Session not found."); return; }
        setCreating(true);
        const res = await createDatabase(newDbType, newDbName, effectiveHosts, actorId);
        if (res.success) { setNewDbName(''); setNewDbHosts('localhost'); setRemoteAccess(false); await refreshAll(); flash(`Database created — ${res.database_uuid}`); }
        else err(res.error || "Failed to create database.");
        setCreating(false);
    };

    const handleDeleteDb = async (db: any) => {
        if (!confirm(`Delete "${db.database_name}"? This is permanent.`)) return;
        if (!actorId) { err("Session not found."); return; }
        setBusyKey(`del-db-${db.database_uuid}`);
        const res = await deleteDatabase(db.database_uuid, db.database_name, db.database_type, actorId);
        if (res.success) { if (selectedDb?.database_uuid === db.database_uuid) setSelectedDb(null); await refreshAll(); flash(`"${db.database_name}" deleted.`); }
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
        if (!selectedDb || !restorePath.trim()) { err("Backup file path is required."); return; }
        if (!confirm(`Restore "${selectedDb.database_name}" from the given path? Existing data will be overwritten.`)) return;
        setRestoreLoading(true);
        const res = await restoreBackup(selectedDb.database_uuid, selectedDb.database_type, selectedDb.database_name, restorePath.trim());
        if (res.success) { setRestorePath(''); flash("Restore completed."); }
        else err(res.error || "Restore failed.");
        setRestoreLoading(false);
    };

    const handleGrant = async () => {
        if (!selectedDb || !grantUserUuid.trim() || !grantUsername.trim()) { err("Select a user to grant privileges to."); return; }
        if (!actorId) { err("Session not found."); return; }
        setGrantLoading(true);
        const res = await grantPrivileges(selectedDb.database_uuid, selectedDb.database_type, selectedDb.database_name, grantUserUuid.trim(), grantUsername.trim(), grantPriv, actorId);
        if (res.success) { setGrantUserUuid(''); setGrantUsername(''); flash(`Privileges granted on "${selectedDb.database_name}".`); }
        else err(res.error || "Failed to grant privileges.");
        setGrantLoading(false);
    };

    const handleRevoke = async (userUuid: string, username: string) => {
        if (!selectedDb) return;
        if (!confirm(`Revoke all privileges for "${username}" on "${selectedDb.database_name}"?`)) return;
        if (!actorId) { err("Session not found."); return; }
        setBusyKey(`rev-${userUuid}`);
        const res = await revokePrivileges(selectedDb.database_uuid, userUuid, selectedDb.database_type, selectedDb.database_name, username, actorId);
        if (res.success) flash(`Privileges revoked for "${username}".`);
        else err(res.error || "Failed to revoke.");
        setBusyKey(null);
    };

    // --- User handlers ---

    const handleCreateUser = async () => {
        if (!newUsername.trim() || !newPassword.trim()) { err("Username and password are required."); return; }
        if (!actorId) { err("Session not found."); return; }
        if (dbUsers.some((u: any) => u.username === newUsername.trim())) {
            err(`Username "${newUsername.trim()}" already exists. Use the shuffle button to generate a unique one.`);
            return;
        }
        setCreatingUser(true);
        const res = await createDatabaseUser(userDbType, newUsername.trim(), newPassword, actorId);
        if (res.success) { setNewUsername(''); setNewPassword(''); await refreshAll(); flash(`User created — ${res.user_uuid}`); }
        else err(res.error || "Failed to create user.");
        setCreatingUser(false);
    };

    const handleDeleteUser = async (u: any) => {
        if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
        if (!actorId) { err("Session not found."); return; }
        setBusyKey(`del-u-${u.user_uuid}`);
        const res = await deleteDatabaseUser(u.user_uuid, userDbType, u.username, actorId);
        if (res.success) { await refreshAll(); flash(`User "${u.username}" deleted.`); }
        else err(res.error || "Failed to delete user.");
        setBusyKey(null);
    };

    return (
        <TooltipProvider>
        <div className="space-y-6 max-w-6xl pb-24">

            {/* Page Header */}
            <div className="pb-5 border-b border-border flex items-end justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-px h-6 bg-primary" />
                        <h1 className="text-2xl font-black text-foreground uppercase tracking-tight font-mono">Database Manager</h1>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium pl-3">Provision databases · Manage users · Backups &amp; recovery</p>
                </div>
                {actorId && (
                    <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Acting as</p>
                        <MonoBadge className="border-primary/30 text-primary bg-primary/5">{actorId}</MonoBadge>
                    </div>
                )}
            </div>

            {/* Alerts */}
            {error && (
                <Alert className="bg-red-950/20 border border-red-900/40 text-red-300 text-xs font-mono py-3 flex items-center gap-2">
                    <i className="fa-solid fa-circle-xmark text-red-500 shrink-0" />
                    {error}
                </Alert>
            )}
            {successMsg && (
                <Alert className="bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 text-xs font-mono py-3 flex items-center gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-500 shrink-0" />
                    {successMsg}
                </Alert>
            )}

            {/* Tabs */}
            <Tabs defaultValue="databases">
                <TabsList className="bg-secondary border border-border rounded-none h-9 p-0">
                    <TabsTrigger value="databases" className="rounded-none text-[11px] font-bold uppercase tracking-widest px-6 h-full data-[state=active]:bg-primary data-[state=active]:text-black">
                        <i className="fa-solid fa-database mr-2" />Databases
                    </TabsTrigger>
                    <TabsTrigger value="users" className="rounded-none text-[11px] font-bold uppercase tracking-widest px-6 h-full data-[state=active]:bg-primary data-[state=active]:text-black">
                        <i className="fa-solid fa-users mr-2" />Users
                    </TabsTrigger>
                </TabsList>

                {/* ===================== DATABASES TAB ===================== */}
                <TabsContent value="databases" className="mt-6 space-y-6">

                    {/* Provision Form */}
                    <Card className="p-0 border-border bg-card overflow-hidden">
                        <div className="px-5 py-3 border-b border-border bg-secondary/50 flex items-center gap-2">
                            <i className="fa-solid fa-plus text-primary text-xs" />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-foreground">Provision New Database</span>
                        </div>
                        <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-2">
                                <FieldLabel>Engine</FieldLabel>
                                <select
                                    value={newDbType}
                                    onChange={(e) => setNewDbType(e.target.value)}
                                    className="w-full bg-background border border-border text-foreground text-xs font-mono p-2 outline-none focus:border-primary transition-colors"
                                >
                                    {DB_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-4">
                                <FieldLabel>
                                    Database Name{newDbName.length > 0 && !isValidDbName(newDbName) &&
                                        <span className="text-red-400 ml-2 normal-case font-normal"> — invalid format</span>}
                                </FieldLabel>
                                <Input
                                    value={newDbName}
                                    onChange={(e) => setNewDbName(e.target.value.trim())}
                                    placeholder="my_database"
                                    className="bg-background border-border font-mono text-sm focus:border-primary rounded-none"
                                />
                            </div>
                            <div className="md:col-span-4">
                                <div className="flex items-center justify-between mb-1.5">
                                    <FieldLabel>Allowed Hosts</FieldLabel>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Allow All Remote</span>
                                        <Switch checked={remoteAccess} onCheckedChange={setRemoteAccess} className="scale-75" />
                                    </label>
                                </div>
                                {remoteAccess ? (
                                    <div className="border border-yellow-800/50 bg-yellow-950/20 px-3 py-2 text-yellow-400 text-[11px] font-mono flex items-center gap-2">
                                        <i className="fa-solid fa-earth-americas text-xs" />
                                        All hosts permitted <span className="opacity-50 ml-1">(wildcard %)</span>
                                    </div>
                                ) : (
                                    <Input
                                        value={newDbHosts}
                                        onChange={(e) => setNewDbHosts(e.target.value.trim())}
                                        placeholder="localhost or 192.168.1.10"
                                        className="bg-background border-border font-mono text-sm focus:border-primary rounded-none"
                                    />
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <RippleButton
                                    onClick={handleCreateDb}
                                    disabled={!newDbName || !isValidDbName(newDbName) || !actorId || creating}
                                    className="w-full h-[38px] justify-center"
                                >
                                    {creating ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-plus" />Create</>}
                                </RippleButton>
                            </div>
                        </div>
                    </Card>

                    {/* Database List */}
                    <div>
                        <SectionDivider label="Active Databases" />
                        <div className="border border-border bg-card overflow-hidden">
                            {loading ? (
                                <div className="py-12 text-center text-muted-foreground text-xs font-mono tracking-widest animate-pulse">LOADING...</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-secondary/80 border-b border-border hover:bg-secondary/80">
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-6 pl-4" />
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Name</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-24">Engine</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Allowed Hosts</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">Created By</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-4">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {databases.map((db: any) => {
                                            const isSelected = selectedDb?.database_uuid === db.database_uuid;
                                            return (
                                                <TableRow
                                                    key={db.database_uuid}
                                                    onClick={() => setSelectedDb(isSelected ? null : db)}
                                                    className={`border-b border-border/50 cursor-pointer transition-all
                                                        ${isSelected
                                                            ? 'bg-primary/5 border-l-2 border-l-primary'
                                                            : 'hover:bg-secondary/50 border-l-2 border-l-transparent'}`}
                                                >
                                                    <TableCell className="pl-4 pr-0 w-6">
                                                        <StatusDot active={isSelected} />
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm font-semibold text-foreground">
                                                        {db.database_name}
                                                    </TableCell>
                                                    <TableCell>
                                                        <MonoBadge className="border-border text-muted-foreground">{db.database_type.toUpperCase()}</MonoBadge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {db.allowed_hosts === '*' || db.allowed_hosts === '%' ? (
                                                            <MonoBadge className="border-yellow-800/50 text-yellow-400 bg-yellow-950/20">
                                                                <i className="fa-solid fa-earth-americas mr-1 text-[9px]" />ALL REMOTE
                                                            </MonoBadge>
                                                        ) : (
                                                            <span className="font-mono text-xs text-muted-foreground">{db.allowed_hosts}</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground hidden md:table-cell">
                                                        {db.created_by}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex justify-end gap-1.5">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span>
                                                                        <RippleButton
                                                                            variant="ghost"
                                                                            disabled={busyKey === `bk-${db.database_uuid}`}
                                                                            onClick={() => handleBackup(db)}
                                                                            className="px-2.5 py-1 text-[10px]"
                                                                        >
                                                                            {busyKey === `bk-${db.database_uuid}`
                                                                                ? <i className="fa-solid fa-spinner fa-spin" />
                                                                                : <i className="fa-solid fa-cloud-arrow-up" />}
                                                                        </RippleButton>
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top" className="text-[10px]">Run Backup</TooltipContent>
                                                            </Tooltip>
                                                            <RippleButton
                                                                variant="danger"
                                                                disabled={busyKey === `del-db-${db.database_uuid}`}
                                                                onClick={() => handleDeleteDb(db)}
                                                                className="px-2.5 py-1 text-[10px]"
                                                            >
                                                                {busyKey === `del-db-${db.database_uuid}`
                                                                    ? <i className="fa-solid fa-spinner fa-spin" />
                                                                    : 'Delete'}
                                                            </RippleButton>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {databases.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground text-xs font-mono italic">
                                                    No databases provisioned yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>

                    {/* Selected DB Management Panel */}
                    {selectedDb && (
                        <div className="space-y-4 border border-primary/20 bg-primary/[0.02] p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Managing</p>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-base font-bold text-foreground">{selectedDb.database_name}</span>
                                        <MonoBadge className="border-border text-muted-foreground text-[9px]">{selectedDb.database_uuid}</MonoBadge>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedDb(null)} className="text-muted-foreground hover:text-foreground text-xs transition-colors">
                                    <i className="fa-solid fa-xmark" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Grant Privileges */}
                                <Card className="p-4 border-border bg-card rounded-none">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                                        <i className="fa-solid fa-key text-primary" />Grant Privileges
                                    </p>
                                    <div className="space-y-2.5">
                                        <div>
                                            <FieldLabel>Select User</FieldLabel>
                                            <select
                                                value={grantUserUuid}
                                                onChange={(e) => {
                                                    const picked = dbUsers.find((u: any) => u.user_uuid === e.target.value);
                                                    setGrantUserUuid(picked?.user_uuid ?? '');
                                                    setGrantUsername(picked?.username ?? '');
                                                }}
                                                className="w-full bg-background border border-border text-foreground text-xs font-mono p-2 outline-none focus:border-primary transition-colors h-8"
                                            >
                                                <option value="">— Pick a user —</option>
                                                {dbUsers.map((u: any) => (
                                                    <option key={u.user_uuid} value={u.user_uuid}>{u.username}</option>
                                                ))}
                                            </select>
                                            {grantUserUuid && (
                                                <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate" title={grantUserUuid}>
                                                    <span className="text-muted-foreground/50 mr-1">uuid</span>{grantUserUuid}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <FieldLabel>Privileges</FieldLabel>
                                            <select
                                                value={grantPriv}
                                                onChange={(e) => setGrantPriv(e.target.value)}
                                                className="w-full bg-background border border-border text-foreground text-xs font-mono p-2 outline-none focus:border-primary transition-colors h-8"
                                            >
                                                {PRIVILEGE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                        <RippleButton
                                            onClick={handleGrant}
                                            disabled={!grantUserUuid || !grantUsername || !actorId || grantLoading}
                                            className="w-full h-8 justify-center mt-1"
                                        >
                                            {grantLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-check" />Grant</>}
                                        </RippleButton>
                                    </div>
                                </Card>

                                {/* Restore */}
                                <Card className="p-4 border-border bg-card rounded-none">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                                        <i className="fa-solid fa-cloud-arrow-down text-primary" />Restore Backup
                                    </p>
                                    <div className="space-y-2.5">
                                        <div>
                                            <FieldLabel>Absolute Backup File Path</FieldLabel>
                                            <Input
                                                value={restorePath}
                                                onChange={(e) => setRestorePath(e.target.value.trim())}
                                                placeholder="/var/backups/nydus/mysql/db_20260101.dump"
                                                className="bg-background border-border font-mono text-xs focus:border-primary rounded-none h-8"
                                            />
                                        </div>
                                        <div className="border border-yellow-900/40 bg-yellow-950/10 px-3 py-2 text-yellow-400/80 text-[10px] font-mono flex items-start gap-2">
                                            <i className="fa-solid fa-triangle-exclamation shrink-0 mt-0.5" />
                                            <span>Restoring overwrites all data in <strong className="text-yellow-300">{selectedDb.database_name}</strong>.</span>
                                        </div>
                                        <RippleButton
                                            variant="warning"
                                            onClick={handleRestore}
                                            disabled={!restorePath || restoreLoading}
                                            className="w-full h-8 justify-center mt-1"
                                        >
                                            {restoreLoading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-rotate-left" />Restore</>}
                                        </RippleButton>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* ===================== USERS TAB ===================== */}
                <TabsContent value="users" className="mt-6 space-y-6">

                    {/* Create User Form */}
                    <Card className="p-0 border-border bg-card overflow-hidden">
                        <div className="px-5 py-3 border-b border-border bg-secondary/50 flex items-center gap-2">
                            <i className="fa-solid fa-user-plus text-primary text-xs" />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-foreground">Create Database User</span>
                        </div>
                        <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-2">
                                <FieldLabel>Engine</FieldLabel>
                                <select
                                    value={userDbType}
                                    onChange={(e) => setUserDbType(e.target.value)}
                                    className="w-full bg-background border border-border text-foreground text-xs font-mono p-2 outline-none focus:border-primary transition-colors"
                                >
                                    {DB_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-4">
                                <FieldLabel>
                                    Username
                                    {newUsername.length > 0 && dbUsers.some((u: any) => u.username === newUsername) &&
                                        <span className="text-red-400 ml-2 normal-case font-normal"> — already taken</span>}
                                </FieldLabel>
                                <div className="flex">
                                    <Input
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value.trim())}
                                        placeholder="tewi_1029358398243"
                                        className="bg-background border-border font-mono text-sm focus:border-primary rounded-none border-r-0 flex-1"
                                    />
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={randomizeName}
                                                className="border border-border border-l-0 bg-secondary px-3 text-muted-foreground hover:text-primary hover:bg-secondary/80 transition-colors text-xs shrink-0"
                                            >
                                                <i className="fa-solid fa-shuffle" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-[10px]">Randomize Touhou name</TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                            <div className="md:col-span-4">
                                <FieldLabel>Password</FieldLabel>
                                <Input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Strong password"
                                    className="bg-background border-border font-mono text-sm focus:border-primary rounded-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <RippleButton
                                    onClick={handleCreateUser}
                                    disabled={!newUsername || !newPassword || !actorId || creatingUser || dbUsers.some((u: any) => u.username === newUsername)}
                                    className="w-full h-[38px] justify-center"
                                >
                                    {creatingUser ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-plus" />Create</>}
                                </RippleButton>
                            </div>
                        </div>
                        <div className="px-5 pb-4">
                            <p className="text-[10px] text-muted-foreground font-mono border-l-2 border-border pl-3">
                                After creating a user, select a database in the <strong className="text-foreground">Databases</strong> tab and use the Grant Privileges panel to attach them.
                            </p>
                        </div>
                    </Card>

                    {/* Users List */}
                    <div>
                        <SectionDivider label="All Database Users" />
                        <div className="border border-border bg-card overflow-hidden">
                            {loading ? (
                                <div className="py-12 text-center text-muted-foreground text-xs font-mono tracking-widest animate-pulse">LOADING...</div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-secondary/80 border-b border-border hover:bg-secondary/80">
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-4">Username</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">UUID</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">Created By</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">Created At</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right pr-4">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dbUsers.map((u: any) => (
                                            <TableRow key={u.user_uuid} className="border-b border-border/50 hover:bg-secondary/30 transition-colors border-l-2 border-l-transparent hover:border-l-border">
                                                <TableCell className="font-mono text-sm font-semibold text-foreground pl-4">{u.username}</TableCell>
                                                <TableCell>
                                                    <MonoBadge className="border-border text-muted-foreground text-[9px]">{u.user_uuid}</MonoBadge>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground hidden md:table-cell">{u.created_by}</TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground hidden md:table-cell">
                                                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                                                </TableCell>
                                                <TableCell className="text-right pr-4">
                                                    <RippleButton
                                                        variant="danger"
                                                        disabled={busyKey === `del-u-${u.user_uuid}`}
                                                        onClick={() => handleDeleteUser(u)}
                                                        className="px-2.5 py-1 text-[10px]"
                                                    >
                                                        {busyKey === `del-u-${u.user_uuid}` ? <i className="fa-solid fa-spinner fa-spin" /> : 'Delete'}
                                                    </RippleButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {dbUsers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground text-xs font-mono italic">
                                                    No database users found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
        </TooltipProvider>
    );
}