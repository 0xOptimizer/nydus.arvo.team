import { NextRequest } from 'next/server';
import { API_BASE, upstreamSseHeaders } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ service: string }> }
) {
    const { service } = await params;

    const upstream = await fetch(
        `${API_BASE}/maintenance/logs/${service}`,
        {
            method: 'GET',
            headers: upstreamSseHeaders(),
            cache: 'no-store',
        }
    );

    if (!upstream.ok || !upstream.body) {
        return new Response('Upstream error', { status: 500 });
    }

    return new Response(upstream.body, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}