"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requireActionAccess } from "@/lib/auth";
import {
  buildPrescriptionLineDescription,
  calculateLineTotal,
  DEFAULT_CONSULTATION_FEE,
  DEFAULT_MEDICATION_FEE,
  deriveInvoiceStatus,
  roundMoney,
  sumLineTotals,
  sumPayments,
} from "@/lib/billing";
import { isModuleEnabled } from "@/lib/modules";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ClinicSettings,
  FeeCategory,
  InvoiceLineSourceType,
  InvoiceStatus,
  PaymentMethod,
  Tables,
} from "@/types/database";

type InvoiceRecord = Pick<
  Tables<"invoices">,
  | "id"
  | "clinic_id"
  | "patient_id"
  | "encounter_id"
  | "invoice_number"
  | "status"
  | "subtotal"
  | "total"
  | "amount_paid"
  | "currency"
  | "notes"
>;

type FeeCatalogRecord = Pick<
  Tables<"fee_catalog">,
  "id" | "code" | "description" | "category" | "unit_amount"
>;

async function getInvoiceRecord(invoiceId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: ["admin", "receptionist"],
    module: "billing",
  });

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, clinic_id, patient_id, encounter_id, invoice_number, status, subtotal, total, amount_paid, currency, notes"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.clinic_id !== staff.clinic_id) {
    throw new Error("Invoice not found.");
  }

  return {
    supabase,
    staff,
    invoice: data as InvoiceRecord,
  };
}

async function recalculateInvoiceTotals(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  invoiceId: string
) {
  const [{ data: lineItems, error: lineItemsError }, { data: payments, error: paymentsError }, { data: invoice, error: invoiceError }] =
    await Promise.all([
      supabase
        .from("invoice_line_items")
        .select("line_total")
        .eq("invoice_id", invoiceId),
      supabase
        .from("invoice_payments")
        .select("amount")
        .eq("invoice_id", invoiceId),
      supabase
        .from("invoices")
        .select("status")
        .eq("id", invoiceId)
        .maybeSingle(),
    ]);

  if (lineItemsError) throw new Error(lineItemsError.message);
  if (paymentsError) throw new Error(paymentsError.message);
  if (invoiceError) throw new Error(invoiceError.message);
  if (!invoice) throw new Error("Invoice not found.");

  const subtotal = sumLineTotals(lineItems ?? []);
  const total = subtotal;
  const amountPaid = sumPayments(payments ?? []);
  const status = deriveInvoiceStatus({
    currentStatus: invoice.status as InvoiceStatus,
    total,
    amountPaid,
  });

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      subtotal,
      total,
      amount_paid: amountPaid,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  if (updateError) throw new Error(updateError.message);

  return {
    subtotal,
    total,
    amountPaid,
    status,
  };
}

async function getActiveFeeByCategory(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  clinicId: string,
  category: FeeCategory
) {
  const { data, error } = await supabase
    .from("fee_catalog")
    .select("id, code, description, category, unit_amount")
    .eq("clinic_id", clinicId)
    .eq("category", category)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as FeeCatalogRecord | null;
}

function revalidateInvoicePaths(invoice: Pick<InvoiceRecord, "id" | "patient_id">) {
  revalidatePath("/billing");
  revalidatePath(`/billing/${invoice.id}`);
  revalidatePath(`/billing/${invoice.id}/print`);
  revalidatePath(`/patients/${invoice.patient_id}`);
  revalidatePath("/dashboard");
}

