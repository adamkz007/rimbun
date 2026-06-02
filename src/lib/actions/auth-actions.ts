"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ClinicOpeningHours, ClinicSettings, StaffRole } from "@/types/database";

export type CurrentStaff = {
  id: string;
  auth_user_id: string;
  clinic_id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  mmc_number: string | null;
  is_active: boolean;
  clinics: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    registration_number: string | null;
    opening_hours: ClinicOpeningHours;
    settings: ClinicSettings;
  } | null;
};

export async function login(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await supabase.auth.signOut();
    return { error: "Unable to load staff account." };
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!staff?.is_active) {
    await supabase.auth.signOut();
    return { error: "Your staff account is inactive. Contact your clinic admin." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("*, clinics(id, name, slug, address, registration_number, opening_hours, settings)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return staff as CurrentStaff | null;
}
