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

async function consumeSSE(
  url: string,
  body: unknown,
  onToken: (token: string) => void
): Promise<{ reply: string; quickActions?: QuickAction[]; conversationId?: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Erreur AI API (${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let doneData: any = null;
  let buffer = "";

  const processChunk = (chunk: string) => {
    buffer += chunk;
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const block of events) {
      const lines = block.split("\n");
      let eventName = "";
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventName = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          dataLines.push(line.slice(6));
        }
      }

      if (eventName === "delta" && dataLines.length > 0) {
        onToken(dataLines.join("\n"));
      } else if (eventName === "done" && dataLines.length > 0) {
        try {
          doneData = JSON.parse(dataLines.join("\n"));
        } catch {}
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    processChunk(decoder.decode(value, { stream: true }));
  }
  if (buffer.trim()) processChunk("\n\n");

  return {
    reply: doneData?.reply ?? "",
    quickActions: doneData?.quick_actions ?? [],
    conversationId: doneData?.conversation_id,
  };
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
 * Envoie un message avec streaming token-par-token.
 * - /chat : SSE natif (tokens en temps réel)
 * - /project-chat : réponse JSON puis simulation mot-par-mot
 */
export async function streamMessageToAI(
  message: string,
  context: AIContext,
  onToken: (token: string) => void
): Promise<AIResponse> {
  const apiUrl = getAiApiUrl();
  const history = buildHistory(context.conversationHistory, 10);
  const contextType =
    context.contextType ??
    (context.lotId ? "lot" : context.phaseId ? "phase" : context.projectId ? "project" : undefined);

  // Project-chat : pas de SSE natif → simulation mot-par-mot
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

    const fullText = data.reply ?? "Je reviens vers vous avec une réponse.";
    const words = fullText.split(" ");
    for (let i = 0; i < words.length; i++) {
      onToken(words[i] + (i < words.length - 1 ? " " : ""));
      await new Promise<void>((r) => setTimeout(r, 20));
    }

    return {
      message: fullText,
      suggestions: (data as any).suggested_questions ?? [],
    };
  }

  // /chat : SSE natif
  const { reply, quickActions, conversationId } = await consumeSSE(
    `${apiUrl}/chat`,
    {
      message,
      stream: true,
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
    },
    onToken
  );

  return {
    message: reply,
    quickActions: quickActions ?? [],
    conversationId: conversationId ?? context.conversationId,
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

function addDaysIsoDate(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function derivePlanningWindowFromMessage(
  message: string,
  defaultWeekStart: string
): { start: string; end: string; weeks: number } | null {
  const normalized = normalizeForMatch(message);

  const wordToNumber: Record<string, number> = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
  };

  let weeks: number | null = null;
  const digitMatch = normalized.match(/(\d+)\s*semaine/);
  if (digitMatch?.[1]) {
    const parsed = Number(digitMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) weeks = parsed;
  }
  if (!weeks) {
    const wordMatch = normalized.match(/\b(un|une|deux|trois|quatre|cinq|six)\s*semaine/);
    if (wordMatch?.[1] && wordToNumber[wordMatch[1]]) weeks = wordToNumber[wordMatch[1]];
  }

  const wantsNextWeek =
    normalized.includes("semaine prochaine") ||
    normalized.includes("la semaine prochaine") ||
    normalized.includes("prochaine semaine");
  const wantsThisWeek = normalized.includes("cette semaine") || normalized.includes("semaine en cours");

  if (!weeks && !wantsNextWeek && !wantsThisWeek) return null;

  const start = wantsNextWeek ? addDaysIsoDate(defaultWeekStart, 7) : defaultWeekStart;
  const finalWeeks = weeks ?? 1;
  const end = addDaysIsoDate(start, finalWeeks * 7 - 1);

  return { start, end, weeks: finalWeeks };
}

function enforcePlanningWindow(
  proposal: PlanningProposal,
  window: { start: string; end: string; weeks: number }
): { proposal: PlanningProposal; adjustedCount: number } {
  let adjustedCount = 0;

  const clamp = (d: string) => {
    if (d < window.start) return window.start;
    if (d > window.end) return window.end;
    return d;
  };

  const normalizeTask = (t: { start_date: string; end_date: string }) => {
    const originalStart = t.start_date;
    const originalEnd = t.end_date;

    t.start_date = clamp(t.start_date);
    t.end_date = clamp(t.end_date);
    if (t.end_date < t.start_date) t.end_date = t.start_date;

    if (t.start_date !== originalStart || t.end_date !== originalEnd) adjustedCount++;
  };

  for (const iv of proposal.existing_interventions) {
    for (const t of iv.suggested_tasks) {
      if (!t.start_date && !t.end_date) continue;
      t.start_date = t.start_date ?? t.end_date;
      t.end_date = t.end_date ?? t.start_date;
      normalizeTask(t as any);
    }
  }
  for (const iv of proposal.suggested_interventions) {
    for (const t of iv.suggested_tasks) {
      if (!t.start_date && !t.end_date) continue;
      t.start_date = t.start_date ?? t.end_date;
      t.end_date = t.end_date ?? t.start_date;
      normalizeTask(t as any);
    }
  }

  if (adjustedCount > 0) {
    const warning = `Certaines dates ont été ajustées pour respecter la fenêtre demandée (${window.start} → ${window.end}).`;
    if (!proposal.warnings.includes(warning)) {
      proposal.warnings = [warning, ...proposal.warnings];
    }
  }

  return { proposal, adjustedCount };
}

/**
 * Parse the AI response to extract a JSON planning proposal.
 * Tries in order: ```json block → raw JSON object → null.
 */
function extractPlanningProposal(reply: string): PlanningProposal | null {
  const candidates: string[] = [];

  // 1. Try ```json ... ``` or ``` ... ``` code fence
  const fenceMatch = reply.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

  // 2. Try raw JSON object (starts with { and ends with })
  const rawMatch = reply.match(/\{[\s\S]*\}/);
  if (rawMatch?.[0]) candidates.push(rawMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
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
      // Try next candidate
    }
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
  const defaultWeekStart = getCurrentWeekStart();
  const planningWindow = derivePlanningWindowFromMessage(message, defaultWeekStart);
  const weekStartForPrompt = planningWindow?.start ?? defaultWeekStart;

  // 1. Build the project context snapshot
  const planningCtx = await buildPlanningContext(projectId);

  // 2. Build the system prompt
  let systemPrompt: string | null = null;
  if (planningCtx) {
    const serialized = serializePlanningContext(planningCtx);
    if (isForcePlan || planningWindow) {
      systemPrompt = buildPlanningSystemPrompt(serialized, weekStartForPrompt, planningWindow);
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

  // 4. Build the enriched user message — embed the planning instruction directly
  //    so it cannot be ignored even if the backend strips system-role messages.
  let enrichedMessage = message;
  if ((isForcePlan || planningWindow) && planningCtx) {
    const serialized = serializePlanningContext(planningCtx);
    enrichedMessage = `${message}

---
 [INSTRUCTION SYSTÈME — PLANNING]
 ${buildPlanningSystemPrompt(serialized, weekStartForPrompt, planningWindow)}
 ---`;
  }

  // 5. Send to backend
  const endpoint =
    context.userRole === "professionnel" ? "/project-chat" : "/project-chat-client";

  const data = await postJson<ProjectChatApiResponse>(`${apiUrl}${endpoint}`, {
    project_id: projectId,
    phase_id: context.phaseId ?? null,
    lot_id: context.lotId ?? null,
    context_type: context.contextType ?? "project",
    user_id: context.userId,
    user_role: context.userRole,
    message: enrichedMessage,
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

  if (proposal && planningWindow) {
    proposal = enforcePlanningWindow(proposal, planningWindow).proposal;
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
