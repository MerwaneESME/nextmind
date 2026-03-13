import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ActionMenu } from "@/components/assistant/ActionMenu";
import { ChatMessageMarkdown } from "@/components/chat/ChatMessageMarkdown";
import { formatAssistantReply, type AssistantUiMode } from "@/lib/assistantResponses";
import { detectPlanningIntent } from "@/lib/planning-prompt";
import { sendPlanningMessageToAI, type PlanningProposal, type PlanningSuggestedTask } from "@/lib/ai-service";
import { getOrCreateDefaultPhase, createLot, type LotSummary } from "@/lib/lotsDb";
import { createLotTask, deleteAllLotTasks } from "@/lib/lotTasksDb";
import { supabase } from "@/lib/supabaseClient";
import { cn, isValidDateRange } from "@/lib/utils";
import type { Task } from "@/lib/taskHelpers";
import type { QuoteSummary } from "@/lib/quotesStore";
import type { User } from "@/types";

type Project = {
  id: string;
  name: string;
  description: string | null;
  project_type: string | null;
  status: string | null;
  address: string | null;
  city: string | null;
  created_by?: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata?: Record<string, unknown> | null;
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
    avatar_url?: string | null;
  } | null;
};

type AssistantActionButton = {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
  color?: string;
  title?: string;
  description?: string;
};

type AssistantProposal = any;
type AssistantPlanningProposal = any;
type AssistantTask = any;

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  proposal?: AssistantProposal | null;
  planningProposal?: AssistantPlanningProposal | null;
  requires_devis?: boolean;
  suggestions?: string[];
  quickActions?: any[];
  attachedFileName?: string | null;
};

const TASK_STATUS_DB_MAP: Record<string, string[]> = {
  not_started: ["to_do", "a_faire", "todo"],
  in_progress: ["in_progress", "en_cours"],
  done: ["done", "termine"],
};

export interface AssistantTabProps {
  projectId: string;
  user: User | null;
  userRole: string; // from mapUserTypeToRole
  project: Project | null;
  totalBudget: number;
  quotes: QuoteSummary[];
  canUseAssistantPlanning: boolean;
  loadProject: () => Promise<void>;
  contextPhaseId?: string | null;
  contextLotId?: string | null;
  openGuide: (section?: string, patch?: Record<string, string | null | undefined>) => void;
}

