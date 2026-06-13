'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { cn } from '@/lib/utils';

export function ServicesStatusCard({ services }: { services: any[] }) {
    return (
        <div className="rounded-sm border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Managed Services
                </h3>
                <Link href="/maintenance" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                    Manage →
                </Link>
            </div>

            {services.length === 0 ? (
                <div className="p-4">
                    <EmptyState
                        icon="fa-solid fa-server"
                        title="No managed services"
                        hint="Add services Nydus operates (the main site, bot, nginx) on the Maintenance page."
                    />
                </div>
            ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="show" className="divide-y divide-border">
                    {services.map((svc) => {
                        const enabled = svc.enabled === 1 || svc.enabled === true;
                        return (
                            <motion.div key={svc.service_uuid ?? svc.name} variants={staggerItem} className="flex items-center gap-3 px-4 py-3">
                                <span className={cn('h-2 w-2 shrink-0 rounded-full', enabled ? 'bg-green-500' : 'bg-muted-foreground/40')} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{svc.name}</p>
                                    {svc.fqdn && <p className="truncate font-mono text-[10px] text-muted-foreground">{svc.fqdn}</p>}
                                </div>
                                <Badge variant="secondary" className="text-[10px] uppercase font-normal">{svc.service_type}</Badge>
                            </motion.div>
                        );
                    })}
                </motion.div>
            )}
        </div>
    );
}

export default ServicesStatusCard;
