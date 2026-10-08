import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { DiagnoseAiError, generateAssessment, generateFollowUps, isFakeAiEnabled } from "./claude.ts";
import { consumeQuota, getClientIp, hashIp, parseDailyCap, type DiagnoseCallKind } from "./rate-limit.ts";
import { evaluateRedFlags } from "./red-flags.ts";
import { requestSchema, type AssessResponse, type FollowUpResponse } from "./schema.ts";

const MAX_BODY_BYTES = 16 * 1024;

function errorResponse(status: number, message: string, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers may omit it
  try {
    return new URL(origin).host === new URL(request.url).host || origin === process.env.NEXT_PUBLIC_SITE_URL;
  } catch {
    return false;
  }
}

async function checkRateLimit(request: Request, kind: DiagnoseCallKind) {
  const salt = process.env.DIAGNOSE_IP_SALT;
  const hasStore = !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!salt;

  if (!hasStore) {
    if (process.env.NODE_ENV === "production") {
      console.error("diagnose: rate limiting is not configured; refusing request");
      return errorResponse(503, "The symptom checker is temporarily unavailable.");
    }
    return null; // local development without a database
  }

  const admin = getSupabaseAdminClient();
  // The generated Database type doesn't resolve RPC args for the admin client,
  // so adapt it to the narrow shape consumeQuota needs.
  const rpcClient = {
    rpc: (fn: string, args: Record<string, unknown>) => admin.rpc(fn as never, args as never),
  };
  const result = await consumeQuota(rpcClient, {
    kind,
    ipKey: hashIp(getClientIp(request.headers), salt),
    dailyCap: parseDailyCap(process.env.DIAGNOSE_DAILY_CAP),
  });

  if (!result.ok) {
    return errorResponse(result.status, result.message, { "Retry-After": String(result.retryAfterSeconds) });
  }
  return null;
}

export async function handleDiagnoseRequest(request: Request, kind: DiagnoseCallKind): Promise<Response> {
  if (!isSameOrigin(request)) {
    return errorResponse(403, "Requests must come from the symptom checker page.");
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return errorResponse(413, "That request is too large.");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return errorResponse(400, "The request could not be read.");
  }

  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, "Some answers are missing or invalid. Please go back and check them.");
  }

  const { answers, acknowledgedEmergency } = parsed.data;
  const redFlags = evaluateRedFlags(answers);

  if (redFlags.length && !acknowledgedEmergency) {
    const body: AssessResponse | FollowUpResponse = { kind: "emergency", redFlags };
    return Response.json(body);
  }

  const limited = await checkRateLimit(request, kind);
  if (limited) return limited;

  try {
    if (kind === "follow_up") {
      const body: FollowUpResponse = { kind: "follow_up", followUps: await generateFollowUps(answers) };
      return Response.json(body);
    }

    const assessment = await generateAssessment(answers);
    // Deterministic red flags always win over the model's urgency.
    if (redFlags.length) assessment.urgency = "emergency";
    const body: AssessResponse = { kind: "assessment", assessment, redFlags };
    return Response.json(body, { headers: isFakeAiEnabled() ? { "x-diagnose-fake-ai": "1" } : undefined });
  } catch (error) {
    if (error instanceof DiagnoseAiError) {
      return errorResponse(error.status, error.message);
    }
    console.error("diagnose: unexpected error", error);
    return errorResponse(500, "Something went wrong. Please try again.");
  }
}
