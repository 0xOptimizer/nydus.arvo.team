import { NextRequest, NextResponse } from 'next/server';
import { API_BASE, apiHeaders } from '@/lib/api';

export const runtime = 'nodejs';

// Returns the raw upstream Response (this route inspects .status / .json itself).
async function fetchRaw(endpoint: string, options: RequestInit = {}) {
    return fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...apiHeaders(), ...(options.headers || {}) },
    });
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ service: string }> }
) {
    try {
        const { service } = await params;
        if (service !== 'nydus') return NextResponse.json({ running: false });

        const res = await fetchRaw('/public-status', {
            method: 'GET',
            cache: 'no-store'
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        return NextResponse.json({ running: false });
    }
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

        const res = await fetchRaw('/toggle-public', {
            method: 'POST',
            body: JSON.stringify({ action: body.action }),
        });

        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}