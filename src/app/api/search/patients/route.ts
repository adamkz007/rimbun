import { NextRequest } from "next/server";
import { authorizeApiAccess } from "@/lib/auth";
import {
  buildPatientSearchFilter,
  clampPatientSearchLimit,
  isPatientSearchQueryValid,
} from "@/lib/patient-search";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const access = await authorizeApiAccess({
    roles: ["admin", "doctor", "nurse", "receptionist"],
  });

  if (access.error) {
    return access.error;
  }

  const query = request.nextUrl.searchParams.get("q");
  const limit = clampPatientSearchLimit(request.nextUrl.searchParams.get("limit"));

  if (!isPatientSearchQueryValid(query)) {
    return Response.json([]);
  }

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name, mrn")
    .or(buildPatientSearchFilter(query!))
    .is("archived_at", null)
    .limit(limit);

  if (error) {
    return Response.json([], { status: 500 });
  }

  return Response.json(data);
}
