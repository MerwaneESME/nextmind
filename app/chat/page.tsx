"use client";

import { ChatWindow } from "@/components/chat/ChatWindow";
import { Card } from "@/components/ui/Card";
import { Bot, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function ChatPage() {
  const { user } = useAuth();
  const userRole = user?.role ?? "particulier";
  const userId = user?.id ?? "demo-user";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Assistant IA</h1>
              <p className="text-gray-600">Votre assistant intelligent pour vos projets BTP</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="h-[600px]">
              <ChatWindow userRole={userRole} userId={userId} />
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-primary-600" />
                  <h3 className="font-semibold text-gray-900">Suggestions</h3>
                </div>
                <div className="space-y-2">
                  {[
                    "Créer un nouveau projet",
                    "Trouver un professionnel",
                    "Comparer des devis",
                    "Consulter mes projets",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Comment ça fonctionne ?</h3>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">1.</span>
                    <span>Décrivez votre projet ou votre besoin</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">2.</span>
                    <span>L'assistant IA analyse votre demande</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">3.</span>
                    <span>Recevez des recommandations personnalisées</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">4.</span>
                    <span>Créez votre projet en quelques clics</span>
                  </li>
                </ul>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
