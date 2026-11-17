import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/layout/command-palette";
import { Toaster } from "@/components/ui/toaster";
import { requireAuthenticatedStaff } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireAuthenticatedStaff();

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        role={staff.role}
        clinic={staff.clinics}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header staffName={staff.full_name} role={staff.role} />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
      <CommandPalette role={staff.role} clinicSettings={staff.clinics?.settings} />
      <Toaster />
    </div>
  );
}
