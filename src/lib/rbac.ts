import { isModuleEnabled, type AppModule } from "@/lib/modules";
import type { ClinicSettings, StaffRole } from "@/types/database";

export type AccessOptions = {
  roles?: StaffRole[];
  module?: AppModule;
};

type RouteAccessRule = AccessOptions & {
  pathPrefix: string;
};

export const STAFF_ROLES: StaffRole[] = ["admin", "doctor", "nurse", "receptionist"];

export const PUBLIC_PATHS = new Set(["/", "/login"]);

const PROTECTED_ROUTE_RULES: RouteAccessRule[] = [
  { pathPrefix: "/dashboard", roles: STAFF_ROLES },
  { pathPrefix: "/clerking", roles: ["doctor", "nurse"], module: "clerking" },
  { pathPrefix: "/patients", roles: STAFF_ROLES },
  { pathPrefix: "/settings", roles: ["admin"] },
  { pathPrefix: "/api/search/patients", roles: STAFF_ROLES },
  { pathPrefix: "/api/search/icd10", roles: ["doctor", "nurse"], module: "clerking" },
  { pathPrefix: "/api/search/drugs", roles: ["doctor", "nurse"], module: "clerking" },
];

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

export function hasRoleAccess(role: StaffRole, roles?: StaffRole[]) {
  if (!roles?.length) {
    return true;
  }

  return roles.includes(role);
}

export function hasModuleAccess(
  clinicSettings: ClinicSettings | null | undefined,
  module?: AppModule
) {
  if (!module) {
    return true;
  }

  return isModuleEnabled(clinicSettings, module);
}

export function hasAccess({
  role,
  clinicSettings,
  access,
}: {
  role: StaffRole;
  clinicSettings: ClinicSettings | null | undefined;
  access?: AccessOptions | null;
}) {
  if (!access) {
    return true;
  }

  return hasRoleAccess(role, access.roles) && hasModuleAccess(clinicSettings, access.module);
}

export function getAccessRuleForPath(pathname: string) {
  return (
    PROTECTED_ROUTE_RULES.find(
      (rule) =>
        pathname === rule.pathPrefix || pathname.startsWith(`${rule.pathPrefix}/`)
    ) ?? null
  );
}

export function canAccessPathname({
  pathname,
  role,
  clinicSettings,
}: {
  pathname: string;
  role: StaffRole;
  clinicSettings: ClinicSettings | null | undefined;
}) {
  return hasAccess({
    role,
    clinicSettings,
    access: getAccessRuleForPath(pathname),
  });
}
