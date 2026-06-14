import type { ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * One form-field wrapper for the whole app: small-caps label, the control, and a
 * hint/error line. Replaces the per-page mix of bespoke <Label> styles and
 * inline help text so every form reads the same.
 */
export function Field({
    label,
    htmlFor,
    hint,
    error,
    required,
    children,
    className,
}: {
    label?: ReactNode;
    htmlFor?: string;
    hint?: ReactNode;
    error?: ReactNode;
    required?: boolean;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('space-y-1.5', className)}>
            {label && (
                <Label
                    htmlFor={htmlFor}
                    className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                >
                    {label}
                    {required && <span className="ml-0.5 text-primary">*</span>}
                </Label>
            )}
            {children}
            {error ? (
                <p className="text-[10px] text-red-500">{error}</p>
            ) : (
                hint && <p className="text-[10px] text-muted-foreground/80">{hint}</p>
            )}
        </div>
    );
}

/** Responsive form layout — 1 column on mobile, 2 on sm+. Use `cols` to override. */
export function FormGrid({
    children,
    cols = 2,
    className,
}: {
    children: ReactNode;
    cols?: 1 | 2 | 3;
    className?: string;
}) {
    const colsCls = cols === 1 ? '' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
    return <div className={cn('grid grid-cols-1 gap-4', colsCls, className)}>{children}</div>;
}

export default Field;
