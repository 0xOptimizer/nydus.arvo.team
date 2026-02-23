'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { getLiveStats } from '@/app/actions/stats'
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSidebar } from '@/context/SidebarContext'
import { useNavigation } from '@/context/NavigationContext';
import { ChevronDown, Menu } from 'lucide-react'

function StatBar({ label, value, avg, detail, type, showAvg = false }: { label: string, value: number, avg: number, detail: string, type: string, showAvg?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline leading-none">
        <div className="flex gap-1.5 items-baseline">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{label}</span>
          <span className="text-[9px] text-muted-foreground/70 font-medium">{detail}</span>
        </div>
        <span className={cn("text-[10px] font-bold", value > 85 ? "text-red-500" : "text-primary")}>
          {value.toFixed(2)}%
        </span>
      </div>
      <div className="relative h-2 flex items-center">
        <Progress value={value} className="h-1 w-full" />
        {showAvg && (
          <div
            className="absolute w-1.5 h-3 bg-yellow-400/40 border border-yellow-500/50 rounded-sm z-10 transition-all duration-700 ease-in-out cursor-help"
            style={{ left: `${avg}%`, transform: 'translateX(-50%)' }}
            title={`${type} Baseline Average: ${avg.toFixed(2)}%`}
          />
        )}
      </div>
    </div>
  )
}

function UsageMiniStats() {
  const [stats, setStats] = useState({
    cpu: 0,
    ram_p: 0, ram_u: 0, ram_t: 0,
    disk_p: 0, disk_u: 0, disk_t: 0,
    i_p: 0, i_u: 0, i_t: 0,
    avgCpu: 0, avgRam: 0
  })

  const formatGB = (bytes: number) => (bytes / (1024 ** 3)).toFixed(1)
  const formatInodes = (num: number) => num > 1000 ? (num / 1000).toFixed(1) + 'k' : num

  useEffect(() => {
    const fetchStats = async () => {
      const data = await getLiveStats()
      if (data) {
        setStats({
          cpu: data.cpu || 0,
          ram_p: data.ram_percent || 0,
          ram_u: (data.ram_total - data.ram_remaining) || 0,
          ram_t: data.ram_total || 0,
          disk_p: data.disk_percent || 0,
          disk_u: (data.disk_total - data.disk_remaining) || 0,
          disk_t: data.disk_total || 0,
          i_p: data.inodes_total > 0 ? (data.inodes_used / data.inodes_total) * 100 : 0,
          i_u: data.inodes_used || 0,
          i_t: data.inodes_total || 0,
          avgCpu: data.avg_cpu || 0,
          avgRam: data.avg_ram || 0
        })
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-3">
      <StatBar
        label="CPU"
        type="CPU"
        value={stats.cpu}
        avg={stats.avgCpu}
        detail={`avg ${stats.avgCpu.toFixed(2)}%`}
        showAvg={true}
      />
      <StatBar
        label="RAM"
        type="Memory"
        value={stats.ram_p}
        avg={stats.avgRam}
        detail={`${formatGB(stats.ram_u)}/${formatGB(stats.ram_t)}GB`}
        showAvg={true}
      />
      <StatBar
        label="DSK"
        type="Disk"
        value={stats.disk_p}
        avg={0}
        detail={`${formatGB(stats.disk_u)}/${formatGB(stats.disk_t)}GB`}
        showAvg={false}
      />
      <StatBar
        label="IND"
        type="Inodes"
        value={stats.i_p}
        avg={0}
        detail={`${formatInodes(stats.i_u)}/${formatInodes(stats.i_t)}`}
        showAvg={false}
      />
    </div>
  )
}

export default function DashboardSidebar() {
  const [isLiveStat, setIsLiveStat] = useState(true)
  const { isOpen } = useSidebar();
  const pathname = usePathname();
  const { activePath, pendingPath, navigate } = useNavigation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: 'fa-chart-line' },
    { name: 'Projects', path: '/projects', icon: 'fa-network-wired' },
    { name: 'Deployments', path: '/deployments', icon: 'fa-rocket' },
    { name: 'Maintenance', path: '/maintenance', icon: 'fa-screwdriver-wrench' },
    { name: 'Databases', path: '/databases', icon: 'fa-database' },
    { name: 'Cloudflare', path: '/cloudflare', icon: 'fa-brands fa-cloudflare' },
    { name: 'Users', path: '/users', icon: 'fa-users' },
    { name: 'AI Integrations', path: '/ai', icon: 'fa-brands fa-android' },
    { name: 'Settings', path: '/settings', icon: 'fa-cogs' },
  ]

  // Update fades based on scroll position
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      setShowTopFade(scrollTop > 5);
      setShowBottomFade(scrollTop + clientHeight < scrollHeight - 5);
    };

    handleScroll(); // check initial state
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const NavLink = ({ item }: { item: typeof navItems[0] }) => {
    const isActive = activePath === item.path;
    const isPendingThis = pendingPath === item.path;

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      navigate(item.path);
    };

    return (
      <Button
        asChild
        variant="ghost"
        className={cn(
          "justify-start gap-3 h-9 px-3 transition-colors duration-200",
          isActive
            ? "bg-secondary text-primary-foreground font-semibold hover:bg-secondary cursor-default"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        )}
      >
        <Link href={item.path} onClick={handleClick} className="flex items-center w-full">
          <i className={`fa-solid ${item.icon} w-4 text-center`}></i>
          <span className="text-sm font-medium flex-1">{item.name}</span>
          {isPendingThis && (
            <i className="fa-solid fa-spinner fa-spin-pulse text-xs ml-auto"></i>
          )}
          {isActive && !isPendingThis && (
            <div className="relative flex h-2 w-2 ml-auto">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </div>
          )}
        </Link>
      </Button>
    );
  };

  return (
    <aside className={`absolute top-0 left-0 z-40 h-full w-64 border-r border-border bg-card transition-transform duration-200 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"} md:static md:translate-x-0`}>
      {/* Use flex column to separate scrollable nav and fixed bottom */}
      <nav className="h-full flex flex-col">
        {/* Scrollable navigation container */}
        <div className="flex-1 min-h-0 relative">
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto py-6 px-3"
          >
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <NavLink key={item.path} item={item} />
              ))}
            </div>
          </div>

          {/* Fade overlays - only visible when content is scrollable */}
          <div
            className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background to-transparent pointer-events-none transition-opacity duration-200"
            style={{ opacity: showTopFade ? 1 : 0 }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none transition-opacity duration-200"
            style={{ opacity: showBottomFade ? 1 : 0 }}
          />
        </div>

        {/* Fixed bottom area with stats card */}
        <div className="flex-none p-4 border-t border-border">
          <div className="border border-border rounded-sm">
            <button
              onClick={() => setIsLiveStat(!isLiveStat)}
              className="w-full flex items-center justify-between p-4 transition-colors relative"
            >
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Live System Resources
                </span>
              </div>

              {/* Chevron */}
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform absolute right-3 duration-200 
                  ${isLiveStat ? "rotate-180" : "rotate-0"
                }`}
              />
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out 
                ${isLiveStat ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="p-4 pt-0 space-y-4">
                <UsageMiniStats />
              </div>
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
}