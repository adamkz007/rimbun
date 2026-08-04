"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";
import { requireActionAccess } from "@/lib/auth";
import {
  canCancelEnquiry,
  canCloseEnquiry,
  canConvertEnquiry,
  canDismissReminder,
  canEditEnquiry,
  canScheduleReminder,
  deriveEnquiryStatusAfterSchedule,
} from "@/lib/enquiry";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  EnquirySource,
  EnquiryStatus,
  NotificationChannel,
  ReminderType,
  Tables,
} from "@/types/database";

type EnquiryRecord = Pick<
  Tables<"enquiries">,
  | "id"
  | "clinic_id"
  | "source"
  | "status"
  | "contact_name"
  | "contact_phone"
  | "contact_email"
  | "subject"
  | "notes"
  | "patient_id"
  | "converted_patient_id"
  | "scheduled_at"
>;

type ReminderRecord = Pick<
  Tables<"enquiry_reminders">,
  "id" | "clinic_id" | "enquiry_id" | "status" | "remind_at"
>;

const ENQUIRY_ROLES = ["admin", "receptionist"] as const;

const createEnquirySchema = z.object({
  source: z.enum(["call", "walk_in", "follow_up", "appointment"]),
  contactName: z.string().trim().min(2, "Contact name is required.").max(120),
  contactPhone: z.string().trim().max(30).optional(),
  contactEmail: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  subject: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  patientId: z.uuid().optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  assignedTo: z.uuid().optional(),
});

const updateEnquirySchema = createEnquirySchema.partial().extend({
  enquiryId: z.uuid(),
});

const updateEnquiryStatusSchema = z.object({
  enquiryId: z.uuid(),
  status: z.enum(["new", "in_progress", "scheduled", "converted", "closed", "cancelled"]),
});

const scheduleReminderSchema = z.object({
  enquiryId: z.uuid(),
  reminderType: z.enum(["follow_up", "appointment", "callback"]),
  remindAt: z.string().datetime({ offset: true }),
  message: z.string().trim().max(500).optional(),
  notificationChannel: z.enum(["in_app", "email", "sms"]).optional(),
});

const dismissReminderSchema = z.object({
  reminderId: z.uuid(),
});

const convertEnquirySchema = z.object({
  enquiryId: z.uuid(),
  fullName: z.string().trim().min(2, "Full name is required.").max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  icNumber: z.string().trim().max(30).optional(),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
});

const linkEnquirySchema = z.object({
  enquiryId: z.uuid(),
  patientId: z.uuid(),
});

export type EnquiryActionResult = {
  success: boolean;
  message: string;
  enquiryId?: string;
  patientId?: string;
};

async function getEnquiryRecord(enquiryId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: [...ENQUIRY_ROLES],
    module: "enquiry",
  });

  const { data, error } = await supabase
    .from("enquiries")
    .select(
      "id, clinic_id, source, status, contact_name, contact_phone, contact_email, subject, notes, patient_id, converted_patient_id, scheduled_at"
    )
    .eq("id", enquiryId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.clinic_id !== staff.clinic_id) {
    throw new Error("Enquiry not found.");
  }

  return {
    supabase,
    staff,
    enquiry: data as EnquiryRecord,
  };
}

async function getReminderRecord(reminderId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: [...ENQUIRY_ROLES],
    module: "enquiry",
  });

  const { data, error } = await supabase
    .from("enquiry_reminders")
    .select("id, clinic_id, enquiry_id, status, remind_at")
    .eq("id", reminderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.clinic_id !== staff.clinic_id) {
    throw new Error("Reminder not found.");
  }

  return {
    supabase,
    staff,
    reminder: data as ReminderRecord,
  };
}

function revalidateEnquiryPaths(patientId?: string | null) {
  revalidatePath("/enquiry");
  revalidatePath("/dashboard");

  if (patientId) {
    revalidatePath(`/patients/${patientId}`);
  }
}

