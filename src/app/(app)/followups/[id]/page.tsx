import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatThread, type ThreadMessage } from "@/components/safety-net/chat-thread";
import { FollowupDue, FollowupStateBadge, PrototypeNotice, RouteBadge, RouteDot } from "@/components/safety-net/badges";
import { FollowupActions } from "@/components/safety-net/followup-controls";
import { requirePageAccess } from "@/lib/auth";
import { formatClinicDate, formatClinicDateTime } from "@/lib/care-loop/format";
import { LANGUAGE_LABELS } from "@/lib/care-loop/messages";
import { getRequestOrigin } from "@/lib/care-loop/server";
import { getProtocol, getQuestion, OPENER_LABELS, PROTOCOL_STATUS, type OpenerValue } from "@/lib/safety-net/protocols";
import { isSimulatorEnabled } from "@/lib/safety-net/transport";
import { CLOSURE_REASON_LABELS, OPENER_ID } from "@/lib/safety-net/workflow";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type Relation<T> = T | T[] | null;
function first<T>(value: Relation<T> | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

const EVENT_LABELS: Record<string, string> = {
  scheduled: "Follow-up set up",
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
  escalated_by_staff: "Escalated to a doctor",
  demo_fast_forward: "Prototype: clock moved forward",
};

type Followup = Tables<"safety_net_followups"> & {
  patients: Relation<{ id: string; full_name: string; mrn: string; phone: string | null; date_of_birth: string | null }>;
  owner: Relation<{ full_name: string }>;
  closer: Relation<{ full_name: string }>;
};

export default async function FollowupPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePageAccess({ roles: ["doctor", "nurse"], module: "loop" });
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("safety_net_followups")
    .select(
      "*, patients(id, full_name, mrn, phone, date_of_birth), owner:owner_staff_id(full_name), closer:closed_by(full_name)"
    )
    .eq("id", id)
    .eq("clinic_id", staff.clinic_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const followup = data as Followup;

  const [messagesRes, eventsRes] = await Promise.all([
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
  ]);
  if (messagesRes.error) throw new Error(messagesRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const patient = first(followup.patients);
  const protocol = getProtocol(followup.protocol_code);
  const simulatorUrl =
    isSimulatorEnabled() && followup.sim_token ? `${await getRequestOrigin()}/wa-sim/${followup.sim_token}` : null;
  const suggestion = followup.ai_suggestion as
    | { model: string; recommend: boolean; protocolCode: string | null; checkInHours: number; signs: string[]; reason: string }
    | null;

  const answerRows = [OPENER_ID, ...followup.question_ids].map((questionId) => {
    const value = followup.answers?.[questionId];
    if (questionId === OPENER_ID) {
      return {
        id: questionId,
        question: "How are you since the visit?",
        answer: value ? OPENER_LABELS[value as OpenerValue]?.en ?? value : null,
        route: value && protocol ? protocol.openerRoutes[value as OpenerValue] : null,
      };
    }
    const question = protocol ? getQuestion(protocol, questionId) : null;
    const option = question?.options.find((item) => item.value === value);
    return { id: questionId, question: question?.text.en ?? questionId, answer: option?.label.en ?? null, route: option?.route ?? null };
  });

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
            <FollowupStateBadge state={followup.state} callReason={followup.call_reason} />
            <RouteBadge route={followup.route} />
          </div>
          <p className="text-sm text-muted-foreground">
            {protocol?.label ?? followup.protocol_code}
            {patient ? ` · MRN ${patient.mrn}` : ""} · {LANGUAGE_LABELS[followup.language]}
          </p>
        </div>
        <FollowupDue state={followup.state} dueAt={followup.current_step_due_at} />
      </div>

      <PrototypeNotice />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Answers</CardTitle>
              <CardDescription>The worst answer decides the route.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {answerRows.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 py-2">
                    <span className="text-muted-foreground">{row.question}</span>
                    <span className="flex shrink-0 items-center gap-2 font-medium">
                      {row.route ? <RouteDot route={row.route} /> : null}
                      {row.answer ?? <span className="font-normal text-muted-foreground">–</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">WhatsApp conversation</CardTitle>
              <CardDescription>
                {followup.sent_at ? `Check-in sent ${formatClinicDateTime(followup.sent_at)}` : `Check-in due ${formatClinicDateTime(followup.checkin_due_at)}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChatThread messages={(messagesRes.data ?? []) as ThreadMessage[]} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <FollowupActions
            followup={{ id: followup.id, state: followup.state, route: followup.route, call_attempts: followup.call_attempts }}
            role={staff.role}
            simulatorUrl={simulatorUrl}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Set up by the doctor</CardTitle>
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
              <p>
                <span className="text-muted-foreground">Watching for: </span>
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
              {followup.state === "closed" ? (
                <p>
                  <span className="text-muted-foreground">Closed: </span>
                  {followup.closure_reason ? CLOSURE_REASON_LABELS[followup.closure_reason] : "Closed"}
                  {first(followup.closer)?.full_name ? ` by ${first(followup.closer)!.full_name}` : " automatically"}
                  {followup.closure_note ? `. ${followup.closure_note}` : ""}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Sparkles className="h-4 w-4" />
                Claude&apos;s suggestion
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
                  {suggestion.signs.length ? (
                    <p className="text-xs text-muted-foreground">
                      Signs: {suggestion.signs.map((sign) => protocol?.signs.find((item) => item.id === sign)?.label ?? sign).join(", ")}
                    </p>
                  ) : null}
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
                {(eventsRes.data ?? []).map((event) => {
                  const actor = first(event.actor as Relation<{ full_name: string }>)?.full_name ?? event.actor_label ?? "System";
                  return (
                    <li key={event.id} className="border-l-2 pl-2">
                      <p className="font-medium">{EVENT_LABELS[event.event_type] ?? event.event_type}</p>
                      <p className="text-muted-foreground">
                        {formatClinicDateTime(event.created_at)} · {actor}
                      </p>
                      {event.note ? <p className="mt-0.5">{event.note}</p> : null}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
