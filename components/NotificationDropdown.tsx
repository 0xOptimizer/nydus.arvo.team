"use client"

import { useState, useEffect, useCallback } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AlertRow, type AlertItem } from "@/components/AlertRow"
import { ListSkeleton } from "@/components/ui/skeleton"
import { staggerContainer } from "@/lib/motion"
import { getAlerts, getAlertCount, ackAlert, ackAllAlerts } from "@/app/actions/alerts"

const COUNT_POLL_MS = 30_000

export default function NotificationDropdown() {
  const [open, setOpen]     = useState(false)
  const [count, setCount]   = useState(0)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(false)

  // Poll the unacknowledged count for the bell badge (paused when tab hidden).
  useEffect(() => {
    let active = true
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return
      const n = await getAlertCount()
      if (active) setCount(n)
    }
    tick()
    const id = setInterval(tick, COUNT_POLL_MS)
    const onVis = () => { if (!document.hidden) tick() }
    document.addEventListener("visibilitychange", onVis)
    return () => { active = false; clearInterval(id); document.removeEventListener("visibilitychange", onVis) }
  }, [])

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    const data = await getAlerts({ unacknowledged: true, limit: 30 })
    setAlerts(data)
    setLoading(false)
  }, [])

  useEffect(() => { if (open) loadAlerts() }, [open, loadAlerts])

  const handleAck = async (uuid: string) => {
    setAlerts(prev => prev.filter(a => a.alert_uuid !== uuid))
    setCount(c => Math.max(0, c - 1))
    await ackAlert(uuid)
  }

  const handleAckAll = async () => {
    setAlerts([])
    setCount(0)
    await ackAllAlerts()
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative cursor-pointer flex items-center justify-center w-10 h-10 transition-colors outline-none text-muted hover:bg-muted hover:text-white text-xl rounded">
          <i className="fa-solid fa-bell"></i>
          <AnimatePresence>
            {count > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white"
              >
                {count > 99 ? "99+" : count}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 bg-popover border-border shadow-2xl rounded-md p-1"
      >
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Notifications
          {count > 0 && <span className="font-mono text-primary normal-case">{count}</span>}
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-border" />

        <div className="max-h-96 overflow-y-auto">
          {loading && alerts.length === 0 ? (
            <ListSkeleton rows={4} />
          ) : alerts.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              <i className="fa-solid fa-check-double mb-2 block text-lg text-muted-foreground/50" />
              You&apos;re all caught up.
            </div>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="show">
              <AnimatePresence initial={false}>
                {alerts.map(a => (
                  <AlertRow key={a.alert_uuid} alert={a} onAck={handleAck} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {alerts.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-border" />
            <div className="flex justify-center p-2">
              <button
                onClick={handleAckAll}
                className="text-[10px] uppercase font-bold text-sky-500 hover:text-sky-400 transition-colors"
              >
                Clear All
              </button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
