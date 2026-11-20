"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatClinicDate, formatClinicDateTime } from "@/lib/care-loop/format";
import {
  ArrowLeft,
  Check,
  Copy,
  MessageCircle,
  MessageSquareText,
  Phone,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addCaseNote,
  advanceCase,
  closeCase,
  addReferralNote,
  createReferral,
  logPatientContact,
  logReferralResponse,
  reassignCase,
  recordMessagingConsent,
  reopenCase,
  sendPatientMessage,
} from "@/lib/actions/care-loop-actions";
import {
  getTest,
  NEXT_STEP_LABELS,
  PATIENT_LANGUAGES,
  URGENCY_LABELS,
  type NextStep,
  type PatientLanguage,
  type Urgency,
} from "@/lib/care-loop/catalogue";
import { LANGUAGE_LABELS } from "@/lib/care-loop/messages";
import { unwrap } from "@/lib/care-loop/result";
import {
  canContactPatients,
  canCreateReferrals,
  canProgressCases,
  canReassignCases,
  canReopenCases,
  CASE_STATE_LABELS,
  CASE_STATES,
  closureRequiresSignOff,
  CLOSURE_REASON_LABELS,
  CLOSURE_REASONS,
  NEXT_ACTION_LABELS,
  needsDoctorDecision,
  nextReminderDue,
  stateIndex,
  type CaseState,
  type ClosureReason,
} from "@/lib/care-loop/workflow";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { StaffRole } from "@/types/database";
import { DueLabel, StateBadge, UrgencyBadge } from "./case-badges";

export type CaseWorkspaceData = {
  item: {
    id: string;
    state: CaseState;
    urgency: Urgency;
    next_step: NextStep;
    next_step_note: string | null;
    owner_staff_id: string;
    current_step_due_at: string | null;
    opened_at: string;
    notified_at: string | null;
    appointment_at: string | null;
    surveillance_due_on: string | null;
    contact_attempts: number;
    reminders_sent: number;
    understanding_correct: boolean | null;
    referral_rejected_at: string | null;
    closure_reason: ClosureReason | null;
    closure_note: string | null;
    closed_at: string | null;
    test_code: string;
  };
  patient: {
    id: string;
    full_name: string;
    mrn: string;
    phone: string | null;
    has_identity_check: boolean;
    preferred_language: PatientLanguage;
    messaging_consent_at: string | null;
  };
  result: {
    value: string;
    collected_on: string | null;
    reported_at: string;
    source: string | null;
    notes: string | null;
    suggested_urgency: Urgency | null;
  };
  owner: { id: string; full_name: string; role: string } | null;
  events: Array<{
    id: string;
    event_type: string;
    from_state: string | null;
    to_state: string | null;
    note: string | null;
    data: Record<string, unknown>;
    created_at: string;
    actor_name: string;
  }>;
  messages: Array<{
    id: string;
    channel: string;
    kind: string;
    language: string;
    sent_at: string;
    opened_at: string | null;
    verified_at: string | null;
    response: string | null;
    understanding_correct: boolean | null;
    call_outcome: string | null;
    note: string | null;
  }>;
  referrals: Array<{
    id: string;
    receiving_facility: string;
    receiving_clinician: string | null;
    specialty: string | null;
    status: string;
    created_at: string;
    viewed_at: string | null;
    reject_reason: string | null;
    appointment_on: string | null;
    appointment_time: string | null;
    appointment_place: string | null;
    responded_at: string | null;
    outcome_note: string | null;
    attended_on: string | null;
    expires_at: string;
    messages: Array<{ id: string; author_side: string; author_name: string; body: string; created_at: string }>;
  }>;
  staff: Array<{ id: string; full_name: string; role: string }>;
  referralDraft: string;
  referralSpecialty: string;
  /** The safety-net follow-up this case continues, if any. */
  followup?: {
    id: string;
    label: string;
    steps: Array<{ key: string; label: string; at: string | null }>;
    events: Array<{ id: string; label: string; at: string; actor: string; note: string | null }>;
  } | null;
};

