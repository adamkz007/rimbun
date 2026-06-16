"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const updateClinicDetailsSchema = z.object({
  name: z.string().trim().min(2, "Clinic name is required."),
  registrationNumber: z.string().trim().max(120).optional(),
  address: z.string().trim().max(500).optional(),
});

type ActionResult =
  | { success: true; message: string }
  | { success: false; message: string };

export async function updateClinicDetails(input: {
  name: string;
  registrationNumber?: string;
  address?: string;
}): Promise<ActionResult> {
  const actor = await requireActionAccess({ roles: ["admin"] });
  const parsed = updateClinicDetailsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid clinic details.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const { data: existingClinic } = await supabase
    .from("clinics")
    .select("name, registration_number, address")
    .eq("id", actor.clinic_id)
    .maybeSingle();

  const { error } = await supabase
    .from("clinics")
    .update({
      name: parsed.data.name,
      registration_number: parsed.data.registrationNumber || null,
      address: parsed.data.address || null,
    })
    .eq("id", actor.clinic_id);

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  await logAuditEvent({
    clinicId: actor.clinic_id,
    actorStaffId: actor.id,
    action: "clinic.updated",
    targetType: "clinic",
    targetId: actor.clinic_id,
    details: {
      previous: existingClinic ?? null,
      next: {
        name: parsed.data.name,
        registrationNumber: parsed.data.registrationNumber || null,
        address: parsed.data.address || null,
      },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");

  return {
    success: true,
    message: "Clinic details updated.",
  };
}
