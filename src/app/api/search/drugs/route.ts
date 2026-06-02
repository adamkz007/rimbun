import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
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
    .from("drugs")
    .select("id, name, generic_name, formulation, strength")
    .textSearch("search_vector", tsquery)
    .limit(limit);

  if (error) {
    return Response.json([], { status: 500 });
  }

  return Response.json(data);
}
