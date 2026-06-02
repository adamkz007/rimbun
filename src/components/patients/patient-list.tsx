"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ClipboardPen,
  Filter,
  Plus,
  RotateCcw,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import { createEncounter } from "@/lib/actions/encounter-actions";
import { registerPatient } from "@/lib/actions/patient-actions";
import { PatientFormFields } from "@/components/patients/patient-form-fields";
import {
  EMPTY_PATIENT_FORM_VALUES,
  type PatientArchiveStatus,
  type PatientDuplicateMatch,
  type PatientFieldErrors,
  type PatientFormValues,
  type PatientSortOption,
} from "@/lib/patients";

type Patient = {
  id: string;
  full_name: string;
  mrn: string;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  archived_at: string | null;
  merged_into_patient_id: string | null;
};

type PatientListProps = {
  patients: Patient[];
  canStartEncounter: boolean;
  filters: {
    query: string;
    gender: string;
    archiveStatus: PatientArchiveStatus;
    sort: PatientSortOption;
  };
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
};

export function PatientList({
  patients,
  canStartEncounter,
  filters,
  pagination,
}: PatientListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(filters.query);
  const [gender, setGender] = useState(filters.gender);
  const [archiveStatus, setArchiveStatus] = useState(filters.archiveStatus);
  const [sort, setSort] = useState(filters.sort);
  const [form, setForm] = useState<PatientFormValues>(EMPTY_PATIENT_FORM_VALUES);
  const [fieldErrors, setFieldErrors] = useState<PatientFieldErrors>({});
  const [duplicateMatches, setDuplicateMatches] = useState<PatientDuplicateMatch[]>([]);
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [listMessage, setListMessage] = useState<string | null>(null);
  const [startingEncounter, setStartingEncounter] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleStartEncounter(patientId: string) {
    setStartingEncounter(patientId);
    setListMessage(null);

    try {
      const encounter = await createEncounter(patientId);
      router.push(`/clerking/${encounter.id}`);
    } catch (error) {
      setListMessage(
        error instanceof Error ? error.message : "Unable to start the encounter."
      );
      setStartingEncounter(null);
    }
  }

  function handleRegister() {
    setRegisterMessage(null);
    setFieldErrors({});
    setDuplicateMatches([]);

    startTransition(async () => {
      const result = await registerPatient(form);
      setRegisterMessage(result.message);
      setFieldErrors(result.fieldErrors ?? {});
      setDuplicateMatches(result.duplicateMatches ?? []);

      if (result.success) {
        setRegisterOpen(false);
        setForm(EMPTY_PATIENT_FORM_VALUES);
        router.refresh();
      }
    });
  }

  function updateRoute(nextValues: {
    query?: string;
    gender?: string;
    archiveStatus?: PatientArchiveStatus;
    sort?: PatientSortOption;
    page?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    const updates = {
      q: nextValues.query ?? search,
      gender: nextValues.gender ?? gender,
      status: nextValues.archiveStatus ?? archiveStatus,
      sort: nextValues.sort ?? sort,
      page: String(nextValues.page ?? 1),
    };

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "active" && key === "status" || value === "recent" && key === "sort") {
        params.delete(key);
        return;
      }

      if (!value.trim?.() && key !== "page") {
        params.delete(key);
        return;
      }

      params.set(key, value);
    });

    if (updates.page === "1") {
      params.delete("page");
    }

    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  function handleResetFilters() {
    setSearch("");
    setGender("");
    setArchiveStatus("active");
    setSort("recent");
    router.push(pathname);
  }

  function handleFormChange<K extends keyof PatientFormValues>(
    field: K,
    value: PatientFormValues[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form
          className="grid gap-3 lg:flex lg:flex-1 lg:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            updateRoute({ query: search, gender, archiveStatus, sort, page: 1 });
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, MRN, IC, phone, or email..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 lg:w-auto">
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">All genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            <select
              value={archiveStatus}
              onChange={(event) =>
                setArchiveStatus(event.target.value as PatientArchiveStatus)
              }
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All records</option>
            </select>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as PatientSortOption)}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="recent">Recently added</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A-Z</option>
              <option value="mrn">MRN</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Apply
            </Button>
            <Button type="button" variant="ghost" onClick={handleResetFilters}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </form>

        <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
          <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />
            Register Patient
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Register New Patient</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <PatientFormFields
                values={form}
                errors={fieldErrors}
                onChange={handleFormChange}
                idPrefix="register-patient"
                disabled={isPending}
              />

              {registerMessage ? (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  {registerMessage}
                </div>
              ) : null}

              {duplicateMatches.length ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                  <p className="font-medium">Possible duplicates</p>
                  <div className="mt-2 space-y-2">
                    {duplicateMatches.map((match) => (
                      <div key={match.id} className="rounded-md border bg-background p-2">
                        <div className="flex items-center justify-between gap-3">
                          <Link href={`/patients/${match.id}`} className="font-medium hover:underline">
                            {match.fullName}
                          </Link>
                          <span className="text-xs text-muted-foreground">{match.mrn}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {match.reasons.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <Button type="button" className="w-full" disabled={isPending} onClick={handleRegister}>
                {isPending ? "Registering..." : "Register Patient"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          {pagination.total} patient record{pagination.total === 1 ? "" : "s"}
        </p>
        <p>
          Page {pagination.page} of {pagination.totalPages}
        </p>
      </div>

      {listMessage ? (
        <Card>
          <CardContent className="py-3 text-sm text-destructive">{listMessage}</CardContent>
        </Card>
      ) : null}

      {patients.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {filters.query || filters.gender || filters.archiveStatus !== "active"
              ? "No patients match the current filters."
              : "No patients registered yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {patients.map((patient) => (
            <Card key={patient.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="flex items-center justify-between py-3">
                <Link href={`/patients/${patient.id}`} className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium hover:underline">{patient.full_name}</p>
                    {patient.archived_at ? (
                      <Badge variant="outline">
                        {patient.merged_into_patient_id ? "Merged" : "Archived"}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    MRN: {patient.mrn}
                    {patient.gender && ` | ${patient.gender}`}
                    {patient.phone && ` | ${patient.phone}`}
                    {patient.email && ` | ${patient.email}`}
                  </p>
                </Link>
                <div className="flex items-center gap-2 ml-2">
                  <Link href={`/patients/${patient.id}`}>
                    <Button size="sm" variant="ghost">
                      <User className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  {canStartEncounter ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartEncounter(patient.id)}
                      disabled={
                        startingEncounter === patient.id || Boolean(patient.archived_at)
                      }
                    >
                      <ClipboardPen className="mr-2 h-3.5 w-3.5" />
                      {startingEncounter === patient.id ? "Starting..." : "Start Encounter"}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={pagination.page <= 1}
            onClick={() =>
              updateRoute({
                query: filters.query,
                gender: filters.gender,
                archiveStatus: filters.archiveStatus,
                sort: filters.sort,
                page: pagination.page - 1,
              })
            }
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() =>
              updateRoute({
                query: filters.query,
                gender: filters.gender,
                archiveStatus: filters.archiveStatus,
                sort: filters.sort,
                page: pagination.page + 1,
              })
            }
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
