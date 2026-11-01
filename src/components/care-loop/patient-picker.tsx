"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

export type PickedPatient = { id: string; full_name: string; mrn: string };

/** Patient search backed by /api/search/patients, as in the queue check-in. */
export function PatientPicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: PickedPatient | null;
  onChange: (patient: PickedPatient | null) => void;
}) {
  const [query, setQuery] = useState(value?.full_name ?? "");
  const [results, setResults] = useState<PickedPatient[]>([]);

  async function search(next: string) {
    setQuery(next);
    onChange(null);
    if (next.trim().length < 2) {
      setResults([]);
      return;
    }
    const response = await fetch(`/api/search/patients?q=${encodeURIComponent(next)}&limit=8`);
    setResults(response.ok ? ((await response.json()) as PickedPatient[]) : []);
  }

  return (
    <div className="space-y-2">
      <Input
        id={id}
        placeholder="Search by name, MRN, or IC..."
        value={query}
        onChange={(event) => void search(event.target.value)}
        autoComplete="off"
      />
      {value ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <p className="font-medium">{value.full_name}</p>
          <p className="text-muted-foreground">MRN {value.mrn}</p>
        </div>
      ) : results.length > 0 ? (
        <div className="max-h-48 overflow-y-auto rounded-md border" role="listbox" aria-label="Patient search results">
          {results.map((patient) => (
            <button
              key={patient.id}
              type="button"
              className="flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
              onClick={() => {
                onChange(patient);
                setQuery(patient.full_name);
                setResults([]);
              }}
            >
              <span className="font-medium">{patient.full_name}</span>
              <span className="text-xs text-muted-foreground">MRN {patient.mrn}</span>
            </button>
          ))}
        </div>
      ) : query.trim().length >= 2 ? (
        <p className="text-sm text-muted-foreground">No matching patients found.</p>
      ) : null}
    </div>
  );
}
