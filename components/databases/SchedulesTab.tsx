'use client'

import { useState, useEffect, useCallback } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatRowSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { PageShell } from '@/components/PageShell'
import { Section } from '@/components/ui/section'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusChip } from '@/components/StatusChip'
import { AnimatedNumber } from '@/components/AnimatedNumber'
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

    const columns: Column<Schedule>[] = [
        {
            key: 'database',
            header: 'Database',
            render: (s) => (
                <span className="block max-w-[150px] truncate font-mono text-xs text-foreground">{s.database_name}</span>
            ),
        },
        {
            key: 'phase',
            header: 'Phase',
            render: (s) => <span className="text-xs">{PHASE_LABELS[s.phase] ?? s.phase}</span>,
        },
        {
            key: 'type',
            header: 'Type',
            render: (s) => (
                <Badge variant="secondary" className="text-[10px] font-normal">
                    {s.task_type === 'db_backup' ? 'Backup' : 'Validity'}
                </Badge>
            ),
        },
        {
            key: 'interval',
            header: 'Interval',
            render: (s) => (
                <span className="font-mono text-xs tabular-nums">{formatInterval(s.interval_seconds)}</span>
            ),
        },
        {
            key: 'next',
            header: 'Next run',
            render: (s) => (
                <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(s.next_run_at)}</span>
            ),
        },
        {
            key: 'state',
            header: 'State',
            render: (s) => (
                <StatusChip label={s.enabled ? 'Enabled' : 'Disabled'} state={s.enabled ? 'ok' : 'unknown'} />
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (s) => (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!!busyKey}
                        pending={busyKey === `run-${s.schedule_uuid}`}
                        pendingText="Run"
                        onClick={() => handleRun(s)}
                    >
                        <i className="fa-solid fa-play" /> Run
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
            ),
        },
    ]

    return (
        <PageShell
            title="Schedules"
            description="Manage automated backup and validity schedules."
            actions={
                <Button variant="outline" size="sm" onClick={load} pending={loading} pendingText="Refreshing…">
                    <i className="fa-solid fa-rotate" /> Refresh
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

            {loading && schedules.length === 0 ? (
                <StatRowSkeleton count={3} />
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Section bodyClassName="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total schedules</p>
                        <AnimatedNumber value={schedules.length} className="mt-2 block text-2xl font-semibold" />
                    </Section>
                    <Section bodyClassName="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active</p>
                        <AnimatedNumber value={activeCount} className="mt-2 block text-2xl font-semibold" />
                    </Section>
                    <Section bodyClassName="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active backup schedules</p>
                        <AnimatedNumber value={backupActive} className="mt-2 block text-2xl font-semibold" />
                    </Section>
                </div>
            )}

            <Section
                title="Schedules"
                description="Automated jobs that run against your databases"
                icon="fa-solid fa-clock-rotate-left"
                flush
                actions={
                    <Input
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder="Filter by database…"
                        className="h-8 w-44 sm:w-64"
                    />
                }
            >
                <DataTable
                    columns={columns}
                    rows={filtered}
                    getRowId={(s) => s.schedule_uuid}
                    loading={loading}
                    skeletonRows={6}
                    empty={
                        <EmptyState
                            icon="fa-solid fa-clock-rotate-left"
                            title={filter.trim() ? 'No matching schedules' : 'No schedules found'}
                            hint={filter.trim() ? 'No schedules match your filter.' : 'Schedules are created automatically when databases are provisioned.'}
                        />
                    }
                />
            </Section>
        </PageShell>
    )
}
