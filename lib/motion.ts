/**
 * Shared framer-motion (motion/react) variants. Import these into client
 * components for a consistent motion language across the dashboard.
 *
 * Reduced-motion is handled globally via <MotionConfig reducedMotion="user">
 * in components/MainContent.tsx, so these don't need to branch on it themselves.
 */
import type { Variants, Transition } from 'motion/react';

const easeOut: Transition['ease'] = [0.16, 1, 0.3, 1];

/** Page-level entrance: fade in + small upward rise. */
export const pageEnter: Variants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: easeOut } },
};

/** Container that staggers its children (table rows, card grids). */
export const staggerContainer: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

/** Item inside a staggerContainer. */
export const staggerItem: Variants = {
    hidden: { opacity: 0, y: 4 },
    show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: easeOut } },
};

/** Pop-in for dialogs, cards, and badges that appear. */
export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.96 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.18, ease: easeOut } },
    exit: { opacity: 0, scale: 0.96, transition: { duration: 0.12 } },
};

/** Slide up from the bottom edge — used by the stream dock toast. */
export const dockSlide: Variants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: easeOut } },
    exit: { opacity: 0, y: 24, transition: { duration: 0.16 } },
};

/**
 * List row that can also leave — pair with <AnimatePresence> so rows animate out
 * on removal (acked alerts, deleted records). Small/subtle by design.
 */
export const listItem: Variants = {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: easeOut } },
    exit: { opacity: 0, x: -8, transition: { duration: 0.16 } },
};

/**
 * Tiny cross-fade for content that swaps in place — button label↔spinner, a
 * status badge changing state. Use with <AnimatePresence mode="wait"> keyed on
 * the value that changes.
 */
export const swapFade: Variants = {
    hidden: { opacity: 0, y: 2 },
    show: { opacity: 1, y: 0, transition: { duration: 0.12, ease: easeOut } },
    exit: { opacity: 0, y: -2, transition: { duration: 0.1 } },
};
