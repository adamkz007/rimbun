import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CauseLevelBadge, FollowupDue, FollowupStateBadge, PrototypeNotice, RiskBadge, RouteDot, stateDetail } from "@/components/safety-net/badges";
import { ChatThread, type ThreadMessage } from "@/components/safety-net/chat-thread";
import { DecisionCard, RimbunReadCard, type DecisionView } from "@/components/safety-net/decision-panel";
import { FollowupActions } from "@/components/safety-net/followup-controls";
import { requirePageAccess } from "@/lib/auth";
import { getTest, TEST_CATALOGUE, TEST_CATEGORY_LABELS } from "@/lib/care-loop/catalogue";
import { formatClinicDate, formatClinicDateTime } from "@/lib/care-loop/format";
import { LANGUAGE_LABELS } from "@/lib/care-loop/messages";
import { getRequestOrigin } from "@/lib/care-loop/server";
import { answerRows, causeRows } from "@/lib/safety-net/present";
import { CAUSE_LEVEL_LABELS, getProtocol, PROTOCOL_STATUS } from "@/lib/safety-net/protocols";
import { isSimulatorEnabled } from "@/lib/safety-net/transport";
import { CLOSURE_REASON_LABELS, CONFIDENCE_ID, isHighRisk, OPENER_ID } from "@/lib/safety-net/workflow";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Relation<T> = T | T[] | null;
function first<T>(value: Relation<T> | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

const DECISION_LABELS: Record<string, string> = {
  book_review: "Book physical review",
  order_test: "Order test",
  message_patient: "Message patient",
  close_minor: "Close as minor illness",
  approve_closure: "Approve closure",
  keep_open: "Keep open",
};

const EVENT_LABELS: Record<string, string> = {
  scheduled: "Follow-up set up at the visit",
  checkin_sent: "Check-in sent",
  answered: "Patient answered",
  red_flag: "Red flag reported: doctor alerted",
  completed: "Questions completed",
  closed: "Closed",
  no_reply: "No reply: nurse to call",
  incomplete: "Stopped part-way: nurse to call",
  patient_message: "Patient sent a message",
  reopened: "Reopened",
  call_logged: "Call logged",
  unreachable: "Three unanswered calls: doctor to decide",
  escalated_by_staff: "Escalated to a doctor",
  unsure_next_step: "Patient unsure of the next step",
  ai_read: "Claude read the answers",
  decision: "Decision",
  demo_fast_forward: "Prototype: clock moved forward",
};

const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

type Followup = Tables<"safety_net_followups"> & {
  patients: Relation<{ id: string; full_name: string; mrn: string }>;
  owner: Relation<{ full_name: string }>;
  closer: Relation<{ full_name: string }>;
};

type EventRow = {
  id: string;
  event_type: string;
  note: string | null;
  data: Record<string, unknown>;
  created_at: string;
  actor_label: string | null;
  actor: Relation<{ full_name: string }>;
};

export default async function FollowupPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePageAccess({ roles: ["doctor", "nurse"], module: "loop" });
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("safety_net_followups")
    .select("*, patients(id, full_name, mrn), owner:owner_staff_id(full_name), closer:closed_by(full_name)")
    .eq("id", id)
    .eq("clinic_id", staff.clinic_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const followup = data as Followup;

  const [messagesRes, eventsRes, encounterRes, casesRes] = await Promise.all([
    supabase
      .from("safety_net_messages")
      .select("id, direction, kind, body, question_id, options, created_at")
      .eq("followup_id", followup.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("safety_net_events")
      .select("id, event_type, note, data, created_at, actor_label, actor:actor_staff_id(full_name)")
      .eq("followup_id", followup.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("encounters")
      .select("encounter_date, created_at, encounter_vitals(temperature), encounter_diagnoses(icd10_code, icd10_description, sort_order)")
      .eq("id", followup.encounter_id)
      .maybeSingle(),
    supabase.from("result_cases").select("id, test_code, state").eq("followup_id", followup.id),
  ]);
  for (const res of [messagesRes, eventsRes, encounterRes, casesRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const messages = (messagesRes.data ?? []) as ThreadMessage[];
  const events = (eventsRes.data ?? []) as EventRow[];
  const patient = first(followup.patients);
  const protocol = getProtocol(followup.protocol_code);
  const answers = followup.answers ?? {};
  const now = new Date();
  const simulatorUrl =
    isSimulatorEnabled() && followup.sim_token ? `${await getRequestOrigin()}/wa-sim/${followup.sim_token}` : null;

  // Patient replies, as asked and in the order given, with an English gloss for Malay answers.
  const answerOrder = messages
    .filter((message) => message.direction === "in" && message.kind === "button_reply" && message.question_id)
    .map((message) => message.question_id!);
  const replies = protocol
    ? answerRows(protocol, answers, followup.language, answerOrder).filter((row) => row.questionId !== CONFIDENCE_ID)
    : [];
  const firstReply = messages.find((message) => message.direction === "in");
  const confidenceReply = [...messages].reverse().find((message) => message.direction === "in" && message.question_id === CONFIDENCE_ID);
  const confidence = answers[CONFIDENCE_ID];

  // How the answers narrowed it.
  const complete = Boolean(followup.completed_at);
  const tree = protocol
    ? causeRows(protocol, followup.differential ?? [], followup.question_ids, answers, complete, answerOrder)
    : [];
  const encounter = encounterRes.data as
    | {
        encounter_date: string | null;
        created_at: string;
        encounter_vitals: Relation<{ temperature: number | null }>;
        encounter_diagnoses: Array<{ icd10_code: string; icd10_description: string; sort_order: number }>;
      }
    | null;
  const temperature = first(encounter?.encounter_vitals)?.temperature ?? null;
  const diagnosis = [...(encounter?.encounter_diagnoses ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0] ?? null;
  const visitDate = encounter ? formatClinicDate(encounter.encounter_date ?? encounter.created_at) : null;

  // Rimbun's read: Claude's, or the routing rule's when every answer was green.
  const aiRead = followup.ai_read as { summary: string; suggested: string; model: string; generatedAt: string; answersCount: number } | null;
  const answeredCount = Object.keys(answers).filter((key) => key !== OPENER_ID).length;
  const read = aiRead
    ? {
        summary: aiRead.summary,
        suggested: aiRead.suggested,
        model: aiRead.model,
        at: formatClinicDateTime(aiRead.generatedAt),
        stale: answeredCount > aiRead.answersCount,
      }
    : null;
  const ruleRead =
    followup.state === "ready_to_close"
      ? { summary: "Every answer was in the expected range and no warning signs were reported.", suggested: "close as minor illness." }
      : null;

  // The decision card.
  const decisionEvents = events.filter((event) => event.event_type === "decision");
  const lastDecision = decisionEvents[0];
  const actorName = (event: EventRow) => first(event.actor)?.full_name ?? event.actor_label ?? "System";
  const lastInbound = [...messages].reverse().find((message) => message.direction === "in");
  const messageWindowOpen = !!lastInbound && now.getTime() - new Date(lastInbound.created_at).getTime() < 24 * 60 * 60 * 1000;
  const decision: DecisionView = {
    id: followup.id,
    state: followup.state,
    route: followup.route,
    closed:
      followup.state === "closed" && followup.closed_at
        ? {
            label: followup.closure_reason ? CLOSURE_REASON_LABELS[followup.closure_reason] : "Closed",
            note: followup.closure_note,
            by: first(followup.closer)?.full_name ?? null,
            at: formatClinicDateTime(followup.closed_at),
          }
        : null,
    reviewAt: followup.review_at ? formatClinicDateTime(followup.review_at) : null,
    orderedTest: followup.ordered_test_code ? getTest(followup.ordered_test_code)?.label ?? followup.ordered_test_code : null,
    lastDecision: lastDecision
      ? {
          label: `Decision: ${DECISION_LABELS[String(lastDecision.data?.decision)] ?? "recorded"}`,
          by: actorName(lastDecision),
          at: formatClinicDateTime(lastDecision.created_at),
        }
      : null,
  };
  const tests = TEST_CATALOGUE.filter((test) => test.category !== "cancer").map((test) => ({
    code: test.code,
    label: test.label,
    group: TEST_CATEGORY_LABELS[test.category],
  }));

  const suggestion = followup.ai_suggestion as
    | { model: string; recommend: boolean; protocolCode: string | null; checkInHours: number; signs: string[]; reason: string }
    | null;
  const riskPosition = isHighRisk(followup) ? 90 : followup.route === "amber" ? 52 : followup.route === "green" ? 12 : null;
  const linkedCases = (casesRes.data ?? []) as Array<{ id: string; test_code: string; state: string }>;

  return (
    <div className="space-y-4">
      <Link href="/followups" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Follow-ups
      </Link>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{patient?.full_name ?? "Patient"}</h1>
            <RiskBadge route={followup.route} state={followup.state} />
            <FollowupStateBadge state={followup.state} />
          </div>
          <p className="text-sm text-muted-foreground">
            Safety-net check-in · {protocol?.label ?? followup.protocol_code}
            {patient ? ` · MRN ${patient.mrn}` : ""} · Owner {first(followup.owner)?.full_name ?? "–"} ·{" "}
            {LANGUAGE_LABELS[followup.language]}
          </p>
          {stateDetail(followup.state, followup.call_reason) ? (
            <p className="text-xs text-muted-foreground">{stateDetail(followup.state, followup.call_reason)}</p>
          ) : null}
        </div>
        <FollowupDue state={followup.state} dueAt={followup.current_step_due_at} now={now} />
      </div>

      <PrototypeNotice />

      {linkedCases.length ? (
        <p className="rounded-md border px-3 py-2 text-sm">
          Continued in Care Loop:{" "}
          {linkedCases.map((item, index) => (
            <span key={item.id}>
              {index > 0 ? ", " : ""}
              <Link href={`/cases/${item.id}`} className="font-medium underline underline-offset-2">
                {getTest(item.test_code)?.label ?? item.test_code}
              </Link>
            </span>
          ))}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Patient replies{firstReply ? ` · WhatsApp, ${formatClinicDateTime(firstReply.created_at)}` : ""}
              </CardTitle>
              {replies.length === 0 ? <CardDescription>No answers yet.</CardDescription> : null}
            </CardHeader>
            {replies.length ? (
              <CardContent>
                <ul className="divide-y text-sm">
                  {replies.map((row) => (
                    <li key={row.questionId} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{row.asked}</p>
                        <p className="font-medium">{row.answer}</p>
                        {row.gloss ? (
                          <p className="text-xs text-muted-foreground">
                            {row.gloss.asked} <span className="font-medium text-foreground/80">{row.gloss.answer}</span>
                          </p>
                        ) : null}
                      </div>
                      {row.route ? <RouteDot route={row.route} /> : null}
                    </li>
                  ))}
                </ul>
                {confidence ? (
                  <p className={cn("mt-2 border-t pt-2 text-xs", confidence === "yes" ? "text-muted-foreground" : "font-medium text-amber-700 dark:text-amber-300")}>
                    {confidence === "yes" ? "Understood next step" : "Unsure of the next step: nurse to call"}
                    {confidenceReply ? ` · confirmed ${formatClinicDateTime(confidenceReply.created_at)}` : ""}
                  </p>
                ) : null}
              </CardContent>
            ) : null}
          </Card>

          <RimbunReadCard followupId={followup.id} read={read} ruleRead={ruleRead} hasAnswers={answeredCount > 0} />

          {tree.length || riskPosition !== null ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">How the answers narrowed it</CardTitle>
                <CardDescription>
                  Red-flag questions come first; then the question that best separates the open causes. The route stays the
                  safety decision.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 2xl:grid-cols-[200px_minmax(0,1fr)] 2xl:items-center">
                  <div className="rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Recorded at the visit</p>
                    <p className="text-lg font-semibold text-amber-800 dark:text-amber-300">
                      {temperature !== null
                        ? `Temperature ${temperature} °C`
                        : diagnosis
                          ? `${diagnosis.icd10_description} (${diagnosis.icd10_code})`
                          : protocol?.label ?? "Visit"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {temperature !== null && diagnosis ? `${diagnosis.icd10_description} · ` : ""}
                      {visitDate ?? ""}
                      {temperature === null && !diagnosis ? " · no vitals or diagnosis recorded" : ""}
                    </p>
                  </div>
                  {tree.length ? (
                    <ul className="space-y-1.5">
                      {tree.map((row) => (
                        <li
                          key={row.cause}
                          className={cn(
                            "rounded-lg border px-3 py-2",
                            row.level === "raised" && "border-amber-400 ring-1 ring-amber-300",
                            row.level === "ruled_out" && "opacity-60"
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">{row.label}</span>
                            <span className="flex items-center gap-2">
                              <CauseLevelBadge level={row.level} />
                              <span className="text-xs text-muted-foreground">
                                {row.tested
                                  ? row.level === row.initial
                                    ? "Unchanged"
                                    : `was ${CAUSE_LEVEL_LABELS[row.initial].toLowerCase()}${row.tested.order ? ` · asked ${ORDINALS[row.tested.order] ?? row.tested.order}` : ""}`
                                  : row.untested === "skipped"
                                    ? "Skipped"
                                    : "Not asked yet"}
                              </span>
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {row.tested ? (
                              <>
                                {row.tested.question} <span className="font-medium text-foreground">{row.tested.answer}</span>
                              </>
                            ) : row.untested === "skipped" ? (
                              "Not asked: it wouldn't change the plan."
                            ) : (
                              "The question that tests this hasn't been reached."
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No possible causes were chosen; the full question set is asked.</p>
                  )}
                </div>
                {riskPosition !== null ? (
                  <div className="max-w-sm rounded-lg border px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Follow-up risk (route)</p>
                    <p
                      className={cn(
                        "text-xl font-bold",
                        riskPosition > 80 ? "text-red-600" : riskPosition > 30 ? "text-amber-600" : "text-emerald-600"
                      )}
                    >
                      {riskPosition > 80 ? "High · red" : riskPosition > 30 ? "Medium · amber" : "Low · green"}
                    </p>
                    <div className="relative mt-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500">
                      <span
                        className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-background"
                        style={{ left: `${riskPosition}%` }}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>Low · green</span>
                      <span>High · red</span>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">WhatsApp conversation</CardTitle>
              <CardDescription>
                {followup.sent_at
                  ? `Check-in sent ${formatClinicDateTime(followup.sent_at)}`
                  : `Check-in due ${formatClinicDateTime(followup.checkin_due_at)}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChatThread messages={messages} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <DecisionCard followup={decision} role={staff.role} tests={tests} messageWindowOpen={messageWindowOpen} />

          <FollowupActions
            followup={{ id: followup.id, state: followup.state, route: followup.route, call_attempts: followup.call_attempts }}
            role={staff.role}
            simulatorUrl={simulatorUrl}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Set up at the visit</CardTitle>
              <CardDescription>
                {first(followup.owner)?.full_name ?? "Doctor"} · {formatClinicDate(followup.created_at)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Question set: </span>
                {protocol?.label ?? followup.protocol_code} (v{followup.protocol_version})
              </p>
              <p className="text-xs text-muted-foreground">{PROTOCOL_STATUS}</p>
              {followup.differential?.length ? (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-muted-foreground">Possible causes:</span>
                  {followup.differential.map((entry) => (
                    <span key={entry.cause} className="rounded-full border px-2 py-0.5 text-xs">
                      {protocol?.causes.find((cause) => cause.id === entry.cause)?.label ?? entry.cause} ·{" "}
                      {CAUSE_LEVEL_LABELS[entry.initial].toLowerCase()}
                    </span>
                  ))}
                </div>
              ) : null}
              <p>
                <span className="text-muted-foreground">Warning signs: </span>
                {followup.signs.length
                  ? followup.signs.map((sign) => protocol?.signs.find((item) => item.id === sign)?.label ?? sign).join(", ")
                  : "core questions only"}
              </p>
              {followup.doctor_note ? (
                <p>
                  <span className="text-muted-foreground">Note: </span>
                  {followup.doctor_note}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Sparkles className="h-4 w-4" />
                Claude&apos;s suggestion at the visit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {suggestion ? (
                <>
                  <p>
                    {suggestion.recommend && suggestion.protocolCode
                      ? `${getProtocol(suggestion.protocolCode)?.label ?? suggestion.protocolCode}, check in after ${suggestion.checkInHours} h`
                      : "No follow-up suggested"}
                  </p>
                  <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                  <p className="text-[11px] text-muted-foreground">Model: {suggestion.model}</p>
                </>
              ) : (
                <p className="text-muted-foreground">Not used. The doctor chose the follow-up directly.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-xs">
                {events.map((event) => (
                  <li key={event.id} className="border-l-2 pl-2">
                    <p className="font-medium">
                      {event.event_type === "decision"
                        ? `Decision: ${DECISION_LABELS[String(event.data?.decision)] ?? "recorded"}`
                        : EVENT_LABELS[event.event_type] ?? event.event_type}
                    </p>
                    <p className="text-muted-foreground">
                      {formatClinicDateTime(event.created_at)} · {actorName(event)}
                    </p>
                    {event.note ? <p className="mt-0.5">{event.note}</p> : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
