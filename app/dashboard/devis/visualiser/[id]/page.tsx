"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, Download, Minus, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { deleteDevisWithItems, fetchDevisById } from "@/lib/devisDb";
import { QuoteSummary } from "@/lib/quotesStore";
import { formatCurrency, formatDate } from "@/lib/utils";
import { downloadQuotePdf } from "@/lib/quotePdf";
import { supabase } from "@/lib/supabaseClient";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function DevisViewerPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const roleParam = searchParams.get("role");
  const role = roleParam === "professionnel" ? "professionnel" : "particulier";
  const devisId = typeof params.id === "string" ? params.id : "";

  const [quote, setQuote] = useState<QuoteSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileSource, setFileSource] = useState<Blob | string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);

  const hasPdfMeta = Boolean(
    fileSource ||
      quote?.rawMetadata?.pdf_bucket ||
      quote?.rawMetadata?.pdf_path ||
      quote?.fileUrl
  );

  const normalizeStoragePath = (bucket: string, path: string) =>
    path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;

  useEffect(() => {
    if (!user?.id || !devisId) return;
    setLoading(true);
    setError("");
    fetchDevisById(user.id, devisId)
      .then((data) => setQuote(data))
      .catch((err: any) => setError(err?.message ?? "Impossible de charger le devis."))
      .finally(() => setLoading(false));
  }, [user?.id, devisId]);

  useEffect(() => {
    let active = true;

    const loadPdf = async () => {
      if (!quote) return;
      setFileLoading(true);
      setFileError(null);
      const metadata = quote.rawMetadata ?? {};
      const bucket = typeof metadata.pdf_bucket === "string" ? metadata.pdf_bucket : null;
      const rawPath = typeof metadata.pdf_path === "string" ? metadata.pdf_path : null;

      if (!bucket || !rawPath) {
        setFileSource(quote.fileUrl ?? null);
        setFileLoading(false);
        return;
      }

      const path = normalizeStoragePath(bucket, rawPath);
      const { data, error: downloadError } = await supabase.storage.from(bucket).download(path);
      if (!active) return;
      if (!downloadError && data) {
        setFileSource(data);
        setFileLoading(false);
        return;
      }

      const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
      if (!active) return;
      if (signed?.signedUrl) {
        setFileSource(signed.signedUrl);
      } else {
        setFileSource(quote.fileUrl ?? null);
        if (!quote.fileUrl) {
          setFileError("Impossible de charger le PDF.");
        }
      }
      setFileLoading(false);
    };

    if (quote?.rawMetadata?.pdf_bucket || quote?.fileUrl) {
      void loadPdf();
    } else {
      setFileSource(null);
      setFileError(null);
      setFileLoading(false);
    }

    return () => {
      active = false;
    };
  }, [quote]);

  const title = quote?.title ?? "Devis";
  const clientName = quote?.clientName ?? "-";
  const previewData = quote?.previewData ?? null;
  const documentFile = useMemo(() => {
    if (fileSource) return fileSource;
    if (quote?.fileUrl) return quote.fileUrl;
    return null;
  }, [fileSource, quote?.fileUrl]);

  const totals = useMemo(() => {
    if (!previewData) return { ht: 0, tva: 0, ttc: 0 };
    const totalHT = previewData.lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPrice,
      0
    );
    const totalTVA = totalHT * 0.2;
    return { ht: totalHT, tva: totalTVA, ttc: totalHT + totalTVA };
  }, [previewData]);

  const handleDownload = async () => {
    if (fileSource instanceof Blob) {
      const url = URL.createObjectURL(fileSource);
      const link = document.createElement("a");
      link.href = url;
      link.download = quote?.fileName || `${title}.pdf`;
      link.rel = "noopener";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return;
    }

    const metadata = quote?.rawMetadata ?? {};
    const bucket = typeof metadata.pdf_bucket === "string" ? metadata.pdf_bucket : null;
    const rawPath = typeof metadata.pdf_path === "string" ? metadata.pdf_path : null;
    if (bucket && rawPath) {
      const path = normalizeStoragePath(bucket, rawPath);
      const { data } = await supabase.storage.from(bucket).download(path);
      if (data) {
        const buffer = await data.arrayBuffer();
        const blob = new Blob([new Uint8Array(buffer)], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = quote?.fileName || `${title}.pdf`;
        link.rel = "noopener";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return;
      }
    }

    const downloadUrl = (typeof fileSource === "string" ? fileSource : null) ?? quote?.fileUrl ?? null;
    if (downloadUrl) {
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = quote?.fileName || `${title}.pdf`;
      link.rel = "noopener";
      link.click();
      return;
    }
    if (previewData) {
      downloadQuotePdf(previewData, title);
    }
  };

  const handleDelete = async () => {
    if (!user?.id || !quote?.id) return;
    const confirmed =
      typeof window !== "undefined" &&
      window.confirm("Etes-vous sur de vouloir supprimer ce devis ?");
    if (!confirmed) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const bucket = quote.rawMetadata?.pdf_bucket;
      const path = quote.rawMetadata?.pdf_path;
      await deleteDevisWithItems(user.id, quote.id, {
        bucket: typeof bucket === "string" ? bucket : undefined,
        path:
          typeof bucket === "string" && typeof path === "string"
            ? normalizeStoragePath(bucket, path)
            : undefined,
      });
      router.push(`/dashboard/devis?role=${role}`);
    } catch (err: any) {
      setDeleteError(err?.message ?? "Impossible de supprimer le devis.");
    } finally {
      setIsDeleting(false);
    }
  };

  const onDocumentLoad = ({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setPageNumber(1);
  };

  const changePage = (offset: number) => {
    setPageNumber((prev) => Math.min(Math.max(prev + offset, 1), numPages || 1));
  };

  if (loading) {
    return <div className="text-sm text-gray-600">Chargement du devis...</div>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="outline" onClick={() => router.push(`/dashboard/devis?role=${role}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux devis
        </Button>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Devis introuvable.</p>
        <Button variant="outline" onClick={() => router.push(`/dashboard/devis?role=${role}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux devis
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-600">Client: {clientName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/devis?role=${role}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <Button variant="outline" onClick={handleDelete} disabled={isDeleting}>
            <Trash2 className="w-4 h-4 mr-2 text-red-600" />
            {isDeleting ? "Suppression..." : "Supprimer"}
          </Button>
          <Button onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Télécharger
          </Button>
        </div>
        {deleteError && <div className="text-sm text-red-600">{deleteError}</div>}
      </div>

      {hasPdfMeta ? (
        <Card className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => changePage(-1)} disabled={pageNumber <= 1}>
                Precedent
              </Button>
              <span className="text-sm text-gray-600">
                Page {pageNumber} / {numPages || 1}
              </span>
              <Button variant="outline" size="sm" onClick={() => changePage(1)} disabled={pageNumber >= numPages}>
                Suivant
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setScale((prev) => Math.max(prev - 0.1, 0.6))}>
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-600">{Math.round(scale * 100)}%</span>
              <Button variant="outline" size="sm" onClick={() => setScale((prev) => Math.min(prev + 0.1, 1.6))}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex justify-center overflow-auto bg-gray-50 rounded-lg p-4 min-h-[300px]">
            {fileLoading ? (
              <div className="text-sm text-gray-600">Chargement du PDF...</div>
            ) : documentFile ? (
              <Document
                file={documentFile}
                onLoadSuccess={onDocumentLoad}
                onLoadError={() => setFileError("Impossible de charger le PDF.")}
                loading="Chargement..."
                error={<div className="text-sm text-red-600">Impossible de charger le PDF.</div>}
              >
                <Page pageNumber={pageNumber} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
              </Document>
            ) : (
              <div className="text-sm text-red-600">{fileError ?? "Impossible de charger le PDF."}</div>
            )}
          </div>
          {fileError && !fileLoading && <div className="text-sm text-red-600">{fileError}</div>}
        </Card>
      ) : (
        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-4">
            <div>
              <div className="text-xl font-bold text-gray-900">Devis</div>
              <div className="text-sm text-gray-500">Date: {formatDate(quote.updatedAt)}</div>
              <div className="text-sm text-gray-500">Projet: {previewData?.projectType || "-"}</div>
            </div>
            <div className="text-right text-sm text-gray-600">
              <div className="font-semibold text-gray-900">{previewData?.companyName || "-"}</div>
              <div className="mt-1">Client: {previewData?.clientName || "-"}</div>
              {previewData?.clientEmail && <div>Email: {previewData.clientEmail}</div>}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="border border-gray-200 px-3 py-2 text-left">Description</th>
                  <th className="border border-gray-200 px-3 py-2 text-left">Unite</th>
                  <th className="border border-gray-200 px-3 py-2 text-right">Qte</th>
                  <th className="border border-gray-200 px-3 py-2 text-right">PU HT</th>
                  <th className="border border-gray-200 px-3 py-2 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {previewData?.lines.map((line) => {
                  const lineTotal = line.quantity * line.unitPrice;
                  return (
                    <tr key={line.id}>
                      <td className="border border-gray-200 px-3 py-2">{line.description || "-"}</td>
                      <td className="border border-gray-200 px-3 py-2">{line.unit || "-"}</td>
                      <td className="border border-gray-200 px-3 py-2 text-right">{line.quantity}</td>
                      <td className="border border-gray-200 px-3 py-2 text-right">
                        {formatCurrency(line.unitPrice)}
                      </td>
                      <td className="border border-gray-200 px-3 py-2 text-right">
                        {formatCurrency(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-[320px] space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Total HT</span>
                <span className="font-semibold text-gray-900">{formatCurrency(totals.ht)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>TVA (20%)</span>
                <span className="font-semibold text-gray-900">{formatCurrency(totals.tva)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-gray-900">
                <span className="font-semibold">Total TTC</span>
                <span className="text-lg font-bold">{formatCurrency(totals.ttc)}</span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
