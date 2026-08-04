import { EnquiryWorkspace } from "@/components/enquiry/enquiry-workspace";
import { requirePageAccess } from "@/lib/auth";
import { sortEnquiries, sortReminders } from "@/lib/enquiry";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type EnquiryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EnquiryPage({ searchParams }: EnquiryPageProps) {
  const staff = await requirePageAccess({
    roles: ["admin", "receptionist"],
    module: "enquiry",
  });
  const params = await searchParams;

  const supabase = await getSupabaseServerClient();

  const [enquiriesRes, remindersRes, staffRes] = await Promise.all([
    supabase
      .from("enquiries")
      .select(
        "id, source, status, contact_name, contact_phone, contact_email, subject, notes, scheduled_at, created_at, converted_patient_id, patients(id, full_name, mrn), converted_patients:converted_patient_id(id, full_name, mrn), assigned_staff:assigned_to(full_name)"
      )
      .eq("clinic_id", staff.clinic_id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("enquiry_reminders")
      .select(
        "id, reminder_type, status, notification_channel, remind_at, message, sent_at, enquiries(id, contact_name, subject, source)"
      )
      .eq("clinic_id", staff.clinic_id)
      .order("remind_at", { ascending: true })
      .limit(100),
    supabase
      .from("staff")
      .select("id, full_name")
      .eq("clinic_id", staff.clinic_id)
      .eq("is_active", true)
      .in("role", ["admin", "receptionist"])
      .order("full_name", { ascending: true }),
  ]);

  if (enquiriesRes.error) throw new Error(enquiriesRes.error.message);
  if (remindersRes.error) throw new Error(remindersRes.error.message);
  if (staffRes.error) throw new Error(staffRes.error.message);

  return (
    <EnquiryWorkspace
      enquiries={sortEnquiries(enquiriesRes.data ?? [])}
      reminders={sortReminders(remindersRes.data ?? [])}
      staffOptions={staffRes.data ?? []}
      initialTab={getTabParam(getSingleValue(params.tab))}
      initialStatus={getStatusParam(getSingleValue(params.status))}
      initialSource={getSourceParam(getSingleValue(params.source))}
      initialQuery={getSingleValue(params.q) ?? ""}
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
  if (value === "reminders" || value === "reports") {
    return value;
  }

  return "enquiries" as const;
}

function getStatusParam(value: string | undefined) {
  if (
    value === "new" ||
    value === "in_progress" ||
    value === "scheduled" ||
    value === "converted" ||
    value === "closed" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "all" as const;
}

function getSourceParam(value: string | undefined) {
  if (
    value === "call" ||
    value === "walk_in" ||
    value === "follow_up" ||
    value === "appointment"
  ) {
    return value;
  }

  return "all" as const;
}