function normalizeOptionalString(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createEnquiry(
  input: z.input<typeof createEnquirySchema>
): Promise<EnquiryActionResult> {
  const parsed = createEnquirySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid enquiry details.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: [...ENQUIRY_ROLES],
    module: "enquiry",
  });

  if (parsed.data.patientId) {
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id")
      .eq("id", parsed.data.patientId)
      .eq("clinic_id", staff.clinic_id)
      .is("archived_at", null)
      .maybeSingle();

    if (patientError) throw new Error(patientError.message);
    if (!patient) {
      return { success: false, message: "Linked patient not found." };
    }
  }

  const status: EnquiryStatus = parsed.data.scheduledAt ? "scheduled" : "new";

  const { data, error } = await supabase
    .from("enquiries")
    .insert({
      clinic_id: staff.clinic_id,
      source: parsed.data.source,
      status,
      contact_name: parsed.data.contactName,
      contact_phone: normalizeOptionalString(parsed.data.contactPhone),
      contact_email: normalizeOptionalString(parsed.data.contactEmail),
      subject: normalizeOptionalString(parsed.data.subject),
      notes: normalizeOptionalString(parsed.data.notes),
      patient_id: parsed.data.patientId ?? null,
      scheduled_at: parsed.data.scheduledAt ?? null,
      assigned_to: parsed.data.assignedTo ?? null,
      recorded_by: staff.id,
    })
    .select("id, contact_name")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "enquiry.created",
    targetType: "enquiry",
    targetId: data.id,
    details: {
      source: parsed.data.source,
      contactName: data.contact_name,
    },
  });

  revalidateEnquiryPaths(parsed.data.patientId);

  return {
    success: true,
    message: `Captured enquiry for ${data.contact_name}.`,
    enquiryId: data.id,
  };
}

export async function updateEnquiry(
  input: z.input<typeof updateEnquirySchema>
): Promise<EnquiryActionResult> {
  const parsed = updateEnquirySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid enquiry details.",
    };
  }

  const { supabase, staff, enquiry } = await getEnquiryRecord(parsed.data.enquiryId);

  if (!canEditEnquiry(enquiry.status)) {
    return { success: false, message: "This enquiry can no longer be edited." };
  }

  const nextStatus =
    parsed.data.scheduledAt && enquiry.status !== "scheduled"
      ? deriveEnquiryStatusAfterSchedule(enquiry.status)
      : enquiry.status;

  const { error } = await supabase
    .from("enquiries")
    .update({
      source: parsed.data.source ?? enquiry.source,
      status: nextStatus,
      contact_name: parsed.data.contactName ?? enquiry.contact_name,
      contact_phone:
        parsed.data.contactPhone !== undefined
          ? normalizeOptionalString(parsed.data.contactPhone)
          : enquiry.contact_phone,
      contact_email:
        parsed.data.contactEmail !== undefined
          ? normalizeOptionalString(parsed.data.contactEmail)
          : enquiry.contact_email,
      subject:
        parsed.data.subject !== undefined
          ? normalizeOptionalString(parsed.data.subject)
          : enquiry.subject,
      notes:
        parsed.data.notes !== undefined
          ? normalizeOptionalString(parsed.data.notes)
          : enquiry.notes,
      patient_id: parsed.data.patientId ?? enquiry.patient_id,
      scheduled_at:
        parsed.data.scheduledAt !== undefined
          ? parsed.data.scheduledAt ?? null
          : enquiry.scheduled_at,
      assigned_to: parsed.data.assignedTo ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enquiry.id);

  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "enquiry.updated",
    targetType: "enquiry",
    targetId: enquiry.id,
  });

  revalidateEnquiryPaths(enquiry.patient_id);

  return {
    success: true,
    message: "Enquiry updated.",
    enquiryId: enquiry.id,
  };
}

export async function updateEnquiryStatus(
  input: z.input<typeof updateEnquiryStatusSchema>
): Promise<EnquiryActionResult> {
  const parsed = updateEnquiryStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid status update.",
    };
  }

  const { supabase, staff, enquiry } = await getEnquiryRecord(parsed.data.enquiryId);
  const nextStatus = parsed.data.status;

  if (nextStatus === "closed" && !canCloseEnquiry(enquiry.status)) {
    return { success: false, message: "This enquiry cannot be closed." };
  }

  if (nextStatus === "cancelled" && !canCancelEnquiry(enquiry.status)) {
    return { success: false, message: "This enquiry cannot be cancelled." };
  }

  const now = new Date().toISOString();
  const updatePayload: Partial<Tables<"enquiries">> = {
    status: nextStatus,
    updated_at: now,
  };

  if (nextStatus === "closed") {
    updatePayload.closed_at = now;
    updatePayload.closed_by = staff.id;
  }

  const { error } = await supabase
    .from("enquiries")
    .update(updatePayload)
    .eq("id", enquiry.id);

  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "enquiry.status_updated",
    targetType: "enquiry",
    targetId: enquiry.id,
    details: { status: nextStatus },
  });

  revalidateEnquiryPaths(enquiry.patient_id);

  return {
    success: true,
    message: `Enquiry marked as ${nextStatus.replace("_", " ")}.`,
    enquiryId: enquiry.id,
  };
}

