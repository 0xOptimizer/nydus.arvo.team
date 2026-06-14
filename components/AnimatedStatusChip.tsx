'use client';

import { AnimatePresence, motion } from 'motion/react';

import { StatusChip, type ChipState } from '@/components/StatusChip';
import { swapFade } from '@/lib/motion';

/**
 * Client wrapper around the pure-server <StatusChip> that cross-fades when the
 * `state`/`label` changes. Keep <StatusChip> for static / server-rendered use;
 * reach for this only where the signal updates at runtime.
 */
export function AnimatedStatusChip({
    label,
    state,
    className,
    pulse = false,
}: {
    label: string;
    state: ChipState;
    className?: string;
    pulse?: boolean;
}) {
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.span
                key={`${state}:${label}`}
                variants={swapFade}
                initial="hidden"
                animate="show"
                exit="exit"
                className="inline-flex"
            >
                <StatusChip label={label} state={state} pulse={pulse} className={className} />
            </motion.span>
        </AnimatePresence>
    );
}

export default AnimatedStatusChip;
