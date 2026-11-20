import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ClerkingWorkspace } from "@/components/clerking/clerking-workspace";
import { requirePageAccess } from "@/lib/auth";
import { getTest } from "@/lib/care-loop/catalogue";
import { NEXT_ACTION_LABELS, type CaseState } from "@/lib/care-loop/workflow";
import { isModuleEnabled } from "@/lib/modules";
import Link from "next/link";

export default async function ClerkingPage({ params }: { params: Promise<{ encounterId: string }> }) {
  const { encounterId } = await params;
  const staff = await requirePageAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });
  const supabase = await getSupabaseServerClient();

  const { data: encounter } = await supabase
    .from("encounters")
    .select(`
      *,
      patients(id, full_name, mrn, date_of_birth, gender, allergies, phone, preferred_language, messaging_consent_at),
      doctor:doctor_id(id, full_name),
      completed_by_staff:completed_by(full_name),
      amendment_started_by_staff:amendment_started_by(full_name),
      last_amended_by_staff:last_amended_by(full_name),
      encounter_vitals(*),
      encounter_notes(*),
      encounter_diagnoses(*),
      encounter_prescriptions(*),
      encounter_scratchpads(*)
    `)
    .eq("id", encounterId)
    .single();

  if (!encounter) notFound();

  const { data: historyEncounters } = await supabase
    .from("encounters")
    .select(`
      id,
      status,
      created_at,
      encounter_date,
      staff:doctor_id(full_name),
      encounter_diagnoses(id, icd10_code, icd10_description, diagnosis_type),
      encounter_prescriptions(id, drug_name, dosage, frequency, duration, route)
    `)
    .eq("patient_id", encounter.patient_id)
    .neq("id", encounterId)
    .order("encounter_date", { ascending: false });

  const loopEnabled = isModuleEnabled(staff.clinics?.settings, "loop");
  const { data: openFollowUps } = loopEnabled
    ? await supabase
        .from("result_cases")
        .select("id, state, test_code")
        .eq("patient_id", encounter.patient_id)
        .neq("state", "closed")
        .order("opened_at", { ascending: false })
    : { data: [] };

  const { data: safetyNetRow } = loopEnabled
    ? await supabase
        .from("safety_net_followups")
        .select("id, state, protocol_code, checkin_due_at")
        .eq("encounter_id", encounterId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const workspace = (
    <ClerkingWorkspace
      encounter={encounter}
      historyEncounters={historyEncounters ?? []}
      currentStaff={{
        id: staff.id,
        fullName: staff.full_name,
        role: staff.role,
      }}
      safetyNet={
        loopEnabled
          ? {
              patient: {
                phone: encounter.patients?.phone ?? null,
                preferredLanguage: encounter.patients?.preferred_language === "ms" ? "ms" : "en",
                hasConsent: Boolean(encounter.patients?.messaging_consent_at),
              },
              current: safetyNetRow
                ? {
                    id: safetyNetRow.id,
                    state: safetyNetRow.state,
                    protocolCode: safetyNetRow.protocol_code,
                    checkinDueAt: safetyNetRow.checkin_due_at,
                  }
                : null,
            }
          : null
      }
    />
  );

  if (!openFollowUps?.length) return workspace;

  // Surface open result follow-ups so they are handled during this consult.
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <span className="font-medium">Open result follow-up{openFollowUps.length === 1 ? "" : "s"}:</span>
        {(openFollowUps as Array<{ id: string; state: CaseState; test_code: string }>).map((followUp) => (
          <Link key={followUp.id} href={`/cases/${followUp.id}`} className="underline underline-offset-2">
            {getTest(followUp.test_code)?.label ?? followUp.test_code} ({NEXT_ACTION_LABELS[followUp.state].toLowerCase()})
          </Link>
        ))}
      </div>
      {workspace}
    </div>
  );
}