export async function scheduleReminder(
  input: z.input<typeof scheduleReminderSchema>
): Promise<EnquiryActionResult> {
  const parsed = scheduleReminderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid reminder details.",
    };
  }

  const { supabase, staff, enquiry } = await getEnquiryRecord(parsed.data.enquiryId);

  if (!canScheduleReminder(enquiry.status)) {
    return { success: false, message: "Reminders cannot be scheduled for this enquiry." };
  }

  const { data, error } = await supabase
    .from("enquiry_reminders")
    .insert({
      clinic_id: staff.clinic_id,
      enquiry_id: enquiry.id,
      reminder_type: parsed.data.reminderType,
      remind_at: parsed.data.remindAt,
      message: normalizeOptionalString(parsed.data.message),
      notification_channel: (parsed.data.notificationChannel ?? "in_app") as NotificationChannel,
      created_by: staff.id,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  const nextStatus = deriveEnquiryStatusAfterSchedule(enquiry.status);
  if (nextStatus !== enquiry.status) {
    await supabase
      .from("enquiries")
      .update({
        status: nextStatus,
        scheduled_at: parsed.data.remindAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", enquiry.id);
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "enquiry.reminder_scheduled",
    targetType: "enquiry_reminder",
    targetId: data.id,
    details: {
      enquiryId: enquiry.id,
      reminderType: parsed.data.reminderType,
      remindAt: parsed.data.remindAt,
    },
  });

  revalidateEnquiryPaths(enquiry.patient_id);

  return {
    success: true,
    message: "Reminder scheduled.",
    enquiryId: enquiry.id,
  };
}

export async function dismissReminder(
  input: z.input<typeof dismissReminderSchema>
): Promise<EnquiryActionResult> {
  const parsed = dismissReminderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid reminder.",
    };
  }

  const { supabase, staff, reminder } = await getReminderRecord(parsed.data.reminderId);

  if (!canDismissReminder(reminder.status)) {
    return { success: false, message: "This reminder cannot be dismissed." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("enquiry_reminders")
    .update({
      status: "dismissed",
      dismissed_at: now,
      dismissed_by: staff.id,
      updated_at: now,
    })
    .eq("id", reminder.id);

  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "enquiry.reminder_dismissed",
    targetType: "enquiry_reminder",
    targetId: reminder.id,
  });

  revalidateEnquiryPaths();

  return {
    success: true,
    message: "Reminder dismissed.",
    enquiryId: reminder.enquiry_id,
  };
}

export async function processDueReminders(): Promise<EnquiryActionResult> {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: [...ENQUIRY_ROLES],
    module: "enquiry",
  });

  const now = new Date().toISOString();
  const { data: dueReminders, error } = await supabase
    .from("enquiry_reminders")
    .select("id, enquiry_id, notification_channel, message, remind_at")
    .eq("clinic_id", staff.clinic_id)
    .eq("status", "pending")
    .lte("remind_at", now);

  if (error) {
    return { success: false, message: error.message };
  }

  if (!dueReminders?.length) {
    return { success: true, message: "No due reminders to process." };
  }

  const reminderIds = dueReminders.map((reminder) => reminder.id);
  const { error: updateError } = await supabase
    .from("enquiry_reminders")
    .update({
      status: "sent",
      sent_at: now,
      updated_at: now,
    })
    .in("id", reminderIds);

  if (updateError) {
    return { success: false, message: updateError.message };
  }

  for (const reminder of dueReminders) {
    await logAuditEvent({
      clinicId: staff.clinic_id,
      actorStaffId: staff.id,
      action: "enquiry.reminder_sent",
      targetType: "enquiry_reminder",
      targetId: reminder.id,
      details: {
        enquiryId: reminder.enquiry_id,
        channel: reminder.notification_channel,
        message: reminder.message,
        remindAt: reminder.remind_at,
      },
    });
  }

  revalidateEnquiryPaths();

  return {
    success: true,
    message: `Processed ${dueReminders.length} due reminder${dueReminders.length === 1 ? "" : "s"}.`,
  };
}

