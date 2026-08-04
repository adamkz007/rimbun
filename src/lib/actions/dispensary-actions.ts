"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requireActionAccess } from "@/lib/auth";
import {
  calculateQuantityAfter,
  canCancelFulfillment,
  canDispenseFulfillment,
  canDispenseControlledDrug,
  canDispenseMedication,
  canManageInventory,
  validateControlledWitness,
} from "@/lib/dispensary";
import { isModuleEnabled } from "@/lib/modules";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ClinicSettings,
  FulfillmentStatus,
  StockMovementType,
  Tables,
} from "@/types/database";

type FulfillmentRecord = Pick<
  Tables<"dispensary_fulfillments">,
  | "id"
  | "clinic_id"
  | "encounter_id"
  | "encounter_prescription_id"
  | "patient_id"
  | "inventory_item_id"
  | "status"
  | "drug_name"
  | "quantity_requested"
  | "is_controlled"
>;

type InventoryRecord = Pick<
  Tables<"inventory_items">,
  "id" | "clinic_id" | "name" | "quantity_on_hand" | "is_controlled" | "is_active"
>;

const DISPENSARY_ROLES = ["admin", "doctor", "nurse"] as const;

async function getFulfillmentRecord(fulfillmentId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: [...DISPENSARY_ROLES],
    module: "dispensary",
  });

  const { data, error } = await supabase
    .from("dispensary_fulfillments")
    .select(
      "id, clinic_id, encounter_id, encounter_prescription_id, patient_id, inventory_item_id, status, drug_name, quantity_requested, is_controlled"
    )
    .eq("id", fulfillmentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.clinic_id !== staff.clinic_id) {
    throw new Error("Fulfillment task not found.");
  }

  return {
    supabase,
    staff,
    fulfillment: data as FulfillmentRecord,
  };
}

async function getInventoryRecord(inventoryItemId: string) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: [...DISPENSARY_ROLES],
    module: "dispensary",
  });

  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, clinic_id, name, quantity_on_hand, is_controlled, is_active")
    .eq("id", inventoryItemId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.clinic_id !== staff.clinic_id) {
    throw new Error("Inventory item not found.");
  }

  return {
    supabase,
    staff,
    item: data as InventoryRecord,
  };
}

async function recordStockMovement(input: {
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>;
  clinicId: string;
  inventoryItemId: string;
  movementType: StockMovementType;
  quantityChange: number;
  quantityAfter: number;
  referenceType?: "fulfillment" | "manual" | null;
  referenceId?: string | null;
  reason?: string | null;
  recordedBy: string;
}) {
  const { error } = await input.supabase.from("stock_movements").insert({
    clinic_id: input.clinicId,
    inventory_item_id: input.inventoryItemId,
    movement_type: input.movementType,
    quantity_change: input.quantityChange,
    quantity_after: input.quantityAfter,
    reference_type: input.referenceType ?? null,
    reference_id: input.referenceId ?? null,
    reason: input.reason?.trim() || null,
    recorded_by: input.recordedBy,
  });

  if (error) throw new Error(error.message);
}

function revalidateDispensaryPaths(patientId?: string | null) {
  revalidatePath("/dispensary");
  revalidatePath("/dashboard");

  if (patientId) {
    revalidatePath(`/patients/${patientId}`);
  }
}

