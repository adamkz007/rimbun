import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ResultEntryForm } from "@/components/care-loop/result-entry-form";
import { Button } from "@/components/ui/button";
import { requirePageAccess } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewResultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await requirePageAccess({ module: "loop" });
  const params = await searchParams;
  const patientId = Array.isArray(params.patient) ? params.patient[0] : params.patient;
  let initialPatient: { id: string; full_name: string; mrn: string } | null = null;

  if (patientId) {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase
      .from("patients")
      .select("id, full_name, mrn")
      .eq("id", patientId)
      .eq("clinic_id", staff.clinic_id)
      .maybeSingle();
    initialPatient = data;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/cases">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Log a result</h1>
      </div>
      <ResultEntryForm initialPatient={initialPatient} />
    </div>
  );
}
