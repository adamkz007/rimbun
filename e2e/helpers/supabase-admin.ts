import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables for E2E checks.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getEncounterStatus(encounterId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("encounters")
    .select("status")
    .eq("id", encounterId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { status: string } | null)?.status ?? null;
}

export async function getEncounterNoteContent(encounterId: string, section: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("encounter_notes")
    .select("content")
    .eq("encounter_id", encounterId)
    .eq("section", section)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { content: Record<string, unknown> | null } | null)?.content ?? null;
}
