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
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

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

    return (
        <TooltipProvider>
            <div className="space-y-4 p-6">

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

                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Upload as</span>
                        <div className="flex gap-0.5 border border-border rounded-sm p-0.5 bg-card">
                            {(['general', 'phpmyadmin'] as UploadType[]).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setUploadType(t)}
                                    className={`px-3 py-1 rounded-sm text-xs transition-colors ${
                                        uploadType === t
                                            ? 'bg-foreground text-background'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {t === 'general' ? 'General' : 'phpMyAdmin'}
                                </button>
                            ))}
                        </div>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                            {uploadType === 'phpmyadmin' ? 'SQL export files for database import' : 'Any file type accepted'}
                        </span>
                    </div>
                    {hasFinished && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleClearFinished}>
                            Clear finished
                        </Button>
                    )}
                </div>

                {recentCompleted.length > 0 && (
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Recently uploaded</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                            {recentCompleted.map(entry => (
                                <Tooltip key={entry.id}>
                                    <TooltipTrigger asChild>
                                        <div
                                            onClick={() => setSelectedId(entry.id)}
                                            className={`border border-border rounded-sm bg-card p-2.5 cursor-pointer hover:bg-secondary/30 transition-colors ${
                                                selectedId === entry.id ? 'ring-1 ring-ring' : ''
                                            }`}
                                        >
                                            <div className="flex flex-col items-center gap-1.5 text-center">
                                                {entry.previewType === 'image' && entry.previewContent ? (
                                                    <img
                                                        src={entry.previewContent}
                                                        alt=""
                                                        className="h-10 w-full object-cover rounded-sm"
                                                    />
                                                ) : (
                                                    <i className={`${fileIcon(entry.file.name, entry.file.type)} text-xl text-muted-foreground`} />
                                                )}
                                                <p className="text-[10px] font-mono truncate w-full leading-tight">
                                                    {entry.file.name}
                                                </p>
                                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                                    {formatBytes(entry.file.size)}
                                                </span>
                                            </div>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="p-1.5">
                                        {entry.previewType === 'text' && entry.previewContent ? (
                                            <pre className="text-[10px] max-h-28 max-w-xs overflow-hidden whitespace-pre-wrap font-mono">
                                                {entry.previewContent.slice(0, 300)}
                                            </pre>
                                        ) : entry.previewType === 'image' && entry.previewContent ? (
                                            <img src={entry.previewContent} alt="" className="max-h-36 max-w-[200px] object-contain rounded" />
                                        ) : (
                                            <span className="text-xs">{entry.file.name}</span>
                                        )}
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-4">

                    <div
                        className={`flex-1 min-w-0 border rounded-sm bg-card transition-colors ${
                            isDragging ? 'border-primary' : 'border-border'
                        }`}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <div className="p-3 flex items-center justify-between border-b border-border">
                            <div className="flex items-center gap-2">
                                <i className="fa-solid fa-list text-muted-foreground text-xs" />
                                <p className="text-sm font-medium">Queue</p>
                                <Badge variant="outline" className="text-xs font-normal tabular-nums">
                                    {queue.filter(q => q.status !== 'cancelled' && q.status !== 'error' && q.status !== 'complete').length} / {MAX_FILES}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                {isDragging && (
                                    <span className="text-xs text-primary animate-pulse">Drop here</span>
                                )}
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
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1.5"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <i className="fa-solid fa-plus text-xs" />
                                    Add files
                                </Button>
                            </div>
                        </div>

                        {isDragging ? (
                            <div className="m-3 border-2 border-dashed border-primary rounded-sm p-10 text-center pointer-events-none">
                                <i className="fa-solid fa-cloud-arrow-up text-2xl text-primary mb-2 block" />
                                <p className="text-sm text-primary">Drop to add to queue</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-8 pl-4" />
                                        <TableHead>Name</TableHead>
                                        <TableHead className="w-20">Size</TableHead>
                                        <TableHead className="w-24">Type</TableHead>
                                        <TableHead className="w-24">Status</TableHead>
                                        <TableHead className="w-36">Progress</TableHead>
                                        <TableHead className="text-right pr-4 w-24">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {queue.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="py-16 text-center">
                                                <i className="fa-solid fa-cloud-arrow-up text-3xl text-muted-foreground block mb-3 opacity-20" />
                                                <p className="text-sm text-muted-foreground">Drag files here or click Add files</p>
                                                <p className="text-xs text-muted-foreground mt-1 opacity-70">Up to {MAX_FILES} files at a time</p>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        queue.map(entry => (
                                            <TableRow
                                                key={entry.id}
                                                className={`cursor-pointer ${selectedId === entry.id ? 'bg-secondary/40' : ''}`}
                                                onClick={() => setSelectedId(entry.id)}
                                            >
                                                <TableCell className="pl-4 py-2.5">
                                                    <i className={`${fileIcon(entry.file.name, entry.file.type)} text-sm text-muted-foreground`} />
                                                </TableCell>

                                                <TableCell className="py-2.5">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="font-mono text-xs truncate block max-w-[220px]">
                                                                {entry.file.name}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right" className="p-1.5">
                                                            {entry.previewType === 'image' && entry.previewContent ? (
                                                                <img
                                                                    src={entry.previewContent}
                                                                    alt=""
                                                                    className="max-h-44 max-w-[240px] object-contain rounded"
                                                                />
                                                            ) : entry.previewType === 'text' && entry.previewContent ? (
                                                                <pre className="text-[10px] max-h-36 max-w-xs overflow-hidden whitespace-pre-wrap font-mono">
                                                                    {entry.previewContent.slice(0, 500)}
                                                                </pre>
                                                            ) : (
                                                                <span className="text-xs">{entry.file.name} ({formatBytes(entry.file.size)})</span>
                                                            )}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableCell>

                                                <TableCell className="text-xs text-muted-foreground py-2.5 tabular-nums">
                                                    {formatBytes(entry.file.size)}
                                                </TableCell>

                                                <TableCell className="text-xs text-muted-foreground py-2.5 font-mono">
                                                    {entry.file.type ? (entry.file.type.split('/')[1] ?? entry.file.type) : '—'}
                                                </TableCell>

                                                <TableCell className="py-2.5">
                                                    <Badge
                                                        variant={statusBadgeVariant(entry.status)}
                                                        className="text-[10px] font-normal capitalize"
                                                    >
                                                        {entry.status}
                                                    </Badge>
                                                </TableCell>

                                                <TableCell className="py-2.5">
                                                    {(entry.status === 'uploading' || entry.status === 'paused') ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                                        entry.status === 'paused' ? 'bg-muted-foreground' : 'bg-primary'
                                                                    }`}
                                                                    style={{ width: `${entry.progress}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
                                                                {entry.progress}%
                                                            </span>
                                                        </div>
                                                    ) : entry.status === 'complete' ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full bg-green-500 w-full" />
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
                                                                100%
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                </TableCell>

                                                <TableCell className="text-right pr-4 py-2.5">
                                                    <div
                                                        className="flex justify-end gap-1"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        {(entry.status === 'uploading' || entry.status === 'paused') && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0"
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
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
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
                                                                            size="sm"
                                                                            className="h-6 w-6 p-0"
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
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    <div className="w-full lg:w-72 border border-border rounded-sm bg-card shrink-0">
                        <div className="p-3 border-b border-border">
                            <p className="text-sm font-medium">Preview</p>
                        </div>

                        {selectedEntry ? (
                            <div className="p-4 space-y-4">
                                <div className="flex flex-col items-center justify-center py-4 gap-3 min-h-[100px]">
                                    {selectedEntry.previewType === 'image' && selectedEntry.previewContent ? (
                                        <img
                                            src={selectedEntry.previewContent}
                                            alt=""
                                            className="max-h-44 max-w-full object-contain rounded-sm border border-border"
                                        />
                                    ) : (
                                        <i className={`${fileIcon(selectedEntry.file.name, selectedEntry.file.type)} text-5xl text-muted-foreground opacity-50`} />
                                    )}
                                </div>

                                <Separator />

                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground shrink-0">Name</span>
                                        <span className="font-mono truncate text-right">{selectedEntry.file.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Size</span>
                                        <span className="tabular-nums">{formatBytes(selectedEntry.file.size)}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span className="text-muted-foreground shrink-0">MIME</span>
                                        <span className="font-mono text-right truncate">{selectedEntry.file.type || 'unknown'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
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
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs text-muted-foreground">Upload progress</span>
                                                <span className="text-xs tabular-nums">{selectedEntry.progress}%</span>
                                            </div>
                                            <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
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
                                                    className="flex-1 h-7 text-xs gap-1.5"
                                                    onClick={() => handlePauseResume(selectedEntry)}
                                                >
                                                    <i className={`fa-solid ${selectedEntry.status === 'uploading' ? 'fa-pause' : 'fa-play'} text-[10px]`} />
                                                    {selectedEntry.status === 'uploading' ? 'Pause' : 'Resume'}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
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
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
                                                File preview
                                            </p>
                                            <pre className="text-[10px] font-mono bg-secondary/40 rounded-sm p-2.5 max-h-52 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                                                {selectedEntry.previewContent}
                                            </pre>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
                                <i className="fa-solid fa-eye text-3xl mb-3 opacity-20" />
                                <p className="text-xs">Select a file to preview</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    )
}