'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { startUpload, type UploadStatus, type UploadController } from '@/lib/tusUpload'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import { PageShell } from '@/components/PageShell'
import { Section } from '@/components/ui/section'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState } from '@/components/EmptyState'
import { SegmentedControl } from '@/components/ui/segmented'

const MAX_FILES = 10
const PREVIEW_TEXT_LIMIT = 1500

type UploadType = 'general' | 'phpmyadmin'

interface QueueEntry {
    id: string
    file: File
    status: UploadStatus
    progress: number
    controller: UploadController | null
    previewContent: string | null
    previewType: 'image' | 'text' | 'none'
    addedAt: Date
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function fileIcon(name: string, mime: string): string {
    if (mime.startsWith('image/')) return 'fa-solid fa-file-image'
    if (mime.startsWith('video/')) return 'fa-solid fa-file-video'
    if (mime.startsWith('audio/')) return 'fa-solid fa-file-audio'
    if (mime === 'application/pdf') return 'fa-solid fa-file-pdf'
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip')) return 'fa-solid fa-file-zipper'
    if (mime.startsWith('text/') || /\.(sql|json|csv|log|xml|yaml|yml|md)$/i.test(name)) return 'fa-solid fa-file-code'
    return 'fa-solid fa-file'
}

function statusBadgeVariant(status: UploadStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (status === 'uploading') return 'default'
    if (status === 'complete') return 'secondary'
    if (status === 'error') return 'destructive'
    return 'outline'
}

async function readPreview(file: File): Promise<{ content: string; type: 'image' | 'text' | 'none' }> {
    const isImage = file.type.startsWith('image/')
    const isText = file.type.startsWith('text/') || /\.(sql|json|csv|log|xml|yaml|yml|md)$/i.test(file.name)

    if (isImage) {
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = e => resolve({ content: (e.target?.result as string) ?? '', type: 'image' })
            reader.onerror = () => resolve({ content: '', type: 'none' })
            reader.readAsDataURL(file)
        })
    }

    if (isText) {
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = e => resolve({ content: (e.target?.result as string) ?? '', type: 'text' })
            reader.onerror = () => resolve({ content: '', type: 'none' })
            reader.readAsText(file.slice(0, PREVIEW_TEXT_LIMIT))
        })
    }

    return { content: '', type: 'none' }
}

