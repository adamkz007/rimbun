import { redirect } from "next/navigation";
import { getCurrentStaff, type CurrentStaff } from "@/lib/actions/auth-actions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isModuleEnabled, type AppModule } from "@/lib/modules";
import type { StaffRole } from "@/types/database";

type AccessOptions = {
  roles?: StaffRole[];
  module?: AppModule;
};

function hasRoleAccess(staff: CurrentStaff, roles?: StaffRole[]) {
  if (!roles?.length) {
    return true;
  }

  return roles.includes(staff.role);
}

function hasModuleAccess(staff: CurrentStaff, module?: AppModule) {
  if (!module) {
    return true;
  }

  return isModuleEnabled(staff.clinics?.settings, module);
}

export async function requireAuthenticatedStaff() {
  const staff = await getCurrentStaff();

  if (!staff) {
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

  if (!hasRoleAccess(staff, options.roles) || !hasModuleAccess(staff, options.module)) {
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

  if (!hasRoleAccess(staff, options.roles)) {
    throw new Error("You are not authorized to perform this action.");
  }

  if (!hasModuleAccess(staff, options.module)) {
    throw new Error("This module is disabled for the current clinic.");
  }

  return staff;
}
