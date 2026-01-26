"use client";

import { useState } from "react";
import { Bot, X, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatWindow } from "./ChatWindow";
import { UserRole } from "@/types";

interface ChatWidgetProps {
  userRole?: UserRole;
  userId?: string;
  projectId?: string;
}

export function ChatWidget({ userRole = "particulier", userId, projectId }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors flex items-center justify-center z-50"
          aria-label="Ouvrir l'assistant IA"
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 transition-all duration-300",
            isMinimized ? "w-80 h-16" : "w-96 h-[600px]"
          )}
        >
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 bg-primary-600 text-white rounded-t-lg">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <span className="font-medium">Assistant IA</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 hover:bg-primary-700 rounded transition-colors"
                  aria-label={isMinimized ? "Agrandir" : "Réduire"}
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-primary-700 rounded transition-colors"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <div className="flex-1 overflow-hidden">
                <ChatWindow
                  onClose={() => setIsOpen(false)}
                  userRole={userRole}
                  userId={userId}
                  projectId={projectId}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
