// Dates in the clinic's own time zone, so server-rendered and browser-rendered
// text agree and appointments don't shift with the server's UTC clock.

export const CLINIC_TIME_ZONE = process.env.NEXT_PUBLIC_CLINIC_TIME_ZONE || "Asia/Kuala_Lumpur";

function parts(value: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIME_ZONE, ...options }).format(value);
}

function toDate(value: string | Date) {
  // A bare YYYY-MM-DD is a calendar date: anchor it at noon UTC so it never crosses a day boundary.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00Z`);
  return value instanceof Date ? value : new Date(value);
}

/** "10 Nov 2026" */
export function formatClinicDate(value: string | Date) {
  return parts(toDate(value), { day: "2-digit", month: "short", year: "numeric" });
}

/** "10 Nov 2026, 9:30 am". Midnight in the clinic's zone means only the date is known. */
export function formatClinicDateTime(value: string | Date) {
  const date = toDate(value);
  const time = parts(date, { hour: "numeric", minute: "2-digit", hour12: true });
  if (time === "0:00 am" || time === "12:00 am") return formatClinicDate(date);
  return `${formatClinicDate(date)}, ${time}`;
}

/** Today's date in the clinic's zone as YYYY-MM-DD. */
export function clinicToday(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CLINIC_TIME_ZONE }).format(now);
}

/** Midnight at the start of a clinic-local calendar date, as an ISO timestamp. */
export function clinicDateStart(date: string) {
  const probe = new Date(`${date}T00:00:00Z`);
  const local = new Date(probe.toLocaleString("en-US", { timeZone: CLINIC_TIME_ZONE }));
  const offsetMs = local.getTime() - probe.getTime();
  return new Date(probe.getTime() - offsetMs).toISOString();
}
