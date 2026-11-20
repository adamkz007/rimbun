"use server";

import { revalidatePath } from "next/cache";
import { attempt } from "@/lib/care-loop/result";
import { getServiceDb } from "@/lib/care-loop/server";
import { handleInbound, loadFollowupByToken } from "@/lib/safety-net/server";
import { isSimulatorEnabled } from "@/lib/safety-net/transport";

// The simulated patient phone. It stands in for the patient's WhatsApp, so it
// acts as the patient: no staff login, identified by the follow-up's link token
// (checked here before any service-role write).

export async function simulatorReply(
  token: string,
  reply: { kind: "button"; questionId: string; value: string } | { kind: "text"; text: string }
) {
  return attempt(async () => {
    if (!isSimulatorEnabled()) throw new Error("The simulated phone is turned off.");
    const db = getServiceDb();
    const followup = await loadFollowupByToken(db, token);
    if (!followup) throw new Error("This conversation no longer exists.");

    const clean =
      reply.kind === "text"
        ? { kind: "text" as const, text: String(reply.text ?? "").slice(0, 1000) }
        : { kind: "button" as const, questionId: String(reply.questionId).slice(0, 60), value: String(reply.value).slice(0, 60) };
    const result = await handleInbound(db, followup, clean);

    revalidatePath(`/wa-sim/${token}`);
    revalidatePath(`/followups/${followup.id}`);
    revalidatePath("/followups");
    return { status: result.status };
  });
}
