'use client';

import { useEffect } from 'react';
import { useSpring, useMotionValue, useMotionValueEvent } from 'motion/react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Animates a number towards `value` using a spring. Renders into a font-mono
 * span. Pass `format` to control the displayed string (e.g. formatBytes).
 */
export function AnimatedNumber({
    value,
    format = (n) => Math.round(n).toLocaleString(),
    className,
}: {
    value: number;
    format?: (n: number) => string;
    className?: string;
}) {
    const motionValue = useMotionValue(0);
    const spring = useSpring(motionValue, { stiffness: 120, damping: 24, mass: 0.6 });
    const [display, setDisplay] = useState(() => format(0));

    useEffect(() => {
        motionValue.set(Number.isFinite(value) ? value : 0);
    }, [value, motionValue]);

    useMotionValueEvent(spring, 'change', (latest) => {
        setDisplay(format(latest));
    });

    return <span className={cn('font-mono tabular-nums', className)}>{display}</span>;
}

export default AnimatedNumber;
