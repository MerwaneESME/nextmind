/**
 * Service d'intégration pour l'agent IA
 *
 * Ce service est prêt à être branché à votre API IA existante.
 * Remplacez les fonctions par des appels réels à votre backend.
 */

import { buildPlanningContext, serializePlanningContext, type ProjectPlanningContext } from "@/lib/planning-context";
import { buildPlanningSystemPrompt, buildLightPlanningHint, detectPlanningIntent } from "@/lib/planning-prompt";

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  quickActions?: QuickAction[];
  suggestions?: string[];
}

export interface QuickAction {
  id: string;
  label: string;
  type: string;
  icon: string;
}

export interface AIContext {
  userId: string;
  userRole: "particulier" | "professionnel";
  projectId?: string;
  phaseId?: string;
  lotId?: string;
  contextType?: "project" | "phase" | "lot";
  conversationId?: string;
  conversationHistory?: AIMessage[];
}

export interface AIResponse {
  message: string;
  suggestions?: string[];
  quickActions?: QuickAction[];
  conversationId?: string;
  actions?: {
    type: "create_project" | "generate_quote" | "search_products" | "other";
    data?: any;
  };
}

// ─── Planning-specific types ─────────────────────────────────────────────────

export type PlanningExistingTask = {
  task_id: string;
  title: string;
  status: string;
  due_date: string | null;
  note?: string;
};

export type PlanningSuggestedTask = {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
};

export type PlanningExistingIntervention = {
  intervention_id: string;
  intervention_name: string;
  existing_tasks: PlanningExistingTask[];
  suggested_tasks: PlanningSuggestedTask[];
};

export type PlanningSuggestedIntervention = {
  name: string;
  lot_type: string;
  reason: string;
  suggested_tasks: PlanningSuggestedTask[];
};

export type PlanningProposal = {
  summary: string;
  existing_interventions: PlanningExistingIntervention[];
  suggested_interventions: PlanningSuggestedIntervention[];
  warnings: string[];
  next_week_priorities: string[];
};

export type PlanningResponse = {
  message: string;
  proposal: PlanningProposal | null;
  suggestions: string[];
};

type BackendHistoryItem = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatApiResponse = {
  reply?: string;
  formatted?: string;
  quick_actions?: QuickAction[];
  conversation_id?: string | null;
};

type ProjectChatApiResponse = {
  reply?: string;
  proposal?: unknown | null;
  requires_devis?: boolean;
  suggested_questions?: string[] | null;
};

function getAiApiUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_AI_API_URL;
  if (!rawUrl) {
    throw new Error("AI API non configurée (NEXT_PUBLIC_AI_API_URL).");
  }
  return rawUrl.replace(/\/+$/, "");
}

function buildHistory(
  conversationHistory: AIMessage[] | undefined,
  limit: number
): BackendHistoryItem[] | undefined {
  if (!conversationHistory?.length) return undefined;

  return conversationHistory.slice(-limit).map((item) => ({
    role: item.role,
    content: item.content,
  }));
}

async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => null)) as TResponse | null;

  if (!response.ok) {
    const errorMessage =
      (data as any)?.detail ??
      (data as any)?.error ??
      `Erreur AI API (${response.status}).`;
    throw new Error(errorMessage);
  }

  if (!data) {
    throw new Error("Réponse AI API invalide.");
  }

  return data;
}

/**
 * Envoie un message à l'agent IA
 * 
 * TODO: Remplacer par un appel réel à votre API IA
 */
async function postPdf(url: string, body: unknown): Promise<Blob> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `Erreur PDF API (${response.status}).`);
  }

  return await response.blob();
}

export async function sendMessageToAI(
  message: string,
  context: AIContext
): Promise<AIResponse> {
  const apiUrl = getAiApiUrl();
  const history = buildHistory(context.conversationHistory, 10);
  const contextType =
    context.contextType ??
    (context.lotId ? "lot" : context.phaseId ? "phase" : context.projectId ? "project" : undefined);

  if (context.projectId) {
    const endpoint =
      context.userRole === "professionnel" ? "/project-chat" : "/project-chat-client";
    const data = await postJson<ProjectChatApiResponse>(`${apiUrl}${endpoint}`, {
      project_id: context.projectId,
      phase_id: context.phaseId ?? null,
      lot_id: context.lotId ?? null,
      context_type: contextType ?? "project",
      user_id: context.userId,
      user_role: context.userRole,
      message,
      history,
    });

    return {
      message: data.reply ?? "Je reviens vers vous avec une réponse.",
      suggestions: (data as any).suggested_questions ?? [],
    };
  }

  const data = await postJson<ChatApiResponse>(`${apiUrl}/chat`, {
    message,
    thread_id: `${context.userRole}:${context.userId}`,
    conversation_id: context.conversationId,
    history,
    metadata: {
      user_id: context.userId,
      user_role: context.userRole,
      context_type: contextType ?? null,
      project_id: context.projectId ?? null,
      phase_id: context.phaseId ?? null,
      lot_id: context.lotId ?? null,
    },
  });

  return {
    message: data.reply ?? data.formatted ?? "Je reviens vers vous avec une réponse.",
    quickActions: data.quick_actions ?? [],
    conversationId: data.conversation_id ?? context.conversationId,
  };
}

