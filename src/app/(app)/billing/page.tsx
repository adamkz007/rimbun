import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { requirePageAccess } from "@/lib/auth";

export default async function BillingPage() {
  await requirePageAccess({
    roles: ["admin", "receptionist"],
    module: "billing",
  });

  return (
    <ModulePlaceholder
      title="Billing"
      phase={9}
      description="Invoices, payments, and printable receipts will connect to encounters and prescriptions in a later release."
    />
  );
}
