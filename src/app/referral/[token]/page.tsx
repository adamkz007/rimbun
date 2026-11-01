import type { Metadata } from "next";
import { formatClinicDate } from "@/lib/care-loop/format";
import { ReferralResponseForm } from "@/components/care-loop/referral-response";
import { LinkProblem, PublicCard, PublicShell } from "@/components/care-loop/public-shell";
import { URGENCY_LABELS, type Urgency } from "@/lib/care-loop/catalogue";
import { loadReferralLink, markReferralViewed } from "@/lib/care-loop/public-links";

export const metadata: Metadata = {
  title: "Referral",
  robots: { index: false, follow: false },
};

const STATUS_TEXT: Record<string, string> = {
  sent: "Awaiting your response",
  viewed: "Awaiting your response",
  accepted: "Accepted",
  booked: "Accepted, appointment booked",
  rejected: "Declined",
  attended: "Completed, outcome returned",
};

export default async function ReferralPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lookup = await loadReferralLink(token);
  if (lookup.status !== "ok") return <LinkProblem status={lookup.status} />;

  const { referral, item, patientName, clinic } = lookup.data;
  await markReferralViewed(lookup.data);

  return (
    <PublicShell clinicName={clinic.name} subtitle="Referral for specialist review">
      <div className="space-y-4">
        <PublicCard>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold">{patientName}</h1>
              <p className="text-sm text-[#5f7a76]">
                To {referral.receiving_facility}
                {referral.specialty ? ` · ${referral.specialty}` : ""} · sent{" "}
                {formatClinicDate(referral.created_at)}
              </p>
            </div>
            <span className="rounded-full border border-[#d8cfc3] px-3 py-1 text-xs">
              {URGENCY_LABELS[item.urgency as Urgency]}
            </span>
          </div>
          <p className="mt-3 text-sm font-medium">{STATUS_TEXT[referral.status] ?? referral.status}</p>
          {referral.appointment_on ? <p className="text-sm">Appointment {referral.appointment_on}</p> : null}
        </PublicCard>

        <PublicCard>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{referral.letter}</pre>
        </PublicCard>

        {item.state !== "closed" && referral.status !== "attended" && referral.status !== "rejected" ? (
          <ReferralResponseForm
            token={token}
            accepted={referral.status === "accepted" || referral.status === "booked"}
            defaultName={referral.receiving_clinician ?? ""}
          />
        ) : (
          <PublicCard>
            <p className="text-sm">
              {referral.status === "rejected"
                ? "You declined this referral. The referring clinic has been told and will arrange another route."
                : "Thank you. Your response has been sent to the referring clinic, and the loop for this patient is closed on your side."}
            </p>
          </PublicCard>
        )}

        <p className="px-1 text-xs text-[#5f7a76]">
          This secure link expires on {formatClinicDate(referral.expires_at)}. Questions about this
          referral: {clinic.name}
          {clinic.phone ? `, ${clinic.phone}` : ""}.
        </p>
      </div>
    </PublicShell>
  );
}
