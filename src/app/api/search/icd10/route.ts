import { NextRequest } from "next/server";
import { authorizeApiAccess } from "@/lib/auth";
import { prepareIcd10Search, searchIcd10Records } from "@/lib/reference-search";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const access = await authorizeApiAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });

  if (access.error) {
    return access.error;
  }

  const prepared = prepareIcd10Search(
    request.nextUrl.searchParams.get("q"),
    request.nextUrl.searchParams.get("limit")
  );

  const supabase = await getSupabaseServerClient();
  const { data, error } = await searchIcd10Records(supabase, prepared);

  if (error) {
    return Response.json([], { status: error.status });
  }

  return Response.json(data);
}
