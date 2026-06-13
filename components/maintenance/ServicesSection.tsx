'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { getServices } from '@/app/actions/services';
import { ServiceCard } from '@/components/maintenance/ServiceCard';
import { AddServiceDialog } from '@/components/maintenance/AddServiceDialog';
import { EmptyState } from '@/components/EmptyState';
import { staggerContainer, staggerItem } from '@/lib/motion';

export function ServicesSection() {
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading]   = useState(true);

    const refresh = useCallback(async () => {
        const data = await getServices();
        setServices(data);
        setLoading(false);
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold uppercase tracking-tight">Managed Services</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        Sites and processes Nydus operates but didn’t deploy.
                    </p>
                </div>
                <AddServiceDialog onCreated={refresh} />
            </div>

            {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Loading services…</div>
            ) : services.length === 0 ? (
                <EmptyState
                    icon="fa-solid fa-server"
                    title="No managed services"
                    hint="Add one (the main site, the bot, nginx) to control it here. Requires the control-plane migration on the server."
                />
            ) : (
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                >
                    {services.map(svc => (
                        <motion.div key={svc.service_uuid} variants={staggerItem}>
                            <ServiceCard service={svc} onDeleted={refresh} />
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
}

export default ServicesSection;
