import type { ClinicSettings } from "@/types/database";

export type AppModule = keyof NonNullable<ClinicSettings["modules"]>;

const DEFAULT_MODULE_FLAGS: Record<AppModule, boolean> = {
  clerking: true,
  queue: false,
  billing: false,
  dispensary: false,
  attendance: false,
  loop: true,
};

export const IMPLEMENTED_MODULES: Record<AppModule, boolean> = {
  clerking: true,
  queue: true,
  billing: false,
  dispensary: false,
  attendance: false,
  loop: true,
};

export function isModuleEnabled(
  settings: ClinicSettings | null | undefined,
  module: AppModule
) {
  return settings?.modules?.[module] ?? DEFAULT_MODULE_FLAGS[module];
}

export function isModuleImplemented(module: AppModule) {
  return IMPLEMENTED_MODULES[module];
}

export function isModuleVisibleInNav(
  settings: ClinicSettings | null | undefined,
  module: AppModule
) {
  return isModuleEnabled(settings, module) && isModuleImplemented(module);
}