export async function generateDraftInvoiceFromEncounter(
  encounterId: string,
  clinicSettings?: ClinicSettings | null
) {
  if (clinicSettings && !isModuleEnabled(clinicSettings, "billing")) {
    return null;
  }

  const supabase = await getSupabaseServerClient();

  const { data: encounter, error: encounterError } = await supabase
    .from("encounters")
    .select("id, clinic_id, patient_id, status")
    .eq("id", encounterId)
    .maybeSingle();

  if (encounterError) throw new Error(encounterError.message);
  if (!encounter || encounter.status === "in_progress") {
    return null;
  }

  const { data: existingInvoice, error: existingError } = await supabase
    .from("invoices")
    .select("id")
    .eq("encounter_id", encounterId)
    .neq("status", "void")
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existingInvoice) {
    return existingInvoice.id;
  }

  const [consultationFee, medicationFee, prescriptionsResult] = await Promise.all([
    getActiveFeeByCategory(supabase, encounter.clinic_id, "consultation"),
    getActiveFeeByCategory(supabase, encounter.clinic_id, "medication"),
    supabase
      .from("encounter_prescriptions")
      .select("id, drug_name, dosage, quantity")
      .eq("encounter_id", encounterId)
      .order("sort_order", { ascending: true }),
  ]);

  const { data: prescriptions, error: prescriptionsError } = prescriptionsResult;

  if (prescriptionsError) throw new Error(prescriptionsError.message);

  const { data: invoiceNumber, error: invoiceNumberError } = await supabase.rpc(
    "next_invoice_number",
    { p_clinic_id: encounter.clinic_id }
  );

  if (invoiceNumberError) throw new Error(invoiceNumberError.message);

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      clinic_id: encounter.clinic_id,
      patient_id: encounter.patient_id,
      encounter_id: encounter.id,
      invoice_number: invoiceNumber,
      status: "draft",
    })
    .select("id, clinic_id, patient_id")
    .single();

  if (invoiceError) throw new Error(invoiceError.message);

  const lineItems: Array<{
    invoice_id: string;
    source_type: InvoiceLineSourceType;
    source_id: string | null;
    description: string;
    quantity: number;
    unit_amount: number;
    line_total: number;
    sort_order: number;
  }> = [];

  const consultationAmount = Number(
    consultationFee?.unit_amount ?? DEFAULT_CONSULTATION_FEE
  );

  lineItems.push({
    invoice_id: invoice.id,
    source_type: "consultation",
    source_id: consultationFee?.id ?? null,
    description: consultationFee?.description ?? "General consultation",
    quantity: 1,
    unit_amount: consultationAmount,
    line_total: calculateLineTotal(1, consultationAmount),
    sort_order: 0,
  });

  const medicationAmount = Number(
    medicationFee?.unit_amount ?? DEFAULT_MEDICATION_FEE
  );

  (prescriptions ?? []).forEach((prescription, index) => {
    lineItems.push({
      invoice_id: invoice.id,
      source_type: "prescription",
      source_id: prescription.id,
      description: buildPrescriptionLineDescription({
        drugName: prescription.drug_name,
        dosage: prescription.dosage,
        quantity: prescription.quantity,
      }),
      quantity: 1,
      unit_amount: medicationAmount,
      line_total: calculateLineTotal(1, medicationAmount),
      sort_order: index + 1,
    });
  });

  if (lineItems.length > 0) {
    const { error: lineItemsError } = await supabase
      .from("invoice_line_items")
      .insert(lineItems);

    if (lineItemsError) throw new Error(lineItemsError.message);
  }

  await recalculateInvoiceTotals(supabase, invoice.id);

  await logAuditEvent({
    clinicId: encounter.clinic_id,
    action: "billing.invoice_created",
    targetType: "invoice",
    targetId: invoice.id,
    details: {
      encounterId,
      source: "encounter_completion",
      lineItemCount: lineItems.length,
    },
  });

  revalidateInvoicePaths({
    id: invoice.id,
    patient_id: encounter.patient_id,
  });

  return invoice.id;
}