export default function UploadPage() {
    const [uploadType, setUploadType] = useState<UploadType>('general')
    const [queue, setQueue] = useState<QueueEntry[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMsg, setSuccess] = useState<string | null>(null)

    const dragCounter = useRef(0)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const processingRef = useRef(false)
    const uploadTypeRef = useRef<UploadType>(uploadType)

    useEffect(() => { uploadTypeRef.current = uploadType }, [uploadType])

    const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000) }
    const err = (msg: string) => { setError(msg); setTimeout(() => setError(null), 6000) }

    const selectedEntry = queue.find(q => q.id === selectedId) ?? null
    const recentCompleted = [...queue].filter(q => q.status === 'complete').slice(-6).reverse()
    const activeCount = queue.filter(
        q => q.status !== 'cancelled' && q.status !== 'error' && q.status !== 'complete'
    ).length

    useEffect(() => {
        if (processingRef.current) return
        const active = queue.find(q => q.status === 'uploading' || q.status === 'paused')
        if (active) return
        const next = queue.find(q => q.status === 'idle')
        if (!next) return

        processingRef.current = true

        const controller = startUpload(
            next.file,
            {
                filename: next.file.name,
                filetype: next.file.type || 'application/octet-stream',
                upload_type: uploadTypeRef.current,
            },
            {
                onProgress(sent, total) {
                    setQueue(prev =>
                        prev.map(e => e.id === next.id
                            ? { ...e, progress: total ? Math.round((sent / total) * 100) : 0 }
                            : e
                        )
                    )
                },
                onStatusChange(status) {
                    setQueue(prev => prev.map(e => e.id === next.id ? { ...e, status } : e))
                    if (status === 'complete' || status === 'error' || status === 'cancelled') {
                        processingRef.current = false
                    }
                },
                onSuccess() {
                    flash(`"${next.file.name}" uploaded.`)
                },
                onError(e) {
                    err(`"${next.file.name}" failed: ${e.message}`)
                    processingRef.current = false
                },
            }
        )

        setQueue(prev =>
            prev.map(e => e.id === next.id ? { ...e, status: 'uploading', controller } : e)
        )
    }, [queue])

    const addFiles = useCallback(async (raw: FileList | File[]) => {
        const incoming = Array.from(raw)
        const activeCount = queue.filter(
            q => q.status !== 'cancelled' && q.status !== 'error' && q.status !== 'complete'
        ).length
        const slots = MAX_FILES - activeCount

        if (slots <= 0) {
            err(`Queue is full. Maximum ${MAX_FILES} files allowed.`)
            return
        }

        const toAdd = incoming.slice(0, slots)
        if (incoming.length > slots) {
            err(`${incoming.length - slots} file(s) skipped — only ${slots} slot(s) remaining.`)
        }

        const entries: QueueEntry[] = await Promise.all(
            toAdd.map(async (file) => {
                const preview = await readPreview(file)
                return {
                    id: crypto.randomUUID(),
                    file,
                    status: 'idle' as UploadStatus,
                    progress: 0,
                    controller: null,
                    previewContent: preview.content || null,
                    previewType: preview.type,
                    addedAt: new Date(),
                }
            })
        )

        setQueue(prev => [...prev, ...entries])
    }, [queue])

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        dragCounter.current++
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        dragCounter.current--
        if (dragCounter.current === 0) setIsDragging(false)
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        dragCounter.current = 0
        setIsDragging(false)
        if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
    }, [addFiles])

    const handlePauseResume = async (entry: QueueEntry) => {
        if (!entry.controller) return
        if (entry.status === 'uploading') {
            await entry.controller.pause()
        } else if (entry.status === 'paused') {
            entry.controller.resume()
        }
    }

    const handleCancel = async (entry: QueueEntry) => {
        if (entry.controller && (entry.status === 'uploading' || entry.status === 'paused')) {
            await entry.controller.abort()
        } else {
            setQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'cancelled' } : e))
            processingRef.current = false
        }
    }

    const handleRemove = (id: string) => {
        setQueue(prev => prev.filter(e => e.id !== id))
        if (selectedId === id) setSelectedId(null)
    }

    const handleClearFinished = () => {
        const removedIds = new Set(
            queue
                .filter(e => e.status === 'complete' || e.status === 'cancelled' || e.status === 'error')
                .map(e => e.id)
        )
        setQueue(prev => prev.filter(e => !removedIds.has(e.id)))
        if (selectedId && removedIds.has(selectedId)) setSelectedId(null)
    }

    const hasFinished = queue.some(
        q => q.status === 'complete' || q.status === 'cancelled' || q.status === 'error'
    )

    const queueColumns: Column<QueueEntry>[] = [
        {
            key: 'name',
            header: 'Name',
            render: (entry) => (
                <div className="flex min-w-0 items-center gap-2.5">
                    <i className={`${fileIcon(entry.file.name, entry.file.type)} shrink-0 text-sm text-muted-foreground`} />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="block max-w-[220px] truncate font-mono text-xs">
                                {entry.file.name}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="p-1.5">
                            {entry.previewType === 'image' && entry.previewContent ? (
                                <img
                                    src={entry.previewContent}
                                    alt=""
                                    className="max-h-44 max-w-[240px] rounded object-contain"
                                />
                            ) : entry.previewType === 'text' && entry.previewContent ? (
                                <pre className="max-h-36 max-w-xs overflow-hidden whitespace-pre-wrap font-mono text-[10px]">
                                    {entry.previewContent.slice(0, 500)}
                                </pre>
                            ) : (
                                <span className="text-xs">{entry.file.name} ({formatBytes(entry.file.size)})</span>
                            )}
                        </TooltipContent>
                    </Tooltip>
                </div>
            ),
        },
        {
            key: 'size',
            header: 'Size',
            className: 'text-xs text-muted-foreground tabular-nums',
            render: (entry) => formatBytes(entry.file.size),
        },
        {
            key: 'type',
            header: 'Type',
            className: 'font-mono text-xs text-muted-foreground',
            render: (entry) =>
                entry.file.type ? (entry.file.type.split('/')[1] ?? entry.file.type) : '—',
        },
        {
            key: 'status',
            header: 'Status',
            render: (entry) => (
                <Badge
                    variant={statusBadgeVariant(entry.status)}
                    className="text-[10px] font-normal capitalize"
                >
                    {entry.status}
                </Badge>
            ),
        },
        {
            key: 'progress',
            header: 'Progress',
            headClassName: 'w-36',
            render: (entry) =>
                (entry.status === 'uploading' || entry.status === 'paused') ? (
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                    entry.status === 'paused' ? 'bg-muted-foreground' : 'bg-primary'
                                }`}
                                style={{ width: `${entry.progress}%` }}
                            />
                        </div>
                        <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground">
                            {entry.progress}%
                        </span>
                    </div>
                ) : entry.status === 'complete' ? (
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full w-full rounded-full bg-green-500" />
                        </div>
                        <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground">
                            100%
                        </span>
                    </div>
                ) : (
                    <span className="text-[10px] text-muted-foreground/60">—</span>
                ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (entry) => (
                <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                    {(entry.status === 'uploading' || entry.status === 'paused') && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handlePauseResume(entry)}
                                    >
                                        <i className={`fa-solid ${entry.status === 'uploading' ? 'fa-pause' : 'fa-play'} text-[10px]`} />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                {entry.status === 'uploading' ? 'Pause' : 'Resume'}
                            </TooltipContent>
                        </Tooltip>
                    )}

                    {(entry.status === 'uploading' || entry.status === 'paused' || entry.status === 'idle') && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button
                                        variant="outline"
                                        tone="inactive"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleCancel(entry)}
                                    >
                                        <i className="fa-solid fa-xmark text-[10px]" />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">Cancel</TooltipContent>
                        </Tooltip>
                    )}

                    {(entry.status === 'complete' || entry.status === 'cancelled' || entry.status === 'error') && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleRemove(entry.id)}
                                    >
                                        <i className="fa-solid fa-trash text-[10px]" />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">Remove</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            ),
        },
    ]

    return (
        <TooltipProvider>
            <PageShell
                title="Upload"
                description="Upload files to the server or phpMyAdmin import directory."
                meta={
                    <Badge variant="secondary" className="text-[10px] uppercase tabular-nums">
                        {activeCount} / {MAX_FILES} queued
                    </Badge>
                }
                actions={
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={e => {
                                if (e.target.files) {
                                    addFiles(e.target.files)
                                    e.target.value = ''
                                }
                            }}
                        />
                        {hasFinished && (
                            <Button variant="outline" size="sm" onClick={handleClearFinished}>
                                <i className="fa-solid fa-broom" /> Clear finished
                            </Button>
                        )}
                        <Button ripple size="sm" onClick={() => fileInputRef.current?.click()}>
                            <i className="fa-solid fa-plus" /> Add files
                        </Button>
                    </>
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

                <Section
                    title="Destination"
                    description="Where dropped files are routed on upload."
                    icon="fa-solid fa-bullseye"
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <SegmentedControl
                            value={uploadType}
                            onChange={setUploadType}
                            options={[
                                { value: 'general', label: 'General' },
                                { value: 'phpmyadmin', label: 'phpMyAdmin' },
                            ]}
                        />
                        <span className="text-xs text-muted-foreground">
                            {uploadType === 'phpmyadmin'
                                ? 'SQL export files for database import'
                                : 'Any file type accepted'}
                        </span>
                    </div>
                </Section>

                <div className="flex flex-col gap-6 lg:flex-row">
                    <div
                        className="min-w-0 flex-1"
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <Section
                            title="Queue"
                            description="Files are uploaded one at a time, in order."
                            icon="fa-solid fa-list"
                            className={isDragging ? 'border-primary' : undefined}
                            actions={
                                isDragging ? (
                                    <span className="animate-pulse text-xs text-primary">Drop to add</span>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] font-normal tabular-nums">
                                        {activeCount} / {MAX_FILES}
                                    </Badge>
                                )
                            }
                            flush
                        >
                            {isDragging ? (
                                <div className="m-3 rounded-sm border-2 border-dashed border-primary p-10 text-center pointer-events-none">
                                    <i className="fa-solid fa-cloud-arrow-up mb-2 block text-2xl text-primary" />
                                    <p className="text-sm text-primary">Drop to add to queue</p>
                                </div>
                            ) : (
                                <DataTable
                                    columns={queueColumns}
                                    rows={queue}
                                    getRowId={(entry) => entry.id}
                                    onRowClick={(entry) => setSelectedId(entry.id)}
                                    empty={
                                        <EmptyState
                                            icon="fa-solid fa-cloud-arrow-up"
                                            title="No files queued"
                                            hint={`Drag files here or use Add files. Up to ${MAX_FILES} at a time.`}
                                            action={
                                                <Button ripple size="sm" onClick={() => fileInputRef.current?.click()}>
                                                    <i className="fa-solid fa-plus" /> Add files
                                                </Button>
                                            }
                                        />
                                    }
                                />
                            )}
                        </Section>

                        {recentCompleted.length > 0 && (
                            <div className="mt-6">
                                <Section
                                    title="Recently uploaded"
                                    description="Click a tile to inspect it again."
                                    icon="fa-solid fa-clock-rotate-left"
                                >
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                                        {recentCompleted.map(entry => (
                                            <Tooltip key={entry.id}>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedId(entry.id)}
                                                        className={`cursor-pointer rounded-sm border border-border bg-card p-2.5 text-left transition-colors hover:bg-secondary/30 ${
                                                            selectedId === entry.id ? 'ring-1 ring-ring' : ''
                                                        }`}
                                                    >
                                                        <div className="flex flex-col items-center gap-1.5 text-center">
                                                            {entry.previewType === 'image' && entry.previewContent ? (
                                                                <img
                                                                    src={entry.previewContent}
                                                                    alt=""
                                                                    className="h-10 w-full rounded-sm object-cover"
                                                                />
                                                            ) : (
                                                                <i className={`${fileIcon(entry.file.name, entry.file.type)} text-xl text-muted-foreground`} />
                                                            )}
                                                            <p className="w-full truncate font-mono text-[10px] leading-tight">
                                                                {entry.file.name}
                                                            </p>
                                                            <span className="text-[10px] tabular-nums text-muted-foreground">
                                                                {formatBytes(entry.file.size)}
                                                            </span>
                                                        </div>
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" className="p-1.5">
                                                    {entry.previewType === 'text' && entry.previewContent ? (
                                                        <pre className="max-h-28 max-w-xs overflow-hidden whitespace-pre-wrap font-mono text-[10px]">
                                                            {entry.previewContent.slice(0, 300)}
                                                        </pre>
                                                    ) : entry.previewType === 'image' && entry.previewContent ? (
                                                        <img src={entry.previewContent} alt="" className="max-h-36 max-w-[200px] rounded object-contain" />
                                                    ) : (
                                                        <span className="text-xs">{entry.file.name}</span>
                                                    )}
                                                </TooltipContent>
                                            </Tooltip>
                                        ))}
                                    </div>
                                </Section>
                            </div>
                        )}
                    </div>

                    <div className="w-full shrink-0 lg:w-72">
                        <Section title="Preview" icon="fa-solid fa-eye" flush>
                            {selectedEntry ? (
                                <div className="space-y-4 p-4">
                                    <div className="flex min-h-[100px] flex-col items-center justify-center gap-3 py-4">
                                        {selectedEntry.previewType === 'image' && selectedEntry.previewContent ? (
                                            <img
                                                src={selectedEntry.previewContent}
                                                alt=""
                                                className="max-h-44 max-w-full rounded-sm border border-border object-contain"
                                            />
                                        ) : (
                                            <i className={`${fileIcon(selectedEntry.file.name, selectedEntry.file.type)} text-5xl text-muted-foreground opacity-50`} />
                                        )}
                                    </div>

                                    <Separator />

                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between gap-3">
                                            <span className="shrink-0 text-muted-foreground">Name</span>
                                            <span className="truncate text-right font-mono">{selectedEntry.file.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Size</span>
                                            <span className="tabular-nums">{formatBytes(selectedEntry.file.size)}</span>
                                        </div>
                                        <div className="flex justify-between gap-3">
                                            <span className="shrink-0 text-muted-foreground">MIME</span>
                                            <span className="truncate text-right font-mono">{selectedEntry.file.type || 'unknown'}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Status</span>
                                            <Badge
                                                variant={statusBadgeVariant(selectedEntry.status)}
                                                className="text-[10px] font-normal capitalize"
                                            >
                                                {selectedEntry.status}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Added</span>
                                            <span>{selectedEntry.addedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>

                                    {(selectedEntry.status === 'uploading' || selectedEntry.status === 'paused') && (
                                        <>
                                            <Separator />
                                            <div>
                                                <div className="mb-2 flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground">Upload progress</span>
                                                    <span className="text-xs tabular-nums">{selectedEntry.progress}%</span>
                                                </div>
                                                <div className="mb-3 h-2 overflow-hidden rounded-full bg-secondary">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-300 ${
                                                            selectedEntry.status === 'paused' ? 'bg-muted-foreground' : 'bg-primary'
                                                        }`}
                                                        style={{ width: `${selectedEntry.progress}%` }}
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 flex-1 text-xs"
                                                        onClick={() => handlePauseResume(selectedEntry)}
                                                    >
                                                        <i className={`fa-solid ${selectedEntry.status === 'uploading' ? 'fa-pause' : 'fa-play'} text-[10px]`} />
                                                        {selectedEntry.status === 'uploading' ? 'Pause' : 'Resume'}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        tone="inactive"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => handleCancel(selectedEntry)}
                                                    >
                                                        <i className="fa-solid fa-xmark text-[10px]" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {selectedEntry.previewType === 'text' && selectedEntry.previewContent && (
                                        <>
                                            <Separator />
                                            <div>
                                                <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                                    File preview
                                                </p>
                                                <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap break-all rounded-sm bg-secondary/40 p-2.5 font-mono text-[10px] leading-relaxed">
                                                    {selectedEntry.previewContent}
                                                </pre>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 sm:p-6">
                                    <EmptyState
                                        icon="fa-solid fa-eye"
                                        title="Nothing selected"
                                        hint="Select a file from the queue to preview it."
                                    />
                                </div>
                            )}
                        </Section>
                    </div>
                </div>
            </PageShell>
        </TooltipProvider>
    )
}
