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

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    if (IS_DEV) {
        options.headers = { ...(options.headers || {}), 'Content-Type': 'application/json', 'X-Auth-Key': AUTH_KEY };
    } else {
        options.headers = { ...(options.headers || {}), 'Content-Type': 'application/json' };
    }

    return fetch(`${API_BASE}${endpoint}`, options);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ service: string }> }
) {
    const { service } = await params;
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
        try {
            const botRes = await fetchWithAuth(`/maintenance/restart/${service}`);
            if (!botRes.body) throw new Error('No response body from Bot');

            const reader = botRes.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                await writer.write(value);
            }
        } catch (err: any) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ status: 'error', message: err.message, done: true })}\n\n`));
        } finally {
            writer.close();
        }
    })();

    return new Response(responseStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}