export async function createManualInvoice(input: {
  patientId: string;
  notes?: string;
}) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: ["admin", "receptionist"],
    module: "billing",
  });

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, clinic_id, archived_at")
    .eq("id", input.patientId)
    .maybeSingle();

  if (patientError) throw new Error(patientError.message);
  if (!patient || patient.clinic_id !== staff.clinic_id) {
    throw new Error("Patient not found.");
  }

  if (patient.archived_at) {
    throw new Error("Archived patients cannot receive new invoices.");
  }

  const { data: invoiceNumber, error: invoiceNumberError } = await supabase.rpc(
    "next_invoice_number",
    { p_clinic_id: staff.clinic_id }
  );

  if (invoiceNumberError) throw new Error(invoiceNumberError.message);

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      clinic_id: staff.clinic_id,
      patient_id: input.patientId,
      invoice_number: invoiceNumber,
      status: "draft",
      notes: input.notes?.trim() || null,
    })
    .select("id, clinic_id, patient_id")
    .single();

  if (invoiceError) throw new Error(invoiceError.message);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "billing.invoice_created",
    targetType: "invoice",
    targetId: invoice.id,
    details: {
      source: "manual",
    },
  });

  revalidateInvoicePaths(invoice);
  return invoice.id;
}

export async function addInvoiceLineItem(input: {
  invoiceId: string;
  description: string;
  quantity: number;
  unitAmount: number;
  sourceType?: InvoiceLineSourceType;
  sourceId?: string | null;
}) {
  const { supabase, staff, invoice } = await getInvoiceRecord(input.invoiceId);

  if (invoice.status !== "draft") {
    throw new Error("Only draft invoices can be edited.");
  }

  const description = input.description.trim();
  if (!description) {
    throw new Error("Line item description is required.");
  }

  const quantity = roundMoney(input.quantity);
  const unitAmount = roundMoney(input.unitAmount);

  if (quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  if (unitAmount < 0) {
    throw new Error("Unit amount cannot be negative.");
  }

  const { data: lastLineItem, error: lastLineItemError } = await supabase
    .from("invoice_line_items")
    .select("sort_order")
    .eq("invoice_id", invoice.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastLineItemError) throw new Error(lastLineItemError.message);

  const { error } = await supabase.from("invoice_line_items").insert({
    invoice_id: invoice.id,
    source_type: input.sourceType ?? "manual",
    source_id: input.sourceId ?? null,
    description,
    quantity,
    unit_amount: unitAmount,
    line_total: calculateLineTotal(quantity, unitAmount),
    sort_order: (lastLineItem?.sort_order ?? -1) + 1,
  });

  if (error) throw new Error(error.message);

  await recalculateInvoiceTotals(supabase, invoice.id);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "billing.line_item_added",
    targetType: "invoice",
    targetId: invoice.id,
    details: {
      description,
      quantity,
      unitAmount,
    },
  });

  revalidateInvoicePaths(invoice);
}

export async function addFeeCatalogLineItem(input: {
  invoiceId: string;
  feeCatalogId: string;
  quantity?: number;
}) {
  const { supabase, invoice } = await getInvoiceRecord(input.invoiceId);

  if (invoice.status !== "draft") {
    throw new Error("Only draft invoices can be edited.");
  }

  const { data: fee, error: feeError } = await supabase
    .from("fee_catalog")
    .select("id, description, unit_amount, clinic_id")
    .eq("id", input.feeCatalogId)
    .maybeSingle();

  if (feeError) throw new Error(feeError.message);
  if (!fee || fee.clinic_id !== invoice.clinic_id) {
    throw new Error("Fee item not found.");
  }

  await addInvoiceLineItem({
    invoiceId: invoice.id,
    description: fee.description,
    quantity: input.quantity ?? 1,
    unitAmount: Number(fee.unit_amount),
    sourceType: "fee_catalog",
    sourceId: fee.id,
  });
}

