"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ArrowLeft, Download, Save } from "lucide-react";
import { QuotePreviewData } from "@/lib/quotesStore";
import { calculateTotals } from "@/lib/quotePreview";
import { findDevisByPreviewId, saveDevisFromPreview } from "@/lib/devisDb";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { downloadQuotePdf } from "@/lib/quotePdf";

const QUOTE_PREVIEW_KEY = "quote_preview";

const createPreviewId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `preview_${Date.now()}`;
};

export default function DevisPreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const roleParam = searchParams.get("role");
  const role = roleParam === "professionnel" ? "professionnel" : "particulier";

  const [payload, setPayload] = useState<QuotePreviewData | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const previewIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    const stored = sessionStorage.getItem(QUOTE_PREVIEW_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as QuotePreviewData;
      setPayload(parsed);
    } catch {
      setPayload(null);
    }
  }, []);

  const totals = useMemo(() => {
    if (!payload) return { ht: 0, tva: 0, ttc: 0 };
    return calculateTotals(payload);
  }, [payload]);

  const formattedDate = useMemo(() => {
    if (!payload?.createdAt) return formatDate(new Date().toISOString());
    return formatDate(payload.createdAt);
  }, [payload?.createdAt]);

  const resolvePreviewId = () => {
    if (!previewIdRef.current) {
      previewIdRef.current = payload?.createdAt ? `preview_${payload.createdAt}` : createPreviewId();
    }
    return previewIdRef.current;
  };

  const handleDownload = () => {
    if (!payload) return;
    const title = payload.projectType ? `Devis ${payload.projectType}` : "Devis";
    downloadQuotePdf(payload, title);
  };

  const handleSave = async () => {
    if (!payload) return;
    if (!user?.id) {
      setSaveError("Connectez-vous pour sauvegarder le devis.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const previewId = resolvePreviewId();
      await saveDevisFromPreview(user.id, payload, "en_etude", previewId);
      setSaved(true);
    } catch (err: any) {
      setSaveError(err?.message ?? "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!payload || !user?.id) return;
    const previewId = resolvePreviewId();
    findDevisByPreviewId(user.id, previewId)
      .then((row) => setSaved(Boolean(row)))
      .catch(() => setSaved(false));
  }, [payload, user?.id]);

  if (!payload) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Aucun devis à afficher</h2>
          <p className="text-sm text-gray-600">Retournez au formulaire pour generer un apercu.</p>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => router.push(`/dashboard/devis/creer?role=${role}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au formulaire
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide">Devis</p>
          <h1 className="text-3xl font-bold text-gray-900">Apercu PDF</h1>
          <p className="text-gray-600">Visualisez le rendu avant le telechargement.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/devis/creer?role=${role}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Modifier
          </Button>
          <Button onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Télécharger PDF
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={saved || saving}>
            <Save className="w-4 h-4 mr-2" />
            {saved ? "Devis sauvegarde" : saving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
        {saveError && <div className="text-sm text-red-600">{saveError}</div>}
      </div>

      <div className="max-w-5xl rounded-2xl border border-gray-200 bg-white shadow-sm p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <div className="text-2xl font-bold text-gray-900">Devis</div>
            <div className="text-sm text-gray-500">Date: {formattedDate}</div>
            <div className="text-sm text-gray-500">Projet: {payload.projectType || "-"}</div>
          </div>
          <div className="text-right text-sm text-gray-600">
            <div className="font-semibold text-gray-900">{payload.companyName || "-"}</div>
            <div className="mt-1">Client: {payload.clientName || "-"}</div>
            {payload.clientEmail && <div>Email: {payload.clientEmail}</div>}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
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
              {payload.lines.map((line) => {
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

        <div className="mt-6 flex justify-end">
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
      </div>
    </div>
  );
}
