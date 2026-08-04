import type {
  FulfillmentStatus,
  StaffRole,
  StockMovementType,
} from "@/types/database";

export const FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  "pending",
  "dispensed",
  "cancelled",
];

export const STOCK_MOVEMENT_TYPES: StockMovementType[] = [
  "receipt",
  "dispense",
  "adjustment",
  "return",
];

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  pending: "Pending",
  dispensed: "Dispensed",
  cancelled: "Cancelled",
};

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  receipt: "Receipt",
  dispense: "Dispense",
  adjustment: "Adjustment",
  return: "Return",
};

export function getFulfillmentStatusLabel(status: FulfillmentStatus) {
  return FULFILLMENT_STATUS_LABELS[status];
}

export function getStockMovementTypeLabel(type: StockMovementType) {
  return STOCK_MOVEMENT_TYPE_LABELS[type];
}

export function fulfillmentStatusBadgeVariant(
  status: FulfillmentStatus
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "dispensed":
      return "default";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

export function isLowStock(input: {
  quantity_on_hand: number;
  reorder_level: number;
}) {
  return input.quantity_on_hand <= input.reorder_level;
}

export function canAccessDispensary(role: StaffRole) {
  return role === "admin" || role === "doctor" || role === "nurse";
}

export function canManageInventory(role: StaffRole) {
  return role === "admin" || role === "nurse";
}

export function canDispenseMedication(role: StaffRole) {
  return role === "admin" || role === "doctor" || role === "nurse";
}

export function canDispenseControlledDrug(role: StaffRole) {
  return role === "admin" || role === "doctor" || role === "nurse";
}

export function requiresControlledWitness(isControlled: boolean) {
  return isControlled;
}

export function validateControlledWitness(input: {
  isControlled: boolean;
  dispenserStaffId: string;
  witnessStaffId?: string | null;
}) {
  if (!input.isControlled) {
    return null;
  }

  if (!input.witnessStaffId) {
    return "Controlled drugs require a witness to verify dispensing.";
  }

  if (input.witnessStaffId === input.dispenserStaffId) {
    return "The witness must be a different staff member.";
  }

  return null;
}

export function canDispenseFulfillment(status: FulfillmentStatus) {
  return status === "pending";
}

export function canCancelFulfillment(status: FulfillmentStatus) {
  return status === "pending";
}

export function calculateQuantityAfter(current: number, change: number) {
  const next = current + change;
  if (next < 0) {
    throw new Error("Insufficient stock for this operation.");
  }

  return next;
}

export function buildPrescriptionSummary(input: {
  drugName: string;
  dosage: string;
  quantityRequested: number;
}) {
  const parts = [input.drugName.trim(), input.dosage.trim()].filter(Boolean);
  parts.push(`Qty ${input.quantityRequested}`);
  return parts.join(" — ");
}

export function sortFulfillments<
  T extends { created_at: string; status: FulfillmentStatus }
>(fulfillments: T[]) {
  const statusOrder: Record<FulfillmentStatus, number> = {
    pending: 0,
    dispensed: 1,
    cancelled: 2,
  };

  return [...fulfillments].sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

export function sortInventoryItems<
  T extends { name: string; quantity_on_hand: number; reorder_level: number }
>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftLow = isLowStock(left);
    const rightLow = isLowStock(right);

    if (leftLow !== rightLow) {
      return leftLow ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function filterLowStockItems<
  T extends { quantity_on_hand: number; reorder_level: number; is_active: boolean }
>(items: T[]) {
  return items.filter((item) => item.is_active && isLowStock(item));
}

export function sumStockMovementsByType(
  movements: Array<{ movement_type: StockMovementType; quantity_change: number }>
) {
  return movements.reduce<Record<StockMovementType, number>>(
    (totals, movement) => {
      totals[movement.movement_type] =
        (totals[movement.movement_type] ?? 0) + Math.abs(movement.quantity_change);
      return totals;
    },
    {
      receipt: 0,
      dispense: 0,
      adjustment: 0,
      return: 0,
    }
  );
}

export function stockMovementBadgeVariant(
  type: StockMovementType
): "default" | "secondary" | "outline" | "destructive" {
  switch (type) {
    case "dispense":
      return "secondary";
    case "adjustment":
      return "outline";
    case "return":
      return "default";
    default:
      return "default";
  }
}
