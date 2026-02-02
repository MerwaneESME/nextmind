"use client";

import { useState, useRef, useEffect } from "react";
import { Send, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { sendMessageToAI, type AIMessage, type AIContext } from "@/lib/ai-service";
import { UserRole } from "@/types";

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
        ? "Bonjour ! Je suis votre assistant IA pour vos projets BTP. Commencez à créer votre projet en me décrivant ce que vous souhaitez réaliser."
        : "Bonjour ! Je suis votre assistant IA professionnel. Je peux vous aider à générer des devis, créer des factures, et gérer vos projets BTP.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages, autoScroll]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: AIMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const context: AIContext = {
        userId,
        userRole,
        projectId,
        conversationHistory: messages,
      };

      const response = await sendMessageToAI(input, context);
      
      const assistantMessage: AIMessage = {
        role: "assistant",
        content: response.message,
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

  return (
    <div className="flex flex-col h-full">
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
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-neutral-100 text-neutral-900 border border-neutral-200 shadow-sm"
              }`}
            >
              <p
                className={`text-sm whitespace-pre-wrap ${
                  message.role === "user" ? "text-white" : "text-neutral-900"
                }`}
              >
                {message.content}
              </p>
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
            className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
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
