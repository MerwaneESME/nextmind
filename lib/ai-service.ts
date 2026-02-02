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
}

export interface AIContext {
  userId: string;
  userRole: "particulier" | "professionnel";
  projectId?: string;
  conversationHistory?: AIMessage[];
}

export interface AIResponse {
  message: string;
  suggestions?: string[];
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
};

type ProjectChatApiResponse = {
  reply?: string;
  proposal?: unknown | null;
  requires_devis?: boolean;
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
export async function sendMessageToAI(
  message: string,
  context: AIContext
): Promise<AIResponse> {
  const apiUrl = getAiApiUrl();
  const history = buildHistory(context.conversationHistory, 10);

  if (context.projectId) {
    const endpoint =
      context.userRole === "professionnel" ? "/project-chat" : "/project-chat-client";
    const data = await postJson<ProjectChatApiResponse>(`${apiUrl}${endpoint}`, {
      project_id: context.projectId,
      user_id: context.userId,
      user_role: context.userRole,
      message,
      history,
    });

    return {
      message: data.reply ?? "Je reviens vers vous avec une réponse.",
    };
  }

  const data = await postJson<ChatApiResponse>(`${apiUrl}/chat`, {
    message,
    thread_id: `${context.userRole}:${context.userId}`,
    history,
    metadata: {
      user_id: context.userId,
      user_role: context.userRole,
    },
  });

  return {
    message: data.reply ?? data.formatted ?? "Je reviens vers vous avec une réponse.",
  };
}

/**
 * Génère un projet via l'IA
 * 
 * TODO: Remplacer par un appel réel à votre API IA
 */
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
