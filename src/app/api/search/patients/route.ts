import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "5"), 20);

  if (!query || query.length < 2) {
    return Response.json([]);
  }

  const supabase = await getSupabaseServerClient();
  const escapedQuery = query.replace(/[%_,]/g, "");

  const { data, error } = await supabase
    .from("patients")
    .select("id, full_name, mrn")
    .or(
      `full_name.ilike.%${escapedQuery}%,mrn.ilike.%${escapedQuery}%,ic_number.ilike.%${escapedQuery}%`
    )
    .is("archived_at", null)
    .limit(limit);

  if (error) {
    return Response.json([], { status: 500 });
  }

  return Response.json(data);
}
