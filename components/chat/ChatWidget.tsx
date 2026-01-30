"use client";

import { useEffect, useState } from "react";
import { X, Minimize2 } from "lucide-react";
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

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setIsMinimized(false);
    };
    if (typeof window === "undefined") return;
    window.addEventListener("open-chat-widget", handleOpen);
    return () => {
      window.removeEventListener("open-chat-widget", handleOpen);
    };
  }, []);

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-[#38b6ff] text-white rounded-full shadow-lg hover:bg-[#2ea8ec] transition-colors flex items-center justify-center z-50"
          aria-label="Ouvrir l'assistant IA"
        >
          <img
            src="/images/robotbleu.png"
            alt="Assistant IA"
            className="w-6 h-6 object-contain brightness-0 invert"
          />
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
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 bg-[#38b6ff] text-white rounded-t-lg">
              <div className="flex items-center gap-2">
                <img
                  src="/images/robotbleu.png"
                  alt="Assistant IA"
                  className="w-5 h-5 object-contain brightness-0 invert"
                />
                <span className="font-medium text-white">Assistant IA</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 text-white hover:bg-[#2ea8ec] rounded transition-colors"
                  aria-label={isMinimized ? "Agrandir" : "Réduire"}
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-white hover:bg-[#2ea8ec] rounded transition-colors"
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
