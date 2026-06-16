"use server";

import { logAuditEvent } from "@/lib/audit";
import { requireActionAccess } from "@/lib/auth";
import {
  ACTIVE_QUEUE_STATUSES,
  canCancelQueueEntry,
  canCheckInPatients,
  canManageQueueOrder,
  canStartEncounterFromQueue,
  canUpdateQueueStatus,
  getTodayUtcBounds,
  sortQueueEntries,
} from "@/lib/queue";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { QueueArrivalType, QueueStatus, Tables } from "@/types/database";

type QueueEntryRecord = Pick<
  Tables<"queue_entries">,
  | "id"
  | "clinic_id"
  | "patient_id"
  | "encounter_id"
  | "assigned_doctor_id"
  | "status"
  | "sort_order"
  | "checked_in_at"
>;

async function getQueueEntryRecord(entryId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: ["admin", "doctor", "nurse", "receptionist"],
    module: "queue",
  });

  const { data, error } = await supabase
    .from("queue_entries")
    .select(
      "id, clinic_id, patient_id, encounter_id, assigned_doctor_id, status, sort_order, checked_in_at"
    )
    .eq("id", entryId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.clinic_id !== staff.clinic_id) {
    throw new Error("Queue entry not found.");
  }

  return {
    supabase,
    staff,
    entry: data as QueueEntryRecord,
  };
}

async function assertPatientCanJoinQueue(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  clinicId: string,
  patientId: string
) {
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, archived_at, merged_into_patient_id")
    .eq("id", patientId)
    .maybeSingle();

  if (patientError) throw new Error(patientError.message);
  if (!patient) {
    throw new Error("Patient not found.");
  }

  if (patient.merged_into_patient_id) {
    throw new Error("This patient record has been merged into another record.");
  }

  if (patient.archived_at) {
    throw new Error("Archived patients cannot be checked in.");
  }

  const { start, end } = getTodayUtcBounds();
  const { data: activeEntry, error: activeError } = await supabase
    .from("queue_entries")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .in("status", ACTIVE_QUEUE_STATUSES)
    .gte("checked_in_at", start)
    .lt("checked_in_at", end)
    .maybeSingle();

  if (activeError) throw new Error(activeError.message);
  if (activeEntry) {
    throw new Error("This patient is already in today's queue.");
  }
}

async function getNextSortOrder(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  clinicId: string
) {
  const { start, end } = getTodayUtcBounds();
  const { data, error } = await supabase
    .from("queue_entries")
    .select("sort_order")
    .eq("clinic_id", clinicId)
    .in("status", ACTIVE_QUEUE_STATUSES)
    .gte("checked_in_at", start)
    .lt("checked_in_at", end)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.sort_order ?? -1) + 1;
}

export async function checkInPatient(input: {
  patientId: string;
  arrivalType: QueueArrivalType;
  assignedDoctorId?: string | null;
  notes?: string | null;
}) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: ["admin", "receptionist"],
    module: "queue",
  });

  if (!canCheckInPatients(staff.role)) {
    throw new Error("You are not authorized to check in patients.");
  }

  await assertPatientCanJoinQueue(supabase, staff.clinic_id, input.patientId);

  if (input.assignedDoctorId) {
    const { data: doctor, error: doctorError } = await supabase
      .from("staff")
      .select("id, role, is_active")
      .eq("id", input.assignedDoctorId)
      .eq("clinic_id", staff.clinic_id)
      .maybeSingle();

    if (doctorError) throw new Error(doctorError.message);
    if (!doctor || doctor.role !== "doctor" || !doctor.is_active) {
      throw new Error("Assigned doctor not found.");
    }
  }

  const { data: queueNumberResult, error: queueNumberError } = await supabase.rpc(
    "next_queue_number",
    { p_clinic_id: staff.clinic_id }
  );

  if (queueNumberError) throw new Error(queueNumberError.message);

  const sortOrder = await getNextSortOrder(supabase, staff.clinic_id);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("queue_entries")
    .insert({
      clinic_id: staff.clinic_id,
      patient_id: input.patientId,
      assigned_doctor_id: input.assignedDoctorId ?? null,
      arrival_type: input.arrivalType,
      queue_number: queueNumberResult as number,
      sort_order: sortOrder,
      checked_in_by: staff.id,
      checked_in_at: now,
      status_updated_at: now,
      notes: input.notes?.trim() || null,
      status: "waiting",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "queue.checked_in",
    targetType: "queue_entry",
    targetId: data.id,
    details: {
      patientId: input.patientId,
      queueNumber: data.queue_number,
      arrivalType: input.arrivalType,
    },
  });

  return data;
}

