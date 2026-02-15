'use client';

import { useState, useEffect } from 'react';
import { getServiceLogs } from '@/app/actions/maintenance';

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

const ServiceSection = ({ title, serviceId, description }: { title: string, serviceId: string, description: string }) => {
    const [logs, setLogs] = useState<string>('Loading logs...');
    const [status, setStatus] = useState<string>('Idle');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<{status: string, message: string} | null>(null);

    const fetchLogs = async () => {
        const result = await getServiceLogs(serviceId);
        if (result.success) setLogs(result.logs);
        else setLogs(`Error: ${result.error}`);
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 10000); // Auto-refresh logs every 10s
        return () => clearInterval(interval);
    }, []);

    const handleRestart = () => {
        setIsProcessing(true);
        setProgress({ status: 'progress', message: 'Connecting to API...' });
        
        // SSE connection to the Discord Bot API
        const eventSource = new EventSource(`http://127.0.0.1:4000/api/maintenance/restart/${serviceId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setProgress(data);

            if (data.done) {
                eventSource.close();
                setIsProcessing(false);
                fetchLogs(); // Refresh logs after success
            }
        };

        eventSource.onerror = () => {
            setProgress({ status: 'error', message: 'Connection to backend lost.' });
            setIsProcessing(false);
            eventSource.close();
        };
    };

    return (
        <div className="bg-white border border-gray-200 p-6 shadow-sm hover:border-sky-500 transition-all duration-200">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-bold text-black uppercase tracking-tight">{title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{description}</p>
                </div>
                <RippleButton 
                    disabled={isProcessing}
                    onClick={handleRestart}
                    className={`px-6 py-2 text-xs font-bold uppercase tracking-widest ${
                        isProcessing ? 'bg-gray-100 text-gray-400' : 'bg-black text-white hover:bg-sky-900'
                    }`}
                >
                    {isProcessing ? 'Syncing...' : 'Restart & Update'}
                </RippleButton>
            </div>

            {/* PROGRESS INDICATOR */}
            {progress && (
                <div className={`mb-4 p-3 text-xs font-bold border ${
                    progress.status === 'error' ? 'bg-red-50 border-red-200 text-red-600' :
                    progress.status === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                    'bg-sky-50 border-sky-200 text-sky-700'
                }`}>
                    <i className={`fa-solid ${
                        progress.status === 'progress' ? 'fa-spinner fa-spin' : 
                        progress.status === 'success' ? 'fa-check-double' : 'fa-circle-exclamation'
                    } mr-2`}></i>
                    {progress.message}
                </div>
            )}

            {/* LOG VIEWER */}
            <div className="relative">
                <div className="absolute top-0 right-0 bg-gray-100 px-2 py-1 text-[9px] font-bold text-gray-400 uppercase">Live Console</div>
                <pre className="bg-gray-950 text-emerald-500 p-4 text-[11px] font-mono h-64 overflow-y-auto rounded-sm border border-black shadow-inner">
                    {logs}
                </pre>
            </div>
        </div>
    );
};

export default function MaintenancePage() {
    return (
        <div className="space-y-8 max-w-5xl mx-auto font-sans pb-20">
            <div className="pb-6 border-b border-gray-100">
                <h1 className="text-3xl font-bold text-sky-900 uppercase tracking-tight">System Maintenance</h1>
                <p className="text-sm text-gray-600 mt-2 font-medium">Global service synchronization and log monitoring</p>
            </div>

            <div className="grid gap-8">
                <ServiceSection 
                    title="arvo.team" 
                    serviceId="arvo-team" 
                    description="Main website instance (Next.js 16 / PM2)"
                />
                <ServiceSection 
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
                />
            </div>
        </div>
    );
}