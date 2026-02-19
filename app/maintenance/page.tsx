'use client';

import { useState, useEffect } from 'react';
import { getServiceLogs } from '@/app/actions/maintenance';
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
        <button disabled={disabled} onClick={createRipple} className={`relative overflow-hidden transition-all duration-200 ${className}`}>
            <span className="relative z-10">{children}</span>
            <style jsx global>{`
                span.ripple { position: absolute; border-radius: 50%; transform: scale(0); animation: ripple 600ms linear; background-color: rgba(255, 255, 255, 0.3); pointer-events: none; }
                @keyframes ripple { to { transform: scale(4); opacity: 0; } }
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
            if (res.ok) {
                setPortActive(data.running);
            }
        } catch (err) {
            console.error('Failed to fetch port status:', err);
        }
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
            if (res.ok) {
                setPortActive(action === 'start');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsToggling(false);
        }
    };

    return (
        <Card className="p-4 sm:p-6 border-border bg-card hover:border-primary transition-all duration-200 w-full mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-lg sm:text-xl font-bold text-foreground uppercase tracking-tight">Public API Gateway</h3>
                    <p className="text-xs text-muted-foreground mt-1">Status control for Public Port 5013 (Nydus External Access)</p>
                </div>
                <RippleButton
                    disabled={isToggling}
                    onClick={() => handleTogglePort(portActive ? 'stop' : 'start')}
                    className={`w-full sm:w-auto px-8 py-3 text-xs font-bold uppercase tracking-widest border transition-all
                        ${portActive 
                            ? 'bg-green-500/10 border-green-500 text-green-500 hover:bg-green-500/20' 
                            : 'bg-red-500/10 border-red-500 text-red-500 hover:bg-red-500/20'}`}
                >
                    {isToggling ? 'Synchronizing...' : `Port 5013: ${portActive ? 'Online' : 'Offline'}`}
                </RippleButton>
            </div>
        </Card>
    );
};

const ServiceSection = ({ title, serviceId, description }: { title: string, serviceId: string, description: string }) => {
    const [logs, setLogs] = useState<string>('Loading logs...');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<{ status: string, message: string } | null>(null);

    const fetchLogs = async () => {
        const result = await getServiceLogs(serviceId);
        if (result.success) setLogs(result.logs);
        else setLogs(`Error: ${result.error}`);
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleRestart = () => {
        setIsProcessing(true);
        setProgress({ status: 'progress', message: 'Connecting to local bridge...' });

        const eventSource = new EventSource(`/api/maintenance/restart/${serviceId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setProgress(data);

            if (data.done) {
                eventSource.close();
                setIsProcessing(false);
                fetchLogs();
            }
        };

        eventSource.onerror = () => {
            setProgress({ status: 'error', message: 'Bridge connection closed (Check if service is restarting).' });
            setIsProcessing(false);
            eventSource.close();
        };
    };

    return (
        <Card className="p-4 sm:p-6 border-border bg-card hover:border-primary transition-all duration-200 w-full min-w-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="w-full sm:w-auto">
                    <h3 className="text-lg sm:text-xl font-bold text-foreground uppercase tracking-tight line-clamp-1">{title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{description}</p>
                </div>

                <RippleButton
                    disabled={isProcessing}
                    onClick={handleRestart}
                    className={`w-full sm:w-auto px-6 py-3 sm:py-2 text-xs font-bold uppercase tracking-widest 
                        ${isProcessing ? 'bg-secondary text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                >
                    {isProcessing ? 'Syncing...' : 'Restart & Update'}
                </RippleButton>
            </div>

            {progress && (
                <Alert className={`mb-4 text-xs font-bold border ${progress.status === 'error' ? 'bg-red-950/30 border-red-900/50 text-red-200' :
                        progress.status === 'success' ? 'bg-green-950/30 border-green-900/50 text-green-200' :
                            'bg-primary/10 border-primary/30 text-primary'
                    }`}>
                    <i className={`fa-solid ${progress.status === 'progress' ? 'fa-spinner fa-spin' :
                            progress.status === 'success' ? 'fa-check-double' : 'fa-circle-exclamation'
                        } mr-2`}></i>
                    {progress.message}
                </Alert>
            )}

            <div className="relative w-full">
                <div className="absolute top-0 right-0 bg-secondary px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase z-10">Live Console</div>
                <pre className="bg-background scrollbar-none text-primary w-full p-4 pt-8 sm:pt-4 text-[11px] font-mono h-48 sm:h-64 overflow-y-auto overflow-x-auto whitespace-pre border border-border shadow-inner">
                    {logs}
                </pre>
            </div>
        </Card>
    );
};

export default function MaintenancePage() {
    return (
        <div className="space-y-8 pb-20">
            <div className="pb-6 border-b border-border">
                <h1 className="text-3xl font-bold text-foreground uppercase tracking-tight">System Maintenance</h1>
                <p className="text-sm text-muted-foreground mt-2 font-medium">Global service synchronization and log monitoring</p>
            </div>

            <PortControlSection />

            <div className="grid gap-8">
                <ServiceSection
                    title="arvo.team"
                    serviceId="arvo-team"
                    description="Main website instance (Next.js 16 / PM2)"
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