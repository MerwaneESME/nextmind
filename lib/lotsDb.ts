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
      const progress =
        typeof row.progress_percentage === "number"
          ? row.progress_percentage
          : tasksTotal > 0
            ? Math.round((tasksDone / tasksTotal) * 100)
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
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Vous devez etre connecte pour creer un lot.");

  // Optional UX pre-check. If RPC fails, we still try the insert.
  try {
    const { data: allowed, error: permError } = await supabase.rpc("can_edit_phase", { p_phase_id: phaseId });
    if (!permError && allowed === false) {
      throw new Error("Acces refuse : vous n'avez pas les droits pour creer un lot dans cette phase.");
    }
  } catch {
    // ignore
  }

  const payload = {
    phase_id: phaseId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    lot_type: input.lotType?.trim() || null,
    company_name: input.companyName?.trim() || null,
    company_contact_name: input.companyContactName?.trim() || null,
    company_contact_email: input.companyContactEmail?.trim() || null,
    company_contact_phone: input.companyContactPhone?.trim() || null,
    responsible_user_id: input.responsibleUserId ?? null,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    budget_estimated: input.budgetEstimated ?? 0,
    status: input.status ?? "planifie",
  };

  const { data, error } = await supabase.from("lots").insert(payload).select("id").single();
  if (error || !data) {
    const message = String((error as any)?.message ?? "").toLowerCase();
    if (message.includes("row-level security") || message.includes("rls")) {
      throw new Error(
        "Creation refusee (RLS). Ton utilisateur (" +
          user.id +
          ") doit etre owner/collaborator (accepted/active) dans project_members du projet, OU phase_manager/can_edit=true dans phase_members pour la phase (" +
          phaseId +
          ")."
      );
    }
    throw error ?? new Error("Lot non cree");
  }

  return data.id as string;
}
export async function updateLot(
  lotId: string,
  patch: Partial<CreateLotInput> & { budgetActual?: number | null; progressPercentage?: number | null }
) {
  const payload: any = {};
  if ("name" in patch && typeof patch.name === "string") payload.name = patch.name.trim();
  if ("description" in patch) payload.description = patch.description?.trim() || null;
  if ("lotType" in patch) payload.lot_type = patch.lotType?.trim() || null;
  if ("companyName" in patch) payload.company_name = patch.companyName?.trim() || null;
  if ("companyContactName" in patch) payload.company_contact_name = patch.companyContactName?.trim() || null;
  if ("companyContactEmail" in patch) payload.company_contact_email = patch.companyContactEmail?.trim() || null;
  if ("companyContactPhone" in patch) payload.company_contact_phone = patch.companyContactPhone?.trim() || null;
  if ("responsibleUserId" in patch) payload.responsible_user_id = patch.responsibleUserId ?? null;
  if ("startDate" in patch) payload.start_date = patch.startDate ?? null;
  if ("endDate" in patch) payload.end_date = patch.endDate ?? null;
  if ("budgetEstimated" in patch) payload.budget_estimated = patch.budgetEstimated ?? 0;
  if ("budgetActual" in patch) payload.budget_actual = patch.budgetActual ?? 0;
  if ("status" in patch && patch.status) payload.status = patch.status;
  if ("progressPercentage" in patch) payload.progress_percentage = patch.progressPercentage ?? 0;

  const { error } = await supabase.from("lots").update(payload).eq("id", lotId);
  if (error) throw error;
}

export async function deleteLot(lotId: string) {
  const { error } = await supabase.from("lots").delete().eq("id", lotId);
  if (error) throw error;
}

