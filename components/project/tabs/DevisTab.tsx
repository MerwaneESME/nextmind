import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ProjectDocumentsPanel from "@/components/documents/ProjectDocumentsPanel";
import { deleteDevisWithItems, mapDevisRowToSummary } from "@/lib/devisDb";
import type { QuoteSummary } from "@/lib/quotesStore";
import type { WorkflowStatus } from "@/lib/statusHelpers";
import type { User } from "@/types"; // Adjust if different

export interface DevisTabProps {
  projectId: string;
  user: User | null;
  role: string | null;
  canManageProject: boolean;
  canEditQuotes: boolean;
  quotes: QuoteSummary[];
  loadProject: () => Promise<void>;
  onError: (msg: string) => void;
  setQuotes: React.Dispatch<React.SetStateAction<QuoteSummary[]>>;
}

export function DevisTab({
  projectId,
  user,
  role,
  canManageProject,
  canEditQuotes,
  quotes,
  loadProject,
  onError,
  setQuotes,
}: DevisTabProps) {
  const router = useRouter();
  
  const [availableQuotes, setAvailableQuotes] = useState<QuoteSummary[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [quoteStatusUpdatingId, setQuoteStatusUpdatingId] = useState<string | null>(null);
  const [quoteDeletingId, setQuoteDeletingId] = useState<string | null>(null);
  const [budgetSyncing, setBudgetSyncing] = useState(false);
  const [budgetSyncStep, setBudgetSyncStep] = useState<string | null>(null);

  const loadAvailableQuotes = async () => {
    if (!user?.id) return;
    const { data, error: devisError } = await supabase
      .from("devis")
      .select("id,status,total,updated_at,created_at,metadata,project_id")
      .eq("user_id", user.id)
      .is("project_id", null)
      .order("updated_at", { ascending: false });
    if (devisError) return;
    const mapped = (data ?? []).map((row) => mapDevisRowToSummary(row as any));
    setAvailableQuotes(mapped);
  };

  useEffect(() => {
    void loadAvailableQuotes();
  }, [user?.id]);

  const handleAttachQuote = async (quoteIdOverride?: string) => {
    if (!canEditQuotes) {
      onError("Seuls les professionnels peuvent lier un devis.");
      return;
    }
    const qId = quoteIdOverride ?? selectedQuoteId;
    if (!qId || !user?.id) return;
    
    // Clear previous error
    onError("");
    
    const { data, error: attachError } = await supabase
      .from("devis")
      .update({ project_id: projectId })
      .eq("id", qId)
      .eq("user_id", user.id)
      .select("id");
      
    if (attachError || !data || data.length === 0) {
      onError(attachError?.message ?? "Impossible de lier le devis.");
      return;
    }
    
    setSelectedQuoteId("");
    await loadProject();
    await loadAvailableQuotes();

    // Extraction du total PDF en arrière-plan (le devis lié peut être un PDF sans montant)
    const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL;
    if (apiUrl && user?.id) {
      fetch(`${apiUrl.replace(/\/+$/, "")}/project-refresh-budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, user_id: user.id }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status} from /project-refresh-budget`);
          return res.json();
        })
        .then(async (result: { devis?: Array<{ id: string; total: number | null }> }) => {
          // Si au moins un devis a maintenant un total, recharger depuis Supabase
          // pour que le budget estimé reflète les données persistées
          const hasNewTotal = result.devis?.some((d) => d.total != null);
          if (hasNewTotal) {
            await loadProject();
          }
        })
        .catch((err: unknown) => {
          if (process.env.NODE_ENV === "development") {
            console.warn("[DevisTab] refresh-budget (attach) error:", err);
          }
        });
    }
  };

  const handleUpdateQuoteWorkflow = async (quote: QuoteSummary, nextStatus: WorkflowStatus) => {
    if (!canEditQuotes) {
      onError("Seuls les professionnels peuvent modifier un devis.");
      return;
    }
    if (!projectId) return;
    
    onError("");
    setQuoteStatusUpdatingId(quote.id);
    const base = quote.rawMetadata && typeof quote.rawMetadata === "object" ? quote.rawMetadata : {};
    const statusValue = nextStatus === "a_faire" ? "en_etude" : nextStatus;
    const metadata = {
      ...base,
      workflow_status: nextStatus,
    };
    try {
      const { data, error: updateError } = await supabase
        .from("devis")
        .update({ metadata, status: statusValue, updated_at: new Date().toISOString() })
        .eq("id", quote.id)
        .eq("project_id", projectId)
        .select("id");
      if (updateError || !data || data.length === 0) {
        throw updateError ?? new Error("Impossible de mettre à jour le devis.");
      }
      // Si le devis passe en "validé", on déclenche une synchronisation complète du budget
      if (nextStatus === "valide" && user?.id) {
        const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL;
        if (apiUrl) {
          setBudgetSyncing(true);
          setBudgetSyncStep("Analyse du devis en cours…");
          try {
            const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/project-refresh-budget`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project_id: projectId, user_id: user.id }),
            });
            const result = (await res.json().catch(() => null)) as
              | { devis?: Array<{ id: string; total: number | null }> }
              | null;
            setBudgetSyncStep("Mise à jour du budget du projet…");
            if (result?.devis) {
              setQuotes((prev) =>
                prev.map((q) => {
                  const updated = result.devis!.find((d) => d.id === q.id);
                  if (updated && updated.total != null) {
                    return { ...q, totalTtc: updated.total };
                  }
                  return q;
                })
              );
            }
          } catch (err: unknown) {
            // échec silencieux en prod, log en dev
            if (process.env.NODE_ENV === "development") {
              console.warn("[DevisTab] refresh-budget (update workflow) error:", err);
            }
          } finally {
            setBudgetSyncStep(null);
            setBudgetSyncing(false);
          }
        }
      }
      await loadProject();
    } catch (err: any) {
      onError(err?.message ?? "Impossible de mettre à jour le devis.");
    } finally {
      setQuoteStatusUpdatingId(null);
    }
  };

  const normalizeStoragePath = (bucket?: string, path?: string) => {
    if (!bucket || !path) return path;
    return path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  };

  const handleDeleteQuote = async (quote: QuoteSummary) => {
    if (!canEditQuotes) {
      onError("Seuls les professionnels peuvent supprimer un devis.");
      return;
    }
    if (!user?.id) return;
    const confirmed =
      typeof window !== "undefined" && window.confirm("Etes-vous sur de vouloir supprimer ce devis ?");
    if (!confirmed) return;
    
    setQuoteDeletingId(quote.id);
    onError("");
    try {
      const bucket =
        typeof quote.rawMetadata?.pdf_bucket === "string" ? quote.rawMetadata.pdf_bucket : undefined;
      const rawPath =
        typeof quote.rawMetadata?.pdf_path === "string" ? quote.rawMetadata.pdf_path : undefined;
      const path = normalizeStoragePath(bucket, rawPath);
      await deleteDevisWithItems(user.id, quote.id, { bucket, path });
      await loadProject();
      await loadAvailableQuotes();
    } catch (err: any) {
      onError(err?.message ?? "Impossible de supprimer le devis.");
    } finally {
      setQuoteDeletingId(null);
    }
  };

  const handleViewQuote = (quote: QuoteSummary) => {
    router.push(`/dashboard/devis/visualiser/${quote.id}?role=${role}`);
  };

  const handleDownloadQuote = async (quote: QuoteSummary) => {
    const bucket =
      typeof quote.rawMetadata?.pdf_bucket === "string" ? quote.rawMetadata.pdf_bucket : undefined;
    const rawPath =
      typeof quote.rawMetadata?.pdf_path === "string" ? quote.rawMetadata.pdf_path : undefined;
    const path = normalizeStoragePath(bucket, rawPath);
    if (bucket && path) {
      const { data } = await supabase.storage.from(bucket).download(path);
      if (data) {
        const url = URL.createObjectURL(data);
        const link = document.createElement("a");
        link.href = url;
        link.download = quote.fileName || `${quote.title}.pdf`;
        link.rel = "noopener";
        link.click();
      }
    }
  };

  return (
    <>
      <ProjectDocumentsPanel
        context={{ kind: "project", projectId }}
        canUpload={canManageProject}
        quotes={quotes}
        canEditQuotes={canEditQuotes}
        availableQuotes={availableQuotes}
        selectedQuoteId={selectedQuoteId}
        onSetSelectedQuoteId={setSelectedQuoteId}
        onAttachQuote={handleAttachQuote}
        quoteStatusUpdatingId={quoteStatusUpdatingId}
        quoteDeletingId={quoteDeletingId}
        onUpdateWorkflow={handleUpdateQuoteWorkflow}
        onDeleteQuote={handleDeleteQuote}
        onDownloadQuote={handleDownloadQuote}
        onViewQuote={handleViewQuote}
      />

      {budgetSyncing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-neutral-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12">
                <div className="h-12 w-12 rounded-full border-4 border-primary-100" />
                <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" />
              </div>
              <div>
                <div className="text-base font-semibold text-neutral-900">
                  L’agent met à jour le budget…
                </div>
                <div className="text-sm text-neutral-500">
                  {budgetSyncStep ?? "Extraction des montants du devis et synchronisation avec le projet."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
