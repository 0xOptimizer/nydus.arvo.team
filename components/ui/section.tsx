import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The single container primitive for the Nydus dashboard. Every page builds out
 * of <Section>s so the whole app shares one card grammar: 1px border, small-caps
 * header with optional icon + description, right-aligned header actions, and a
 * consistent body. Use `flush` for tables/lists that should sit edge-to-edge.
 *
 * This replaces the ad-hoc mix of <Card className="p-8">, hand-rolled
 * <h3 className="text-lg font-bold"> headings, and bespoke header rows that made
 * the pages look unrelated.
 */
export function Section({
    title,
    description,
    icon,
    actions,
    footer,
    children,
    className,
    bodyClassName,
    flush = false,
}: {
    title?: ReactNode;
    description?: ReactNode;
    icon?: string; // Font Awesome class, e.g. "fa-solid fa-folder"
    actions?: ReactNode;
    footer?: ReactNode;
    children?: ReactNode;
    className?: string;
    bodyClassName?: string;
    /** Drop body padding — for tables/lists that render their own. */
    flush?: boolean;
}) {
    const hasHeader = title || actions || description;
    return (
        <section className={cn('overflow-hidden rounded-sm border border-border bg-card', className)}>
            {hasHeader && (
                <header className="flex items-center justify-between gap-3 border-b border-border p-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                        {icon && <i className={cn(icon, 'shrink-0 text-sm text-muted-foreground')} />}
                        <div className="min-w-0">
                            {title && (
                                <h2 className="truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    {title}
                                </h2>
                            )}
                            {description && (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{description}</p>
                            )}
                        </div>
                    </div>
                    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                </header>
            )}
            {children != null && <div className={cn(!flush && 'p-4 sm:p-6', bodyClassName)}>{children}</div>}
            {footer && <div className="border-t border-border p-4">{footer}</div>}
        </section>
    );
}

export default Section;