const EVENT_LABELS: Record<string, string> = {
  opened: "Case opened",
  owner_changed: "Owner changed",
  consent_recorded: "Messaging consent recorded",
  message_sent: "Result notice sent",
  reminder_sent: "Reminder sent",
  link_opened: "Patient opened the secure link",
  patient_acknowledged: "Patient acknowledged",
  patient_question: "Patient has a question",
  callback_requested: "Patient asked for a call",
  contact_logged: "Contact logged",
  advanced: "Step recorded",
  referral_sent: "Referral sent",
  referral_viewed: "Referral viewed",
  referral_accepted: "Referral accepted",
  referral_rejected: "Referral declined",
  referral_outcome: "Referral outcome received",
  closed: "Case closed",
  reopened: "Case reopened",
  note: "Note",
};

function isFailure(value: unknown): value is { ok: false; error: string } {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === false;
}

const SELECT_CLASS = "h-9 w-full rounded-md border bg-transparent px-3 text-sm";

export function CaseWorkspace({ data, staffRole }: { data: CaseWorkspaceData; staffRole: StaffRole }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { item, patient, result } = data;
  const test = getTest(item.test_code);
  const isClosed = item.state === "closed";

  function run(action: () => Promise<unknown>, success: string, after?: () => void) {
    startTransition(async () => {
      try {
        const result = await action();
        if (isFailure(result)) throw new Error(result.error);
        toast.success(success);
        after?.();
        router.refresh();
      } catch (error) {
        toast.error("Action failed", error instanceof Error ? error.message : undefined);
      }
    });
  }

  const actionProps = { data, staffRole, isPending, run };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/cases">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{patient.full_name}</h1>
              <UrgencyBadge urgency={item.urgency} />
              <StateBadge state={item.state} />
            </div>
            <p className="text-sm text-muted-foreground">
              {test?.label ?? item.test_code}: <span className="font-medium text-foreground">{result.value}</span> · MRN{" "}
              <Link href={`/patients/${patient.id}`} className="text-primary hover:underline">
                {patient.mrn}
              </Link>{" "}
              · Owner {data.owner?.full_name ?? "–"}
            </p>
          </div>
        </div>
        <div className="lg:text-right">
          <p className="text-sm font-medium">{NEXT_ACTION_LABELS[item.state]}</p>
          <DueLabel dueAt={item.current_step_due_at} urgency={item.urgency} state={item.state} />
        </div>
      </div>

      <Stepper state={item.state} events={data.events} followup={data.followup ?? null} />

      {needsDoctorDecision({ state: item.state, contactAttempts: item.contact_attempts }) ? (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm">
            <span className="font-medium text-destructive">Patient unreachable after {item.contact_attempts} attempts.</span>{" "}
            A doctor should decide the next step: try another channel, contact the emergency contact, or close as lost to
            follow-up.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Result and plan</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Result" value={result.value} />
              <Detail
                label="Suggested by rule"
                value={result.suggested_urgency ? URGENCY_LABELS[result.suggested_urgency] : "Within normal range"}
              />
              <Detail label="Collected" value={result.collected_on ? formatClinicDate(result.collected_on) : null} />
              <Detail label="Logged" value={formatClinicDateTime(result.reported_at)} />
              <Detail label="Source" value={result.source} />
              <Detail label="Next step for patient" value={NEXT_STEP_LABELS[item.next_step].en} />
              <Detail
                label="Appointment"
                value={item.appointment_at ? formatClinicDateTime(item.appointment_at) : null}
              />
              <Detail
                label="Surveillance due"
                value={item.surveillance_due_on ? formatClinicDate(item.surveillance_due_on) : null}
              />
              <Detail
                label="Patient understanding"
                value={
                  item.understanding_correct === null
                    ? null
                    : item.understanding_correct
                      ? "Confirmed next step correctly"
                      : "Picked the wrong next step: call to explain"
                }
              />
              {item.next_step_note ? (
                <div className="sm:col-span-2">
                  <Detail label="Clinical note" value={item.next_step_note} />
                </div>
              ) : null}
              {isClosed ? (
                <div className="sm:col-span-2">
                  <Detail
                    label="Closure"
                    value={`${item.closure_reason ? CLOSURE_REASON_LABELS[item.closure_reason] : ""}: ${item.closure_note ?? ""}`}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Timeline events={data.events} followup={data.followup ?? null} />
        </div>

        <div className="space-y-4">
          {!isClosed && canContactPatients(staffRole) ? <ContactCard {...actionProps} /> : null}
          {!isClosed && (canCreateReferrals(staffRole) || data.referrals.length > 0) ? (
            <ReferralCard {...actionProps} />
          ) : null}
          {!isClosed && canProgressCases(staffRole) ? <ProgressCard {...actionProps} /> : null}
          {!isClosed && canReassignCases(staffRole) ? <OwnerCard {...actionProps} /> : null}
          <CloseCard {...actionProps} />
          <NoteCard {...actionProps} />
        </div>
      </div>
    </div>
  );
}

type ActionProps = {
  data: CaseWorkspaceData;
  staffRole: StaffRole;
  isPending: boolean;
  run: (action: () => Promise<unknown>, success: string, after?: () => void) => void;
};

/** Steps the case actually passed through are ticked; steps it jumped over are shown as skipped. */
function Stepper({
  state,
  events,
  followup,
}: {
  state: CaseState;
  events: CaseWorkspaceData["events"];
  followup: CaseWorkspaceData["followup"];
}) {
  const current = stateIndex(state);
  const reached = new Set<string>(["triaged", ...events.map((event) => event.to_state).filter((value): value is string => !!value)]);
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Case progress">
      {followup?.steps.map((step) => (
        <li
          key={step.key}
          className="flex items-center gap-1 rounded-full border border-amber-400 px-2.5 py-1 text-xs text-amber-900 dark:text-amber-200"
          title={step.at ? `From the safety-net follow-up · ${formatClinicDateTime(step.at)}` : "From the safety-net follow-up"}
        >
          {step.at ? <Check className="h-3 w-3" /> : null}
          {step.label}
        </li>
      ))}
      {CASE_STATES.map((step, index) => {
        const done = index < current && reached.has(step);
        const skipped = index < current && !reached.has(step);
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
              done && "border-primary/30 bg-primary/5 text-primary",
              skipped && "border-dashed text-muted-foreground line-through",
              index === current && "border-primary bg-primary text-primary-foreground",
              index > current && "text-muted-foreground"
            )}
            aria-current={index === current ? "step" : undefined}
            title={skipped ? "Skipped" : undefined}
          >
            {done ? <Check className="h-3 w-3" /> : null}
            {CASE_STATE_LABELS[step]}
          </li>
        );
      })}
    </ol>
  );
}

