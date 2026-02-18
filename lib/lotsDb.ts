import { supabase } from "@/lib/supabaseClient";

export type LotStatus =
  | "planifie"
  | "devis_en_cours"
  | "devis_valide"
  | "en_cours"
  | "termine"
  | "valide";

export type LotRow = {
  id: string;
  phase_id: string;
  name: string;
  description: string | null;
  lot_type: string | null;
  company_name: string | null;
  company_contact_name: string | null;
  company_contact_email: string | null;
  company_contact_phone: string | null;
  responsible_user_id: string | null;
  start_date: string | null;
  end_date: string | null;
  estimated_duration_days: number | null;
  actual_duration_days: number | null;
  delay_days: number | null;
  budget_estimated: number | string | null;
  budget_actual: number | string | null;
  status: LotStatus | string;
  progress_percentage: number | null;
  created_at: string;
  updated_at: string;
};

export type LotSummary = {
  id: string;
  phaseId: string;
  name: string;
  description: string | null;
  lotType: string | null;
  companyName: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetEstimated: number;
  budgetActual: number;
  status: LotStatus;
  progressPercentage: number;
  tasksDone: number;
  tasksTotal: number;
};

export type CreateLotInput = {
  name: string;
  description?: string | null;
  lotType?: string | null;
  companyName?: string | null;
  companyContactName?: string | null;
  companyContactEmail?: string | null;
  companyContactPhone?: string | null;
  responsibleUserId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  budgetEstimated?: number | null;
  status?: LotStatus;
};

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

