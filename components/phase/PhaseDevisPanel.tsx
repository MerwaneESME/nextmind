"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { fetchLotsForPhase, type LotSummary } from "@/lib/lotsDb";
import { getQuotesForLots, type Quote } from "@/lib/db/quotesDb";

type QuoteWithLot = Quote & { lot?: LotSummary | null };

export default function PhaseDevisPanel({ phaseId }: { phaseId: string }) {
  const [lots, setLots] = useState<LotSummary[]>([]);
  const [quotes, setQuotes] = useState<QuoteWithLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!phaseId) return;
    setLoading(true);
    setError(null);
    try {
      const lotsRows = await fetchLotsForPhase(phaseId);
      setLots(lotsRows);
      const lotIds = lotsRows.map((l) => l.id);
      const quotesRows = lotIds.length ? await getQuotesForLots(lotIds) : [];
      const lotsMap = new Map(lotsRows.map((lot) => [lot.id, lot]));
      const enriched = quotesRows.map((q) => ({ ...q, lot: lotsMap.get(q.lot_id) ?? null }));
      setQuotes(enriched);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les devis de la phase.");
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseId]);

  const totals = useMemo(() => {
    const validTotal = quotes
      .filter((q) => q.status === "valide")
      .reduce((sum, q) => sum + Number(q.amount ?? 0), 0);
    return { validTotal };
  }, [quotes]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-gray-900">Devis de la phase</div>
          <div className="text-sm text-gray-600">Devis rattachés aux lots de cette phase.</div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Actualiser
        </Button>
      </header>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="text-sm text-gray-500">Chargement...</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-blue-200 bg-blue-50/20">
              <CardHeader className="border-b border-blue-100 bg-blue-50/60">
                <div className="text-sm text-gray-600">Lots</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">{lots.length}</CardContent>
            </Card>
            <Card className="border-l-4 border-l-slate-200 bg-slate-50/30">
              <CardHeader className="border-b border-slate-100 bg-slate-50/60">
                <div className="text-sm text-gray-600">Devis</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">{quotes.length}</CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-200 bg-emerald-50/20">
              <CardHeader className="border-b border-emerald-100 bg-emerald-50/60">
                <div className="text-sm text-gray-600">Total validé</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">
                {formatCurrency(totals.validTotal)}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Liste des devis</div>
              <div className="text-sm text-gray-500">Chaque devis est rattaché à un lot.</div>
            </CardHeader>
            <CardContent className="space-y-2">
              {quotes.length === 0 ? (
                <div className="text-sm text-gray-500">Aucun devis pour le moment.</div>
              ) : (
                quotes.map((q) => (
                  <div
                    key={q.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <div className="min-w-[240px]">
                      <div className="font-medium text-gray-900">{q.title}</div>
                      <div className="text-xs text-gray-500">
                        Lot: {q.lot?.name ?? q.lot_id} • Statut: {q.status}
                        {q.issued_date ? ` • Émis le ${formatDate(q.issued_date)}` : ""}
                      </div>
                    </div>
                    <div className="font-semibold text-gray-900">{formatCurrency(Number(q.amount ?? 0))}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
