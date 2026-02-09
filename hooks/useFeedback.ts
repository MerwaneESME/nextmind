"use client";

import { useState, useCallback } from "react";

interface UseFeedbackOptions {
  conversationId: string;
  messageId?: string;
  metadata?: Record<string, any>;
  onSuccess?: (rating: number, comment?: string) => void;
  onError?: (error: Error) => void;
}

interface UseFeedbackReturn {
  isSubmitting: boolean;
  error: string | null;
  submitFeedback: (rating: number, comment?: string, ratingType?: "stars" | "thumbs") => Promise<void>;
  reset: () => void;
}

/**
 * Hook pour gérer la soumission de feedback
 *
 * Simplifie l'utilisation du système de feedback en encapsulant la logique de soumission
 *
 * @example
 * ```tsx
 * const { isSubmitting, error, submitFeedback } = useFeedback({
 *   conversationId: "conv-123",
 *   messageId: "msg-456",
 *   metadata: { intent: "devis", route: "full" },
 *   onSuccess: (rating, comment) => {
 *     console.log("Feedback submitted:", rating, comment);
 *   },
 *   onError: (error) => {
 *     console.error("Error:", error);
 *   },
 * });
 *
 * // Dans votre composant
 * <button onClick={() => submitFeedback(5, "Excellente réponse !")}>
 *   Envoyer feedback
 * </button>
 * ```
 */
export function useFeedback({
  conversationId,
  messageId,
  metadata = {},
  onSuccess,
  onError,
}: UseFeedbackOptions): UseFeedbackReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitFeedback = useCallback(
    async (rating: number, comment?: string, ratingType: "stars" | "thumbs" = "stars") => {
      setIsSubmitting(true);
      setError(null);

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_AI_API_URL}/feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            message_id: messageId,
            rating,
            rating_type: ratingType,
            comment: comment?.trim() || undefined,
            metadata,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "Failed to submit feedback");
        }

        const data = await response.json();

        // Call success callback
        if (onSuccess) {
          onSuccess(rating, comment);
        }

        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
        setError(errorMessage);

        // Call error callback
        if (onError && err instanceof Error) {
          onError(err);
        }

        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [conversationId, messageId, metadata, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsSubmitting(false);
  }, []);

  return {
    isSubmitting,
    error,
    submitFeedback,
    reset,
  };
}

/**
 * Hook pour récupérer les analytics de feedback
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useFeedbackAnalytics({
 *   days: 30,
 *   intent: "devis",
 * });
 *
 * if (isLoading) return <div>Chargement...</div>;
 * if (error) return <div>Erreur: {error}</div>;
 *
 * return (
 *   <div>
 *     <p>Note moyenne: {data.average_rating}</p>
 *     <p>Total: {data.total_feedbacks}</p>
 *   </div>
 * );
 * ```
 */
export function useFeedbackAnalytics({
  days = 30,
  intent,
  route,
  autoFetch = true,
}: {
  days?: number;
  intent?: string;
  route?: string;
  autoFetch?: boolean;
} = {}) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (days) params.append("days", days.toString());
      if (intent) params.append("intent", intent);
      if (route) params.append("route", route);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_AI_API_URL}/analytics/feedback?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const analytics = await response.json();
      setData(analytics);

      return analytics;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [days, intent, route]);

  // Auto-fetch on mount if enabled
  useState(() => {
    if (autoFetch) {
      fetchAnalytics();
    }
  });

  return {
    data,
    isLoading,
    error,
    refetch: fetchAnalytics,
  };
}