async function findInventoryForPrescription(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  clinicId: string,
  drugId: string | null,
  drugName: string
) {
  if (drugId) {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, is_controlled")
      .eq("clinic_id", clinicId)
      .eq("drug_id", drugId)
      .eq("is_active", true)
      .order("quantity_on_hand", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) {
      return data;
    }
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, is_controlled")
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .ilike("name", drugName.trim())
    .order("quantity_on_hand", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function createFulfillmentTasksFromEncounter(
  encounterId: string,
  clinicSettings?: ClinicSettings | null
) {
  if (clinicSettings && !isModuleEnabled(clinicSettings, "dispensary")) {
    return [];
  }

  const supabase = await getSupabaseServerClient();

  const { data: encounter, error: encounterError } = await supabase
    .from("encounters")
    .select("id, clinic_id, patient_id, status")
    .eq("id", encounterId)
    .maybeSingle();

  if (encounterError) throw new Error(encounterError.message);
  if (!encounter || encounter.status === "in_progress") {
    return [];
  }

  const { data: prescriptions, error: prescriptionsError } = await supabase
    .from("encounter_prescriptions")
    .select("id, drug_id, drug_name, dosage, quantity, is_dispensed")
    .eq("encounter_id", encounterId)
    .order("sort_order", { ascending: true });

  if (prescriptionsError) throw new Error(prescriptionsError.message);
  if (!prescriptions?.length) {
    return [];
  }

  const prescriptionIds = prescriptions.map((prescription) => prescription.id);
  const { data: existingFulfillments, error: existingError } = await supabase
    .from("dispensary_fulfillments")
    .select("encounter_prescription_id")
    .in("encounter_prescription_id", prescriptionIds);

  if (existingError) throw new Error(existingError.message);

  const existingIds = new Set(
    (existingFulfillments ?? []).map((item) => item.encounter_prescription_id)
  );

  const drugIds = prescriptions
    .map((prescription) => prescription.drug_id)
    .filter((drugId): drugId is string => Boolean(drugId));

  const controlledDrugIds = new Set<string>();
  if (drugIds.length > 0) {
    const { data: drugs, error: drugsError } = await supabase
      .from("drugs")
      .select("id, is_controlled")
      .in("id", drugIds);

    if (drugsError) throw new Error(drugsError.message);
    for (const drug of drugs ?? []) {
      if (drug.is_controlled) {
        controlledDrugIds.add(drug.id);
      }
    }
  }

  const createdIds: string[] = [];

  for (const prescription of prescriptions) {
    if (existingIds.has(prescription.id)) {
      continue;
    }

    const inventoryMatch = await findInventoryForPrescription(
      supabase,
      encounter.clinic_id,
      prescription.drug_id,
      prescription.drug_name
    );

    const isControlled =
      (prescription.drug_id ? controlledDrugIds.has(prescription.drug_id) : false) ||
      Boolean(inventoryMatch?.is_controlled);

    const { data: fulfillment, error: fulfillmentError } = await supabase
      .from("dispensary_fulfillments")
      .insert({
        clinic_id: encounter.clinic_id,
        encounter_id: encounter.id,
        encounter_prescription_id: prescription.id,
        patient_id: encounter.patient_id,
        inventory_item_id: inventoryMatch?.id ?? null,
        status: prescription.is_dispensed ? "dispensed" : "pending",
        drug_name: prescription.drug_name,
        dosage: prescription.dosage,
        quantity_requested: prescription.quantity,
        is_controlled: isControlled,
      })
      .select("id")
      .single();

    if (fulfillmentError) throw new Error(fulfillmentError.message);
    createdIds.push(fulfillment.id);
  }

  if (createdIds.length > 0) {
    await logAuditEvent({
      clinicId: encounter.clinic_id,
      action: "dispensary.fulfillments_created",
      targetType: "encounter",
      targetId: encounterId,
      details: {
        fulfillmentCount: createdIds.length,
      },
    });

    revalidateDispensaryPaths(encounter.patient_id);
  }

  return createdIds;
}

export async function dispenseFulfillment(input: {
  fulfillmentId: string;
  quantityDispensed?: number;
  inventoryItemId?: string | null;
  witnessStaffId?: string | null;
  notes?: string;
}) {
  const { supabase, staff, fulfillment } = await getFulfillmentRecord(
    input.fulfillmentId
  );

  if (!canDispenseMedication(staff.role)) {
    throw new Error("You do not have permission to dispense medication.");
  }

  if (!canDispenseFulfillment(fulfillment.status as FulfillmentStatus)) {
    throw new Error("This fulfillment task is no longer pending.");
  }

  if (fulfillment.is_controlled && !canDispenseControlledDrug(staff.role)) {
    throw new Error("You do not have permission to dispense controlled drugs.");
  }

  const witnessError = validateControlledWitness({
    isControlled: fulfillment.is_controlled,
    dispenserStaffId: staff.id,
    witnessStaffId: input.witnessStaffId,
  });

  if (witnessError) {
    throw new Error(witnessError);
  }

  const quantityDispensed = input.quantityDispensed ?? fulfillment.quantity_requested;
  if (quantityDispensed <= 0) {
    throw new Error("Dispensed quantity must be greater than zero.");
  }

  const inventoryItemId = input.inventoryItemId ?? fulfillment.inventory_item_id;
  let inventoryItem: InventoryRecord | null = null;

  if (inventoryItemId) {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, clinic_id, name, quantity_on_hand, is_controlled, is_active")
      .eq("id", inventoryItemId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data || data.clinic_id !== staff.clinic_id || !data.is_active) {
      throw new Error("Selected inventory item is unavailable.");
    }

    inventoryItem = data as InventoryRecord;

    if (inventoryItem.quantity_on_hand < quantityDispensed) {
      throw new Error(`Insufficient stock for ${inventoryItem.name}.`);
    }
  }

  const now = new Date().toISOString();

  const { error: fulfillmentError } = await supabase
    .from("dispensary_fulfillments")
    .update({
      status: "dispensed",
      inventory_item_id: inventoryItemId,
      quantity_dispensed: quantityDispensed,
      controlled_verified_by: fulfillment.is_controlled
        ? input.witnessStaffId ?? null
        : null,
      dispensed_at: now,
      dispensed_by: staff.id,
      notes: input.notes?.trim() || null,
      updated_at: now,
    })
    .eq("id", fulfillment.id);

  if (fulfillmentError) throw new Error(fulfillmentError.message);

  const { error: prescriptionError } = await supabase
    .from("encounter_prescriptions")
    .update({ is_dispensed: true })
    .eq("id", fulfillment.encounter_prescription_id);

  if (prescriptionError) throw new Error(prescriptionError.message);

  if (inventoryItem && inventoryItemId) {
    const quantityAfter = calculateQuantityAfter(
      inventoryItem.quantity_on_hand,
      -quantityDispensed
    );

    const { error: inventoryError } = await supabase
      .from("inventory_items")
      .update({
        quantity_on_hand: quantityAfter,
        updated_at: now,
      })
      .eq("id", inventoryItemId);

    if (inventoryError) throw new Error(inventoryError.message);

    await recordStockMovement({
      supabase,
      clinicId: staff.clinic_id,
      inventoryItemId,
      movementType: "dispense",
      quantityChange: -quantityDispensed,
      quantityAfter,
      referenceType: "fulfillment",
      referenceId: fulfillment.id,
      reason: `Dispensed for ${fulfillment.drug_name}`,
      recordedBy: staff.id,
    });
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: fulfillment.is_controlled
      ? "dispensary.controlled_dispensed"
      : "dispensary.fulfillment_dispensed",
    targetType: "dispensary_fulfillment",
    targetId: fulfillment.id,
    details: {
      encounterId: fulfillment.encounter_id,
      prescriptionId: fulfillment.encounter_prescription_id,
      quantityDispensed,
      inventoryItemId,
      witnessStaffId: input.witnessStaffId ?? null,
    },
  });

  revalidateDispensaryPaths(fulfillment.patient_id);
  revalidatePath(`/clerking/${fulfillment.encounter_id}`);
}

export async function cancelFulfillment(input: {
  fulfillmentId: string;
  notes?: string;
}) {
  const { supabase, staff, fulfillment } = await getFulfillmentRecord(
    input.fulfillmentId
  );

  if (!canCancelFulfillment(fulfillment.status as FulfillmentStatus)) {
    throw new Error("Only pending fulfillment tasks can be cancelled.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("dispensary_fulfillments")
    .update({
      status: "cancelled",
      notes: input.notes?.trim() || null,
      updated_at: now,
    })
    .eq("id", fulfillment.id);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "dispensary.fulfillment_cancelled",
    targetType: "dispensary_fulfillment",
    targetId: fulfillment.id,
    details: {
      encounterId: fulfillment.encounter_id,
    },
  });

  revalidateDispensaryPaths(fulfillment.patient_id);
}

export async function createInventoryItem(input: {
  name: string;
  sku?: string;
  drugId?: string | null;
  formulation?: string;
  strength?: string;
  unit?: string;
  quantityOnHand?: number;
  reorderLevel?: number;
  isControlled?: boolean;
}) {
  const supabase = await getSupabaseServerClient();
  const staff = await requireActionAccess({
    roles: ["admin", "nurse"],
    module: "dispensary",
  });

  const name = input.name.trim();
  if (!name) {
    throw new Error("Inventory item name is required.");
  }

  const quantityOnHand = input.quantityOnHand ?? 0;
  const reorderLevel = input.reorderLevel ?? 10;

  if (quantityOnHand < 0 || reorderLevel < 0) {
    throw new Error("Quantities cannot be negative.");
  }

  let isControlled = Boolean(input.isControlled);
  if (input.drugId) {
    const { data: drug, error: drugError } = await supabase
      .from("drugs")
      .select("is_controlled")
      .eq("id", input.drugId)
      .maybeSingle();

    if (drugError) throw new Error(drugError.message);
    if (drug?.is_controlled) {
      isControlled = true;
    }
  }

  const { data: item, error } = await supabase
    .from("inventory_items")
    .insert({
      clinic_id: staff.clinic_id,
      drug_id: input.drugId ?? null,
      name,
      sku: input.sku?.trim() || null,
      formulation: input.formulation?.trim() || null,
      strength: input.strength?.trim() || null,
      unit: input.unit?.trim() || "unit",
      quantity_on_hand: quantityOnHand,
      reorder_level: reorderLevel,
      is_controlled: isControlled,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (quantityOnHand > 0) {
    await recordStockMovement({
      supabase,
      clinicId: staff.clinic_id,
      inventoryItemId: item.id,
      movementType: "receipt",
      quantityChange: quantityOnHand,
      quantityAfter: quantityOnHand,
      referenceType: "manual",
      reason: "Initial stock on item creation",
      recordedBy: staff.id,
    });
  }

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "dispensary.inventory_created",
    targetType: "inventory_item",
    targetId: item.id,
    details: {
      name,
      quantityOnHand,
      isControlled,
    },
  });

  revalidateDispensaryPaths();
  return item.id;
}

export async function updateInventoryItem(input: {
  inventoryItemId: string;
  name?: string;
  sku?: string;
  formulation?: string;
  strength?: string;
  unit?: string;
  reorderLevel?: number;
  isActive?: boolean;
}) {
  const { supabase, staff, item } = await getInventoryRecord(input.inventoryItemId);

  if (!canManageInventory(staff.role)) {
    throw new Error("You do not have permission to manage inventory.");
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Inventory item name is required.");
    }
    payload.name = name;
  }

  if (input.sku !== undefined) {
    payload.sku = input.sku.trim() || null;
  }

  if (input.formulation !== undefined) {
    payload.formulation = input.formulation.trim() || null;
  }

  if (input.strength !== undefined) {
    payload.strength = input.strength.trim() || null;
  }

  if (input.unit !== undefined) {
    payload.unit = input.unit.trim() || "unit";
  }

  if (input.reorderLevel !== undefined) {
    if (input.reorderLevel < 0) {
      throw new Error("Reorder level cannot be negative.");
    }
    payload.reorder_level = input.reorderLevel;
  }

  if (input.isActive !== undefined) {
    payload.is_active = input.isActive;
  }

  const { error } = await supabase
    .from("inventory_items")
    .update(payload)
    .eq("id", item.id);

  if (error) throw new Error(error.message);

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "dispensary.inventory_updated",
    targetType: "inventory_item",
    targetId: item.id,
    details: payload,
  });

  revalidateDispensaryPaths();
}

