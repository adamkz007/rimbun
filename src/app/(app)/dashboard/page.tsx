import { requirePageAccess } from "@/lib/auth";
import { isModuleEnabled } from "@/lib/modules";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ClipboardPen, Filter, ListOrdered, RotateCcw, Search, Users } from "lucide-react";
import Link from "next/link";
import type { Tables } from "@/types/database";

const PAST_ENCOUNTERS_PAGE_SIZE = 10;

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type PastEncounter = Pick<
  Tables<"encounters">,
  "id" | "status" | "encounter_date" | "created_at"
> & {
  patients:
    | Pick<Tables<"patients">, "id" | "full_name" | "mrn">
    | Array<Pick<Tables<"patients">, "id" | "full_name" | "mrn">>
    | null;
  staff:
    | Pick<Tables<"staff">, "id" | "full_name">
    | Array<Pick<Tables<"staff">, "id" | "full_name">>
    | null;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const staff = await requirePageAccess();
  const supabase = await getSupabaseServerClient();
  const params = await searchParams;
  const clerkingEnabled = isModuleEnabled(staff.clinics?.settings, "clerking");
  const activeEncounterCardEnabled =
    ["doctor", "nurse"].includes(staff.role) && clerkingEnabled;
  const queueEnabled = isModuleEnabled(staff.clinics?.settings, "queue");
  const patientQuery = getSingleValue(params.q)?.trim() ?? "";
  const doctorId = getSingleValue(params.doctor)?.trim() ?? "";
  const normalizedRange = normalizeDateRange(
    parseDateParam(getSingleValue(params.from)),
    parseDateParam(getSingleValue(params.to))
  );
  const page = Math.max(1, Number(getSingleValue(params.page) ?? "1") || 1);
  const start = (page - 1) * PAST_ENCOUNTERS_PAGE_SIZE;

  let pastEncountersQuery = supabase
    .from("encounters")
    .select(
      "id, status, encounter_date, created_at, patients!inner(id, full_name, mrn), staff:doctor_id(id, full_name)",
      { count: "exact" }
    )
    .neq("status", "in_progress");

  if (patientQuery) {
    pastEncountersQuery = pastEncountersQuery.ilike(
      "patients.full_name",
      `%${escapeLikeValue(patientQuery)}%`
    );
  }

  if (doctorId) {
    pastEncountersQuery = pastEncountersQuery.eq("doctor_id", doctorId);
  }

  if (normalizedRange.from) {
    pastEncountersQuery = pastEncountersQuery.gte("encounter_date", normalizedRange.from);
  }

  if (normalizedRange.to) {
    pastEncountersQuery = pastEncountersQuery.lte("encounter_date", normalizedRange.to);
  }

  const [encounterRes, patientRes, doctorRes, pastEncountersRes] = await Promise.all([
    activeEncounterCardEnabled
      ? supabase
          .from("encounters")
          .select("id", { count: "exact", head: true })
          .eq("doctor_id", staff.id)
          .eq("status", "in_progress")
      : Promise.resolve({ count: null }),
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null),
    clerkingEnabled
      ? supabase
          .from("staff")
          .select("id, full_name")
          .eq("role", "doctor")
          .eq("is_active", true)
          .order("full_name", { ascending: true })
      : Promise.resolve({ data: [] }),
    clerkingEnabled
      ? pastEncountersQuery
          .order("encounter_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(start, start + PAST_ENCOUNTERS_PAGE_SIZE - 1)
      : Promise.resolve({ data: [], count: 0 }),
  ]);

  const activeEncounters = encounterRes.count ?? 0;
  const totalPatients = patientRes.count ?? 0;
  const pastEncounters = (pastEncountersRes.data ?? []) as PastEncounter[];
  const doctorOptions = doctorRes.data ?? [];
  const totalPastEncounters = pastEncountersRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalPastEncounters / PAST_ENCOUNTERS_PAGE_SIZE));
  const pageLabel = totalPastEncounters === 0 ? 0 : Math.min(page, totalPages);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Good {getGreeting()}, {staff?.full_name?.split(" ")[0]}</h1>

      <div className="grid gap-4 md:grid-cols-3">
        {activeEncounterCardEnabled && (
          <Link href="/clerking">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Encounters</CardTitle>
                <ClipboardPen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{activeEncounters}</p>
                <p className="text-xs text-muted-foreground">In progress today</p>
              </CardContent>
            </Card>
          </Link>
        )}
        <Link href="/patients">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Patients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalPatients}</p>
              <p className="text-xs text-muted-foreground">Total registered</p>
            </CardContent>
          </Card>
        </Link>
        {queueEnabled ? (
          <Link href="/queue">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Queue</CardTitle>
                <ListOrdered className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">0</p>
                <p className="text-xs text-muted-foreground">Waiting now</p>
              </CardContent>
            </Card>
          </Link>
        ) : null}
      </div>

      {clerkingEnabled ? (
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <CardTitle>Past Encounters</CardTitle>
              </div>
              <Badge variant="outline">
                {totalPastEncounters} result{totalPastEncounters === 1 ? "" : "s"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1 space-y-1">
                <label htmlFor="dashboard-past-encounters-query" className="text-xs text-muted-foreground">
                  Patient name
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dashboard-past-encounters-query"
                    name="q"
                    placeholder="Search patient name..."
                    defaultValue={patientQuery}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="min-w-44 space-y-1">
                <label htmlFor="dashboard-past-encounters-doctor" className="text-xs text-muted-foreground">
                  Doctor
                </label>
                <select
                  id="dashboard-past-encounters-doctor"
                  name="doctor"
                  defaultValue={doctorId}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">All doctors</option>
                  {doctorOptions.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-36 space-y-1">
                <label htmlFor="dashboard-past-encounters-from" className="text-xs text-muted-foreground">
                  From
                </label>
                <Input
                  id="dashboard-past-encounters-from"
                  name="from"
                  type="date"
                  defaultValue={normalizedRange.from}
                />
              </div>

              <div className="min-w-36 space-y-1">
                <label htmlFor="dashboard-past-encounters-to" className="text-xs text-muted-foreground">
                  To
                </label>
                <Input
                  id="dashboard-past-encounters-to"
                  name="to"
                  type="date"
                  defaultValue={normalizedRange.to}
                />
              </div>

              <div className="flex items-end gap-2 self-end">
                <Button type="submit" variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Apply
                </Button>
                <Link href="/dashboard">
                  <Button type="button" variant="ghost">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </Link>
              </div>
            </form>

            <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>{describePastEncounterResults(totalPastEncounters, patientQuery, doctorId, normalizedRange)}</p>
              <p>
                Page {pageLabel} of {totalPages}
              </p>
            </div>

            {pastEncounters.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {patientQuery || doctorId || normalizedRange.from || normalizedRange.to
                    ? "No past encounters match the current filters."
                    : "No past encounters yet."}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {pastEncounters.map((encounter) => {
                  const patient = getFirstRelation(encounter.patients);
                  const doctor = getFirstRelation(encounter.staff);
                  const doctorName = doctor?.full_name ?? "Unknown doctor";

                  return (
                    <Link key={encounter.id} href={`/clerking/${encounter.id}`}>
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                        <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{patient?.full_name ?? "Unknown patient"}</p>
                              <Badge variant={encounter.status === "completed" ? "secondary" : "outline"}>
                                {formatEncounterStatus(encounter.status)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              MRN: {patient?.mrn ?? "N/A"} | Doctor: {doctorName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Encounter date{" "}
                              {format(new Date(encounter.encounter_date), "dd MMM yyyy")} | Logged{" "}
                              {format(new Date(encounter.created_at), "dd MMM yyyy, h:mm a")}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-primary">Open encounter</span>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}

            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3">
                {page > 1 ? (
                  <Link
                    href={buildDashboardHref({
                      q: patientQuery,
                      doctor: doctorId,
                      from: normalizedRange.from,
                      to: normalizedRange.to,
                      page: page - 1,
                    })}
                  >
                    <Button variant="outline">Previous</Button>
                  </Link>
                ) : (
                  <Button variant="outline" disabled>
                    Previous
                  </Button>
                )}

                {page < totalPages ? (
                  <Link
                    href={buildDashboardHref({
                      q: patientQuery,
                      doctor: doctorId,
                      from: normalizedRange.from,
                      to: normalizedRange.to,
                      page: page + 1,
                    })}
                  >
                    <Button variant="outline">Next</Button>
                  </Link>
                ) : (
                  <Button variant="outline" disabled>
                    Next
                  </Button>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseDateParam(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  return value;
}

function normalizeDateRange(from: string, to: string) {
  if (from && to && from > to) {
    return { from: to, to: from };
  }

  return { from, to };
}

function escapeLikeValue(value: string) {
  return value.replace(/[%_,]/g, "");
}

function formatEncounterStatus(status: Tables<"encounters">["status"]) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function describePastEncounterResults(
  total: number,
  patientQuery: string,
  doctorId: string,
  dateRange: { from: string; to: string }
) {
  if (!patientQuery && !doctorId && !dateRange.from && !dateRange.to) {
    return `Showing the latest ${total} past encounter${total === 1 ? "" : "s"}.`;
  }

  return `${total} past encounter${total === 1 ? "" : "s"} match the current filters.`;
}

function buildDashboardHref(params: {
  q: string;
  doctor: string;
  from: string;
  to: string;
  page: number;
}) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set("q", params.q);
  }

  if (params.doctor) {
    searchParams.set("doctor", params.doctor);
  }

  if (params.from) {
    searchParams.set("from", params.from);
  }

  if (params.to) {
    searchParams.set("to", params.to);
  }

  if (params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  const query = searchParams.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

function getFirstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
