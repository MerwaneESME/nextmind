/**
 * Planning Context Builder
 *
 * Aggregates the full project state (interventions, tasks, progress, delays)
 * into a structured snapshot that the AI agent can reason about.
 *
 * This is the key piece that transforms the agent from a passive summariser
 * into a proactive planning assistant: instead of receiving bare IDs, the
 * backend gets a rich, pre-digested picture of the project.
 */

import { supabase } from "@/lib/supabaseClient";
import type { LotSummary } from "@/lib/lotsDb";
import type { LotTask } from "@/lib/lotTasksDb";

// ─── Public types ────────────────────────────────────────────────────────────

export type TaskSnapshot = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  isLate: boolean;
  delayDays: number;
};

export type InterventionSnapshot = {
  id: string;
  name: string;
  lotType: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  progressPercent: number;
  companyName: string | null;
  budgetEstimated: number;
  budgetActual: number;
  tasks: TaskSnapshot[];
};

export type ProjectPlanningContext = {
  project: {
    id: string;
    name: string;
    type: string | null;
    status: string | null;
    address: string | null;
    city: string | null;
    budgetTotal: number | null;
    createdAt: string | null;
  };
  interventions: InterventionSnapshot[];
  stats: {
    totalInterventions: number;
    totalTasks: number;
    tasksDone: number;
    tasksInProgress: number;
    tasksTodo: number;
    tasksLate: number;
    overallProgressPercent: number;
    interventionTypes: string[];
  };
  /** ISO date — the moment the snapshot was taken */
  snapshotDate: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeDelayDays(dueDate: string | null, completedAt: string | null, status: string): { isLate: boolean; delayDays: number } {
  if (!dueDate) return { isLate: false, delayDays: 0 };
  const due = new Date(`${dueDate}T23:59:59`);
  if (Number.isNaN(due.getTime())) return { isLate: false, delayDays: 0 };

  const isDone = status === "done";
  if (isDone && !completedAt) return { isLate: false, delayDays: 0 };

  const reference = completedAt ? new Date(completedAt) : new Date();
  const diffMs = reference.getTime() - due.getTime();
  if (diffMs <= 0) return { isLate: false, delayDays: 0 };

  return { isLate: true, delayDays: Math.ceil(diffMs / (1000 * 60 * 60 * 24)) };
}

// ─── Main builder ────────────────────────────────────────────────────────────

/**
 * Build a full planning context for a project.
 *
 * This fetches interventions (lots) and their tasks from Supabase, then
 * assembles a snapshot the AI agent can use for proactive reasoning.
 */
export async function buildPlanningContext(projectId: string): Promise<ProjectPlanningContext | null> {
  // 1. Fetch the project
  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .select("id,name,project_type,status,address,city,budget_total,created_at")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !projectRow) return null;

  // 2. Fetch phases for this project
  const { data: phases } = await supabase
    .from("phases")
    .select("id")
    .eq("project_id", projectId);

  const phaseIds = (phases ?? []).map((p: { id: string }) => p.id);

  // 3. Fetch all lots (interventions) with embedded task statuses
  let interventions: InterventionSnapshot[] = [];

  if (phaseIds.length > 0) {
    const { data: lotsData } = await supabase
      .from("lots")
      .select(
        "id,phase_id,name,description,lot_type,company_name,start_date,end_date,budget_estimated,budget_actual,status,progress_percentage"
      )
      .in("phase_id", phaseIds)
      .order("created_at", { ascending: true });

    const lots = lotsData ?? [];

    // 4. For each lot, fetch its tasks
    const lotIds = lots.map((l: any) => l.id);
    let allTasks: Record<string, any[]> = {};

    if (lotIds.length > 0) {
      const { data: tasksData } = await supabase
        .from("lot_tasks")
        .select("id,lot_id,title,description,status,due_date,completed_at,order_index")
        .in("lot_id", lotIds)
        .order("order_index", { ascending: true });

      for (const task of tasksData ?? []) {
        const lid = task.lot_id as string;
        if (!allTasks[lid]) allTasks[lid] = [];
        allTasks[lid].push(task);
      }
    }

    interventions = lots.map((lot: any) => {
      const rawTasks = allTasks[lot.id] ?? [];
      const tasks: TaskSnapshot[] = rawTasks.map((t: any) => {
        const { isLate, delayDays } = computeDelayDays(t.due_date, t.completed_at, t.status ?? "todo");
        return {
          id: t.id,
          title: t.title,
          status: t.status ?? "todo",
          dueDate: t.due_date ?? null,
          completedAt: t.completed_at ?? null,
          isLate,
          delayDays,
        };
      });

      const done = tasks.filter((t) => t.status === "done").length;
      const total = tasks.length;
      const progress = total > 0 ? Math.round((done / total) * 100) : (lot.progress_percentage ?? 0);

      return {
        id: lot.id,
        name: lot.name,
        lotType: lot.lot_type ?? null,
        status: lot.status ?? "planifie",
        startDate: lot.start_date ?? null,
        endDate: lot.end_date ?? null,
        progressPercent: progress,
        companyName: lot.company_name ?? null,
        budgetEstimated: Number(lot.budget_estimated) || 0,
        budgetActual: Number(lot.budget_actual) || 0,
        tasks,
      };
    });
  }

  // 5. Also fetch flat project_tasks (legacy tasks not inside lots)
  const { data: projectTasks } = await supabase
    .from("project_tasks")
    .select("id,name,status,start_date,end_date,description,completed_at")
    .eq("project_id", projectId)
    .order("start_date", { ascending: true });

  // Merge legacy project_tasks as a virtual intervention if they exist
  if (projectTasks && projectTasks.length > 0) {
    const legacyTasks: TaskSnapshot[] = projectTasks.map((t: any) => {
      const { isLate, delayDays } = computeDelayDays(
        t.end_date ?? t.start_date,
        t.completed_at,
        t.status ?? "todo"
      );
      return {
        id: t.id,
        title: t.name,
        status: t.status ?? "todo",
        dueDate: t.end_date ?? t.start_date ?? null,
        completedAt: t.completed_at ?? null,
        isLate,
        delayDays,
      };
    });

    const done = legacyTasks.filter((t) => t.status === "done").length;
    const total = legacyTasks.length;

    interventions.push({
      id: "__project_tasks__",
      name: "Tâches générales du projet",
      lotType: null,
      status: done === total ? "termine" : "en_cours",
      startDate: projectTasks[0]?.start_date ?? null,
      endDate: projectTasks[projectTasks.length - 1]?.end_date ?? null,
      progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
      companyName: null,
      budgetEstimated: 0,
      budgetActual: 0,
      tasks: legacyTasks,
    });
  }

  // 6. Compute aggregate stats
  const allTasksList = interventions.flatMap((i) => i.tasks);
  const totalTasks = allTasksList.length;
  const tasksDone = allTasksList.filter((t) => t.status === "done").length;
  const tasksInProgress = allTasksList.filter((t) => t.status === "in_progress").length;
  const tasksTodo = allTasksList.filter((t) => t.status === "todo").length;
  const tasksLate = allTasksList.filter((t) => t.isLate).length;
  const overallProgress = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 0;

  const interventionTypes = [
    ...new Set(
      interventions
        .map((i) => i.lotType ?? i.name)
        .filter(Boolean)
    ),
  ];

  return {
    project: {
      id: projectRow.id,
      name: projectRow.name,
      type: projectRow.project_type ?? null,
      status: projectRow.status ?? null,
      address: projectRow.address ?? null,
      city: projectRow.city ?? null,
      budgetTotal: projectRow.budget_total ? Number(projectRow.budget_total) : null,
      createdAt: projectRow.created_at ?? null,
    },
    interventions,
    stats: {
      totalInterventions: interventions.length,
      totalTasks,
      tasksDone,
      tasksInProgress,
      tasksTodo,
      tasksLate,
      overallProgressPercent: overallProgress,
      interventionTypes,
    },
    snapshotDate: new Date().toISOString(),
  };
}

