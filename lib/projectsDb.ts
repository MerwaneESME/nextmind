import { supabase } from "@/lib/supabaseClient";

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  projectType: string | null;
  budgetTotal?: number | null;
  phasesCount?: number;
  lotsCount?: number;
  city: string | null;
  address: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  memberStatus?: string | null;
  memberRole?: string | null;
};

export type CreateProjectInput = {
  name: string;
  description?: string | null;
  projectType?: string | null;
  address?: string | null;
  city?: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  project_type: string | null;
  budget_total: number | string | null;
  city: string | null;
  address: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const fetchProjectsForUser = async (userId: string, limit?: number) => {
  let query = supabase
    .from("project_members")
    .select(
      "status,role,project:projects(id,name,description,status,project_type,budget_total,city,address,created_at,updated_at)"
    )
    .eq("user_id", userId)
    .in("status", ["accepted", "active"]);

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const firstOrNull = <T,>(value: T | T[] | null | undefined): T | null => {
    if (!value) return null;
    if (Array.isArray(value)) return (value[0] ?? null) as T | null;
    return value as T;
  };

  const mapped = (data ?? [])
    .map((row) => {
      const project = firstOrNull(row.project as any) as ProjectRow | null;
      if (!project) return null;
      const rawBudget = project.budget_total;
      const budgetTotal =
        typeof rawBudget === "number"
          ? rawBudget
          : typeof rawBudget === "string"
            ? Number(rawBudget)
            : null;
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        projectType: project.project_type,
        budgetTotal: Number.isFinite(budgetTotal) ? budgetTotal : null,
        city: project.city,
        address: project.address,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        memberStatus: row.status ?? null,
        memberRole: row.role ?? null,
      } as ProjectSummary;
    })
    .filter((p): p is ProjectSummary => Boolean(p));

  mapped.sort((a, b) => {
    const aDate = a.updatedAt ?? a.createdAt ?? "";
    const bDate = b.updatedAt ?? b.createdAt ?? "";
    return aDate < bDate ? 1 : -1;
  });

  // Enrich with phase/lot counts (best-effort; never fail list rendering).
  try {
    const ids = mapped.map((p) => p.id).filter(Boolean);
    if (ids.length) {
      const counts = await fetchHierarchyCounts(ids);
      for (const p of mapped) {
        const c = counts[p.id];
        if (c) {
          p.phasesCount = c.phases;
          p.lotsCount = c.lots;
        }
      }
    }
  } catch {
    // ignore
  }

  return mapped;
};

export async function fetchHierarchyCounts(
  projectIds: string[]
): Promise<Record<string, { phases: number; lots: number }>> {
  const ids = (projectIds ?? []).filter(Boolean);
  if (!ids.length) return {};

  const { data: phases, error: phasesError } = await supabase
    .from("phases")
    .select("id,project_id")
    .in("project_id", ids);
  if (phasesError) throw phasesError;

  const result: Record<string, { phases: number; lots: number }> = {};
  const phaseIds: string[] = [];

  for (const row of phases ?? []) {
    const pid = (row as any).project_id as string | undefined;
    const phid = (row as any).id as string | undefined;
    if (!pid || !phid) continue;
    phaseIds.push(phid);
    result[pid] = result[pid] ?? { phases: 0, lots: 0 };
    result[pid].phases += 1;
  }

  if (!phaseIds.length) {
    for (const pid of ids) result[pid] = result[pid] ?? { phases: 0, lots: 0 };
    return result;
  }

  const { data: lots, error: lotsError } = await supabase.from("lots").select("id,phase_id").in("phase_id", phaseIds);
  if (lotsError) throw lotsError;

  const phaseToProject: Record<string, string> = {};
  for (const row of phases ?? []) {
    const pid = (row as any).project_id as string | undefined;
    const phid = (row as any).id as string | undefined;
    if (pid && phid) phaseToProject[phid] = pid;
  }

  for (const l of lots ?? []) {
    const phid = (l as any).phase_id as string | undefined;
    const pid = phid ? phaseToProject[phid] : undefined;
    if (!pid) continue;
    result[pid] = result[pid] ?? { phases: 0, lots: 0 };
    result[pid].lots += 1;
  }

  for (const pid of ids) result[pid] = result[pid] ?? { phases: 0, lots: 0 };
  return result;
}

