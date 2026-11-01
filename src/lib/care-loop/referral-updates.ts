import type { Tables } from "@/types/database";
import { clinicDateStart } from "./format";
import { loadCase, transitionCase, updateCase, type Actor, type Db } from "./server";
import { canAdvanceTo, type CaseState } from "./workflow";

export type ReferralUpdate = {
  status: "accepted" | "rejected" | "attended";
  rejectReason?: string | null;
  appointmentOn?: string | null;
  outcomeNote?: string | null;
  attendedOn?: string | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Applies a receiving clinician's response to a referral and moves the case
 * with it. Used by the specialist's secure link and by clinic staff logging a
 * response received by phone or letter.
 */
export async function applyReferralUpdate(
  db: Db,
  referral: Tables<"referrals">,
  actor: Actor,
  input: ReferralUpdate
) {
  const item = await loadCase(db, referral.case_id, referral.clinic_id);
  if (item.state === "closed") throw new Error("This case is already closed.");

  const now = new Date().toISOString();
  const appointmentOn = input.appointmentOn && DATE.test(input.appointmentOn) ? input.appointmentOn : null;
  const attendedOn = input.attendedOn && DATE.test(input.attendedOn) ? input.attendedOn : null;

  if (input.status === "rejected") {
    if (!input.rejectReason?.trim()) throw new Error("Give a reason for declining the referral.");
    if (referral.status === "attended") throw new Error("This referral has already been completed.");
  }
  if (input.status === "attended" && !input.outcomeNote?.trim()) {
    throw new Error("Add the outcome of the appointment.");
  }

  const referralFields =
    input.status === "rejected"
      ? { status: "rejected", reject_reason: input.rejectReason!.trim(), responded_at: now }
      : input.status === "accepted"
        ? { status: appointmentOn ? "booked" : "accepted", appointment_on: appointmentOn, responded_at: now }
        : {
            status: "attended",
            outcome_note: input.outcomeNote!.trim(),
            attended_on: attendedOn ?? now.slice(0, 10),
            responded_at: referral.responded_at ?? now,
          };

  const { error } = await db.from("referrals").update(referralFields).eq("id", referral.id);
  if (error) throw new Error(error.message);

  const eventData = { referralId: referral.id, facility: referral.receiving_facility };

  if (input.status === "rejected") {
    // Back to the owner to re-refer or choose another route.
    const backTo: CaseState = item.acknowledged_at ? "acknowledged" : item.notified_at ? "notified" : "triaged";
    await transitionCase(
      db,
      item,
      backTo,
      actor,
      { type: "referral_rejected", note: input.rejectReason, data: eventData },
      { referral_rejected_at: now }
    );
    return;
  }

  if (input.status === "accepted") {
    // Only a date is known: store clinic-local midnight, which displays as a date.
    const extra = appointmentOn ? { appointment_at: clinicDateStart(appointmentOn) } : {};
    const event = { type: "referral_accepted", data: { ...eventData, appointmentOn } };
    if (canAdvanceTo(item.state, "accepted")) {
      await transitionCase(db, item, "accepted", actor, event, extra);
    } else {
      await updateCase(db, item, actor, extra, event);
    }
    return;
  }

  const careStarted = attendedOn ? clinicDateStart(attendedOn) : now;
  const event = { type: "referral_outcome", note: input.outcomeNote, data: eventData };
  if (canAdvanceTo(item.state, "attended")) {
    await transitionCase(db, item, "attended", actor, event, {
      care_started_at: item.care_started_at ?? careStarted,
    });
  } else {
    await updateCase(db, item, actor, {}, event);
  }
}
