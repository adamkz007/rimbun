import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/layout/command-palette";
import { requireAuthenticatedStaff } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireAuthenticatedStaff();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        role={staff.role}
        clinic={staff.clinics}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header staffName={staff.full_name} role={staff.role} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      <CommandPalette role={staff.role} clinicSettings={staff.clinics?.settings} />
    </div>
  );
}
