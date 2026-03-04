"use client";

import { useSearchParams } from "next/navigation";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { Bot, Lightbulb, Zap, MessageSquare } from "lucide-react";

export default function AssistantPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const roleParam = searchParams.get("role");
  const role = user?.role ?? (roleParam === "professionnel" ? "professionnel" : "particulier");
  const userId = user?.id ?? "demo-user";

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
        <div className="relative flex items-start justify-between gap-6 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <Bot className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Assistant IA</h1>
              <p className="text-neutral-600 mt-1">Posez vos questions et laissez l'assistant vous guider.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
                  IA BTP
                </span>
                <span className="rounded-full border border-primary-200 bg-primary-50 text-primary-700 px-3 py-1">
                  Devis & projets
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1">
                  Conseils techniques
                </span>
              </div>
            </div>
          </div>
          <img
            src="/images/assistantia.png"
            alt="Assistant IA"
            className="hidden sm:block h-20 w-20 object-contain opacity-90 logo-blend flex-shrink-0"
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <Card className="h-[62vh]">
          <CardContent className="p-0 h-full">
            <div className="h-full">
              <ChatWindow userRole={role} userId={userId} autoScroll={false} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-4 h-4 text-primary-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Guide rapide</div>
                  <div className="text-xs text-neutral-500">Comment bien utiliser l'assistant</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-neutral-700">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold flex-shrink-0">1</span>
                  <span className="font-semibold text-neutral-900">Décrivez votre projet</span>
                </div>
                <ul className="space-y-1 text-xs text-neutral-600 pl-7">
                  <li className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-neutral-400 flex-shrink-0" />Type de travaux (rénovation, extension, toiture…)</li>
                  <li className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-neutral-400 flex-shrink-0" />Surface ou pièces concernées</li>
                  <li className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-neutral-400 flex-shrink-0" />Budget et délai souhaités</li>
                  <li className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-neutral-400 flex-shrink-0" />Ville ou zone d'intervention</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold flex-shrink-0">2</span>
                  <span className="font-semibold text-neutral-900">Demandez une action</span>
                </div>
                <ul className="space-y-1 text-xs text-neutral-600 pl-7">
                  <li className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-neutral-400 flex-shrink-0" />Comparer des devis</li>
                  <li className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-neutral-400 flex-shrink-0" />Préparer une check‑list de chantier</li>
                  <li className="flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-neutral-400 flex-shrink-0" />Planifier les étapes</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Exemples de questions</div>
                  <div className="text-xs text-neutral-500">Cliquez pour insérer</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                "Je veux rénover une cuisine de 12m² à Lille avec 12 000€ de budget.",
                "Peux-tu me proposer un planning en 6 étapes pour une extension ?",
                "Compare ces devis et dis-moi lequel est le plus cohérent.",
              ].map((example, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-primary-50 hover:border-primary-200 px-3 py-2 text-xs text-neutral-700 cursor-pointer transition-colors"
                >
                  <MessageSquare className="inline w-3 h-3 mr-1.5 text-neutral-400" />
                  {example}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
