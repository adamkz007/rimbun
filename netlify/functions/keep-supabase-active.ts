import { createClient } from "@supabase/supabase-js";

export default async (request: Request) => {
  const body = await request.json().catch(() => null);
  if (body && typeof body === "object" && "next_run" in body) {
    console.log("Supabase keep-alive scheduled for", body.next_run);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase keep-alive environment variables.");
    return new Response("Missing Supabase configuration.", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase
    .from("icd10_codes")
    .select("code", { head: true, count: "exact" });

  if (error) {
    console.error("Supabase keep-alive query failed:", error.message);
    return new Response(error.message, { status: 500 });
  }

  console.log("Supabase keep-alive succeeded.");
  return new Response("OK", { status: 200 });
};
