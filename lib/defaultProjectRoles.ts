import type { CustomRole } from "@/lib/memberHelpers";

export const DEFAULT_PROJECT_ROLES: CustomRole[] = [
  {
    id: "base_read",
    name: "Lecture seule",
    color: "#94a3b8",
    permissions: ["read"],
  },
  {
    id: "base_interventions",
    name: "Interventions",
    color: "#3b82f6",
    permissions: ["read", "interventions"],
  },
  {
    id: "base_admin",
    name: "Administrateur",
    color: "#10b981",
    permissions: ["read", "interventions", "admin"],
  },
];

export function mergeWithDefaultProjectRoles(roles?: CustomRole[] | null): CustomRole[] {
  const list = Array.isArray(roles) ? roles : [];
  const byId = new Map<string, CustomRole>();
  for (const r of list) {
    if (r && typeof r.id === "string" && r.id.trim()) byId.set(r.id, r);
  }
  for (const base of DEFAULT_PROJECT_ROLES) {
    if (!byId.has(base.id)) byId.set(base.id, base);
  }
  return Array.from(byId.values());
}

export function mapLegacyInterventionRoleToBaseRoleId(role: string | null | undefined): string | null {
  const normalized = String(role ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "entreprise" || normalized === "sous_traitant") return "base_interventions";
  if (normalized === "observateur") return "base_read";
  return null;
}