// ─── Text serialiser (for LLM context injection) ────────────────────────────

/**
 * Convert the planning context into a human-readable text block
 * that can be injected into the system/user prompt sent to the AI backend.
 */
export function serializePlanningContext(ctx: ProjectPlanningContext): string {
  const lines: string[] = [];

  lines.push(`=== ÉTAT DU PROJET ===`);
  lines.push(`Nom : ${ctx.project.name}`);
  if (ctx.project.type) lines.push(`Type : ${ctx.project.type}`);
  lines.push(`Statut : ${ctx.project.status ?? "inconnu"}`);
  if (ctx.project.city) lines.push(`Ville : ${ctx.project.city}`);
  if (ctx.project.budgetTotal) lines.push(`Budget total : ${ctx.project.budgetTotal} €`);
  lines.push(`Date snapshot : ${ctx.snapshotDate.slice(0, 10)}`);
  lines.push("");

  lines.push(`=== AVANCEMENT GLOBAL ===`);
  lines.push(`Interventions : ${ctx.stats.totalInterventions}`);
  lines.push(`Tâches totales : ${ctx.stats.totalTasks} (terminées: ${ctx.stats.tasksDone}, en cours: ${ctx.stats.tasksInProgress}, à faire: ${ctx.stats.tasksTodo})`);
  if (ctx.stats.tasksLate > 0) lines.push(`Tâches en retard : ${ctx.stats.tasksLate}`);
  lines.push(`Progression globale : ${ctx.stats.overallProgressPercent}%`);
  if (ctx.stats.interventionTypes.length > 0) {
    lines.push(`Types d'interventions présents : ${ctx.stats.interventionTypes.join(", ")}`);
  }
  lines.push("");

  if (ctx.interventions.length > 0) {
    lines.push(`=== INTERVENTIONS ET TÂCHES ===`);
    for (const intervention of ctx.interventions) {
      lines.push(`--- Intervention : ${intervention.name} ---`);
      if (intervention.lotType) lines.push(`  Type : ${intervention.lotType}`);
      lines.push(`  Statut : ${intervention.status}`);
      lines.push(`  Progression : ${intervention.progressPercent}%`);
      if (intervention.startDate) lines.push(`  Début : ${intervention.startDate}`);
      if (intervention.endDate) lines.push(`  Fin : ${intervention.endDate}`);
      if (intervention.companyName) lines.push(`  Entreprise : ${intervention.companyName}`);
      if (intervention.budgetEstimated) lines.push(`  Budget estimé : ${intervention.budgetEstimated} €`);

      if (intervention.tasks.length > 0) {
        lines.push(`  Tâches (${intervention.tasks.length}) :`);
        for (const task of intervention.tasks) {
          const lateFlag = task.isLate ? ` [RETARD: ${task.delayDays}j]` : "";
          const dateInfo = task.dueDate ? ` (échéance: ${task.dueDate})` : "";
          lines.push(`    - [${task.status.toUpperCase()}] ${task.title}${dateInfo}${lateFlag}`);
        }
      } else {
        lines.push(`  Tâches : aucune`);
      }
      lines.push("");
    }
  } else {
    lines.push(`=== AUCUNE INTERVENTION CRÉÉE ===`);
    lines.push("");
  }

  return lines.join("\n");
}
