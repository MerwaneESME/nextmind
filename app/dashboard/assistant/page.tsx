"use client";

import { useSearchParams } from "next/navigation";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";

export default function AssistantPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const roleParam = searchParams.get("role");
  const role = user?.role ?? (roleParam === "professionnel" ? "professionnel" : "particulier");
  const userId = user?.id ?? "demo-user";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-4">
        <img
          src="/images/assistantia.png"
          alt="Assistant IA"
          className="h-28 w-28 object-contain logo-blend"
        />
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Assistant IA</h1>
          <p className="text-sm text-neutral-600">
            Posez vos questions et laissez l'assistant vous guider.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <Card className="h-[60vh]">
          <CardContent className="p-0 h-full">
            <div className="h-full">
              <ChatWindow userRole={role} userId={userId} autoScroll={false} />
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit self-start">
          <CardHeader>
            <div className="text-lg font-semibold text-neutral-900">Guide rapide</div>
            <div className="text-sm text-neutral-600">
              Quelques idées pour bien démarrer avec l'assistant.
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-neutral-700">
            <div>
              <div className="font-medium text-neutral-900 mb-2">1. Décrivez votre projet</div>
              <ul className="space-y-1 list-disc pl-5">
                <li>Type de travaux (rénovation, extension, toiture, etc.)</li>
                <li>Surface ou pièces concernées</li>
                <li>Budget et délai souhaités</li>
                <li>Ville ou zone d'intervention</li>
              </ul>
            </div>

            <div>
              <div className="font-medium text-neutral-900 mb-2">2. Demandez une action</div>
              <ul className="space-y-1 list-disc pl-5">
                <li>Comparer des devis</li>
                <li>Préparer une check‑list de chantier</li>
                <li>Planifier les étapes</li>
              </ul>
            </div>

            <div>
              <div className="font-medium text-neutral-900 mb-2">Exemples</div>
              <div className="space-y-2">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                  "Je veux rénover une cuisine de 12m² à Lille avec 12 000€ de budget."
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                  "Peux-tu me proposer un planning en 6 étapes pour une extension ?"
                </div>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                  "Compare ces devis et dis-moi lequel est le plus cohérent."
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
