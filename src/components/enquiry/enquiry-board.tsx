"use client";

import { useDeferredValue, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  CalendarClock,
  Link2,
  MessageSquare,
  Phone,
  Plus,
  Search,
  UserPlus,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  convertEnquiryToPatient,
  createEnquiry,
  linkEnquiryToPatient,
  scheduleReminder,
  updateEnquiryStatus,
} from "@/lib/actions/enquiry-actions";
import {
  ENQUIRY_SOURCES,
  ENQUIRY_STATUSES,
  canConvertEnquiry,
  enquiryStatusBadgeVariant,
  getEnquirySourceLabel,
  getEnquiryStatusLabel,
  isActiveEnquiryStatus,
} from "@/lib/enquiry";
import { toast } from "@/lib/toast";
import type { EnquirySource, EnquiryStatus } from "@/types/database";

type PatientSummary = {
  id: string;
  full_name: string;
  mrn: string;
};

type StaffSummary = {
  id: string;
  full_name: string;
};

export type EnquiryBoardItem = {
  id: string;
  source: EnquirySource;
  status: EnquiryStatus;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  subject: string | null;
  notes: string | null;
  scheduled_at: string | null;
  created_at: string;
  converted_patient_id: string | null;
  patients: PatientSummary | PatientSummary[] | null;
  converted_patients: PatientSummary | PatientSummary[] | null;
  assigned_staff: Pick<StaffSummary, "full_name"> | Array<Pick<StaffSummary, "full_name">> | null;
};

type PatientSearchResult = {
  id: string;
  full_name: string;
  mrn: string;
};

type EnquiryBoardProps = {
  enquiries: EnquiryBoardItem[];
  staffOptions: StaffSummary[];
  initialStatus?: EnquiryStatus | "all";
  initialSource?: EnquirySource | "all";
  initialQuery?: string;
};

const STATUS_FILTERS: Array<{ value: EnquiryStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  ...ENQUIRY_STATUSES.map((status) => ({
    value: status,
    label: getEnquiryStatusLabel(status),
  })),
];

const SOURCE_FILTERS: Array<{ value: EnquirySource | "all"; label: string }> = [
  { value: "all", label: "All sources" },
  ...ENQUIRY_SOURCES.map((source) => ({
    value: source,
    label: getEnquirySourceLabel(source),
  })),
];

