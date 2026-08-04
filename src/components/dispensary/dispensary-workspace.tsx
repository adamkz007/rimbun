"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FulfillmentBoard, type FulfillmentBoardItem } from "@/components/dispensary/fulfillment-board";
import { InventoryPanel, type InventoryPanelItem } from "@/components/dispensary/inventory-panel";
import { StockReport, type StockMovementItem } from "@/components/dispensary/stock-report";
import type { StaffRole } from "@/types/database";

type StaffSummary = {
  id: string;
  full_name: string;
};

type DispensaryWorkspaceProps = {
  fulfillments: FulfillmentBoardItem[];
  inventoryItems: InventoryPanelItem[];
  stockMovements: StockMovementItem[];
  staffOptions: StaffSummary[];
  staffRole: StaffRole;
  staffId: string;
  initialTab?: "fulfillment" | "inventory" | "reports";
};

export function DispensaryWorkspace({
  fulfillments,
  inventoryItems,
  stockMovements,
  staffOptions,
  staffRole,
  staffId,
  initialTab = "fulfillment",
}: DispensaryWorkspaceProps) {
  const inventorySummary = inventoryItems.map((item) => ({
    id: item.id,
    name: item.name,
    quantity_on_hand: item.quantity_on_hand,
    unit: item.unit,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dispensary</h1>
        <p className="text-sm text-muted-foreground">
          Fulfill prescriptions, manage inventory, and review stock movements.
        </p>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="fulfillment" className="mt-4">
          <FulfillmentBoard
            fulfillments={fulfillments}
            inventoryItems={inventorySummary}
            staffOptions={staffOptions}
            staffId={staffId}
          />
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <InventoryPanel items={inventoryItems} staffRole={staffRole} />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <StockReport inventoryItems={inventoryItems} movements={stockMovements} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
