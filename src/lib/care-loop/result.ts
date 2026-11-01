// Server actions return their errors as values: Next.js hides the message of a
// thrown error in production builds, and staff need to see why an action failed.

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function attempt<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

/** Client side: turn a failed result back into an error for the caller's catch. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
