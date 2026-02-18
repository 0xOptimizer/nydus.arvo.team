"use client"

import { useSidebar } from "@/context/SidebarContext"
import { Menu } from "lucide-react"

export default function MenuToggle() {
  const { isOpen, setIsOpen } = useSidebar()
  return (
    <div className="md:hidden block">
      <Menu className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setIsOpen(!isOpen)} />
    </div>
  )
}