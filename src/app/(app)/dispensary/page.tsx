import { DispensaryWorkspace } from "@/components/dispensary/dispensary-workspace";
import { requirePageAccess } from "@/lib/auth";
import { sortFulfillments } from "@/lib/dispensary";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type DispensaryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DispensaryPage({ searchParams }: DispensaryPageProps) {
  const staff = await requirePageAccess({
    roles: ["admin", "doctor", "nurse"],
    module: "dispensary",
  });
  const params = await searchParams;
  const initialTab = getTabParam(getSingleValue(params.tab));

  const supabase = await getSupabaseServerClient();

  const [fulfillmentsRes, inventoryRes, movementsRes, staffRes] = await Promise.all([
    supabase
      .from("dispensary_fulfillments")
      .select(
        "id, status, drug_name, dosage, quantity_requested, quantity_dispensed, is_controlled, notes, created_at, dispensed_at, encounter_id, inventory_item_id, patients(id, full_name, mrn), inventory_items(id, name, quantity_on_hand, unit), dispensed_by_staff:dispensed_by(full_name)"
      )
      .eq("clinic_id", staff.clinic_id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("inventory_items")
      .select(
        "id, name, sku, formulation, strength, unit, quantity_on_hand, reorder_level, is_controlled, is_active"
      )
      .eq("clinic_id", staff.clinic_id)
      .order("name", { ascending: true }),
    supabase
      .from("stock_movements")
      .select(
        "id, movement_type, quantity_change, quantity_after, reason, recorded_at, inventory_items(id, name, unit), staff:recorded_by(full_name)"
      )
      .eq("clinic_id", staff.clinic_id)
      .order("recorded_at", { ascending: false })
      .limit(50),
    supabase
      .from("staff")
      .select("id, full_name")
      .eq("clinic_id", staff.clinic_id)
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);

  if (fulfillmentsRes.error) throw new Error(fulfillmentsRes.error.message);
  if (inventoryRes.error) throw new Error(inventoryRes.error.message);
  if (movementsRes.error) throw new Error(movementsRes.error.message);
  if (staffRes.error) throw new Error(staffRes.error.message);

  return (
    <DispensaryWorkspace
      fulfillments={sortFulfillments(fulfillmentsRes.data ?? [])}
      inventoryItems={inventoryRes.data ?? []}
      stockMovements={movementsRes.data ?? []}
      staffOptions={staffRes.data ?? []}
      staffRole={staff.role}
      staffId={staff.id}
      initialTab={initialTab}
    />
  );
}

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getTabParam(value: string | undefined) {
  if (value === "inventory" || value === "reports") {
    return value;
  }

  return "fulfillment" as const;
}
