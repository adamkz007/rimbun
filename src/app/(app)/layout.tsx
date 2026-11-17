import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/layout/command-palette";
import { Toaster } from "@/components/ui/toaster";
import { cookies } from "next/headers";
import { requireAuthenticatedStaff } from "@/lib/auth";
import { isNavCollapsed, NAV_COOKIE } from "@/lib/nav-preference";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireAuthenticatedStaff();
  const navCollapsed = isNavCollapsed((await cookies()).get(NAV_COOKIE)?.value);

  return (
    <div className="flex h-dvh overflow-hidden bg-background sm:bg-leaf-ink">
      <Sidebar
        role={staff.role}
        clinic={staff.clinics}
        initialCollapsed={navCollapsed}
      />
      {/* The workspace sits in a rounded panel beside the dark rail, like a window. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background sm:my-2 sm:mr-2 sm:rounded-[1.25rem] sm:shadow-[0_1px_2px_rgb(0_0_0/0.06)]">
        <Header staffName={staff.full_name} role={staff.role} />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
      <CommandPalette role={staff.role} clinicSettings={staff.clinics?.settings} />
      <Toaster />
    </div>
  );
}
