'use client';

import { AnimatePresence, motion } from 'motion/react';

import { StatusBadge } from '@/components/StatusBadge';
import { swapFade } from '@/lib/motion';

/**
 * Client wrapper around the pure-server <StatusBadge> that cross-fades the pill
 * when `status` changes. Keep <StatusBadge> for static / server-rendered use;
 * reach for this only where the status updates at runtime.
 */
export function AnimatedStatusBadge({ status, className }: { status: string; className?: string }) {
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.span
                key={status}
                variants={swapFade}
                initial="hidden"
                animate="show"
                exit="exit"
                className="inline-flex"
            >
                <StatusBadge status={status} className={className} />
            </motion.span>
        </AnimatePresence>
    );
}

export default AnimatedStatusBadge;
