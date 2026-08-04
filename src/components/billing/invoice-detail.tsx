"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  ClipboardPen,
  Printer,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addFeeCatalogLineItem,
  addInvoiceLineItem,
  issueInvoice,
  recordPayment,
  removeInvoiceLineItem,
  updateInvoiceNotes,
  voidInvoice,
} from "@/lib/actions/billing-actions";
import {
  canEditInvoice,
  canIssueInvoice,
  canRecordPayment,
  canVoidInvoice,
  formatCurrency,
  formatInvoiceNumber,
  getInvoiceStatusLabel,
  getOutstandingBalance,
  getPaymentMethodLabel,
  invoiceStatusBadgeVariant,
  LINE_SOURCE_LABELS,
  PAYMENT_METHODS,
} from "@/lib/billing";
import { toast } from "@/lib/toast";
import type {
  PaymentMethod,
  Tables,
} from "@/types/database";

type PatientSummary = Pick<Tables<"patients">, "id" | "full_name" | "mrn" | "phone">;
type ClinicSummary = Pick<
  Tables<"clinics">,
  "name" | "address" | "phone" | "registration_number"
>;
type FeeCatalogItem = Pick<
  Tables<"fee_catalog">,
  "id" | "code" | "description" | "category" | "unit_amount"
>;
type LineItem = Pick<
  Tables<"invoice_line_items">,
  | "id"
  | "source_type"
  | "description"
  | "quantity"
  | "unit_amount"
  | "line_total"
  | "sort_order"
>;
type PaymentRecord = Pick<
  Tables<"invoice_payments">,
  "id" | "payment_method" | "amount" | "reference" | "notes" | "recorded_at"
> & {
  staff: Array<Pick<Tables<"staff">, "full_name">> | null;
};

export type InvoiceDetailData = Pick<
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
  | "encounter_id"
> & {
  patients: PatientSummary | PatientSummary[] | null;
  clinics: ClinicSummary | ClinicSummary[] | null;
  invoice_line_items: LineItem[];
  invoice_payments: PaymentRecord[];
};

type InvoiceDetailProps = {
  invoice: InvoiceDetailData;
  feeCatalog: FeeCatalogItem[];
};

