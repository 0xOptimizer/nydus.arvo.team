'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { getLiveStats } from '@/app/actions/stats'
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSidebar } from '@/context/SidebarContext'

function UsageMiniStats() {
  const [stats, setStats] = useState({ cpu: 0, ram: 0 })

  useEffect(() => {
    const fetchStats = async () => {
      const data = await getLiveStats()
      if (data && data.length > 0) {
        setStats({
          cpu: data[0].cpu_percent,
          ram: data[0].ram_percent
        })
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-xs tracking-tighter">
          <span className="text-muted-foreground uppercase font-semibold">CPU</span>
          <span className={cn("font-bold", stats.cpu > 85 ? "text-red-500" : "text-primary")}>
            {stats.cpu}%
          </span>
        </div>
        <Progress value={stats.cpu} className="h-1" />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs tracking-tighter">
          <span className="text-muted-foreground uppercase font-semibold">Memory</span>
          <span className={cn("font-bold", stats.ram > 85 ? "text-red-500" : "text-primary")}>
            {stats.ram}%
          </span>
        </div>
        <Progress value={stats.ram} className="h-1" />
      </div>
    </div>
  )
}

export default function DashboardSidebar() {
  const { isOpen } = useSidebar()
  const pathname = usePathname()

  const navItems = [
    { name: 'Dashboard', path: '/', icon: 'fa-chart-line' },
    { name: 'Projects', path: '/projects', icon: 'fa-network-wired' },
    { name: 'Deployments', path: '/deployments', icon: 'fa-rocket' },
    { name: 'Maintenance', path: '/maintenance', icon: 'fa-screwdriver-wrench' },
    { name: 'Cloudflare', path: '/cloudflare', icon: 'fa-cloud' },
    { name: 'Settings', path: '/settings', icon: 'fa-cogs' },
  ]

  return (
    <aside className={`absolute top-0 left-0 z-40 h-full w-64 border-r border-border bg-card transition-transform duration-200 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"} md:static md:translate-x-0`}>
      <nav className="h-full flex flex-col py-6 px-3 gap-6 overflow-y-auto">
        <div className="flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.path
            return (
              <Button
                key={item.path}
                asChild
                variant="ghost"
                className={cn(
                  "justify-start gap-3 h-9 px-3 transition-colors duration-200",
                  isActive
                    ? "bg-secondary text-primary-foreground font-semibold hover:bg-secondary cursor-default"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Link href={item.path} className="flex items-center w-full">
                  <i className={`fa-solid ${item.icon} w-4 text-center`}></i>
                  <span className="text-sm font-medium flex-1">{item.name}</span>
                  {isActive && (
                    <div className="relative flex h-2 w-2 ml-auto">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </div>
                  )}
                </Link>
              </Button>
            )
          })}
        </div>

        <div className="pt-2">
          <div className="border border-border p-4 space-y-4 rounded-sm">
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Live System Resources
              </span>
            </div>

            <UsageMiniStats />
          </div>
        </div>
      </nav>
    </aside>
  )
}