export const createProject = async (userId: string, input: CreateProjectInput) => {
  const payload = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    project_type: input.projectType?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    created_by: userId,
    status: "draft",
  };

  const { data, error } = await supabase.from("projects").insert(payload).select("id").single();
  if (error || !data) {
    throw error ?? new Error("Failed to create project");
  }

  const { error: memberError } = await supabase
    .from("project_members")
    .upsert(
      {
        project_id: data.id,
        user_id: userId,
        role: "owner",
        status: "accepted",
        invited_by: userId,
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "project_id,user_id" }
    );
  if (memberError) {
    throw memberError;
  }

  return data.id as string;
};

export type ProjectInvite = {
  id: string;
  project_id: string;
  role: string | null;
  status: string | null;
  invited_email: string | null;
  user_id?: string | null;
};

export const inviteProjectMemberByEmail = async (
  userId: string,
  projectId: string,
  email: string,
  role: string = "client"
) => {
  const normalizedEmail = email.trim().toLowerCase();
  let targetUserId: string | null = null;
  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email")
      .ilike("email", normalizedEmail)
      .maybeSingle();
    if (!profileError && profile?.id) {
      targetUserId = profile.id;
    }
  } catch {
    targetUserId = null;
  }

  const payload = {
    project_id: projectId,
    invited_email: normalizedEmail,
    user_id: targetUserId,
    role,
    status: "pending",
    invited_by: userId,
  };

  const { data, error } = await supabase
    .from("project_members")
    .insert(payload)
    .select("id,project_id,role,status,invited_email,user_id")
    .single();
  if (error || !data) {
    throw error ?? new Error("Invitation non cr\u00e9\u00e9e");
  }
  return data as ProjectInvite;
};

export const claimProjectInvites = async (userId: string, email?: string | null) => {
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return [];
  const { data, error } = await supabase
    .from("project_members")
    .update({ user_id: userId })
    .is("user_id", null)
    .ilike("invited_email", normalizedEmail)
    .select("id,project_id");
  if (error) {
    throw error;
  }
  return data ?? [];
};

export const deleteProjectCascade = async (projectId: string) => {
  if (!projectId) {
    throw new Error("Projet manquant.");
  }

  const { data: taskRows, error: tasksError } = await supabase
    .from("project_tasks")
    .select("id")
    .eq("project_id", projectId);
  if (tasksError) {
    throw tasksError;
  }

  const taskIds = (taskRows ?? []).map((row) => row.id).filter(Boolean);
  if (taskIds.length > 0) {
    try {
      await supabase.from("task_learning_events").delete().in("task_id", taskIds);
    } catch {
      // Ignore if table doesn't exist or is not accessible.
    }
  }

  const { error: detachError } = await supabase
    .from("devis")
    .update({ project_id: null })
    .eq("project_id", projectId);
  if (detachError) {
    throw detachError;
  }

  const { error: messagesError } = await supabase
    .from("project_messages")
    .delete()
    .eq("project_id", projectId);
  if (messagesError) {
    throw messagesError;
  }

  const { error: tagsError } = await supabase
    .from("project_tags")
    .delete()
    .eq("project_id", projectId);
  if (tagsError) {
    throw tagsError;
  }

  const { error: tasksDeleteError } = await supabase
    .from("project_tasks")
    .delete()
    .eq("project_id", projectId);
  if (tasksDeleteError) {
    throw tasksDeleteError;
  }

  const { error: membersError } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId);
  if (membersError) {
    throw membersError;
  }

  const { error: projectError } = await supabase.from("projects").delete().eq("id", projectId);
  if (projectError) {
    throw projectError;
  }
};
