import { NextRequest } from "next/server";
import { authorizeApiAccess } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const access = await authorizeApiAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });

  if (access.error) {
    return access.error;
  }

  const query = request.nextUrl.searchParams.get("q");
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "10"), 20);

  if (!query || query.length < 2) {
    return Response.json([]);
  }

  const supabase = await getSupabaseServerClient();

  const tsquery = query
    .trim()
    .split(/\s+/)
    .map((w) => w + ":*")
    .join(" & ");

  const { data, error } = await supabase
    .from("icd10_codes")
    .select("code, description, category")
    .textSearch("search_vector", tsquery)
    .limit(limit);

  if (error) {
    return Response.json([], { status: 500 });
  }

  return Response.json(data);
}
