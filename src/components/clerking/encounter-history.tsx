"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Search, ClipboardPen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/types/database";

type EncounterHistoryItem = Pick<
  Tables<"encounters">,
  "id" | "status" | "created_at" | "encounter_date"
> & {
  staff: Array<Pick<Tables<"staff">, "full_name">> | null;
  encounter_diagnoses: Array<
    Pick<Tables<"encounter_diagnoses">, "id" | "icd10_code" | "icd10_description" | "diagnosis_type">
  > | null;
  encounter_prescriptions: Array<
    Pick<Tables<"encounter_prescriptions">, "id" | "drug_name" | "dosage" | "frequency" | "duration" | "route">
  > | null;
};

type SortOption = "newest" | "oldest" | "doctor";

export function EncounterHistory({ encounters }: { encounters: EncounterHistoryItem[] }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const filteredEncounters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = normalizedQuery
      ? encounters.filter((encounter) => getEncounterSearchText(encounter).includes(normalizedQuery))
      : encounters;

    return [...filtered].sort((a, b) => {
      if (sortBy === "doctor") {
        return getDoctorName(a).localeCompare(getDoctorName(b));
      }

      const firstDate = getEncounterTimestamp(a);
      const secondDate = getEncounterTimestamp(b);

      return sortBy === "oldest" ? firstDate - secondDate : secondDate - firstDate;
    });
  }, [encounters, query, sortBy]);

  if (!encounters.length) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No past encounters recorded for this patient yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search diagnosis, prescription, doctor..."
            className="pl-8"
          />
        </div>
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as SortOption)}
          className="h-8 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="doctor">Doctor A-Z</option>
        </select>
      </div>

      {!filteredEncounters.length ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No past encounters match your search.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEncounters.map((encounter) => (
            <Link key={encounter.id} href={`/clerking/${encounter.id}`}>
              <Card className="transition-colors hover:bg-muted/30">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <ClipboardPen className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {format(new Date(encounter.encounter_date ?? encounter.created_at), "dd MMM yyyy, h:mm a")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Dr. {getDoctorName(encounter)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={encounter.status === "completed" ? "secondary" : "default"}>
                      {encounter.status === "in_progress" ? "In Progress" : "Completed"}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Diagnosis</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {encounter.encounter_diagnoses?.length ? (
                          encounter.encounter_diagnoses.map((diagnosis) => (
                            <Badge
                              key={diagnosis.id}
                              variant={diagnosis.diagnosis_type === "primary" ? "default" : "secondary"}
                            >
                              {diagnosis.icd10_code} - {diagnosis.icd10_description}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">No diagnosis recorded.</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Prescription</p>
                      <div className="mt-1 space-y-1">
                        {encounter.encounter_prescriptions?.length ? (
                          encounter.encounter_prescriptions.map((prescription) => (
                            <p key={prescription.id} className="text-xs text-muted-foreground">
                              {prescription.drug_name} {prescription.dosage} - {prescription.frequency} x{" "}
                              {prescription.duration}
                            </p>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">No prescription recorded.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function getDoctorName(encounter: EncounterHistoryItem) {
  return encounter.staff?.[0]?.full_name ?? "Unknown";
}

function getEncounterTimestamp(encounter: EncounterHistoryItem) {
  return new Date(encounter.encounter_date ?? encounter.created_at).getTime();
}

function getEncounterSearchText(encounter: EncounterHistoryItem) {
  return [
    getDoctorName(encounter),
    encounter.status,
    ...(encounter.encounter_diagnoses ?? []).flatMap((diagnosis) => [
      diagnosis.icd10_code,
      diagnosis.icd10_description,
      diagnosis.diagnosis_type,
    ]),
    ...(encounter.encounter_prescriptions ?? []).flatMap((prescription) => [
      prescription.drug_name,
      prescription.dosage,
      prescription.frequency,
      prescription.duration,
      prescription.route,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
