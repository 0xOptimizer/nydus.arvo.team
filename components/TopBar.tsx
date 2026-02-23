import { auth } from "@/auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { agaleFont } from "@/lib/fonts"
import Image from "next/image"
import Link from "next/link"
import MenuToggle from "./MenuToggle"
import NydusEasterEgg from "./EasterEgg"
import NotificationDropdown from "./NotificationDropdown"

import nydusLogo from "../public/nydus_logo_v2.png";

export default async function TopBar() {
  const session = await auth()
  const user = session?.user

  return (
    <>
      <header className="w-full h-16 bg-card flex items-center justify-between sticky top-0 z-50">
        <div
          className="flex items-center gap-3 h-full pl-6 flex-grow"
          style={{ borderBottom: '1px solid #2f2f2f' }}
        >
          <MenuToggle />
          <Image
            src={nydusLogo}
            alt="Nydus Logo"
            width={32}
            height={32}
            className="object-contain"
            priority
          />
          <div className="font-bold text-xl text-foreground tracking-tight uppercase md:flex hidden items-baseline gap-2">
            <span
              className={`${agaleFont.className} nydus-title inline-block bg-gradient-to-r from-primary to-muted-foreground bg-clip-text text-transparent select-none cursor-pointer transition-transform duration-150 ease-in-out active:scale-90`}
            >
              Nydus
            </span>
            <span className="text-muted-foreground text-xs lowercase font-medium">.arvo.team</span>
          </div>
        </div>

        <div className="flex items-center h-full">
          <div className="relative flex items-center h-full pr-4 bg-background">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute md:left-[-59px] left-[-55px] top-0 h-full w-[60px] z-10"
              shapeRendering="geometricPrecision"
            >
              <path
                d="M 100 0 C 30 0 70 100 0 100 L 100 100 L 100 0 Z"
                className="fill-background"
              />
              <path
                d="M 100 0 C 30 0 70 100 0 100"
                fill="none"
                stroke="#2f2f2f"
                strokeWidth="2"
              />
            </svg>

            <div className="flex items-center md:gap-4 md:ml-4">
              <Link
                href="https://mail.arvo.team"
                target="_blank"
                className="w-10 h-10 flex items-center justify-center text-muted hover:bg-muted hover:text-white transition-colors rounded"
              >
                <i className="fa-solid fa-envelope text-lg"></i>
              </Link>


              <NotificationDropdown />
            </div>

            <div className="flex items-center gap-4 md:ml-4">
              <Button
                variant="ghost"
                className="h-full flex items-center gap-3 px-3 text-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <span className="text-xs font-semibold uppercase tracking-widest md:block hidden">{user?.name || 'Loading...'}</span>
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarImage src={user?.image || ''} alt="User Avatar" className="object-cover" />
                  <AvatarFallback className="bg-secondary text-muted-foreground font-mono text-xs">ID</AvatarFallback>
                </Avatar>
              </Button>
            </div>
          </div>
        </div>
      </header>
      <NydusEasterEgg />
    </>
  )
}