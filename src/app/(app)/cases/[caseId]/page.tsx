import { notFound } from "next/navigation";
import { clinicToday } from "@/lib/care-loop/format";
import { CaseWorkspace, type CaseWorkspaceData } from "@/components/care-loop/case-workspace";
import { requirePageAccess } from "@/lib/auth";
import { formatResultValue, getTest, URGENCY_LABELS, type Urgency } from "@/lib/care-loop/catalogue";
import { buildReferralLetter } from "@/lib/care-loop/referral-letter";
import { parseMedicalHistory } from "@/lib/patients";
import { getProtocol } from "@/lib/safety-net/protocols";
import { CLOSURE_REASON_LABELS as FOLLOWUP_CLOSURE_LABELS, summarizeAnswers } from "@/lib/safety-net/workflow";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

function first<T>(value: Relation<T> | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const staff = await requirePageAccess({ module: "loop" });
  const supabase = await getSupabaseServerClient();

  const { data: item } = await supabase
    .from("result_cases")
    .select(
      "*, patient:patient_id(id, full_name, mrn, ic_number, date_of_birth, gender, phone, allergies, medical_history, preferred_language, messaging_consent_at), result:result_id(*), owner:owner_staff_id(id, full_name, role)"
    )
    .eq("id", caseId)
    .eq("clinic_id", staff.clinic_id)
    .maybeSingle();

  if (!item) notFound();

  const patient = first(item.patient)!;
  const result = first(item.result)!;

  const [eventsRes, messagesRes, referralsRes, staffRes, clinicRes, encounterRes] = await Promise.all([
    supabase
      .from("case_events")
      .select("id, event_type, from_state, to_state, actor_label, note, data, created_at, actor:actor_staff_id(full_name)")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true }),
    supabase
      .from("patient_messages")
      .select("id, channel, kind, language, sent_at, opened_at, verified_at, responded_at, response, understanding_correct, call_outcome, note")
      .eq("case_id", caseId)
      .order("sent_at", { ascending: false }),
    supabase
      .from("referrals")
      .select("id, receiving_facility, receiving_clinician, specialty, status, created_at, viewed_at, responded_at, reject_reason, appointment_on, outcome_note, attended_on, expires_at")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
    supabase
      .from("staff")
      .select("id, full_name, role")
      .eq("clinic_id", staff.clinic_id)
      .eq("is_active", true)
      .order("full_name"),
    supabase.from("clinics").select("name, address, phone").eq("id", staff.clinic_id).single(),
    supabase
      .from("encounters")
      .select(
        "id, encounter_date, encounter_diagnoses(icd10_code, icd10_description), encounter_prescriptions(drug_name, dosage, frequency), encounter_vitals(blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, weight)"
      )
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const followup = item.followup_id ? await loadFollowupJourney(supabase, item.followup_id) : null;

  const test = getTest(item.test_code);
  const resultValue = formatResultValue(item.test_code, { numeric: result.value_numeric, text: result.value_text });
  const encounter = encounterRes.data;
  const vitals = encounter?.encounter_vitals?.[0] ?? null;
  const history = parseMedicalHistory(patient.medical_history);
  const today = clinicToday();

  const referralDraft = buildReferralLetter({
    clinic: clinicRes.data ?? { name: staff.clinics?.name ?? "Clinic", address: null, phone: null },
    doctor: { full_name: staff.full_name, mmc_number: staff.mmc_number },
    patient: {
      full_name: patient.full_name,
      ic_number: patient.ic_number,
      mrn: patient.mrn,
      date_of_birth: patient.date_of_birth,
      gender: patient.gender,
      phone: patient.phone,
      allergies: patient.allergies ?? [],
    },
    receiving: { facility: "[Receiving facility]", clinician: null, specialty: test?.referralSpecialty ?? null },
    result: {
      testLabel: test?.label ?? item.test_code,
      value: resultValue,
      collectedOn: result.collected_on,
      source: result.source,
    },
    urgencyLabel: URGENCY_LABELS[item.urgency as Urgency],
    reason: item.next_step_note ?? "",
    diagnoses: (encounter?.encounter_diagnoses ?? []).map(
      (diagnosis: { icd10_code: string; icd10_description: string }) =>
        `${diagnosis.icd10_description} (${diagnosis.icd10_code})`
    ),
    medications: [
      ...(encounter?.encounter_prescriptions ?? []).map(
        (rx: { drug_name: string; dosage: string; frequency: string }) => `${rx.drug_name} ${rx.dosage} ${rx.frequency}`
      ),
      ...history.currentMedications,
    ],
    conditions: history.conditions,
    vitals: vitals
      ? [
          vitals.blood_pressure_systolic ? `BP ${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic} mmHg` : null,
          vitals.heart_rate ? `HR ${vitals.heart_rate} bpm` : null,
          vitals.temperature ? `Temp ${vitals.temperature} °C` : null,
          vitals.weight ? `Weight ${vitals.weight} kg` : null,
        ]
          .filter(Boolean)
          .join(", ") || null
      : null,
    today,
  });

  const data: CaseWorkspaceData = {
    item: {
      id: item.id,
      state: item.state,
      urgency: item.urgency,
      next_step: item.next_step,
      next_step_note: item.next_step_note,
      owner_staff_id: item.owner_staff_id,
      current_step_due_at: item.current_step_due_at,
      opened_at: item.opened_at,
      notified_at: item.notified_at,
      appointment_at: item.appointment_at,
      surveillance_due_on: item.surveillance_due_on,
      contact_attempts: item.contact_attempts,
      reminders_sent: item.reminders_sent,
      understanding_correct: item.understanding_correct,
      referral_rejected_at: item.referral_rejected_at,
      closure_reason: item.closure_reason,
      closure_note: item.closure_note,
      closed_at: item.closed_at,
      test_code: item.test_code,
    },
    patient: {
      id: patient.id,
      full_name: patient.full_name,
      mrn: patient.mrn,
      phone: patient.phone,
      has_identity_check: !!patient.date_of_birth || !!patient.ic_number,
      preferred_language: patient.preferred_language ?? "en",
      messaging_consent_at: patient.messaging_consent_at,
    },
    result: {
      value: resultValue,
      collected_on: result.collected_on,
      reported_at: result.reported_at,
      source: result.source,
      notes: result.notes,
      suggested_urgency: result.suggested_urgency,
    },
    owner: first(item.owner),
    events: (eventsRes.data ?? []).map((event) => ({
      ...event,
      actor_name: first(event.actor as Relation<{ full_name: string }>)?.full_name ?? event.actor_label ?? "System",
    })),
    messages: messagesRes.data ?? [],
    referrals: referralsRes.data ?? [],
    staff: staffRes.data ?? [],
    referralDraft,
    referralSpecialty: test?.referralSpecialty ?? "",
    followup,
  };

  return <CaseWorkspace data={data} staffRole={staff.role} />;
}

