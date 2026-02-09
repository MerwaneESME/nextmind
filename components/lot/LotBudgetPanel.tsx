"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { getLotById, type LotRow } from "@/lib/lotsDb";
import { getPhaseById, type PhaseRow } from "@/lib/phasesDb";
import { formatCurrency, formatDate } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { getQuotes, type Quote } from "@/lib/db/quotesDb";
import { getInvoices, type Invoice } from "@/lib/db/invoicesDb";

type ProjectLite = { id: string; name: string | null };

export default function LotBudgetPanel({
  projectId,
  phaseId,
  lotId,
  role,
}: {
  projectId: string;
  phaseId: string;
  lotId: string;
  role: string;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const [project, setProject] = useState<ProjectLite | null>(null);
  const [phase, setPhase] = useState<PhaseRow | null>(null);
  const [lot, setLot] = useState<LotRow | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const quotesValid = quotes.filter((q) => q.status === "valide").reduce((sum, q) => sum + (q.amount ?? 0), 0);
    const invoicesEmitted = invoices.reduce((sum, i) => sum + (i.amount ?? 0), 0);
    const invoicesPaid = invoices.filter((i) => i.status === "payee").reduce((sum, i) => sum + (i.amount ?? 0), 0);
    const remainingToPay = invoicesEmitted - invoicesPaid;
    const budgetEstimated = Number(lot?.budget_estimated ?? 0);
    const budgetAvailable = budgetEstimated - invoicesPaid;
    return { quotesValid, invoicesEmitted, invoicesPaid, remainingToPay, budgetEstimated, budgetAvailable };
  }, [quotes, invoices, lot?.budget_estimated]);

  const load = async () => {
    if (!user?.id || !projectId || !phaseId || !lotId) return;
    setLoading(true);
    setError(null);
    try {
      const [projectRes, phaseRow, lotRow, quoteRows, invoiceRows] = await Promise.all([
        supabase.from("projects").select("id,name").eq("id", projectId).maybeSingle(),
        getPhaseById(phaseId),
        getLotById(lotId),
        getQuotes(lotId),
        getInvoices(lotId),
      ]);
      if (projectRes.error) throw projectRes.error;
      setProject((projectRes.data as any) ?? null);
      setPhase(phaseRow);
      setLot(lotRow);
      setQuotes(quoteRows);
      setInvoices(invoiceRows);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger le budget.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, projectId, phaseId, lotId]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-gray-900">Budget</div>
          <div className="text-sm text-gray-600">
            {project?.name ?? projectId} • {phase?.name ?? phaseId} • {lot?.name ?? lotId}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Actualiser
          </Button>
          <Button
            size="sm"
            onClick={() =>
              router.push(
                `/dashboard/projets/${projectId}/phases/${phaseId}/lots/${lotId}/budget?role=${role}`
              )
            }
          >
            Gérer budget
          </Button>
        </div>
      </header>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="text-sm text-gray-500">Chargement...</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-slate-200 bg-slate-50/30">
              <CardHeader className="border-b border-slate-100 bg-slate-50/60">
                <div className="text-sm text-gray-600">Budget estimé</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">{formatCurrency(totals.budgetEstimated)}</CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-200 bg-blue-50/20">
              <CardHeader className="border-b border-blue-100 bg-blue-50/60">
                <div className="text-sm text-gray-600">Devis validés</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">{formatCurrency(totals.quotesValid)}</CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-200 bg-emerald-50/20">
              <CardHeader className="border-b border-emerald-100 bg-emerald-50/60">
                <div className="text-sm text-gray-600">Factures payées</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">{formatCurrency(totals.invoicesPaid)}</CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="font-semibold text-gray-900">Reste à payer</div>
                <div className="text-sm text-gray-500">Factures émises - payées</div>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-gray-900">{formatCurrency(totals.remainingToPay)}</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="font-semibold text-gray-900">Budget disponible</div>
                <div className="text-sm text-gray-500">Budget estimé - factures payées</div>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-gray-900">{formatCurrency(totals.budgetAvailable)}</CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <Card>
              <CardHeader>
                <div className="font-semibold text-gray-900">Devis</div>
                <div className="text-sm text-gray-500">{quotes.length} devis</div>
              </CardHeader>
              <CardContent className="space-y-2">
                {quotes.length === 0 ? (
                  <div className="text-sm text-gray-500">Aucun devis.</div>
                ) : (
                  quotes.map((q) => (
                    <div key={q.id} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-medium text-gray-900">{q.title}</div>
                        <div className="font-semibold text-gray-900">{formatCurrency(Number(q.amount ?? 0))}</div>
                      </div>
                      <div className="text-xs text-gray-500">
                        Statut: {q.status}
                        {q.issued_date ? ` • Émis le ${formatDate(q.issued_date)}` : ""}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="font-semibold text-gray-900">Factures</div>
                <div className="text-sm text-gray-500">{invoices.length} facture{invoices.length > 1 ? "s" : ""}</div>
              </CardHeader>
              <CardContent className="space-y-2">
                {invoices.length === 0 ? (
                  <div className="text-sm text-gray-500">Aucune facture.</div>
                ) : (
                  invoices.map((i) => (
                    <div key={i.id} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-medium text-gray-900">{i.title}</div>
                        <div className="font-semibold text-gray-900">{formatCurrency(Number(i.amount ?? 0))}</div>
                      </div>
                      <div className="text-xs text-gray-500">
                        Statut: {i.status}
                        {i.issued_date ? ` • Émise le ${formatDate(i.issued_date)}` : ""}
                        {i.due_date ? ` • Échéance ${formatDate(i.due_date)}` : ""}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