function Timeline({ events, followup }: { events: CaseWorkspaceData["events"]; followup: CaseWorkspaceData["followup"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Timeline</CardTitle>
        <CardDescription>
          {followup ? (
            <>
              From the visit to closure, oldest first. The amber steps come from the{" "}
              <Link href={`/followups/${followup.id}`} className="underline underline-offset-2">
                safety-net follow-up ({followup.label})
              </Link>
              .
            </>
          ) : (
            "Every change to this case, oldest first."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4 border-l pl-4">
          {followup?.events.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-amber-500 bg-background" />
              <p className="text-sm font-medium">{event.label}</p>
              <p className="text-xs text-muted-foreground">
                {event.actor} · {formatClinicDateTime(event.at)}
              </p>
              {event.note ? <p className="mt-1 whitespace-pre-wrap text-sm">{event.note}</p> : null}
            </li>
          ))}
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="text-sm font-medium">{EVENT_LABELS[event.event_type] ?? event.event_type}</p>
                {event.to_state && event.from_state !== event.to_state ? (
                  <span className="text-xs text-muted-foreground">
                    → {CASE_STATE_LABELS[event.to_state as CaseState] ?? event.to_state}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {event.actor_name} · {formatClinicDateTime(event.created_at)}
              </p>
              {describeEventData(event) ? <p className="mt-1 text-sm">{describeEventData(event)}</p> : null}
              {event.note ? <p className="mt-1 whitespace-pre-wrap text-sm">{event.note}</p> : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function describeEventData(event: CaseWorkspaceData["events"][number]) {
  const data = event.data ?? {};
  switch (event.event_type) {
    case "message_sent":
    case "reminder_sent":
      return `${data.channel === "sms" ? "SMS" : "WhatsApp"} in ${LANGUAGE_LABELS[data.language as PatientLanguage] ?? data.language}`;
    case "contact_logged":
      return `${data.channel === "in_person" ? "In person" : "Phone call"}: ${String(data.outcome).replace("_", " ")}${
        data.acknowledged ? ", patient understood the next step" : ""
      }`;
    case "patient_acknowledged":
      return data.understandingCorrect ? "Picked the correct next step." : "Picked the wrong next step; call to explain.";
    case "referral_sent":
    case "referral_viewed":
    case "referral_accepted":
    case "referral_rejected":
    case "referral_outcome":
      return [data.facility, data.appointmentOn ? `appointment ${data.appointmentOn}` : null].filter(Boolean).join(", ") || null;
    case "closed":
      return CLOSURE_REASON_LABELS[data.reason as ClosureReason] ?? null;
    case "opened":
      return `Urgency ${URGENCY_LABELS[data.urgency as Urgency] ?? data.urgency}${
        data.suggestedUrgency && data.suggestedUrgency !== data.urgency
          ? ` (rule suggested ${URGENCY_LABELS[data.suggestedUrgency as Urgency]})`
          : ""
      }`;
    default:
      return null;
  }
}

function ContactCard({ data, isPending, run }: ActionProps) {
  const { item, patient } = data;
  const [language, setLanguage] = useState<PatientLanguage>(patient.preferred_language);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const [callChannel, setCallChannel] = useState<"call" | "in_person">("call");
  const [outcome, setOutcome] = useState<"reached" | "no_answer" | "wrong_number">("reached");
  const [acknowledged, setAcknowledged] = useState(true);
  const [callNote, setCallNote] = useState("");
  const reminderDue = item.notified_at ? nextReminderDue(item.notified_at, item.reminders_sent) : null;
  const awaitingPatient = item.state === "triaged" || item.state === "notified";

  function send(channel: "whatsapp" | "sms") {
    // Open the window first so the browser doesn't block it as a popup.
    const opened = window.open("about:blank", "_blank");
    run(
      async () => {
        try {
          const result = unwrap(await sendPatientMessage({ caseId: item.id, channel, language }));
          setLastLink(result.link);
          if (opened) opened.location.href = result.openUrl;
        } catch (error) {
          opened?.close();
          throw error;
        }
      },
      item.notified_at ? "Reminder ready to send" : "Message ready to send"
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Contact patient</CardTitle>
        <CardDescription>
          {patient.phone ?? "No phone number on file"} · {item.contact_attempts} attempt{item.contact_attempts === 1 ? "" : "s"}
          {reminderDue && item.state === "notified"
            ? ` · next reminder ${formatClinicDateTime(reminderDue)}`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="contact-language">Language</Label>
          <select
            id="contact-language"
            className={SELECT_CLASS}
            value={language}
            onChange={(event) => setLanguage(event.target.value as PatientLanguage)}
          >
            {PATIENT_LANGUAGES.map((value) => (
              <option key={value} value={value}>
                {LANGUAGE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        {!patient.messaging_consent_at ? (
          <div className="space-y-2 rounded-md border border-dashed p-3 text-sm">
            <p>Messaging needs the patient&apos;s consent (PDPA). Confirm they agreed to receive results by WhatsApp or SMS.</p>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => recordMessagingConsent(item.id, language), "Consent recorded")}
            >
              Patient consented
            </Button>
          </div>
        ) : !patient.has_identity_check ? (
          <p className="text-sm text-destructive">
            Add the patient&apos;s date of birth or IC number so they can verify the secure link.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={isPending || !patient.phone} onClick={() => send("whatsapp")}>
              <MessageCircle className="mr-1 h-4 w-4" />
              {!item.notified_at ? "Send via WhatsApp" : awaitingPatient ? "WhatsApp reminder" : "Resend link"}
            </Button>
            <Button size="sm" variant="outline" disabled={isPending || !patient.phone} onClick={() => send("sms")}>
              <MessageSquareText className="mr-1 h-4 w-4" />
              SMS
            </Button>
          </div>
        )}

        {lastLink ? <CopyField label="Secure link (valid 30 days)" value={lastLink} /> : null}

        <Button size="sm" variant="outline" disabled={isPending} onClick={() => setCallOpen(true)}>
          <Phone className="mr-1 h-4 w-4" />
          Log call or visit
        </Button>

        <MessageHistory messages={data.messages} />

        <Dialog open={callOpen} onOpenChange={setCallOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="call-channel">Channel</Label>
                  <select
                    id="call-channel"
                    className={SELECT_CLASS}
                    value={callChannel}
                    onChange={(event) => setCallChannel(event.target.value as "call" | "in_person")}
                  >
                    <option value="call">Phone call</option>
                    <option value="in_person">In person</option>
                  </select>
                </div>
                {callChannel === "call" ? (
                  <div className="space-y-2">
                    <Label htmlFor="call-outcome">Outcome</Label>
                    <select
                      id="call-outcome"
                      className={SELECT_CLASS}
                      value={outcome}
                      onChange={(event) => setOutcome(event.target.value as typeof outcome)}
                    >
                      <option value="reached">Reached</option>
                      <option value="no_answer">No answer</option>
                      <option value="wrong_number">Wrong number</option>
                    </select>
                  </div>
                ) : null}
              </div>
              {awaitingPatient && (callChannel === "in_person" || outcome === "reached") ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                  />
                  Patient understood the result and the next step
                </label>
              ) : null}
              <Textarea rows={3} placeholder="Note" value={callNote} onChange={(event) => setCallNote(event.target.value)} />
              <Button
                disabled={isPending}
                onClick={() =>
                  run(
                    () =>
                      logPatientContact({
                        caseId: item.id,
                        channel: callChannel,
                        outcome,
                        acknowledged: awaitingPatient && acknowledged,
                        note: callNote,
                      }),
                    "Contact logged",
                    () => {
                      setCallOpen(false);
                      setCallNote("");
                    }
                  )
                }
              >
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function MessageHistory({ messages }: { messages: CaseWorkspaceData["messages"] }) {
  if (messages.length === 0) return null;
  return (
    <div className="space-y-1.5 border-t pt-3">
      {messages.slice(0, 5).map((message) => (
        <div key={message.id} className="flex items-start justify-between gap-2 text-xs">
          <span>
            {message.kind === "call_log"
              ? `${message.channel === "in_person" ? "Visit" : "Call"}: ${String(message.call_outcome).replace("_", " ")}`
              : `${message.kind === "reminder" ? "Reminder" : "Notice"} by ${message.channel === "sms" ? "SMS" : "WhatsApp"}`}
            <span className="text-muted-foreground"> · {formatClinicDateTime(message.sent_at)}</span>
          </span>
          <span className="shrink-0 text-muted-foreground">
            {message.response === "understood"
              ? "Understood"
              : message.response === "call_me"
                ? "Asked for a call"
                : message.response === "question"
                  ? "Has a question"
                  : message.verified_at
                    ? "Verified"
                    : message.opened_at
                      ? "Opened"
                      : message.kind === "call_log"
                        ? ""
                        : "Not opened"}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReferralCard({ data, staffRole, isPending, run }: ActionProps) {
  const { item } = data;
  const [open, setOpen] = useState(false);
  const [facility, setFacility] = useState("");
  const [clinician, setClinician] = useState("");
  const [specialty, setSpecialty] = useState(data.referralSpecialty);
  const [letter, setLetter] = useState(data.referralDraft);
  const [link, setLink] = useState<string | null>(null);
  const [responseFor, setResponseFor] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<"accepted" | "rejected" | "attended">("accepted");
  const [responseText, setResponseText] = useState("");
  const [responseDate, setResponseDate] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Referral</CardTitle>
        <CardDescription>The receiving clinician accepts or declines through a secure link, no account needed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.referrals.map((referral) => (
          <div key={referral.id} className="space-y-1 rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{referral.receiving_facility}</p>
              <Badge variant={referral.status === "rejected" ? "destructive" : "secondary"}>{referral.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {[referral.specialty, referral.receiving_clinician].filter(Boolean).join(" · ")}
              {referral.specialty || referral.receiving_clinician ? " · " : ""}
              Sent {formatClinicDate(referral.created_at)}
              {referral.viewed_at ? ` · viewed ${formatClinicDate(referral.viewed_at)}` : ""}
            </p>
            <ReferralSteps referral={referral} />
            {referral.appointment_on ? (
              <p className="rounded-md bg-muted/50 px-2 py-1 text-xs">
                <span className="font-medium">Appointment</span> {referral.appointment_on}
                {referral.appointment_time ? `, ${referral.appointment_time}` : ""}
                {referral.appointment_place ? ` · ${referral.appointment_place}` : ""}
              </p>
            ) : null}
            {referral.reject_reason ? <p className="text-xs text-destructive">Declined: {referral.reject_reason}</p> : null}
            {referral.outcome_note ? <p className="text-xs">Outcome: {referral.outcome_note}</p> : null}
            <ReferralThread referral={referral} canWrite={canProgressCases(staffRole)} isPending={isPending} run={run} />
            {canProgressCases(staffRole) && referral.status !== "attended" && referral.status !== "rejected" ? (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setResponseFor(referral.id);
                  setResponseStatus(referral.status === "accepted" || referral.status === "booked" ? "attended" : "accepted");
                  setResponseText("");
                  setResponseDate("");
                }}
              >
                Log response received by phone or letter
              </Button>
            ) : null}
          </div>
        ))}

        {link ? <CopyField label="Send this link to the receiving clinician" value={link} share /> : null}

        {canCreateReferrals(staffRole) ? (
          <Button size="sm" variant={data.referrals.length ? "outline" : "default"} onClick={() => setOpen(true)}>
            <Send className="mr-1 h-4 w-4" />
            {data.referrals.length ? "New referral" : "Write referral"}
          </Button>
        ) : null}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Referral letter</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Input placeholder="Receiving facility *" value={facility} onChange={(event) => setFacility(event.target.value)} />
                <Input placeholder="Clinician (optional)" value={clinician} onChange={(event) => setClinician(event.target.value)} />
                <Input placeholder="Specialty" value={specialty} onChange={(event) => setSpecialty(event.target.value)} />
              </div>
              <Textarea
                rows={16}
                className="font-mono text-xs"
                value={letter}
                onChange={(event) => setLetter(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Drafted from the case and the latest consultation. Replace the placeholders and check every line before sending.
              </p>
              <Button
                disabled={isPending}
                onClick={() =>
                  run(
                    async () => {
                      const result = unwrap(await createReferral({
                        caseId: item.id,
                        receivingFacility: facility,
                        receivingClinician: clinician,
                        specialty,
                        // Fill the placeholder "To:" line from the fields, unless the doctor rewrote it.
                        letter: /^To: .*\[Receiving facility\]/m.test(letter)
                          ? letter.replace(
                              /^To: .*$/m,
                              `To: ${[clinician, specialty, facility].filter((part) => part.trim()).join(", ")}`
                            )
                          : letter,
                      }));
                      setLink(result.link);
                    },
                    "Referral created",
                    () => setOpen(false)
                  )
                }
              >
                Create referral link
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!responseFor} onOpenChange={(value) => !value && setResponseFor(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log referral response</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <select
                className={SELECT_CLASS}
                value={responseStatus}
                onChange={(event) => setResponseStatus(event.target.value as typeof responseStatus)}
              >
                <option value="accepted">Accepted</option>
                <option value="rejected">Declined</option>
                <option value="attended">Patient seen (outcome received)</option>
              </select>
              {responseStatus !== "rejected" ? (
                <div className="space-y-1">
                  <Label htmlFor="referral-date">{responseStatus === "accepted" ? "Appointment date" : "Seen on"}</Label>
                  <Input id="referral-date" type="date" value={responseDate} onChange={(event) => setResponseDate(event.target.value)} />
                </div>
              ) : null}
              {responseStatus !== "accepted" ? (
                <Textarea
                  rows={3}
                  placeholder={responseStatus === "rejected" ? "Reason given" : "Outcome and plan from the specialist"}
                  value={responseText}
                  onChange={(event) => setResponseText(event.target.value)}
                />
              ) : null}
              <Button
                disabled={isPending}
                onClick={() =>
                  run(
                    () =>
                      logReferralResponse({
                        referralId: responseFor!,
                        status: responseStatus,
                        rejectReason: responseText,
                        outcomeNote: responseText,
                        appointmentOn: responseStatus === "accepted" ? responseDate : null,
                        attendedOn: responseStatus === "attended" ? responseDate : null,
                      }),
                    "Referral updated",
                    () => setResponseFor(null)
                  )
                }
              >
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function ReferralSteps({ referral }: { referral: CaseWorkspaceData["referrals"][number] }) {
  const declined = referral.status === "rejected";
  const accepted = ["accepted", "booked", "attended"].includes(referral.status);
  const steps = [
    { label: "Sent", done: true, at: referral.created_at },
    { label: "Viewed", done: !!referral.viewed_at, at: referral.viewed_at },
    declined
      ? { label: "Declined", done: true, at: referral.responded_at }
      : { label: "Accepted", done: accepted, at: accepted ? referral.responded_at : null },
    ...(declined ? [] : [{ label: "Booked", done: !!referral.appointment_on, at: null as string | null }]),
    ...(declined ? [] : [{ label: "Attended", done: referral.status === "attended", at: null as string | null }]),
  ];
  return (
    <ol className="flex flex-wrap items-center gap-1 py-1 text-[11px]" aria-label="Referral progress">
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-center gap-1">
          {index > 0 ? <span className="h-px w-3 bg-border" aria-hidden="true" /> : null}
          <span
            className={cn(
              "rounded-full border px-2 py-0.5",
              step.done ? (step.label === "Declined" ? "border-destructive text-destructive" : "border-primary/40 bg-primary/5 text-primary") : "text-muted-foreground"
            )}
            title={step.at ? formatClinicDateTime(step.at) : undefined}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ReferralThread({
  referral,
  canWrite,
  isPending,
  run,
}: {
  referral: CaseWorkspaceData["referrals"][number];
  canWrite: boolean;
  isPending: boolean;
  run: ActionProps["run"];
}) {
  const [body, setBody] = useState("");
  return (
    <div className="space-y-1.5 pt-1">
      <p className="text-xs font-medium">Clinician thread</p>
      {referral.messages.length === 0 ? <p className="text-xs text-muted-foreground">No notes yet.</p> : null}
      {referral.messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs",
            message.author_side === "receiver" ? "bg-amber-50 dark:bg-amber-950/60" : "bg-muted/60"
          )}
        >
          <p className="font-medium">
            {message.author_name} · {formatClinicDateTime(message.created_at)}
          </p>
          <p className="whitespace-pre-wrap">{message.body}</p>
        </div>
      ))}
      {canWrite ? (
        <div className="flex gap-1.5">
          <Input
            className="h-8 text-xs"
            maxLength={1000}
            placeholder="Write to the receiving clinician"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={isPending || !body.trim()}
            onClick={() => run(() => addReferralNote(referral.id, body), "Note sent", () => setBody(""))}
          >
            Send
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ProgressCard({ data, isPending, run }: ActionProps) {
  const { item } = data;
  const later = CASE_STATES.filter((state) => state !== "closed" && stateIndex(state) > stateIndex(item.state));
  const [toState, setToState] = useState<CaseState | "">(later[0] ?? "");
  const [note, setNote] = useState("");
  const [appointmentAt, setAppointmentAt] = useState("");
  const [surveillanceDueOn, setSurveillanceDueOn] = useState("");

  if (later.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Record progress</CardTitle>
        <CardDescription>For steps done outside Rimbun: a repeat test, a booked review, a visit attended.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <select className={SELECT_CLASS} value={toState} onChange={(event) => setToState(event.target.value as CaseState)}>
          {later.map((state) => (
            <option key={state} value={state}>
              {CASE_STATE_LABELS[state]}
            </option>
          ))}
        </select>
        {toState === "accepted" || toState === "acknowledged" || toState === "confirmed" ? (
          <div className="space-y-1">
            <Label htmlFor="progress-appointment">Appointment (optional)</Label>
            <Input
              id="progress-appointment"
              type="datetime-local"
              value={appointmentAt}
              onChange={(event) => setAppointmentAt(event.target.value)}
            />
          </div>
        ) : null}
        {toState === "in_care" ? (
          <div className="space-y-1">
            <Label htmlFor="progress-surveillance">Next surveillance or review due (optional)</Label>
            <Input
              id="progress-surveillance"
              type="date"
              value={surveillanceDueOn}
              onChange={(event) => setSurveillanceDueOn(event.target.value)}
            />
          </div>
        ) : null}
        <Textarea
          rows={2}
          placeholder={toState === "in_care" ? "Treatment or surveillance plan (required)" : "Note"}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <Button
          size="sm"
          disabled={isPending || !toState}
          onClick={() =>
            run(
              () =>
                advanceCase({
                  caseId: item.id,
                  toState: toState as CaseState,
                  note,
                  // datetime-local has no zone: read it in the browser's zone before sending.
                  appointmentAt: appointmentAt ? new Date(appointmentAt).toISOString() : null,
                  surveillanceDueOn: surveillanceDueOn || null,
                }),
              "Progress recorded",
              () => setNote("")
            )
          }
        >
          Record
        </Button>
      </CardContent>
    </Card>
  );
}

function OwnerCard({ data, isPending, run }: ActionProps) {
  const [ownerId, setOwnerId] = useState(data.item.owner_staff_id);
  const [reason, setReason] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Owner</CardTitle>
        <CardDescription>One accountable person at a time. Hand-offs are logged.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <select className={SELECT_CLASS} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
          {data.staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name} ({member.role})
            </option>
          ))}
        </select>
        {ownerId !== data.item.owner_staff_id ? (
          <>
            <Input placeholder="Reason for hand-off" value={reason} onChange={(event) => setReason(event.target.value)} />
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => run(() => reassignCase(data.item.id, ownerId, reason), "Owner changed", () => setReason(""))}
            >
              Hand off
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CloseCard({ data, staffRole, isPending, run }: ActionProps) {
  const { item } = data;
  const [reason, setReason] = useState<ClosureReason>("completed");
  const [note, setNote] = useState("");

  if (item.state === "closed") {
    if (!canReopenCases(staffRole)) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reopen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Reason for reopening" value={note} onChange={(event) => setNote(event.target.value)} />
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => reopenCase(item.id, note), "Case reopened")}>
            Reopen case
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!canProgressCases(staffRole)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Close case</CardTitle>
        <CardDescription>
          {closureRequiresSignOff(reason)
            ? "This reason needs a doctor's sign-off."
            : "Needs evidence: the patient has attended and the outcome is recorded."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <select className={SELECT_CLASS} value={reason} onChange={(event) => setReason(event.target.value as ClosureReason)}>
          {CLOSURE_REASONS.map((value) => (
            <option key={value} value={value}>
              {CLOSURE_REASON_LABELS[value]}
            </option>
          ))}
        </select>
        <Textarea
          rows={2}
          placeholder="Evidence or decision (required)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => closeCase({ caseId: item.id, reason, note }), "Case closed")}>
          Close case
        </Button>
      </CardContent>
    </Card>
  );
}

function NoteCard({ data, isPending, run }: ActionProps) {
  const [note, setNote] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Add note</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        <Button size="sm" variant="outline" disabled={isPending || !note.trim()} onClick={() => run(() => addCaseNote(data.item.id, note), "Note added", () => setNote(""))}>
          Add note
        </Button>
      </CardContent>
    </Card>
  );
}

function CopyField({ label, value, share }: { label: string; value: string; share?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <Input readOnly value={value} className="text-xs" onFocus={(event) => event.target.select()} />
        <Button
          size="icon"
          variant="outline"
          aria-label="Copy link"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        {share ? (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(value)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border"
            aria-label="Share on WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap font-medium">{value}</p>
    </div>
  );
}
