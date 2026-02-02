import { supabase } from "@/lib/supabaseClient";

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  projectType: string | null;
  budgetTotal?: number | null;
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

  const mapped =
    data
      ?.map((row) => {
        const project = row.project as ProjectRow | null;
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
      .filter(Boolean) ?? [];

  mapped.sort((a, b) => {
    const aDate = a.updatedAt ?? a.createdAt ?? "";
    const bDate = b.updatedAt ?? b.createdAt ?? "";
    return aDate < bDate ? 1 : -1;
  });

  return mapped;
};

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
