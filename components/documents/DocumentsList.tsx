"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatDate } from "@/lib/utils";
import { Eye, Trash2 } from "lucide-react";
import {
  deleteDocument,
  getDocuments,
  uploadDocument,
  type DocumentRow,
  type DocumentType,
} from "@/lib/db/documentsDb";

type DocsContext = { projectId?: string; phaseId?: string; lotId?: string };

const fileTypes: Array<{ value: DocumentType; label: string }> = [
  { value: "autre", label: "Autre" },
  { value: "devis", label: "Devis" },
  { value: "facture", label: "Facture" },
  { value: "plan", label: "Plan" },
  { value: "photo", label: "Photo" },
];

type SelectedType = DocumentType | "all";

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function inferTypeFromFile(file: File): DocumentType {
  const mime = String(file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "photo";
  return "autre";
}

export default function DocumentsList({
  context,
  title = "Documents",
  showUpload = true,
}: {
  context: DocsContext;
  title?: string;
  showUpload?: boolean;
}) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<SelectedType>("all");

  const contextKey = useMemo(() => JSON.stringify(context ?? {}), [context]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDocuments({
        ...context,
        fileType: selectedType === "all" ? undefined : selectedType,
      });
      setDocuments(data);
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger les documents.");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey, selectedType]);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    try {
      setUploading(true);
      setError(null);
      const uploadType = selectedType === "all" ? inferTypeFromFile(file) : selectedType;
      await uploadDocument(file, { ...context, fileType: uploadType });
      await loadDocuments();
    } catch (e: any) {
      setError(e?.message ?? "Erreur upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Supprimer ce document ?")) return;
    try {
      setError(null);
      await deleteDocument(docId);
      await loadDocuments();
    } catch (e: any) {
      setError(e?.message ?? "Erreur suppression.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-gray-900">{title}</div>
            <div className="text-sm text-gray-500">
              {documents.length} document{documents.length > 1 ? "s" : ""}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as SelectedType)}
            >
              <option value="all">Tous</option>
              {fileTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            {showUpload && (
              <>
                <label className="inline-flex items-center gap-2">
                  <Input
                    type="file"
                    disabled={uploading}
                    onChange={(e) => {
                      const inputEl = e.currentTarget;
                      const file = inputEl.files?.[0] ?? null;
                      void (async () => {
                        try {
                          await handleUpload(file);
                        } finally {
                          inputEl.value = "";
                        }
                      })();
                    }}
                  />
                </label>
              </>
            )}
          </div>
        </div>
        {error && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </CardHeader>

      <CardContent className="space-y-2">
        {loading ? (
          <div className="text-sm text-gray-500">Chargement...</div>
        ) : documents.length === 0 ? (
          <div className="text-sm text-gray-500">Aucun document pour le moment.</div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
            >
              <div className="min-w-[220px]">
                <div className="font-medium text-gray-900">{doc.name}</div>
                <div className="text-xs text-gray-500">
                  {String(doc.file_type)} • {formatFileSize(doc.file_size)} •{" "}
                  {doc.created_at ? formatDate(doc.created_at) : "-"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={doc.file_url} target="_blank" rel="noreferrer" aria-label="Ouvrir">
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0" title="Ouvrir">
                    <Eye className="h-4 w-4" />
                  </Button>
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => void handleDelete(doc.id)}
                  aria-label="Supprimer"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}

        {uploading && <div className="text-xs text-gray-500">Upload en cours...</div>}
      </CardContent>
    </Card>
  );
}
