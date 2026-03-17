"use client"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ProfileDropdownProps {
    name: string
    image: string
    discordId: string
    onSignOut: () => Promise<void>
}

export default function ProfileDropdown({ name, image, discordId, onSignOut }: ProfileDropdownProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="cursor-pointer h-full flex items-center gap-3 px-3 text-foreground hover:bg-secondary transition-colors outline-none">
                    <span className="text-xs font-semibold uppercase tracking-widest md:block hidden">{name || 'Loading...'}</span>
                    <Avatar className="h-8 w-8 border border-border">
                        <AvatarImage src={image || ''} alt="User Avatar" className="object-cover" />
                        <AvatarFallback className="bg-secondary text-muted-foreground font-mono text-xs">ID</AvatarFallback>
                    </Avatar>
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-72 bg-zinc-950 border-zinc-800 shadow-2xl rounded-md p-1"
            >
                {/* Session Info */}
                <div className="flex items-center gap-3 px-3 py-3">
                    <Avatar className="h-10 w-10 border border-zinc-800 shrink-0">
                        <AvatarImage src={image || ''} alt="User Avatar" className="object-cover" />
                        <AvatarFallback className="bg-zinc-900 text-zinc-500 font-mono text-xs">ID</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-100 truncate">{name}</p>
                        <p className="text-[10px] font-mono text-zinc-500 truncate">
                            <span className="text-zinc-600 mr-1">discord</span>{discordId || '—'}
                        </p>
                    </div>
                </div>

                <DropdownMenuSeparator className="bg-zinc-800" />

                {/* Profile Settings — locked */}
                <DropdownMenuItem
                    disabled
                    className="flex items-center gap-2.5 p-3 m-1 rounded-sm text-zinc-600 cursor-not-allowed outline-none select-none"
                >
                    <i className="fa-solid fa-lock text-xs w-4 text-center" />
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest">Profile Settings</p>
                        <p className="text-[10px] text-zinc-700 mt-0.5">Coming soon</p>
                    </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-zinc-800" />

                {/* Sign Out */}
                <form action={onSignOut}>
                    <button
                        type="submit"
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 m-1 rounded-sm text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors text-xs font-bold uppercase tracking-widest cursor-pointer"
                    >
                        <i className="fa-solid fa-arrow-right-from-bracket text-xs w-4 text-center" />
                        Sign Out
                    </button>
                </form>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}