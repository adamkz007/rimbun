import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StaffManagement } from "@/components/settings/staff-management";
import { requirePageAccess } from "@/lib/auth";
import { isModuleEnabled, type AppModule } from "@/lib/modules";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatDistanceToNow } from "date-fns";

const MODULE_LABELS: Record<AppModule, string> = {
  clerking: "Clerking",
  queue: "Queue",
  billing: "Billing",
  dispensary: "Dispensary",
  attendance: "Attendance",
};

export default async function SettingsPage() {
  const staff = await requirePageAccess({ roles: ["admin"] });
  const supabase = await getSupabaseServerClient();

  const [{ data: staffMembers }, { data: auditLogs }] = await Promise.all([
    supabase
      .from("staff")
      .select("id, email, full_name, role, mmc_number, is_active, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("audit_logs")
      .select("id, action, target_type, created_at, actor:actor_staff_id(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const clinicSettings = staff.clinics?.settings ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage staff access and review clinic module availability.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <StaffManagement
          currentStaffId={staff.id}
          staffMembers={staffMembers ?? []}
        />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Module Access</CardTitle>
              <CardDescription>
                Sidebar visibility follows clinic module flags for implemented modules only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(MODULE_LABELS).map(([module, label]) => {
                const enabled = isModuleEnabled(clinicSettings, module as AppModule);

                return (
                  <div key={module} className="flex items-center justify-between text-sm">
                    <span>{label}</span>
                    <Badge variant={enabled ? "secondary" : "outline"}>
                      {enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Audit events for encounter completion and staff access changes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!auditLogs?.length ? (
                <p className="text-sm text-muted-foreground">
                  No audit events recorded yet.
                </p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {(log.actor as { full_name?: string } | null)?.full_name ?? "System"} •{" "}
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
