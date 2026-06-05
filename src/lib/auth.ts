import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/actions/auth-actions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  hasAccess,
  hasModuleAccess,
  hasRoleAccess,
  type AccessOptions,
} from "@/lib/rbac";

export async function requireAuthenticatedStaff() {
  const staff = await getCurrentStaff();

  if (!staff) {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  if (!staff.is_active) {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return staff;
}

export async function requirePageAccess(options: AccessOptions = {}) {
  const staff = await requireAuthenticatedStaff();

  if (
    !hasAccess({
      role: staff.role,
      clinicSettings: staff.clinics?.settings,
      access: options,
    })
  ) {
    redirect("/dashboard");
  }

  return staff;
}

export async function requireActionAccess(options: AccessOptions = {}) {
  const staff = await getCurrentStaff();

  if (!staff) {
    throw new Error("Not authenticated");
  }

  if (!staff.is_active) {
    throw new Error("Your staff account is inactive.");
  }

  if (!hasRoleAccess(staff.role, options.roles)) {
    throw new Error("You are not authorized to perform this action.");
  }

  if (!hasModuleAccess(staff.clinics?.settings, options.module)) {
    throw new Error("This module is disabled for the current clinic.");
  }

  return staff;
}

export async function authorizeApiAccess(options: AccessOptions = {}) {
  const staff = await getCurrentStaff();

  if (!staff) {
    return {
      staff: null,
      error: Response.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (!staff.is_active) {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();

    return {
      staff: null,
      error: Response.json(
        { error: "Your staff account is inactive. Contact your clinic admin." },
        { status: 403 }
      ),
    };
  }

  if (!hasRoleAccess(staff.role, options.roles)) {
    return {
      staff: null,
      error: Response.json(
        { error: "You are not authorized to access this resource." },
        { status: 403 }
      ),
    };
  }

  if (!hasModuleAccess(staff.clinics?.settings, options.module)) {
    return {
      staff: null,
      error: Response.json(
        { error: "This module is disabled for the current clinic." },
        { status: 403 }
      ),
    };
  }

  return { staff, error: null };
}
