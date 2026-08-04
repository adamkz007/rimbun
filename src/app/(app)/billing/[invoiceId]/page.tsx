import { notFound } from "next/navigation";
import { InvoiceDetail } from "@/components/billing/invoice-detail";
import { requirePageAccess } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const staff = await requirePageAccess({
    roles: ["admin", "receptionist"],
    module: "billing",
  });

  const supabase = await getSupabaseServerClient();
  const [invoiceRes, feeCatalogRes] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        `
          id,
          invoice_number,
          status,
          subtotal,
          total,
          amount_paid,
          currency,
          notes,
          issued_at,
          created_at,
          encounter_id,
          patients(id, full_name, mrn, phone),
          clinics(name, address, phone, registration_number),
          invoice_line_items(id, source_type, description, quantity, unit_amount, line_total, sort_order),
          invoice_payments(id, payment_method, amount, reference, notes, recorded_at, staff:recorded_by(full_name))
        `
      )
      .eq("id", invoiceId)
      .maybeSingle(),
    supabase
      .from("fee_catalog")
      .select("id, code, description, category, unit_amount")
      .eq("clinic_id", staff.clinic_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (invoiceRes.error) {
    throw new Error(invoiceRes.error.message);
  }

  if (feeCatalogRes.error) {
    throw new Error(feeCatalogRes.error.message);
  }

  if (!invoiceRes.data) {
    notFound();
  }

  return (
    <InvoiceDetail
      invoice={invoiceRes.data}
      feeCatalog={feeCatalogRes.data ?? []}
    />
  );
}
