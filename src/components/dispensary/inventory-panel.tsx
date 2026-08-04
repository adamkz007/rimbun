"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, PackagePlus, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adjustStock,
  createInventoryItem,
  updateInventoryItem,
} from "@/lib/actions/dispensary-actions";
import {
  canManageInventory,
  filterLowStockItems,
  isLowStock,
  sortInventoryItems,
} from "@/lib/dispensary";
import { toast } from "@/lib/toast";
import type { StaffRole, StockMovementType, Tables } from "@/types/database";

export type InventoryPanelItem = Pick<
  Tables<"inventory_items">,
  | "id"
  | "name"
  | "sku"
  | "formulation"
  | "strength"
  | "unit"
  | "quantity_on_hand"
  | "reorder_level"
  | "is_controlled"
  | "is_active"
>;

type InventoryPanelProps = {
  items: InventoryPanelItem[];
  staffRole: StaffRole;
};

const ADJUSTMENT_TYPES: Array<{
  value: Extract<StockMovementType, "receipt" | "adjustment" | "return">;
  label: string;
}> = [
  { value: "receipt", label: "Receipt" },
  { value: "adjustment", label: "Adjustment" },
  { value: "return", label: "Return" },
];

export function InventoryPanel({ items, staffRole }: InventoryPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const canManage = canManageInventory(staffRole);
  const sortedItems = sortInventoryItems(items);
  const lowStockItems = filterLowStockItems(items);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    name: "",
    sku: "",
    formulation: "",
    strength: "",
    unit: "tablet",
    quantityOnHand: "0",
    reorderLevel: "20",
    isControlled: false,
  });

  const [adjustItem, setAdjustItem] = useState<InventoryPanelItem | null>(null);
  const [adjustType, setAdjustType] =
    useState<Extract<StockMovementType, "receipt" | "adjustment" | "return">>("receipt");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);

  function handleCreateItem() {
    setCreateError(null);
    startTransition(async () => {
      try {
        await createInventoryItem({
          name: newItem.name,
          sku: newItem.sku || undefined,
          formulation: newItem.formulation || undefined,
          strength: newItem.strength || undefined,
          unit: newItem.unit || undefined,
          quantityOnHand: Number(newItem.quantityOnHand),
          reorderLevel: Number(newItem.reorderLevel),
          isControlled: newItem.isControlled,
        });
        toast.success("Inventory item created.");
        setCreateOpen(false);
        setNewItem({
          name: "",
          sku: "",
          formulation: "",
          strength: "",
          unit: "tablet",
          quantityOnHand: "0",
          reorderLevel: "20",
          isControlled: false,
        });
        router.refresh();
      } catch (error) {
        setCreateError(error instanceof Error ? error.message : "Unable to create item.");
      }
    });
  }

  function openAdjustDialog(item: InventoryPanelItem) {
    setAdjustItem(item);
    setAdjustType("receipt");
    setAdjustQuantity("");
    setAdjustReason("");
    setAdjustError(null);
  }

  function handleAdjustStock() {
    if (!adjustItem) {
      return;
    }

    setAdjustError(null);
    startTransition(async () => {
      try {
        await adjustStock({
          inventoryItemId: adjustItem.id,
          movementType: adjustType,
          quantityChange: Number(adjustQuantity),
          reason: adjustReason,
        });
        toast.success("Stock updated.");
        setAdjustItem(null);
        router.refresh();
      } catch (error) {
        setAdjustError(error instanceof Error ? error.message : "Unable to adjust stock.");
      }
    });
  }

  function toggleActive(item: InventoryPanelItem) {
    startTransition(async () => {
      try {
        await updateInventoryItem({
          inventoryItemId: item.id,
          isActive: !item.is_active,
        });
        toast.success(item.is_active ? "Item deactivated." : "Item reactivated.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to update item.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inventory</h2>
          <p className="text-sm text-muted-foreground">
            Track stock levels, reorder thresholds, and controlled medications.
          </p>
        </div>
        {canManage ? (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button type="button" />}>
              <PackagePlus className="mr-2 h-4 w-4" />
              Add item
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add inventory item</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="inventory-name">Name</Label>
                  <Input
                    id="inventory-name"
                    value={newItem.name}
                    onChange={(event) =>
                      setNewItem((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="inventory-sku">SKU</Label>
                    <Input
                      id="inventory-sku"
                      value={newItem.sku}
                      onChange={(event) =>
                        setNewItem((current) => ({ ...current, sku: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="inventory-unit">Unit</Label>
                    <Input
                      id="inventory-unit"
                      value={newItem.unit}
                      onChange={(event) =>
                        setNewItem((current) => ({ ...current, unit: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="inventory-qty">Initial quantity</Label>
                    <Input
                      id="inventory-qty"
                      type="number"
                      min={0}
                      value={newItem.quantityOnHand}
                      onChange={(event) =>
                        setNewItem((current) => ({
                          ...current,
                          quantityOnHand: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="inventory-reorder">Reorder level</Label>
                    <Input
                      id="inventory-reorder"
                      type="number"
                      min={0}
                      value={newItem.reorderLevel}
                      onChange={(event) =>
                        setNewItem((current) => ({
                          ...current,
                          reorderLevel: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newItem.isControlled}
                    onChange={(event) =>
                      setNewItem((current) => ({
                        ...current,
                        isControlled: event.target.checked,
                      }))
                    }
                  />
                  Controlled drug
                </label>
                {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
                <div className="flex justify-end">
                  <Button type="button" onClick={handleCreateItem} disabled={isPending}>
                    Create item
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {lowStockItems.length > 0 ? (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              Low stock alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {lowStockItems.map((item) => (
              <Badge key={item.id} variant="outline">
                {item.name}: {item.quantity_on_hand}/{item.reorder_level} {item.unit}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {sortedItems.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No inventory items yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedItems.map((item) => (
            <Card key={item.id} className={!item.is_active ? "opacity-60" : undefined}>
              <CardContent className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.name}</p>
                    {!item.is_active ? <Badge variant="secondary">Inactive</Badge> : null}
                    {item.is_controlled ? <Badge variant="destructive">Controlled</Badge> : null}
                    {isLowStock(item) ? (
                      <Badge variant="outline" className="text-amber-700">
                        Low stock
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.sku ? `SKU ${item.sku} · ` : ""}
                    {item.quantity_on_hand} {item.unit} on hand · Reorder at {item.reorder_level}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openAdjustDialog(item)}
                      disabled={isPending}
                    >
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      Adjust stock
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleActive(item)}
                      disabled={isPending}
                    >
                      {item.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(adjustItem)} onOpenChange={(open) => !open && setAdjustItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
          </DialogHeader>
          {adjustItem ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {adjustItem.name} — current stock {adjustItem.quantity_on_hand}{" "}
                {adjustItem.unit}
              </p>
              <div className="space-y-2">
                <Label htmlFor="adjust-type">Movement type</Label>
                <select
                  id="adjust-type"
                  value={adjustType}
                  onChange={(event) =>
                    setAdjustType(
                      event.target.value as Extract<
                        StockMovementType,
                        "receipt" | "adjustment" | "return"
                      >
                    )
                  }
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  {ADJUSTMENT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-quantity">Quantity change</Label>
                <Input
                  id="adjust-quantity"
                  type="number"
                  value={adjustQuantity}
                  onChange={(event) => setAdjustQuantity(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use negative values for reductions when recording adjustments.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-reason">Reason</Label>
                <Textarea
                  id="adjust-reason"
                  value={adjustReason}
                  onChange={(event) => setAdjustReason(event.target.value)}
                  rows={3}
                />
              </div>
              {adjustError ? <p className="text-sm text-destructive">{adjustError}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAdjustItem(null)}>
                  Close
                </Button>
                <Button type="button" onClick={handleAdjustStock} disabled={isPending}>
                  Save adjustment
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
