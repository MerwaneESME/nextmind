"use client";

import { useState } from "react";
import { X, Star } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  messageId?: string;
  metadata?: Record<string, any>;
  onFeedbackSubmitted?: (rating: number, comment?: string) => void;
}

/**
 * FeedbackModal - Modal pour soumettre un feedback détaillé avec étoiles (1-5) et commentaire
 *
 * Design: Style NextMind avec animations douces et palette de couleurs cohérente
 *
 * @example
 * ```tsx
 * const [isModalOpen, setIsModalOpen] = useState(false);
 *
 * <FeedbackModal
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   conversationId="conv-123"
 *   messageId="msg-456"
 *   metadata={{ intent: "devis", route: "full" }}
 *   onFeedbackSubmitted={(rating, comment) => {
 *     console.log("Rating:", rating, "Comment:", comment);
 *   }}
 * />
 * ```
 */
export default function FeedbackModal({
  isOpen,
  onClose,
  conversationId,
  messageId,
  metadata = {},
  onFeedbackSubmitted,
}: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Veuillez sélectionner une note");
      return;
    }

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
          rating_type: "stars",
          comment: comment.trim() || undefined,
          metadata,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      // Call callback if provided
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(rating, comment.trim() || undefined);
      }

      // Reset and close
      setRating(0);
      setComment("");
      onClose();

      // Show success toast (optional - implement your toast system)
      console.log("Feedback submitted successfully");
    } catch (err) {
      console.error("Error submitting feedback:", err);
      setError("Erreur lors de l'envoi du feedback. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setRating(0);
      setComment("");
      setError(null);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-md pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-neutral-200">
            <h2 className="text-xl font-heading font-bold text-neutral-900">
              Comment était cette réponse ?
            </h2>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors disabled:opacity-50"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Star Rating */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-700">
                Votre note <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    disabled={isSubmitting}
                    className="transition-all duration-150 ease-in-out hover:scale-110 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 rounded"
                    aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
                  >
                    <Star
                      size={32}
                      className={`
                        transition-colors duration-150
                        ${
                          star <= (hoverRating || rating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "fill-transparent text-neutral-300"
                        }
                      `}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-sm text-neutral-600">
                  {rating === 1 && "😞 Très mauvais"}
                  {rating === 2 && "😕 Mauvais"}
                  {rating === 3 && "😐 Moyen"}
                  {rating === 4 && "🙂 Bon"}
                  {rating === 5 && "😄 Excellent"}
                </p>
              )}
            </div>

            {/* Comment Textarea */}
            <div className="space-y-2">
              <label htmlFor="feedback-comment" className="block text-sm font-medium text-neutral-700">
                Commentaire (optionnel)
              </label>
              <textarea
                id="feedback-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={isSubmitting}
                maxLength={1000}
                rows={4}
                placeholder="Partagez vos impressions pour nous aider à améliorer..."
                className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all disabled:bg-neutral-100 disabled:cursor-not-allowed resize-none font-body text-neutral-900 placeholder:text-neutral-400"
              />
              <p className="text-xs text-neutral-500 text-right">
                {comment.length}/1000 caractères
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 bg-neutral-50 rounded-b-xl">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border-2 border-neutral-200 text-neutral-700 font-medium hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || rating === 0}
              className="px-6 py-2 rounded-lg bg-primary-400 text-white font-medium hover:bg-primary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Envoi...
                </span>
              ) : (
                "Envoyer"
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
