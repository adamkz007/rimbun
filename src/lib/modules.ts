import type { ClinicSettings } from "@/types/database";

export type AppModule = keyof NonNullable<ClinicSettings["modules"]>;

const DEFAULT_MODULE_FLAGS: Record<AppModule, boolean> = {
  clerking: true,
  queue: false,
  billing: false,
  dispensary: false,
  attendance: false,
};

export function isModuleEnabled(
  settings: ClinicSettings | null | undefined,
  module: AppModule
) {
  return settings?.modules?.[module] ?? DEFAULT_MODULE_FLAGS[module];
}
