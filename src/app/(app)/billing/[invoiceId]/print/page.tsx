import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/billing/print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatInvoiceNumber,
  getInvoiceStatusLabel,
  getOutstandingBalance,
  getPaymentMethodLabel,
  invoiceStatusBadgeVariant,
  LINE_SOURCE_LABELS,
} from "@/lib/billing";
import { requirePageAccess } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type PrintPageProps = {
  params: Promise<{ invoiceId: string }>;
};

type InvoicePrintData = Pick<
  Tables<"invoices">,
  | "id"
  | "invoice_number"
  | "status"
  | "subtotal"
  | "total"
  | "amount_paid"
  | "currency"
  | "notes"
  | "issued_at"
  | "created_at"
> & {
  patients: Pick<Tables<"patients">, "full_name" | "mrn" | "phone"> | Array<
    Pick<Tables<"patients">, "full_name" | "mrn" | "phone">
  > | null;
  clinics: Pick<
    Tables<"clinics">,
    "name" | "address" | "phone" | "registration_number"
  > | Array<
    Pick<Tables<"clinics">, "name" | "address" | "phone" | "registration_number">
  > | null;
  invoice_line_items: Array<
    Pick<
      Tables<"invoice_line_items">,
      "description" | "quantity" | "unit_amount" | "line_total" | "source_type"
    >
  >;
  invoice_payments: Array<
    Pick<
      Tables<"invoice_payments">,
      "payment_method" | "amount" | "reference" | "recorded_at"
    >
  >;
};

export default async function InvoicePrintPage({ params }: PrintPageProps) {
  const { invoiceId } = await params;
  await requirePageAccess({
    roles: ["admin", "receptionist"],
    module: "billing",
  });

  const supabase = await getSupabaseServerClient();
  const { data: invoice, error } = await supabase
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
        patients(full_name, mrn, phone),
        clinics(name, address, phone, registration_number),
        invoice_line_items(description, quantity, unit_amount, line_total, source_type),
        invoice_payments(payment_method, amount, reference, recorded_at)
      `
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) notFound();

  const printInvoice = invoice as InvoicePrintData;
  const patient = getFirstRelation(printInvoice.patients);
  const clinic = getFirstRelation(printInvoice.clinics);
  const outstanding = getOutstandingBalance(printInvoice.total, printInvoice.amount_paid);
  const isReceipt = printInvoice.status === "paid";

  return (
    <div className="min-h-screen bg-white text-black print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="no-print border-b bg-muted/30 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link href={`/billing/${invoiceId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to invoice
            </Button>
          </Link>
          <PrintButton label={isReceipt ? "Print receipt" : "Print invoice"} />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              {isReceipt ? "Payment receipt" : "Tax invoice"}
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              {formatInvoiceNumber(printInvoice.invoice_number)}
            </h1>
            <div className="mt-3 space-y-1 text-sm text-neutral-600">
              <p>{clinic?.name}</p>
              {clinic?.address ? <p>{clinic.address}</p> : null}
              {clinic?.phone ? <p>{clinic.phone}</p> : null}
              {clinic?.registration_number ? (
                <p>Registration {clinic.registration_number}</p>
              ) : null}
            </div>
          </div>
          <Badge variant={invoiceStatusBadgeVariant(printInvoice.status)}>
            {getInvoiceStatusLabel(printInvoice.status)}
          </Badge>
        </div>

        <div className="mb-8 grid gap-6 border-y py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Bill to</p>
            <p className="mt-2 font-medium">{patient?.full_name ?? "Patient"}</p>
            <p className="text-sm text-neutral-600">MRN {patient?.mrn ?? "N/A"}</p>
            {patient?.phone ? (
              <p className="text-sm text-neutral-600">{patient.phone}</p>
            ) : null}
          </div>
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Document date</p>
            <p className="mt-2 text-sm">
              {format(
                new Date(printInvoice.issued_at ?? printInvoice.created_at),
                "dd MMM yyyy"
              )}
            </p>
            {printInvoice.issued_at ? (
              <p className="text-sm text-neutral-600">
                Issued {format(new Date(printInvoice.issued_at), "dd MMM yyyy, h:mm a")}
              </p>
            ) : null}
          </div>
        </div>

        <table className="mb-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4 font-medium">Description</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Qty</th>
              <th className="py-2 pr-4 font-medium">Unit</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {printInvoice.invoice_line_items.map((lineItem, index) => (
              <tr key={`${lineItem.description}-${index}`} className="border-b align-top">
                <td className="py-3 pr-4">{lineItem.description}</td>
                <td className="py-3 pr-4 text-neutral-600">
                  {LINE_SOURCE_LABELS[lineItem.source_type]}
                </td>
                <td className="py-3 pr-4">{lineItem.quantity}</td>
                <td className="py-3 pr-4">
                  {formatCurrency(lineItem.unit_amount, printInvoice.currency)}
                </td>
                <td className="py-3 text-right">
                  {formatCurrency(lineItem.line_total, printInvoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-600">Subtotal</span>
            <span>{formatCurrency(printInvoice.subtotal, printInvoice.currency)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCurrency(printInvoice.total, printInvoice.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600">Paid</span>
            <span>{formatCurrency(printInvoice.amount_paid, printInvoice.currency)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>Outstanding</span>
            <span>{formatCurrency(outstanding, printInvoice.currency)}</span>
          </div>
        </div>

        {printInvoice.invoice_payments.length > 0 ? (
          <div className="mt-10 border-t pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Payment history
            </h2>
            <div className="mt-3 space-y-2 text-sm">
              {printInvoice.invoice_payments.map((payment, index) => (
                <div key={`${payment.recorded_at}-${index}`} className="flex justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {getPaymentMethodLabel(payment.payment_method)} •{" "}
                      {formatCurrency(payment.amount, printInvoice.currency)}
                    </p>
                    <p className="text-neutral-600">
                      {format(new Date(payment.recorded_at), "dd MMM yyyy, h:mm a")}
                      {payment.reference ? ` • Ref ${payment.reference}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {printInvoice.notes ? (
          <div className="mt-10 border-t pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Notes
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">
              {printInvoice.notes}
            </p>
          </div>
        ) : null}

        <p className="mt-12 text-center text-xs text-neutral-500">
          Generated by Rimbun • {format(new Date(), "dd MMM yyyy, h:mm a")}
        </p>
      </div>
    </div>
  );
}

function getFirstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
