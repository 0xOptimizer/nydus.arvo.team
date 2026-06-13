import { NextRequest } from 'next/server';
import { API_BASE, upstreamSseHeaders } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ run_uuid: string }> },
) {
    const { run_uuid } = await params;
    const logUrl = `${API_BASE}/deploy/logs/${run_uuid}`;

    console.log('[deploy/logs] GET:', logUrl);

    const headers = upstreamSseHeaders();

    const responseStream = new TransformStream();
    const writer         = responseStream.writable.getWriter();
    const encoder        = new TextEncoder();

    (async () => {
        try {
            console.log('[deploy/logs] Fetching from backend:', logUrl);
            const botRes = await fetch(logUrl, {
                headers,
                cache: 'no-store',
            });

            console.log('[deploy/logs] Backend response status:', botRes.status);
            
            if (!botRes.ok) {
                const errText = await botRes.text();
                throw new Error(`Backend returned ${botRes.status}: ${errText}`);
            }

            if (!botRes.body) throw new Error('No response body from backend.');

            const reader = botRes.body.getReader();
            let bytesRead = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('[deploy/logs] Stream completed, bytes read:', bytesRead);
                    break;
                }
                bytesRead += value.length;
                await writer.write(value);
            }
        } catch (err: any) {
            console.error('[deploy/logs] Error:', err.message);
            const payload = JSON.stringify({ line: `[ERROR] ${err.message}` });
            await writer.write(encoder.encode(`data: ${payload}\n\n`));
            await writer.write(encoder.encode(`data: [done]\n\n`));
        } finally {
            writer.close();
        }
    })();

    return new Response(responseStream.readable, {
        headers: {
            'Content-Type':  'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection':    'keep-alive',
        },
    });
}