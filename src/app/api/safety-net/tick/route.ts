import { timingSafeEqual } from "node:crypto";
import { getServiceDb } from "@/lib/care-loop/server";
import { processDueFollowups } from "@/lib/safety-net/server";

// Scheduler entry point: sends due check-ins and turns overdue silence into
// nurse calls, for every clinic. Called every 15 minutes by the Netlify
// scheduled function, with a shared secret.

function authorized(request: Request, secret: string) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  const secret = process.env.SAFETY_NET_CRON_SECRET;
  if (!secret) return Response.json({ error: "Scheduler is not configured." }, { status: 503 });
  if (!authorized(request, secret)) return Response.json({ error: "Not authorized." }, { status: 401 });

  try {
    const result = await processDueFollowups(getServiceDb());
    return Response.json(result);
  } catch (error) {
    console.error("safety-net tick failed", error);
    return Response.json({ error: "Scheduler run failed." }, { status: 500 });
  }
}
