"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Eye, Plus, FileText, Download, Upload, Paperclip, Trash2, Clock, Send, CheckCircle2, Euro } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QuoteSummary } from "@/lib/quotesStore";
import { attachPdfToDevis, deleteDevisWithItems, fetchDevisForUser, saveUploadedDevis } from "@/lib/devisDb";
import { downloadQuotePdf } from "@/lib/quotePdf";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";

type WorkflowStatus = "a_faire" | "envoye" | "valide" | "refuse";

const resolveWorkflowStatus = (quote: QuoteSummary): WorkflowStatus => {
  const metadata = quote.rawMetadata ?? {};
  const workflow =
    typeof metadata.workflow_status === "string" ? metadata.workflow_status : null;
  if (workflow === "a_faire" || workflow === "envoye" || workflow === "valide" || workflow === "refuse") {
    return workflow;
  }
  const status = typeof quote.status === "string" ? quote.status.toLowerCase() : "";
  if (status === "valide" || status === "refuse") {
    return status as WorkflowStatus;
  }
  if (status === "envoye" || status === "published") {
    return "envoye";
  }
  return "a_faire";
};

export default function DevisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const roleParam = searchParams.get("role");
  const role =
    user?.role ?? (roleParam === "professionnel" ? "professionnel" : "particulier");
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "a_faire" | "envoye" | "valide">("all");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const [attachTargetId, setAttachTargetId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const normalizeStoragePath = (bucket?: string, path?: string) => {
    if (!bucket || !path) return path;
    return path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  };

  const loadQuotes = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDevisForUser(user.id);
      setQuotes(data);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les devis.");
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQuotes();
  }, [user?.id]);

  const getStatusBadge = (status: WorkflowStatus) => {
    const styles = {
      a_faire: "bg-gray-100 text-gray-800",
      envoye: "bg-blue-100 text-blue-800",
      valide: "bg-green-100 text-green-800",
      refuse: "bg-red-100 text-red-800",
    };
    return styles[status];
  };

  const getStatusLabel = (status: WorkflowStatus) => {
    const labels: Record<WorkflowStatus, string> = {
      a_faire: "En étude",
      envoye: "Envoyé",
      valide: "Validé",
      refuse: "Refusé",
    };
    return labels[status];
  };

  const filteredQuotes = useMemo(() => {
    if (filter === "all") return quotes;
    return quotes.filter((q) => resolveWorkflowStatus(q) === filter);
  }, [filter, quotes]);

  const stats = useMemo(() => {
    const counters = {
      a_faire: 0,
      envoye: 0,
      valide: 0,
    };
    let total = 0;
    quotes.forEach((quote) => {
      const status = resolveWorkflowStatus(quote);
      if (status === "a_faire") counters.a_faire += 1;
      if (status === "envoye") counters.envoye += 1;
      if (status === "valide") counters.valide += 1;
      if (typeof quote.totalTtc === "number") total += quote.totalTtc;
    });
    return { ...counters, total };
  }, [quotes]);

  const handleView = (quote: QuoteSummary) => {
    router.push(`/dashboard/devis/visualiser/${quote.id}?role=${role}`);
  };

  const handleDownload = async (quote: QuoteSummary) => {
    const bucket = typeof quote.rawMetadata?.pdf_bucket === "string" ? quote.rawMetadata.pdf_bucket : undefined;
    const rawPath = typeof quote.rawMetadata?.pdf_path === "string" ? quote.rawMetadata.pdf_path : undefined;
    const path = normalizeStoragePath(bucket, rawPath);
    if (bucket && path) {
      const { data } = await supabase.storage.from(bucket).download(path);
      if (data) {
        const buffer = await data.arrayBuffer();
        const blob = new Blob([new Uint8Array(buffer)], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = quote.fileName || `${quote.title}.pdf`;
        link.rel = "noopener";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return;
      }
    }
    if (quote.fileUrl) {
      const link = document.createElement("a");
      link.href = quote.fileUrl;
      link.download = quote.fileName || `${quote.title}.pdf`;
      link.rel = "noopener";
      link.click();
      return;
    }
    if (quote.previewData) {
      downloadQuotePdf(quote.previewData, quote.title);
    }
  };

  const handleDelete = async (quote: QuoteSummary) => {
    if (!user?.id) return;
    const confirmed =
      typeof window !== "undefined" &&
      window.confirm("Etes-vous sur de vouloir supprimer ce devis ?");
    if (!confirmed) return;
    setDeletingId(quote.id);
    setError(null);
    try {
      const bucket = typeof quote.rawMetadata?.pdf_bucket === "string" ? quote.rawMetadata.pdf_bucket : undefined;
      const rawPath = typeof quote.rawMetadata?.pdf_path === "string" ? quote.rawMetadata.pdf_path : undefined;
      const path = normalizeStoragePath(bucket, rawPath);
      await deleteDevisWithItems(user.id, quote.id, { bucket, path });
      await loadQuotes();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de supprimer le devis.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleUploadClick = () => {
    uploadInputRef.current?.click();
  };

  const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;
    try {
      await saveUploadedDevis(user.id, file);
      await loadQuotes();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de publier le devis.");
    } finally {
      event.target.value = "";
    }
  };

  const handleAttachClick = (quoteId: string) => {
    setAttachTargetId(quoteId);
    attachInputRef.current?.click();
  };

  const handleAttachFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !attachTargetId || !user?.id) return;
    const target = quotes.find((quote) => quote.id === attachTargetId);
    if (!target) return;
    try {
      await attachPdfToDevis(user.id, target, file);
      await loadQuotes();
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'attacher le PDF.");
    } finally {
      setAttachTargetId(null);
      event.target.value = "";
    }
  };

  const handleCreate = () => {
    const roleParam = searchParams.get("role");
    const role =
      user?.role ?? (roleParam === "professionnel" ? "professionnel" : "particulier");
    router.push(`/dashboard/devis/creer?role=${role}`);
  };

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
        <div className="relative flex items-start justify-between gap-6 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Devis</h1>
              <p className="text-neutral-600 mt-1">Gérez vos devis et factures</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
                  {quotes.length} devis
                </span>
                {quotes.filter((q) => resolveWorkflowStatus(q) === "valide").length > 0 && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1">
                    {quotes.filter((q) => resolveWorkflowStatus(q) === "valide").length} validé{quotes.filter((q) => resolveWorkflowStatus(q) === "valide").length !== 1 ? "s" : ""}
                  </span>
                )}
                {quotes.filter((q) => resolveWorkflowStatus(q) === "envoye").length > 0 && (
                  <span className="rounded-full border border-primary-200 bg-primary-50 text-primary-700 px-3 py-1">
                    {quotes.filter((q) => resolveWorkflowStatus(q) === "envoye").length} envoyé{quotes.filter((q) => resolveWorkflowStatus(q) === "envoye").length !== 1 ? "s" : ""}
                  </span>
                )}
                <button
                  onClick={handleUploadClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-neutral-300 bg-white text-neutral-700 font-medium text-xs hover:bg-neutral-50 transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  Uploader un devis
                </button>
                <button
                  onClick={handleCreate}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-primary-400 to-primary-600 text-white font-semibold text-xs shadow-sm hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-3 h-3" />
                  Nouveau devis
                </button>
              </div>
            </div>
          </div>
          <img
            src="/images/devis.png"
            alt="Devis"
            className="hidden sm:block h-20 w-20 object-contain opacity-90 logo-blend flex-shrink-0"
          />
        </div>
      </header>
      <input
        ref={uploadInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleUploadFile}
      />
      <input
        ref={attachInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleAttachFile}
      />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("a_faire")} role="button">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
          <CardContent className="relative z-10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">En étude</p>
                <p className="text-2xl font-bold text-gray-900">{stats.a_faire}</p>
              </div>
              <Clock className="w-8 h-8 text-neutral-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("envoye")} role="button">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
          <CardContent className="relative z-10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Envoyés</p>
                <p className="text-2xl font-bold text-gray-900">{stats.envoye}</p>
              </div>
              <Send className="w-8 h-8 text-primary-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("valide")} role="button">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
          <CardContent className="relative z-10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Validés</p>
                <p className="text-2xl font-bold text-gray-900">{stats.valide}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
          <CardContent className="relative z-10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.total)}
                </p>
              </div>
              <Euro className="w-8 h-8 text-primary-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Liste des devis ({filteredQuotes.length})
            </h2>
            {filter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>
                Reinitialiser
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          {loading ? (
            <p className="text-sm text-gray-500">Chargement des devis...</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projet</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date de création</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {filteredQuotes.map((quote) => {
                    const workflowStatus = resolveWorkflowStatus(quote);
                    return (
                      <TableRow key={quote.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{quote.title}</p>
                            {quote.clientName && (
                              <p className="text-xs text-gray-500">Client: {quote.clientName}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {typeof quote.totalTtc === "number" ? formatCurrency(quote.totalTtc) : "-"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(
                              workflowStatus
                            )}`}
                          >
                            {getStatusLabel(workflowStatus)}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {formatDate(quote.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(quote)}
                              disabled={!quote.fileUrl && !quote.previewData}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(quote)}
                              disabled={!quote.fileUrl && !quote.previewData}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            {!quote.fileUrl && (
                              <Button variant="ghost" size="sm" onClick={() => handleAttachClick(quote.id)}>
                                <Paperclip className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(quote)}
                              disabled={deletingId === quote.id}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </tbody>
              </Table>
              {!filteredQuotes.length && (
                <p className="text-sm text-gray-500 mt-4">Aucun devis pour ce filtre.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
