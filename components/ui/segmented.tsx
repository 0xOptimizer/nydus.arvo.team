'use client';

import * as React from 'react';
import { motion } from 'motion/react';

import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
    value: T;
    label: React.ReactNode;
    disabled?: boolean;
}

interface BaseProps<T extends string> {
    options: SegmentedOption<T>[];
    disabled?: boolean;
    size?: 'sm' | 'md';
    className?: string;
    /** Unique id so the sliding indicator's layoutId doesn't collide across instances. */
    id?: string;
}

interface SingleProps<T extends string> extends BaseProps<T> {
    multiple?: false;
    value: T;
    onChange: (value: T) => void;
}

interface MultiProps<T extends string> extends BaseProps<T> {
    multiple: true;
    value: T[];
    onChange: (value: T[]) => void;
}

type SegmentedControlProps<T extends string> = SingleProps<T> | MultiProps<T>;

/**
 * Pill segmented / toggle control. Single-select shows a sliding active indicator
 * (motion layoutId); multi-select highlights every chosen chip. Reduced-motion is
 * honored globally via <MotionConfig> in components/MainContent.tsx.
 *
 * Selected/unselected classes are complete static strings for the Tailwind scanner.
 */
export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
    const { options, disabled, size = 'md', className, id } = props;
    const layoutId = React.useId();
    const groupId = id ?? layoutId;

    const isSelected = (value: T) =>
        props.multiple ? props.value.includes(value) : props.value === value;

    const toggle = (value: T) => {
        if (props.multiple) {
            const set = new Set(props.value);
            if (set.has(value)) set.delete(value);
            else set.add(value);
            props.onChange(Array.from(set));
        } else {
            props.onChange(value);
        }
    };

    const sizeCls = size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs';

    return (
        <div className={cn('inline-flex flex-wrap gap-1.5', className)}>
            {options.map((opt) => {
                const selected = isSelected(opt.value);
                const isDisabled = disabled || opt.disabled;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role={props.multiple ? 'checkbox' : 'radio'}
                        aria-checked={selected}
                        disabled={isDisabled}
                        onClick={() => toggle(opt.value)}
                        className={cn(
                            'relative cursor-pointer rounded-full border font-medium uppercase tracking-wide transition-colors active:scale-95 disabled:pointer-events-none disabled:opacity-50',
                            sizeCls,
                            selected
                                ? 'border-primary text-primary'
                                : 'border-border text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {selected && (
                            <motion.span
                                layoutId={props.multiple ? undefined : `seg-${groupId}`}
                                className="absolute inset-0 rounded-full bg-primary/10"
                                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            />
                        )}
                        <span className="relative z-10">{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

export default SegmentedControl;
