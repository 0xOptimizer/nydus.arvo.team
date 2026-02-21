'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';

const RippleButton = ({ children, onClick, className, disabled }: any) => {
    const createRipple = (event: any) => {
        const button = event.currentTarget;
        const circle = document.createElement('span');
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;
        const rect = button.getBoundingClientRect();
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - rect.left - radius}px`;
        circle.style.top = `${event.clientY - rect.top - radius}px`;
        circle.classList.add('ripple');
        const existing = button.getElementsByClassName('ripple')[0];
        if (existing) existing.remove();
        button.appendChild(circle);
        if (onClick) onClick(event);
    };

    return (
        <button
            disabled={disabled}
            onClick={createRipple}
            className={`relative overflow-hidden transition-all duration-200 ${className}`}
        >
            <span className="relative z-10">{children}</span>
            <style jsx global>{`
                span.ripple {
                    position: absolute;
                    border-radius: 50%;
                    transform: scale(0);
                    animation: ripple 600ms linear;
                    background-color: rgba(255,255,255,0.3);
                    pointer-events: none;
                }
                @keyframes ripple {
                    to { transform: scale(4); opacity: 0; }
                }
            `}</style>
        </button>
    );
};

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
        <Card className="p-4 sm:p-6 border-border bg-card w-full mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight">
                        Public API Gateway
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        Status control for Public Port 5013
                    </p>
                </div>
                <RippleButton
                    disabled={isToggling}
                    onClick={() => handleTogglePort(portActive ? 'stop' : 'start')}
                    className={`w-full sm:w-auto px-8 py-3 text-xs font-bold uppercase tracking-widest border
                        ${portActive
                            ? 'bg-green-500/10 border-green-500 text-green-500'
                            : 'bg-red-500/10 border-red-500 text-red-500'}`}
                >
                    {isToggling
                        ? 'Synchronizing...'
                        : `Port 5013: ${portActive ? 'Online' : 'Offline'}`}
                </RippleButton>
            </div>
        </Card>
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
        <Card className="p-4 sm:p-6 border-border bg-card w-full min-w-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                    <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight">
                        {title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        {description}
                    </p>
                </div>

                <RippleButton
                    disabled={isProcessing}
                    onClick={handleRestart}
                    className={`w-full sm:w-auto px-6 py-3 text-xs font-bold uppercase tracking-widest
                        ${isProcessing
                            ? 'bg-secondary text-muted-foreground'
                            : 'bg-primary text-primary-foreground'}`}
                >
                    {isProcessing ? 'Syncing...' : 'Restart & Update'}
                </RippleButton>
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
                    className="bg-background text-primary w-full p-4 pt-8 text-[11px] font-mono h-64 overflow-y-auto whitespace-pre border border-border shadow-inner"
                >
                    {logs.join('\n')}
                </pre>
            </div>
        </Card>
    );
};

export default function MaintenancePage() {
    return (
        <div className="space-y-8 pb-20">
            <div className="pb-6 border-b border-border">
                <h1 className="text-3xl font-bold uppercase tracking-tight">
                    System Maintenance
                </h1>
                <p className="text-sm text-muted-foreground mt-2 font-medium">
                    Global service synchronization and log monitoring
                </p>
            </div>

            <PortControlSection />

            <div className="grid gap-8">
                <ServiceSection
                    title="arvo.team"
                    serviceId="arvo-team"
                    description="Main website instance"
                />
                {/* <ServiceSection 
                    title="nydus.arvo.team" 
                    serviceId="nydus-ui" 
                    description="Internal management UI (Next.js 16 / PM2)"
                />
                <ServiceSection 
                    title="Nydus Tunnel" 
                    serviceId="nydus" 
                    description="Backend Pycord Automation Service (Systemd)"
                />
                <ServiceSection 
                    title="Nginx Gateway" 
                    serviceId="nginx" 
                    description="Global Reverse Proxy and SSL Termination"
                /> */}
            </div>
        </div>
    );
}