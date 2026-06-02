import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PatientList } from "@/components/patients/patient-list";
import { requirePageAccess } from "@/lib/auth";
import { isModuleEnabled } from "@/lib/modules";
import {
  DEFAULT_PATIENT_PAGE_SIZE,
  PATIENT_ARCHIVE_STATUSES,
  PATIENT_SORT_OPTIONS,
} from "@/lib/patients";

type PatientsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PatientsPage({ searchParams }: PatientsPageProps) {
  const staff = await requirePageAccess({
    roles: ["admin", "doctor", "nurse", "receptionist"],
  });
  const supabase = await getSupabaseServerClient();
  const params = await searchParams;
  const query = getSingleValue(params.q)?.trim() ?? "";
  const gender = getSingleValue(params.gender) ?? "";
  const archiveStatus = parseArchiveStatus(getSingleValue(params.status));
  const sort = parseSort(getSingleValue(params.sort));
  const page = Math.max(1, Number(getSingleValue(params.page) ?? "1") || 1);
  const start = (page - 1) * DEFAULT_PATIENT_PAGE_SIZE;

  let patientsQuery = supabase
    .from("patients")
    .select(
      "id, full_name, mrn, date_of_birth, gender, phone, email, archived_at, merged_into_patient_id",
      { count: "exact" }
    );

  if (query) {
    const escaped = escapeLikeValue(query);
    patientsQuery = patientsQuery.or(
      `full_name.ilike.%${escaped}%,mrn.ilike.%${escaped}%,ic_number.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`
    );
  }

  if (gender === "male" || gender === "female" || gender === "other") {
    patientsQuery = patientsQuery.eq("gender", gender);
  }

  if (archiveStatus === "active") {
    patientsQuery = patientsQuery.is("archived_at", null);
  } else if (archiveStatus === "archived") {
    patientsQuery = patientsQuery.not("archived_at", "is", null);
  }

  const ordering =
    sort === "oldest"
      ? { column: "created_at", ascending: true }
      : sort === "name"
        ? { column: "full_name", ascending: true }
        : sort === "mrn"
          ? { column: "mrn", ascending: true }
          : { column: "created_at", ascending: false };

  const { data: patients, count } = await patientsQuery
    .order(ordering.column, { ascending: ordering.ascending })
    .range(start, start + DEFAULT_PATIENT_PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PATIENT_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Patients</h1>
      <PatientList
        patients={patients ?? []}
        filters={{
          query,
          gender,
          archiveStatus,
          sort,
        }}
        pagination={{
          page: Math.min(page, totalPages),
          totalPages,
          total,
        }}
        canStartEncounter={
          ["doctor", "nurse"].includes(staff.role) &&
          isModuleEnabled(staff.clinics?.settings, "clerking")
        }
      />
    </div>
  );
}

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseArchiveStatus(value: string | undefined) {
  if (value && PATIENT_ARCHIVE_STATUSES.includes(value as (typeof PATIENT_ARCHIVE_STATUSES)[number])) {
    return value as (typeof PATIENT_ARCHIVE_STATUSES)[number];
  }

  return "active";
}

function parseSort(value: string | undefined) {
  if (value && PATIENT_SORT_OPTIONS.includes(value as (typeof PATIENT_SORT_OPTIONS)[number])) {
    return value as (typeof PATIENT_SORT_OPTIONS)[number];
  }

  return "recent";
}

function escapeLikeValue(value: string) {
  return value.replace(/[%_,]/g, "");
}
