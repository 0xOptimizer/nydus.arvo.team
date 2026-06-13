import { NextRequest, NextResponse } from 'next/server'
import { API_BASE, apiHeaders } from '@/lib/api'

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ uuid: string }> }
) {
    const { uuid } = await params

    let upstream: Response
    try {
        upstream = await fetch(`${API_BASE}/databases/backups/${uuid}/download`, { headers: apiHeaders() })
    } catch {
        return NextResponse.json({ error: 'Failed to reach backup server' }, { status: 502 })
    }

    if (!upstream.ok) {
        return NextResponse.json({ error: 'Backup not found or unavailable' }, { status: upstream.status })
    }

    const disposition = upstream.headers.get('content-disposition') || `attachment; filename="backup_${uuid}.sql.gz"`
    const contentLength = upstream.headers.get('content-length') || ''

    return new NextResponse(upstream.body, {
        status: 200,
        headers: {
            'Content-Type': 'application/gzip',
            'Content-Disposition': disposition,
            ...(contentLength ? { 'Content-Length': contentLength } : {}),
        },
    })
}