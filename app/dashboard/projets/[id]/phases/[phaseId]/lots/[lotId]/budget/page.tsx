"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, isValidDateRange, normalizeDateValue } from "@/lib/utils";
import { canEditLot } from "@/lib/accessControl";
import { getMyPhaseMembership } from "@/lib/phaseMembersDb";
import { getLotById, type LotRow } from "@/lib/lotsDb";
import { getPhaseById, type PhaseRow } from "@/lib/phasesDb";
import {
  createQuote,
  getQuotes,
  refuseQuote,
  validateQuote,
  type Quote,
  type QuoteStatus,
} from "@/lib/db/quotesDb";
import { createInvoice, getInvoices, markInvoicePaid, type Invoice } from "@/lib/db/invoicesDb";
import { supabase } from "@/lib/supabaseClient";

type ProjectLite = { id: string; name: string | null };

export default function LotBudgetPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const roleParam = searchParams.get("role");
  const role = roleParam === "professionnel" ? "professionnel" : "particulier";

  const projectId = typeof params.id === "string" ? params.id : "";
  const phaseId = typeof params.phaseId === "string" ? params.phaseId : "";
  const lotId = typeof params.lotId === "string" ? params.lotId : "";

  const [project, setProject] = useState<ProjectLite | null>(null);
  const [phase, setPhase] = useState<PhaseRow | null>(null);
  const [lot, setLot] = useState<LotRow | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [membership, setMembership] = useState<any>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<string | null>(null);

  const canEditThisLot = useMemo(() => {
    return canEditLot({ projectMemberRole, phaseMembership: membership, lotId });
  }, [projectMemberRole, membership, lotId]);

  const totals = useMemo(() => {
    const quotesValid = quotes.filter((q) => q.status === "valide").reduce((sum, q) => sum + (q.amount ?? 0), 0);
    const invoicesEmitted = invoices.reduce((sum, i) => sum + (i.amount ?? 0), 0);
    const invoicesPaid = invoices.filter((i) => i.status === "payee").reduce((sum, i) => sum + (i.amount ?? 0), 0);
    const remainingToPay = invoicesEmitted - invoicesPaid;
    const budgetEstimated = Number(lot?.budget_estimated ?? 0);
    const budgetAvailable = budgetEstimated - invoicesPaid;
    return { quotesValid, invoicesEmitted, invoicesPaid, remainingToPay, budgetEstimated, budgetAvailable };
  }, [quotes, invoices, lot?.budget_estimated]);

  const [quoteFormOpen, setQuoteFormOpen] = useState(false);
  const [quoteFormError, setQuoteFormError] = useState<string | null>(null);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    quoteNumber: "",
    title: "",
    amount: "",
    issuedDate: "",
    validUntil: "",
    fileUrl: "",
    status: "en_attente" as QuoteStatus,
  });

  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [invoiceFormError, setInvoiceFormError] = useState<string | null>(null);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: "",
    title: "",
    amount: "",
    issuedDate: "",
    dueDate: "",
    fileUrl: "",
    quoteId: "",
  });

  const load = async () => {
    if (!user?.id || !projectId || !phaseId || !lotId) return;
    setLoading(true);
    setError(null);
    try {
      const [projectRes, memberRes, phaseRow, lotRow, quoteRows, invoiceRows, myMembership] = await Promise.all([
        supabase.from("projects").select("id,name").eq("id", projectId).maybeSingle(),
        supabase
          .from("project_members")
          .select("role,status")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle(),
        getPhaseById(phaseId),
        getLotById(lotId),
        getQuotes(lotId),
        getInvoices(lotId),
        getMyPhaseMembership(phaseId, user.id),
      ]);

      if (projectRes.error) throw projectRes.error;
      if (memberRes.error) throw memberRes.error;

      setProject((projectRes.data as any) ?? null);
      setProjectMemberRole((memberRes.data as any)?.role ?? null);
      setMembership(myMembership);
      setPhase(phaseRow);
      setLot(lotRow);
      setQuotes(quoteRows);
      setInvoices(invoiceRows);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger le budget du lot.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, projectId, phaseId, lotId]);

  const handleCreateQuote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEditThisLot) return;
    if (!quoteForm.title.trim() || !quoteForm.amount) return;
    if (!isValidDateRange(quoteForm.issuedDate, quoteForm.validUntil)) {
      setQuoteFormError("La date « Valide jusqu'au » doit être supérieure ou égale à la date d'émission.");
      return;
    }
    setQuoteSubmitting(true);
    setQuoteFormError(null);
    try {
      await createQuote({
        lotId,
        quoteNumber: quoteForm.quoteNumber || null,
        title: quoteForm.title,
        amount: Number(quoteForm.amount),
        status: quoteForm.status,
        fileUrl: quoteForm.fileUrl || null,
        issuedDate: quoteForm.issuedDate || null,
        validUntil: quoteForm.validUntil || null,
      });
      setQuoteFormOpen(false);
      setQuoteForm({
        quoteNumber: "",
        title: "",
        amount: "",
        issuedDate: "",
        validUntil: "",
        fileUrl: "",
        status: "en_attente",
      });
      await load();
    } catch (err: any) {
      setQuoteFormError(err?.message ?? "Impossible de créer le devis.");
    } finally {
      setQuoteSubmitting(false);
    }
  };

  const handleCreateInvoice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEditThisLot) return;
    if (!invoiceForm.title.trim() || !invoiceForm.amount) return;
    if (!isValidDateRange(invoiceForm.issuedDate, invoiceForm.dueDate)) {
      setInvoiceFormError("La date d'échéance doit être supérieure ou égale à la date d'émission.");
      return;
    }
    setInvoiceSubmitting(true);
    setInvoiceFormError(null);
    try {
      await createInvoice({
        lotId,
        quoteId: invoiceForm.quoteId || null,
        invoiceNumber: invoiceForm.invoiceNumber || null,
        title: invoiceForm.title,
        amount: Number(invoiceForm.amount),
        fileUrl: invoiceForm.fileUrl || null,
        issuedDate: invoiceForm.issuedDate || null,
        dueDate: invoiceForm.dueDate || null,
      });
      setInvoiceFormOpen(false);
      setInvoiceForm({
        invoiceNumber: "",
        title: "",
        amount: "",
        issuedDate: "",
        dueDate: "",
        fileUrl: "",
        quoteId: "",
      });
      await load();
    } catch (err: any) {
      setInvoiceFormError(err?.message ?? "Impossible de créer la facture.");
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  if (!projectId || !phaseId || !lotId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Lot introuvable.</p>
        <Button variant="outline" onClick={() => router.push(`/dashboard/projets?role=${role}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">
              Projet: {project?.name ?? projectId} • Phase: {phase?.name ?? phaseId}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Budget lot: {lot?.name ?? lotId}</h1>
            <p className="text-gray-600">{lot?.company_name ? `Entreprise: ${lot.company_name}` : "Entreprise: -"}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/projets/${projectId}/phases/${phaseId}/lots/${lotId}?role=${role}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour lot
          </Button>
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </header>

      {loading ? (
        <div className="text-sm text-gray-500">Chargement...</div>
      ) : (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-slate-200 bg-slate-50/30">
              <CardHeader className="border-b border-slate-100 bg-slate-50/60">
                <div className="text-sm text-gray-600">Budget estimé</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">
                {formatCurrency(totals.budgetEstimated)}
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-200 bg-blue-50/20">
              <CardHeader className="border-b border-blue-100 bg-blue-50/60">
                <div className="text-sm text-gray-600">Devis validés</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">
                {formatCurrency(totals.quotesValid)}
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-200 bg-emerald-50/20">
              <CardHeader className="border-b border-emerald-100 bg-emerald-50/60">
                <div className="text-sm text-gray-600">Factures payées</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">
                {formatCurrency(totals.invoicesPaid)}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-orange-200 bg-orange-50/20">
              <CardHeader className="border-b border-orange-100 bg-orange-50/60">
                <div className="text-sm text-gray-600">Factures émises</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">
                {formatCurrency(totals.invoicesEmitted)}
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-200 bg-red-50/20">
              <CardHeader className="border-b border-red-100 bg-red-50/60">
                <div className="text-sm text-gray-600">Reste à payer</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">
                {formatCurrency(totals.remainingToPay)}
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-slate-200 bg-slate-50/30">
              <CardHeader className="border-b border-slate-100 bg-slate-50/60">
                <div className="text-sm text-gray-600">Budget disponible</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">
                {formatCurrency(totals.budgetAvailable)}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">Devis ({quotes.length})</div>
                    <div className="text-sm text-gray-500">Devis rattachés à ce lot.</div>
                  </div>
                  {canEditThisLot && (
                    <Button size="sm" onClick={() => { setQuoteFormError(null); setQuoteFormOpen((v) => !v); }}>
                      {quoteFormOpen ? "Fermer" : "+ Ajouter"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {quoteFormOpen && canEditThisLot && (
                  <form onSubmit={handleCreateQuote} className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                    {quoteFormError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {quoteFormError}
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-600">Numéro</label>
                        <Input value={quoteForm.quoteNumber} onChange={(e) => setQuoteForm({ ...quoteForm, quoteNumber: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-600">Statut</label>
                        <select
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          value={quoteForm.status}
                          onChange={(e) => setQuoteForm({ ...quoteForm, status: e.target.value as QuoteStatus })}
                        >
                          <option value="en_attente">En attente</option>
                          <option value="valide">Validé</option>
                          <option value="refuse">Refusé</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">Titre *</label>
                      <Input value={quoteForm.title} onChange={(e) => setQuoteForm({ ...quoteForm, title: e.target.value })} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-600">Montant (€) *</label>
                        <Input
                          type="number"
                          min={0}
                          value={quoteForm.amount}
                          onChange={(e) => setQuoteForm({ ...quoteForm, amount: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-600">Lien PDF</label>
                        <Input value={quoteForm.fileUrl} onChange={(e) => setQuoteForm({ ...quoteForm, fileUrl: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-600">Date d’émission</label>
                        <Input type="date" value={quoteForm.issuedDate} onChange={(e) => setQuoteForm({ ...quoteForm, issuedDate: normalizeDateValue(e.target.value) || e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-600">Valide jusqu’au</label>
                        <Input type="date" value={quoteForm.validUntil} onChange={(e) => setQuoteForm({ ...quoteForm, validUntil: normalizeDateValue(e.target.value) || e.target.value })} />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button type="submit" disabled={quoteSubmitting}>
                        {quoteSubmitting ? "Création..." : "Créer"}
                      </Button>
                    </div>
                  </form>
                )}

                {quotes.length === 0 ? (
                  <div className="text-sm text-gray-500">Aucun devis.</div>
                ) : (
                  quotes.map((q) => (
                    <div key={q.id} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-900">{q.title}</div>
                          <div className="text-xs text-gray-500">
                            {(q.quote_number ?? "—") + " • "}
                            {q.issued_date ? formatDate(q.issued_date) : "Date: —"}{" "}
                            {q.valid_until ? `• Valide jusqu’au: ${formatDate(q.valid_until)}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">{formatCurrency(q.amount ?? 0)}</div>
                          <div className="text-xs text-gray-500">{String(q.status)}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {q.file_url && (
                          <a className="text-sm underline text-primary-700" href={q.file_url} target="_blank" rel="noreferrer">
                            Ouvrir PDF
                          </a>
                        )}
                        {canEditThisLot && q.status === "en_attente" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await validateQuote(q.id);
                                  await load();
                                } catch (err: any) {
                                  setError(err?.message ?? "Impossible de valider le devis.");
                                }
                              }}
                            >
                              Valider
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-200 text-red-600"
                              onClick={async () => {
                                try {
                                  await refuseQuote(q.id);
                                  await load();
                                } catch (err: any) {
                                  setError(err?.message ?? "Impossible de refuser le devis.");
                                }
                              }}
                            >
                              Refuser
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">Factures ({invoices.length})</div>
                    <div className="text-sm text-gray-500">Factures rattachées à ce lot.</div>
                  </div>
                  {canEditThisLot && (
                    <Button size="sm" onClick={() => { setInvoiceFormError(null); setInvoiceFormOpen((v) => !v); }}>
                      {invoiceFormOpen ? "Fermer" : "+ Ajouter"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoiceFormOpen && canEditThisLot && (
                  <form onSubmit={handleCreateInvoice} className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                    {invoiceFormError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {invoiceFormError}
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-600">Numéro</label>
                        <Input value={invoiceForm.invoiceNumber} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-600">Devis lié (optionnel)</label>
                        <select
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          value={invoiceForm.quoteId}
                          onChange={(e) => setInvoiceForm({ ...invoiceForm, quoteId: e.target.value })}
                        >
                          <option value="">—</option>
                          {quotes.map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">Titre *</label>
                      <Input value={invoiceForm.title} onChange={(e) => setInvoiceForm({ ...invoiceForm, title: e.target.value })} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-600">Montant (€) *</label>
                        <Input
                          type="number"
                          min={0}
                          value={invoiceForm.amount}
                          onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-600">Lien PDF</label>
                        <Input value={invoiceForm.fileUrl} onChange={(e) => setInvoiceForm({ ...invoiceForm, fileUrl: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-600">Date d’émission</label>
                        <Input type="date" value={invoiceForm.issuedDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, issuedDate: normalizeDateValue(e.target.value) || e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-600">Échéance</label>
                        <Input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: normalizeDateValue(e.target.value) || e.target.value })} />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button type="submit" disabled={invoiceSubmitting}>
                        {invoiceSubmitting ? "Création..." : "Créer"}
                      </Button>
                    </div>
                  </form>
                )}

                {invoices.length === 0 ? (
                  <div className="text-sm text-gray-500">Aucune facture.</div>
                ) : (
                  invoices.map((i) => (
                    <div key={i.id} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-900">{i.title}</div>
                          <div className="text-xs text-gray-500">
                            {(i.invoice_number ?? "—") + " • "}
                            {i.issued_date ? `Émise: ${formatDate(i.issued_date)}` : "Émise: —"}
                            {i.due_date ? ` • Échéance: ${formatDate(i.due_date)}` : ""}
                            {i.paid_date ? ` • Payée: ${formatDate(i.paid_date)}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">{formatCurrency(i.amount ?? 0)}</div>
                          <div className="text-xs text-gray-500">{String(i.status)}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {i.file_url && (
                          <a className="text-sm underline text-primary-700" href={i.file_url} target="_blank" rel="noreferrer">
                            Ouvrir PDF
                          </a>
                        )}
                        {canEditThisLot && i.status !== "payee" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await markInvoicePaid(i.id);
                                await load();
                              } catch (err: any) {
                                setError(err?.message ?? "Impossible de marquer la facture payée.");
                              }
                            }}
                          >
                            Marquer payée
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
}

