'use client';

import { useState, useEffect, useRef } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/PageShell';
import { SelfTestPanel } from '@/components/maintenance/SelfTestPanel';
import { ServicesSection } from '@/components/maintenance/ServicesSection';

const PortControlSection = () => {
    const [isToggling, setIsToggling] = useState(false);
    const [portActive, setPortActive] = useState<boolean>(false);

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/maintenance/toggle_port/nydus');
            const data = await res.json();
            if (res.ok) setPortActive(data.running);
        } catch {}
    };

    useEffect(() => {
        checkStatus();
    }, []);

    const handleTogglePort = async (action: 'start' | 'stop') => {
        setIsToggling(true);
        try {
            const res = await fetch('/api/maintenance/toggle_port/nydus', {
                method: 'POST',
                body: JSON.stringify({ action }),
            });
            if (res.ok) setPortActive(action === 'start');
        } finally {
            setIsToggling(false);
        }
    };

    return (
        <div className="rounded-sm border border-border bg-card w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sm:p-6">
                <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Public API Gateway
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        Status control for Public Port 5013
                    </p>
                </div>
                <Button
                    ripple
                    variant="outline"
                    tone={portActive ? 'active' : 'inactive'}
                    pending={isToggling}
                    pendingText="Synchronizing…"
                    onClick={() => handleTogglePort(portActive ? 'stop' : 'start')}
                    className="w-full sm:w-auto px-8 text-xs font-bold uppercase tracking-widest"
                >
                    {`Port 5013: ${portActive ? 'Online' : 'Offline'}`}
                </Button>
            </div>
        </div>
    );
};

const ServiceSection = ({
    title,
    serviceId,
    description,
}: {
    title: string;
    serviceId: string;
    description: string;
}) => {
    const [logs, setLogs] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<{ status: string; message: string } | null>(null);

    const logRef = useRef<HTMLPreElement | null>(null);
    const MAX_LINES = 300;

    useEffect(() => {
        const eventSource = new EventSource(
            `/api/maintenance/logs/${serviceId}`
        );

        eventSource.onmessage = (event) => {
            const newLine = event.data;

            setLogs((prev) => {
                const updated = [...prev, newLine];
                if (updated.length > MAX_LINES) {
                    return updated.slice(updated.length - MAX_LINES);
                }
                return updated;
            });

            requestAnimationFrame(() => {
                if (logRef.current) {
                    logRef.current.scrollTop = logRef.current.scrollHeight;
                }
            });
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [serviceId]);

    const handleRestart = () => {
        setIsProcessing(true);
        setProgress({ status: 'progress', message: 'Restarting service...' });

        const eventSource = new EventSource(
            `/api/maintenance/restart/${serviceId}`
        );

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setProgress(data);

            if (data.done) {
                eventSource.close();
                setIsProcessing(false);
            }
        };

        eventSource.onerror = () => {
            setProgress({
                status: 'error',
                message: 'Connection closed during restart.',
            });
            setIsProcessing(false);
            eventSource.close();
        };
    };

    return (
        <div className="rounded-sm border border-border bg-card w-full min-w-0">
            <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            {title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {description}
                        </p>
                    </div>

                    <Button
                        ripple
                        variant="outline"
                        tone={isProcessing ? 'none' : 'active'}
                        pending={isProcessing}
                        pendingText="Syncing…"
                        onClick={handleRestart}
                        className="w-[192px] text-xs font-bold uppercase tracking-widest"
                    >
                        Pull Updates
                    </Button>
                </div>

                {progress && (
                    <Alert className="mb-4 text-xs font-bold border">
                        {progress.message}
                    </Alert>
                )}

                <div className="relative w-full">
                    <div className="absolute top-0 right-0 bg-secondary px-2 py-1 text-[9px] font-bold uppercase z-10">
                        Live Console
                    </div>
                    <pre
                        ref={logRef}
                        className="bg-background/40 text-white w-full h-[480px] p-4 pt-8 md:text-[16px] text-sm overflow-y-auto whitespace-pre rounded-sm border border-border shadow-inner"
                    >
                        {logs.join('\n')}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default function MaintenancePage() {
    return (
        <PageShell
            title="System Maintenance"
            description="Self-test, managed services, and global service control."
            className="pb-20"
        >
            <SelfTestPanel />

            <PortControlSection />

            <ServicesSection />

            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-bold uppercase tracking-tight">Pull Updates</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        Git-pull and restart for the main site, with a live console.
                    </p>
                </div>
                <ServiceSection
                    title="arvo.team"
                    serviceId="arvo-team"
                    description="Main website instance"
                />
            </div>
        </PageShell>
    );
}
