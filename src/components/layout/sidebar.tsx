"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardPen,
  Users,
  ListOrdered,
  Repeat2,
  Receipt,
  Pill,
  Settings,
  LayoutDashboard,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { RimbunLogo, RimbunMark } from "@/components/branding/rimbun-logo";
import { ClinicDetailsCard } from "@/components/layout/clinic-details-card";
import { isModuleVisibleInNav } from "@/lib/modules";
import { hasAccess } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { AppModule } from "@/lib/modules";
import type { ClinicSettings, StaffRole } from "@/types/database";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: StaffRole[];
  module?: AppModule;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "doctor", "nurse", "receptionist"] },
  { href: "/clerking", label: "Clerking", icon: ClipboardPen, roles: ["doctor", "nurse"], module: "clerking" },
  { href: "/patients", label: "Patients", icon: Users, roles: ["admin", "doctor", "nurse", "receptionist"] },
  { href: "/queue", label: "Queue", icon: ListOrdered, roles: ["admin", "doctor", "nurse", "receptionist"], module: "queue" },
  { href: "/cases", label: "Care Loop", icon: Repeat2, roles: ["admin", "doctor", "nurse", "receptionist"], module: "loop" },
  { href: "/billing", label: "Billing", icon: Receipt, roles: ["admin", "receptionist"], module: "billing" },
  { href: "/dispensary", label: "Dispensary", icon: Pill, roles: ["doctor", "nurse", "admin"], module: "dispensary" },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

export function Sidebar({
  role,
  clinic,
}: {
  role: StaffRole;
  clinic: {
    name: string;
    address: string | null;
    registration_number: string | null;
    settings: ClinicSettings;
  } | null;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const clinicName = clinic?.name ?? "Clinic";
  const clinicSettings = clinic?.settings;

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.module && !isModuleVisibleInNav(clinicSettings, item.module)) {
      return false;
    }

    return hasAccess({
      role,
      clinicSettings,
      access: {
        roles: item.roles,
        module: item.module,
      },
    });
  });

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const navLinks = (compact: boolean) =>
    visibleItems.map((item) => {
      const isActive = pathname.startsWith(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={closeMobile}
          title={compact ? item.label : undefined}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "flex items-center rounded-md text-sm font-medium transition-colors",
            compact
              ? "h-10 w-10 justify-center lg:h-auto lg:w-auto lg:justify-start lg:gap-3 lg:px-3 lg:py-2"
              : "gap-3 px-3 py-2.5",
            isActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className={cn(compact && "sr-only lg:not-sr-only")}>{item.label}</span>
        </Link>
      );
    });

  return (
    <>
      {/* Mobile trigger (hidden while the drawer is open so it never covers the drawer header) */}
      {!mobileOpen && (
        <button
          type="button"
          className="fixed top-2.5 left-3 z-50 rounded-md border bg-background p-2 sm:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={false}
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/40" onClick={closeMobile} />
          <aside className="relative flex h-dvh w-72 max-w-[85vw] flex-col bg-background shadow-xl">
            <div className="flex h-14 shrink-0 items-center border-b px-4">
              <Link href="/dashboard" className="flex items-center gap-2" onClick={closeMobile}>
                <RimbunLogo className="text-xl" />
              </Link>
              <button
                type="button"
                className="ml-auto rounded-md p-2 hover:bg-muted"
                onClick={closeMobile}
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="px-4 py-2">
                <p className="truncate text-xs text-muted-foreground">{clinicName}</p>
              </div>
              <nav className="space-y-1 px-2 py-2">{navLinks(false)}</nav>
              <ClinicDetailsCard clinic={clinic} role={role} />
            </div>
          </aside>
        </div>
      )}

      {/* Tablet icon rail (sm–lg) and full desktop sidebar (lg+) */}
      <aside className="hidden h-dvh w-16 shrink-0 flex-col border-r bg-background sm:flex lg:w-56">
        <div className="flex h-14 shrink-0 items-center justify-center border-b lg:justify-start lg:px-4">
          <Link href="/dashboard" className="flex items-center gap-2" aria-label="Rimbun dashboard">
            <RimbunMark className="size-7 lg:hidden" />
            <RimbunLogo className="hidden text-xl lg:inline-flex" />
          </Link>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="hidden px-4 py-2 lg:block">
            <p className="truncate text-xs text-muted-foreground">{clinicName}</p>
          </div>
          <nav className="flex flex-col items-center gap-1 px-2 py-3 lg:items-stretch lg:py-2">
            {navLinks(true)}
          </nav>
          <div className="hidden lg:contents">
            <ClinicDetailsCard clinic={clinic} role={role} />
          </div>
        </div>
      </aside>
    </>
  );
}
