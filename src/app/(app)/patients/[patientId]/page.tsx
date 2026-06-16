import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, ClipboardPen } from "lucide-react";
import Link from "next/link";
import { format, differenceInYears } from "date-fns";
import { requirePageAccess } from "@/lib/auth";
import type { Tables } from "@/types/database";
import { PatientProfileEditor } from "@/components/patients/patient-profile-editor";
import { parseMedicalHistory } from "@/lib/patients";

type PatientEncounter = Pick<Tables<"encounters">, "id" | "status" | "created_at"> & {
  staff: Array<Pick<Tables<"staff">, "full_name">> | null;
};

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  await requirePageAccess({
    roles: ["admin", "doctor", "nurse", "receptionist"],
  });
  const supabase = await getSupabaseServerClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .single();

  if (!patient) notFound();

  const medicalHistory = parseMedicalHistory(patient.medical_history);
  const [{ data: encounters }, { data: mergeCandidates }, mergedIntoResult] = await Promise.all([
    supabase
      .from("encounters")
      .select("id, status, created_at, staff:doctor_id(full_name)")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("patients")
      .select("id, full_name, mrn")
      .neq("id", patientId)
      .is("archived_at", null)
      .order("full_name")
      .limit(50),
    patient.merged_into_patient_id
      ? supabase
          .from("patients")
          .select("id, full_name, mrn")
          .eq("id", patient.merged_into_patient_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const mergedIntoPatient = mergedIntoResult.data;

  const age = patient.date_of_birth
    ? differenceInYears(new Date(), new Date(patient.date_of_birth))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/patients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{patient.full_name}</h1>
      </div>

      {patient.archived_at ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <div>
              <p className="font-medium">
                {patient.merged_into_patient_id ? "Merged patient record" : "Archived patient record"}
              </p>
              <p className="text-muted-foreground">
                Archived on {format(new Date(patient.archived_at), "dd MMM yyyy, h:mm a")}
                {patient.archived_reason ? ` • ${patient.archived_reason}` : ""}
              </p>
            </div>
            {mergedIntoPatient ? (
              <Link href={`/patients/${mergedIntoPatient.id}`}>
                <Button variant="outline">
                  Open {mergedIntoPatient.full_name} ({mergedIntoPatient.mrn})
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <PatientProfileEditor patient={patient} mergeCandidates={mergeCandidates ?? []} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Patient Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Detail label="MRN" value={patient.mrn} />
            <Detail label="IC Number" value={patient.ic_number} />
            <Detail label="Gender" value={patient.gender} />
            <Detail label="Age" value={age !== null ? `${age} years` : null} />
            <Detail
              label="Date of Birth"
              value={
                patient.date_of_birth
                  ? format(new Date(patient.date_of_birth), "dd MMM yyyy")
                  : null
              }
            />
            <Detail label="Phone" value={patient.phone} />
            <Detail label="Email" value={patient.email} />
            <Detail label="Address" value={patient.address} />
            <Detail
              label="Emergency Contact"
              value={
                patient.emergency_contact_name
                  ? `${patient.emergency_contact_name}${
                      patient.emergency_contact_phone
                        ? ` (${patient.emergency_contact_phone})`
                        : ""
                    }`
                  : patient.emergency_contact_phone
              }
            />
            {patient.allergies?.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Allergies</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  {patient.allergies.map((a: string) => (
                    <Badge key={a} variant="destructive" className="text-xs">
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Medical History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ListDetail
              label="Conditions"
              values={medicalHistory.conditions}
              empty="No conditions recorded."
            />
            <ListDetail
              label="Current Medications"
              values={medicalHistory.currentMedications}
              empty="No medications recorded."
            />
            <Detail label="Surgical History" value={medicalHistory.surgicalHistory} />
            <Detail label="Family History" value={medicalHistory.familyHistory} />
            <Detail label="Social History" value={medicalHistory.socialHistory} />
            <Detail label="Notes" value={medicalHistory.notes} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Past Encounters</CardTitle>
            <span className="text-xs text-muted-foreground">
              {encounters?.length ?? 0} total
            </span>
          </CardHeader>
          <CardContent>
            {!encounters?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No encounters recorded.
              </p>
            ) : (
              <div className="space-y-2">
                {(encounters as PatientEncounter[]).map((enc) => (
                  <Link key={enc.id} href={`/clerking/${enc.id}`}>
                    <div className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <ClipboardPen className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {format(new Date(enc.created_at), "dd MMM yyyy, h:mm a")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Dr. {enc.staff?.[0]?.full_name ?? "Unknown"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={enc.status === "in_progress" ? "default" : "secondary"}
                      >
                        {formatEncounterStatus(enc.status)}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function ListDetail({
  label,
  values,
  empty,
}: {
  label: string;
  values: string[];
  empty: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      {values.length ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {values.map((value) => (
            <Badge key={value} variant="secondary">
              {value}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function formatEncounterStatus(status: PatientEncounter["status"]) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
