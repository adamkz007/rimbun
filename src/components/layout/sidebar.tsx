"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardPen,
  Users,
  ListOrdered,
  Repeat2,
  MessageCircleHeart,
  Receipt,
  Pill,
  Settings,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from "lucide-react";
import { RimbunLogo, RimbunMark } from "@/components/branding/rimbun-logo";
import { ClinicDetailsCard } from "@/components/layout/clinic-details-card";
import { NAV_COOKIE } from "@/lib/nav-preference";
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
  { href: "/followups", label: "Follow-ups", icon: MessageCircleHeart, roles: ["doctor", "nurse"], module: "loop" },
  { href: "/billing", label: "Billing", icon: Receipt, roles: ["admin", "receptionist"], module: "billing" },
  { href: "/dispensary", label: "Dispensary", icon: Pill, roles: ["doctor", "nurse", "admin"], module: "dispensary" },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

export function Sidebar({
  role,
  clinic,
  initialCollapsed = false,
}: {
  role: StaffRole;
  clinic: {
    name: string;
    address: string | null;
    registration_number: string | null;
    settings: ClinicSettings;
  } | null;
  /** Read from the nav cookie on the server so the first paint matches the saved choice. */
  initialCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
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

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${NAV_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  const closeMobile = () => setMobileOpen(false);

  // `rail`: icons only below lg, and at every width when the user collapsed it.
  const navLinks = (rail: boolean) =>
    visibleItems.map((item) => {
      const isActive = pathname.startsWith(item.href);
      const iconOnly = rail && collapsed;
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={closeMobile}
          title={rail ? item.label : undefined}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "group/nav relative flex items-center rounded-xl text-sm font-medium transition-colors duration-150",
            rail
              ? iconOnly
                ? "size-10 justify-center"
                : "size-10 justify-center lg:h-10 lg:w-auto lg:justify-start lg:gap-3 lg:px-3"
              : "h-11 gap-3 px-3",
            isActive
              ? "bg-white/14 text-leaf-paper"
              : "text-leaf-on-ink/70 hover:bg-white/8 hover:text-leaf-paper"
          )}
        >
          {isActive ? (
            <span className="absolute top-2 bottom-2 -left-2 w-1 rounded-r-full bg-leaf-amber" aria-hidden="true" />
          ) : null}
          <item.icon className="size-[1.125rem] shrink-0" />
          <span className={cn(rail && (iconOnly ? "sr-only" : "sr-only lg:not-sr-only lg:truncate"))}>
            {item.label}
          </span>
        </Link>
      );
    });

  return (
    <>
      {/* Mobile trigger (hidden while the drawer is open so it never covers the drawer header) */}
      {!mobileOpen && (
        <button
          type="button"
          className="fixed top-2.5 left-3 z-50 rounded-xl border bg-card p-2 shadow-sm sm:hidden"
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
          <div className="absolute inset-0 bg-leaf-ink/40 backdrop-blur-[2px]" onClick={closeMobile} />
          <aside className="relative flex h-dvh w-72 max-w-[85vw] flex-col bg-leaf-ink text-leaf-on-ink shadow-xl">
            <div className="flex h-16 shrink-0 items-center px-5">
              <Link href="/dashboard" className="flex items-center gap-2" onClick={closeMobile}>
                <RimbunLogo variant="reversed" className="text-xl" />
              </Link>
              <button
                type="button"
                className="ml-auto rounded-lg p-2 hover:bg-white/8"
                onClick={closeMobile}
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <p className="truncate px-5 pb-2 text-xs text-leaf-on-ink/60">{clinicName}</p>
              <nav className="space-y-1 px-3 py-2">{navLinks(false)}</nav>
              <ClinicDetailsCard clinic={clinic} role={role} tone="dark" />
            </div>
          </aside>
        </div>
      )}

      {/* Rail: icons on tablets, and on desktop when collapsed; full menu on desktop otherwise */}
      <aside
        className={cn(
          "hidden h-dvh shrink-0 flex-col bg-leaf-ink text-leaf-on-ink transition-[width] duration-200 sm:flex",
          collapsed ? "w-[4.5rem]" : "w-[4.5rem] lg:w-60"
        )}
        aria-label="Main navigation"
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center justify-center",
            !collapsed && "lg:justify-start lg:px-5"
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-2" aria-label="Rimbun dashboard">
            <RimbunMark variant="reversed" className={cn("size-8", !collapsed && "lg:hidden")} />
            {!collapsed ? <RimbunLogo variant="reversed" className="hidden text-xl lg:inline-flex" /> : null}
          </Link>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
          {!collapsed ? (
            <p className="hidden truncate px-5 pb-2 text-xs text-leaf-on-ink/60 lg:block">{clinicName}</p>
          ) : null}
          <nav
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2",
              !collapsed && "lg:items-stretch"
            )}
          >
            {navLinks(true)}
          </nav>
          {!collapsed ? (
            <div className="hidden lg:contents">
              <ClinicDetailsCard clinic={clinic} role={role} tone="dark" />
            </div>
          ) : (
            <div className="mt-auto" />
          )}
        </div>
        <div className={cn("hidden shrink-0 border-t border-white/10 p-3 lg:flex", collapsed ? "justify-center" : "justify-end")}>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex size-9 items-center justify-center rounded-lg text-leaf-on-ink/70 transition-colors hover:bg-white/8 hover:text-leaf-paper"
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? <PanelLeftOpen className="size-[1.125rem]" /> : <PanelLeftClose className="size-[1.125rem]" />}
          </button>
        </div>
      </aside>
    </>
  );
}
