"use client";

import { formatCurrency } from "@/lib/utils";

export function BudgetSummary({
  ht,
  tva,
  ttc,
}: {
  ht?: number | null;
  tva?: number | null;
  ttc: number;
}) {
  const hasHt = typeof ht === "number";
  const hasTva = typeof tva === "number";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <p className="text-sm text-blue-600 mb-1">Total HT</p>
        <p className="text-2xl font-bold text-blue-900">{hasHt ? formatCurrency(ht!) : "—"}</p>
      </div>
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
        <p className="text-sm text-purple-600 mb-1">TVA</p>
        <p className="text-2xl font-bold text-purple-900">{hasTva ? formatCurrency(tva!) : "—"}</p>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <p className="text-sm text-green-600 mb-1">Total TTC</p>
        <p className="text-2xl font-bold text-green-900">{formatCurrency(ttc)}</p>
      </div>
    </div>
  );
}

