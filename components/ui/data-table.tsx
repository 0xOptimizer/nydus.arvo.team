'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableRowsSkeleton } from '@/components/ui/skeleton';
import { staggerContainer, listItem } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface Column<T> {
    key: string;
    header: ReactNode;
    align?: 'left' | 'right' | 'center';
    /** Class for the body cell. */
    className?: string;
    /** Class for the header cell. */
    headClassName?: string;
    render: (row: T) => ReactNode;
}

const alignCls = (a?: Column<unknown>['align']) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

/**
 * One table for the whole app. Standardizes header chrome (small-caps), row
 * density + hover, the loading→skeleton and empty-state gates, and row
 * add/remove animation. Replaces the per-page hand-rolled <Table> blocks that
 * each styled headers, padding, and loading differently.
 *
 * Pair with <Section flush> so the table sits edge-to-edge inside the card.
 */
export function DataTable<T>({
    columns,
    rows,
    getRowId,
    loading = false,
    empty,
    skeletonRows = 5,
    animate = true,
    className,
    onRowClick,
}: {
    columns: Column<T>[];
    rows: T[];
    getRowId: (row: T) => string | number;
    loading?: boolean;
    empty?: ReactNode;
    skeletonRows?: number;
    animate?: boolean;
    className?: string;
    onRowClick?: (row: T) => void;
}) {
    // Loading contract: skeleton on first load, never the empty state mid-fetch.
    if (loading && rows.length === 0) {
        return <TableRowsSkeleton rows={skeletonRows} cols={columns.length} />;
    }
    if (!loading && rows.length === 0 && empty) {
        return <div className="p-4 sm:p-6">{empty}</div>;
    }

    return (
        <Table className={className}>
            <TableHeader>
                <TableRow className="border-border bg-secondary/40 hover:bg-secondary/40">
                    {columns.map((c) => (
                        <TableHead
                            key={c.key}
                            className={cn(
                                'h-10 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground',
                                alignCls(c.align),
                                c.headClassName,
                            )}
                        >
                            {c.header}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <motion.tbody
                variants={animate ? staggerContainer : undefined}
                initial={animate ? 'hidden' : undefined}
                animate={animate ? 'show' : undefined}
                className="[&_tr:last-child]:border-0"
            >
                <AnimatePresence initial={false}>
                    {rows.map((row) => (
                        <motion.tr
                            key={getRowId(row)}
                            variants={animate ? listItem : undefined}
                            exit={animate ? 'exit' : undefined}
                            layout
                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                            className={cn(
                                'border-b border-border transition-colors hover:bg-secondary/40',
                                onRowClick && 'cursor-pointer',
                            )}
                        >
                            {columns.map((c) => (
                                <td
                                    key={c.key}
                                    className={cn('px-4 py-3 align-middle', alignCls(c.align), c.className)}
                                >
                                    {c.render(row)}
                                </td>
                            ))}
                        </motion.tr>
                    ))}
                </AnimatePresence>
            </motion.tbody>
        </Table>
    );
}

export default DataTable;
