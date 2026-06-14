'use client';

import { Button, type ButtonProps } from '@/components/ui/button';

// Maps the old RippleButton variant names onto the unified Button's variants.
const VARIANT_MAP = {
    primary: 'default',
    danger: 'destructive',
    warning: 'outline',
    outline: 'outline',
    ghost: 'ghost',
    pma: 'secondary',
} as const satisfies Record<string, ButtonProps['variant']>;

/**
 * @deprecated Use `<Button ripple>` from '@/components/ui/button' directly.
 * Kept as a thin backward-compatible shim (no current importers) that maps the
 * old variant names onto the unified Button. Ripple + pill styling now live in
 * the shared Button.
 */
export function RippleButton({
    variant = 'primary',
    children,
    ...props
}: Omit<ButtonProps, 'variant' | 'ripple'> & { variant?: keyof typeof VARIANT_MAP }) {
    return (
        <Button ripple variant={VARIANT_MAP[variant]} {...props}>
            {children}
        </Button>
    );
}
