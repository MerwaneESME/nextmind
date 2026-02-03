"use client";

import { useState, useRef, useEffect } from "react";
import { Send, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  generateChecklistPdf,
  sendMessageToAI,
  type AIContext,
  type AIMessage,
  type QuickAction,
} from "@/lib/ai-service";
import { UserRole } from "@/types";
import { ChatMessageMarkdown } from "./ChatMessageMarkdown";

interface ChatWindowProps {
  onClose?: () => void;
  userRole?: UserRole;
  userId?: string;
  projectId?: string;
  autoScroll?: boolean;
}

export function ChatWindow({
  userRole = "particulier",
  userId = "demo-user",
  projectId,
  autoScroll = true,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: "assistant",
      content: userRole === "particulier" 
        ? "Bonjour ! Je suis votre assistant IA pour vos projets BTP. Que souhaitez-vous tester ou savoir ?"
        : "Bonjour ! Je suis votre assistant IA professionnel. Je peux vous aider à générer des devis, créer des factures, et gérer vos projets BTP. Que souhaitez-vous faire ?",
      timestamp: new Date().toISOString(),
    },
  ]);

  const createWelcomeMessage = (): AIMessage => ({
    role: "assistant",
    content:
      userRole === "particulier"
        ? "Bonjour ! Je suis votre assistant IA pour vos projets BTP. Que souhaitez-vous tester ou savoir ?"
        : "Bonjour ! Je suis votre assistant IA professionnel. Je peux vous aider à générer des devis, créer des factures, et gérer vos projets BTP. Que souhaitez-vous faire ?",
    timestamp: new Date().toISOString(),
  });

  const storageKey = `nextmind:conversationId:${userRole}:${userId}:${projectId ?? "global"}`;
  const [conversationId, setConversationId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(storageKey) ?? generateUUID();
  });

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<AIMessage[]>(messages);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    messagesRef.current = messages;
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages, autoScroll]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!conversationId) return;
    window.localStorage.setItem(storageKey, conversationId);
  }, [conversationId, storageKey]);

  const startNewConversation = () => {
    const newId = generateUUID();
    setConversationId(newId);
    setMessages([createWelcomeMessage()]);
  };

  const downloadChecklistPdf = async (conversationContext: string) => {
    const blob = await generateChecklistPdf({
      projectName: projectId ? `Projet ${projectId}` : "Diagnostic BTP",
      conversationContext,
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nextmind_checklist_diagnostic.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: AIMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const context: AIContext = {
        userId,
        userRole,
        projectId,
        conversationId,
        conversationHistory: [...messagesRef.current, userMessage],
      };

      const response = await sendMessageToAI(text, context);

      if (response.conversationId && response.conversationId !== conversationId) {
        setConversationId(response.conversationId);
      }

      const assistantMessage: AIMessage = {
        role: "assistant",
        content: response.message,
        quickActions: response.quickActions ?? [],
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
      const errorMessage: AIMessage = {
        role: "assistant",
        content: "Désolé, une erreur s'est produite. Veuillez réessayer.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = async (actionId: QuickAction["id"], messageContent: string) => {
    if (isLoading || loadingAction) return;
    setLoadingAction(actionId);

    try {
      if (actionId === "generate_checklist") {
        await sendMessage("Génère-moi une checklist détaillée pour ce diagnostic");
        await downloadChecklistPdf(messageContent);
        showToast("✅ PDF téléchargé avec succès", "success");
        return;
      }

      let followUpQuery = "";
      switch (actionId) {
        case "create_estimate":
          followUpQuery = "Crée-moi un mini-devis détaillé pour ce projet";
          break;
        case "materials_list":
          followUpQuery = "Donne-moi la liste complète des matériaux avec quantités précises";
          break;
        case "photo_guide":
          followUpQuery = "Détaille-moi exactement quelles photos prendre et sous quels angles";
          break;
        default:
          followUpQuery = "";
      }

      if (followUpQuery) {
        await sendMessage(followUpQuery);
      }
    } catch (error) {
      console.error("Erreur action:", error);
      showToast("❌ Erreur lors de l'action", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSend = async () => {
    const text = input;
    setInput("");
    await sendMessage(text);
  };

  return (
    <div className="chat-container flex flex-col h-full">
      <div className="chat-header">
        <div className="chat-header-left">
          <h2 className="chat-title">NEXTMIND</h2>
          <span className="chat-subtitle">Assistant IA BTP</span>
        </div>

        <button
          onClick={startNewConversation}
          className="new-conversation-btn"
          aria-label="Nouvelle discussion"
          type="button"
        >
          <svg
            className="new-conversation-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          <span className="new-conversation-text">Nouvelle discussion</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 bg-[#38b6ff] rounded-full flex items-center justify-center flex-shrink-0">
                <img
                  src="/images/robotbleu.png"
                  alt="Assistant IA"
                  className="w-5 h-5 object-contain brightness-0 invert"
                />
              </div>
            )}
            <div className="max-w-[80%]">
              <div
                className={`rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-primary-400 text-white [&_*]:text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-900 border border-neutral-200 shadow-sm"
                }`}
              >
                <ChatMessageMarkdown content={message.content} />
              </div>

              {message.role === "assistant" && message.quickActions && message.quickActions.length > 0 && (
                <div className="quick-actions">
                  {message.quickActions.map((action) => (
                    <button
                      key={action.id}
                      className="quick-action-btn"
                      onClick={() => handleActionClick(action.id, message.content)}
                      disabled={isLoading || loadingAction === action.id}
                      type="button"
                    >
                      {loadingAction === action.id ? (
                        <span className="loader-spinner">⏳</span>
                      ) : (
                        <span className="action-icon">{action.icon}</span>
                      )}
                      <span className="action-label">{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {message.role === "user" && (
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-[#38b6ff] rounded-full flex items-center justify-center">
              <img
                src="/images/robotbleu.png"
                alt="Assistant IA"
                className="w-5 h-5 object-contain brightness-0 invert"
              />
            </div>
            <div className="bg-neutral-100 border border-neutral-200 rounded-lg px-4 py-2 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Tapez votre message..."
            className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white selection:bg-primary-200 selection:text-neutral-900"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-[#38b6ff] text-white hover:bg-[#2ea8ec]"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function showToast(message: string, type: "success" | "error") {
  if (typeof window === "undefined") return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-show");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
