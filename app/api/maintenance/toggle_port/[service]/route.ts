import { NextRequest, NextResponse } from 'next/server';

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

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (IS_DEV && AUTH_KEY) {
        headers['X-Auth-Key'] = AUTH_KEY;
    }

    return fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            ...headers,
            ...(options.headers || {}),
        },
    });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ service: string }> }
) {
    try {
        const { service } = await params;
        const body = await request.json();
        
        if (service !== 'nydus') {
            return NextResponse.json({ error: 'Service does not support port toggling' }, { status: 400 });
        }

        const botRes = await fetchWithAuth('/toggle-public', {
            method: 'POST',
            body: JSON.stringify({ action: body.action }),
        });

        const data = await botRes.json();
        return NextResponse.json(data, { status: botRes.status });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}