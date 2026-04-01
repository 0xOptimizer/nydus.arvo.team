import { NextRequest, NextResponse } from 'next/server'

const ENV = process.env.ENVIRONMENT || 'production'
const IS_DEV = ENV === 'development'
const VPS_PUBLIC_IP = process.env.ARVO_VPS_IP || '127.0.0.1'
const VPS_PUBLIC_PORT = process.env.ARVO_VPS_API_PORT || '5013'
const VPS_INTERNAL_IP = process.env.ARVO_VPS_INTERNAL_IP || '127.0.0.1'
const VPS_INTERNAL_PORT = process.env.ARVO_VPS_INTERNAL_API_PORT || '4000'
const AUTH_KEY = process.env.ARVO_NYDUS_API_KEY || ''

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ uuid: string }> }
) {
    const { uuid } = await params
    const base = IS_DEV
        ? `http://${VPS_PUBLIC_IP}:${VPS_PUBLIC_PORT}`
        : `http://${VPS_INTERNAL_IP}:${VPS_INTERNAL_PORT}`

    const headers: Record<string, string> = {}
    if (IS_DEV) headers['X-Auth-Key'] = AUTH_KEY

    let upstream: Response
    try {
        upstream = await fetch(`${base}/api/databases/backups/${uuid}/download`, { headers })
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