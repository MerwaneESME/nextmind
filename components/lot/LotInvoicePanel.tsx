"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, isValidDateRange, normalizeDateValue } from "@/lib/utils";
import { createInvoice, getInvoices, markInvoicePaid, type Invoice } from "@/lib/db/invoicesDb";
import { updateLot } from "@/lib/lotsDb";
import { supabase } from "@/lib/supabaseClient";
import { DocumentPreviewTrigger } from "@/components/documents/DocumentPreviewModal";

const DOCUMENTS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET ?? "documents";

export default function LotInvoicePanel({
  projectId,
  lotId,
  interventionId,
  canEdit,
  onBudgetUpdated,
}: {
  projectId: string;
  lotId: string;
  interventionId: string;
  canEdit: boolean;
  onBudgetUpdated?: () => void;
}) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    issuedDate: "",
    dueDate: "",
    invoiceNumber: "",
    fileUrl: "",
  });

  const load = async () => {
    if (!lotId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await getInvoices(lotId);
      setInvoices(rows);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les factures.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [lotId]);

  const syncBudgetActual = async (invoicesList: Invoice[]) => {
    const paid = invoicesList.filter((i) => i.status === "payee").reduce((sum, i) => sum + (i.amount ?? 0), 0);
    try {
      await updateLot(lotId, { budgetActual: paid });
      onBudgetUpdated?.();
    } catch {
      // ignore
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    e.target.value = "";
    setUploading(true);
    setFormError(null);
    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^\p{L}\p{N}\s._-]/gu, "").replace(/\s+/g, "_");
      const path = `lots/${lotId}/invoices/${timestamp}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);
      setForm((prev) => ({ ...prev, fileUrl: data.publicUrl }));
    } catch (err: any) {
      setFormError(err?.message ?? "Erreur lors du téléchargement.");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateInvoice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || !form.title.trim() || !form.amount) return;
    const amountNum = Number(form.amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      setFormError("Montant invalide.");
      return;
    }
    if (form.issuedDate && form.dueDate && !isValidDateRange(form.issuedDate, form.dueDate)) {
      setFormError("La date d'échéance doit être supérieure ou égale à la date d'émission.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createInvoice({
        lotId,
        title: form.title.trim(),
        amount: amountNum,
        invoiceNumber: form.invoiceNumber.trim() || null,
        issuedDate: form.issuedDate || null,
        dueDate: form.dueDate || null,
        fileUrl: form.fileUrl.trim() || null,
      });
      setForm({ title: "", amount: "", issuedDate: "", dueDate: "", invoiceNumber: "", fileUrl: "" });
      setFormOpen(false);
      const rows = await getInvoices(lotId);
      setInvoices(rows);
      await syncBudgetActual(rows);
      onBudgetUpdated?.();
    } catch (err: any) {
      setFormError(err?.message ?? "Impossible de créer la facture.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (invoice: Invoice) => {
    if (!canEdit) return;
    try {
      await markInvoicePaid(invoice.id);
      const rows = await getInvoices(lotId);
      setInvoices(rows);
      await syncBudgetActual(rows);
      onBudgetUpdated?.();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de marquer la facture payée.");
    }
  };

  const totalsPaid = invoices.filter((i) => i.status === "payee").reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const totalsEmitted = invoices.reduce((sum, i) => sum + (i.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-gray-900">Factures</div>
          <div className="text-sm text-gray-600">
            Ajoutez des factures pour mettre à jour automatiquement le budget de l'intervention et du projet.
          </div>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setFormOpen((v) => !v);
              setFormError(null);
            }}
          >
            {formOpen ? "Fermer" : "+ Ajouter une facture"}
          </Button>
        )}
      </header>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="text-sm text-gray-500">Chargement...</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-l-4 border-l-emerald-200 bg-emerald-50/20">
              <CardHeader className="border-b border-emerald-100 bg-emerald-50/60">
                <div className="text-sm text-gray-600">Factures payées</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">
                {formatCurrency(totalsPaid)}
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-200 bg-blue-50/20">
              <CardHeader className="border-b border-blue-100 bg-blue-50/60">
                <div className="text-sm text-gray-600">Total factures émises</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">
                {formatCurrency(totalsEmitted)}
              </CardContent>
            </Card>
          </div>

          {formOpen && canEdit && (
            <Card>
              <CardHeader>
                <div className="font-semibold text-gray-900">Nouvelle facture</div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateInvoice} className="space-y-3">
                  {formError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {formError}
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">Titre *</label>
                      <Input
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="Ex: Facture travaux plomberie"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">Montant (€) *</label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">Numéro de facture</label>
                      <Input
                        value={form.invoiceNumber}
                        onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                        placeholder="Ex: FAC-2024-001"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">Fichier PDF</label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          {uploading ? "Téléchargement..." : "Télécharger un fichier"}
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={handleFileSelect}
                          title="Télécharger un fichier PDF"
                          aria-label="Télécharger un fichier PDF"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">Date d'émission</label>
                      <Input
                        type="date"
                        value={form.issuedDate}
                        onChange={(e) =>
                          setForm({ ...form, issuedDate: normalizeDateValue(e.target.value) || e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600">Date d'échéance</label>
                      <Input
                        type="date"
                        value={form.dueDate}
                        onChange={(e) =>
                          setForm({ ...form, dueDate: normalizeDateValue(e.target.value) || e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit" disabled={submitting || !form.title.trim() || !form.amount}>
                      {submitting ? "Création..." : "Créer"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Liste des factures ({invoices.length})</div>
            </CardHeader>
            <CardContent className="space-y-2">
              {invoices.length === 0 ? (
                <div className="text-sm text-gray-500">Aucune facture. Ajoutez une facture pour commencer.</div>
              ) : (
                invoices.map((i) => (
                  <div key={i.id} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900">{i.title}</div>
                        <div className="text-xs text-gray-500">
                          {i.invoice_number ?? "—"} •{" "}
                          {i.issued_date ? `Émise: ${formatDate(i.issued_date)}` : "—"}
                          {i.due_date ? ` • Échéance: ${formatDate(i.due_date)}` : ""}
                          {i.paid_date ? ` • Payée: ${formatDate(i.paid_date)}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">{formatCurrency(i.amount ?? 0)}</div>
                          <div className="text-xs text-gray-500 capitalize">{String(i.status).replace("_", " ")}</div>
                        </div>
                        {i.file_url && (
                          <DocumentPreviewTrigger
                            url={i.file_url}
                            name={i.title || "Facture"}
                            fileType="facture"
                            className="text-sm underline text-primary-700 cursor-pointer hover:no-underline"
                          >
                            Aperçu
                          </DocumentPreviewTrigger>
                        )}
                        {canEdit && i.status !== "payee" && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkPaid(i)}>
                            Marquer payée
                          </Button>
                        )}
                      </div>
                    </div>
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
