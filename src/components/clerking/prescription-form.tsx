"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus, Search, Pill } from "lucide-react";
import { addPrescription, removePrescription } from "@/lib/actions/encounter-actions";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { DRUG_FREQUENCIES } from "@/lib/constants";
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
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialPrescriptions);
  const [showForm, setShowForm] = useState(false);
  const [drugQuery, setDrugQuery] = useState("");
  const [drugResults, setDrugResults] = useState<DrugResult[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<DrugResult | null>(null);
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
    resetForm();
  }

  async function handleRemove(id: string) {
    await removePrescription(id);
    setPrescriptions((prev) => prev.filter((p) => p.id !== id));
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
          <Button variant="ghost" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {prescriptions.map((rx) => (
          <div key={rx.id} className="flex items-start justify-between rounded border p-2 text-xs">
            <div>
              <p className="font-medium">{rx.drug_name} {rx.dosage}</p>
              <p className="text-muted-foreground">
                {rx.frequency} x {rx.duration} (Qty: {rx.quantity}) — {rx.route}
              </p>
              {rx.instructions && <p className="text-muted-foreground italic">{rx.instructions}</p>}
            </div>
            {!disabled && (
              <button onClick={() => handleRemove(rx.id)}>
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </div>
        ))}

        {showForm && (
          <div className="space-y-2 rounded border p-3">
            {/* Drug search */}
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search drug..."
                value={drugQuery}
                onChange={(e) => setDrugQuery(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
              {drugResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded border bg-popover shadow-md max-h-40 overflow-auto">
                  {drugResults.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleDrugSelect(d)}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted"
                    >
                      <span className="font-medium">{d.name}</span>
                      {d.strength && <span className="text-muted-foreground"> {d.strength}</span>}
                      {d.formulation && <span className="text-muted-foreground"> ({d.formulation})</span>}
                    </button>
                  ))}
                </div>
              )}
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
