"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Pencil, Send } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import ChatBox from "@/components/chat/ChatBox";
import { ChatWindow } from "@/components/chat/ChatWindow";
import DocumentsList from "@/components/documents/DocumentsList";
import Breadcrumb from "@/components/ui/Breadcrumb";
import LotBudgetPanel from "@/components/lot/LotBudgetPanel";
import ProgressBar from "@/components/ui/ProgressBar";
import { useAuth, mapUserTypeToRole } from "@/hooks/useAuth";
import { formatCurrency, formatDate, isValidDateRange, normalizeDateValue } from "@/lib/utils";
import { fetchLotTasks, createLotTask, updateLotTask, deleteLotTask, type LotTask } from "@/lib/lotTasksDb";
import { getLotById, type LotRow } from "@/lib/lotsDb";
import { supabase } from "@/lib/supabaseClient";
import { ChatMessageMarkdown } from "@/components/chat/ChatMessageMarkdown";
import type { AssistantActionButton } from "@/components/assistant/ActionButton";
import { ActionMenu } from "@/components/assistant/ActionMenu";
import { formatAssistantReply, type AssistantUiMode } from "@/lib/assistantResponses";

type ProjectLite = { id: string; created_by: string | null; name: string | null; project_type: string | null };

type ProjectMember = {
  userId: string;
  fullName: string;
  email: string;
  role: string;
};

type TabKey = "overview" | "taches" | "chat" | "budget" | "documents" | "planning" | "assistant";

const tabItems: Array<{ key: TabKey; label: string; iconSrc: string }> = [
  { key: "overview", label: "Apercu", iconSrc: "/images/grey/eye.png" },
  { key: "taches", label: "Taches", iconSrc: "/images/grey/files.png" },
  { key: "planning", label: "Planning", iconSrc: "/images/grey/calendar%20(1).png" },
  { key: "chat", label: "Chat", iconSrc: "/images/grey/chat-teardrop-dots.png" },
  { key: "budget", label: "Budget", iconSrc: "/images/grey/files.png" },
  { key: "documents", label: "Documents", iconSrc: "/images/grey/files.png" },
  { key: "assistant", label: "Assistant IA", iconSrc: "/images/grey/robot.png" },
];

const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDayLabel = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "short" })
    .format(date)
    .replace(".", "");

const taskPalette = [
  "border-blue-300 bg-blue-50 text-blue-900",
  "border-emerald-300 bg-emerald-50 text-emerald-900",
  "border-amber-300 bg-amber-50 text-amber-900",
  "border-violet-300 bg-violet-50 text-violet-900",
  "border-rose-300 bg-rose-50 text-rose-900",
  "border-cyan-300 bg-cyan-50 text-cyan-900",
];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const pickTaskColor = (label: string) => {
  if (!label) return taskPalette[0];
  return taskPalette[hashString(label) % taskPalette.length];
};

type AssistantTask = {
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  time_range?: string | null;
};

type AssistantProposal = {
  summary?: string | null;
  tasks: AssistantTask[];
};

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  proposal?: AssistantProposal | null;
  suggestions?: string[];
};

