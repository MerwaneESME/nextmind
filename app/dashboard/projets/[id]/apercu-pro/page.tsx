"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Image, File } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getProjectDemandeSummary, type DemandeProjetSummary } from "@/lib/projectsDb";
import { getDocuments, type DocumentRow } from "@/lib/db/documentsDb";
import {
  formatQuestionnaireForDisplay,
  getProjectTypeLabel,
  getQuestionnaireFields,
} from "@/lib/projectQuestionnaire";
import { useAuth } from "@/hooks/useAuth";
import { DocumentPreviewTrigger } from "@/components/documents/DocumentPreviewModal";

const APERCU_RECAP_KEY = "nextmind_apercu_recap";

function formatDateFr(dateStr: string | null) {
  if (!dateStr) return "-";
  try {
    return formatDate(dateStr);
  } catch {
    return dateStr;
  }
}

function isImageType(fileType: string): boolean {
  const t = String(fileType).toLowerCase();
  return t === "photo" || t.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(t);
}

export default function ApercuProPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const [recap, setRecap] = useState<Awaited<ReturnType<typeof getProjectDemandeSummary>>["recap"]>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        let recapToUse: DemandeProjetSummary | null = null;
        try {
          const stored = typeof window !== "undefined" ? sessionStorage.getItem(`${APERCU_RECAP_KEY}_${projectId}`) : null;
          if (stored) {
            recapToUse = JSON.parse(stored) as DemandeProjetSummary;
            sessionStorage.removeItem(`${APERCU_RECAP_KEY}_${projectId}`);
          }
        } catch {
          /* ignore */
        }
        if (!recapToUse) {
          const recapRes = await getProjectDemandeSummary(projectId);
          if (cancelled) return;
          if (recapRes.error && !recapRes.recap) {
            setError(recapRes.error);
            setRecap(null);
            setDocuments([]);
            return;
          }
          recapToUse = recapRes.recap;
        }
        const docs = await getDocuments({ projectId }).catch(() => []);
        if (cancelled) return;
        setRecap(recapToUse);
        setDocuments(docs);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Impossible de charger le projet.");
          setRecap(null);
          setDocuments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-neutral-600">
        Chargement du projet...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <Link
          href="/dashboard/messages?role=professionnel"
          className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la messagerie
        </Link>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!recap) {
    return null;
  }

  const r = recap;
  let questionnaireItems = formatQuestionnaireForDisplay(
    r.typeTravaux ?? "",
    r.questionnaireData ?? {}
  );
  if (questionnaireItems.length === 0 && r.questionnaireData && Object.keys(r.questionnaireData).length > 0) {
    const fields = getQuestionnaireFields(r.typeTravaux ?? "");
    const fieldByKey = new Map(fields.map((f) => [f.key, f]));
    questionnaireItems = Object.entries(r.questionnaireData)
      .filter(([, v]) => v != null && v !== "")
      .map(([key, val]) => {
        const field = fieldByKey.get(key);
        let value = String(val);
        if (field?.type === "select" && field.options) {
          const opt = field.options.find((o) => o.value === val || o.value === value);
          if (opt) value = opt.label;
        }
        const label = field?.label?.replace(/\s*\*$/, "") ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
        return { label, value };
      });
  }
  const hasBudgetMin = r.budgetMin != null && Number.isFinite(r.budgetMin);
  const hasBudgetMax = r.budgetMax != null && Number.isFinite(r.budgetMax);
  const images = documents.filter((d) => isImageType(d.file_type));
  const otherDocs = documents.filter((d) => !isImageType(d.file_type));

  const infoRows: { label: string; value: React.ReactNode }[] = [
    { label: "Type de travaux", value: getProjectTypeLabel(r.typeTravaux ?? "") || null },
    { label: "Titre du projet", value: r.titre || null },
    { label: "Adresse du chantier", value: r.adresse || null },
    { label: "Code postal", value: r.codePostal || null },
    { label: "Ville", value: r.ville || null },
    { label: "Description détaillée", value: r.description ? <span className="whitespace-pre-wrap">{r.description}</span> : null },
    ...(r.surfaceSqm != null && Number.isFinite(r.surfaceSqm)
      ? [{ label: "Surface à traiter (m²)", value: String(r.surfaceSqm) }]
      : []),
    ...(hasBudgetMin || hasBudgetMax
      ? [{
          label: "Budget (€)",
          value: hasBudgetMin && hasBudgetMax && r.budgetMin !== r.budgetMax
            ? `${Number(r.budgetMin).toLocaleString("fr-FR")} - ${Number(r.budgetMax).toLocaleString("fr-FR")} €`
            : (hasBudgetMax ? Number(r.budgetMax) : Number(r.budgetMin)).toLocaleString("fr-FR") + " €",
        }]
      : []),
    ...(r.dateDebutSouhaitee ? [{ label: "Date de début souhaitée", value: formatDateFr(r.dateDebutSouhaitee) }] : []),
    ...questionnaireItems.map((item) => ({ label: item.label, value: item.value })),
  ].filter((row) => row.value != null && row.value !== "");

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Link
        href="/dashboard/messages?role=professionnel"
        className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la messagerie
      </Link>

      <h1 className="text-xl font-semibold text-gray-900 mb-6">Détails du projet</h1>

      <section className="mb-8 space-y-4 text-sm">
        {infoRows.map((row, i) => (
          <div key={`${row.label}-${i}`}>
            <div className="text-gray-500 font-medium mb-0.5">{row.label}</div>
            <div className="text-gray-900">{row.value}</div>
          </div>
        ))}
      </section>

      {images.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Image className="w-4 h-4" />
            Photos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {images.map((doc) => (
              <DocumentPreviewTrigger
                key={doc.id}
                url={doc.file_url}
                name={doc.name}
                fileType={doc.file_type}
                className="block aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 hover:border-primary-300 transition-colors cursor-pointer text-left"
              >
                <img src={doc.file_url} alt={doc.name} className="w-full h-full object-cover" />
                <div className="p-2 bg-white border-t border-gray-100">
                  <p className="text-xs text-gray-600 truncate" title={doc.name}>{doc.name}</p>
                </div>
              </DocumentPreviewTrigger>
            ))}
          </div>
        </section>
      )}

      {otherDocs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Documents
          </h2>
          <ul className="space-y-2">
            {otherDocs.map((doc) => (
              <li key={doc.id}>
                <DocumentPreviewTrigger
                  url={doc.file_url}
                  name={doc.name}
                  fileType={doc.file_type}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition-colors cursor-pointer"
                >
                  <File className="w-5 h-5 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500">{(doc.file_size / 1024).toFixed(1)} KB</p>
                  </div>
                </DocumentPreviewTrigger>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
