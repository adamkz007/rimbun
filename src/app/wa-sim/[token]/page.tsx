import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimulatedPhone } from "@/components/safety-net/simulated-phone";
import type { ThreadMessage } from "@/components/safety-net/chat-thread";
import { getServiceDb } from "@/lib/care-loop/server";
import { loadFollowupByToken, snapshotOf } from "@/lib/safety-net/server";
import { isSimulatorEnabled } from "@/lib/safety-net/transport";
import { expectedQuestionId } from "@/lib/safety-net/workflow";

export const metadata: Metadata = {
  title: "Simulated patient phone",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SimulatedPhonePage({ params }: { params: Promise<{ token: string }> }) {
  if (!isSimulatorEnabled()) notFound();
  const { token } = await params;
  const db = getServiceDb();
  const followup = await loadFollowupByToken(db, token);
  if (!followup) notFound();

  const [messagesRes, clinicRes, patientRes] = await Promise.all([
    db
      .from("safety_net_messages")
      .select("id, direction, kind, body, question_id, options, created_at")
      .eq("followup_id", followup.id)
      .order("created_at", { ascending: true }),
    db.from("clinics").select("name").eq("id", followup.clinic_id).single(),
    db.from("patients").select("full_name, phone").eq("id", followup.patient_id).single(),
  ]);
  if (messagesRes.error) throw new Error(messagesRes.error.message);

  return (
    <main className="min-h-dvh bg-neutral-200 px-4 py-4 font-sans">
      <div className="mx-auto mb-3 max-w-[380px] text-center text-xs text-neutral-600">
        <p className="font-semibold text-neutral-800">Simulated patient phone</p>
        <p>
          Stands in for {patientRes.data?.full_name ?? "the patient"}&apos;s WhatsApp
          {patientRes.data?.phone ? ` (${patientRes.data.phone})` : ""}. Prototype only: no real message is sent.
        </p>
      </div>
      <SimulatedPhone
        token={token}
        clinicName={clinicRes.data?.name ?? "Clinic"}
        messages={(messagesRes.data ?? []) as ThreadMessage[]}
        activeQuestionId={expectedQuestionId(snapshotOf(followup))}
      />
    </main>
  );
}