const FOLLOWUP_DECISIONS: Record<string, string> = {
  book_review: "Physical review booked",
  order_test: "Test ordered",
  message_patient: "Doctor messaged the patient",
  close_minor: "Closed as minor illness",
  approve_closure: "Closure approved",
  keep_open: "Kept open",
};

/** The safety-net follow-up that led to this case, as the start of its journey (spec section 7). */
async function loadFollowupJourney(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  followupId: string
): Promise<CaseWorkspaceData["followup"]> {
  const [followupRes, eventsRes] = await Promise.all([
    supabase
      .from("safety_net_followups")
      .select("id, protocol_code, created_at, sent_at, closed_at, closure_reason, answers")
      .eq("id", followupId)
      .maybeSingle(),
    supabase
      .from("safety_net_events")
      .select("id, event_type, note, data, created_at, actor_label, actor:actor_staff_id(full_name)")
      .eq("followup_id", followupId)
      .in("event_type", ["scheduled", "checkin_sent", "completed", "red_flag", "escalated_by_staff", "unreachable", "decision", "closed"])
      .order("created_at", { ascending: true }),
  ]);
  const followup = followupRes.data;
  if (!followup) return null;
  const protocol = getProtocol(followup.protocol_code);
  const summary = protocol ? summarizeAnswers(protocol, (followup.answers ?? {}) as Record<string, string>) : null;

  const events = (eventsRes.data ?? []).map((event) => {
    const data = (event.data ?? {}) as Record<string, unknown>;
    const label =
      event.event_type === "scheduled"
        ? "Visit: safety-net follow-up set"
        : event.event_type === "checkin_sent"
          ? "WhatsApp check-in sent"
          : event.event_type === "completed"
            ? `Patient answered${summary ? `: ${summary}` : ""}`
            : event.event_type === "red_flag"
              ? "Red flag reported: doctor alerted"
              : event.event_type === "escalated_by_staff" || event.event_type === "unreachable"
                ? "Escalated to a doctor"
                : event.event_type === "decision"
                  ? FOLLOWUP_DECISIONS[String(data.decision)] ?? "Doctor decision"
                  : FOLLOWUP_CLOSURE_LABELS[String(data.reason) as keyof typeof FOLLOWUP_CLOSURE_LABELS] ?? "Follow-up closed";
    return {
      id: event.id,
      label,
      at: event.created_at,
      actor: first(event.actor as Relation<{ full_name: string }>)?.full_name ?? event.actor_label ?? "System",
      note: event.note,
    };
  });
  const decisionAt =
    (eventsRes.data ?? []).find((event) => event.event_type === "decision" || event.event_type === "closed")?.created_at ??
    followup.closed_at;

  return {
    id: followup.id,
    label: protocol?.label ?? followup.protocol_code,
    steps: [
      { key: "visit", label: "Visit", at: followup.created_at },
      { key: "checkin", label: "Check-in", at: followup.sent_at },
      { key: "decision", label: "Doctor decision", at: decisionAt },
    ],
    events,
  };
}
