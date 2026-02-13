import { supabase } from "@/lib/supabaseClient";

export type LotTaskStatus = "todo" | "in_progress" | "done";

export type LotTaskRow = {
  id: string;
  lot_id: string;
  title: string;
  description: string | null;
  order_index: number | null;
  status: LotTaskStatus | string;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LotTask = {
  id: string;
  lotId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  status: LotTaskStatus;
  assignedTo: string | null;
  dueDate: string | null;
  completedAt: string | null;
};

export type CreateLotTaskInput = {
  title: string;
  description?: string | null;
  orderIndex?: number;
  dueDate?: string | null;
  status?: LotTaskStatus;
};

export async function fetchLotTasks(lotId: string): Promise<LotTask[]> {
  const { data, error } = await supabase
    .from("lot_tasks")
    .select("id,lot_id,title,description,order_index,status,assigned_to,due_date,completed_at")
    .eq("lot_id", lotId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (
    data?.map((row: any) => ({
      id: row.id,
      lotId: row.lot_id,
      title: row.title,
      description: row.description ?? null,
      orderIndex: Number(row.order_index ?? 0),
      status: (row.status ?? "todo") as LotTaskStatus,
      assignedTo: row.assigned_to ?? null,
      dueDate: row.due_date ?? null,
      completedAt: row.completed_at ?? null,
    })) ?? []
  );
}

export async function createLotTask(lotId: string, input: CreateLotTaskInput) {
  const payload = {
    lot_id: lotId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    order_index: input.orderIndex ?? 0,
    status: input.status ?? "todo",
    due_date: input.dueDate ?? null,
  };
  const { data, error } = await supabase.from("lot_tasks").insert(payload).select("id").single();
  if (error || !data) throw error ?? new Error("Tâche non créée");
  return data.id as string;
}

export async function updateLotTask(taskId: string, patch: Partial<CreateLotTaskInput> & { status?: LotTaskStatus; assignedTo?: string | null }) {
  const payload: any = {};
  if ("title" in patch && typeof patch.title === "string") payload.title = patch.title.trim();
  if ("description" in patch) payload.description = patch.description?.trim() || null;
  if ("orderIndex" in patch && typeof patch.orderIndex === "number") payload.order_index = patch.orderIndex;
  if ("dueDate" in patch) payload.due_date = patch.dueDate ?? null;
  if ("status" in patch && patch.status) payload.status = patch.status;
  if ("assignedTo" in patch) payload.assigned_to = patch.assignedTo ?? null;
  if (patch.status === "done") payload.completed_at = new Date().toISOString();
  if (patch.status && patch.status !== "done") payload.completed_at = null;

  const { error } = await supabase.from("lot_tasks").update(payload).eq("id", taskId);
  if (error) throw error;
}

export async function deleteLotTask(taskId: string) {
  const { error } = await supabase.from("lot_tasks").delete().eq("id", taskId);
  if (error) throw error;
}

