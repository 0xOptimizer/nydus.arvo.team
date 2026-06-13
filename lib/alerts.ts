/** Alert level → icon + color, shared by the notification dropdown and dashboard. */
export type AlertLevel = 'info' | 'success' | 'warning' | 'error' | 'critical';

interface LevelStyle {
    icon: string;        // Font Awesome class
    text: string;        // text color class
    border: string;      // left-border color class
    dot: string;         // background dot color class
}

const STYLES: Record<string, LevelStyle> = {
    info:     { icon: 'fa-circle-info',           text: 'text-sky-400',   border: 'border-l-sky-500/60',   dot: 'bg-sky-500' },
    success:  { icon: 'fa-circle-check',          text: 'text-green-500', border: 'border-l-green-500/60', dot: 'bg-green-500' },
    warning:  { icon: 'fa-triangle-exclamation',  text: 'text-amber-500', border: 'border-l-amber-500/60', dot: 'bg-amber-500' },
    error:    { icon: 'fa-circle-exclamation',    text: 'text-red-500',   border: 'border-l-red-500/60',   dot: 'bg-red-500' },
    critical: { icon: 'fa-fire',                  text: 'text-red-500',   border: 'border-l-red-500',      dot: 'bg-red-500' },
};

export function alertLevelStyle(level: string): LevelStyle {
    return STYLES[level] ?? STYLES.info;
}
