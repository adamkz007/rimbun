import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import type { Tables } from "@/types/database";

type ClerkingEncounter = Tables<"encounters"> & {
  patients: Pick<Tables<"patients">, "full_name" | "mrn"> | null;
  doctor: Pick<Tables<"staff">, "full_name"> | null;
};

export default async function ClerkingListPage() {
  const staff = await requirePageAccess({
    roles: ["doctor", "nurse"],
    module: "clerking",
  });
  const supabase = await getSupabaseServerClient();

  let encountersQuery = supabase
    .from("encounters")
    .select("*, patients(full_name, mrn), doctor:doctor_id(full_name)")
    .eq("status", "in_progress")
    .order("created_at", { ascending: false });

  encountersQuery =
    staff.role === "doctor"
      ? encountersQuery.eq("doctor_id", staff.id)
      : encountersQuery.eq("clinic_id", staff.clinic_id);

  const { data: encounters } = await encountersQuery;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clerking</h1>
        {staff.role === "doctor" ? (
          <Link href="/patients">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Encounter
            </Button>
          </Link>
        ) : null}
      </div>

      {!encounters?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No active encounters. Start one from the patient list.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {(encounters as ClerkingEncounter[]).map((encounter) => (
            <Link key={encounter.id} href={`/clerking/${encounter.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{encounter.patients?.full_name}</CardTitle>
                    <Badge variant="secondary">In Progress</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    MRN: {encounter.patients?.mrn} | Started{" "}
                    {format(new Date(encounter.created_at), "h:mm a")}
                  </p>
                  {staff.role !== "doctor" ? (
                    <p className="text-xs text-muted-foreground">
                      Doctor: {encounter.doctor?.full_name ?? "Unknown"}
                    </p>
                  ) : null}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
