"use client";

import { useDeferredValue, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus, Receipt, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createManualInvoice } from "@/lib/actions/billing-actions";
import {
  formatCurrency,
  formatInvoiceNumber,
  getInvoiceStatusLabel,
  getOutstandingBalance,
  invoiceStatusBadgeVariant,
} from "@/lib/billing";
import { toast } from "@/lib/toast";
import type { InvoiceStatus } from "@/types/database";

type PatientSummary = {
  id: string;
  full_name: string;
  mrn: string;
};

export type InvoiceListItem = {
  id: string;
  invoice_number: number;
  status: InvoiceStatus;
  total: number;
  amount_paid: number;
  currency: string;
  created_at: string;
  issued_at: string | null;
  patients: PatientSummary | PatientSummary[] | null;
};

type PatientSearchResult = {
  id: string;
  full_name: string;
  mrn: string;
};

type InvoiceListProps = {
  invoices: InvoiceListItem[];
  initialStatus?: InvoiceStatus | "all";
  initialQuery?: string;
};

const STATUS_FILTERS: Array<{ value: InvoiceStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

export function InvoiceList({
  invoices,
  initialStatus = "all",
  initialQuery = "",
}: InvoiceListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">(initialStatus);
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [createOpen, setCreateOpen] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const deferredPatientQuery = useDeferredValue(patientQuery);
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const filteredInvoices = invoices.filter((invoice) => {
    if (statusFilter !== "all" && invoice.status !== statusFilter) {
      return false;
    }

    if (!deferredQuery) {
      return true;
    }

    const patient = getFirstRelation(invoice.patients);
    const haystack = [
      formatInvoiceNumber(invoice.invoice_number),
      patient?.full_name,
      patient?.mrn,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(deferredQuery);
  });

  async function searchPatients(search: string) {
    setPatientQuery(search);
    setSelectedPatient(null);

    if (search.trim().length < 2) {
      setPatientResults([]);
      return;
    }

    const response = await fetch(
      `/api/search/patients?q=${encodeURIComponent(search)}&limit=8`
    );

    if (!response.ok) {
      setPatientResults([]);
      return;
    }

    const data = (await response.json()) as { results: PatientSearchResult[] };
    setPatientResults(data.results ?? []);
  }

  function handleCreateInvoice() {
    if (!selectedPatient) {
      setCreateError("Select a patient to create an invoice.");
      return;
    }

    setCreateError(null);
    startTransition(async () => {
      try {
        const invoiceId = await createManualInvoice({
          patientId: selectedPatient.id,
        });
        toast.success("Draft invoice created.");
        setCreateOpen(false);
        setPatientQuery("");
        setPatientResults([]);
        setSelectedPatient(null);
        router.push(`/billing/${invoiceId}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to create invoice.";
        setCreateError(message);
        toast.error(message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Manage invoices, payments, and receipts for clinic visits.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            New invoice
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create manual invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-patient-search">Patient</Label>
                <Input
                  id="invoice-patient-search"
                  placeholder="Search by name or MRN..."
                  value={patientQuery}
                  onChange={(event) => {
                    void searchPatients(event.target.value);
                  }}
                />
                {selectedPatient ? (
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{selectedPatient.full_name}</p>
                    <p className="text-muted-foreground">MRN {selectedPatient.mrn}</p>
                  </div>
                ) : patientResults.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {patientResults.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        className="flex w-full flex-col items-start border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientQuery(patient.full_name);
                          setPatientResults([]);
                        }}
                      >
                        <span className="font-medium">{patient.full_name}</span>
                        <span className="text-muted-foreground">MRN {patient.mrn}</span>
                      </button>
                    ))}
                  </div>
                ) : deferredPatientQuery.trim().length >= 2 ? (
                  <p className="text-sm text-muted-foreground">No patients found.</p>
                ) : null}
              </div>

              {createError ? (
                <p className="text-sm text-destructive">{createError}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button disabled={isPending} onClick={handleCreateInvoice}>
                  Create draft
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice number or patient..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No invoices found</p>
              <p className="text-sm text-muted-foreground">
                Completed encounters generate draft invoices automatically when billing is enabled.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredInvoices.map((invoice) => {
            const patient = getFirstRelation(invoice.patients);
            const outstanding = getOutstandingBalance(invoice.total, invoice.amount_paid);

            return (
              <Link key={invoice.id} href={`/billing/${invoice.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {formatInvoiceNumber(invoice.invoice_number)}
                        </p>
                        <Badge variant={invoiceStatusBadgeVariant(invoice.status)}>
                          {getInvoiceStatusLabel(invoice.status)}
                        </Badge>
                      </div>
                      <p className="text-sm">{patient?.full_name ?? "Unknown patient"}</p>
                      <p className="text-xs text-muted-foreground">
                        MRN {patient?.mrn ?? "N/A"} • Created{" "}
                        {format(new Date(invoice.created_at), "dd MMM yyyy, h:mm a")}
                        {invoice.issued_at
                          ? ` • Issued ${format(new Date(invoice.issued_at), "dd MMM yyyy")}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-semibold">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </p>
                      {invoice.status === "partial" || invoice.status === "issued" ? (
                        <p className="text-xs text-muted-foreground">
                          Outstanding {formatCurrency(outstanding, invoice.currency)}
                        </p>
                      ) : invoice.status === "paid" ? (
                        <p className="text-xs text-muted-foreground">Fully paid</p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Billing workflow</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <p>Draft invoices are created when encounters are completed.</p>
          <p>Reception reviews line items, then issues the invoice to the patient.</p>
          <p>Record payments and print receipts from the invoice detail page.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function getFirstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
