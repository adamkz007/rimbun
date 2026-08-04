import type {
  FeeCategory,
  InvoiceLineSourceType,
  InvoiceStatus,
  PaymentMethod,
  StaffRole,
} from "@/types/database";

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "draft",
  "issued",
  "paid",
  "partial",
  "void",
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "card",
  "bank_transfer",
  "ewallet",
  "other",
];

export const FEE_CATEGORIES: FeeCategory[] = [
  "consultation",
  "procedure",
  "medication",
  "other",
];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  partial: "Partial",
  void: "Void",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  ewallet: "E-wallet",
  other: "Other",
};

export const FEE_CATEGORY_LABELS: Record<FeeCategory, string> = {
  consultation: "Consultation",
  procedure: "Procedure",
  medication: "Medication",
  other: "Other",
};

export const LINE_SOURCE_LABELS: Record<InvoiceLineSourceType, string> = {
  consultation: "Consultation",
  prescription: "Prescription",
  fee_catalog: "Fee catalog",
  manual: "Manual",
};

export const DEFAULT_CONSULTATION_FEE = 50;
export const DEFAULT_MEDICATION_FEE = 15;

export function formatInvoiceNumber(invoiceNumber: number) {
  return `INV-${String(invoiceNumber).padStart(5, "0")}`;
}

export function formatCurrency(
  amount: number,
  currency = "MYR",
  locale = "en-MY"
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function calculateLineTotal(quantity: number, unitAmount: number) {
  return roundMoney(quantity * unitAmount);
}

export function sumLineTotals(
  lineItems: Array<{ line_total: number }>
) {
  return roundMoney(lineItems.reduce((sum, item) => sum + item.line_total, 0));
}

export function sumPayments(payments: Array<{ amount: number }>) {
  return roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
}

export function deriveInvoiceStatus({
  currentStatus,
  total,
  amountPaid,
}: {
  currentStatus: InvoiceStatus;
  total: number;
  amountPaid: number;
}): InvoiceStatus {
  if (currentStatus === "void" || currentStatus === "draft") {
    return currentStatus;
  }

  if (amountPaid <= 0) {
    return "issued";
  }

  if (amountPaid >= total) {
    return "paid";
  }

  return "partial";
}

export function getInvoiceStatusLabel(status: InvoiceStatus) {
  return INVOICE_STATUS_LABELS[status];
}

export function getPaymentMethodLabel(method: PaymentMethod) {
  return PAYMENT_METHOD_LABELS[method];
}

export function getOutstandingBalance(total: number, amountPaid: number) {
  return roundMoney(Math.max(0, total - amountPaid));
}

export function canManageBilling(role: StaffRole) {
  return role === "admin" || role === "receptionist";
}

export function canEditInvoice(status: InvoiceStatus) {
  return status === "draft";
}

export function canIssueInvoice(status: InvoiceStatus) {
  return status === "draft";
}

export function canRecordPayment(status: InvoiceStatus) {
  return status === "issued" || status === "partial";
}

export function canVoidInvoice(status: InvoiceStatus) {
  return status === "draft" || status === "issued" || status === "partial";
}

export function buildPrescriptionLineDescription(input: {
  drugName: string;
  dosage: string;
  quantity: number;
}) {
  const dosage = input.dosage.trim();
  const parts = [input.drugName.trim()];

  if (dosage) {
    parts.push(dosage);
  }

  parts.push(`Qty ${input.quantity}`);
  return parts.join(" — ");
}

export function sortInvoices<T extends { created_at: string; invoice_number: number }>(
  invoices: T[]
) {
  return [...invoices].sort((left, right) => {
    const createdDiff =
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime();

    if (createdDiff !== 0) {
      return createdDiff;
    }

    return right.invoice_number - left.invoice_number;
  });
}

export function getTodayUtcBounds(reference = new Date()) {
  const start = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      reference.getUTCDate()
    )
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function invoiceStatusBadgeVariant(
  status: InvoiceStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "paid":
      return "default";
    case "partial":
      return "secondary";
    case "void":
      return "destructive";
    default:
      return "outline";
  }
}
