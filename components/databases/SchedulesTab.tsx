'use client'

import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatRowSkeleton, TableRowsSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { PageShell } from '@/components/PageShell'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { staggerContainer, listItem } from '@/lib/motion'
import { getAllSchedules, toggleSchedule, forceRunSchedule } from '@/app/actions/databases'

type Schedule = {
    schedule_uuid: string
    database_uuid: string
    database_name: string
    name: string
    task_type: string
    phase: string
    interval_seconds: number
    enabled: number
    next_run_at: string | null
    created_at: string
}

const PHASE_LABELS: Record<string, string> = {
    validity:    'Validity',
    week1:       'Week 1',
    week1_plus:  'Week 1+',
    month1_plus: 'Month 1+',
    month3_plus: 'Month 3+',
}

function formatInterval(seconds: number): string {
    if (seconds < 3600)   return `${seconds / 60}m`
    if (seconds < 86400)  return `${seconds / 3600}h`
    if (seconds < 604800) return `${Math.round(seconds / 86400)}d`
    return `${Math.round(seconds / 604800)}w`
}

function formatDate(iso: string | null): string {
    if (!iso) return 'N/A'
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

export default function SchedulesTab() {
    const [schedules, setSchedules] = useState<Schedule[]>([])
    const [loading, setLoading]     = useState(true)
    const [filter, setFilter]       = useState('')
    const [busyKey, setBusyKey]     = useState<string | null>(null)
    const [error, setError]         = useState<string | null>(null)
    const [successMsg, setSuccess]  = useState<string | null>(null)

    const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000) }
    const err   = (msg: string) => { setError(msg);   setTimeout(() => setError(null), 6000) }

    const load = useCallback(async () => {
        setLoading(true)
        const result = await getAllSchedules()
        if (Array.isArray(result)) {
            setSchedules(result)
        } else {
            err('Failed to load schedules.')
        }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const handleToggle = async (s: Schedule) => {
        setBusyKey(`toggle-${s.schedule_uuid}`)
        const res = await toggleSchedule(s.schedule_uuid)
        if (res.success) {
            setSchedules(prev => prev.map(x =>
                x.schedule_uuid === s.schedule_uuid ? { ...x, enabled: s.enabled ? 0 : 1 } : x
            ))
            flash(`Schedule ${s.enabled ? 'disabled' : 'enabled'}.`)
        } else {
            err(res.error || 'Failed to toggle schedule.')
        }
        setBusyKey(null)
    }

    const handleRun = async (s: Schedule) => {
        setBusyKey(`run-${s.schedule_uuid}`)
        const res = await forceRunSchedule(s.schedule_uuid)
        if (res.success) {
            flash(`Schedule queued for immediate run. It will respect the semaphore.`)
        } else {
            err(res.error || 'Failed to run schedule.')
        }
        setBusyKey(null)
    }

    const filtered = filter.trim()
        ? schedules.filter(s => s.database_name?.toLowerCase().includes(filter.toLowerCase()))
        : schedules

    const activeCount  = schedules.filter(s => s.enabled).length
    const backupActive = schedules.filter(s => s.task_type === 'db_backup' && s.enabled).length

    return (
        <PageShell title="Schedules" description="Manage automated backup and validity schedules.">
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

            {loading && schedules.length === 0 ? (
                <StatRowSkeleton count={3} />
            ) : (
                <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-sm border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Total Schedules</p>
                        <AnimatedNumber value={schedules.length} className="text-2xl font-semibold mt-1 block" />
                    </div>
                    <div className="rounded-sm border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Active</p>
                        <AnimatedNumber value={activeCount} className="text-2xl font-semibold mt-1 block" />
                    </div>
                    <div className="rounded-sm border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Active Backup Schedules</p>
                        <AnimatedNumber value={backupActive} className="text-2xl font-semibold mt-1 block" />
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between gap-3">
                <Input
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="Filter by database name..."
                    className="max-w-sm text-sm"
                />
                <Button variant="outline" size="sm" onClick={load} pending={loading} pendingText="Refresh">
                    <i className="fa-solid fa-rotate-right mr-2" />
                    Refresh
                </Button>
            </div>

            <div className="overflow-hidden rounded-sm border border-border bg-card">
                {loading && filtered.length === 0 ? (
                    <TableRowsSkeleton rows={6} cols={7} />
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon="fa-solid fa-clock-rotate-left"
                        title="No schedules found"
                        hint={filter.trim() ? 'No schedules match your filter.' : 'Schedules are created automatically when databases are provisioned.'}
                        className="border-0"
                    />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Database</TableHead>
                                <TableHead>Phase</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Interval</TableHead>
                                <TableHead>Next Run</TableHead>
                                <TableHead className="w-16 text-center">Active</TableHead>
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
                                {filtered.map(s => (
                                    <motion.tr
                                        key={s.schedule_uuid}
                                        layout
                                        variants={listItem}
                                        exit="exit"
                                        className="border-b border-border transition-colors hover:bg-secondary/50"
                                    >
                                        <TableCell className="font-mono text-xs py-2.5 max-w-[130px] truncate">
                                            {s.database_name}
                                        </TableCell>
                                        <TableCell className="text-xs py-2.5">
                                            {PHASE_LABELS[s.phase] ?? s.phase}
                                        </TableCell>
                                        <TableCell className="py-2.5">
                                            <Badge variant="secondary" className="text-xs font-normal">
                                                {s.task_type === 'db_backup' ? 'Backup' : 'Validity'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs py-2.5 tabular-nums font-mono">
                                            {formatInterval(s.interval_seconds)}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground py-2.5 whitespace-nowrap">
                                            {formatDate(s.next_run_at)}
                                        </TableCell>
                                        <TableCell className="py-2.5 text-center">
                                            <span className={`inline-block w-2 h-2 rounded-full ${s.enabled ? 'bg-green-500' : 'bg-border'}`} />
                                        </TableCell>
                                        <TableCell className="text-right pr-4 py-2.5">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={!!busyKey}
                                                    pending={busyKey === `run-${s.schedule_uuid}`}
                                                    pendingText="Run"
                                                    onClick={() => handleRun(s)}
                                                >
                                                    Run
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    tone={s.enabled ? 'active' : 'inactive'}
                                                    disabled={!!busyKey}
                                                    pending={busyKey === `toggle-${s.schedule_uuid}`}
                                                    pendingText={s.enabled ? 'Disable' : 'Enable'}
                                                    onClick={() => handleToggle(s)}
                                                >
                                                    {s.enabled ? 'Disable' : 'Enable'}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </motion.tbody>
                    </Table>
                )}
            </div>
        </PageShell>
    )
}