export function InvoiceDetail({ invoice, feeCatalog }: InvoiceDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [lineDescription, setLineDescription] = useState("");
  const [lineQuantity, setLineQuantity] = useState("1");
  const [lineUnitAmount, setLineUnitAmount] = useState("");
  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const patient = getFirstRelation(invoice.patients);
  const clinic = getFirstRelation(invoice.clinics);
  const outstanding = getOutstandingBalance(invoice.total, invoice.amount_paid);
  const editable = canEditInvoice(invoice.status);

  function runAction(action: () => Promise<void>, successMessage: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action failed.");
      }
    });
  }

  function handleAddManualLine() {
    runAction(async () => {
      await addInvoiceLineItem({
        invoiceId: invoice.id,
        description: lineDescription,
        quantity: Number(lineQuantity),
        unitAmount: Number(lineUnitAmount),
      });
      setLineDescription("");
      setLineQuantity("1");
      setLineUnitAmount("");
    }, "Line item added.");
  }

  function handleAddFeeLine() {
    if (!selectedFeeId) {
      toast.error("Select a fee item.");
      return;
    }

    runAction(async () => {
      await addFeeCatalogLineItem({
        invoiceId: invoice.id,
        feeCatalogId: selectedFeeId,
      });
      setSelectedFeeId("");
    }, "Fee item added.");
  }

  function handleSaveNotes() {
    runAction(async () => {
      await updateInvoiceNotes({
        invoiceId: invoice.id,
        notes,
      });
    }, "Invoice notes saved.");
  }

  function handleIssue() {
    runAction(async () => {
      await issueInvoice(invoice.id);
    }, "Invoice issued.");
  }

  function handleVoid() {
    runAction(async () => {
      await voidInvoice(invoice.id);
    }, "Invoice voided.");
  }

  function handleRecordPayment() {
    runAction(async () => {
      await recordPayment({
        invoiceId: invoice.id,
        paymentMethod,
        amount: Number(paymentAmount),
        reference: paymentReference,
        notes: paymentNotes,
      });
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");
    }, "Payment recorded.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link href="/billing">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to billing
            </Button>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">
              {formatInvoiceNumber(invoice.invoice_number)}
            </h1>
            <Badge variant={invoiceStatusBadgeVariant(invoice.status)}>
              {getInvoiceStatusLabel(invoice.status)}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>{patient?.full_name ?? "Unknown patient"} • MRN {patient?.mrn ?? "N/A"}</p>
            <p>
              Created {format(new Date(invoice.created_at), "dd MMM yyyy, h:mm a")}
              {invoice.issued_at
                ? ` • Issued ${format(new Date(invoice.issued_at), "dd MMM yyyy, h:mm a")}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {invoice.encounter_id ? (
            <Link href={`/clerking/${invoice.encounter_id}`}>
              <Button variant="outline">
                <ClipboardPen className="mr-2 h-4 w-4" />
                View encounter
              </Button>
            </Link>
          ) : null}
          <Link href={`/billing/${invoice.id}/print`} target="_blank">
            <Button variant="outline">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </Link>
          {canIssueInvoice(invoice.status) ? (
            <Button disabled={isPending} onClick={handleIssue}>
              Issue invoice
            </Button>
          ) : null}
          {canVoidInvoice(invoice.status) ? (
            <Button variant="destructive" disabled={isPending} onClick={handleVoid}>
              Void
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Line items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoice.invoice_line_items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No line items yet.</p>
            ) : (
              <div className="space-y-2">
                {invoice.invoice_line_items
                  .slice()
                  .sort((left, right) => left.sort_order - right.sort_order)
                  .map((lineItem) => (
                    <div
                      key={lineItem.id}
                      className="flex items-start justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium">{lineItem.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {LINE_SOURCE_LABELS[lineItem.source_type]} • Qty {lineItem.quantity} ×{" "}
                          {formatCurrency(lineItem.unit_amount, invoice.currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">
                          {formatCurrency(lineItem.line_total, invoice.currency)}
                        </p>
                        {editable ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() =>
                              runAction(async () => {
                                await removeInvoiceLineItem({
                                  invoiceId: invoice.id,
                                  lineItemId: lineItem.id,
                                });
                              }, "Line item removed.")
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {editable ? (
              <div className="space-y-4 border-t pt-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="md:col-span-2 space-y-1">
                    <Label htmlFor="line-description">Manual line item</Label>
                    <Input
                      id="line-description"
                      placeholder="Description"
                      value={lineDescription}
                      onChange={(event) => setLineDescription(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="line-quantity">Qty</Label>
                    <Input
                      id="line-quantity"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={lineQuantity}
                      onChange={(event) => setLineQuantity(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="line-unit-amount">Unit (MYR)</Label>
                    <Input
                      id="line-unit-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={lineUnitAmount}
                      onChange={(event) => setLineUnitAmount(event.target.value)}
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={handleAddManualLine}
                >
                  Add manual line
                </Button>

                {feeCatalog.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <div className="space-y-1">
                      <Label htmlFor="fee-catalog">Add from fee catalog</Label>
                      <select
                        id="fee-catalog"
                        value={selectedFeeId}
                        onChange={(event) => setSelectedFeeId(event.target.value)}
                        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                      >
                        <option value="">Select fee...</option>
                        {feeCatalog.map((fee) => (
                          <option key={fee.id} value={fee.id}>
                            {fee.description} ({formatCurrency(Number(fee.unit_amount))})
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button variant="outline" disabled={isPending} onClick={handleAddFeeLine}>
                      Add fee
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <SummaryRow
                label="Subtotal"
                value={formatCurrency(invoice.subtotal, invoice.currency)}
              />
              <SummaryRow
                label="Total"
                value={formatCurrency(invoice.total, invoice.currency)}
              />
              <SummaryRow
                label="Paid"
                value={formatCurrency(invoice.amount_paid, invoice.currency)}
              />
              <SummaryRow
                label="Outstanding"
                value={formatCurrency(outstanding, invoice.currency)}
                emphasize
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Clinic</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{clinic?.name ?? "Clinic"}</p>
              {clinic?.address ? <p className="text-muted-foreground">{clinic.address}</p> : null}
              {clinic?.phone ? <p className="text-muted-foreground">{clinic.phone}</p> : null}
              {clinic?.registration_number ? (
                <p className="text-muted-foreground">Reg. {clinic.registration_number}</p>
              ) : null}
            </CardContent>
          </Card>

          {editable ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Internal billing notes..."
                  rows={4}
                />
                <Button variant="outline" disabled={isPending} onClick={handleSaveNotes}>
                  Save notes
                </Button>
              </CardContent>
            </Card>
          ) : invoice.notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {invoice.invoice_payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {invoice.invoice_payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {getPaymentMethodLabel(payment.payment_method)} •{" "}
                      {formatCurrency(payment.amount, invoice.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.recorded_at), "dd MMM yyyy, h:mm a")}
                      {payment.staff?.[0]?.full_name
                        ? ` • ${payment.staff[0].full_name}`
                        : ""}
                      {payment.reference ? ` • Ref ${payment.reference}` : ""}
                    </p>
                    {payment.notes ? (
                      <p className="text-xs text-muted-foreground">{payment.notes}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {canRecordPayment(invoice.status) ? (
            <div className="grid gap-3 border-t pt-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="payment-method">Method</Label>
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value as PaymentMethod)
                  }
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {getPaymentMethodLabel(method)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="payment-amount">Amount (MYR)</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  placeholder={outstanding.toFixed(2)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="payment-reference">Reference</Label>
                <Input
                  id="payment-reference"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="Receipt / txn ref"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="payment-notes">Notes</Label>
                <Input
                  id="payment-notes"
                  value={paymentNotes}
                  onChange={(event) => setPaymentNotes(event.target.value)}
                />
              </div>
              <div className="md:col-span-2 xl:col-span-4 flex gap-2">
                <Button disabled={isPending} onClick={handleRecordPayment}>
                  Record payment
                </Button>
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setPaymentAmount(outstanding.toFixed(2))}
                >
                  Fill outstanding
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={emphasize ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}

function getFirstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
