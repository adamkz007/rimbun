"use client";

import { useDeferredValue, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  AlertTriangle,
  ClipboardPen,
  Pill,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelFulfillment,
  dispenseFulfillment,
} from "@/lib/actions/dispensary-actions";
import {
  buildPrescriptionSummary,
  canCancelFulfillment,
  canDispenseFulfillment,
  fulfillmentStatusBadgeVariant,
  getFulfillmentStatusLabel,
} from "@/lib/dispensary";
import { toast } from "@/lib/toast";
import type { FulfillmentStatus } from "@/types/database";

type PatientSummary = {
  id: string;
  full_name: string;
  mrn: string;
};

type InventorySummary = {
  id: string;
  name: string;
  quantity_on_hand: number;
  unit: string;
};

type StaffSummary = {
  id: string;
  full_name: string;
};

export type FulfillmentBoardItem = {
  id: string;
  status: FulfillmentStatus;
  drug_name: string;
  dosage: string;
  quantity_requested: number;
  quantity_dispensed: number | null;
  is_controlled: boolean;
  notes: string | null;
  created_at: string;
  dispensed_at: string | null;
  encounter_id: string;
  inventory_item_id: string | null;
  patients: PatientSummary | PatientSummary[] | null;
  inventory_items: InventorySummary | InventorySummary[] | null;
  dispensed_by_staff:
    | Pick<StaffSummary, "full_name">
    | Array<Pick<StaffSummary, "full_name">>
    | null;
};

type FulfillmentBoardProps = {
  fulfillments: FulfillmentBoardItem[];
  inventoryItems: InventorySummary[];
  staffOptions: StaffSummary[];
  staffId: string;
  initialStatus?: FulfillmentStatus | "all";
};

const STATUS_FILTERS: Array<{ value: FulfillmentStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "dispensed", label: "Dispensed" },
  { value: "cancelled", label: "Cancelled" },
];

