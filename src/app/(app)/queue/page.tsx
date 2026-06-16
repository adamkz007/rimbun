import { QueueBoard } from "@/components/queue/queue-board";
import { requirePageAccess } from "@/lib/auth";
import { getTodayUtcBounds } from "@/lib/queue";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function QueuePage() {
  const staff = await requirePageAccess({
    roles: ["admin", "doctor", "nurse", "receptionist"],
    module: "queue",
  });
  const supabase = await getSupabaseServerClient();
  const { start, end } = getTodayUtcBounds();

  const [entriesRes, doctorsRes] = await Promise.all([
    supabase
      .from("queue_entries")
      .select(
        "id, queue_number, status, arrival_type, sort_order, checked_in_at, status_updated_at, notes, encounter_id, assigned_doctor_id, patients(id, full_name, mrn), assigned_doctor:assigned_doctor_id(id, full_name)"
      )
      .eq("clinic_id", staff.clinic_id)
      .gte("checked_in_at", start)
      .lt("checked_in_at", end)
      .order("sort_order", { ascending: true })
      .order("checked_in_at", { ascending: true }),
    supabase
      .from("staff")
      .select("id, full_name")
      .eq("clinic_id", staff.clinic_id)
      .eq("role", "doctor")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);

  if (entriesRes.error) {
    throw new Error(entriesRes.error.message);
  }

  if (doctorsRes.error) {
    throw new Error(doctorsRes.error.message);
  }

  return (
    <QueueBoard
      entries={entriesRes.data ?? []}
      doctors={doctorsRes.data ?? []}
      staffRole={staff.role}
      staffId={staff.id}
    />
  );
}
