"use client";

import { logout } from "@/lib/actions/auth-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Search } from "lucide-react";
import { RimbunMark } from "@/components/branding/rimbun-logo";

export function Header({ staffName, role }: { staffName: string; role: string }) {
  const initials = staffName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 pl-16 sm:px-6">
      <div className="flex items-center gap-3">
        <RimbunMark className="size-6 sm:hidden" />
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-mono">
            ⌘K
          </kbd>
        </button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-md px-2 py-2 hover:bg-muted transition-colors sm:px-3">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm sm:inline">{staffName}</span>
          <span className="hidden text-xs text-muted-foreground capitalize md:inline">({role})</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