export async function adjustStock(input: {
  inventoryItemId: string;
  quantityChange: number;
  movementType: Extract<StockMovementType, "receipt" | "adjustment" | "return">;
  reason: string;
}) {
  const { supabase, staff, item } = await getInventoryRecord(input.inventoryItemId);

  if (!canManageInventory(staff.role)) {
    throw new Error("You do not have permission to adjust stock.");
  }

  if (input.quantityChange === 0) {
    throw new Error("Quantity change must not be zero.");
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("A reason is required for stock adjustments.");
  }

  let quantityChange = input.quantityChange;
  if (input.movementType === "adjustment" && quantityChange > 0) {
    // Positive adjustments use signed quantity_change as provided.
  } else if (input.movementType === "return" && quantityChange < 0) {
    quantityChange = Math.abs(quantityChange);
  } else if (input.movementType === "receipt" && quantityChange < 0) {
    throw new Error("Receipts must increase stock.");
  }

  const quantityAfter = calculateQuantityAfter(item.quantity_on_hand, quantityChange);
  const now = new Date().toISOString();

  const { error: inventoryError } = await supabase
    .from("inventory_items")
    .update({
      quantity_on_hand: quantityAfter,
      updated_at: now,
    })
    .eq("id", item.id);

  if (inventoryError) throw new Error(inventoryError.message);

  await recordStockMovement({
    supabase,
    clinicId: staff.clinic_id,
    inventoryItemId: item.id,
    movementType: input.movementType,
    quantityChange,
    quantityAfter,
    referenceType: "manual",
    reason,
    recordedBy: staff.id,
  });

  await logAuditEvent({
    clinicId: staff.clinic_id,
    actorStaffId: staff.id,
    action: "dispensary.stock_adjusted",
    targetType: "inventory_item",
    targetId: item.id,
    details: {
      movementType: input.movementType,
      quantityChange,
      quantityAfter,
      reason,
    },
  });

  revalidateDispensaryPaths();
}

export async function createFulfillmentTasksFromEncounterAction(encounterId: string) {
  const staff = await requireActionAccess({
    roles: [...DISPENSARY_ROLES],
    module: "dispensary",
  });

  const fulfillmentIds = await createFulfillmentTasksFromEncounter(
    encounterId,
    staff.clinics?.settings
  );

  if (!fulfillmentIds.length) {
    throw new Error("No fulfillment tasks were created for this encounter.");
  }

  return fulfillmentIds;
}
