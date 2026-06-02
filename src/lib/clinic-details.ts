import type { Database } from "@/types/database";

export const CLINIC_DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type ClinicDayKey = (typeof CLINIC_DAY_ORDER)[number];

export type ClinicOpeningHours = Database["public"]["Tables"]["clinics"]["Row"]["opening_hours"];

export type ClinicOpeningHoursDay = ClinicOpeningHours[ClinicDayKey];

export const CLINIC_DAY_LABELS: Record<ClinicDayKey, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const DEFAULT_DAY_HOURS = {
  isOpen: false,
  open: "09:00",
  close: "17:00",
} as const;

export function getDefaultOpeningHours(): ClinicOpeningHours {
  return CLINIC_DAY_ORDER.reduce((hours, day) => {
    hours[day] = { ...DEFAULT_DAY_HOURS };
    return hours;
  }, {} as ClinicOpeningHours);
}

export function normalizeOpeningHours(
  openingHours?: Partial<ClinicOpeningHours> | null
): ClinicOpeningHours {
  const defaults = getDefaultOpeningHours();

  for (const day of CLINIC_DAY_ORDER) {
    const value = openingHours?.[day];
    if (!value) {
      continue;
    }

    defaults[day] = {
      isOpen: Boolean(value.isOpen),
      open: isValidTime(value.open) ? value.open : DEFAULT_DAY_HOURS.open,
      close: isValidTime(value.close) ? value.close : DEFAULT_DAY_HOURS.close,
    };
  }

  return defaults;
}

export function isValidTime(value?: string | null) {
  return typeof value === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

export function isOpenAtTime(dayHours: ClinicOpeningHoursDay, now: Date) {
  if (!dayHours.isOpen || !isValidTime(dayHours.open) || !isValidTime(dayHours.close)) {
    return false;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = parseTime(dayHours.open);
  const closeMinutes = parseTime(dayHours.close);

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

export function getOpenStatus(openingHours?: Partial<ClinicOpeningHours> | null, now = new Date()) {
  const hours = normalizeOpeningHours(openingHours);
  const today = getClinicDayKey(now);
  const todayHours = hours[today];

  return {
    today,
    todayHours,
    isOpenNow: isOpenAtTime(todayHours, now),
  };
}

export function formatHoursRange(dayHours: ClinicOpeningHoursDay) {
  if (!dayHours.isOpen) {
    return "Closed";
  }

  if (!isValidTime(dayHours.open) || !isValidTime(dayHours.close)) {
    return "Hours not set";
  }

  return `${dayHours.open} - ${dayHours.close}`;
}

function parseTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getClinicDayKey(now: Date): ClinicDayKey {
  const weekday = now.getDay();

  switch (weekday) {
    case 0:
      return "sunday";
    case 1:
      return "monday";
    case 2:
      return "tuesday";
    case 3:
      return "wednesday";
    case 4:
      return "thursday";
    case 5:
      return "friday";
    default:
      return "saturday";
  }
}
