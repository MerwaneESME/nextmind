"use client";

import { useEffect, useState } from "react";
import { X, FileText, BarChart2, CheckSquare, Download, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  EXPORT_PRESETS,
  buildExportSystemPrompt,
  parseExportAiContent,
  type ExportPresetId,
} from "@/lib/export-prompt";
import { generateProjectExportPdf } from "@/lib/exportPdf";
import { buildPlanningContext, serializePlanningContext, type InterventionSnapshot } from "@/lib/planning-context";
import type { LotSummary } from "@/lib/lotsDb";
import type { QuoteSummary } from "@/lib/quotesStore";
import { formatCurrency } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  description: string | null;
  project_type: string | null;
  status: string | null;
  address: string | null;
  city: string | null;
  created_at: string | null;
};

type Member = {
  id: string;
  role: string | null;
  status: string | null;
  invited_email: string | null;
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    company_name: string | null;
  } | null;
};

type Task = {
  id: string;
  name: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

type Props = {
  project: Project;
  projectId: string;
  userId: string;
  userRole: "particulier" | "professionnel";
  interventions: LotSummary[];
  members: Member[];
  quotes: QuoteSummary[];
  tasks: Task[];
  onClose: () => void;
};

/** Maps a planning-context snapshot to the LotSummary shape used by PDF/fallback */
function snapshotToLotSummary(snap: InterventionSnapshot): LotSummary {
  const tasksDone = snap.tasks.filter((t) => String(t.status ?? "").toLowerCase() === "done").length;
  const tasksTotal = snap.tasks.length;
  return {
    id: snap.id,
    phaseId: "",
    name: snap.name,
    description: snap.description,
    lotType: snap.lotType,
    companyName: snap.companyName,
    startDate: snap.startDate,
    endDate: snap.endDate,
    tasksStartDate: null,
    tasksEndDate: null,
    budgetEstimated: snap.budgetEstimated,
    budgetActual: snap.budgetActual,
    status: snap.status as LotSummary["status"],
    progressPercentage: snap.progressPercent,
    tasksDone,
    tasksTotal,
  };
}

const PRESET_ICONS = {
  resume: FileText,
  avancement: BarChart2,
  cloture: CheckSquare,
} as const;

type Phase = "select" | "loading" | "preview";

function statusLabel(status: string | null): string {
  switch (status) {
    case "en_cours":
    case "in_progress":
      return "En cours";
    case "termine":
    case "completed":
      return "Terminé";
    case "en_attente":
    case "pending":
      return "En attente";
    default:
      return status ?? "—";
  }
}

function formatMonthYear(date = new Date()): string {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function buildFallbackAiContent(args: {
  project: Project;
  interventions: LotSummary[];
  quotes: QuoteSummary[];
  tasks: Task[];
  presetId: ExportPresetId;
}): {
  report_title: string;
  executive_summary: string;
  key_points: string[];
  section_notes: { budget?: string; interventions?: string; planning?: string; members?: string };
  recommendations: string[];
  conclusion: string;
} {
  const { project, interventions, quotes, tasks, presetId } = args;
  const presetLabel = EXPORT_PRESETS.find((p) => p.id === presetId)?.label ?? "Rapport";

  const done = tasks.filter((t) => (t.status ?? "").toLowerCase() === "done").length;
  const todo = tasks.filter((t) => (t.status ?? "").toLowerCase() === "todo").length;
  const inProgress = tasks.length - done - todo;
  const late = tasks.filter((t) => (t.status ?? "").toLowerCase() === "late").length;

  const validatedQuotesTotal = quotes
    .filter((q) => q.status === "valide")
    .reduce((s, q) => s + (q.totalTtc ?? 0), 0);

  const interventionsCount = interventions.length;
  const avgProgress =
    interventionsCount > 0
      ? Math.round(
          interventions.reduce((s, i) => s + (Number.isFinite(i.progressPercentage) ? i.progressPercentage : 0), 0) /
            interventionsCount
        )
      : 0;

  const title = `${presetLabel} — ${project.name} — ${formatMonthYear()}`;
  const status = statusLabel(project.status);

  const executiveSummary =
    presetId === "resume"
      ? `Ce document présente une synthèse du projet "${project.name}". Statut actuel : ${status}. ${interventionsCount ? `Interventions : ${interventionsCount}.` : ""} ${tasks.length ? `Tâches : ${done}/${tasks.length} terminées.` : ""}`.trim()
      : presetId === "cloture"
        ? `Ce rapport clôture le projet "${project.name}". Statut : ${status}. Il récapitule les éléments clés (budget, interventions, planning) et propose un retour d'expérience actionnable.`
        : `Ce rapport d'avancement fait le point sur le projet "${project.name}". Statut : ${status}. Il synthétise la progression par intervention, l'état des tâches et les points d'attention planning.`;

  const keyPoints: string[] = [
    `Statut : ${status}`,
    interventionsCount ? `Interventions : ${interventionsCount}` : "Interventions : —",
    interventionsCount ? `Avancement moyen (interventions) : ${avgProgress}%` : "",
    tasks.length ? `Tâches : ${done} terminée(s), ${inProgress} en cours, ${todo} à faire${late ? `, ${late} en retard` : ""}` : "",
    validatedQuotesTotal ? `Devis validés (TTC) : ${formatCurrency(validatedQuotesTotal)}` : "",
  ].filter(Boolean);

  const sectionNotes = {
    budget: validatedQuotesTotal
      ? "Les montants TTC ci-dessous reflètent les devis validés. Vérifier l'alignement avec les budgets estimés/réels des interventions si ces champs sont renseignés."
      : undefined,
    interventions: interventionsCount
      ? "La progression est présentée par intervention. Identifier les interventions en retard et sécuriser les dépendances."
      : "Aucune intervention n'est enregistrée dans le projet.",
    planning: tasks.length
      ? "Le planning est basé sur les tâches existantes. Mettre à jour les dates et statuts pour fiabiliser l'analyse."
      : "Aucune tâche n'est enregistrée : le planning ne peut pas être évalué.",
  };

  const recommendations =
    presetId === "cloture"
      ? [
          "Archiver les documents clés (PV, photos, devis/factures) dans le dossier projet.",
          "Formaliser un retour d'expérience (écarts budget/délais, points qualité) pour les prochains projets.",
          "Clôturer les tâches restantes et mettre à jour le statut du projet si nécessaire.",
        ]
      : [
          "Mettre à jour l'avancement des interventions et les statuts des tâches.",
          "Prioriser les points bloquants et sécuriser les jalons de la semaine à venir.",
          "Valider les devis en attente et contrôler l'impact budget avant lancement des interventions critiques.",
        ];

  const conclusion =
    presetId === "cloture"
      ? `Le projet "${project.name}" est en statut "${status}". Ce rapport récapitule les éléments disponibles et peut être complété par les données budgétaires et planning pour une clôture exhaustive.`
      : `Le projet "${project.name}" est en statut "${status}". Une mise à jour régulière des interventions, tâches et devis permettra de fiabiliser le suivi et d'anticiper les risques.`;

  return {
    report_title: title,
    executive_summary: executiveSummary,
    key_points: keyPoints,
    section_notes: sectionNotes,
    recommendations,
    conclusion,
  };
}

export default function ExportProjectModal({
  project,
  projectId,
  userId,
  userRole,
  interventions,
  members,
  quotes,
  tasks,
  onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedPreset, setSelectedPreset] = useState<ExportPresetId | null>(null);
  const [userNotes, setUserNotes] = useState("");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState("");

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const handleClose = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    onClose();
  };

  const handleGenerate = async () => {
    if (!selectedPreset) return;
    setPhase("loading");
    setError(null);

    try {
      if (!userId) {
        throw new Error("Utilisateur non authentifié.");
      }

      // Step 1 — build full project context
      setLoadingStep("Analyse du projet en cours…");
      const ctx = await buildPlanningContext(projectId);
      const projectContext = ctx ? serializePlanningContext(ctx) : `Projet: ${project.name}`;

      // Use interventions from planning context if page state didn't load them yet
      const effectiveInterventions =
        interventions.length > 0
          ? interventions
          : (ctx?.interventions ?? []).map(snapshotToLotSummary);

      // Step 2 — call AI for narrative content
      setLoadingStep("L'agent rédige le rapport…");
      const rawUrl = process.env.NEXT_PUBLIC_AI_API_URL;
      if (!rawUrl) throw new Error("AI API non configurée (NEXT_PUBLIC_AI_API_URL).");
      const apiUrl = rawUrl.replace(/\/+$/, "");

      const systemPrompt = buildExportSystemPrompt(selectedPreset, projectContext, userNotes);
      const endpoint = userRole === "professionnel" ? "/project-chat" : "/project-chat-client";
      const message = `Génère le rapport d'export PDF demandé.

Réponds uniquement avec le JSON demandé (dans un bloc \`\`\`json ... \`\`\`).

---
[INSTRUCTION SYSTÈME — EXPORT PDF]
${systemPrompt}
---`;

      const callAgent = async (userMessage: string) => {
        const response = await fetch(`${apiUrl}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            phase_id: null,
            lot_id: null,
            context_type: "project",
            user_id: userId,
            user_role: userRole,
            message: userMessage,
            history: [{ role: "system", content: systemPrompt }],
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          const detail =
            (errData as any)?.detail ??
            (errData as any)?.error ??
            (errData as any)?.message;
          throw new Error(detail ? String(detail) : `Erreur API : ${response.status}`);
        }

        const data = await response.json();
        return (data?.reply ?? data?.message ?? data?.content ?? JSON.stringify(data)) as string;
      };

      let rawReply = await callAgent(message);
      let aiContent = parseExportAiContent(rawReply);

      // Retry once if the agent didn't output strict JSON
      if (!aiContent) {
        setLoadingStep("Correction du format du rapport…");
        const retryMessage = `Ta réponse précédente n'est pas un JSON valide.

RENVOIE UNIQUEMENT un JSON valide (dans un bloc \`\`\`json ... \`\`\`) conforme au schéma demandé, sans aucun texte avant/après.`;
        rawReply = await callAgent(retryMessage);
        aiContent = parseExportAiContent(rawReply);
      }

      // Fallback to a deterministic report if AI still fails (keeps the export usable)
      if (!aiContent) {
        aiContent = buildFallbackAiContent({
          project,
          interventions: effectiveInterventions,
          quotes,
          tasks,
          presetId: selectedPreset,
        });
      }

      // Step 3 — generate PDF blob
      setLoadingStep("Génération du PDF…");
      const blob = await generateProjectExportPdf(
        project,
        effectiveInterventions,
        members,
        quotes,
        tasks,
        aiContent,
        selectedPreset
      );

      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      setPhase("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setPhase("select");
    }
  };

  const handleDownload = () => {
    if (!blobUrl || !selectedPreset) return;
    const presetLabel = EXPORT_PRESETS.find((p) => p.id === selectedPreset)?.label ?? "rapport";
    const safeName = `${project.name} — ${presetLabel}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s_-]/g, "")
      .trim()
      .replace(/\s+/g, "_");
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${safeName}.pdf`;
    a.click();
  };

  const handleReset = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setSelectedPreset(null);
    setUserNotes("");
    setError(null);
    setPhase("select");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div
        className={cn(
          "bg-white rounded-2xl shadow-2xl flex flex-col w-full max-h-[95vh] overflow-hidden",
          phase === "preview" ? "max-w-5xl" : "max-w-2xl"
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Exporter le projet</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {phase === "select" && "Choisissez le type de rapport à générer"}
              {phase === "loading" && "Génération en cours…"}
              {phase === "preview" && "Rapport prêt — aperçu et téléchargement"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {phase === "preview" && (
              <>
                <Button size="sm" variant="outline" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4" />
                  Nouveau rapport
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-gradient-to-r from-primary-400 to-primary-600"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" />
                  Télécharger
                </Button>
              </>
            )}
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Phase : Select ── */}
        {phase === "select" && (
          <div className="flex flex-col gap-6 p-6 overflow-y-auto">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
                {error}
              </div>
            )}

            <p className="text-sm font-medium text-gray-700">Que souhaitez-vous exporter ?</p>

            {/* Preset cards */}
            <div className="grid grid-cols-3 gap-3">
              {EXPORT_PRESETS.map((preset) => {
                const Icon = PRESET_ICONS[preset.id];
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset.id)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all",
                      isSelected
                        ? "border-primary-600 bg-primary-50 shadow-sm"
                        : "border-neutral-100 bg-white hover:border-primary-300 hover:bg-gray-50"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-lg p-2",
                        isSelected ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-500"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className={cn("text-sm font-semibold", isSelected ? "text-primary-700" : "text-gray-800")}>
                      {preset.label}
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">{preset.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Optional notes */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">
                Précisez vos attentes <span className="font-normal text-gray-400">(optionnel)</span>
              </label>
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Ex : Inclure le détail des tâches en retard, mettre en avant les économies réalisées…"
                rows={3}
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button size="sm" variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button
                size="sm"
                variant="primary"
                className="bg-gradient-to-r from-primary-400 to-primary-600 shadow-md"
                disabled={!selectedPreset}
                onClick={handleGenerate}
              >
                Générer le PDF →
              </Button>
            </div>
          </div>
        )}

        {/* ── Phase : Loading ── */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 px-6">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-primary-100" />
              <Loader2 className="h-16 w-16 text-primary-600 animate-spin absolute inset-0" />
            </div>
            <p className="text-base font-semibold text-gray-700">L'agent génère votre rapport…</p>
            <p className="text-sm text-gray-400">{loadingStep}</p>
          </div>
        )}

        {/* ── Phase : Preview ── */}
        {phase === "preview" && blobUrl && (
          <div className="flex-1 overflow-hidden">
            <iframe
              src={blobUrl}
              title="Aperçu du rapport PDF"
              className="w-full h-full"
              style={{ minHeight: "70vh" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
