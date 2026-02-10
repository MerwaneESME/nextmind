/**
 * Service d'intégration pour l'agent IA
 * 
 * Ce service est prêt à être branché à votre API IA existante.
 * Remplacez les fonctions par des appels réels à votre backend.
 */

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
