import { supabase } from "@/lib/supabaseClient";

export type PhaseMemberRole = "entreprise" | "sous_traitant" | "observateur" | "phase_manager";

export type PhaseMemberRow = {
  id: string;
  phase_id: string;
  user_id: string;
  role: PhaseMemberRole | string;
  can_edit: boolean | null;
  can_view_other_lots: boolean | null;
  assigned_lots: string[] | null;
  created_at: string | null;
};

export type PhaseMemberProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  company_name: string | null;
};

export type PhaseMemberWithProfile = PhaseMemberRow & {
  user?: PhaseMemberProfile | null;
};

export type PhaseMember = {
  id: string;
  phaseId: string;
  userId: string;
  role: PhaseMemberRole;
  canEdit: boolean;
  canViewOtherLots: boolean;
  assignedLots: string[];
};

export async function getMyPhaseMembership(phaseId: string, userId: string): Promise<PhaseMember | null> {
  const { data, error } = await supabase
    .from("phase_members")
    .select("id,phase_id,user_id,role,can_edit,can_view_other_lots,assigned_lots")
    .eq("phase_id", phaseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as PhaseMemberRow;
  return {
    id: row.id,
    phaseId: row.phase_id,
    userId: row.user_id,
    role: (row.role || "observateur") as PhaseMemberRole,
    canEdit: Boolean(row.can_edit),
    canViewOtherLots: Boolean(row.can_view_other_lots),
    assignedLots: Array.isArray(row.assigned_lots) ? row.assigned_lots : [],
  };
}

export async function listPhaseMembers(phaseId: string): Promise<PhaseMember[]> {
  const { data, error } = await supabase
    .from("phase_members")
    .select("id,phase_id,user_id,role,can_edit,can_view_other_lots,assigned_lots")
    .eq("phase_id", phaseId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (
    data?.map((r: any) => ({
      id: r.id,
      phaseId: r.phase_id,
      userId: r.user_id,
      role: (r.role || "observateur") as PhaseMemberRole,
      canEdit: Boolean(r.can_edit),
      canViewOtherLots: Boolean(r.can_view_other_lots),
      assignedLots: Array.isArray(r.assigned_lots) ? r.assigned_lots : [],
    })) ?? []
  );
}

export async function listPhaseMembersWithProfiles(phaseId: string): Promise<PhaseMemberWithProfile[]> {
  const { data, error } = await supabase
    .from("phase_members")
    .select("id,phase_id,user_id,role,can_edit,can_view_other_lots,assigned_lots,user:profiles(id,email,full_name,company_name)")
    .eq("phase_id", phaseId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PhaseMemberWithProfile[];
}

export async function upsertPhaseMember(input: {
  phaseId: string;
  userId: string;
  role: PhaseMemberRole;
  canEdit?: boolean;
  canViewOtherLots?: boolean;
  assignedLots?: string[];
}) {
  const payload = {
    phase_id: input.phaseId,
    user_id: input.userId,
    role: input.role,
    can_edit: Boolean(input.canEdit),
    can_view_other_lots: Boolean(input.canViewOtherLots),
    assigned_lots: input.assignedLots ?? [],
  };

  const { data, error } = await supabase
    .from("phase_members")
    .upsert(payload, { onConflict: "phase_id,user_id" })
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("Membre de phase non mis à jour");
  return data.id as string;
}

export async function deletePhaseMember(memberId: string) {
  const { error } = await supabase.from("phase_members").delete().eq("id", memberId);
  if (error) throw error;
}
