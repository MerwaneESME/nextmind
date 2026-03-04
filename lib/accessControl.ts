import type { PhaseMember } from "@/lib/phaseMembersDb";

export type ProjectMemberRole = "owner" | "collaborator" | "client";

export type AccessAction = "read" | "write";

export function canProjectMemberEditProject(role: string | null | undefined): boolean {
  const r = String(role || "").toLowerCase();
  return r === "owner" || r === "collaborator";
}

export function canReadProject(): boolean {
  return true;
}

export function canEditPhase(params: {
  projectMemberRole: string | null | undefined;
  phaseMembership: PhaseMember | null;
}): boolean {
  if (canProjectMemberEditProject(params.projectMemberRole)) return true;
  if (!params.phaseMembership) return false;
  if (params.phaseMembership.role === "phase_manager") return true;
  return params.phaseMembership.canEdit;
}

export function canReadPhase(params: {
  projectMemberRole: string | null | undefined;
  phaseMembership: PhaseMember | null;
}): boolean {
  if (params.projectMemberRole) return true;
  return Boolean(params.phaseMembership);
}

export function canReadLot(params: {
  projectMemberRole: string | null | undefined;
  phaseMembership: PhaseMember | null;
  lotId: string;
}): boolean {
  if (String(params.projectMemberRole || "").toLowerCase() === "client") return true;
  if (canProjectMemberEditProject(params.projectMemberRole)) return true;
  const m = params.phaseMembership;
  if (!m) return false;
  if (m.role === "phase_manager") return true;
  if (m.canViewOtherLots) return true;
  return m.assignedLots.includes(params.lotId);
}

export function canEditLot(params: {
  projectMemberRole: string | null | undefined;
  phaseMembership: PhaseMember | null;
  lotId: string;
}): boolean {
  if (canProjectMemberEditProject(params.projectMemberRole)) return true;
  const m = params.phaseMembership;
  if (!m) return false;
  if (!m.canEdit && m.role !== "phase_manager") return false;
  if (m.role === "entreprise") return m.assignedLots.includes(params.lotId);
  return true;
}

