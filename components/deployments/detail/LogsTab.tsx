'use client';

import { useState } from 'react';
import { useEventStream } from '@/hooks/useEventStream';
import { LogViewer } from '@/components/LogViewer';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const KINDS = [
    { value: 'app',          label: 'App',          nodeOnly: true },
    { value: 'nginx-access', label: 'Nginx Access', nodeOnly: false },
    { value: 'nginx-error',  label: 'Nginx Error',  nodeOnly: false },
    { value: 'build',        label: 'Build',        nodeOnly: false },
];

/** Live/replayed logs for a deployment via the generic SSE proxy (format B). */
export function LogsTab({ deploymentUuid, stack }: { deploymentUuid: string; stack?: string }) {
    const isNode = stack === 'node';
    const available = KINDS.filter(k => !k.nodeOnly || isNode);
    const [kind, setKind] = useState(available[0]?.value ?? 'build');

    const url = `/api/stream/deployments/${deploymentUuid}/logs/${kind}`;
    const { lines, complete } = useEventStream(url, { format: 'raw', maxLines: 500 });

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    Streaming <span className="font-mono">{kind}</span> logs
                </p>
                <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger className="w-[180px] bg-card border-border text-card-foreground">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-popover-foreground">
                        {available.map(k => (
                            <SelectItem key={k.value} value={k.value} className="focus:bg-secondary cursor-pointer">
                                {k.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {/* key forces a fresh stream when the kind changes */}
            <LogViewer key={kind} lines={lines} live={!complete} heightClass="h-96" title={kind} />
        </div>
    );
}

export default LogsTab;
