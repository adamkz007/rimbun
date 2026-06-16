import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requirePageAccess } from "@/lib/auth";

export default async function DispensaryPage() {
  await requirePageAccess({
    roles: ["admin", "doctor", "nurse"],
    module: "dispensary",
  });

  return (
    <ModulePlaceholder
      title="Dispensary"
      phase={10}
      description="Prescription fulfillment, inventory tracking, and stock alerts will be added after billing is in place."
    />
  );
}
