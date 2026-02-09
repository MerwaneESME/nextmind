import { supabase } from "@/lib/supabaseClient";

export type PhaseStatus =
  | "planifiee"
  | "devis"
  | "validee"
  | "en_cours"
  | "terminee"
  | "receptionnee";

export type PhaseRow = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  phase_order: number;
  start_date: string | null;
  end_date: string | null;
  estimated_duration_days: number | null;
  budget_estimated: number | string | null;
  budget_actual: number | string | null;
  status: PhaseStatus | string;
  phase_manager_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PhaseSummary = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  phaseOrder: number;
  startDate: string | null;
  endDate: string | null;
  budgetEstimated: number;
  budgetActual: number;
  status: PhaseStatus;
  lotsCount: number;
};

export type CreatePhaseInput = {
  name: string;
  description?: string | null;
  phaseOrder?: number;
  startDate?: string | null;
  endDate?: string | null;
  budgetEstimated?: number | null;
  status?: PhaseStatus;
  phaseManagerId?: string | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

export async function fetchPhasesForProject(projectId: string): Promise<PhaseSummary[]> {
  const { data, error } = await supabase
    .from("phases")
    .select(
      "id,project_id,name,description,phase_order,start_date,end_date,budget_estimated,budget_actual,status,lots:lots(count)"
    )
    .eq("project_id", projectId)
    .order("phase_order", { ascending: true });

  if (error) throw error;

  return (
    data?.map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description ?? null,
      phaseOrder: row.phase_order ?? 1,
      startDate: row.start_date ?? null,
      endDate: row.end_date ?? null,
      budgetEstimated: toNumber(row.budget_estimated),
      budgetActual: toNumber(row.budget_actual),
      status: (row.status ?? "planifiee") as PhaseStatus,
      lotsCount: Number(row?.lots?.[0]?.count ?? 0),
    })) ?? []
  );
}

export async function getPhaseById(phaseId: string): Promise<PhaseRow | null> {
  const { data, error } = await supabase.from("phases").select("*").eq("id", phaseId).maybeSingle();
  if (error) throw error;
  return (data as PhaseRow | null) ?? null;
}

export async function createPhase(projectId: string, input: CreatePhaseInput) {
  const payload = {
    project_id: projectId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    phase_order: input.phaseOrder ?? 1,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    budget_estimated: input.budgetEstimated ?? 0,
    status: input.status ?? "planifiee",
    phase_manager_id: input.phaseManagerId ?? null,
  };

  const { data, error } = await supabase.from("phases").insert(payload).select("id").single();
  if (error || !data) throw error ?? new Error("Phase non créée");
  return data.id as string;
}

export async function updatePhase(
  phaseId: string,
  patch: Partial<CreatePhaseInput> & { budgetActual?: number | null; status?: PhaseStatus }
) {
  const payload: any = {};
  if (typeof patch.name === "string") payload.name = patch.name.trim();
  if ("description" in patch) payload.description = patch.description?.trim() || null;
  if ("phaseOrder" in patch && typeof patch.phaseOrder === "number") payload.phase_order = patch.phaseOrder;
  if ("startDate" in patch) payload.start_date = patch.startDate ?? null;
  if ("endDate" in patch) payload.end_date = patch.endDate ?? null;
  if ("budgetEstimated" in patch) payload.budget_estimated = patch.budgetEstimated ?? 0;
  if ("budgetActual" in patch) payload.budget_actual = patch.budgetActual ?? 0;
  if ("status" in patch && patch.status) payload.status = patch.status;
  if ("phaseManagerId" in patch) payload.phase_manager_id = patch.phaseManagerId ?? null;

  const { error } = await supabase.from("phases").update(payload).eq("id", phaseId);
  if (error) throw error;
}

export async function deletePhase(phaseId: string) {
  const { error } = await supabase.from("phases").delete().eq("id", phaseId);
  if (error) throw error;
}