/**
 * Génère un projet via l'IA
 * 
 * TODO: Remplacer par un appel réel à votre API IA
 */
export async function generateChecklistPdf(payload: {
  projectName?: string;
  conversationContext: string;
  query?: string;
}): Promise<Blob> {
  const apiUrl = getAiApiUrl();
  return await postPdf(`${apiUrl}/generate-checklist-pdf`, {
    project_name: payload.projectName ?? null,
    conversation_context: payload.conversationContext,
    query: payload.query ?? null,
  });
}

export async function generateProjectWithAI(
  description: string,
  userId: string
): Promise<{ title: string; description: string; estimatedBudget?: number }> {
  // Simulation
  // À remplacer par: const response = await fetch('/api/ai/generate-project', { ... })
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        title: "Projet généré par IA",
        description,
        estimatedBudget: 5000,
      });
    }, 1500);
  });
}

/**
 * Génère un devis via l'IA
 * 
 * TODO: Remplacer par un appel réel à votre API IA
 */
export async function generateQuoteWithAI(
  projectId: string,
  professionalId: string,
  products?: string[]
): Promise<{ items: any[]; total: number }> {
  // Simulation
  // À remplacer par: const response = await fetch('/api/ai/generate-quote', { ... })
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        items: [],
        total: 0,
      });
    }, 1500);
  });
}

/**
 * Recherche de produits BTP via l'IA
 *
 * TODO: Remplacer par un appel réel à votre API IA
 */
export async function searchProductsWithAI(
  query: string,
  professionalId: string
): Promise<any[]> {
  // Simulation
  // À remplacer par: const response = await fetch('/api/ai/search-products', { ... })

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([]);
    }, 1000);
  });
}

// ─── Enriched planning API ───────────────────────────────────────────────────

/**
 * Get the Monday of the current week as an ISO date string.
 */
function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

/**
 * Parse the AI response to extract a JSON planning proposal from a markdown
 * code fence. Falls back to null if no valid JSON block is found.
 */
function extractPlanningProposal(reply: string): PlanningProposal | null {
  // Try to extract ```json ... ``` block
  const jsonMatch = reply.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (!jsonMatch?.[1]) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1].trim());
    // Basic shape validation
    if (typeof parsed === "object" && parsed !== null && "summary" in parsed) {
      return {
        summary: parsed.summary ?? "",
        existing_interventions: Array.isArray(parsed.existing_interventions) ? parsed.existing_interventions : [],
        suggested_interventions: Array.isArray(parsed.suggested_interventions) ? parsed.suggested_interventions : [],
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        next_week_priorities: Array.isArray(parsed.next_week_priorities) ? parsed.next_week_priorities : [],
      };
    }
  } catch {
    // JSON parse failed — not critical
  }

  return null;
}

/**
 * Build a human-readable planning message from the proposal,
 * used as fallback display text alongside the structured data.
 */
function formatPlanningMessage(proposal: PlanningProposal): string {
  const lines: string[] = [];

  lines.push(`## Planning de la semaine\n`);
  lines.push(proposal.summary);
  lines.push("");

  if (proposal.existing_interventions.length > 0) {
    lines.push(`### Interventions existantes\n`);
    for (const intervention of proposal.existing_interventions) {
      lines.push(`**${intervention.intervention_name}**`);

      if (intervention.existing_tasks.length > 0) {
        for (const task of intervention.existing_tasks) {
          const statusLabel = task.status === "done" ? "Terminée" : task.status === "in_progress" ? "En cours" : "À faire";
          const note = task.note ? ` — ${task.note}` : "";
          lines.push(`- [${statusLabel}] ${task.title}${note}`);
        }
      }

      if (intervention.suggested_tasks.length > 0) {
        for (const task of intervention.suggested_tasks) {
          lines.push(`- **Suggérée** : ${task.title} (${task.start_date} → ${task.end_date})`);
          if (task.description) lines.push(`  _${task.description}_`);
        }
      }
      lines.push("");
    }
  }

  if (proposal.suggested_interventions.length > 0) {
    lines.push(`### Nouvelles interventions suggérées\n`);
    for (const intervention of proposal.suggested_interventions) {
      lines.push(`**${intervention.name}** (${intervention.lot_type})`);
      lines.push(`_Raison : ${intervention.reason}_`);
      for (const task of intervention.suggested_tasks) {
        lines.push(`- ${task.title} (${task.start_date} → ${task.end_date})`);
      }
      lines.push("");
    }
  }

  if (proposal.warnings.length > 0) {
    lines.push(`### Alertes\n`);
    for (const w of proposal.warnings) {
      lines.push(`- ${w}`);
    }
    lines.push("");
  }

  if (proposal.next_week_priorities.length > 0) {
    lines.push(`### Priorités de la semaine\n`);
    for (let i = 0; i < proposal.next_week_priorities.length; i++) {
      lines.push(`${i + 1}. ${proposal.next_week_priorities[i]}`);
    }
  }

  return lines.join("\n");
}

