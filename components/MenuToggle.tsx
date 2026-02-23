"use client"

import { useSidebar } from "@/context/SidebarContext"
import { Menu, X } from "lucide-react"

export default function MenuToggle() {
  const { isOpen, setIsOpen } = useSidebar()
  return (
    <div className="md:hidden block">
      {isOpen ?
      <X className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setIsOpen(!isOpen)} />
      :
      <Menu className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setIsOpen(!isOpen)} />
      }
    </div>
  )
}