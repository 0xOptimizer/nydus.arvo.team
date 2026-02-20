import { auth } from "@/auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import MenuToggle from "./MenuToggle"
import NydusEasterEgg from "./EasterEgg"

type TopBarProps = {
  isOpen?: boolean,
  setIsOpen?: (open: boolean) => void
}

export default async function TopBar() {
  const session = await auth()
  const user = session?.user

  return (
    <>
      <header className="w-full h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <MenuToggle />
          <div className="font-bold text-xl text-foreground tracking-tight uppercase flex items-baseline gap-2">
            <span
                className="nydus-title inline-block bg-gradient-to-r from-primary to-muted-foreground bg-clip-text text-transparent select-none cursor-pointer transition-transform duration-150 ease-in-out active:scale-90"
            >
              Nydus
            </span>
            <span className="text-muted-foreground text-xs lowercase font-medium">.arvo.team</span>
          </div>
        </div>

        <Button 
          variant="ghost" 
          className="h-auto flex items-center gap-3 px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <span className="text-xs font-semibold uppercase tracking-widest">{user?.name || 'UNKNOWN'}</span>
          <Avatar className="h-8 w-8 border border-border">
            <AvatarImage src={user?.image || ''} alt="User Avatar" className="object-cover" />
            <AvatarFallback className="bg-secondary text-muted-foreground font-mono text-xs">ID</AvatarFallback>
          </Avatar>
        </Button>
      </header>
      <NydusEasterEgg />
    </>
  )
}