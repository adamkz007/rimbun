"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import {
  addDiagnosis,
  removeDiagnosis,
  reorderDiagnoses,
} from "@/lib/actions/encounter-actions";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { toast } from "@/lib/toast";

type Diagnosis = {
  id: string;
  icd10_code: string;
  icd10_description: string;
  diagnosis_type: "primary" | "secondary";
  sort_order: number;
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
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>(
    [...initialDiagnoses].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const listboxId = `diagnosis-search-${encounterId}`;

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

  const showOverlay = results.length > 0 || searching;

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
    if (!showOverlay) {
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
  }, [showOverlay, updateDropdownPosition]);

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
    toast.success("Diagnosis added", `${result.code} — ${result.description}`);
  }

  async function handleRemove(id: string) {
    const removed = diagnoses.find((diagnosis) => diagnosis.id === id);
    await removeDiagnosis(id);
    setDiagnoses((prev) =>
      prev
        .filter((diagnosis) => diagnosis.id !== id)
        .map((diagnosis, index) => ({
          ...diagnosis,
          sort_order: index,
          diagnosis_type: index === 0 ? "primary" : "secondary",
        }))
    );
    if (removed) {
      toast.success("Diagnosis removed", `${removed.icd10_code} — ${removed.icd10_description}`);
    }
  }

  async function handleMoveDiagnosis(currentIndex: number, direction: -1 | 1) {
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= diagnoses.length) return;

    const reordered = [...diagnoses];
    const [movedDiagnosis] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, movedDiagnosis);

    const normalized: Diagnosis[] = reordered.map((diagnosis, index) => ({
      ...diagnosis,
      sort_order: index,
      diagnosis_type: index === 0 ? "primary" : "secondary",
    }));

    setDiagnoses(normalized);
    await reorderDiagnoses(
      encounterId,
      normalized.map((diagnosis) => diagnosis.id)
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {diagnoses.map((diagnosis, index) => (
          <div
            key={diagnosis.id}
            className="flex items-center gap-1 rounded-md border bg-background px-2 py-1"
          >
            <Badge
              variant={diagnosis.diagnosis_type === "primary" ? "default" : "secondary"}
              aria-label={`${diagnosis.diagnosis_type} diagnosis ${diagnosis.icd10_code}`}
            >
              {diagnosis.icd10_code} - {diagnosis.icd10_description}
            </Badge>
            {!disabled && diagnoses.length > 1 ? (
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 px-0"
                  onClick={() => void handleMoveDiagnosis(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${diagnosis.icd10_code} up`}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 px-0"
                  onClick={() => void handleMoveDiagnosis(index, 1)}
                  disabled={index === diagnoses.length - 1}
                  aria-label={`Move ${diagnosis.icd10_code} down`}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
            ) : null}
            {!disabled && (
              <button
                type="button"
                onClick={() => void handleRemove(diagnosis.id)}
                className="ml-1"
                aria-label={`Remove diagnosis ${diagnosis.icd10_code}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!disabled && (
        <div ref={searchContainerRef} className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id={listboxId}
            role="combobox"
            aria-expanded={showOverlay}
            aria-controls={`${listboxId}-results`}
            aria-autocomplete="list"
            aria-label="Search ICD-10 diagnosis"
            placeholder="Search ICD-10 diagnosis..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
          {isMounted && dropdownPosition && showOverlay
            ? createPortal(
              results.length > 0 ? (
                <div
                  id={`${listboxId}-results`}
                  role="listbox"
                  aria-label="ICD-10 search results"
                  className="fixed z-70 max-h-60 overflow-auto rounded-md border bg-popover shadow-md"
                  style={{
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                    width: dropdownPosition.width,
                  }}
                >
                  {results.map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => handleSelect(r)}
                      className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      <span className="font-mono text-xs text-primary">{r.code}</span>{" "}
                      <span>{r.description}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  id={`${listboxId}-results`}
                  role="status"
                  aria-live="polite"
                  className="fixed z-70 rounded-md border bg-popover p-3 text-sm text-muted-foreground shadow-md"
                  style={{
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                    width: dropdownPosition.width,
                  }}
                >
                  Searching...
                </div>
              ),
              document.body
            )
            : null}
        </div>
      )}
    </div>
  );
}