export default function InterventionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const roleParam = searchParams.get("role");
  const tabParam = searchParams.get("tab");
  const role = roleParam === "professionnel" ? "professionnel" : "particulier";
  const userRole = profile ? mapUserTypeToRole(profile.user_type) : role;

  const projectId = typeof params.id === "string" ? params.id : "";
  const interventionId = typeof params.interventionId === "string" ? params.interventionId : "";

  const [project, setProject] = useState<ProjectLite | null>(null);
  const [lot, setLot] = useState<LotRow | null>(null);
  const [tasks, setTasks] = useState<LotTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<string | null>(null);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", dueDate: "", startTime: "", endTime: "", description: "", assignedTo: "" });

  // Edit task state
  const [editingTask, setEditingTask] = useState<LotTask | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", dueDate: "", startTime: "", endTime: "", description: "", assignedTo: "", status: "todo" as string });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Project members
  const [members, setMembers] = useState<ProjectMember[]>([]);

  // Assistant IA state
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content: "Bonjour ! Je peux vous aider a planifier cette intervention. Decrivez ce que vous souhaitez.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantNotice, setAssistantNotice] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = useState<AssistantProposal | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const assistantMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const isOwnerByProject = project?.created_by === user?.id;
  const memberStatus = "";
  const isAcceptedMember = true;
  const isManagerRole =
    ["owner", "collaborator", "pro", "professionnel"].includes((projectMemberRole ?? "").toLowerCase()) || isOwnerByProject;
  const canManageProject = isAcceptedMember && isManagerRole;
  const canEditThisLot = canManageProject;

  const isTabKey = (value: string | null): value is TabKey =>
    !!value && tabItems.some((tab) => tab.key === value);
  const [activeTab, setActiveTab] = useState<TabKey>(() => (isTabKey(tabParam) ? tabParam : "overview"));

  useEffect(() => {
    if (!isTabKey(tabParam)) return;
    if (tabParam === activeTab) return;
    setActiveTab(tabParam);
  }, [tabParam, activeTab]);

  const updateQuery = (patch: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.replace(
      `/dashboard/projets/${projectId}/interventions/${interventionId}?${next.toString()}`,
      { scroll: false }
    );
  };

  const progress = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [tasks]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(weekStart), i));
  }, [weekStart]);

  const todayKey = toDateKey(new Date());

  const parseTaskTime = (task: LotTask): { dateKey: string | null; startHour: number | null; endHour: number | null; timeLabel: string | null; cleanDesc: string | null } => {
    if (!task.dueDate) return { dateKey: null, startHour: null, endHour: null, timeLabel: null, cleanDesc: task.description };
    const dateKey = task.dueDate.substring(0, 10);
    // Check time in description "[[time:HH:MM-HH:MM]] ..." (main format)
    if (task.description) {
      const match = task.description.match(/^\[\[time:(\d{2}:\d{2})-(\d{2}:\d{2})\]\]\s*(.*)?$/);
      if (match) {
        const [startH, startM] = match[1].split(":").map(Number);
        const [endH, endM] = match[2].split(":").map(Number);
        return {
          dateKey,
          startHour: startH + startM / 60,
          endHour: endH + endM / 60,
          timeLabel: `${match[1]} - ${match[2]}`,
          cleanDesc: (match[3] ?? "").trim() || null,
        };
      }
      // Fallback: "[HH:MM-HH:MM] ..." (from AI proposals)
      const matchAlt = task.description.match(/^\[(\d{2}:\d{2})-(\d{2}:\d{2})\]\s*/);
      if (matchAlt) {
        const [startH, startM] = matchAlt[1].split(":").map(Number);
        const [endH, endM] = matchAlt[2].split(":").map(Number);
        return {
          dateKey,
          startHour: startH + startM / 60,
          endHour: endH + endM / 60,
          timeLabel: `${matchAlt[1]} - ${matchAlt[2]}`,
          cleanDesc: task.description.substring(matchAlt[0].length).trim() || null,
        };
      }
    }
    return { dateKey, startHour: null, endHour: null, timeLabel: null, cleanDesc: task.description };
  };

  const tasksByDay = useMemo(() => {
    const dayKeySet = new Set(weekDays.map(toDateKey));
    const allDay = new Map<string, Array<LotTask & { timeLabel: string | null; cleanDesc: string | null }>>();
    const timed = new Map<string, Array<{ task: LotTask; startHour: number; endHour: number; timeLabel: string; cleanDesc: string | null; colorClass: string }>>();

    for (const dk of dayKeySet) {
      allDay.set(dk, []);
      timed.set(dk, []);
    }

    for (const task of tasks) {
      const parsed = parseTaskTime(task);
      if (!parsed.dateKey || !dayKeySet.has(parsed.dateKey)) continue;
      if (parsed.startHour !== null && parsed.endHour !== null && parsed.timeLabel) {
        timed.get(parsed.dateKey)!.push({
          task,
          startHour: parsed.startHour,
          endHour: parsed.endHour,
          timeLabel: parsed.timeLabel,
          cleanDesc: parsed.cleanDesc,
          colorClass: pickTaskColor(task.title),
        });
      } else {
        allDay.get(parsed.dateKey)!.push({ ...task, timeLabel: parsed.timeLabel, cleanDesc: parsed.cleanDesc });
      }
    }

    return { allDay, timed };
  }, [tasks, weekDays]);

  const planningHourStart = 7;
  const planningHourEnd = 20;
  const planningRowHeight = 56;
  const planningTimeSlots = useMemo(
    () => Array.from({ length: planningHourEnd - planningHourStart + 1 }, (_, i) => planningHourStart + i),
    []
  );
  const formatHourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

  const load = async () => {
    if (!user?.id || !projectId || !interventionId) return;
    setLoading(true);
    setError(null);
    try {
      const [projectRes, memberRes, allMembersRes, lotRow, taskRows] = await Promise.all([
        supabase.from("projects").select("id,created_by,name,project_type").eq("id", projectId).maybeSingle(),
        supabase
          .from("project_members")
          .select("role,status")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("project_members")
          .select("role,status,user:profiles!project_members_user_id_fkey(id,full_name,email)")
          .eq("project_id", projectId),
        getLotById(interventionId),
        fetchLotTasks(interventionId),
      ]);

      if (projectRes.error) throw projectRes.error;
      if (memberRes.error) throw memberRes.error;

      setProject((projectRes.data as any) ?? null);
      const rawRole = (memberRes.data as any)?.role ?? null;
      const rawStatus = (memberRes.data as any)?.status ?? null;
      const normalizedStatus = String(rawStatus ?? "").toLowerCase();
      const isAccepted = normalizedStatus === "accepted" || normalizedStatus === "active";
      setProjectMemberRole(isAccepted ? rawRole : null);
      setLot(lotRow);
      setTasks(taskRows);

      // Parse project members
      if (!allMembersRes.error && allMembersRes.data) {
        const parsed: ProjectMember[] = allMembersRes.data
          .filter((m: any) => {
            const s = String(m.status ?? "").toLowerCase();
            return s === "accepted" || s === "active";
          })
          .map((m: any) => ({
            userId: (m.user as any)?.id ?? "",
            fullName: (m.user as any)?.full_name ?? "",
            email: (m.user as any)?.email ?? "",
            role: m.role ?? "",
          }))
          .filter((m: ProjectMember) => m.userId);
        setMembers(parsed);
      }
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger l'intervention.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id, projectId, interventionId]);

  useEffect(() => {
    if (activeTab !== "assistant") return;
    const container = assistantMessagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [assistantLoading, assistantMessages.length, activeTab]);

  const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEditThisLot) {
      setError("Acces refuse: vous ne pouvez pas ajouter une tache.");
      return;
    }
    if (!taskForm.title.trim()) return;
    setTaskSubmitting(true);
    setError(null);
    try {
      const dueValue = taskForm.dueDate || null;
      // Encode time range in description using [[time:HH:MM-HH:MM]] pattern
      const hasTime = taskForm.startTime || taskForm.endTime;
      let finalDescription = taskForm.description.trim() || null;
      if (hasTime) {
        const timeLabel = `${taskForm.startTime || "--:--"}-${taskForm.endTime || "--:--"}`;
        const prefix = `[[time:${timeLabel}]]`;
        finalDescription = finalDescription ? `${prefix} ${finalDescription}` : prefix;
      }
      await createLotTask(interventionId, {
        title: taskForm.title,
        dueDate: dueValue,
        description: finalDescription,
        status: "todo",
        orderIndex: tasks.length,
      });
      setTaskForm({ title: "", dueDate: "", startTime: "", endTime: "", description: "", assignedTo: "" });
      setTaskModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de creer la tache.");
    } finally {
      setTaskSubmitting(false);
    }
  };

  const toggleTask = async (task: LotTask) => {
    if (!canEditThisLot) return;
    const next = task.status === "done" ? "todo" : "done";
    try {
      await updateLotTask(task.id, { status: next });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de mettre a jour la tache.");
    }
  };

  const removeTask = async (task: LotTask) => {
    if (!canEditThisLot) return;
    try {
      await deleteLotTask(task.id);
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de supprimer la tache.");
    }
  };

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m.userId, m.fullName || m.email);
    }
    return map;
  }, [members]);

  const openEditTask = (task: LotTask) => {
    setEditingTask(task);
    // Parse time from description
    let startTime = "";
    let endTime = "";
    let cleanDesc = task.description ?? "";
    if (task.description) {
      const match = task.description.match(/^\[\[time:(\d{2}:\d{2})-(\d{2}:\d{2})\]\]\s*(.*)?$/);
      if (match) {
        startTime = match[1];
        endTime = match[2];
        cleanDesc = (match[3] ?? "").trim();
      } else {
        const matchAlt = task.description.match(/^\[(\d{2}:\d{2})-(\d{2}:\d{2})\]\s*(.*)?$/);
        if (matchAlt) {
          startTime = matchAlt[1];
          endTime = matchAlt[2];
          cleanDesc = (matchAlt[3] ?? "").trim();
        }
      }
    }
    setEditForm({
      title: task.title,
      dueDate: task.dueDate?.substring(0, 10) ?? "",
      startTime,
      endTime,
      description: cleanDesc,
      assignedTo: task.assignedTo ?? "",
      status: task.status,
    });
    setEditModalOpen(true);
  };

  const handleEditTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTask || !canEditThisLot) return;
    if (!editForm.title.trim()) return;
    setEditSubmitting(true);
    setError(null);
    try {
      const dueValue = editForm.dueDate || null;
      const hasTime = editForm.startTime || editForm.endTime;
      let finalDescription = editForm.description.trim() || null;
      if (hasTime) {
        const timeLabel = `${editForm.startTime || "--:--"}-${editForm.endTime || "--:--"}`;
        const prefix = `[[time:${timeLabel}]]`;
        finalDescription = finalDescription ? `${prefix} ${finalDescription}` : prefix;
      }
      await updateLotTask(editingTask.id, {
        title: editForm.title,
        dueDate: dueValue,
        description: finalDescription,
        status: editForm.status as any,
        assignedTo: editForm.assignedTo || null,
      });
      setEditModalOpen(false);
      setEditingTask(null);
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de modifier la tache.");
    } finally {
      setEditSubmitting(false);
    }
  };

  // === Assistant IA ===
  const sendAssistantMessage = async (
    content: string,
    options?: { forcePlan?: boolean; uiMode?: AssistantUiMode; actionId?: string }
  ) => {
    if (!user?.id || !projectId) return;
    const trimmed = content.trim();
    if (!trimmed || assistantLoading) return;
    setAssistantError(null);
    setAssistantNotice(null);

    const userMessage: AssistantMessage = {
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setAssistantMessages((prev) => [...prev, userMessage]);
    setAssistantInput("");
    setAssistantLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL;
      if (!apiUrl) throw new Error("AI API non configuree");

      const history = [
        ...assistantMessages.slice(-5).map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: trimmed },
      ];

      const assistantEndpoint =
        userRole === "professionnel" ? "/project-chat" : "/project-chat-client";
      const response = await fetch(`${apiUrl}${assistantEndpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          lot_id: interventionId,
          context_type: "lot",
          user_id: user.id,
          user_role: userRole,
          message: trimmed,
          history,
          force_plan: options?.forcePlan ?? false,
        }),
      });

      const data = await response.json();
      const rawReply = (data.reply ?? "Je reviens vers vous avec une proposition.") as string;

      const nextReply = options?.uiMode
        ? formatAssistantReply(options.uiMode, rawReply, {
            projectName: project?.name ?? null,
            projectType: project?.project_type ?? null,
            totalBudgetTtc: 0,
            quotes: [],
          })
        : rawReply;

      const assistantMessage: AssistantMessage = {
        role: "assistant",
        content: nextReply,
        timestamp: new Date().toISOString(),
        proposal: data.proposal ?? null,
        suggestions: data.suggested_questions ?? [],
      };
      setAssistantMessages((prev) => [...prev, assistantMessage]);
      if (data.proposal) {
        setPendingProposal(data.proposal as AssistantProposal);
      }
    } catch (err: any) {
      setAssistantError(err?.message ?? "Impossible de contacter l'assistant IA.");
      setAssistantMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Une erreur est survenue, reessayez.", timestamp: new Date().toISOString() },
      ]);
    } finally {
      setAssistantLoading(false);
    }
  };

  const applyAssistantProposal = async () => {
    if (!canManageProject || !pendingProposal || !interventionId) return;
    for (const task of pendingProposal.tasks) {
      const start = (task.start_date ?? "").trim();
      const end = (task.end_date ?? task.start_date ?? "").trim();
      if (start && end && !isValidDateRange(start, end)) {
        setAssistantError("Chaque tâche doit avoir une date de fin supérieure ou égale à la date de début.");
        return;
      }
    }
    const shouldReplace = window.confirm(
      "Valider ce planning va remplacer les taches actuelles de l'intervention. Voulez-vous continuer ?"
    );
    if (!shouldReplace) return;
    setApplyLoading(true);
    setAssistantError(null);
    setAssistantNotice(null);

    // Delete existing tasks
    for (const t of tasks) {
      await deleteLotTask(t.id).catch(() => {});
    }

    // Insert proposed tasks
    for (let i = 0; i < pendingProposal.tasks.length; i++) {
      const task = pendingProposal.tasks[i];
      if (!task.name?.trim()) continue;
      const dueDate = task.start_date ?? null;
      const desc = [
        task.time_range ? `[${task.time_range}]` : "",
        task.description ?? "",
      ].filter(Boolean).join(" ").trim() || null;
      try {
        await createLotTask(interventionId, {
          title: task.name.trim(),
          dueDate,
          description: desc,
          status: "todo",
          orderIndex: i,
        });
      } catch {
        setAssistantError("Impossible d'ajouter une tache proposee.");
        setApplyLoading(false);
        return;
      }
    }

    setApplyLoading(false);
    setPendingProposal(null);
    setAssistantNotice("Planning mis a jour. Les taches precedentes ont ete remplacees.");
    await load();
  };

  const updateProposalTask = (index: number, patch: Partial<AssistantTask>) => {
    setPendingProposal((prev) => {
      if (!prev) return prev;
      const nextTasks = [...prev.tasks];
      nextTasks[index] = { ...(nextTasks[index] ?? { name: "" }), ...patch };
      return { ...prev, tasks: nextTasks };
    });
  };

  const removeProposalTask = (index: number) => {
    setPendingProposal((prev) => {
      if (!prev) return prev;
      return { ...prev, tasks: prev.tasks.filter((_, idx) => idx !== index) };
    });
  };

  const addProposalTask = () => {
    setPendingProposal((prev) => {
      if (!prev) return prev;
      return { ...prev, tasks: [...prev.tasks, { name: "Nouvelle tache", description: "" }] };
    });
  };

  const assistantActionButtons = useMemo(() => {
    const actions: Array<
      AssistantActionButton & { prompt: string; forcePlan?: boolean }
    > = [
      {
        id: "plan",
        icon: "P",
        title: "Planning",
        description: "Proposition de taches + dates",
        color: "indigo",
        prompt: "Propose un planning detaille pour cette intervention avec les taches principales et les delais.",
        forcePlan: true,
      },
      {
        id: "checklist",
        icon: "C",
        title: "Checklist",
        description: "Liste de controle qualite",
        color: "green",
        prompt: "Genere une checklist de controle qualite pour cette intervention.",
      },
      {
        id: "risks",
        icon: "R",
        title: "Risques",
        description: "Points d'attention",
        color: "red",
        prompt: "Quels sont les risques et points d'attention pour cette intervention ?",
      },
    ];
    return actions.map(({ prompt, forcePlan, ...a }) => ({
      ...a,
      disabled: assistantLoading,
      onClick: () => void sendAssistantMessage(prompt, { forcePlan }),
    }));
  }, [assistantLoading, sendAssistantMessage]);

  if (!projectId || !interventionId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Intervention introuvable.</p>
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
        <Breadcrumb
          items={[
            { label: "Projets", href: `/dashboard/projets?role=${role}` },
            { label: project?.name ?? "Projet", href: `/dashboard/projets/${projectId}?role=${role}` },
            { label: lot?.name ?? "Intervention" },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">
              Projet: {project?.name ?? projectId}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{lot?.name ?? "Intervention"}</h1>
            {lot?.company_name && (
              <p className="text-gray-600">Entreprise: {lot.company_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/projets/${projectId}?role=${role}&tab=interventions`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour projet
            </Button>
            {canEditThisLot && activeTab === "taches" && (
              <Button size="sm" onClick={() => setTaskModalOpen(true)}>
                + Ajouter tache
              </Button>
            )}
          </div>
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium shadow-sm">
            {error}
          </div>
        )}
      </header>

      <nav className="sticky top-3 z-30" aria-label="Navigation de l'intervention">
        <div className="flex flex-wrap gap-1 rounded-2xl border border-neutral-200 bg-white/70 p-1 shadow-[0_18px_55px_-45px_rgba(0,0,0,0.35)] backdrop-blur">
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.key;
            const isAssistant = tab.key === "assistant";
            return (
              <button
                key={tab.key}
                type="button"
                aria-current={isActive ? "page" : undefined}
                className={[
                  "group inline-flex items-center gap-2 whitespace-nowrap",
                  "rounded-xl px-3 py-2 text-sm font-medium",
                  "transition duration-200 ease-out transform-gpu",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                  isActive
                    ? "bg-primary-600 text-white shadow-[0_16px_40px_-28px_rgba(24,0,173,0.45)]"
                    : "text-neutral-700 hover:bg-white hover:text-neutral-900",
                  !isActive ? "hover:-translate-y-[1px]" : "",
                ].join(" ")}
                onClick={() => {
                  setActiveTab(tab.key);
                  updateQuery({ tab: tab.key });
                }}
              >
                <img
                  src={tab.iconSrc}
                  alt=""
                  aria-hidden
                  className={`w-4 h-4 object-contain transition ${isActive ? "brightness-0 invert" : "logo-blend group-hover:scale-[1.02]"}`}
                />
                <span className="text-inherit">{tab.label}</span>
                {isActive && isAssistant ? (
                  <span aria-hidden className="ml-1 inline-flex h-2 w-2 rounded-full bg-primary-200 shadow-[0_0_0_3px_rgba(24,0,173,0.18)]" />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          Chargement...
        </div>
      ) : (
        <>
          {activeTab === "overview" && (
            <section className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-l-4 border-l-blue-200 bg-blue-50/20">
                  <CardHeader className="border-b border-blue-100 bg-blue-50/60">
                    <div className="text-sm text-gray-600">Avancement</div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-gray-900">{progress.pct}%</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {progress.done}/{progress.total} taches terminees
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-primary-600" style={{ width: `${progress.pct}%` }} />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-200 bg-emerald-50/20">
                  <CardHeader className="border-b border-emerald-100 bg-emerald-50/60">
                    <div className="text-sm text-gray-600">Budget</div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(Number(lot?.budget_actual ?? 0))}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      / {formatCurrency(Number(lot?.budget_estimated ?? 0))} estime
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-violet-200 bg-violet-50/20">
                  <CardHeader className="border-b border-violet-100 bg-violet-50/60">
                    <div className="text-sm text-gray-600">Dates</div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-semibold text-gray-900">
                      {lot?.start_date ? formatDate(lot.start_date) : "Non defini"}
                    </div>
                    {lot?.end_date && (
                      <div className="text-xs text-gray-500 mt-1">
                        Fin: {formatDate(lot.end_date)}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-200 bg-amber-50/20">
                  <CardHeader className="border-b border-amber-100 bg-amber-50/60">
                    <div className="text-sm text-gray-600">Statut</div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-semibold text-gray-900 capitalize">
                      {lot?.status?.replace(/_/g, " ") ?? "Planifie"}
                    </div>
                    {lot?.company_name && (
                      <div className="text-xs text-gray-500 mt-1">{lot.company_name}</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2 border-l-4 border-l-primary-200">
                  <CardHeader className="border-b border-primary-100 bg-primary-50/40">
                    <div className="font-semibold text-gray-900">Taches</div>
                    <div className="text-sm text-gray-500">{tasks.length} tache{tasks.length !== 1 ? "s" : ""} pour cette intervention.</div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {tasks.length === 0 ? (
                      <div className="text-sm text-gray-500">Aucune tache pour le moment.</div>
                    ) : (
                      tasks.slice(0, 5).map((t) => {
                        const parsed = parseTaskTime(t);
                        const assignedName = t.assignedTo ? memberNameMap.get(t.assignedTo) : null;
                        return (
                          <div
                            key={t.id}
                            className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                              t.status === "done"
                                ? "border-emerald-200 bg-emerald-50/30"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className={`font-medium ${t.status === "done" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                                {t.title}
                              </div>
                              <div className="text-xs text-gray-500">
                                {t.dueDate ? `Echeance: ${formatDate(t.dueDate)}` : "Sans date"}
                                {parsed.timeLabel ? ` - ${parsed.timeLabel}` : ""}
                              </div>
                              {assignedName && (
                                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                                  {assignedName}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {canEditThisLot && (
                                <button
                                  type="button"
                                  onClick={() => openEditTask(t)}
                                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                  title="Modifier"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              <Button variant="outline" size="sm" disabled={!canEditThisLot} onClick={() => void toggleTask(t)}>
                                {t.status === "done" ? "Reouvrir" : "Terminer"}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {tasks.length > 5 && (
                      <Button variant="outline" size="sm" onClick={() => updateQuery({ tab: "taches" })}>
                        Voir toutes les taches ({tasks.length})
                      </Button>
                    )}
                    {canEditThisLot && (
                      <Button variant="outline" size="sm" onClick={() => setTaskModalOpen(true)}>
                        + Ajouter une tache
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="font-semibold text-gray-900">Documents</div>
                      <div className="text-sm text-gray-500">Fichiers rattaches.</div>
                    </CardHeader>
                    <CardContent className="max-h-[300px] overflow-auto">
                      <DocumentsList context={{ lotId: interventionId }} title="Documents" showUpload={canEditThisLot} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <div className="font-semibold text-gray-900">Actions</div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => updateQuery({ tab: "chat" })}>
                        Ouvrir le chat
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => updateQuery({ tab: "budget" })}>
                        Budget detaille
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => updateQuery({ tab: "assistant" })}>
                        Assistant IA
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </section>
          )}

          {activeTab === "taches" && (
            <section className="space-y-4">
              <Card>
                <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">Taches ({tasks.length})</div>
                    <div className="text-sm text-gray-500">Checklist de l'intervention.</div>
                  </div>
                  {canEditThisLot && (
                    <Button size="sm" onClick={() => setTaskModalOpen(true)}>
                      + Ajouter tache
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasks.length === 0 ? (
                    <div className="text-sm text-gray-500">Aucune tache pour le moment.</div>
                  ) : (
                    tasks.map((t) => {
                      const parsed = parseTaskTime(t);
                      const assignedName = t.assignedTo ? memberNameMap.get(t.assignedTo) : null;
                      return (
                        <div
                          key={t.id}
                          className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                            t.status === "done"
                              ? "border-emerald-200 bg-emerald-50/30"
                              : t.status === "in_progress"
                                ? "border-blue-200 bg-blue-50/30"
                                : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className={`font-medium ${t.status === "done" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                              {t.title}
                            </div>
                            <div className="text-xs text-gray-500">
                              {t.status === "done" ? "Terminee" : t.status === "in_progress" ? "En cours" : "A faire"}
                              {t.dueDate ? ` - Echeance: ${formatDate(t.dueDate)}` : ""}
                              {parsed.timeLabel ? ` - ${parsed.timeLabel}` : ""}
                            </div>
                            {parsed.cleanDesc && <div className="text-xs text-gray-500 mt-1">{parsed.cleanDesc}</div>}
                            {assignedName && (
                              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                                {assignedName}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {canEditThisLot && (
                              <button
                                type="button"
                                onClick={() => openEditTask(t)}
                                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                title="Modifier"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            <Button variant="outline" size="sm" disabled={!canEditThisLot} onClick={() => void toggleTask(t)}>
                              {t.status === "done" ? "Reouvrir" : "Terminer"}
                            </Button>
                            {canEditThisLot && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-200 text-red-600"
                                onClick={() => void removeTask(t)}
                              >
                                Supprimer
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {activeTab === "planning" && (
            <section className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-gray-900">Planning</div>
                      <div className="text-sm text-gray-500">
                        Semaine du {formatDate(toDateKey(weekDays[0]))} au {formatDate(toDateKey(weekDays[6]))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                        Semaine precedente
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWeekStart(startOfWeek(new Date()))}
                      >
                        Aujourd&apos;hui
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                        Semaine suivante
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="min-w-[1120px] rounded-lg border border-gray-200 bg-white">
                      {/* Day header row */}
                      <div className="grid grid-cols-[80px_repeat(7,minmax(140px,1fr))] border-b border-gray-200">
                        <div className="sticky left-0 z-30 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                          Heure
                        </div>
                        {weekDays.map((day) => {
                          const dk = toDateKey(day);
                          const isToday = dk === todayKey;
                          return (
                            <div
                              key={dk}
                              className={`border-l border-gray-200 px-3 py-2 text-sm font-semibold ${
                                isToday ? "bg-primary-50 text-primary-900" : "bg-gray-50 text-gray-700"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{formatDayLabel(day)}</span>
                                {isToday && (
                                  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                                    Aujourd&apos;hui
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* All day row */}
                      <div className="grid grid-cols-[80px_repeat(7,minmax(140px,1fr))] border-b border-gray-200">
                        <div className="sticky left-0 z-20 bg-gray-50 px-3 py-3 text-[11px] font-medium text-gray-500">
                          Toute la journee
                        </div>
                        {weekDays.map((day) => {
                          const dk = toDateKey(day);
                          const dayTasks = tasksByDay.allDay.get(dk) ?? [];
                          const isToday = dk === todayKey;
                          return (
                            <div
                              key={dk}
                              className={`min-h-[72px] border-l border-gray-200 px-2 py-2 ${
                                isToday ? "bg-primary-50/30" : "bg-white"
                              }`}
                            >
                              {dayTasks.length === 0 ? (
                                <div className="text-[11px] text-gray-400">Aucune action</div>
                              ) : (
                                <div className="space-y-2">
                                  {dayTasks.map((task) => {
                                    const colorClass = pickTaskColor(task.title);
                                    const assignedName = task.assignedTo ? memberNameMap.get(task.assignedTo) : null;
                                    return (
                                      <div
                                        key={task.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => canEditThisLot && openEditTask(task)}
                                        onKeyDown={(e) => { if (e.key === "Enter" && canEditThisLot) openEditTask(task); }}
                                        className={`min-w-0 overflow-hidden break-words rounded-md border-l-4 border px-2 py-1 text-[11px] shadow-sm cursor-pointer hover:ring-2 hover:ring-primary-300 transition ${colorClass}`}
                                      >
                                        <div className={`font-medium ${task.status === "done" ? "line-through text-gray-400" : "text-gray-900"}`}>
                                          {task.title}
                                        </div>
                                        {task.cleanDesc && (
                                          <div className="text-[10px] text-gray-600 break-words">{task.cleanDesc}</div>
                                        )}
                                        {assignedName && (
                                          <div className="text-[10px] text-primary-600 mt-0.5">{assignedName}</div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Hourly slots */}
                      <div className="grid grid-cols-[80px_repeat(7,minmax(140px,1fr))] border-t border-gray-200">
                        <div className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200">
                          {planningTimeSlots.map((hour) => (
                            <div
                              key={hour}
                              className="px-3 text-xs font-medium text-gray-500 border-b border-gray-200 flex items-center"
                              style={{ height: `${planningRowHeight}px` }}
                            >
                              {formatHourLabel(hour)}
                            </div>
                          ))}
                        </div>
                        {weekDays.map((day) => {
                          const dk = toDateKey(day);
                          const isToday = dk === todayKey;
                          const blocks = tasksByDay.timed.get(dk) ?? [];
                          return (
                            <div
                              key={dk}
                              className={`relative border-l border-gray-200 ${isToday ? "bg-primary-50/30" : "bg-white"}`}
                              style={{ height: `${planningRowHeight * planningTimeSlots.length}px` }}
                            >
                              <div className="absolute inset-0">
                                {planningTimeSlots.map((hour) => (
                                  <div
                                    key={`${dk}-${hour}`}
                                    className="border-b border-gray-200"
                                    style={{ height: `${planningRowHeight}px` }}
                                  />
                                ))}
                              </div>
                              <div className="relative z-10">
                                {blocks.map((block) => {
                                  const clampedStart = Math.max(block.startHour, planningHourStart);
                                  const clampedEnd = Math.min(block.endHour, planningHourEnd + 1);
                                  const top = (clampedStart - planningHourStart) * planningRowHeight;
                                  const height = Math.max((clampedEnd - clampedStart) * planningRowHeight, 24);
                                  const assignedName = block.task.assignedTo ? memberNameMap.get(block.task.assignedTo) : null;
                                  return (
                                    <div
                                      key={block.task.id}
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => { e.stopPropagation(); if (canEditThisLot) openEditTask(block.task); }}
                                      onKeyDown={(e) => { if (e.key === "Enter" && canEditThisLot) { e.stopPropagation(); openEditTask(block.task); } }}
                                      className={`absolute left-2 right-2 rounded-md border-l-4 border px-3 py-2 text-[11px] shadow-sm overflow-hidden break-words cursor-pointer hover:ring-2 hover:ring-primary-300 transition ${block.colorClass}`}
                                      style={{ top: `${top}px`, height: `${height}px` }}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span
                                          className={`min-w-0 font-medium leading-tight ${block.task.status === "done" ? "line-through text-gray-400" : ""}`}
                                          style={{
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                          }}
                                        >
                                          {block.task.title}
                                        </span>
                                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium">
                                          {block.timeLabel}
                                        </span>
                                      </div>
                                      {block.cleanDesc && (
                                        <div
                                          className="text-[10px] text-gray-600 mt-1 break-words"
                                          style={{
                                            display: "-webkit-box",
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                          }}
                                        >
                                          {block.cleanDesc}
                                        </div>
                                      )}
                                      {assignedName && (
                                        <div className="text-[10px] text-primary-600 mt-0.5 truncate">{assignedName}</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tasks without dates */}
              {tasks.filter((t) => !t.dueDate).length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="font-semibold text-gray-900">Taches sans date</div>
                    <div className="text-sm text-gray-500">Ces taches n&apos;apparaissent pas dans le planning.</div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {tasks
                      .filter((t) => !t.dueDate)
                      .map((t) => (
                        <div
                          key={t.id}
                          className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                            t.status === "done" ? "border-emerald-200 bg-emerald-50/30" : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className={`font-medium ${t.status === "done" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                              {t.title}
                            </div>
                            {t.description && <div className="text-xs text-gray-500 mt-1">{t.description}</div>}
                          </div>
                          <Button variant="outline" size="sm" disabled={!canEditThisLot} onClick={() => void toggleTask(t)}>
                            {t.status === "done" ? "Reouvrir" : "Terminer"}
                          </Button>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          {activeTab === "chat" && (
            <section className="space-y-3">
              <div className="h-[60vh]">
                <ChatBox context={{ lotId: interventionId }} title="Discussion intervention" />
              </div>
            </section>
          )}

          {activeTab === "budget" && (
            <LotBudgetPanel projectId={projectId} phaseId={lot?.phase_id ?? ""} lotId={interventionId} role={role} />
          )}

          {activeTab === "documents" && (
            <section className="h-[60vh]">
              <DocumentsList context={{ lotId: interventionId }} title="Documents" showUpload={canEditThisLot} />
            </section>
          )}

          {activeTab === "assistant" && (
            <section className="space-y-6">
              <Card className="min-h-[520px] h-[calc(100vh-280px)] flex flex-col">
                <CardContent className="flex flex-col gap-4 flex-1 min-h-0">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-neutral-900">Actions rapides</div>
                        <div className="text-xs text-neutral-500">Proposition de planning, checklist, analyse de risques.</div>
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
                            <img src="/images/grey/robot.png" alt="Assistant IA" className="w-5 h-5 object-contain logo-blend" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                            msg.role === "user"
                              ? "bg-primary-400 text-white shadow-sm [&_*]:text-white"
                              : "bg-neutral-100 text-neutral-900 border border-neutral-200 shadow-sm"
                          }`}
                        >
                          <ChatMessageMarkdown content={msg.content} />
                          {msg.role === "assistant" && msg.suggestions && msg.suggestions.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-neutral-200">
                              {msg.suggestions.map((q, i) => (
                                <button
                                  key={i}
                                  onClick={() => sendAssistantMessage(q)}
                                  disabled={assistantLoading}
                                  type="button"
                                  className="text-xs px-3 py-1.5 rounded-full border border-primary-300 text-primary-500 bg-white hover:bg-primary-50 transition-colors disabled:opacity-50"
                                >
                                  {q}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {assistantLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <img src="/images/grey/robot.png" alt="" className="w-5 h-5 object-contain logo-blend" />
                        </div>
                        <div className="bg-neutral-100 border border-neutral-200 rounded-lg px-4 py-2 shadow-sm">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pb-2">
                    <input
                      type="text"
                      value={assistantInput}
                      onChange={(event) => setAssistantInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void sendAssistantMessage(assistantInput);
                      }}
                      placeholder="Posez une question ou demandez un planning..."
                      className="flex-1 h-14 px-4 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white text-base"
                      disabled={assistantLoading}
                    />
                    <Button
                      onClick={() => sendAssistantMessage(assistantInput)}
                      disabled={assistantLoading || !assistantInput.trim()}
                      className="h-14"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {pendingProposal && canManageProject && (
                <Card>
                  <CardHeader>
                    <div className="font-semibold text-gray-900">Proposition de planning</div>
                    <div className="text-sm text-gray-500">A valider avant insertion des taches.</div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pendingProposal.summary && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        {pendingProposal.summary}
                      </div>
                    )}
                    <div className="space-y-3">
                      {pendingProposal.tasks.map((task, index) => (
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
                            onChange={(e) => updateProposalTask(index, { name: e.target.value })}
                          />
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                            <Input
                              label="Debut"
                              type="date"
                              value={task.start_date ?? ""}
                              onChange={(e) => updateProposalTask(index, { start_date: normalizeDateValue(e.target.value) || e.target.value })}
                            />
                            <Input
                              label="Fin"
                              type="date"
                              value={task.end_date ?? ""}
                              onChange={(e) => updateProposalTask(index, { end_date: normalizeDateValue(e.target.value) || e.target.value })}
                            />
                            <Input
                              label="Creneau"
                              value={task.time_range ?? ""}
                              onChange={(e) => updateProposalTask(index, { time_range: e.target.value })}
                              placeholder="HH:MM-HH:MM"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" onClick={addProposalTask}>
                      Ajouter une tache
                    </Button>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Valider remplacera les taches actuelles de l'intervention.
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={applyAssistantProposal} disabled={applyLoading}>
                        {applyLoading ? "Application..." : "Valider le planning"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => sendAssistantMessage("Refais un autre planning, plus adapte.", { forcePlan: true })}
                        disabled={assistantLoading}
                      >
                        Refaire
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          )}
        </>
      )}

      {taskModalOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setTaskModalOpen(false); }}
        >
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-lg w-full p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Nouvelle tache</h3>
                <p className="text-sm text-neutral-600">Ajoutez une tache a l'intervention.</p>
              </div>
              <Button variant="ghost" onClick={() => setTaskModalOpen(false)}>
                Fermer
              </Button>
            </div>
            <form className="space-y-4" onSubmit={handleCreateTask}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Titre *</label>
                <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: normalizeDateValue(e.target.value) || e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Heure debut</label>
                  <Input
                    type="time"
                    value={taskForm.startTime}
                    onChange={(e) => setTaskForm({ ...taskForm, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Heure fin</label>
                  <Input
                    type="time"
                    value={taskForm.endTime}
                    onChange={(e) => setTaskForm({ ...taskForm, endTime: e.target.value })}
                  />
                </div>
              </div>
              {members.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assigner a</label>
                  <select
                    value={taskForm.assignedTo}
                    onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                    className="w-full h-10 px-3 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 text-sm"
                  >
                    <option value="">Non assigne</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.fullName || m.email} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full min-h-[100px] px-3 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                  placeholder="Details de la tache"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTaskModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={taskSubmitting}>
                  {taskSubmitting ? "Creation..." : "Creer la tache"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModalOpen && editingTask && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setEditModalOpen(false); setEditingTask(null); } }}
        >
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-lg w-full p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Modifier la tache</h3>
                <p className="text-sm text-neutral-600">Modifiez les informations de la tache.</p>
              </div>
              <Button variant="ghost" onClick={() => { setEditModalOpen(false); setEditingTask(null); }}>
                Fermer
              </Button>
            </div>
            <form className="space-y-4" onSubmit={handleEditTask}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Titre *</label>
                <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm({ ...editForm, dueDate: normalizeDateValue(e.target.value) || e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Heure debut</label>
                  <Input
                    type="time"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Heure fin</label>
                  <Input
                    type="time"
                    value={editForm.endTime}
                    onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Statut</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full h-10 px-3 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 text-sm"
                >
                  <option value="todo">A faire</option>
                  <option value="in_progress">En cours</option>
                  <option value="done">Terminee</option>
                </select>
              </div>
              {members.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assigner a</label>
                  <select
                    value={editForm.assignedTo}
                    onChange={(e) => setEditForm({ ...editForm, assignedTo: e.target.value })}
                    className="w-full h-10 px-3 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 text-sm"
                  >
                    <option value="">Non assigne</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.fullName || m.email} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full min-h-[100px] px-3 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                  placeholder="Details de la tache"
                />
              </div>
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-200 text-red-600"
                  onClick={async () => {
                    await removeTask(editingTask);
                    setEditModalOpen(false);
                    setEditingTask(null);
                  }}
                >
                  Supprimer
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => { setEditModalOpen(false); setEditingTask(null); }}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={editSubmitting}>
                    {editSubmitting ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
