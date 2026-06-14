'use client';

import { useState, useEffect, useRef } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/PageShell';
import { Section } from '@/components/ui/section';
import { StatusChip } from '@/components/StatusChip';
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
        <Section
            title="Public API Gateway"
            description="Status control for public port 5013"
            icon="fa-solid fa-network-wired"
            actions={
                <StatusChip
                    label={portActive ? 'Online' : 'Offline'}
                    state={portActive ? 'ok' : 'fail'}
                    pulse={portActive}
                />
            }
        >
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                    Toggle the public-facing port that fronts the Nydus API gateway.
                </p>
                <Button
                    ripple
                    variant="outline"
                    tone={portActive ? 'active' : 'inactive'}
                    pending={isToggling}
                    pendingText="Synchronizing…"
                    onClick={() => handleTogglePort(portActive ? 'stop' : 'start')}
                    className="w-full shrink-0 px-8 sm:w-auto"
                >
                    {portActive ? 'Take port offline' : 'Bring port online'}
                </Button>
            </div>
        </Section>
    );
};

const PullUpdatesSection = ({
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
        <Section
            title={title}
            description={description}
            icon="fa-solid fa-cloud-arrow-down"
            actions={
                <Button
                    ripple
                    variant="outline"
                    tone={isProcessing ? 'none' : 'active'}
                    pending={isProcessing}
                    pendingText="Syncing…"
                    onClick={handleRestart}
                >
                    <i className="fa-solid fa-rotate" /> Pull updates
                </Button>
            }
        >
            <div className="space-y-4">
                {progress && (
                    <Alert className="text-xs font-bold border">{progress.message}</Alert>
                )}

                <div className="relative w-full">
                    <div className="absolute top-0 right-0 z-10 bg-secondary px-2 py-1 text-[9px] font-bold uppercase">
                        Live Console
                    </div>
                    <pre
                        ref={logRef}
                        className="h-[480px] w-full overflow-y-auto whitespace-pre rounded-sm border border-border bg-background/40 p-4 pt-8 text-sm text-white shadow-inner md:text-[16px]"
                    >
                        {logs.join('\n')}
                    </pre>
                </div>
            </div>
        </Section>
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

            <PullUpdatesSection
                title="arvo.team"
                serviceId="arvo-team"
                description="Git-pull and restart the main site, with a live console."
            />
        </PageShell>
    );
}
