"use server";

import { randomInt } from "node:crypto";
import { z } from "zod";
import { requireActionAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StaffRole, Tables } from "@/types/database";

const inviteStaffSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  email: z.email().transform((value) => value.toLowerCase()),
  role: z.enum(["admin", "doctor", "nurse", "receptionist"]),
  mmcNumber: z.string().trim().optional(),
});

const updateStaffSchema = z.object({
  staffId: z.uuid(),
  fullName: z.string().trim().min(2, "Full name is required."),
  role: z.enum(["admin", "doctor", "nurse", "receptionist"]),
  mmcNumber: z.string().trim().optional(),
});

const setStaffActiveSchema = z.object({
  staffId: z.uuid(),
  isActive: z.boolean(),
});

type ActionResult =
  | { success: true; message: string; temporaryPassword?: string }
  | { success: false; message: string };

export async function inviteStaffMember(input: {
  fullName: string;
  email: string;
  role: StaffRole;
  mmcNumber?: string;
}): Promise<ActionResult> {
  const staff = await requireActionAccess({ roles: ["admin"] });
  const parsed = inviteStaffSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid staff details.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  const temporaryPassword = generateTemporaryPassword();

  const { data: existingStaff } = await supabase
    .from("staff")
    .select("id")
    .eq("clinic_id", staff.clinic_id)
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (existingStaff) {
    return {
      success: false,
      message: "A staff member with that email already exists in this clinic.",
    };
  }

  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.data.fullName,
        role: parsed.data.role,
      },
    });

  if (createUserError || !createdUser.user) {
    return {
      success: false,
      message: createUserError?.message ?? "Unable to create the auth user.",
    };
  }

  const { data: createdStaff, error: insertError } = await supabase
    .from("staff")
    .insert({
      auth_user_id: createdUser.user.id,
      clinic_id: staff.clinic_id,
      email: parsed.data.email,
      full_name: parsed.data.fullName,
      role: parsed.data.role,
      mmc_number: parsed.data.mmcNumber || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError) {
    await admin.auth.admin.deleteUser(createdUser.user.id);

    return {
      success: false,
      message: insertError.message,
    };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "staff.invited",
    targetType: "staff",
    targetId: createdStaff.id,
    details: {
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      role: parsed.data.role,
      mmcNumber: parsed.data.mmcNumber || null,
    },
  });

  return {
    success: true,
    message: `Invited ${parsed.data.fullName}. Share the temporary password with the user.`,
    temporaryPassword,
  };
}

export async function updateStaffMember(input: {
  staffId: string;
  fullName: string;
  role: StaffRole;
  mmcNumber?: string;
}): Promise<ActionResult> {
  const actor = await requireActionAccess({ roles: ["admin"] });
  const parsed = updateStaffSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid staff details.",
    };
  }

  if (parsed.data.staffId === actor.id && parsed.data.role !== "admin") {
    return {
      success: false,
      message: "You cannot remove your own admin access.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const existingStaff = await getStaffMember(supabase, parsed.data.staffId);

  if (!existingStaff) {
    return {
      success: false,
      message: "Staff member not found.",
    };
  }

  const { error } = await supabase
    .from("staff")
    .update({
      full_name: parsed.data.fullName,
      role: parsed.data.role,
      mmc_number: parsed.data.mmcNumber || null,
    })
    .eq("id", parsed.data.staffId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  await logAuditEvent({
    clinicId: actor.clinic_id,
    actorStaffId: actor.id,
    action: "staff.updated",
    targetType: "staff",
    targetId: parsed.data.staffId,
    details: {
      previous: {
        fullName: existingStaff.full_name,
        role: existingStaff.role,
        mmcNumber: existingStaff.mmc_number,
      },
      next: {
        fullName: parsed.data.fullName,
        role: parsed.data.role,
        mmcNumber: parsed.data.mmcNumber || null,
      },
    },
  });

  return {
    success: true,
    message: `Updated ${parsed.data.fullName}.`,
  };
}

export async function setStaffMemberActive(input: {
  staffId: string;
  isActive: boolean;
}): Promise<ActionResult> {
  const actor = await requireActionAccess({ roles: ["admin"] });
  const parsed = setStaffActiveSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid staff update request.",
    };
  }

  if (parsed.data.staffId === actor.id && !parsed.data.isActive) {
    return {
      success: false,
      message: "You cannot deactivate your own account.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const existingStaff = await getStaffMember(supabase, parsed.data.staffId);

  if (!existingStaff) {
    return {
      success: false,
      message: "Staff member not found.",
    };
  }

  const { error } = await supabase
    .from("staff")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.staffId);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  await logAuditEvent({
    clinicId: actor.clinic_id,
    actorStaffId: actor.id,
    action: parsed.data.isActive ? "staff.activated" : "staff.deactivated",
    targetType: "staff",
    targetId: parsed.data.staffId,
    details: {
      email: existingStaff.email,
      fullName: existingStaff.full_name,
      role: existingStaff.role,
    },
  });

  return {
    success: true,
    message: `${existingStaff.full_name} is now ${
      parsed.data.isActive ? "active" : "inactive"
    }.`,
  };
}

type StaffRecord = Pick<
  Tables<"staff">,
  "id" | "email" | "full_name" | "role" | "mmc_number" | "is_active"
>;

async function getStaffMember(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  staffId: string
) {
  const { data } = await supabase
    .from("staff")
    .select("id, email, full_name, role, mmc_number, is_active")
    .eq("id", staffId)
    .maybeSingle();

  return data as StaffRecord | null;
}

function generateTemporaryPassword() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  return Array.from({ length: 14 }, () => {
    return charset[randomInt(0, charset.length)];
  }).join("");
}
