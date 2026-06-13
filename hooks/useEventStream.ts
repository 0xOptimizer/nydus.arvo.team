'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * SSE consumer covering the three Nydus frame formats (see FRONTEND_HANDOFF.md):
 *
 *   'json-line'   (A): deploy/rebuild/selftest logs. Frames are JSON {"line": "..."}.
 *                      Sentinels: `[keepalive]` (ignored), `[done]` (success, closes).
 *   'raw'         (B): control-plane / maintenance / service logs. Each frame is the
 *                      raw log line as-is. `build` kind ends with `[done]`. onerror is
 *                      treated as normal end-of-stream, not a failure.
 *   'json-status' (C): maintenance restart progress. Frames are JSON
 *                      {status,message,done}; stream ends when done === true.
 *
 * Connects only when `url` is non-null; cleans up on unmount or url change.
 */
export type StreamFormat = 'json-line' | 'raw' | 'json-status';

export interface UseEventStreamOptions {
    format: StreamFormat;
    maxLines?: number;
    /** Fired once when the stream completes successfully (`[done]` or done:true). */
    onDone?: () => void;
    /** Fired for each parsed frame — JSON object (A/C) or { line } shape for raw. */
    onEvent?: (parsed: any) => void;
}

export interface UseEventStreamResult {
    lines: string[];
    complete: boolean;
    error: string | null;
    /** Last parsed status object (format C). */
    status: any | null;
    close: () => void;
}

export function useEventStream(
    url: string | null,
    opts: UseEventStreamOptions,
): UseEventStreamResult {
    const { format, maxLines = 300, onDone, onEvent } = opts;

    const [lines, setLines]       = useState<string[]>([]);
    const [complete, setComplete] = useState(false);
    const [error, setError]       = useState<string | null>(null);
    const [status, setStatus]     = useState<any | null>(null);

    const esRef = useRef<EventSource | null>(null);

    // Keep callbacks in refs so re-renders don't reconnect the stream.
    const onDoneRef  = useRef(onDone);
    const onEventRef = useRef(onEvent);
    onDoneRef.current  = onDone;
    onEventRef.current = onEvent;

    const close = useCallback(() => {
        esRef.current?.close();
        esRef.current = null;
    }, []);

    const pushLine = useCallback((line: string) => {
        setLines(prev => {
            const next = [...prev, line];
            return next.length > maxLines ? next.slice(next.length - maxLines) : next;
        });
    }, [maxLines]);

    useEffect(() => {
        if (!url) return;

        setLines([]);
        setComplete(false);
        setError(null);
        setStatus(null);

        const es = new EventSource(url);
        esRef.current = es;

        es.onmessage = (event) => {
            const data = event.data as string;

            // Shared sentinels (A and B/build).
            if (data === '[done]') {
                close();
                setComplete(true);
                onDoneRef.current?.();
                return;
            }
            if (data === '[keepalive]') return;

            if (format === 'json-line') {
                try {
                    const parsed = JSON.parse(data);
                    onEventRef.current?.(parsed);
                    if (typeof parsed.line === 'string') pushLine(parsed.line);
                } catch {
                    // Non-JSON frame on a json-line stream — show it raw rather than drop it.
                    pushLine(data);
                }
            } else if (format === 'json-status') {
                try {
                    const parsed = JSON.parse(data);
                    setStatus(parsed);
                    onEventRef.current?.(parsed);
                    if (typeof parsed.message === 'string') pushLine(parsed.message);
                    if (parsed.done === true) {
                        close();
                        setComplete(true);
                        onDoneRef.current?.();
                    }
                } catch {
                    pushLine(data);
                }
            } else {
                // raw
                onEventRef.current?.({ line: data });
                pushLine(data);
            }
        };

        es.onerror = () => {
            // For live raw streams the connection simply drops on disconnect — that's
            // an expected end-of-stream, not an error. For json formats (which send a
            // terminating sentinel) an early drop is a genuine connection problem.
            close();
            if (format === 'raw') {
                setComplete(true);
            } else {
                setError('Connection to log stream lost.');
                setComplete(true);
            }
        };

        return () => {
            es.close();
            esRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, format]);

    return { lines, complete, error, status, close };
}

export default useEventStream;
