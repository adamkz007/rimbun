"use client";

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  filterLowStockItems,
  getStockMovementTypeLabel,
  sortInventoryItems,
  stockMovementBadgeVariant,
  sumStockMovementsByType,
} from "@/lib/dispensary";
import type { InventoryPanelItem } from "@/components/dispensary/inventory-panel";
import type { StockMovementType, Tables } from "@/types/database";

type StaffSummary = {
  full_name: string;
};

export type StockMovementItem = Pick<
  Tables<"stock_movements">,
  | "id"
  | "movement_type"
  | "quantity_change"
  | "quantity_after"
  | "reason"
  | "recorded_at"
> & {
  inventory_items:
    | Pick<Tables<"inventory_items">, "id" | "name" | "unit">
    | Array<Pick<Tables<"inventory_items">, "id" | "name" | "unit">>
    | null;
  staff:
    | StaffSummary
    | StaffSummary[]
    | null;
};

type StockReportProps = {
  inventoryItems: InventoryPanelItem[];
  movements: StockMovementItem[];
};

export function StockReport({ inventoryItems, movements }: StockReportProps) {
  const lowStockItems = filterLowStockItems(inventoryItems);
  const totals = sumStockMovementsByType(movements);
  const sortedInventory = sortInventoryItems(inventoryItems.filter((item) => item.is_active));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Stock reports</h2>
        <p className="text-sm text-muted-foreground">
          Reconcile inventory levels against recent stock movements.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {(Object.keys(totals) as StockMovementType[]).map((type) => (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {getStockMovementTypeLabel(type)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totals[type]}</p>
              <p className="text-xs text-muted-foreground">Units moved</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventory reconciliation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedInventory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active inventory items.</p>
          ) : (
            sortedInventory.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-1 border-b pb-2 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Reorder at {item.reorder_level} {item.unit}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={lowStockItems.some((entry) => entry.id === item.id) ? "outline" : "secondary"}>
                    {item.quantity_on_hand} {item.unit}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent stock movements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock movements recorded yet.</p>
          ) : (
            movements.map((movement) => {
              const inventory = getFirstRelation(movement.inventory_items);
              const staff = getFirstRelation(movement.staff);

              return (
                <div
                  key={movement.id}
                  className="flex flex-col gap-1 border-b pb-2 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{inventory?.name ?? "Unknown item"}</p>
                      <Badge variant={stockMovementBadgeVariant(movement.movement_type)}>
                        {getStockMovementTypeLabel(movement.movement_type)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {movement.quantity_change > 0 ? "+" : ""}
                      {movement.quantity_change} → {movement.quantity_after}{" "}
                      {inventory?.unit ?? "units"}
                    </p>
                    {movement.reason ? (
                      <p className="text-sm text-muted-foreground">{movement.reason}</p>
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>{format(new Date(movement.recorded_at), "dd MMM yyyy, h:mm a")}</p>
                    {staff ? <p>{staff.full_name}</p> : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getFirstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
