import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const ENV = process.env.ENVIRONMENT || 'production';
const IS_DEV = ENV === 'development';

const VPS_PUBLIC_IP = process.env.ARVO_VPS_IP || '127.0.0.1';
const VPS_PUBLIC_PORT = process.env.ARVO_VPS_API_PORT || '5013';
const VPS_INTERNAL_IP = process.env.ARVO_VPS_INTERNAL_IP || '127.0.0.1';
const VPS_INTERNAL_PORT = process.env.ARVO_VPS_INTERNAL_API_PORT || '4000';
const AUTH_KEY = process.env.ARVO_NYDUS_API_KEY || '';

const API_BASE = IS_DEV
    ? `http://${VPS_PUBLIC_IP}:${VPS_PUBLIC_PORT}/api`
    : `http://${VPS_INTERNAL_IP}:${VPS_INTERNAL_PORT}/api`;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ service: string }> }
) {
    const { service } = await params;

    const headers: Record<string, string> = {};
    if (IS_DEV) {
        headers['X-Auth-Key'] = AUTH_KEY;
    }

    const upstream = await fetch(
        `${API_BASE}/maintenance/logs/${service}`,
        {
            method: 'GET',
            headers,
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