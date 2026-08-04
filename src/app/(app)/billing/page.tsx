import { InvoiceList } from "@/components/billing/invoice-list";
import { requirePageAccess } from "@/lib/auth";
import { sortInvoices } from "@/lib/billing";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function BillingPage() {
  await requirePageAccess({
    roles: ["admin", "receptionist"],
    module: "billing",
  });

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, total, amount_paid, currency, created_at, issued_at, patients(id, full_name, mrn)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return <InvoiceList invoices={sortInvoices(data ?? [])} />;
}
