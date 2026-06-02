"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Search } from "lucide-react";
import { addDiagnosis, removeDiagnosis } from "@/lib/actions/encounter-actions";
import { useDebounce } from "@/lib/hooks/use-debounce";

type Diagnosis = {
  id: string;
  icd10_code: string;
  icd10_description: string;
  diagnosis_type: "primary" | "secondary";
};

type SearchResult = {
  code: string;
  description: string;
  category: string | null;
};

export function DiagnosisPicker({
  encounterId,
  initialDiagnoses,
  disabled,
}: {
  encounterId: string;
  initialDiagnoses: Diagnosis[];
  disabled: boolean;
}) {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>(initialDiagnoses);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search/icd10?q=${encodeURIComponent(q)}&limit=8`);
      const data = await res.json();
      setResults(data);
    } finally {
      setSearching(false);
    }
  }, []);

  useDebounce(query, 300, search);

  async function handleSelect(result: SearchResult) {
    const data = await addDiagnosis(
      encounterId,
      result.code,
      result.description,
      diagnoses.length === 0 ? "primary" : "secondary"
    );
    setDiagnoses((prev) => [...prev, data]);
    setQuery("");
    setResults([]);
  }

  async function handleRemove(id: string) {
    await removeDiagnosis(id);
    setDiagnoses((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {diagnoses.map((d) => (
          <Badge key={d.id} variant={d.diagnosis_type === "primary" ? "default" : "secondary"}>
            {d.icd10_code} — {d.icd10_description}
            {!disabled && (
              <button onClick={() => handleRemove(d.id)} className="ml-1">
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>

      {!disabled && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ICD-10 diagnosis..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-auto">
              {results.map((r) => (
                <button
                  key={r.code}
                  onClick={() => handleSelect(r)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <span className="font-mono text-xs text-primary">{r.code}</span>{" "}
                  <span>{r.description}</span>
                </button>
              ))}
            </div>
          )}
          {searching && (
            <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover p-3 text-sm text-muted-foreground">
              Searching...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
