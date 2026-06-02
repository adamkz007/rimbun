import { getSupabaseServerClient } from "@/lib/supabase/server";

type AuditLogInput = {
  clinicId: string;
  actorStaffId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
};

export async function logAuditEvent({
  clinicId,
  actorStaffId = null,
  action,
  targetType,
  targetId = null,
  details = {},
}: AuditLogInput) {
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase.from("audit_logs").insert({
    clinic_id: clinicId,
    actor_staff_id: actorStaffId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });

  if (error) {
    throw new Error(error.message);
  }
}
