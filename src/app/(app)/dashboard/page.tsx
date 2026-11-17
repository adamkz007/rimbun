import { requirePageAccess } from "@/lib/auth";
import { isModuleEnabled } from "@/lib/modules";
import { getTodayUtcBounds } from "@/lib/queue";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  ChevronRight,
  ClipboardPen,
  Filter,
  ListOrdered,
  Repeat2,
  RotateCcw,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import { CLINIC_TIME_ZONE } from "@/lib/care-loop/format";
import { cn } from "@/lib/utils";
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
  const loopEnabled = isModuleEnabled(staff.clinics?.settings, "loop");
  const { start: queueDayStart, end: queueDayEnd } = getTodayUtcBounds();
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

  const [encounterRes, patientRes, doctorRes, pastEncountersRes, queueRes, loopOpenRes, loopOverdueRes] = await Promise.all([
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
    queueEnabled
      ? supabase
          .from("queue_entries")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", staff.clinic_id)
          .in("status", ["waiting", "with_nurse"])
          .gte("checked_in_at", queueDayStart)
          .lt("checked_in_at", queueDayEnd)
      : Promise.resolve({ count: null }),
    loopEnabled
      ? supabase
          .from("result_cases")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", staff.clinic_id)
          .neq("state", "closed")
      : Promise.resolve({ count: null }),
    loopEnabled
      ? supabase
          .from("result_cases")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", staff.clinic_id)
          .neq("state", "closed")
          .lt("current_step_due_at", new Date().toISOString())
      : Promise.resolve({ count: null }),
  ]);

  const activeEncounters = encounterRes.count ?? 0;
  const totalPatients = patientRes.count ?? 0;
  const waitingQueueCount = queueRes.count ?? 0;
  const pastEncounters = (pastEncountersRes.data ?? []) as PastEncounter[];
  const doctorOptions = doctorRes.data ?? [];
  const totalPastEncounters = pastEncountersRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalPastEncounters / PAST_ENCOUNTERS_PAGE_SIZE));
  const pageLabel = totalPastEncounters === 0 ? 0 : Math.min(page, totalPages);

  const loopOverdue = loopOverdueRes.count ?? 0;

  // Safety-net follow-ups needing a person now: red flags first, then nurse calls.
  const followupsVisible = loopEnabled && (staff.role === "doctor" || staff.role === "nurse");
  const { data: followupAction } = followupsVisible
    ? await supabase
        .from("safety_net_followups")
        .select("state")
        .eq("clinic_id", staff.clinic_id)
        .in("state", ["escalated", "needs_call", "ready_to_close"])
    : { data: [] as Array<{ state: string }> };
  const redFlagFollowups = (followupAction ?? []).filter((row) => row.state === "escalated").length;
  const callFollowups = (followupAction ?? []).filter((row) => row.state === "needs_call").length;
  const signOffFollowups = (followupAction ?? []).filter((row) => row.state === "ready_to_close").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{formatClinicToday()}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-leaf-ink sm:text-3xl">
            Good {getGreeting()}, {greetingName(staff.full_name)}
          </h1>
        </div>
        {loopEnabled && loopOverdue > 0 ? (
          <Link
            href="/cases?list=overdue"
            className="inline-flex items-center gap-2 rounded-full border border-leaf-amber/50 bg-leaf-amber-soft px-3.5 py-1.5 text-sm font-medium text-leaf-amber-ink transition-colors hover:border-leaf-amber"
          >
            <span className="size-2 rounded-full bg-leaf-amber" aria-hidden="true" />
            {loopOverdue} follow-up{loopOverdue === 1 ? "" : "s"} overdue
          </Link>
        ) : null}
      </div>

      {redFlagFollowups > 0 || callFollowups > 0 || signOffFollowups > 0 ? (
        <Link
          href="/followups?list=action"
          className={
            redFlagFollowups > 0
              ? "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
              : "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-leaf-amber/50 bg-leaf-amber-soft px-4 py-3 text-sm text-leaf-amber-ink"
          }
        >
          <span
            className={`size-2.5 rounded-full ${redFlagFollowups > 0 ? "bg-red-500" : "bg-leaf-amber"}`}
            aria-hidden="true"
          />
          <span className="font-medium">
            {redFlagFollowups > 0
              ? `${redFlagFollowups} high-risk safety-net follow-up${redFlagFollowups === 1 ? "" : "s"}: a doctor needs to act now`
              : callFollowups > 0
                ? "Safety-net check-ins need a call"
                : "Safety-net check-ins are ready to close"}
          </span>
          {redFlagFollowups > 0 && callFollowups > 0 ? (
            <span>
              · {callFollowups} more need{callFollowups === 1 ? "s" : ""} a nurse call
            </span>
          ) : redFlagFollowups === 0 && callFollowups > 0 ? (
            <span>
              {callFollowups} patient{callFollowups === 1 ? "" : "s"} to call
            </span>
          ) : null}
          {signOffFollowups > 0 && staff.role === "doctor" ? (
            <span>
              · {signOffFollowups} ready for your sign-off
            </span>
          ) : null}
        </Link>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {activeEncounterCardEnabled ? (
          <StatTile
            href="/clerking"
            label="Active encounters"
            value={activeEncounters}
            hint="In progress today"
            icon={ClipboardPen}
            tone="leaf"
          />
        ) : null}
        <StatTile href="/patients" label="Patients" value={totalPatients} hint="Total registered" icon={Users} tone="ink" />
        {queueEnabled ? (
          <StatTile href="/queue" label="Queue" value={waitingQueueCount} hint="Waiting now" icon={ListOrdered} tone="sage" />
        ) : null}
        {loopEnabled ? (
          <StatTile
            href={loopOverdue > 0 ? "/cases?list=overdue" : "/cases"}
            label="Result follow-ups"
            value={loopOpenRes.count ?? 0}
            hint={loopOverdue > 0 ? `${loopOverdue} overdue` : "Open, none overdue"}
            icon={Repeat2}
            tone="amber"
            alert={loopOverdue > 0}
          />
        ) : null}
      </div>

      {clerkingEnabled ? (
        <Card>
          <CardHeader className="gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Past Encounters</CardTitle>
              </div>
              <Badge variant="outline">
                {totalPastEncounters} result{totalPastEncounters === 1 ? "" : "s"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="space-y-1 sm:col-span-2 xl:col-span-1">
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

              <div className="space-y-1 sm:col-span-2 xl:col-span-1">
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

              <div className="min-w-0 space-y-1">
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

              <div className="min-w-0 space-y-1">
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

              <div className="flex items-end gap-2 sm:col-span-2 sm:justify-end xl:col-span-1">
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
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {pastEncounters.map((encounter) => {
                  const patient = getFirstRelation(encounter.patients);
                  const doctor = getFirstRelation(encounter.staff);
                  const doctorName = doctor?.full_name ?? "Unknown doctor";
                  const patientName = patient?.full_name ?? "Unknown patient";

                  return (
                    <li key={encounter.id}>
                      <Link
                        href={`/clerking/${encounter.id}`}
                        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-leaf-mist"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-leaf-sage/45 text-xs font-semibold text-leaf-ink">
                          {initialsOf(patientName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-leaf-text">{patientName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            MRN {patient?.mrn ?? "N/A"} · {doctorName} ·{" "}
                            {format(new Date(encounter.encounter_date), "dd MMM yyyy")}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
                            ENCOUNTER_STATUS_STYLES[encounter.status]
                          )}
                        >
                          {formatEncounterStatus(encounter.status)}
                        </span>
                        <ChevronRight
                          className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
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

const ENCOUNTER_STATUS_STYLES: Record<Tables<"encounters">["status"], string> = {
  in_progress: "bg-leaf text-white",
  completed: "bg-leaf-mist text-leaf-ink",
  amended: "bg-leaf-amber-soft text-leaf-amber-ink",
};

const TILE_TONES = {
  ink: "bg-leaf-ink text-leaf-paper",
  leaf: "bg-leaf text-white",
  sage: "bg-leaf-sage/55 text-leaf-ink",
  amber: "bg-leaf-amber-soft text-leaf-amber-ink",
} as const;

function StatTile({
  href,
  label,
  value,
  hint,
  icon: Icon,
  tone,
  alert,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  tone: keyof typeof TILE_TONES;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-[border-color,box-shadow] hover:border-leaf-sage hover:shadow-[0_8px_24px_-12px] hover:shadow-leaf-ink/25"
    >
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", TILE_TONES[tone])}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl leading-tight font-semibold text-leaf-text tabular-nums">{value}</p>
        <p className={cn("truncate text-xs", alert ? "font-medium text-leaf-amber-ink" : "text-muted-foreground")}>
          {hint}
        </p>
      </div>
    </Link>
  );
}

const HONORIFICS = /^(dr|prof|mr|mrs|ms|dato'?|datin|tan sri|puan|encik)\.?$/i;

/** "Dr. Hakim Rahman" → "Dr. Hakim"; "Siti Nur" → "Siti". */
function greetingName(fullName: string | null | undefined) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "there";
  return HONORIFICS.test(parts[0]) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0];
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter((part) => /^[A-Za-z]/.test(part) && !/^(bin|binti|a\/l|a\/p)$/i.test(part))
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatClinicToday() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function getGreeting() {
  // The clinic's local hour, not the server's (servers run in UTC).
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIME_ZONE, hour: "numeric", hour12: false }).format(new Date())
  );
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
