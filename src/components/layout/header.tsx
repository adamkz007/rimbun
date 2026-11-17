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
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-card/70 px-4 pl-16 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-3">
        <RimbunMark className="size-6 sm:hidden" />
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="flex h-9 items-center gap-2 rounded-full border bg-card px-3.5 text-sm text-muted-foreground transition-colors hover:border-leaf-sage hover:bg-muted sm:min-w-64"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search patients, pages…</span>
          <kbd className="ml-auto hidden h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline-flex">
            ⌘K
          </kbd>
        </button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-1 pl-1 transition-colors hover:bg-muted sm:pr-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-leaf-sage/45 text-xs font-semibold text-leaf-ink">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">{staffName}</span>
          <span className="hidden rounded-full bg-leaf-mist px-2 py-0.5 text-[11px] font-medium text-leaf-ink capitalize md:inline">
            {role}
          </span>
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
