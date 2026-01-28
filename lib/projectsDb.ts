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
    .eq("user_id", userId);

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

  return data.id as string;
};

export const inviteProjectMemberByEmail = async (
  userId: string,
  projectId: string,
  email: string,
  role: string = "client"
) => {
  const payload = {
    project_id: projectId,
    invited_email: email.trim(),
    role,
    status: "pending",
    invited_by: userId,
  };

  const { error } = await supabase.from("project_members").insert(payload);
  if (error) {
    throw error;
  }
};
