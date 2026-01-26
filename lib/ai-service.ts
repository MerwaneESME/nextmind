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

/**
 * Envoie un message à l'agent IA
 * 
 * TODO: Remplacer par un appel réel à votre API IA
 */
export async function sendMessageToAI(
  message: string,
  context: AIContext
): Promise<AIResponse> {
  // Simulation d'une réponse IA
  // À remplacer par: const response = await fetch('/api/ai/chat', { ... })
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        message: "Je comprends votre demande. Comment puis-je vous aider avec votre projet BTP ?",
        suggestions: [
          "Créer un nouveau projet",
          "Consulter mes projets",
          "Trouver un professionnel",
        ],
      });
    }, 1000);
  });
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

