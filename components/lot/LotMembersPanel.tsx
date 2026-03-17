"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabaseClient";
import { formatMemberRole, type CustomRole } from "@/lib/memberHelpers";
import {
  mergeWithDefaultProjectRoles,
  mapLegacyInterventionRoleToBaseRoleId,
} from "@/lib/defaultProjectRoles";
import {
  listPhaseMembersWithProfiles,
  upsertPhaseMember,
  type PhaseMemberRole,
  type PhaseMemberWithProfile,
} from "@/lib/phaseMembersDb";

type ProjectMemberOption = {
  userId: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  projectRole: string | null;
};

const uniq = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export default function LotMembersPanel({
  projectId,
  phaseId,
  lotId,
  canEdit,
}: {
  projectId: string;
  phaseId: string;
  lotId: string;
  canEdit: boolean;
}) {
  const [projectMembers, setProjectMembers] = useState<ProjectMemberOption[]>([]);
  const [phaseMembers, setPhaseMembers] = useState<PhaseMemberWithProfile[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [newRole, setNewRole] = useState<PhaseMemberRole>("collaborator");
  const [newCanEdit, setNewCanEdit] = useState(false);
  const [newCanViewOtherLots, setNewCanViewOtherLots] = useState(false);

  const load = async () => {
    if (!projectId || !phaseId) return;
    setLoading(true);
    setError(null);
    try {
      const [membersRes, phaseRows, projectRes] = await Promise.all([
        supabase
          .from("project_members")
          .select("user_id,role,status,user:profiles!project_members_user_id_fkey(id,full_name,email,avatar_url)")
          .eq("project_id", projectId)
          .in("status", ["accepted", "active"]),
        listPhaseMembersWithProfiles(phaseId),
        supabase.from("projects").select("metadata").eq("id", projectId).maybeSingle(),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (projectRes.error) throw projectRes.error;
      const parsedProjectMembers: ProjectMemberOption[] = (membersRes.data ?? [])
        .map((row: any) => {
          const profile = Array.isArray(row.user) ? row.user[0] : row.user;
          return {
            userId: String(profile?.id ?? row.user_id ?? ""),
            fullName: (profile?.full_name ?? null) as string | null,
            email: (profile?.email ?? null) as string | null,
            avatarUrl: (profile?.avatar_url ?? null) as string | null,
            projectRole: (row.role ?? null) as string | null,
          };
        })
        .filter((m) => m.userId);

      const rolesFromMetadata = (projectRes.data as any)?.metadata?.roles;
      setCustomRoles(mergeWithDefaultProjectRoles(Array.isArray(rolesFromMetadata) ? (rolesFromMetadata as CustomRole[]) : []));
      setProjectMembers(parsedProjectMembers);
      setPhaseMembers(phaseRows);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les membres.");
      setProjectMembers([]);
      setPhaseMembers([]);
      setCustomRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, phaseId]);

  const membersByUserId = useMemo(() => {
    const map = new Map<string, ProjectMemberOption>();
    for (const m of projectMembers) map.set(m.userId, m);
    return map;
  }, [projectMembers]);

  const normalizeRoleValue = (raw: string | null | undefined) => {
    const legacy = mapLegacyInterventionRoleToBaseRoleId(raw);
    if (legacy) return legacy;
    const v = String(raw ?? "").trim();
    if (!v) return "base_read";
    return v;
  };

  const baseRoles = useMemo(() => customRoles.filter((r) => r.id.startsWith("base_")), [customRoles]);
  const extraRoles = useMemo(() => customRoles.filter((r) => !r.id.startsWith("base_")), [customRoles]);

  const assignedMembers = useMemo(() => {
    const list = phaseMembers.filter((m) => {
      const role = String(m.role ?? "").toLowerCase();
      if (role === "phase_manager") return true;
      if (m.can_view_other_lots) return true;
      const assigned = Array.isArray(m.assigned_lots) ? m.assigned_lots : [];
      return assigned.includes(lotId);
    });

    return list.sort((a, b) => {
      const aName = String(a.user?.full_name ?? a.user?.email ?? "").toLowerCase();
      const bName = String(b.user?.full_name ?? b.user?.email ?? "").toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [phaseMembers, lotId]);

  const unassignedProjectMembers = useMemo(() => {
    const already = new Set(assignedMembers.map((m) => m.user_id));
    return projectMembers.filter((m) => !already.has(m.userId));
  }, [assignedMembers, projectMembers]);

  const upsertWithLots = async (input: {
    userId: string;
    role: PhaseMemberRole;
    canEditValue: boolean;
    canViewOtherLotsValue: boolean;
    assignedLots: string[];
  }) => {
    await upsertPhaseMember({
      phaseId,
      userId: input.userId,
      role: input.role,
      canEdit: input.canEditValue,
      canViewOtherLots: input.canViewOtherLotsValue,
      assignedLots: input.assignedLots,
    });
  };

  const handleAddToLot = async () => {
    if (!canEdit) return;
    const userId = selectedUserId;
    if (!userId) return;
    setSavingUserId(userId);
    setError(null);
    try {
      const existing = phaseMembers.find((m) => m.user_id === userId) ?? null;
      const existingAssigned = Array.isArray(existing?.assigned_lots) ? existing!.assigned_lots : [];
      const nextAssigned = uniq([...existingAssigned, lotId]);

      await upsertWithLots({
        userId,
        role: existing ? (normalizeRoleValue(existing.role) as PhaseMemberRole) : (newRole as PhaseMemberRole),
        canEditValue: existing ? Boolean(existing.can_edit) : Boolean(newCanEdit),
        canViewOtherLotsValue: existing ? Boolean(existing.can_view_other_lots) : Boolean(newCanViewOtherLots),
        assignedLots: nextAssigned,
      });

      setSelectedUserId("");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'ajouter le membre.");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleRemoveFromLot = async (member: PhaseMemberWithProfile) => {
    if (!canEdit) return;
    const userId = member.user_id;
    const role = String(member.role ?? "").toLowerCase();
    if (role === "phase_manager") return;
    setSavingUserId(userId);
    setError(null);
    try {
      const assigned = Array.isArray(member.assigned_lots) ? member.assigned_lots : [];
      const nextAssigned = assigned.filter((id) => id !== lotId);
      await upsertWithLots({
        userId,
        role: normalizeRoleValue(member.role) as PhaseMemberRole,
        canEditValue: Boolean(member.can_edit),
        canViewOtherLotsValue: Boolean(member.can_view_other_lots),
        assignedLots: nextAssigned,
      });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de retirer le membre.");
    } finally {
      setSavingUserId(null);
    }
  };

  const handleUpdateMember = async (
    member: PhaseMemberWithProfile,
    patch: Partial<{ role: PhaseMemberRole; canEdit: boolean; canViewOtherLots: boolean }>
  ) => {
    if (!canEdit) return;
    setSavingUserId(member.user_id);
    setError(null);
    try {
      const assigned = Array.isArray(member.assigned_lots) ? member.assigned_lots : [];
      await upsertWithLots({
        userId: member.user_id,
        role: (patch.role ?? normalizeRoleValue(member.role)) as PhaseMemberRole,
        canEditValue: "canEdit" in patch ? Boolean(patch.canEdit) : Boolean(member.can_edit),
        canViewOtherLotsValue:
          "canViewOtherLots" in patch ? Boolean(patch.canViewOtherLots) : Boolean(member.can_view_other_lots),
        assignedLots: assigned,
      });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de mettre a jour le membre.");
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[2fr_1fr] items-start">
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-gray-900">Membres de l'intervention</div>
            <div className="text-sm text-gray-500">
              {assignedMembers.length} membre{assignedMembers.length !== 1 ? "s" : ""}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Actualiser
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              Chargement...
            </div>
          ) : assignedMembers.length === 0 ? (
            <div className="text-sm text-gray-500">Aucun membre assigné à cette intervention.</div>
          ) : (
            assignedMembers.map((m) => {
              const name = m.user?.full_name || m.user?.email || "Utilisateur";
              const avatarUrl = m.user?.avatar_url ?? null;
              const projectRole = membersByUserId.get(m.user_id)?.projectRole ?? null;
              const roleNormalized = String(m.role ?? "").toLowerCase();
              const isManager = roleNormalized === "phase_manager";
              const normalizedRoleValue = isManager ? "phase_manager" : normalizeRoleValue(m.role ?? null);
              const roleInfo = isManager
                ? { label: "Responsable", color: "bg-indigo-100 text-indigo-700", style: undefined as CSSProperties | undefined }
                : formatMemberRole(normalizedRoleValue, customRoles);
              const assignedLots = Array.isArray(m.assigned_lots) ? m.assigned_lots : [];
              const assignedHere = assignedLots.includes(lotId);

              return (
                <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`Avatar de ${name}`}
                      className="h-11 w-11 rounded-full object-cover shrink-0 border border-white/40 shadow-sm"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-[240px]">
                    <div className="font-semibold text-gray-900 truncate">{name}</div>
                    {(m.user?.email || m.user?.company_name) && (
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        {m.user?.email || m.user?.company_name}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleInfo.color}`} style={roleInfo.style}>
                        {roleInfo.label}
                      </span>
                      {m.can_edit ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Peut modifier</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500">Lecture seule</span>
                      )}
                      {m.can_view_other_lots ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">Toutes interventions</span>
                      ) : assignedHere ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-600">Assigné</span>
                      ) : (
                        <span className="hidden" />
                      )}
                      {projectRole && (() => {
                        const pr = formatMemberRole(projectRole, customRoles);
                        return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-600">Projet: {pr.label}</span>;
                      })()}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <select
                        className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm"
                        value={normalizedRoleValue}
                        disabled={savingUserId === m.user_id || isManager}
                        onChange={(e) => void handleUpdateMember(m, { role: e.target.value as PhaseMemberRole })}
                      >
                        <optgroup label="Rôles de base">
                          {baseRoles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </optgroup>
                        {extraRoles.length > 0 && (
                          <optgroup label="Rôles personnalisés">
                            {extraRoles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Rôles système">
                          <option value="owner">Chef de projet</option>
                          <option value="collaborator">Collaborateur</option>
                          <option value="client">Client</option>
                        </optgroup>
                        <option value="phase_manager" disabled>
                          Responsable (non modifiable ici)
                        </option>
                      </select>

                      <label className="inline-flex items-center gap-2 text-sm text-gray-700 px-2 py-1 rounded-xl border border-gray-100 bg-gray-50">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={Boolean(m.can_edit)}
                          disabled={savingUserId === m.user_id || isManager}
                          onChange={(e) => void handleUpdateMember(m, { canEdit: e.target.checked })}
                        />
                        Modifier
                      </label>

                      <label className="inline-flex items-center gap-2 text-sm text-gray-700 px-2 py-1 rounded-xl border border-gray-100 bg-gray-50">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={Boolean(m.can_view_other_lots)}
                          disabled={savingUserId === m.user_id || isManager}
                          onChange={(e) => void handleUpdateMember(m, { canViewOtherLots: e.target.checked })}
                        />
                        Toutes interventions
                      </label>

                      {!isManager && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                          disabled={savingUserId === m.user_id}
                          onClick={() => void handleRemoveFromLot(m)}
                        >
                          Retirer
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold text-gray-900">Ajouter un membre</div>
          <div className="text-sm text-gray-500">Ajoutez un membre du projet à ce groupe d'intervention.</div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canEdit && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Vous n'avez pas les droits pour modifier les membres.
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Membre</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={selectedUserId}
              disabled={!canEdit || loading || savingUserId !== null}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Sélectionner un membre...</option>
              {unassignedProjectMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {(m.fullName || m.email || m.userId) + (m.email && m.fullName ? ` (${m.email})` : "")}
                </option>
              ))}
            </select>
            {unassignedProjectMembers.length === 0 && (
              <p className="text-xs text-gray-400">Tous les membres du projet ont déjà accès à ce groupe.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Rôle</label>
              <select
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                value={newRole}
                disabled={!canEdit || loading || savingUserId !== null}
                onChange={(e) => setNewRole(e.target.value as PhaseMemberRole)}
              >
                <optgroup label="Rôles de base">
                  {baseRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </optgroup>
                {extraRoles.length > 0 && (
                  <optgroup label="Rôles personnalisés">
                    {extraRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Rôles système">
                  <option value="collaborator">Collaborateur</option>
                  <option value="client">Client</option>
                </optgroup>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Permissions</label>
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={newCanEdit}
                    disabled={!canEdit || loading || savingUserId !== null}
                    onChange={(e) => setNewCanEdit(e.target.checked)}
                  />
                  Peut modifier
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={newCanViewOtherLots}
                    disabled={!canEdit || loading || savingUserId !== null}
                    onChange={(e) => setNewCanViewOtherLots(e.target.checked)}
                  />
                  Accès à toutes les interventions
                </label>
              </div>
            </div>
          </div>

          <Button
            onClick={() => void handleAddToLot()}
            disabled={!canEdit || !selectedUserId || loading || savingUserId !== null}
            className="w-full"
          >
            {savingUserId === selectedUserId ? "Ajout..." : "Ajouter au groupe"}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