export async function updateQueueStatus(entryId: string, nextStatus: QueueStatus) {
  const { supabase, staff, entry } = await getQueueEntryRecord(entryId);

  if (nextStatus === "cancelled") {
    if (!canCancelQueueEntry(staff.role)) {
      throw new Error("You are not authorized to cancel queue entries.");
    }
  } else if (!canUpdateQueueStatus(staff.role, entry.status, nextStatus)) {
    throw new Error("You are not authorized to update this queue entry.");
  }

  const now = new Date().toISOString();
  const payload =
    nextStatus === "cancelled"
      ? {
          status: nextStatus,
          status_updated_at: now,
          cancelled_at: now,
          cancelled_by: staff.id,
        }
      : {
          status: nextStatus,
          status_updated_at: now,
        };

  const { data, error } = await supabase
    .from("queue_entries")
    .update(payload)
    .eq("id", entryId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "queue.status_updated",
    targetType: "queue_entry",
    targetId: entryId,
    details: {
      from: entry.status,
      to: nextStatus,
    },
  });

  return data;
}

export async function startEncounterFromQueue(entryId: string) {
  const { supabase, staff, entry } = await getQueueEntryRecord(entryId);

  if (!canStartEncounterFromQueue(staff.role)) {
    throw new Error("Only doctors can start encounters from the queue.");
  }

  if (!ACTIVE_QUEUE_STATUSES.includes(entry.status)) {
    throw new Error("This queue entry is no longer active.");
  }

  if (entry.encounter_id) {
    return { encounterId: entry.encounter_id, queueEntryId: entry.id };
  }

  const doctorId = entry.assigned_doctor_id ?? staff.id;

  if (entry.assigned_doctor_id && entry.assigned_doctor_id !== staff.id) {
    throw new Error("This patient is assigned to another doctor.");
  }

  const { data: encounter, error: encounterError } = await supabase
    .from("encounters")
    .insert({
      clinic_id: staff.clinic_id,
      patient_id: entry.patient_id,
      doctor_id: doctorId,
      status: "in_progress",
    })
    .select("id")
    .single();

  if (encounterError) throw new Error(encounterError.message);

  const now = new Date().toISOString();
  const { error: queueError } = await supabase
    .from("queue_entries")
    .update({
      encounter_id: encounter.id,
      status: "with_doctor",
      status_updated_at: now,
    })
    .eq("id", entryId);

  if (queueError) throw new Error(queueError.message);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "queue.encounter_started",
    targetType: "queue_entry",
    targetId: entryId,
    details: {
      encounterId: encounter.id,
      patientId: entry.patient_id,
    },
  });

  return { encounterId: encounter.id, queueEntryId: entry.id };
}

export async function reorderQueueEntry(entryId: string, direction: "up" | "down") {
  const { supabase, staff, entry } = await getQueueEntryRecord(entryId);

  if (!canManageQueueOrder(staff.role)) {
    throw new Error("You are not authorized to reorder the queue.");
  }

  if (!ACTIVE_QUEUE_STATUSES.includes(entry.status)) {
    throw new Error("Only active queue entries can be reordered.");
  }

  const { start, end } = getTodayUtcBounds();
  const { data: activeEntries, error } = await supabase
    .from("queue_entries")
    .select("id, sort_order, checked_in_at")
    .eq("clinic_id", staff.clinic_id)
    .in("status", ACTIVE_QUEUE_STATUSES)
    .gte("checked_in_at", start)
    .lt("checked_in_at", end);

  if (error) throw new Error(error.message);

  const orderedEntries = sortQueueEntries(activeEntries ?? []);
  const currentIndex = orderedEntries.findIndex((item) => item.id === entryId);

  if (currentIndex === -1) {
    throw new Error("Queue entry not found in today's active queue.");
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= orderedEntries.length) {
    return;
  }

  const currentEntry = orderedEntries[currentIndex];
  const swapEntry = orderedEntries[targetIndex];

  await Promise.all([
    supabase
      .from("queue_entries")
      .update({ sort_order: swapEntry.sort_order })
      .eq("id", currentEntry.id),
    supabase
      .from("queue_entries")
      .update({ sort_order: currentEntry.sort_order })
      .eq("id", swapEntry.id),
  ]);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "queue.reordered",
    targetType: "queue_entry",
    targetId: entryId,
    details: { direction },
  });
}

export async function completeQueueEntryForEncounter(encounterId: string) {
  const supabase = await getSupabaseServerClient();
  const { data: entry, error } = await supabase
    .from("queue_entries")
    .select("id, clinic_id, status")
    .eq("encounter_id", encounterId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!entry || entry.status === "completed" || entry.status === "cancelled") {
    return null;
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("queue_entries")
    .update({
      status: "completed",
      status_updated_at: now,
      completed_at: now,
    })
    .eq("id", entry.id);

  if (updateError) throw new Error(updateError.message);
  return entry.id;
}
