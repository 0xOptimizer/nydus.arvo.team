'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { pageEnter } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Standard page wrapper for the Nydus dashboard. Gives every page a consistent
 * header (title / description / actions), a back link for detail pages, and a
 * subtle entrance animation. Body sections should use `space-y-6`.
 *
 * Visual convention (keep the existing Nydus look — dense, 1px borders):
 *   - title:    uppercase, tracking-tight, text-2xl md:text-3xl font-bold
 *   - header:   flex items-end justify-between, divider underneath
 *   - cards:    border-border bg-card rounded-sm p-4 sm:p-6
 *   - values:   font-mono
 */
export function PageShell({
    title,
    description,
    meta,
    actions,
    backHref,
    children,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    meta?: ReactNode;
    actions?: ReactNode;
    backHref?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <motion.div variants={pageEnter} initial="hidden" animate="show" className={cn('w-full', className)}>
            <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    {backHref && (
                        <Link
                            href={backHref}
                            className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <i className="fa-solid fa-arrow-left text-[10px]" />
                            Back
                        </Link>
                    )}
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold uppercase tracking-tight md:text-3xl">{title}</h1>
                        {meta}
                    </div>
                    {description && (
                        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
                    )}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
            </div>

            <div className="space-y-6 pt-6">{children}</div>
        </motion.div>
    );
}

export default PageShell;
