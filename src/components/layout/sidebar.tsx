"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardPen,
  Users,
  ListOrdered,
  Receipt,
  Pill,
  Settings,
  LayoutDashboard,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { RimbunMark } from "@/components/branding/rimbun-logo";
import { ClinicDetailsCard } from "@/components/layout/clinic-details-card";
import { isModuleVisibleInNav } from "@/lib/modules";
import { hasAccess } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { AppModule } from "@/lib/modules";
import type { ClinicOpeningHours, ClinicSettings, StaffRole } from "@/types/database";

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
    opening_hours: ClinicOpeningHours;
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

  const nav = (
    <>
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <RimbunMark className="h-5 w-5 text-primary" />
          <span className="font-semibold">Rimbun</span>
        </Link>
        <button
          type="button"
          className="ml-auto md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="px-4 py-2">
        <p className="text-xs text-muted-foreground truncate">{clinicName}</p>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-2">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <ClinicDetailsCard clinic={clinic} role={role} />
    </>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        className="fixed top-3 left-3 z-50 md:hidden rounded-md border bg-background p-2"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 flex h-screen w-56 flex-col bg-background">
            {nav}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-56 flex-col border-r bg-background">
        {nav}
      </aside>
    </>
  );
}