export function EnquiryBoard({
  enquiries,
  staffOptions,
  initialStatus = "all",
  initialSource = "all",
  initialQuery = "",
}: EnquiryBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<EnquiryStatus | "all">(initialStatus);
  const [sourceFilter, setSourceFilter] = useState<EnquirySource | "all">(initialSource);
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<EnquiryBoardItem | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const deferredPatientQuery = useDeferredValue(patientQuery);
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);

  const filteredEnquiries = enquiries.filter((enquiry) => {
    if (statusFilter !== "all" && enquiry.status !== statusFilter) {
      return false;
    }

    if (sourceFilter !== "all" && enquiry.source !== sourceFilter) {
      return false;
    }

    if (!deferredQuery) {
      return true;
    }

    const patient = getFirstRelation(enquiry.converted_patients) ?? getFirstRelation(enquiry.patients);
    const haystack = [
      enquiry.contact_name,
      enquiry.contact_phone,
      enquiry.contact_email,
      enquiry.subject,
      patient?.full_name,
      patient?.mrn,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(deferredQuery);
  });

  async function searchPatients(search: string) {
    setPatientQuery(search);

    if (search.trim().length < 2) {
      setPatientResults([]);
      return;
    }

    const response = await fetch(
      `/api/search/patients?q=${encodeURIComponent(search)}&limit=8`
    );
    if (!response.ok) {
      setPatientResults([]);
      return;
    }

    const data = (await response.json()) as { results?: PatientSearchResult[] };
    setPatientResults(data.results ?? []);
  }

  function handleCreateSubmit(formData: FormData) {
    setCreateError(null);

    startTransition(async () => {
      const scheduledDate = formData.get("scheduledDate")?.toString();
      const scheduledTime = formData.get("scheduledTime")?.toString();
      let scheduledAt: string | undefined;

      if (scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      const result = await createEnquiry({
        source: formData.get("source")?.toString() as EnquirySource,
        contactName: formData.get("contactName")?.toString() ?? "",
        contactPhone: formData.get("contactPhone")?.toString() ?? undefined,
        contactEmail: formData.get("contactEmail")?.toString() ?? undefined,
        subject: formData.get("subject")?.toString() ?? undefined,
        notes: formData.get("notes")?.toString() ?? undefined,
        assignedTo: formData.get("assignedTo")?.toString() || undefined,
        scheduledAt,
      });

      if (!result.success) {
        setCreateError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setCreateOpen(false);
      router.refresh();
    });
  }

  function handleStatusUpdate(enquiryId: string, status: EnquiryStatus) {
    setActionError(null);

    startTransition(async () => {
      const result = await updateEnquiryStatus({ enquiryId, status });
      if (!result.success) {
        setActionError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setSelectedEnquiry(null);
      router.refresh();
    });
  }

  function handleConvert(enquiry: EnquiryBoardItem) {
    setActionError(null);

    startTransition(async () => {
      const result = await convertEnquiryToPatient({ enquiryId: enquiry.id });
      if (!result.success) {
        setActionError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setSelectedEnquiry(null);
      router.refresh();
    });
  }

  function handleLinkPatient(enquiryId: string, patientId: string) {
    setActionError(null);

    startTransition(async () => {
      const result = await linkEnquiryToPatient({ enquiryId, patientId });
      if (!result.success) {
        setActionError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setSelectedEnquiry(null);
      router.refresh();
    });
  }

  function handleScheduleReminder(enquiryId: string, formData: FormData) {
    setActionError(null);

    startTransition(async () => {
      const remindDate = formData.get("remindDate")?.toString();
      const remindTime = formData.get("remindTime")?.toString();

      if (!remindDate || !remindTime) {
        setActionError("Reminder date and time are required.");
        return;
      }

      const result = await scheduleReminder({
        enquiryId,
        reminderType: formData.get("reminderType")?.toString() as
          | "follow_up"
          | "appointment"
          | "callback",
        remindAt: new Date(`${remindDate}T${remindTime}`).toISOString(),
        message: formData.get("message")?.toString() ?? undefined,
        notificationChannel: formData.get("notificationChannel")?.toString() as
          | "in_app"
          | "email"
          | "sms"
          | undefined,
      });

      if (!result.success) {
        setActionError(result.message);
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search enquiries..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New enquiry
              </Button>
            }
          />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Capture enquiry</DialogTitle>
            </DialogHeader>
            <form action={handleCreateSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <select
                    id="source"
                    name="source"
                    required
                    defaultValue="call"
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  >
                    {ENQUIRY_SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {getEnquirySourceLabel(source)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Assign to</Label>
                  <select
                    id="assignedTo"
                    name="assignedTo"
                    defaultValue=""
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {staffOptions.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactName">Contact name</Label>
                <Input id="contactName" name="contactName" required />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Phone</Label>
                  <Input id="contactPhone" name="contactPhone" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input id="contactEmail" name="contactEmail" type="email" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" placeholder="Reason for enquiry" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scheduledDate">Scheduled date</Label>
                  <Input id="scheduledDate" name="scheduledDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduledTime">Scheduled time</Label>
                  <Input id="scheduledTime" name="scheduledTime" type="time" />
                </div>
              </div>

              {createError ? <p className="text-sm text-destructive">{createError}</p> : null}

              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save enquiry"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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

      <div className="flex flex-wrap gap-2">
        {SOURCE_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            size="sm"
            variant={sourceFilter === filter.value ? "secondary" : "ghost"}
            onClick={() => setSourceFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {filteredEnquiries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No enquiries match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredEnquiries.map((enquiry) => {
            const convertedPatient = getFirstRelation(enquiry.converted_patients);
            const linkedPatient = getFirstRelation(enquiry.patients);
            const assignedStaff = getFirstRelation(enquiry.assigned_staff);

            return (
              <Card key={enquiry.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelectedEnquiry(enquiry)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{enquiry.contact_name}</p>
                      <Badge variant={enquiryStatusBadgeVariant(enquiry.status)}>
                        {getEnquiryStatusLabel(enquiry.status)}
                      </Badge>
                      <Badge variant="outline">{getEnquirySourceLabel(enquiry.source)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {enquiry.subject ?? "No subject"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {enquiry.contact_phone ? <span>{enquiry.contact_phone}</span> : null}
                      {enquiry.scheduled_at ? (
                        <span>
                          Scheduled {format(new Date(enquiry.scheduled_at), "dd MMM yyyy, h:mm a")}
                        </span>
                      ) : null}
                      {assignedStaff ? <span>Assigned to {assignedStaff.full_name}</span> : null}
                      {convertedPatient ? (
                        <span>
                          Patient {convertedPatient.full_name} ({convertedPatient.mrn})
                        </span>
                      ) : linkedPatient ? (
                        <span>
                          Linked {linkedPatient.full_name} ({linkedPatient.mrn})
                        </span>
                      ) : null}
                    </div>
                  </button>

                  <div className="flex flex-wrap gap-2">
                    {isActiveEnquiryStatus(enquiry.status) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => handleStatusUpdate(enquiry.id, "in_progress")}
                      >
                        Start
                      </Button>
                    ) : null}
                    {canConvertEnquiry(enquiry.status) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => handleConvert(enquiry)}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Convert
                      </Button>
                    ) : null}
                    {convertedPatient ? (
                      <Link href={`/patients/${convertedPatient.id}`}>
                        <Button type="button" size="sm" variant="secondary">
                          View patient
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedEnquiry} onOpenChange={(open) => !open && setSelectedEnquiry(null)}>
        <DialogContent className="max-w-2xl">
          {selectedEnquiry ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedEnquiry.contact_name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={enquiryStatusBadgeVariant(selectedEnquiry.status)}>
                    {getEnquiryStatusLabel(selectedEnquiry.status)}
                  </Badge>
                  <Badge variant="outline">
                    {getEnquirySourceLabel(selectedEnquiry.source)}
                  </Badge>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p>{selectedEnquiry.contact_phone ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p>{selectedEnquiry.contact_email ?? "—"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground">Subject</p>
                    <p>{selectedEnquiry.subject ?? "—"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground">Notes</p>
                    <p className="whitespace-pre-wrap">{selectedEnquiry.notes ?? "—"}</p>
                  </div>
                </div>

                {canConvertEnquiry(selectedEnquiry.status) ? (
                  <div className="space-y-3 rounded-md border p-4">
                    <p className="text-sm font-medium">Link to existing patient</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search patients..."
                        value={patientQuery}
                        onChange={(event) => searchPatients(event.target.value)}
                      />
                    </div>
                    {patientResults.length > 0 ? (
                      <div className="space-y-1">
                        {patientResults.map((patient) => (
                          <button
                            key={patient.id}
                            type="button"
                            className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => handleLinkPatient(selectedEnquiry.id, patient.id)}
                            disabled={isPending}
                          >
                            <span>
                              {patient.full_name} ({patient.mrn})
                            </span>
                            <Link2 className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    ) : deferredPatientQuery.length >= 2 ? (
                      <p className="text-sm text-muted-foreground">No matching patients.</p>
                    ) : null}
                  </div>
                ) : null}

                {canConvertEnquiry(selectedEnquiry.status) ? (
                  <form
                    action={(formData) => handleScheduleReminder(selectedEnquiry.id, formData)}
                    className="space-y-3 rounded-md border p-4"
                  >
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <CalendarClock className="h-4 w-4" />
                      Schedule reminder
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="reminderType">Type</Label>
                        <select
                          id="reminderType"
                          name="reminderType"
                          defaultValue="callback"
                          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                        >
                          <option value="callback">Callback</option>
                          <option value="follow_up">Follow-up</option>
                          <option value="appointment">Appointment</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notificationChannel">Channel</Label>
                        <select
                          id="notificationChannel"
                          name="notificationChannel"
                          defaultValue="in_app"
                          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                        >
                          <option value="in_app">In-app</option>
                          <option value="email">Email</option>
                          <option value="sms">SMS</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="remindDate">Date</Label>
                        <Input id="remindDate" name="remindDate" type="date" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="remindTime">Time</Label>
                        <Input id="remindTime" name="remindTime" type="time" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea id="message" name="message" rows={2} />
                    </div>
                    <Button type="submit" size="sm" disabled={isPending}>
                      Schedule reminder
                    </Button>
                  </form>
                ) : null}

                {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

                <div className="flex flex-wrap gap-2">
                  {canConvertEnquiry(selectedEnquiry.status) ? (
                    <>
                      <Button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleConvert(selectedEnquiry)}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Register as patient
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => handleStatusUpdate(selectedEnquiry.id, "closed")}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Close
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => handleStatusUpdate(selectedEnquiry.id, "cancelled")}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </>
                  ) : null}
                  {selectedEnquiry.contact_phone ? (
                    <Button type="button" variant="ghost" disabled>
                      <Phone className="mr-2 h-4 w-4" />
                      {selectedEnquiry.contact_phone}
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
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
