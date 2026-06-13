import { NextRequest } from 'next/server';
import { API_BASE, upstreamSseHeaders } from '@/lib/api';
import { auth } from '@/auth';

export const runtime = 'nodejs';

/**
 * Generic SSE proxy for the new control-plane log streams. The browser's
 * EventSource cannot send an X-Auth-Key header, so streams are proxied here and
 * the key is injected server-side.
 *
 * The allowlist is the security boundary: only these upstream paths can be
 * reached, and only by an authenticated dashboard session.
 */
const ALLOWED: RegExp[] = [
    /^deployments\/[0-9a-fA-F-]+\/logs\/(app|nginx-access|nginx-error|build)$/,
    /^services\/[0-9a-fA-F-]+\/logs$/,
];

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
) {
    const session = await auth();
    if (!session?.user?.id) {
        return new Response('Unauthorized', { status: 401 });
    }

    const { path } = await params;
    const joined = (path || []).join('/');

    if (!ALLOWED.some(re => re.test(joined))) {
        return new Response('Not found', { status: 404 });
    }

    // Preserve query string (e.g. ?lines=100 for service logs).
    const qs = request.nextUrl.search || '';
    const upstreamUrl = `${API_BASE}/${joined}${qs}`;

    const responseStream = new TransformStream();
    const writer  = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
        try {
            const upstream = await fetch(upstreamUrl, {
                headers: upstreamSseHeaders(),
                cache: 'no-store',
            });

            if (!upstream.ok) {
                const errText = await upstream.text().catch(() => '');
                throw new Error(`Backend returned ${upstream.status}: ${errText}`);
            }
            if (!upstream.body) throw new Error('No response body from backend.');

            const reader = upstream.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                await writer.write(value);
            }
        } catch (err: any) {
            // Raw (format B) streams: surface the error as a plain line.
            await writer.write(encoder.encode(`data: [ERROR] ${err.message}\n\n`));
        } finally {
            writer.close();
        }
    })();

    return new Response(responseStream.readable, {
        headers: {
            'Content-Type':  'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection':    'keep-alive',
        },
    });
}
