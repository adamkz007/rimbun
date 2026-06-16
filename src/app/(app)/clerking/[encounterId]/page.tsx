import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ClerkingWorkspace } from "@/components/clerking/clerking-workspace";
import { requirePageAccess } from "@/lib/auth";

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
      patients(id, full_name, mrn, date_of_birth, gender, allergies, phone),
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

  return (
    <ClerkingWorkspace
      encounter={encounter}
      historyEncounters={historyEncounters ?? []}
      currentStaff={{
        id: staff.id,
        fullName: staff.full_name,
        role: staff.role,
      }}
    />
  );
}