export async function removeInvoiceLineItem(input: {
  invoiceId: string;
  lineItemId: string;
}) {
  const { supabase, staff, invoice } = await getInvoiceRecord(input.invoiceId);

  if (invoice.status !== "draft") {
    throw new Error("Only draft invoices can be edited.");
  }

  const { error } = await supabase
    .from("invoice_line_items")
    .delete()
    .eq("id", input.lineItemId)
    .eq("invoice_id", invoice.id);

  if (error) throw new Error(error.message);

  await recalculateInvoiceTotals(supabase, invoice.id);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "billing.line_item_removed",
    targetType: "invoice",
    targetId: invoice.id,
    details: {
      lineItemId: input.lineItemId,
    },
  });

  revalidateInvoicePaths(invoice);
}

export async function updateInvoiceNotes(input: {
  invoiceId: string;
  notes: string;
}) {
  const { supabase, staff, invoice } = await getInvoiceRecord(input.invoiceId);

  if (invoice.status !== "draft") {
    throw new Error("Only draft invoices can be edited.");
  }

  const { error } = await supabase
    .from("invoices")
    .update({
      notes: input.notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "billing.invoice_updated",
    targetType: "invoice",
    targetId: invoice.id,
    details: {
      notesUpdated: true,
    },
  });

  revalidateInvoicePaths(invoice);
}

export async function issueInvoice(invoiceId: string) {
  const { supabase, staff, invoice } = await getInvoiceRecord(invoiceId);

  if (invoice.status !== "draft") {
    throw new Error("Only draft invoices can be issued.");
  }

  const { count, error: countError } = await supabase
    .from("invoice_line_items")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoice.id);

  if (countError) throw new Error(countError.message);
  if (!count) {
    throw new Error("Add at least one line item before issuing the invoice.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("invoices")
    .update({
      status: "issued",
      issued_at: now,
      issued_by: staff.id,
      updated_at: now,
    })
    .eq("id", invoice.id);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "billing.invoice_issued",
    targetType: "invoice",
    targetId: invoice.id,
  });

  revalidateInvoicePaths(invoice);
}

export async function voidInvoice(invoiceId: string) {
  const { supabase, staff, invoice } = await getInvoiceRecord(invoiceId);

  if (invoice.status === "void" || invoice.status === "paid") {
    throw new Error("This invoice cannot be voided.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("invoices")
    .update({
      status: "void",
      voided_at: now,
      voided_by: staff.id,
      updated_at: now,
    })
    .eq("id", invoice.id);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "billing.invoice_voided",
    targetType: "invoice",
    targetId: invoice.id,
  });

  revalidateInvoicePaths(invoice);
}

export async function recordPayment(input: {
  invoiceId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  reference?: string;
  notes?: string;
}) {
  const { supabase, staff, invoice } = await getInvoiceRecord(input.invoiceId);

  if (invoice.status !== "issued" && invoice.status !== "partial") {
    throw new Error("Payments can only be recorded for issued invoices.");
  }

  const amount = roundMoney(input.amount);
  if (amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const outstanding = roundMoney(invoice.total - invoice.amount_paid);
  if (amount > outstanding) {
    throw new Error("Payment amount exceeds the outstanding balance.");
  }

  const { error } = await supabase.from("invoice_payments").insert({
    invoice_id: invoice.id,
    payment_method: input.paymentMethod,
    amount,
    reference: input.reference?.trim() || null,
    notes: input.notes?.trim() || null,
    recorded_by: staff.id,
  });

  if (error) throw new Error(error.message);

  await recalculateInvoiceTotals(supabase, invoice.id);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "billing.payment_recorded",
    targetType: "invoice",
    targetId: invoice.id,
    details: {
      amount,
      paymentMethod: input.paymentMethod,
    },
  });

  revalidateInvoicePaths(invoice);
}

export async function generateInvoiceFromEncounterAction(encounterId: string) {
  const staff = await requireActionAccess({
    roles: ["admin", "receptionist"],
    module: "billing",
  });

  const invoiceId = await generateDraftInvoiceFromEncounter(
    encounterId,
    staff.clinics?.settings
  );

  if (!invoiceId) {
    throw new Error("Unable to generate an invoice for this encounter.");
  }

  return invoiceId;
}