export function AssistantTab({
  projectId,
  user,
  userRole,
  project,
  totalBudget,
  quotes,
  canUseAssistantPlanning,
  loadProject,
  contextPhaseId,
  contextLotId,
  openGuide,
}: AssistantTabProps) {
  const getAssistantIntro = (roleValue: string) =>
    roleValue === "professionnel"
      ? "Bonjour ! Je suis votre assistant IA BTP. J'ai accès à l'ensemble de votre projet : interventions, tâches, équipe et budget. Posez-moi vos questions sur l'avancement, les délais ou la planification."
      : "Bonjour ! Je suis votre assistant IA BTP. Je suis au courant de l'avancement de votre projet et je peux répondre à toutes vos questions sur les travaux, les étapes et le budget.";

  const assistantIntroVariants = [
    "Bonjour ! Je suis votre assistant IA BTP. J'ai accès à l'ensemble de votre projet : interventions, tâches, équipe et budget. Posez-moi vos questions sur l'avancement, les délais ou la planification.",
    "Bonjour ! Je suis votre assistant IA BTP. Je suis au courant de l'avancement de votre projet et je peux répondre à toutes vos questions sur les travaux, les étapes et le budget.",
  ];

  const assistantContextType = contextLotId ? "lot" : contextPhaseId ? "phase" : "project";

  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content: getAssistantIntro(userRole),
      timestamp: new Date().toISOString(),
    },
  ]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantStreamingContent, setAssistantStreamingContent] = useState<string | null>(null);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantNotice, setAssistantNotice] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = useState<AssistantProposal | null>(null);
  const [pendingPlanningProposal, setPendingPlanningProposal] = useState<AssistantPlanningProposal | null>(null);
  const [assistantActiveAction, setAssistantActiveAction] = useState<AssistantActionButton["id"] | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const assistantSectionRef = useRef<HTMLDivElement | null>(null);
  const assistantMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const assistantMessagesEndRef = useRef<HTMLDivElement | null>(null);

  const pendingSuggestedInterventions = pendingPlanningProposal?.suggested_interventions ?? [];
  const pendingNextWeekPriorities = pendingPlanningProposal?.next_week_priorities ?? [];
  const pendingLegacySummary = pendingProposal?.summary ?? "";
  const pendingLegacyTasks = pendingProposal?.tasks ?? [];

  useEffect(() => {
    const container = assistantMessagesContainerRef.current;
    if (!container) return;
    const animateScrollTop = (el: { scrollTop: number }, to: number, durationMs = 650) => {
      const from = el.scrollTop;
      const delta = to - from;
      if (!Number.isFinite(delta) || Math.abs(delta) < 2) return;
      const start = performance.now();
      const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const step = (now: number) => {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / durationMs);
        el.scrollTop = from + delta * easeInOutCubic(t);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    animateScrollTop(container, container.scrollHeight, 700);
  }, [assistantLoading, assistantMessages.length]);

  useEffect(() => {
    setAssistantMessages((prev) => {
      if (prev.length !== 1) return prev;
      if (prev[0]?.role !== "assistant") return prev;
      if (!assistantIntroVariants.includes(prev[0]?.content ?? "")) return prev;
      const nextContent = getAssistantIntro(userRole);
      if (prev[0].content === nextContent) return prev;
      return [{ ...prev[0], content: nextContent }];
    });
  }, [userRole]);

  const streamText = async (text: string) => {
    const words = text.split(" ");
    for (let i = 0; i < words.length; i++) {
      setAssistantStreamingContent((prev) => (prev ?? "") + words[i] + (i < words.length - 1 ? " " : ""));
      await new Promise<void>((r) => setTimeout(r, 20));
    }
  };

  const sendAssistantMessage = async (
    content: string,
    options?: { forcePlan?: boolean; uiMode?: AssistantUiMode; actionId?: string; file?: File }
  ) => {
    if (!user?.id || !projectId) return;
    if (assistantLoading) return;

    const attachedFile = options?.file ?? selectedFile ?? null;
    const attachedFileName = attachedFile?.name ?? null;

    const rawTrimmed = content.trim();
    const trimmed = rawTrimmed || (attachedFile ? `Analyse ce document : ${attachedFile.name}` : "");
    if (!trimmed) return;

    setAssistantError(null);
    setAssistantNotice(null);

    if (options?.actionId) {
      setAssistantActiveAction(options.actionId);
    }

    const userMessage: AssistantMessage = {
      role: "user",
      content: rawTrimmed || `📎 ${attachedFile?.name ?? "fichier joint"}`,
      timestamp: new Date().toISOString(),
      attachedFileName,
    };
    setAssistantMessages((prev) => [...prev, userMessage]);
    setAssistantInput("");
    setSelectedFile(null);
    setAssistantLoading(true);
    setAssistantStreamingContent("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL;
      if (!apiUrl) {
        throw new Error("AI API non configuree");
      }

      const history = [
        ...assistantMessages.slice(-5).map((item) => ({ role: item.role, content: item.content })),
        { role: "user" as const, content: trimmed },
      ];

      const isForcePlan = options?.forcePlan ?? detectPlanningIntent(trimmed);

      if (isForcePlan) {
        const planningResult = await sendPlanningMessageToAI(
          trimmed,
          {
            userId: user.id,
            userRole: userRole as "professionnel" | "particulier",
            projectId,
            phaseId: contextPhaseId ?? undefined,
            lotId: contextLotId ?? undefined,
            contextType: assistantContextType as "project" | "phase" | "lot",
            forcePlan: true,
          },
          history
        );

        const finalProposal: PlanningProposal = planningResult.proposal ?? {
          summary: "Proposition de planning générique.",
          warnings: [],
          existing_interventions: [],
          suggested_interventions: [],
          next_week_priorities: [],
        };

        const chatMessage = planningResult.proposal
          ? planningResult.message
          : `J'ai analysé votre projet **${project?.name ?? ""}** et préparé une proposition de planning.\n\n${finalProposal.summary}\n\n${finalProposal.warnings?.length > 0 ? `⚠️ ${finalProposal.warnings[0]}\n\n` : ""}📋 La fenêtre de planning s'ouvre — vous pouvez modifier les tâches et interventions avant de valider.`;

        await streamText(chatMessage);

        const assistantMessage: AssistantMessage = {
          role: "assistant",
          content: chatMessage,
          timestamp: new Date().toISOString(),
          planningProposal: planningResult.proposal ?? null,
          suggestions: planningResult.suggestions ?? [],
        };
        setAssistantMessages((prev) => [...prev, assistantMessage]);

        setPendingPlanningProposal(finalProposal);
        setPendingProposal(null);

        return;
      }

      let response: Response;
      if (attachedFile && userRole === "professionnel") {
        const formData = new FormData();
        formData.append("project_id", projectId);
        formData.append("user_id", user.id);
        formData.append("user_role", userRole as "professionnel" | "particulier");
        formData.append("message", trimmed);
        formData.append("force_plan", "false");
        formData.append("file", attachedFile, attachedFile.name);
        response = await fetch(`${apiUrl}/project-chat-file`, {
          method: "POST",
          body: formData,
        });
      } else {
        const assistantEndpoint =
          userRole === "professionnel" ? "/project-chat" : "/project-chat-client";
        response = await fetch(`${apiUrl}${assistantEndpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            phase_id: contextPhaseId ?? null,
            lot_id: contextLotId ?? null,
            context_type: assistantContextType,
            user_id: user.id,
            user_role: userRole as "professionnel" | "particulier",
            message: trimmed,
            history,
            force_plan: false,
          }),
        });
      }
      const data = await response.json();
      const rawReply = (data.reply ?? "Je reviens vers vous avec une proposition.") as string;

      const inferGuideLink = (question: string) => {
        const q = (question || "").trim();
        const lowered = q.toLowerCase();
        const pickTerm = () => {
          const match =
            q.match(/(?:c['']est quoi|définition de|que signifie|ça veut dire)\s+(.+)/i) ||
            q.match(/(?:terme|mot)\s+(.+)/i);
          const term = (match?.[1] || "").trim().replace(/[?.!,;:]+$/g, "");
          if (term && term.length <= 40) return term;
          const lastToken = q
            .replace(/[^\\p{L}\\p{N}\\s-]/gu, " ")
            .split(/\\s+/)
            .filter(Boolean)
            .slice(-1)[0];
          return lastToken && lastToken.length <= 24 ? lastToken : "";
        };

        if (/(ipn|dtu|tva|acompte|décennale|ragr[ée]age)/i.test(q) || lowered.includes("c'est quoi") || lowered.includes("définition")) {
          return { section: "lexique", q: pickTerm() || q };
        }
        if (lowered.includes("délai") || lowered.includes("delai") || lowered.includes("combien de temps")) {
          return { section: "delais-types" };
        }
        if (lowered.includes("risque") || lowered.includes("attention") || lowered.includes("amiante") || lowered.includes("humidité")) {
          return { section: "points-attention" };
        }
        if (lowered.includes("budget") || lowered.includes("coût") || lowered.includes("prix") || lowered.includes("combien ça coûte")) {
          return { section: "mon-budget" };
        }
        if (
          lowered.includes("étapes") ||
          lowered.includes("etapes") ||
          lowered.includes("chronologie") ||
          lowered.includes("planning")
        ) {
          return { section: "delais-types" };
        }
        if (lowered.includes("devis") || lowered.includes("inclus") || lowered.includes("poste")) {
          return { section: "mon-devis" };
        }
        return null;
      };

      const withGuideLink = (text: string) => {
        if (userRole !== "particulier") return text;
        if (text.includes("#/guide?section=")) return text;
        const inferred = inferGuideLink(trimmed);
        if (!inferred) return text;
        const params: string[] = [`section=${encodeURIComponent(inferred.section)}`];
        if ("q" in inferred && inferred.q) {
          const key = inferred.section === "lexique" ? "terme" : "q";
          params.push(`${key}=${encodeURIComponent(inferred.q)}`);
        }
        const href = `#/guide?${params.join("&")}`;
        const emojiBySection: Record<string, string> = {
          lexique: "",
          "delais-types": "",
          "points-attention": "",
          "mon-devis": "",
          "mon-budget": "",
        };
        const labelBySection: Record<string, string> = {
          lexique: "Voir le lexique",
          "delais-types": "Délais types",
          "points-attention": "Points d'attention",
          "mon-devis": "Explique mon devis",
          "mon-budget": "Voir mon budget",
        };
        const emoji = emojiBySection[inferred.section] ?? "";
        const label = labelBySection[inferred.section] ?? "Ouvrir le Guide";
        const prefix = emoji ? `${emoji} ` : "";
        return `${text}\n\nPour en savoir plus : [${prefix}${label}](${href})`;
      };

      const nextReply =
        options?.uiMode && userRole !== "professionnel"
          ? formatAssistantReply(options.uiMode, rawReply, {
              projectName: project?.name ?? null,
              projectType: project?.project_type ?? null,
              totalBudgetTtc: totalBudget,
              quotes,
            })
          : withGuideLink(rawReply);

      await streamText(nextReply);

      const assistantMessage: AssistantMessage = {
        role: "assistant",
        content: nextReply,
        timestamp: new Date().toISOString(),
        proposal: data.proposal ?? null,
        requires_devis: Boolean(data.requires_devis),
        suggestions: data.suggested_questions ?? [],
        quickActions: data.quick_actions ?? [],
      };
      setAssistantMessages((prev) => [...prev, assistantMessage]);
      if (data.proposal) {
        setPendingProposal(data.proposal as AssistantProposal);
      }
    } catch (err: any) {
      setAssistantError(err?.message ?? "Impossible de contacter l'assistant IA.");
      setAssistantMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Une erreur est survenue, reessayez.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setAssistantLoading(false);
      setAssistantStreamingContent(null);
    }
  };

  const assistantActionButtons = useMemo(() => {
    if (userRole === "professionnel") {
      const actions: Array<any> = [
        {
          id: "pro_plan",
          icon: "P",
          title: "Planning",
          description: "Proposition de tâches + dates",
          color: "indigo",
          prompt: "Propose un planning détaillé pour ce projet avec les tâches principales et les délais.",
          forcePlan: true,
        },
        {
          id: "pro_devis_analyze",
          icon: "D",
          title: "Analyse devis",
          description: "Postes principaux + cohérences",
          color: "blue",
          prompt:
            "Analyse le devis de ce projet. Quels sont les postes principaux ? Y a-t-il des incohérences ou des points à vérifier ?",
          uiMode: "devis",
        },
        {
          id: "pro_devis_validate",
          icon: "C",
          title: "Conformité",
          description: "TVA, mentions, totaux",
          color: "green",
          prompt:
            "Vérifie la conformité du devis : TVA, mentions obligatoires, cohérence des totaux, et conformité réglementaire.",
        },
        {
          id: "pro_budget",
          icon: "B",
          title: "Budget",
          description: "Synthèse coûts + paiements",
          color: "purple",
          prompt: "Quel est le budget estimé pour ce projet ? Y a-t-il des coûts supplémentaires à prévoir ?",
          uiMode: "budget",
        },
        {
          id: "pro_risks",
          icon: "R",
          title: "Risques",
          description: "Points d'attention chantier",
          color: "red",
          prompt:
            "Quels sont les risques et points d'attention pour ce projet ? Y a-t-il des éléments à surveiller particulièrement ?",
          uiMode: "risks",
        },
        {
          id: "pro_terms",
          icon: "T",
          title: "Termes",
          description: "Lexique BTP (devis)",
          color: "orange",
          prompt: "Peux-tu clarifier les termes techniques du devis ? Explique-moi les mots que je ne comprends pas.",
          uiMode: "terms",
        },
        {
          id: "pro_margins",
          icon: "M",
          title: "Marges",
          description: "Rentabilité par poste",
          color: "purple",
          prompt: "Calcule les marges et la rentabilité de ce projet. Quels sont les postes les plus rentables ?",
        },
        {
          id: "pro_optimize",
          icon: "O",
          title: "Optimiser",
          description: "Réduire sans dégrader",
          color: "blue",
          prompt:
            "Optimise les coûts de ce projet. Y a-t-il des postes où on peut réduire les coûts sans impacter la qualité ?",
        },
        {
          id: "pro_improve",
          icon: "A",
          title: "Améliorations",
          description: "Alternatives & options",
          color: "green",
          prompt:
            "Propose des améliorations ou des alternatives pour ce projet. Y a-t-il des options plus performantes ou économiques ?",
        },
      ];

      return actions.map(({ prompt, uiMode, forcePlan, ...a }) => ({
        ...a,
        disabled: assistantLoading,
        onClick: () => void sendAssistantMessage(prompt, { forcePlan, uiMode, actionId: a.id }),
      }));
    }

    const actions: Array<any> = [
      {
        id: "client_devis",
        icon: "D",
        title: "Explique le devis",
        description: "Comprendre les postes et inclusions",
        color: "blue",
        prompt: "",
        uiMode: "devis",
      },
      {
        id: "client_steps",
        icon: "E",
        title: "Les etapes",
        description: "Chronologie des travaux",
        color: "green",
        prompt: "",
        uiMode: "steps",
      },
      {
        id: "client_budget",
        icon: "B",
        title: "Le budget",
        description: "Couts, paiements, imprevus",
        color: "purple",
        prompt: "",
        uiMode: "budget",
      },
      {
        id: "client_terms",
        icon: "T",
        title: "Termes techniques",
        description: "Vocabulaire BTP simplifie",
        color: "orange",
        prompt: "",
        uiMode: "terms",
      },
      {
        id: "client_delays",
        icon: "H",
        title: "Les delais",
        description: "Duree et jalons",
        color: "indigo",
        prompt: "",
        uiMode: "delays",
      },
      {
        id: "client_risks",
        icon: "R",
        title: "Points d'attention",
        description: "Risques et precautions",
        color: "red",
        prompt: "",
        uiMode: "risks",
      },
    ];

    const sectionByActionId: Record<string, string> = {
      client_devis: "mon-devis",
      client_steps: "delais-types",
      client_budget: "mon-budget",
      client_terms: "lexique",
      client_delays: "delais-types",
      client_risks: "points-attention",
    };

    return actions.map(({ uiMode, ...a }) => ({
      ...a,
      disabled: assistantLoading,
      onClick: () => {
        const section = sectionByActionId[a.id] ?? "lexique";
        openGuide(section);
      },
    }));
  }, [assistantLoading, userRole]);

  const insertTaskWithFallbackStatus = async (payloadBase: Record<string, unknown>) => {
    const candidates = TASK_STATUS_DB_MAP.not_started;
    let lastError: { message?: string } | null = null;
    for (const statusValue of candidates) {
      const { error } = await supabase.from("project_tasks").insert({
        ...payloadBase,
        status: statusValue,
      });
      if (!error) return null;
      lastError = error;
      if (!error.message?.includes("status_check")) {
        return lastError;
      }
    }
    return lastError;
  };

  const DEFAULT_TIME_SLOTS = ["09:00-11:00", "11:00-13:00", "14:00-16:00", "16:00-18:00"] as const;

  const ensureTimePrefix = (description: string, timeRange: string) => {
    const base = (description ?? "").trim();
    if (!base) return `[[time:${timeRange}]]`;
    if (base.startsWith("[[time:")) return base;
    const prefix = `[[time:${timeRange}]]`;
    return `${prefix} ${base}`;
  };

  const buildAssistantTaskDescription = (task: AssistantTask) => {
    const timeRange = (task.time_range ?? "").trim();
    const base = (task.description ?? "").trim();
    if (timeRange) {
      const prefix = `[[time:${timeRange}]]`;
      return base ? `${prefix} ${base}` : prefix;
    }
    return base || null;
  };

  const addDefaultTimesToPlanningTasks = (
    tasks: PlanningSuggestedTask[],
    sharedDaySlots?: Map<string, number>
  ) => {
    const daySlots = sharedDaySlots ?? new Map<string, number>();
    return tasks.map((t) => {
      const startDate = (t.start_date ?? "").trim();
      const endDate = (t.end_date ?? t.start_date ?? "").trim();
      if (!startDate && !endDate) return t;

      const isMultiDay = startDate && endDate && startDate !== endDate;
      if (isMultiDay) {
        const desc = (t.description ?? "").trim();
        return { ...t, description: desc ? `[[start:${startDate}]][[time:09:00-18:00]] ${desc}` : `[[start:${startDate}]][[time:09:00-18:00]]` };
      }

      const day = endDate || startDate;
      const idx = daySlots.get(day) ?? 0;
      daySlots.set(day, idx + 1);
      const slot = DEFAULT_TIME_SLOTS[idx % DEFAULT_TIME_SLOTS.length];
      return { ...t, description: ensureTimePrefix(t.description, slot) };
    });
  };

  const applyAssistantProposal = async () => {
    if (!canUseAssistantPlanning) {
      setAssistantNotice("Seuls les professionnels peuvent valider un planning.");
      return;
    }
    if (!pendingProposal || !projectId || !user?.id) return;
    for (const task of pendingProposal.tasks) {
      const start = (task.start_date ?? "").trim();
      const end = (task.end_date ?? task.start_date ?? "").trim();
      if (start && end && !isValidDateRange(start, end)) {
        setAssistantError("Chaque tâche doit avoir une date de fin supérieure ou égale à la date de début.");
        return;
      }
    }
    const shouldReplace = window.confirm(
      "Valider ce planning va remplacer les tâches actuelles du projet. Voulez-vous continuer ?"
    );
    if (!shouldReplace) return;
    setApplyLoading(true);
    setAssistantError(null);
    setAssistantNotice(null);
    const { error: deleteError } = await supabase
      .from("project_tasks")
      .delete()
      .eq("project_id", projectId);
    if (deleteError) {
      setAssistantError(deleteError.message ?? "Impossible de remplacer les tâches existantes.");
      setApplyLoading(false);
      return;
    }
    for (const task of pendingProposal.tasks) {
      if (!task.name || !task.name.trim()) continue;
      const payloadBase = {
        project_id: projectId,
        name: task.name.trim(),
        start_date: task.start_date ?? null,
        end_date: task.end_date ?? task.start_date ?? null,
        description: buildAssistantTaskDescription(task),
      };
      const insertError = await insertTaskWithFallbackStatus(payloadBase);
      if (insertError) {
        setAssistantError(insertError.message ?? "Impossible d'ajouter une tâche proposée.");
        setApplyLoading(false);
        return;
      }
    }
    setApplyLoading(false);
    setPendingProposal(null);
    setAssistantNotice("Planning mis à jour. Les tâches précédentes ont été remplacées.");
    await loadProject();
  };

  const applyPlanningProposal = async () => {
    if (!canUseAssistantPlanning) {
      setAssistantNotice("Seuls les professionnels peuvent valider un planning.");
      return;
    }
    if (!pendingPlanningProposal || !projectId || !user?.id) return;

    const proposal = pendingPlanningProposal;
    const hasSuggestedTasks = proposal.existing_interventions?.some((i: any) => i.suggested_tasks.length > 0);
    const hasNewInterventions = proposal.suggested_interventions?.length > 0;

    if (!hasSuggestedTasks && !hasNewInterventions) {
      setAssistantNotice("Aucune suggestion à appliquer dans cette proposition.");
      return;
    }

    for (const intervention of proposal.existing_interventions ?? []) {
      for (const task of intervention.suggested_tasks) {
        const start = (task.start_date ?? "").trim();
        const end = (task.end_date ?? task.start_date ?? "").trim();
        if (start && end && !isValidDateRange(start, end)) {
          setAssistantError("Chaque tâche doit avoir une date de fin supérieure ou égale à la date de début.");
          return;
        }
      }
    }
    for (const newIntervention of proposal.suggested_interventions ?? []) {
      for (const task of newIntervention.suggested_tasks) {
        const start = (task.start_date ?? "").trim();
        const end = (task.end_date ?? task.start_date ?? "").trim();
        if (start && end && !isValidDateRange(start, end)) {
          setAssistantError("Chaque tâche doit avoir une date de fin supérieure ou égale à la date de début.");
          return;
        }
      }
    }

    const confirmMsg = hasNewInterventions
      ? `Ce planning va créer ${proposal.suggested_interventions.length} nouvelle(s) intervention(s) et remplacer les tâches des interventions concernées. Continuer ?`
      : "Ce planning va remplacer les tâches des interventions concernées. Continuer ?";

    if (!window.confirm(confirmMsg)) return;

    setApplyLoading(true);
    setAssistantError(null);
    setAssistantNotice(null);

    try {
      const defaultPhaseId = await getOrCreateDefaultPhase(projectId);
      const globalDaySlots = new Map<string, number>();

      for (const intervention of proposal.existing_interventions ?? []) {
        if (!intervention.intervention_id || intervention.intervention_id === "__project_tasks__") continue;
        if (intervention.suggested_tasks.length === 0) continue;

        await deleteAllLotTasks(intervention.intervention_id);
        const tasksWithTimes = addDefaultTimesToPlanningTasks(intervention.suggested_tasks, globalDaySlots);

        for (let idx = 0; idx < tasksWithTimes.length; idx++) {
          const task = tasksWithTimes[idx];
          if (!task.title?.trim()) continue;
          await createLotTask(intervention.intervention_id, {
            title: task.title.trim(),
            description: task.description?.trim() || null,
            dueDate: task.end_date ?? task.start_date ?? null,
            orderIndex: idx,
            status: "todo",
          });
        }
      }

      for (const newIntervention of proposal.suggested_interventions ?? []) {
        if (!newIntervention.name?.trim()) continue;

        const lotId = await createLot(defaultPhaseId, {
          name: newIntervention.name.trim(),
          lotType: newIntervention.lot_type?.trim() || null,
          description: newIntervention.reason?.trim() || null,
          status: "planifie",
        });

        const tasksWithTimes = addDefaultTimesToPlanningTasks(newIntervention.suggested_tasks, globalDaySlots);
        for (let idx = 0; idx < tasksWithTimes.length; idx++) {
          const task = tasksWithTimes[idx];
          if (!task.title?.trim()) continue;
          await createLotTask(lotId, {
            title: task.title.trim(),
            description: task.description?.trim() || null,
            dueDate: task.end_date ?? task.start_date ?? null,
            orderIndex: idx,
            status: "todo",
          });
        }
      }

      setPendingPlanningProposal(null);
      setPendingProposal(null);
      setAssistantNotice("Planning appliqué avec succès. Les tâches des interventions concernées ont été remplacées.");
      await loadProject();
    } catch (err: any) {
      setAssistantError(err?.message ?? "Impossible d'appliquer le planning.");
    } finally {
      setApplyLoading(false);
    }
  };

  const updateProposalSummary = (value: string) => {
    setPendingProposal((prev: AssistantProposal | null) => prev ? { ...prev, summary: value } : prev);
  };

  const updateProposalTask = (index: number, patch: Partial<AssistantTask>) => {
    setPendingProposal((prev: AssistantProposal | null) => {
      if (!prev) return prev;
      const nextTasks = [...prev.tasks];
      const target = nextTasks[index] ?? { name: "" };
      nextTasks[index] = { ...target, ...patch };
      return { ...prev, tasks: nextTasks };
    });
  };

  const removeProposalTask = (index: number) => {
    setPendingProposal((prev: AssistantProposal | null) => {
      if (!prev) return prev;
      const nextTasks = prev.tasks.filter((_: any, idx: number) => idx !== index);
      return { ...prev, tasks: nextTasks };
    });
  };

  const addProposalTask = () => {
    setPendingProposal((prev: AssistantProposal | null) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: [
          ...prev.tasks,
          { name: "Nouvelle tâche", description: "", start_date: null, end_date: null, time_range: "" },
        ],
      };
    });
  };

  const normalizeDateValue = (val: string) => val || null;

  return (
    <section ref={assistantSectionRef} className="grid gap-6">
      <div className="space-y-6">
        <Card className="min-h-[600px] h-[calc(100vh-200px)] flex flex-col">
          <CardContent className="flex flex-col gap-4 flex-1 min-h-0">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Actions rapides</div>
                  <div className="text-xs text-neutral-500">
                    Ouvrez le menu pour choisir une action (cartes, timeline, budget…).
                  </div>
                </div>
                <ActionMenu actions={assistantActionButtons} disabled={assistantLoading} />
              </div>
            </div>

            {assistantError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {assistantError}
              </div>
            )}
            {assistantNotice && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {assistantNotice}
              </div>
            )}
            {!canUseAssistantPlanning && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                Vous pouvez poser vos questions, mais la modification du planning est réservée aux professionnels.
              </div>
            )}
            <div
              ref={assistantMessagesContainerRef}
              className="flex-1 min-h-0 space-y-3 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 sm:p-6"
            >
              {assistantMessages.map((msg, index) => (
                <div
                  key={`${msg.timestamp}-${index}`}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <img
                        src="/images/grey/robot.png"
                        alt="Assistant IA"
                        className="w-5 h-5 object-contain logo-blend"
                      />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary-400 text-white shadow-sm [&_*]:text-white"
                        : "bg-neutral-100 text-neutral-900 border border-neutral-200 shadow-sm"
                    }`}
                  >
                    {msg.role === "user" && msg.attachedFileName && (
                      <div className="flex items-center gap-1.5 mb-1.5 text-xs text-primary-100 opacity-90">
                        <Paperclip className="w-3 h-3" />
                        <span className="truncate max-w-[160px]">{msg.attachedFileName}</span>
                      </div>
                    )}
                    <ChatMessageMarkdown content={msg.content} />
                    {msg.role === "assistant" && msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-neutral-200">
                        {msg.suggestions.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => sendAssistantMessage(q)}
                            disabled={assistantLoading}
                            type="button"
                            className="text-xs px-3 py-1.5 rounded-full border border-primary-300 text-primary-500 bg-white hover:bg-primary-50 hover:border-primary-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                    {msg.role === "assistant" && msg.quickActions && msg.quickActions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-neutral-200">
                        {msg.quickActions.map((action) => (
                          <button
                            key={action.id}
                            onClick={() => sendAssistantMessage(action.prompt)}
                            disabled={assistantLoading}
                            type="button"
                            className="text-xs px-3 py-1.5 rounded-full border border-primary-400 text-primary-600 bg-primary-50 hover:bg-primary-100 hover:border-primary-500 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {action.icon && <span className="mr-1">{action.icon}</span>}
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {assistantLoading && !assistantStreamingContent && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <img
                      src="/images/grey/robot.png"
                      alt="Assistant IA"
                      className="w-5 h-5 object-contain logo-blend"
                    />
                  </div>
                  <div className="bg-neutral-100 border border-neutral-200 rounded-lg px-4 py-2 shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  </div>
                </div>
              )}
              {assistantStreamingContent && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <img
                      src="/images/grey/robot.png"
                      alt="Assistant IA"
                      className="w-5 h-5 object-contain logo-blend"
                    />
                  </div>
                  <div className="max-w-[80%]">
                    <div className="bg-neutral-100 border border-neutral-200 rounded-lg px-4 py-3 shadow-sm text-sm text-neutral-900 whitespace-pre-wrap">
                      {assistantStreamingContent}
                      <span className="inline-block w-0.5 h-4 bg-neutral-500 animate-pulse ml-0.5 align-middle" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={assistantMessagesEndRef} />
            </div>
            {selectedFile && (
              <div className="flex items-center gap-2 px-3 py-1.5 mb-1 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-700 w-fit max-w-full">
                <Paperclip className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="ml-1 hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex gap-2 pb-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setSelectedFile(f);
                  e.target.value = "";
                }}
              />
              {userRole === "professionnel" && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={assistantLoading}
                  title="Joindre un fichier (PDF, DOCX, image…)"
                  className="h-14 w-11 flex items-center justify-center border border-neutral-300 rounded-lg bg-white hover:bg-neutral-50 hover:border-primary-400 text-neutral-500 hover:text-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
              )}
              <input
                type="text"
                value={assistantInput}
                onChange={(event) => setAssistantInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void sendAssistantMessage(assistantInput);
                  }
                }}
                placeholder={
                  assistantActiveAction
                    ? "Complétez ou posez une question liée à l’action…"
                    : "Posez une question (devis, étapes, budget, délais, risques)…"
                }
                className="flex-1 h-14 px-4 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white selection:bg-primary-200 selection:text-neutral-900 text-base"
                disabled={assistantLoading}
              />
              <Button
                onClick={() => sendAssistantMessage(assistantInput)}
                disabled={assistantLoading || (!assistantInput.trim() && !selectedFile)}
                className="h-14 bg-gradient-to-r from-primary-400 to-primary-600 hover:from-primary-500 hover:to-primary-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {userRole === "professionnel" && false && (
          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Proposition de planning</div>
              <div className="text-sm text-gray-500">À valider avant insertion des tâches et interventions.</div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!pendingProposal && !pendingPlanningProposal && (
                <div className="text-sm text-gray-500">
                  Aucune proposition pour le moment. Demandez un planning à l'assistant.
                </div>
              )}

              {pendingPlanningProposal && (
                <div className="space-y-4">
                  {pendingPlanningProposal?.summary && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                      {pendingPlanningProposal?.summary}
                    </div>
                  )}

                  {(pendingPlanningProposal?.warnings?.length ?? 0) > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 space-y-1">
                      {(pendingPlanningProposal?.warnings ?? []).map((w: any, i: number) => (
                        <div key={i}>{w}</div>
                      ))}
                    </div>
                  )}

                  {(pendingPlanningProposal?.existing_interventions?.length ?? 0) > 0 && (
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-gray-800">Interventions existantes</div>
                      {(pendingPlanningProposal?.existing_interventions ?? []).map((intervention: any) => (
                        <div key={intervention.intervention_id} className="rounded-lg border border-gray-200 p-3 bg-white space-y-2">
                          <div className="font-medium text-gray-900">{intervention.intervention_name}</div>
                          {intervention.existing_tasks.length > 0 && (
                            <div className="space-y-1">
                              {intervention.existing_tasks.map((task: any) => (
                                <div key={task.task_id} className="text-xs text-gray-600 flex items-center gap-2">
                                  <span className={cn(
                                    "inline-block w-2 h-2 rounded-full",
                                    task.status === "done" ? "bg-green-500" : task.status === "in_progress" ? "bg-blue-500" : "bg-gray-400"
                                  )} />
                                  {task.title}
                                  {task.note && <span className="text-amber-600">({task.note})</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {intervention.suggested_tasks.length > 0 && (
                            <div className="space-y-1 border-t border-dashed border-gray-200 pt-2">
                              <div className="text-xs font-medium text-indigo-700">Tâches suggérées :</div>
                              {intervention.suggested_tasks.map((task: any, idx: number) => (
                                <div key={idx} className="text-xs text-gray-700 pl-2 border-l-2 border-indigo-300">
                                  <span className="font-medium">{task.title}</span>
                                  {task.start_date && task.end_date && (
                                    <span className="text-gray-500 ml-1">({task.start_date} → {task.end_date})</span>
                                  )}
                                  {task.description && <div className="text-gray-500 italic">{task.description}</div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingSuggestedInterventions.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-emerald-800">Nouvelles interventions suggérées</div>
                      {pendingSuggestedInterventions.map((intervention: any, iIdx: number) => (
                        <div key={iIdx} className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3 space-y-2">
                          <div className="font-medium text-gray-900">
                            {intervention.name}
                            {intervention.lot_type && (
                              <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{intervention.lot_type}</span>
                            )}
                          </div>
                          {intervention.reason && (
                            <div className="text-xs text-gray-600 italic">{intervention.reason}</div>
                          )}
                          {intervention.suggested_tasks.length > 0 && (
                            <div className="space-y-1">
                              {intervention.suggested_tasks.map((task: any, tIdx: number) => (
                                <div key={tIdx} className="text-xs text-gray-700 pl-2 border-l-2 border-emerald-300">
                                  <span className="font-medium">{task.title}</span>
                                  {task.start_date && task.end_date && (
                                    <span className="text-gray-500 ml-1">({task.start_date} → {task.end_date})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingNextWeekPriorities.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-gray-800">Priorités de la semaine</div>
                      {pendingNextWeekPriorities.map((p: string, i: number) => (
                        <div key={i} className="text-xs text-gray-700">{i + 1}. {p}</div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    Valider ajoutera les interventions et tâches suggérées au projet.
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={applyPlanningProposal}
                      disabled={applyLoading || !canUseAssistantPlanning}
                    >
                      {applyLoading ? "Application..." : "Valider le planning"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPendingPlanningProposal(null);
                        setPendingProposal(null);
                        sendAssistantMessage("Refais un autre planning, plus adapté.", { forcePlan: true });
                      }}
                      disabled={assistantLoading || !canUseAssistantPlanning}
                    >
                      Refaire
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setPendingPlanningProposal(null);
                        setPendingProposal(null);
                      }}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {pendingProposal && !pendingPlanningProposal && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-800">Résumé du planning</label>
                    <textarea
                      value={pendingLegacySummary}
                      onChange={(event) => updateProposalSummary(event.target.value)}
                      className="w-full min-h-[90px] px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 selection:bg-primary-200 selection:text-neutral-900"
                      placeholder="Résumé rapide du planning proposé."
                    />
                  </div>
                  <div className="space-y-4">
                    {pendingLegacyTasks.map((task: any, index: number) => (
                      <div key={`${task.name}-${index}`} className="rounded-lg border border-gray-200 p-3 bg-white">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="text-sm font-semibold text-gray-900">Tache {index + 1}</div>
                          <Button variant="ghost" onClick={() => removeProposalTask(index)}>
                            Supprimer
                          </Button>
                        </div>
                        <Input
                          label="Titre"
                          value={task.name ?? ""}
                          onChange={(event) => updateProposalTask(index, { name: event.target.value })}
                          placeholder="Nom de la tâche"
                        />
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-800">Description</label>
                          <textarea
                            value={task.description ?? ""}
                            onChange={(event) => updateProposalTask(index, { description: event.target.value })}
                            className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 selection:bg-primary-200 selection:text-neutral-900"
                            placeholder="Détails utiles pour la tâche."
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <Input
                            label="Debut"
                            type="date"
                            value={task.start_date ?? ""}
                            onChange={(event) => updateProposalTask(index, { start_date: normalizeDateValue(event.target.value) || event.target.value })}
                          />
                          <Input
                            label="Fin"
                            type="date"
                            value={task.end_date ?? ""}
                            onChange={(event) => updateProposalTask(index, { end_date: normalizeDateValue(event.target.value) || event.target.value })}
                          />
                          <Input
                            label="Creneau"
                            value={task.time_range ?? ""}
                            onChange={(event) => updateProposalTask(index, { time_range: event.target.value })}
                            placeholder="HH:MM-HH:MM"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    onClick={addProposalTask}
                    disabled={!canUseAssistantPlanning}
                  >
                    Ajouter une tâche
                  </Button>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Valider remplacera le planning actuel du projet.
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={applyAssistantProposal}
                      disabled={applyLoading || !canUseAssistantPlanning}
                    >
                      {applyLoading ? "Application..." : "Valider le planning"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => sendAssistantMessage("Refais un autre planning, plus adapté.", { forcePlan: true })}
                      disabled={assistantLoading || !canUseAssistantPlanning}
                    >
                      Refaire
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