export async function convertEnquiryToPatient(
  input: z.input<typeof convertEnquirySchema>
): Promise<EnquiryActionResult> {
  const parsed = convertEnquirySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid conversion details.",
    };
  }

  const { supabase, staff, enquiry } = await getEnquiryRecord(parsed.data.enquiryId);

  if (!canConvertEnquiry(enquiry.status)) {
    return { success: false, message: "This enquiry cannot be converted to a patient." };
  }

  const fullName = parsed.data.fullName?.trim() || enquiry.contact_name;
  const phone = normalizeOptionalString(parsed.data.phone ?? enquiry.contact_phone ?? undefined);
  const email = normalizeOptionalString(parsed.data.email ?? enquiry.contact_email ?? undefined);

  const { count } = await supabase
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", staff.clinic_id);

  const mrn = `P${String((count ?? 0) + 1).padStart(5, "0")}`;

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .insert({
      clinic_id: staff.clinic_id,
      mrn,
      full_name: fullName,
      ic_number: normalizeOptionalString(parsed.data.icNumber),
      date_of_birth: parsed.data.dateOfBirth ?? null,
      gender: parsed.data.gender ?? null,
      phone,
      email,
      address: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      allergies: [],
      medical_history: {},
      archived_at: null,
      archived_reason: null,
      merged_into_patient_id: null,
    })
    .select("id, full_name, mrn")
    .single();

  if (patientError) {
    return { success: false, message: patientError.message };
  }

  const now = new Date().toISOString();
  const { error: enquiryError } = await supabase
    .from("enquiries")
    .update({
      status: "converted",
      converted_patient_id: patient.id,
      converted_at: now,
      converted_by: staff.id,
      updated_at: now,
    })
    .eq("id", enquiry.id);

  if (enquiryError) {
    return { success: false, message: enquiryError.message };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "enquiry.converted",
    targetType: "enquiry",
    targetId: enquiry.id,
    details: {
      patientId: patient.id,
      patientName: patient.full_name,
      mrn: patient.mrn,
    },
  });

  revalidateEnquiryPaths(patient.id);

  return {
    success: true,
    message: `Converted enquiry to patient ${patient.full_name} (${patient.mrn}).`,
    enquiryId: enquiry.id,
    patientId: patient.id,
  };
}

export async function linkEnquiryToPatient(
  input: z.input<typeof linkEnquirySchema>
): Promise<EnquiryActionResult> {
  const parsed = linkEnquirySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid patient link.",
    };
  }

  const { supabase, staff, enquiry } = await getEnquiryRecord(parsed.data.enquiryId);

  if (!canConvertEnquiry(enquiry.status)) {
    return { success: false, message: "This enquiry cannot be linked to a patient." };
  }

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, full_name, mrn")
    .eq("id", parsed.data.patientId)
    .eq("clinic_id", staff.clinic_id)
    .is("archived_at", null)
    .maybeSingle();

  if (patientError) throw new Error(patientError.message);
  if (!patient) {
    return { success: false, message: "Patient not found." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("enquiries")
    .update({
      status: "converted",
      patient_id: patient.id,
      converted_patient_id: patient.id,
      converted_at: now,
      converted_by: staff.id,
      updated_at: now,
    })
    .eq("id", enquiry.id);

  if (error) {
    return { success: false, message: error.message };
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "enquiry.linked",
    targetType: "enquiry",
    targetId: enquiry.id,
    details: {
      patientId: patient.id,
      patientName: patient.full_name,
      mrn: patient.mrn,
    },
  });

  revalidateEnquiryPaths(patient.id);

  return {
    success: true,
    message: `Linked enquiry to ${patient.full_name} (${patient.mrn}).`,
    enquiryId: enquiry.id,
    patientId: patient.id,
  };
}

export async function updateEnquiryAssignment(input: {
  enquiryId: string;
  assignedTo: string | null;
}): Promise<EnquiryActionResult> {
  const enquiryId = z.uuid().safeParse(input.enquiryId);
  if (!enquiryId.success) {
    return { success: false, message: "Invalid enquiry." };
  }

  const { supabase, enquiry } = await getEnquiryRecord(enquiryId.data);

  if (!canEditEnquiry(enquiry.status)) {
    return { success: false, message: "This enquiry can no longer be updated." };
  }

  const nextStatus = enquiry.status === "new" ? ("in_progress" as EnquiryStatus) : enquiry.status;

  const { error } = await supabase
    .from("enquiries")
    .update({
      assigned_to: input.assignedTo,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enquiry.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateEnquiryPaths(enquiry.patient_id);

  return {
    success: true,
    message: input.assignedTo ? "Enquiry assigned." : "Assignment cleared.",
    enquiryId: enquiry.id,
  };
}

export type CreateEnquiryInput = z.input<typeof createEnquirySchema>;
export type EnquirySourceOption = EnquirySource;
export type ReminderTypeOption = ReminderType;