export function FulfillmentBoard({
  fulfillments,
  inventoryItems,
  staffOptions,
  staffId,
  initialStatus = "pending",
}: FulfillmentBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<FulfillmentStatus | "all">(initialStatus);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [activeFulfillment, setActiveFulfillment] = useState<FulfillmentBoardItem | null>(null);
  const [quantityDispensed, setQuantityDispensed] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [witnessStaffId, setWitnessStaffId] = useState("");
  const [dispenseNotes, setDispenseNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredFulfillments = fulfillments.filter((fulfillment) => {
    if (statusFilter !== "all" && fulfillment.status !== statusFilter) {
      return false;
    }

    if (!deferredQuery) {
      return true;
    }

    const patient = getFirstRelation(fulfillment.patients);
    const haystack = [
      fulfillment.drug_name,
      fulfillment.dosage,
      patient?.full_name,
      patient?.mrn,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(deferredQuery);
  });

  function openDispenseDialog(fulfillment: FulfillmentBoardItem) {
    setActiveFulfillment(fulfillment);
    setQuantityDispensed(String(fulfillment.quantity_requested));
    setInventoryItemId(fulfillment.inventory_item_id ?? "");
    setWitnessStaffId("");
    setDispenseNotes("");
    setActionError(null);
  }

  function closeDispenseDialog() {
    setActiveFulfillment(null);
    setActionError(null);
  }

  function handleDispense() {
    if (!activeFulfillment) {
      return;
    }

    setActionError(null);
    startTransition(async () => {
      try {
        await dispenseFulfillment({
          fulfillmentId: activeFulfillment.id,
          quantityDispensed: Number(quantityDispensed),
          inventoryItemId: inventoryItemId || null,
          witnessStaffId: witnessStaffId || null,
          notes: dispenseNotes,
        });
        toast.success("Prescription dispensed.");
        closeDispenseDialog();
        router.refresh();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to dispense.");
      }
    });
  }

  function handleCancel(fulfillmentId: string) {
    startTransition(async () => {
      try {
        await cancelFulfillment({ fulfillmentId });
        toast.success("Fulfillment task cancelled.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to cancel.");
      }
    });
  }

  const witnessOptions = staffOptions.filter((option) => option.id !== staffId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Prescription fulfillment</h2>
          <p className="text-sm text-muted-foreground">
            Dispense medications from completed encounters and update inventory.
          </p>
        </div>
        <Input
          placeholder="Search drug or patient..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            size="sm"
            variant={statusFilter === filter.value ? "default" : "outline"}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {filteredFulfillments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {statusFilter === "pending"
              ? "No prescriptions waiting to be dispensed."
              : "No fulfillment tasks match the current filters."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredFulfillments.map((fulfillment) => {
            const patient = getFirstRelation(fulfillment.patients);
            const inventory = getFirstRelation(fulfillment.inventory_items);
            const dispensedBy = getFirstRelation(fulfillment.dispensed_by_staff);

            return (
              <Card key={fulfillment.id}>
                <CardContent className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">
                        {buildPrescriptionSummary({
                          drugName: fulfillment.drug_name,
                          dosage: fulfillment.dosage,
                          quantityRequested: fulfillment.quantity_requested,
                        })}
                      </p>
                      <Badge variant={fulfillmentStatusBadgeVariant(fulfillment.status)}>
                        {getFulfillmentStatusLabel(fulfillment.status)}
                      </Badge>
                      {fulfillment.is_controlled ? (
                        <Badge variant="destructive">
                          <ShieldAlert className="mr-1 h-3 w-3" />
                          Controlled
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{patient?.full_name ?? "Unknown patient"}</span>
                      <span>MRN {patient?.mrn ?? "N/A"}</span>
                      <span>{format(new Date(fulfillment.created_at), "dd MMM yyyy, h:mm a")}</span>
                      {inventory ? (
                        <span>
                          Stock: {inventory.quantity_on_hand} {inventory.unit}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          No inventory match
                        </span>
                      )}
                      {dispensedBy ? <span>Dispensed by {dispensedBy.full_name}</span> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/clerking/${fulfillment.encounter_id}`}>
                      <Button type="button" size="sm" variant="outline">
                        <ClipboardPen className="mr-2 h-4 w-4" />
                        Encounter
                      </Button>
                    </Link>
                    {canDispenseFulfillment(fulfillment.status) ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openDispenseDialog(fulfillment)}
                          disabled={isPending}
                        >
                          Dispense
                        </Button>
                        {canCancelFulfillment(fulfillment.status) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCancel(fulfillment.id)}
                            disabled={isPending}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(activeFulfillment)} onOpenChange={(open) => !open && closeDispenseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispense medication</DialogTitle>
          </DialogHeader>
          {activeFulfillment ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {buildPrescriptionSummary({
                  drugName: activeFulfillment.drug_name,
                  dosage: activeFulfillment.dosage,
                  quantityRequested: activeFulfillment.quantity_requested,
                })}
              </p>

              <div className="space-y-2">
                <Label htmlFor="dispense-quantity">Quantity dispensed</Label>
                <Input
                  id="dispense-quantity"
                  type="number"
                  min={1}
                  value={quantityDispensed}
                  onChange={(event) => setQuantityDispensed(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dispense-inventory">Inventory item</Label>
                <select
                  id="dispense-inventory"
                  value={inventoryItemId}
                  onChange={(event) => setInventoryItemId(event.target.value)}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">No inventory deduction</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.quantity_on_hand} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              {activeFulfillment.is_controlled ? (
                <div className="space-y-2">
                  <Label htmlFor="dispense-witness">Witness (required for controlled drugs)</Label>
                  <select
                    id="dispense-witness"
                    value={witnessStaffId}
                    onChange={(event) => setWitnessStaffId(event.target.value)}
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  >
                    <option value="">Select witness</option>
                    {witnessOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="dispense-notes">Notes</Label>
                <Textarea
                  id="dispense-notes"
                  value={dispenseNotes}
                  onChange={(event) => setDispenseNotes(event.target.value)}
                  rows={3}
                />
              </div>

              {actionError ? (
                <p className="text-sm text-destructive">{actionError}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDispenseDialog}>
                  Close
                </Button>
                <Button type="button" onClick={handleDispense} disabled={isPending}>
                  Confirm dispense
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getFirstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
