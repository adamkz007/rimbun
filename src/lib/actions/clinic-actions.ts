"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import {
  CLINIC_DAY_ORDER,
  isValidTime,
  normalizeOpeningHours,
  type ClinicDayKey,
} from "@/lib/clinic-details";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ClinicOpeningHours } from "@/types/database";

const openingHoursDaySchema = z.object({
  isOpen: z.boolean(),
  open: z.string(),
  close: z.string(),
});

const updateClinicDetailsSchema = z.object({
  name: z.string().trim().min(2, "Clinic name is required."),
  registrationNumber: z.string().trim().max(120).optional(),
  address: z.string().trim().max(500).optional(),
  openingHours: z.object({
    monday: openingHoursDaySchema,
    tuesday: openingHoursDaySchema,
    wednesday: openingHoursDaySchema,
    thursday: openingHoursDaySchema,
    friday: openingHoursDaySchema,
    saturday: openingHoursDaySchema,
    sunday: openingHoursDaySchema,
  }),
});

type ActionResult =
  | { success: true; message: string }
  | { success: false; message: string };

export async function updateClinicDetails(input: {
  name: string;
  registrationNumber?: string;
  address?: string;
  openingHours: ClinicOpeningHours;
}): Promise<ActionResult> {
  const actor = await requireActionAccess({ roles: ["admin"] });
  const parsed = updateClinicDetailsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid clinic details.",
    };
  }

  const normalizedHours = normalizeOpeningHours(parsed.data.openingHours);
  const scheduleError = getOpeningHoursValidationError(normalizedHours);

  if (scheduleError) {
    return {
      success: false,
      message: scheduleError,
    };
  }

  const supabase = await getSupabaseServerClient();
  const { data: existingClinic } = await supabase
    .from("clinics")
    .select("name, registration_number, address, opening_hours")
    .eq("id", actor.clinic_id)
    .maybeSingle();

  const { error } = await supabase
    .from("clinics")
    .update({
      name: parsed.data.name,
      registration_number: parsed.data.registrationNumber || null,
      address: parsed.data.address || null,
      opening_hours: normalizedHours,
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
        openingHours: normalizedHours,
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

function getOpeningHoursValidationError(openingHours: ClinicOpeningHours) {
  for (const day of CLINIC_DAY_ORDER) {
    const dayHours = openingHours[day];
    if (!dayHours.isOpen) {
      continue;
    }

    if (!isValidTime(dayHours.open) || !isValidTime(dayHours.close)) {
      return `${getDayLabel(day)} hours must use HH:MM format.`;
    }

    if (toMinutes(dayHours.open) >= toMinutes(dayHours.close)) {
      return `${getDayLabel(day)} closing time must be later than opening time.`;
    }
  }

  return null;
}

function getDayLabel(day: ClinicDayKey) {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
