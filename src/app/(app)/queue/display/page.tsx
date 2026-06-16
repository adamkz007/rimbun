import { WaitingRoomDisplay } from "@/components/queue/waiting-room-display";
import { requirePageAccess } from "@/lib/auth";
import { getTodayUtcBounds } from "@/lib/queue";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function QueueDisplayPage() {
  const staff = await requirePageAccess({
    roles: ["admin", "doctor", "nurse", "receptionist"],
    module: "queue",
  });
  const supabase = await getSupabaseServerClient();
  const { start, end } = getTodayUtcBounds();

  const { data, error } = await supabase
    .from("queue_entries")
    .select("id, queue_number, status, sort_order, checked_in_at, patients(full_name, mrn)")
    .eq("clinic_id", staff.clinic_id)
    .gte("checked_in_at", start)
    .lt("checked_in_at", end)
    .in("status", ["waiting", "with_nurse", "with_doctor"])
    .order("sort_order", { ascending: true })
    .order("checked_in_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <WaitingRoomDisplay
      clinicName={staff.clinics?.name ?? "Clinic queue"}
      entries={data ?? []}
    />
  );
}