export async function fetchLotsForPhase(phaseId: string): Promise<LotSummary[]> {
  const { data, error } = await supabase
    .from("lots")
    .select(
      "id,phase_id,name,description,lot_type,company_name,start_date,end_date,budget_estimated,budget_actual,status,progress_percentage,tasks:lot_tasks(status)"
    )
    .eq("phase_id", phaseId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (
    data?.map((row: any) => {
      const tasks = Array.isArray(row.tasks) ? row.tasks : [];
      const tasksTotal = tasks.length;
      const tasksDone = tasks.filter((t: any) => String(t?.status || "").toLowerCase() === "done").length;
      // Toujours dériver la progression des tâches quand on a des tâches, pour rester cohérent avec la page intervention
      const progress =
        tasksTotal > 0
          ? Math.round((tasksDone / tasksTotal) * 100)
          : typeof row.progress_percentage === "number"
            ? row.progress_percentage
            : 0;
      return {
        id: row.id,
        phaseId: row.phase_id,
        name: row.name,
        description: row.description ?? null,
        lotType: row.lot_type ?? null,
        companyName: row.company_name ?? null,
        startDate: row.start_date ?? null,
        endDate: row.end_date ?? null,
        budgetEstimated: toNumber(row.budget_estimated),
        budgetActual: toNumber(row.budget_actual),
        status: (row.status ?? "planifie") as LotStatus,
        progressPercentage: Math.max(0, Math.min(100, Number(progress) || 0)),
        tasksDone,
        tasksTotal,
      } as LotSummary;
    }) ?? []
  );
}

export async function getLotById(lotId: string): Promise<LotRow | null> {
  const { data, error } = await supabase.from("lots").select("*").eq("id", lotId).maybeSingle();
  if (error) throw error;
  return (data as LotRow | null) ?? null;
}

export async function createLot(phaseId: string, input: CreateLotInput) {
  const { data, error } = await supabase.rpc("rpc_create_lot", {
    p_phase_id: phaseId,
    p_name: input.name.trim(),
    p_description: input.description?.trim() || null,
    p_lot_type: input.lotType?.trim() || null,
    p_company_name: input.companyName?.trim() || null,
    p_company_contact_name: input.companyContactName?.trim() || null,
    p_company_contact_email: input.companyContactEmail?.trim() || null,
    p_company_contact_phone: input.companyContactPhone?.trim() || null,
    p_responsible_user_id: input.responsibleUserId ?? null,
    p_start_date: input.startDate ?? null,
    p_end_date: input.endDate ?? null,
    p_budget_estimated: input.budgetEstimated ?? 0,
    p_status: input.status ?? "planifie",
  });

  if (error) {
    throw new Error(error.message || "Impossible de creer le lot.");
  }

  return data as string;
}
export async function updateLot(
  lotId: string,
  patch: Partial<CreateLotInput> & { budgetActual?: number | null; progressPercentage?: number | null }
) {
  const params: Record<string, unknown> = { p_lot_id: lotId };
  if ("name" in patch && typeof patch.name === "string") params.p_name = patch.name.trim();
  if ("description" in patch) params.p_description = patch.description?.trim() || null;
  if ("lotType" in patch) params.p_lot_type = patch.lotType?.trim() || null;
  if ("companyName" in patch) params.p_company_name = patch.companyName?.trim() || null;
  if ("companyContactName" in patch) params.p_company_contact_name = patch.companyContactName?.trim() || null;
  if ("companyContactEmail" in patch) params.p_company_contact_email = patch.companyContactEmail?.trim() || null;
  if ("companyContactPhone" in patch) params.p_company_contact_phone = patch.companyContactPhone?.trim() || null;
  if ("responsibleUserId" in patch) params.p_responsible_user_id = patch.responsibleUserId ?? null;
  if ("startDate" in patch) params.p_start_date = patch.startDate ?? null;
  if ("endDate" in patch) params.p_end_date = patch.endDate ?? null;
  if ("budgetEstimated" in patch) params.p_budget_estimated = patch.budgetEstimated ?? 0;
  if ("budgetActual" in patch) params.p_budget_actual = patch.budgetActual ?? 0;
  if ("status" in patch && patch.status) params.p_status = patch.status;
  if ("progressPercentage" in patch) params.p_progress_percentage = patch.progressPercentage ?? 0;

  const { error } = await supabase.rpc("rpc_update_lot", params);
  if (error) throw new Error(error.message || "Impossible de modifier le lot.");
}

export async function deleteLot(lotId: string) {
  const { error } = await supabase.rpc("rpc_delete_lot", { p_lot_id: lotId });
  if (error) throw new Error(error.message || "Impossible de supprimer le lot.");
}

/**
 * Fetch all interventions (lots) for a project, across all phases.
 * Used in the simplified Project → Intervention hierarchy.
 */
export async function fetchLotsForProject(projectId: string): Promise<LotSummary[]> {
  const { data: phases, error: phaseError } = await supabase
    .from("phases")
    .select("id")
    .eq("project_id", projectId);

  if (phaseError) throw phaseError;
  if (!phases || phases.length === 0) return [];

  const phaseIds = phases.map((p: any) => p.id);

  const { data, error } = await supabase
    .from("lots")
    .select(
      "id,phase_id,name,description,lot_type,company_name,start_date,end_date,budget_estimated,budget_actual,status,progress_percentage,tasks:lot_tasks(status)"
    )
    .in("phase_id", phaseIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (
    data?.map((row: any) => {
      const tasks = Array.isArray(row.tasks) ? row.tasks : [];
      const tasksTotal = tasks.length;
      const tasksDone = tasks.filter((t: any) => String(t?.status || "").toLowerCase() === "done").length;
      // Toujours dériver la progression des tâches quand on a des tâches (cohérent avec la page intervention et l'aperçu)
      const progress =
        tasksTotal > 0
          ? Math.round((tasksDone / tasksTotal) * 100)
          : typeof row.progress_percentage === "number"
            ? row.progress_percentage
            : 0;
      return {
        id: row.id,
        phaseId: row.phase_id,
        name: row.name,
        description: row.description ?? null,
        lotType: row.lot_type ?? null,
        companyName: row.company_name ?? null,
        startDate: row.start_date ?? null,
        endDate: row.end_date ?? null,
        budgetEstimated: toNumber(row.budget_estimated),
        budgetActual: toNumber(row.budget_actual),
        status: (row.status ?? "planifie") as LotStatus,
        progressPercentage: Math.max(0, Math.min(100, Number(progress) || 0)),
        tasksDone,
        tasksTotal,
      } as LotSummary;
    }) ?? []
  );
}

/**
 * Get or create a default phase for a project.
 * Used to transparently link interventions to a project without
 * exposing the phase layer in the UI.
 */
export async function getOrCreateDefaultPhase(projectId: string): Promise<string> {
  // Look for an existing phase for this project
  const { data: existing, error: fetchError } = await supabase
    .from("phases")
    .select("id")
    .eq("project_id", projectId)
    .order("phase_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing?.id) return existing.id;

  // Create a default phase
  const { data: { user } } = await supabase.auth.getUser();
  const managerId = user?.id ?? null;

  const { data, error } = await supabase
    .from("phases")
    .insert({
      project_id: projectId,
      name: "Principal",
      phase_order: 1,
      status: "en_cours",
      phase_manager_id: managerId,
    })
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("Impossible de créer la phase par défaut.");
  return data.id as string;
}

/**
 * Create an intervention (lot) directly under a project.
 * Auto-resolves the default phase.
 */
export async function createLotForProject(projectId: string, input: CreateLotInput) {
  const phaseId = await getOrCreateDefaultPhase(projectId);
  return createLot(phaseId, input);
}

