export type NavTab = {
    label: string
    href: string
    icon?: string
}

export type NavSection = {
    prefix: string
    tabs: NavTab[]
}

export const NAV_CONFIG: NavSection[] = [
    {
        prefix: '/databases',
        tabs: [
            { label: 'Databases', href: '/databases', icon: 'fa-database' },
            { label: 'Backups', href: '/databases/backups', icon: 'fa-clone' },
            { label: 'Users', href: '/databases/users', icon: 'fa-users' },
            { label: 'Schedules', href: '/databases/schedules', icon: 'fa-clock-rotate-left' },
        ],
    },
    {
        prefix: '/cloudflare',
        tabs: [
            { label: 'DNS Records', href: '/cloudflare', icon: 'fa-globe' },
            { label: 'Analytics', href: '/cloudflare/analytics', icon: 'fa-chart-area' },
        ],
    },
]