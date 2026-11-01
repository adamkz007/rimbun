import { createHash, randomBytes } from "node:crypto";

// Secure links for patients and receiving clinicians. Only the SHA-256 hash is
// stored; the raw token exists in the link itself.

export const LINK_TTL_DAYS = 30;

export function hashLinkToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateLinkToken(now: Date = new Date()) {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(now.getTime() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash: hashLinkToken(token), expiresAt };
}

export function isLinkExpired(expiresAt: string | Date, now: Date = new Date()) {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return expiry.getTime() <= now.getTime();
}

/** Tokens are 32 base64url characters; anything else is rejected before a lookup. */
export function isWellFormedToken(token: string) {
  return /^[A-Za-z0-9_-]{32}$/.test(token);
}
