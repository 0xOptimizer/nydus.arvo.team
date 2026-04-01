'use client'

import { usePathname } from 'next/navigation'
import { useRef, useEffect, useState, useCallback } from 'react'
import { NAV_CONFIG } from '@/lib/nav-config'
import { useNavigation } from '@/context/NavigationContext'

type IndicatorStyle = {
    left: number
    width: number
}

export default function DynamicNavTabs() {
    const pathname = usePathname()
    const { navigate, activePath } = useNavigation()
    const tabRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const hasInitialized = useRef(false)
    const [indicator, setIndicator] = useState<IndicatorStyle | null>(null)
    const [animated, setAnimated] = useState(false)

    const section = NAV_CONFIG.find(s =>
        pathname === s.prefix || pathname.startsWith(s.prefix + '/')
    )

    const resolvedActiveHref =
        section?.tabs.find(tab => activePath === tab.href)?.href ??
        section?.tabs.find(tab => pathname === tab.href)?.href ??
        null

    const measureTab = useCallback((href: string) => {
        const el = tabRefs.current[href]
        if (!el) return
        setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
    }, [])

    useEffect(() => {
        if (!resolvedActiveHref) return

        if (!hasInitialized.current) {
            setAnimated(false)
            measureTab(resolvedActiveHref)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setAnimated(true)
                    hasInitialized.current = true
                })
            })
        } else {
            measureTab(resolvedActiveHref)
        }
    }, [resolvedActiveHref, measureTab])

    useEffect(() => {
        const onResize = () => {
            if (resolvedActiveHref) measureTab(resolvedActiveHref)
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [resolvedActiveHref, measureTab])

    if (!section) return null

    return (
        <div className="relative flex items-center h-full gap-12">

            {indicator && (
                <div
                    className="absolute top-0 h-full bg-background pointer-events-none z-10"
                    style={{
                        left: indicator.left,
                        width: indicator.width,
                        transition: animated
                            ? 'left 160ms cubic-bezier(0.25, 0, 0.2, 1), width 160ms cubic-bezier(0.25, 0, 0.2, 1)'
                            : 'none',
                    }}
                >
                    <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="absolute left-[-59px] top-0 h-[64px] w-[60px]"
                        shapeRendering="geometricPrecision"
                    >
                        <path d="M 100 0 C 30 0 70 100 0 100 L 100 100 L 100 0 Z" className="fill-background" />
                        <path d="M 100 0 C 30 0 70 100 0 100" fill="none" stroke="#2f2f2f" strokeWidth="2" />
                    </svg>

                    <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="absolute right-[-59px] top-0 h-[64px] w-[60px]"
                        shapeRendering="geometricPrecision"
                    >
                        <path d="M 0 0 C 70 0 30 100 100 100 L 0 100 L 0 0 Z" className="fill-background" />
                        <path d="M 0 0 C 70 0 30 100 100 100" fill="none" stroke="#2f2f2f" strokeWidth="2" />
                    </svg>
                </div>
            )}

            {section.tabs.map(tab => {
                const isActive = tab.href === resolvedActiveHref

                return (
                    <div
                        key={tab.href}
                        ref={el => { tabRefs.current[tab.href] = el }}
                        className="relative flex items-center h-full"
                    >
                        <button
                            onClick={() => navigate(tab.href)}
                            className={`
                                relative z-20 flex items-center gap-2 px-4 h-full text-xs font-bold uppercase tracking-widest
                                transition-colors duration-150 cursor-pointer
                                ${isActive
                                    ? 'topbar-selected text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'}
                            `}
                        >
                            {tab.icon && <i className={`fa-solid ${tab.icon}`} />}
                            {tab.label}
                        </button>
                    </div>
                )
            })}
        </div>
    )
}