import { createHash } from "node:crypto";

// Fixed-window limits for the public AI endpoints. Counters live in Postgres
// (consume_diagnose_quota) so they hold across serverless instances.

export type DiagnoseCallKind = "follow_up" | "assess";

type Rule = { bucket: string; limit: number; windowSeconds: number; message: string };

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

export const DEFAULT_DAILY_CAP = 500;

export function rulesFor(kind: DiagnoseCallKind, ipKey: string, dailyCap: number): Rule[] {
  const perIp: Rule[] =
    kind === "assess"
      ? [
          { bucket: `ip:${ipKey}:assess:h`, limit: 3, windowSeconds: HOUR, message: "You've reached the limit of 3 summaries per hour." },
          { bucket: `ip:${ipKey}:assess:d`, limit: 10, windowSeconds: DAY, message: "You've reached today's limit of 10 summaries." },
        ]
      : [{ bucket: `ip:${ipKey}:follow_up:h`, limit: 6, windowSeconds: HOUR, message: "You've reached the limit of 6 question sets per hour." }];

  return [
    ...perIp,
    { bucket: "global:d", limit: dailyCap, windowSeconds: DAY, message: "The symptom checker has reached its daily limit." },
  ];
}

export function getClientIp(headers: Headers): string {
  const netlify = headers.get("x-nf-client-connection-ip");
  if (netlify) return netlify.trim();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function parseDailyCap(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_DAILY_CAP;
}

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type QuotaResult =
  | { ok: true }
  | { ok: false; status: 429 | 503; message: string; retryAfterSeconds: number };

function secondsUntilWindowEnd(windowSeconds: number, now: number) {
  const nowSeconds = Math.floor(now / 1000);
  return windowSeconds - (nowSeconds % windowSeconds);
}

/**
 * Consumes one request from every applicable bucket. Fails closed: if the
 * counter store is unreachable the request is refused.
 */
export async function consumeQuota(
  client: RpcClient,
  { kind, ipKey, dailyCap, now = Date.now() }: { kind: DiagnoseCallKind; ipKey: string; dailyCap: number; now?: number }
): Promise<QuotaResult> {
  for (const rule of rulesFor(kind, ipKey, dailyCap)) {
    const { data, error } = await client.rpc("consume_diagnose_quota", {
      p_bucket: rule.bucket,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });

    if (error || typeof data !== "boolean") {
      return { ok: false, status: 503, message: "The symptom checker is temporarily unavailable.", retryAfterSeconds: 60 };
    }
    if (!data) {
      return {
        ok: false,
        status: 429,
        message: `${rule.message} Please try again later.`,
        retryAfterSeconds: secondsUntilWindowEnd(rule.windowSeconds, now),
      };
    }
  }
  return { ok: true };
}
