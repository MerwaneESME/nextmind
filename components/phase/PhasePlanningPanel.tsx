"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
import type { LotSummary } from "@/lib/lotsDb";

export default function PhasePlanningPanel({ lots }: { lots: LotSummary[] }) {
  const sorted = useMemo(() => {
    return [...lots].sort((a, b) => {
      const aStart = a.startDate ?? "";
      const bStart = b.startDate ?? "";
      if (aStart === bStart) return a.name.localeCompare(b.name);
      return aStart.localeCompare(bStart);
    });
  }, [lots]);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="text-xl font-semibold text-gray-900">Planning de la phase</div>
        <div className="text-sm text-gray-600">Synthèse des dates et de la progression des lots.</div>
      </header>

      <Card>
        <CardHeader>
          <div className="font-semibold text-gray-900">Lots</div>
          <div className="text-sm text-gray-500">{lots.length} lot{lots.length > 1 ? "s" : ""}</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.length === 0 ? (
            <div className="text-sm text-gray-500">Aucun lot à planifier.</div>
          ) : (
            sorted.map((lot) => (
              <div
                key={lot.id}
                className="rounded-lg border border-gray-200 bg-white p-3 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-[240px]">
                  <div className="font-medium text-gray-900">{lot.name}</div>
                  <div className="text-xs text-gray-500">
                    {lot.companyName ? `Entreprise: ${lot.companyName}` : "Entreprise: -"}
                  </div>
                </div>
                <div className="text-sm text-gray-700">
                  {lot.startDate ? formatDate(lot.startDate) : "-"} → {lot.endDate ? formatDate(lot.endDate) : "-"}
                </div>
                <div className="min-w-[140px]">
                  <div className="text-sm font-semibold text-gray-900">{lot.progressPercentage}%</div>
                  <div className="mt-2 h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-primary-600" style={{ width: `${lot.progressPercentage}%` }} />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

