"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Pill, Plus, Search, X } from "lucide-react";
import {
  addPrescription,
  removePrescription,
  reorderPrescriptions,
} from "@/lib/actions/encounter-actions";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { DRUG_FREQUENCIES } from "@/lib/constants";
import { toast } from "@/lib/toast";
import type { DrugRoute } from "@/types/database";

type Prescription = {
  id: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  route: string;
  instructions: string | null;
  sort_order: number;
};

type DrugResult = {
  id: string;
  name: string;
  generic_name: string | null;
  formulation: string | null;
  strength: string | null;
};

export function PrescriptionForm({
  encounterId,
  initialPrescriptions,
  disabled,
}: {
  encounterId: string;
  initialPrescriptions: Prescription[];
  disabled: boolean;
}) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(
    [...initialPrescriptions].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [showForm, setShowForm] = useState(false);
  const [drugQuery, setDrugQuery] = useState("");
  const [drugResults, setDrugResults] = useState<DrugResult[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<DrugResult | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const listboxId = `prescription-drug-search-${encounterId}`;
  const [form, setForm] = useState({
    drug_name: "",
    dosage: "",
    frequency: "OD",
    duration: "3 days",
    quantity: 0,
    route: "oral" as DrugRoute,
    instructions: "",
  });

  const searchDrugs = useCallback(async (q: string) => {
    if (q.length < 2) {
      setDrugResults([]);
      return;
    }
    const res = await fetch(`/api/search/drugs?q=${encodeURIComponent(q)}&limit=8`);
    setDrugResults(await res.json());
  }, []);

  useDebounce(drugQuery, 300, searchDrugs);

  const hasDrugResults = drugResults.length > 0;

  const updateDropdownPosition = useCallback(() => {
    if (!searchContainerRef.current) {
      return;
    }

    const rect = searchContainerRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!showForm || !hasDrugResults) {
      setDropdownPosition(null);
      return;
    }

    updateDropdownPosition();

    const syncDropdownPosition = () => {
      updateDropdownPosition();
    };

    window.addEventListener("resize", syncDropdownPosition);
    window.addEventListener("scroll", syncDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", syncDropdownPosition);
      window.removeEventListener("scroll", syncDropdownPosition, true);
    };
  }, [showForm, hasDrugResults, updateDropdownPosition]);

  function handleDrugSelect(drug: DrugResult) {
    setSelectedDrug(drug);
    setForm((prev) => ({
      ...prev,
      drug_name: drug.name,
      dosage: drug.strength ?? "",
    }));
    setDrugQuery("");
    setDrugResults([]);
  }

  async function handleAdd() {
    const data = await addPrescription(encounterId, {
      drug_id: selectedDrug?.id ?? null,
      drug_name: form.drug_name,
      dosage: form.dosage,
      frequency: form.frequency,
      duration: form.duration,
      quantity: form.quantity,
      route: form.route,
      instructions: form.instructions || undefined,
    });
    setPrescriptions((prev) => [...prev, data]);
    toast.success("Prescription added", `${form.drug_name} ${form.dosage}`.trim());
    resetForm();
  }

  async function handleRemove(id: string) {
    const removed = prescriptions.find((prescription) => prescription.id === id);
    await removePrescription(id);
    setPrescriptions((prev) =>
      prev
        .filter((prescription) => prescription.id !== id)
        .map((prescription, index) => ({
          ...prescription,
          sort_order: index,
        }))
    );
    if (removed) {
      toast.success("Prescription removed", removed.drug_name);
    }
  }

  async function handleMovePrescription(currentIndex: number, direction: -1 | 1) {
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= prescriptions.length) return;

    const reordered = [...prescriptions];
    const [movedPrescription] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, movedPrescription);

    const normalized = reordered.map((prescription, index) => ({
      ...prescription,
      sort_order: index,
    }));

    setPrescriptions(normalized);
    await reorderPrescriptions(
      encounterId,
      normalized.map((prescription) => prescription.id)
    );
  }

  function resetForm() {
    setShowForm(false);
    setSelectedDrug(null);
    setDrugQuery("");
    setForm({ drug_name: "", dosage: "", frequency: "OD", duration: "3 days", quantity: 0, route: "oral", instructions: "" });
  }

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Pill className="h-4 w-4" />
          Prescriptions
        </CardTitle>
        {!disabled && !showForm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(true)}
            aria-label="Add prescription"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {prescriptions.map((rx, index) => (
          <div key={rx.id} className="flex items-start justify-between rounded border p-2 text-xs">
            <div>
              <p className="font-medium">{rx.drug_name} {rx.dosage}</p>
              <p className="text-muted-foreground">
                {rx.frequency} x {rx.duration} (Qty: {rx.quantity}) — {rx.route}
              </p>
              {rx.instructions && <p className="text-muted-foreground italic">{rx.instructions}</p>}
            </div>
            {!disabled ? (
              <div className="ml-2 flex items-center gap-1">
                {prescriptions.length > 1 ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 px-0"
                      onClick={() => void handleMovePrescription(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${rx.drug_name} up`}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 px-0"
                      onClick={() => void handleMovePrescription(index, 1)}
                      disabled={index === prescriptions.length - 1}
                      aria-label={`Move ${rx.drug_name} down`}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleRemove(rx.id)}
                  aria-label={`Remove prescription ${rx.drug_name}`}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ) : null}
          </div>
        ))}

        {showForm && (
          <div className="space-y-2 rounded border p-3">
            {/* Drug search */}
            <div ref={searchContainerRef} className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id={listboxId}
                role="combobox"
                aria-expanded={hasDrugResults}
                aria-controls={`${listboxId}-results`}
                aria-autocomplete="list"
                aria-label="Search drug"
                placeholder="Search drug..."
                value={drugQuery}
                onChange={(e) => setDrugQuery(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
              {isMounted && hasDrugResults && dropdownPosition
                ? createPortal(
                  <div
                    id={`${listboxId}-results`}
                    role="listbox"
                    aria-label="Drug search results"
                    className="fixed z-[70] max-h-40 overflow-auto rounded border bg-popover shadow-md"
                    style={{
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                      width: dropdownPosition.width,
                    }}
                  >
                  {drugResults.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      role="option"
                      aria-selected={selectedDrug?.id === d.id}
                      onClick={() => handleDrugSelect(d)}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted"
                    >
                      <span className="font-medium">{d.name}</span>
                      {d.strength && <span className="text-muted-foreground"> {d.strength}</span>}
                      {d.formulation && <span className="text-muted-foreground"> ({d.formulation})</span>}
                    </button>
                  ))}
                  </div>,
                  document.body
                )
                : null}
            </div>

            {form.drug_name && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px]">Dosage</Label>
                    <Input value={form.dosage} onChange={(e) => setForm((p) => ({ ...p, dosage: e.target.value }))} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Frequency</Label>
                    <select
                      value={form.frequency}
                      onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}
                      className="h-7 w-full rounded-md border text-xs px-2"
                    >
                      {DRUG_FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>{f.value}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Duration</Label>
                    <Input value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Quantity</Label>
                    <Input type="number" value={form.quantity || ""} onChange={(e) => setForm((p) => ({ ...p, quantity: parseInt(e.target.value) || 0 }))} className="h-7 text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px]">Instructions</Label>
                  <Input placeholder="e.g. after meals" value={form.instructions} onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))} className="h-7 text-xs" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!form.dosage || !form.quantity}>Add</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetForm}>Cancel</Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
