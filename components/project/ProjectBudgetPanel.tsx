"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import type { LotSummary } from "@/lib/lotsDb";

export default function ProjectBudgetPanel({
  projectId,
  projectName,
  interventions,
  role,
}: {
  projectId: string;
  projectName: string | null;
  interventions: LotSummary[];
  role: string;
}) {
  const router = useRouter();

  const totals = {
    budgetEstimated: interventions.reduce((sum, i) => sum + (Number(i.budgetEstimated) || 0), 0),
    budgetActual: interventions.reduce((sum, i) => sum + (Number(i.budgetActual) || 0), 0),
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-neutral-100 shadow-sm px-6 py-4">
        <div className="text-xl font-semibold text-gray-900">Budget du projet</div>
        <div className="text-sm text-gray-500 mt-0.5">
          Vue consolidée du budget des interventions. Les factures ajoutées dans chaque intervention mettent à jour
          automatiquement ces montants.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-slate-300 bg-slate-50">
          <CardHeader className="border-b border-slate-100 bg-slate-50">
            <div className="text-sm text-gray-600">Budget total estimé</div>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-gray-900">
            {formatCurrency(totals.budgetEstimated)}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-300 bg-emerald-50">
          <CardHeader className="border-b border-emerald-100 bg-emerald-50">
            <div className="text-sm text-gray-600">Dépenses réelles (factures payées)</div>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-gray-900">
            {formatCurrency(totals.budgetActual)}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-200 bg-white">
          <CardHeader className="border-b border-blue-100 bg-white">
            <div className="text-sm text-gray-600">Budget disponible</div>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-gray-900">
            {formatCurrency(Math.max(0, totals.budgetEstimated - totals.budgetActual))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="font-semibold text-gray-900">Budget par intervention ({interventions.length})</div>
          <div className="text-sm text-gray-500">Cliquez pour gérer les factures d'une intervention.</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {interventions.length === 0 ? (
            <div className="text-sm text-gray-500">Aucune intervention. Créez des interventions pour suivre le budget.</div>
          ) : (
            interventions.map((i) => (
              <div
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => router.push(`/dashboard/projets/${projectId}/interventions/${i.id}?role=${role}&tab=factures`)}
              >
                <div>
                  <div className="font-medium text-gray-900">{i.name}</div>
                  {i.companyName && (
                    <div className="text-xs text-gray-500">{i.companyName}</div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">{formatCurrency(Number(i.budgetActual ?? 0))}</div>
                    <div className="text-xs text-gray-500">/ {formatCurrency(Number(i.budgetEstimated ?? 0))} estimé</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/projets/${projectId}/interventions/${i.id}?role=${role}&tab=factures`);
                    }}
                  >
                    Factures
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
