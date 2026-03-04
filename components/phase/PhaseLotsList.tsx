"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { LotSummary } from "@/lib/lotsDb";

export default function PhaseLotsList({
  projectId,
  phaseId,
  lots,
  onAddLot,
}: {
  projectId: string;
  phaseId: string;
  lots: LotSummary[];
  onAddLot?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const role = roleParam === "professionnel" ? "professionnel" : "particulier";

  if (lots.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <EmptyState
            icon=""
            title="Aucune intervention pour le moment"
            description="Ajoutez des interventions pour organiser les différents corps de métier de cette phase."
            action={
              onAddLot
                ? {
                    label: "+ Ajouter votre première intervention",
                    onClick: onAddLot,
                  }
                : undefined
            }
          />
        </CardContent>
      </Card>
    );
  }

  const resolveLotStatusLabel = (status: string | null | undefined) => {
    const normalized = String(status ?? "").toLowerCase();
    if (!normalized || normalized === "planifie") return { key: "planifie", label: "Planifié" };
    if (["en_cours", "in_progress", "active"].includes(normalized)) return { key: "en_cours", label: "En cours" };
    if (["termine", "done", "completed"].includes(normalized)) return { key: "termine", label: "Terminé" };
    if (["valide", "validee"].includes(normalized)) return { key: "valide", label: "Validé" };
    if (normalized.includes("devis")) return { key: "devis_en_cours", label: "Devis" };
    return { key: "planifie", label: normalized };
  };

  const goToLot = (lotId: string) => {
    router.push(`/dashboard/projets/${projectId}/phases/${phaseId}/lots/${lotId}?role=${role}`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-gray-900">Interventions ({lots.length})</div>
          <div className="text-sm text-gray-600">Suivi des interventions de cette phase.</div>
        </div>
        {onAddLot ? (
          <Button size="sm" onClick={onAddLot}>
            + Nouvelle intervention
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {lots.map((lot) => {
          const status = resolveLotStatusLabel(lot.status);
          return (
            <div
              key={lot.id}
              className="border rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group bg-white"
              onClick={() => goToLot(lot.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") goToLot(lot.id);
              }}
            >
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                    {lot.name}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {lot.companyName ? `Entreprise: ${lot.companyName}` : "Entreprise non définie"}
                  </div>
                </div>
                <Badge type="lot" status={status.key}>
                  {status.label}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-sm">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Budget</div>
                  <div className="font-semibold text-gray-900">
                    {formatCurrency(lot.budgetActual)} / {formatCurrency(lot.budgetEstimated)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Dates</div>
                  <div className="font-semibold text-gray-900 text-xs">
                    {lot.startDate ? formatDate(lot.startDate) : "-"} → {lot.endDate ? formatDate(lot.endDate) : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Tâches</div>
                  <div className="font-semibold text-gray-900">
                    {lot.tasksDone}/{lot.tasksTotal}
                  </div>
                </div>
              </div>

              <ProgressBar percentage={lot.progressPercentage} showLabel={false} size="sm" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

