"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface FeedbackButtonsProps {
  conversationId: string;
  messageId?: string;
  metadata?: Record<string, any>;
  onFeedbackSubmitted?: (rating: number) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * FeedbackButtons - Boutons thumbs up/down pour noter les réponses de l'assistant
 *
 * Design: Style NextMind avec couleurs primaires (#38b6ff) et transitions douces
 *
 * @example
 * ```tsx
 * <FeedbackButtons
 *   conversationId="conv-123"
 *   messageId="msg-456"
 *   metadata={{ intent: "devis", route: "full" }}
 *   onFeedbackSubmitted={(rating) => console.log("Rating:", rating)}
 * />
 * ```
 */
export default function FeedbackButtons({
  conversationId,
  messageId,
  metadata = {},
  onFeedbackSubmitted,
  className = "",
  size = "md",
}: FeedbackButtonsProps) {
  const [selected, setSelected] = useState<"up" | "down" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Size variants
  const sizeClasses = {
    sm: "p-1.5 text-sm",
    md: "p-2 text-base",
    lg: "p-3 text-lg",
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  const handleFeedback = async (type: "up" | "down") => {
    if (selected || isSubmitting) return;

    setIsSubmitting(true);
    setSelected(type);

    try {
      const rating = type === "up" ? 5 : 1; // Thumbs up = 5, Thumbs down = 1

      const response = await fetch(`${process.env.NEXT_PUBLIC_AI_API_URL}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message_id: messageId,
          rating,
          rating_type: "thumbs",
          metadata,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      // Call callback if provided
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(rating);
      }

      // Show success toast (optional)
      console.log(`Feedback submitted: ${type}`);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setSelected(null); // Reset on error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Thumbs Up Button */}
      <button
        onClick={() => handleFeedback("up")}
        disabled={selected !== null || isSubmitting}
        className={`
          ${sizeClasses[size]}
          rounded-lg
          border-2
          transition-all
          duration-200
          ease-in-out
          focus:outline-none
          focus:ring-2
          focus:ring-offset-2
          disabled:opacity-50
          disabled:cursor-not-allowed
          ${
            selected === "up"
              ? "bg-green-500 border-green-500 text-white"
              : selected === "down"
              ? "border-neutral-200 text-neutral-400"
              : "border-neutral-300 text-neutral-600 hover:border-green-500 hover:bg-green-50 hover:text-green-600 focus:ring-green-500"
          }
        `}
        aria-label="Thumbs up"
        title="Bonne réponse"
      >
        <ThumbsUp size={iconSizes[size]} strokeWidth={2} />
      </button>

      {/* Thumbs Down Button */}
      <button
        onClick={() => handleFeedback("down")}
        disabled={selected !== null || isSubmitting}
        className={`
          ${sizeClasses[size]}
          rounded-lg
          border-2
          transition-all
          duration-200
          ease-in-out
          focus:outline-none
          focus:ring-2
          focus:ring-offset-2
          disabled:opacity-50
          disabled:cursor-not-allowed
          ${
            selected === "down"
              ? "bg-red-500 border-red-500 text-white"
              : selected === "up"
              ? "border-neutral-200 text-neutral-400"
              : "border-neutral-300 text-neutral-600 hover:border-red-500 hover:bg-red-50 hover:text-red-600 focus:ring-red-500"
          }
        `}
        aria-label="Thumbs down"
        title="Mauvaise réponse"
      >
        <ThumbsDown size={iconSizes[size]} strokeWidth={2} />
      </button>

      {/* Loading indicator */}
      {isSubmitting && (
        <span className="text-xs text-neutral-500 animate-pulse">
          Envoi...
        </span>
      )}
    </div>
  );
}
