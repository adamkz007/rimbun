import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ClerkingWorkspace } from "@/components/clerking/clerking-workspace";
import { requirePageAccess } from "@/lib/auth";

export default async function ClerkingPage({ params }: { params: Promise<{ encounterId: string }> }) {
  const { encounterId } = await params;
  await requirePageAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });
  const supabase = await getSupabaseServerClient();

  const { data: encounter } = await supabase
    .from("encounters")
    .select(`
      *,
      patients(id, full_name, mrn, date_of_birth, gender, allergies, phone),
      encounter_vitals(*),
      encounter_notes(*),
      encounter_diagnoses(*),
      encounter_prescriptions(*),
      encounter_scratchpads(*)
    `)
    .eq("id", encounterId)
    .single();

  if (!encounter) notFound();

  return <ClerkingWorkspace encounter={encounter} />;
}
