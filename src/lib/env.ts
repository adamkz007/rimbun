const REQUIRED_PUBLIC_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export function getMissingRequiredEnv() {
  return REQUIRED_PUBLIC_ENV.filter((name) => !process.env[name]?.trim());
}

export function assertRequiredEnv() {
  const missing = getMissingRequiredEnv();

  if (missing.length === 0) {
    return;
  }

  const message = `Missing required environment variables: ${missing.join(", ")}`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }

  console.warn(message);
}