/**
 * Send a planning-enriched message to the AI backend.
 *
 * This function:
 * 1. Builds a full project context snapshot (interventions, tasks, progress)
 * 2. Generates the planning system prompt with the snapshot
 * 3. Sends the enriched payload to the AI backend
 * 4. Parses the response to extract structured planning proposals
 *
 * @param message - The user's message
 * @param context - Standard AI context (userId, projectId, etc.)
 * @param options - forcePlan: always inject planning prompt; history: conversation history
 */
export async function sendPlanningMessageToAI(
  message: string,
  context: AIContext & { forcePlan?: boolean },
  history?: BackendHistoryItem[]
): Promise<PlanningResponse> {
  const apiUrl = getAiApiUrl();
  const projectId = context.projectId;
  if (!projectId) {
    throw new Error("projectId requis pour le mode planning.");
  }

  const isForcePlan = context.forcePlan ?? false;
  const isPlanningIntent = isForcePlan || detectPlanningIntent(message);

  // 1. Build the project context snapshot
  const planningCtx = await buildPlanningContext(projectId);

  // 2. Build the system prompt
  let systemPrompt: string | null = null;
  if (planningCtx) {
    const serialized = serializePlanningContext(planningCtx);
    if (isForcePlan) {
      systemPrompt = buildPlanningSystemPrompt(serialized, getCurrentWeekStart());
    } else if (isPlanningIntent) {
      systemPrompt = buildLightPlanningHint(serialized);
    }
  }

  // 3. Build the enriched history with system prompt injected
  const enrichedHistory: BackendHistoryItem[] = [];
  if (systemPrompt) {
    enrichedHistory.push({ role: "system", content: systemPrompt });
  }
  if (history) {
    enrichedHistory.push(...history);
  }

  // 4. Send to backend
  const endpoint =
    context.userRole === "professionnel" ? "/project-chat" : "/project-chat-client";

  const data = await postJson<ProjectChatApiResponse>(`${apiUrl}${endpoint}`, {
    project_id: projectId,
    phase_id: context.phaseId ?? null,
    lot_id: context.lotId ?? null,
    context_type: context.contextType ?? "project",
    user_id: context.userId,
    user_role: context.userRole,
    message,
    history: enrichedHistory,
    force_plan: isForcePlan,
    // Send the structured context as well for backends that can use it
    planning_context: planningCtx ?? undefined,
  });

  const rawReply = data.reply ?? "Je reviens vers vous avec une proposition.";

  // 5. Try to extract structured proposal from the reply
  let proposal: PlanningProposal | null = null;

  // First, check if the backend returned a structured proposal directly
  if (data.proposal && typeof data.proposal === "object") {
    const p = data.proposal as any;
    if ("summary" in p || "existing_interventions" in p || "suggested_interventions" in p) {
      proposal = {
        summary: p.summary ?? "",
        existing_interventions: Array.isArray(p.existing_interventions) ? p.existing_interventions : [],
        suggested_interventions: Array.isArray(p.suggested_interventions) ? p.suggested_interventions : [],
        warnings: Array.isArray(p.warnings) ? p.warnings : [],
        next_week_priorities: Array.isArray(p.next_week_priorities) ? p.next_week_priorities : [],
      };
    }
  }

  // Fallback: try to parse JSON from the reply text
  if (!proposal) {
    proposal = extractPlanningProposal(rawReply);
  }

  // 6. Build display message
  const displayMessage = proposal
    ? formatPlanningMessage(proposal)
    : rawReply;

  return {
    message: displayMessage,
    proposal,
    suggestions: (data as any).suggested_questions ?? [],
  };
}

/**
 * Enhanced version of sendMessageToAI that automatically detects planning
 * intent and enriches the context when needed.
 *
 * Use this as a drop-in replacement for sendMessageToAI in project contexts.
 */
export async function sendEnrichedMessageToAI(
  message: string,
  context: AIContext & { forcePlan?: boolean }
): Promise<AIResponse & { planningProposal?: PlanningProposal | null }> {
  const isForcePlan = context.forcePlan ?? false;
  const isPlanningIntent = isForcePlan || detectPlanningIntent(message);

  // If planning intent detected and we have a project, use the enriched path
  if (isPlanningIntent && context.projectId) {
    const history = buildHistory(context.conversationHistory, 10);
    const result = await sendPlanningMessageToAI(message, context, history ?? undefined);
    return {
      message: result.message,
      suggestions: result.suggestions,
      planningProposal: result.proposal,
    };
  }

  // Otherwise, use the standard path
  const response = await sendMessageToAI(message, context);
  return { ...response, planningProposal: null };
}
