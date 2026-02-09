"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowLeft, Bot, Send } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { mapUserTypeToRole, useAuth } from "@/hooks/useAuth";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { deleteDevisWithItems, mapDevisRowToSummary } from "@/lib/devisDb";
import { downloadQuotePdf } from "@/lib/quotePdf";
import { deleteProjectCascade, inviteProjectMemberByEmail } from "@/lib/projectsDb";
import { createPhase, fetchPhasesForProject, type PhaseSummary } from "@/lib/phasesDb";
import type { QuoteSummary } from "@/lib/quotesStore";
import { ChatMessageMarkdown } from "@/components/chat/ChatMessageMarkdown";
import ChatBox from "@/components/chat/ChatBox";
import DocumentsList from "@/components/documents/DocumentsList";
import type { AssistantActionButton } from "@/components/assistant/ActionButton";
import { ActionMenu } from "@/components/assistant/ActionMenu";
import { formatAssistantReply, type AssistantUiMode } from "@/lib/assistantResponses";
import { ProjectGuidePanel } from "@/components/guide/ProjectGuidePanel";

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

const _firstOrNull = <T,>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
};

type Task = {
  id: string;
  name: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  completed_at?: string | null;
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
  requires_devis?: boolean;
};

type TabKey = "overview" | "phases" | "chat" | "devis" | "planning" | "membres" | "assistant" | "guide";
type WorkflowStatus = "a_faire" | "envoye" | "valide" | "refuse";

const tabItems: Array<{ key: TabKey; label: string; iconSrc: string }> = [
  { key: "overview", label: "Aperçu", iconSrc: "/images/grey/eye.png" },
  { key: "phases", label: "Phases", iconSrc: "/images/grey/files.png" },
  { key: "chat", label: "Chat", iconSrc: "/images/grey/chat-teardrop-dots.png" },
  { key: "devis", label: "Devis", iconSrc: "/images/grey/files.png" },
  { key: "planning", label: "Planning", iconSrc: "/images/grey/calendar%20(1).png" },
  { key: "membres", label: "Membres", iconSrc: "/images/grey/users-three%20(1).png" },
  { key: "assistant", label: "Assistant IA", iconSrc: "/images/grey/robot.png" },
  { key: "guide", label: "Guide", iconSrc: "/images/clipboard-text.png" },
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

const buildDayRange = (startKey: string, endKey: string) => {
  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);
  const days: string[] = [];
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    days.push(toDateKey(date));
  }
  return days;
};

const parseTimeRange = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return null;
  const startHour = Number(match[1]);
  const startMinute = Number(match[2]);
  const endHour = Number(match[3]);
  const endMinute = Number(match[4]);
  if (Number.isNaN(startHour) || Number.isNaN(startMinute)) return null;
  if (Number.isNaN(endHour) || Number.isNaN(endMinute)) return null;
  return { startHour, startMinute, endHour, endMinute, label: value };
};

const resolveWorkflowStatus = (quote: QuoteSummary): WorkflowStatus => {
  const metadata = quote.rawMetadata ?? {};
  const workflow = typeof metadata.workflow_status === "string" ? metadata.workflow_status : null;
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

const getWorkflowLabel = (status: WorkflowStatus) => {
  const labels: Record<WorkflowStatus, string> = {
    a_faire: "En étude",
    envoye: "Envoyé",
    valide: "Validé",
    refuse: "Refusé",
  };
  return labels[status];
};

const getWorkflowBadge = (status: WorkflowStatus) => {
  const styles: Record<WorkflowStatus, string> = {
    a_faire: "bg-amber-100 text-amber-800",
    envoye: "bg-blue-100 text-blue-800",
    valide: "bg-green-100 text-green-800",
    refuse: "bg-red-100 text-red-800",
  };
  return styles[status];
};

const formatMemberRole = (role?: string | null) => {
  if (!role) return "Membre";
  const normalized = role.toLowerCase();
  if (normalized === "owner") return "Propriétaire";
  if (normalized === "client" || normalized === "particulier") return "Client";
  if (normalized === "pro" || normalized === "professionnel") return "Professionnel";
  if (normalized === "collaborator" || normalized === "collaborateur") return "Collaborateur";
  return role;
};

const formatMemberStatus = (status?: string | null) => {
  if (!status) return "En attente";
  const normalized = status.toLowerCase();
  if (normalized === "accepted") return "Accepté";
  if (normalized === "pending") return "En attente";
  if (normalized === "invited") return "Invité";
  if (normalized === "declined" || normalized === "refused") return "Refusé";
  if (normalized === "removed") return "Retiré";
  if (normalized === "active") return "Actif";
  return status;
};

const TASK_STATUS_OPTIONS = [
  { value: "not_started", label: "À faire" },
  { value: "in_progress", label: "En cours" },
  { value: "done", label: "Terminée" },
] as const;

type TaskStatusValue = (typeof TASK_STATUS_OPTIONS)[number]["value"];

const TASK_STATUS_DB_MAP: Record<TaskStatusValue, string[]> = {
  not_started: ["not_started", "todo", "a_faire", "draft"],
  in_progress: ["in_progress", "active", "ongoing", "en_cours", "paused"],
  done: ["done", "completed", "termine", "finished", "validated"],
};
const normalizeTaskStatus = (status: string | null): TaskStatusValue => {
  if (!status) return "not_started";
  const normalized = status.toLowerCase();
  if (["done", "completed", "termine", "finished", "validated"].includes(normalized)) return "done";
  if (["in_progress", "active", "ongoing", "en_cours", "paused"].includes(normalized)) return "in_progress";
  if (["not_started", "todo", "a_faire", "draft"].includes(normalized)) return "not_started";
  return "not_started";
};

const isTaskCompleted = (status: string | null) => normalizeTaskStatus(status) === "done";

const toLocalDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getTaskDueDate = (task: Task) => {
  const raw = task.end_date ?? task.start_date;
  return raw ? toLocalDate(raw) : null;
};

const getTaskCompletionDate = (task: Task) => {
  if (!task.completed_at) return null;
  const parsed = new Date(task.completed_at);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getTaskDelayLabel = (task: Task) => {
  const dueDate = getTaskDueDate(task);
  if (!dueDate) return null;
  const completedAt = getTaskCompletionDate(task);
  if (isTaskCompleted(task.status) && !completedAt) return null;
  const reference = completedAt ?? new Date();
  const diffMs = reference.getTime() - dueDate.getTime();
  if (diffMs <= 0) return null;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return `${diffDays} j de retard`;
};

const isTaskLate = (task: Task) => Boolean(getTaskDelayLabel(task));

const getTaskCardStyle = (task: Task) => {
  if (isTaskLate(task) && !isTaskCompleted(task.status)) {
    return "border-l-4 border-l-red-300 bg-red-50/30";
  }
  const status = normalizeTaskStatus(task.status);
  if (status === "done") {
    return "border-l-4 border-l-emerald-300 bg-emerald-50/30";
  }
  if (status === "in_progress") {
    return "border-l-4 border-l-blue-300 bg-blue-50/30";
  }
  return "border-l-4 border-l-slate-200 bg-slate-50/30";
};

const PROJECT_STATUS_OPTIONS = [
  { value: "draft", label: "À faire" },
  { value: "en_cours", label: "En cours" },
  { value: "en_attente", label: "En attente" },
  { value: "termine", label: "Terminé" },
] as const;

type ProjectStatusValue = (typeof PROJECT_STATUS_OPTIONS)[number]["value"];

const PROJECT_STATUS_DB_MAP: Record<ProjectStatusValue, string[]> = {
  draft: ["draft", "a_faire"],
  en_cours: ["en_cours", "in_progress", "active"],
  en_attente: ["en_attente", "pending", "paused", "quoted", "cancelled"],
  termine: ["termine", "completed", "done"],
};
const normalizeProjectStatus = (status: string | null): ProjectStatusValue => {
  if (!status) return "draft";
  const normalized = status.toLowerCase();
  if (["en_cours", "in_progress", "active"].includes(normalized)) return "en_cours";
  if (["termine", "completed", "done"].includes(normalized)) return "termine";
  if (["en_attente", "pending", "paused", "quoted", "cancelled"].includes(normalized)) return "en_attente";
  return "draft";
};

const normalizeText = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

function splitTaskDescription(description: string | null) {
  if (!description) return { time: null, text: null };
  const match = description.match(/^\[\[time:([^\]]+)\]\]\s*(.*)$/);
  if (!match) return { time: null, text: description };
  return { time: match[1], text: match[2] || "" };
}

const computeDurationHours = (task: Task) => {
  const parsed = splitTaskDescription(task.description);
  const timeRange = parseTimeRange(parsed.time ?? null);
  if (timeRange) {
    const startMinutes = timeRange.startHour * 60 + timeRange.startMinute;
    const endMinutes = timeRange.endHour * 60 + timeRange.endMinute;
    const diff = endMinutes - startMinutes;
    if (diff > 0) {
      return diff / 60;
    }
  }
  if (task.start_date) {
    const startDate = toLocalDate(task.start_date);
    const endDate = toLocalDate(task.end_date ?? task.start_date);
    if (startDate && endDate) {
      const diffMs = endDate.getTime() - startDate.getTime();
      const days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
      return days * 8;
    }
  }
  return null;
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const taskPalette = [
  "border-blue-300 bg-blue-50 text-blue-900",
  "border-emerald-300 bg-emerald-50 text-emerald-900",
  "border-amber-300 bg-amber-50 text-amber-900",
  "border-violet-300 bg-violet-50 text-violet-900",
  "border-rose-300 bg-rose-50 text-rose-900",
  "border-cyan-300 bg-cyan-50 text-cyan-900",
];

const pickTaskColor = (label: string) => {
  if (!label) return taskPalette[0];
  return taskPalette[hashString(label) % taskPalette.length];
};

const hourRange = { start: 7, end: 20 };
const planningRowHeight = 64;

const formatHourLabel = (hour: number) => `${hour.toString().padStart(2, "0")}:00`;

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const roleParam = searchParams.get("role");
  const tabParam = searchParams.get("tab");
  const contextPhaseId = searchParams.get("phaseId");
  const contextLotId = searchParams.get("lotId");
  const guideSectionParam = searchParams.get("section");
  const guideQueryParam = searchParams.get("q");
  const guideTermParam = searchParams.get("term");
  const role = roleParam === "professionnel" ? "professionnel" : "particulier";
  const userRole = profile ? mapUserTypeToRole(profile.user_type) : role;
  const projectId = typeof params.id === "string" ? params.id : "";
  const assistantContextType = contextLotId ? "lot" : contextPhaseId ? "phase" : "project";

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [availableQuotes, setAvailableQuotes] = useState<QuoteSummary[]>([]);
  const [phases, setPhases] = useState<PhaseSummary[]>([]);
  const [phasesLoading, setPhasesLoading] = useState(false);
  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
  const [phaseSubmitting, setPhaseSubmitting] = useState(false);
  const [phaseForm, setPhaseForm] = useState({
    name: "",
    description: "",
    phaseOrder: "1",
    startDate: "",
    endDate: "",
    budgetEstimated: "",
  });
  const isTabKey = (value: string | null): value is TabKey =>
    !!value && tabItems.some((tab) => tab.key === value);
  const [activeTab, setActiveTab] = useState<TabKey>(() => (isTabKey(tabParam) ? tabParam : "overview"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskName, setTaskName] = useState("");
  const [taskDates, setTaskDates] = useState({ start: "", end: "" });
  const [taskDescription, setTaskDescription] = useState("");
  const [taskTime, setTaskTime] = useState({ start: "", end: "" });
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [inviteEmail, setInvitéEmail] = useState("");
  const [inviteRole, setInvitéRole] = useState("client");
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [quoteStatusUpdatingId, setQuoteStatusUpdatingId] = useState<string | null>(null);
  const [quoteDeletingId, setQuoteDeletingId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishSubmitting, setPublishSubmitting] = useState(false);
  const [publishForm, setPublishForm] = useState({
    title: "",
    summary: "",
    budgetTotal: "",
    durationDays: "",
    city: "",
    postalCode: "",
    imagePath: "",
  });
  const getAssistantIntro = (roleValue: string) =>
    roleValue === "professionnel"
      ? "Bonjour ! Je peux analyser le devis du projet et proposer un planning de tâches. Décrivez ce que vous voulez."
      : "Bonjour ! Je suis votre conseiller : je peux expliquer les étapes du projet, clarifier les termes du BTP et vous aider à comprendre un devis.";

  const assistantIntroVariants = [
    "Bonjour ! Je peux analyser le devis du projet et proposer un planning de tâches. Décrivez ce que vous voulez.",
    "Bonjour ! Je suis votre conseiller : je peux expliquer les étapes du projet, clarifier les termes du BTP et vous aider à comprendre un devis.",
  ];

  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content: getAssistantIntro(userRole),
      timestamp: new Date().toISOString(),
    },
  ]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantNotice, setAssistantNotice] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = useState<AssistantProposal | null>(null);
  const [assistantActiveAction, setAssistantActiveAction] = useState<AssistantActionButton["id"] | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const assistantSectionRef = useRef<HTMLDivElement | null>(null);
  const assistantMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const assistantMessagesEndRef = useRef<HTMLDivElement | null>(null);

  const updateQuery = (patch: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.replace(`/dashboard/projets/${projectId}?${next.toString()}`, { scroll: false });
  };

  const openGuide = (section?: string, patch?: Record<string, string | null | undefined>) => {
    updateQuery({
      tab: "guide",
      section: section ?? null,
      term: null,
      q: null,
      ...(patch || {}),
    });
  };

  const openAssistantTab = () => {
    setActiveTab("assistant");
    updateQuery({ tab: "assistant", section: null, q: null, term: null });
  };

  const animateScrollTop = (
    element: { scrollTop: number },
    to: number,
    durationMs = 650
  ) => {
    const from = element.scrollTop;
    const delta = to - from;
    if (!Number.isFinite(delta) || Math.abs(delta) < 2) return;

    const start = performance.now();
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      element.scrollTop = from + delta * easeInOutCubic(t);
      if (t < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!isTabKey(tabParam)) return;
    if (tabParam === activeTab) return;
    setActiveTab(tabParam);
  }, [tabParam, activeTab]);

  useEffect(() => {
    if (activeTab !== "assistant") return;
    const id = window.setTimeout(() => {
      const target = assistantSectionRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const alreadyComfortable = rect.top >= 80 && rect.top <= window.innerHeight * 0.35;
      if (alreadyComfortable) return;
      animateScrollTop(window.document.documentElement, window.scrollY + rect.top - 80, 800);
    }, 50);
    return () => window.clearTimeout(id);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "assistant") return;
    const container = assistantMessagesContainerRef.current;
    if (!container) return;
    const target = container.scrollHeight;
    animateScrollTop(container, target, 700);
  }, [assistantLoading, assistantMessages.length, activeTab]);

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

  const currentMember = useMemo(
    () => members.find((member) => member.user?.id === user?.id) ?? null,
    [members, user?.id]
  );
  const memberRole = (currentMember?.role ?? "").toLowerCase();
  const memberStatus = (currentMember?.status ?? "").toLowerCase();
  const isOwnerByProject = project?.created_by === user?.id;
  const isAcceptedMember =
    memberStatus === "accepted" || memberStatus === "active" || isOwnerByProject;
  const isManagerRole =
    ["owner", "collaborator", "pro", "professionnel"].includes(memberRole) || isOwnerByProject;
  const canManageProject = isAcceptedMember && isManagerRole;
  const canInviteMembers = canManageProject;
  const canEditTasks = canManageProject;
  const canEditPlanning = canManageProject;
  const canEditQuotes = canManageProject;
  const canUseAssistantPlanning = canManageProject;

  const loadProject = async () => {
    if (!projectId || !user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [projectRes, membersRes, tasksRes, devisRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
        supabase
          .from("project_members")
          .select(
            "id,role,status,invited_email,user:profiles!project_members_user_id_fkey(id,full_name,email,company_name)"
          )
          .eq("project_id", projectId),
        supabase
          .from("project_tasks")
          .select("id,name,status,start_date,end_date,description,completed_at")
          .eq("project_id", projectId)
          .order("start_date", { ascending: true }),
        supabase
          .from("devis")
          .select("id,status,total,updated_at,created_at,metadata")
          .eq("project_id", projectId)
          .order("updated_at", { ascending: false }),
      ]);

      if (projectRes.error) throw projectRes.error;
      if (membersRes.error) throw membersRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (devisRes.error) throw devisRes.error;

      setProject((projectRes.data as Project) ?? null);
      const normalizedMembers: Member[] = (membersRes.data ?? []).map((row: any) => ({
        id: String(row.id),
        role: row.role ?? null,
        status: row.status ?? null,
        invited_email: row.invited_email ?? null,
        user: _firstOrNull(row.user) as any,
      }));
      setMembers(normalizedMembers);
      setTasks((tasksRes.data as Task[]) ?? []);
      const mappedQuotes = (devisRes.data ?? []).map((row) => mapDevisRowToSummary(row as any));
      setQuotes(mappedQuotes);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger le projet.");
    } finally {
      setLoading(false);
    }
  };

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

  const loadPhases = async () => {
    if (!projectId) return;
    setPhasesLoading(true);
    try {
      const data = await fetchPhasesForProject(projectId);
      setPhases(data);
    } catch {
      setPhases([]);
    } finally {
      setPhasesLoading(false);
    }
  };

  useEffect(() => {
    void loadProject();
  }, [projectId, user?.id]);

  useEffect(() => {
    if (activeTab !== "phases") return;
    void loadPhases();
  }, [activeTab, projectId]);

  useEffect(() => {
    if (activeTab === "devis") {
      void loadAvailableQuotes();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "planning") {
      setWeekStart(startOfWeek(new Date()));
    }
  }, [activeTab]);

  const handleCreatePhase = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageProject) {
      setError("Accès refusé: vous ne pouvez pas créer une phase.");
      return;
    }
    if (!projectId || !phaseForm.name.trim()) return;
    setPhaseSubmitting(true);
    setError(null);
    try {
      await createPhase(projectId, {
        name: phaseForm.name,
        description: phaseForm.description,
        phaseOrder: Number(phaseForm.phaseOrder) || 1,
        startDate: phaseForm.startDate || null,
        endDate: phaseForm.endDate || null,
        budgetEstimated: phaseForm.budgetEstimated ? Number(phaseForm.budgetEstimated) : 0,
        status: "planifiee",
      });
      setPhaseForm({
        name: "",
        description: "",
        phaseOrder: String((phases?.length ?? 0) + 1),
        startDate: "",
        endDate: "",
        budgetEstimated: "",
      });
      setPhaseModalOpen(false);
      await loadPhases();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de créer la phase.");
    } finally {
      setPhaseSubmitting(false);
    }
  };

  const buildTaskDescription = () => {
    const notes = taskDescription.trim();
    const hasTime = taskTime.start || taskTime.end;
    if (!hasTime) return notes || null;
    const timeLabel = `${taskTime.start || "--:--"}-${taskTime.end || "--:--"}`;
    const prefix = `[[time:${timeLabel}]]`;
    return notes ? `${prefix} ${notes}` : prefix;
  };

  const openTaskModal = (day: Date) => {
    if (!canEditTasks) {
      setError("Seuls les professionnels peuvent ajouter des tâches.");
      return;
    }
    const dayKey = toDateKey(day);
    setSelectedDay(day);
    setTaskName("");
    setTaskDates({ start: dayKey, end: dayKey });
    setTaskTime({ start: "", end: "" });
    setTaskDescription("");
    setIsTaskModalOpen(true);
  };

  const handleAddTask = async () => {
    if (!canEditTasks) {
      setError("Seuls les professionnels peuvent modifier le planning.");
      return;
    }
    if (!taskName.trim()) return;
    const payloadBase = {
      project_id: projectId,
      name: taskName.trim(),
      start_date: taskDates.start || null,
      end_date: taskDates.end || null,
      description: buildTaskDescription(),
    };
    const candidates = TASK_STATUS_DB_MAP.not_started;
    let insertError: { message?: string } | null = null;
    for (const statusValue of candidates) {
      const { error } = await supabase.from("project_tasks").insert({
        ...payloadBase,
        status: statusValue,
      });
      if (!error) {
        insertError = null;
        break;
      }
      insertError = error;
      if (!error.message?.includes("status_check")) {
        break;
      }
    }
    if (insertError) {
      setError(insertError.message ?? "Impossible d'ajouter la tâche.");
      return;
    }
    setIsTaskModalOpen(false);
    await loadProject();
  };

  const syncLearningEvent = async (task: Task, isActive: boolean) => {
    if (!user?.id || !projectId || !task?.id) return;
    const normalized = normalizeLabel(task.name || "");
    if (!normalized) return;
    const parsed = splitTaskDescription(task.description);
    const durationHours = computeDurationHours(task);
    const updated_at = new Date().toISOString();
    if (!isActive) {
      const { error: updateError } = await supabase
        .from("task_learning_events")
        .update({ is_active: false, updated_at })
        .eq("task_id", task.id);
      if (updateError) {
        setError(updateError.message ?? "Impossible de mettre à jour la base d'apprentissage.");
      }
      return;
    }
    const payload = {
      task_id: task.id,
      project_id: projectId,
      user_id: user.id,
      trade: project?.project_type ?? null,
      task_name: task.name,
      normalized_label: normalized,
      description: parsed.text ?? null,
      start_date: task.start_date ?? null,
      end_date: task.end_date ?? task.start_date ?? null,
      time_range: parsed.time ?? null,
      duration_hours: durationHours,
      is_active: true,
      updated_at,
    };
    const { error: upsertError } = await supabase
      .from("task_learning_events")
      .upsert(payload, { onConflict: "task_id" });
    if (upsertError) {
      setError(upsertError.message ?? "Impossible de mettre à jour la base d'apprentissage.");
    }
  };

  const handleUpdateTaskStatus = async (task: Task, nextStatus: TaskStatusValue) => {
    if (!canEditTasks) {
      setError("Seuls les professionnels peuvent modifier les tâches.");
      return;
    }
    const nextCompletedAt = nextStatus === "done" ? task.completed_at ?? new Date().toISOString() : null;
    const candidates = TASK_STATUS_DB_MAP[nextStatus] ?? [nextStatus];
    let updateError: { message?: string } | null = null;
    for (const statusValue of candidates) {
      const { error } = await supabase
        .from("project_tasks")
        .update({ status: statusValue, completed_at: nextCompletedAt })
        .eq("id", task.id);
      if (!error) {
        updateError = null;
        break;
      }
      updateError = error;
      if (!error.message?.includes("status_check")) {
        break;
      }
    }
    if (updateError) {
      setError(updateError.message ?? "Impossible de mettre à jour la tâche.");
      return;
    }
    await syncLearningEvent(task, nextStatus === "done");
    await loadProject();
  };

  const handleDeleteTask = async (task: Task) => {
    if (!canEditTasks) {
      setError("Seuls les professionnels peuvent supprimer des tâches.");
      return;
    }
    if (!task?.id) return;
    const shouldDelete = window.confirm("Supprimer cette tâche ? Cette action est réversible uniquement en la recréant.");
    if (!shouldDelete) return;
    const { error: deleteError } = await supabase.from("project_tasks").delete().eq("id", task.id);
    if (deleteError) {
      setError(deleteError.message ?? "Impossible de supprimer la tâche.");
      return;
    }
    await supabase.from("task_learning_events").delete().eq("task_id", task.id);
    setTaskDetailOpen(false);
    setSelectedTask(null);
    await loadProject();
  };

  const handleUpdateProjectStatus = async (nextStatus: ProjectStatusValue) => {
    if (!canManageProject) {
      setError("Seuls les professionnels peuvent modifier le statut du projet.");
      return;
    }
    if (!projectId) return;
    setStatusUpdating(true);
    setError(null);
    const candidates = PROJECT_STATUS_DB_MAP[nextStatus] ?? [nextStatus];
    let updateError: { message?: string } | null = null;
    for (const statusValue of candidates) {
      const { error } = await supabase
        .from("projects")
        .update({ status: statusValue, updated_at: new Date().toISOString() })
        .eq("id", projectId);
      if (!error) {
        updateError = null;
        break;
      }
      updateError = error;
      if (!error.message?.includes("status_check")) {
        break;
      }
    }
    if (updateError) {
      setError(updateError.message ?? "Impossible de mettre à jour le statut.");
      setStatusUpdating(false);
      return;
    }
    await loadProject();
    setStatusUpdating(false);
    if (nextStatus === "termine" && profile?.user_type === "pro") {
      openPublishModal();
    }
  };

  const openPublishModal = () => {
    const budgetValue = hasBudget ? String(totalBudget) : "";
    const durationValue = projectDurationDays ? String(projectDurationDays) : "";
    setPublishForm({
      title: project?.name ?? "",
      summary: project?.description ?? "",
      budgetTotal: budgetValue,
      durationDays: durationValue,
      city: project?.city ?? "",
      postalCode: "",
      imagePath: "",
    });
    setPublishModalOpen(true);
  };

  const handlePublishProject = async () => {
    if (!canManageProject) {
      setError("Seuls les professionnels peuvent publier un projet.");
      return;
    }
    if (!user?.id) return;
    setPublishSubmitting(true);
    setError(null);
    const budgetValue = publishForm.budgetTotal ? Number(publishForm.budgetTotal) : null;
    const durationValue = publishForm.durationDays ? Number(publishForm.durationDays) : null;
    const payload = {
      pro_id: user.id,
      title: publishForm.title.trim() || project?.name || "Projet terminé",
      summary: normalizeText(publishForm.summary),
      budget_total: Number.isFinite(budgetValue) ? budgetValue : null,
      duration_days: Number.isFinite(durationValue) ? durationValue : null,
      city: normalizeText(publishForm.city),
      postal_code: normalizeText(publishForm.postalCode),
      image_path: normalizeText(publishForm.imagePath),
      is_public: true,
    };

    const { error: insertError } = await supabase.from("pro_portfolio_projects").insert(payload);
    if (insertError) {
      setError(insertError.message);
      setPublishSubmitting(false);
      return;
    }
    setPublishSubmitting(false);
    setPublishModalOpen(false);
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

  const applyAssistantProposal = async () => {
    if (!canUseAssistantPlanning) {
      setAssistantNotice("Seuls les professionnels peuvent valider un planning.");
      return;
    }
    if (!pendingProposal || !projectId || !user?.id) return;
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

  const updateProposalSummary = (value: string) => {
    setPendingProposal((prev) => {
      if (!prev) return prev;
      return { ...prev, summary: value };
    });
  };

  const updateProposalTask = (index: number, patch: Partial<AssistantTask>) => {
    setPendingProposal((prev) => {
      if (!prev) return prev;
      const nextTasks = [...prev.tasks];
      const target = nextTasks[index] ?? { name: "" };
      nextTasks[index] = { ...target, ...patch };
      return { ...prev, tasks: nextTasks };
    });
  };

  const removeProposalTask = (index: number) => {
    setPendingProposal((prev) => {
      if (!prev) return prev;
      const nextTasks = prev.tasks.filter((_, idx) => idx !== index);
      return { ...prev, tasks: nextTasks };
    });
  };

  const addProposalTask = () => {
    setPendingProposal((prev) => {
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

  const sendAssistantMessage = async (
    content: string,
    options?: { forcePlan?: boolean; uiMode?: AssistantUiMode; actionId?: string }
  ) => {
    if (!user?.id || !projectId) return;
    const trimmed = content.trim();
    if (!trimmed || assistantLoading) return;
    setAssistantError(null);
    setAssistantNotice(null);

    if (options?.actionId) {
      setAssistantActiveAction(options.actionId);
    }

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
      if (!apiUrl) {
        throw new Error("AI API non configuree");
      }

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
          phase_id: contextPhaseId ?? null,
          lot_id: contextLotId ?? null,
          context_type: assistantContextType,
          user_id: user.id,
          user_role: userRole,
          message: trimmed,
          history,
          force_plan: options?.forcePlan ?? false,
        }),
      });
      const data = await response.json();
      const rawReply = (data.reply ?? "Je reviens vers vous avec une proposition.") as string;
      const guideBase = `/dashboard/projets/${projectId}?role=${role}&tab=guide`;

      const inferGuideLink = (question: string) => {
        const q = (question || "").trim();
        const lowered = q.toLowerCase();
        const pickTerm = () => {
          const match =
            q.match(/(?:c['’]est quoi|définition de|que signifie|ça veut dire)\s+(.+)/i) ||
            q.match(/(?:terme|mot)\s+(.+)/i);
          const term = (match?.[1] || "").trim().replace(/[?.!,;:]+$/g, "");
          if (term && term.length <= 40) return term;
          const lastToken = q
            .replace(/[^\p{L}\p{N}\s-]/gu, " ")
            .split(/\s+/)
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
          lexique: "📚",
          "delais-types": "⏰",
          "points-attention": "⚠️",
          "mon-devis": "📄",
          "mon-budget": "💰",
        };
        const labelBySection: Record<string, string> = {
          lexique: "Voir le lexique",
          "delais-types": "Délais types",
          "points-attention": "Points d'attention",
          "mon-devis": "Explique mon devis",
          "mon-budget": "Voir mon budget",
        };
        const emoji = emojiBySection[inferred.section] ?? "📚";
        const label = labelBySection[inferred.section] ?? "Ouvrir le Guide";
        return `${text}\n\nPour en savoir plus : [${emoji} ${label}](${href})`;
      };

      const nextReply = options?.uiMode
        ? formatAssistantReply(options.uiMode, rawReply, {
            projectName: project?.name ?? null,
            projectType: project?.project_type ?? null,
            totalBudgetTtc: totalBudget,
            quotes,
          })
        : withGuideLink(rawReply);
      const assistantMessage: AssistantMessage = {
        role: "assistant",
        content: nextReply,
        timestamp: new Date().toISOString(),
        proposal: data.proposal ?? null,
        requires_devis: Boolean(data.requires_devis),
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
    }
  };

  const assistantActionButtons = useMemo(() => {
    if (userRole === "professionnel") {
      const actions: Array<
        AssistantActionButton & {
          prompt: string;
          uiMode?: AssistantUiMode;
          forcePlan?: boolean;
        }
      > = [
        {
          id: "pro_plan",
          icon: "🗓️",
          title: "Planning détaillé",
          description: "Proposition de tâches + dates",
          color: "indigo",
          prompt: "Propose un planning détaillé pour ce projet avec les tâches principales et les délais.",
          forcePlan: true,
        },
        {
          id: "pro_devis_analyze",
          icon: "📄",
          title: "Analyse devis",
          description: "Postes principaux + cohérences",
          color: "blue",
          prompt:
            "Analyse le devis de ce projet. Quels sont les postes principaux ? Y a-t-il des incohérences ou des points à vérifier ?",
          uiMode: "devis",
        },
        {
          id: "pro_devis_validate",
          icon: "✅",
          title: "Conformité",
          description: "TVA, mentions, totaux",
          color: "green",
          prompt:
            "Vérifie la conformité du devis : TVA, mentions obligatoires, cohérence des totaux, et conformité réglementaire.",
        },
        {
          id: "pro_budget",
          icon: "💰",
          title: "Budget",
          description: "Synthèse coûts + paiements",
          color: "purple",
          prompt: "Quel est le budget estimé pour ce projet ? Y a-t-il des coûts supplémentaires à prévoir ?",
          uiMode: "budget",
        },
        {
          id: "pro_risks",
          icon: "⚠️",
          title: "Risques",
          description: "Points d’attention chantier",
          color: "red",
          prompt:
            "Quels sont les risques et points d'attention pour ce projet ? Y a-t-il des éléments à surveiller particulièrement ?",
          uiMode: "risks",
        },
        {
          id: "pro_terms",
          icon: "❓",
          title: "Termes",
          description: "Lexique BTP (devis)",
          color: "orange",
          prompt: "Peux-tu clarifier les termes techniques du devis ? Explique-moi les mots que je ne comprends pas.",
          uiMode: "terms",
        },
        {
          id: "pro_margins",
          icon: "📈",
          title: "Marges",
          description: "Rentabilité par poste",
          color: "purple",
          prompt: "Calcule les marges et la rentabilité de ce projet. Quels sont les postes les plus rentables ?",
        },
        {
          id: "pro_optimize",
          icon: "⚡",
          title: "Optimiser",
          description: "Réduire sans dégrader",
          color: "blue",
          prompt:
            "Optimise les coûts de ce projet. Y a-t-il des postes où on peut réduire les coûts sans impacter la qualité ?",
        },
        {
          id: "pro_improve",
          icon: "✨",
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

    const actions: Array<AssistantActionButton & { prompt: string; uiMode: AssistantUiMode }> = [
      {
        id: "client_devis",
        icon: "📄",
        title: "Explique le devis",
        description: "Comprendre les postes et inclusions",
        color: "blue",
        prompt: "",
        uiMode: "devis",
      },
      {
        id: "client_steps",
        icon: "✓",
        title: "Les étapes",
        description: "Chronologie des travaux",
        color: "green",
        prompt: "",
        uiMode: "steps",
      },
      {
        id: "client_budget",
        icon: "💰",
        title: "Le budget",
        description: "Coûts, paiements, imprévus",
        color: "purple",
        prompt: "",
        uiMode: "budget",
      },
      {
        id: "client_terms",
        icon: "❓",
        title: "Termes techniques",
        description: "Vocabulaire BTP simplifié",
        color: "orange",
        prompt: "",
        uiMode: "terms",
      },
      {
        id: "client_delays",
        icon: "⏰",
        title: "Les délais",
        description: "Durée et jalons",
        color: "indigo",
        prompt: "",
        uiMode: "delays",
      },
      {
        id: "client_risks",
        icon: "⚠",
        title: "Points d'attention",
        description: "Risques et précautions",
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
  }, [assistantLoading, sendAssistantMessage, userRole]);

  const handleDeleteProject = async () => {
    if (!canManageProject || !projectId) return;
    const confirmed =
      typeof window !== "undefined" &&
      window.confirm(
        "Supprimer ce projet ? Cette action est irreversible et supprimera les messages et taches liees."
      );
    if (!confirmed) return;
    setError(null);
    try {
      await deleteProjectCascade(projectId);
      router.push(`/dashboard/projets?role=${role}`);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de supprimer le projet.");
    }
  };

  const handleInvitéByEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canInviteMembers) {
      setError("Seuls les professionnels peuvent inviter des membres.");
      return;
    }
    if (!inviteEmail.trim() || !user?.id || !projectId) return;
    setError(null);
    try {
      await inviteProjectMemberByEmail(user.id, projectId, inviteEmail.trim(), inviteRole);
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'envoyer l'invitation.");
      return;
    }
    setInvitéEmail("");
    await loadProject();
  };

  const openTaskDetails = (task: Task) => {
    setSelectedTask(task);
    setTaskDetailOpen(true);
  };

  const closeTaskDetails = () => {
    setTaskDetailOpen(false);
    setSelectedTask(null);
  };

  const handleAcceptInvité = async () => {
    if (!currentMember?.id) return;
    const { error: updateError } = await supabase
      .from("project_members")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", currentMember.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await loadProject();
  };

  const handleDeclineInvité = async () => {
    if (!currentMember?.id) return;
    const { error: updateError } = await supabase
      .from("project_members")
      .update({ status: "declined" })
      .eq("id", currentMember.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await loadProject();
  };

  const handleAttachQuote = async () => {
    if (!canEditQuotes) {
      setError("Seuls les professionnels peuvent lier un devis.");
      return;
    }
    if (!selectedQuoteId || !user?.id) return;
    setError(null);
    const { data, error: attachError } = await supabase
      .from("devis")
      .update({ project_id: projectId })
      .eq("id", selectedQuoteId)
      .eq("user_id", user.id)
      .select("id");
    if (attachError || !data || data.length === 0) {
      setError(attachError?.message ?? "Impossible de lier le devis.");
      return;
    }
    setSelectedQuoteId("");
    await loadProject();
    await loadAvailableQuotes();
  };

  const handleUpdateQuoteWorkflow = async (quote: QuoteSummary, nextStatus: WorkflowStatus) => {
    if (!canEditQuotes) {
      setError("Seuls les professionnels peuvent modifier un devis.");
      return;
    }
    if (!projectId) return;
    setError(null);
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
      await loadProject();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de mettre à jour le devis.");
    } finally {
      setQuoteStatusUpdatingId(null);
    }
  };

  const handleDeleteQuote = async (quote: QuoteSummary) => {
    if (!canEditQuotes) {
      setError("Seuls les professionnels peuvent supprimer un devis.");
      return;
    }
    if (!user?.id) return;
    const confirmed =
      typeof window !== "undefined" && window.confirm("Etes-vous sur de vouloir supprimer ce devis ?");
    if (!confirmed) return;
    setQuoteDeletingId(quote.id);
    setError(null);
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
      setError(err?.message ?? "Impossible de supprimer le devis.");
    } finally {
      setQuoteDeletingId(null);
    }
  };

  const handleViewQuote = (quote: QuoteSummary) => {
    router.push(`/dashboard/devis/visualiser/${quote.id}?role=${role}`);
  };

  const normalizeStoragePath = (bucket?: string, path?: string) => {
    if (!bucket || !path) return path;
    return path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
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

  const weekDays = useMemo(() => {
    const start = startOfWeek(weekStart);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [weekStart]);

  const completedTasks = useMemo(
    () => tasks.filter((task) => isTaskCompleted(task.status)).length,
    [tasks]
  );

  const totalTasks = tasks.length;
  const progressPercent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const lateTasks = useMemo(() => tasks.filter((task) => isTaskLate(task)), [tasks]);

  const totalBudget = useMemo(
    () => quotes.reduce((sum, quote) => sum + (quote.totalTtc ?? 0), 0),
    [quotes]
  );
  const hasBudget = useMemo(
    () => quotes.some((quote) => typeof quote.totalTtc === "number"),
    [quotes]
  );
  const quoteStatusSummary = useMemo(() => {
    if (!quotes.length) return null;
    const counts: Record<WorkflowStatus, number> = {
      a_faire: 0,
      envoye: 0,
      valide: 0,
      refuse: 0,
    };
    quotes.forEach((quote) => {
      const status = resolveWorkflowStatus(quote);
      counts[status] += 1;
    });
    const entries = Object.entries(counts).filter(([, count]) => count > 0) as Array<
      [WorkflowStatus, number]
    >;
    if (entries.length === 1 && quotes.length === 1) {
      return `Statut : ${getWorkflowLabel(entries[0][0])}`;
    }
    const summaryLabels: Record<WorkflowStatus, { singular: string; plural: string }> = {
      a_faire: { singular: "en étude", plural: "en étude" },
      envoye: { singular: "envoyé", plural: "envoyés" },
      valide: { singular: "validé", plural: "validés" },
      refuse: { singular: "refusé", plural: "refusés" },
    };
    const parts = entries.map(([status, count]) => {
      const labels = summaryLabels[status];
      return `${count} ${count > 1 ? labels.plural : labels.singular}`;
    });
    return `Statuts : ${parts.join(" · ")}`;
  }, [quotes]);

  const projectDurationDays = useMemo(() => {
    const dates = tasks
      .flatMap((task) => [task.start_date, task.end_date])
      .filter(Boolean) as string[];
    if (!dates.length) return null;
    const parsedDates = dates.map(toLocalDate).filter(Boolean) as Date[];
    if (!parsedDates.length) return null;
    const start = new Date(Math.min(...parsedDates.map((date) => date.getTime())));
    const end = new Date(Math.max(...parsedDates.map((date) => date.getTime())));
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  }, [tasks]);

  const upcomingTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks
      .filter((task) => task.start_date && !isTaskCompleted(task.status))
      .map((task) => {
        const parsed = splitTaskDescription(task.description);
        const timeRange = parseTimeRange(parsed.time ?? null);
        const baseDate = new Date(`${task.start_date}T00:00:00`);
        if (timeRange) {
          baseDate.setHours(timeRange.startHour, timeRange.startMinute, 0, 0);
        } else {
          baseDate.setHours(8, 0, 0, 0);
        }
        return {
          id: task.id,
          name: task.name,
          date: baseDate,
          timeLabel: timeRange?.label ?? null,
          description: parsed.text ?? null,
        };
      })
      .filter((item) => item.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 3);
  }, [tasks]);

  const dayKeys = useMemo(() => weekDays.map((day) => toDateKey(day)), [weekDays]);
  const dayKeySet = useMemo(() => new Set(dayKeys), [dayKeys]);
  const timeSlots = useMemo(
    () =>
      Array.from({ length: hourRange.end - hourRange.start + 1 }, (_, index) => hourRange.start + index),
    []
  );
  const todayKey = toDateKey(new Date());
  const projectStatusValue = normalizeProjectStatus(project?.status ?? null);
  const selectedTaskInfo = selectedTask ? splitTaskDescription(selectedTask.description) : { time: null, text: null };

  const taskSlots = useMemo(() => {
    const allDay = new Map<string, Task[]>();
    dayKeys.forEach((dayKey) => {
      allDay.set(dayKey, []);
    });

    tasks.forEach((task) => {
      if (!task.start_date) return;
      const startKey = task.start_date;
      const endKey = task.end_date ?? task.start_date;
      const parsed = splitTaskDescription(task.description);
      const timeRange = parseTimeRange(parsed.time ?? null);
      if (timeRange) return;
      const dayRange = buildDayRange(startKey, endKey);
      dayRange.forEach((dayKey) => {
        if (!dayKeySet.has(dayKey)) return;
        const existing = allDay.get(dayKey) ?? [];
        existing.push(task);
        allDay.set(dayKey, existing);
      });
    });

    return { allDay };
  }, [tasks, dayKeys, dayKeySet]);

  const timedTaskBlocks = useMemo(() => {
    const dayStartMinutes = hourRange.start * 60;
    const dayEndMinutes = (hourRange.end + 1) * 60;
    const byDay = new Map<string, Array<{
      id: string;
      task: Task;
      top: number;
      height: number;
      timeLabel: string | null;
      description: string | null;
      colorClass: string;
    }>>();
    dayKeys.forEach((dayKey) => {
      byDay.set(dayKey, []);
    });

    tasks.forEach((task) => {
      if (!task.start_date) return;
      const parsed = splitTaskDescription(task.description);
      const timeRange = parseTimeRange(parsed.time ?? null);
      if (!timeRange) return;
      const startKey = task.start_date;
      const endKey = task.end_date ?? task.start_date;
      const dayRange = buildDayRange(startKey, endKey);

      dayRange.forEach((dayKey) => {
        if (!dayKeySet.has(dayKey)) return;
        const startMinutes = Math.max(
          timeRange.startHour * 60 + timeRange.startMinute,
          dayStartMinutes
        );
        const endMinutes = Math.min(
          timeRange.endHour * 60 + timeRange.endMinute,
          dayEndMinutes
        );
        if (endMinutes <= startMinutes) return;
        const top = ((startMinutes - dayStartMinutes) / 60) * planningRowHeight;
        const height = ((endMinutes - startMinutes) / 60) * planningRowHeight;
        const colorClass = pickTaskColor(task.name);
        const blocks = byDay.get(dayKey) ?? [];
        blocks.push({
          id: `${task.id}-${dayKey}`,
          task,
          top,
          height: Math.max(32, height),
          timeLabel: timeRange.label ?? null,
          description: parsed.text ?? null,
          colorClass,
        });
        byDay.set(dayKey, blocks);
      });
    });

    byDay.forEach((blocks) => {
      blocks.sort((a, b) => a.top - b.top);
    });

    return byDay;
  }, [tasks, dayKeys, dayKeySet]);

  if (!projectId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Projet introuvable.</p>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <img
              src="/images/projet2.png"
              alt="Projet"
              className="h-28 w-28 object-contain logo-blend"
            />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project?.name ?? "Projet"}</h1>
              <p className="text-gray-600">{project?.description ?? "Aucune description."}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-2 whitespace-nowrap"
            onClick={() => router.push(`/dashboard/projets?role=${role}`)}
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
        </div>
        {currentMember?.status === "pending" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex flex-wrap items-center gap-2">
            Invitation en attente pour ce projet.
            <Button size="sm" onClick={handleAcceptInvité}>
              Accepter
            </Button>
            <Button size="sm" variant="outline" onClick={handleDeclineInvité}>
              Refuser
            </Button>
          </div>
        )}
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </header>

      <nav className="sticky top-3 z-30" aria-label="Navigation du projet">
        <div className="flex flex-wrap gap-1 rounded-2xl border border-neutral-200 bg-white/70 p-1 shadow-[0_18px_55px_-45px_rgba(0,0,0,0.35)] backdrop-blur">
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.key;
            const isGuideOrAssistant = tab.key === "guide" || tab.key === "assistant";

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
                  updateQuery({ tab: tab.key, section: null, q: null, term: null });
                }}
              >
                <img
                  src={tab.iconSrc}
                  alt=""
                  aria-hidden
                  className={`w-4 h-4 object-contain transition ${isActive ? "brightness-0 invert" : "logo-blend group-hover:scale-[1.02]"}`}
                />
                <span className="text-inherit">{tab.label}</span>
                {isActive && isGuideOrAssistant ? (
                  <span
                    aria-hidden
                    className="ml-1 inline-flex h-2 w-2 rounded-full bg-primary-200 shadow-[0_0_0_3px_rgba(24,0,173,0.18)]"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {loading && <div className="text-sm text-gray-500">Chargement...</div>}

      {!loading && activeTab === "overview" && (
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-l-4 border-l-emerald-200 bg-emerald-50/20">
              <CardHeader className="border-b border-emerald-100 bg-emerald-50/60">
                <div className="text-sm text-gray-600">Budget estimé</div>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-gray-900">
                {hasBudget ? formatCurrency(totalBudget) : "-"}
                <div className="text-xs text-gray-500 mt-1">
                  {quotes.length} devis lié{quotes.length > 1 ? "s" : ""}
                </div>
                {quoteStatusSummary && (
                  <div className="text-xs text-gray-500 mt-1">{quoteStatusSummary}</div>
                )}
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-200 bg-blue-50/20">
              <CardHeader className="border-b border-blue-100 bg-blue-50/60">
                <div className="text-sm text-gray-600">Avancement</div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-gray-900">{progressPercent}%</div>
                <div className="text-xs text-gray-500 mt-1">
                  {completedTasks}/{totalTasks} tâches terminées
                </div>
                {lateTasks.length > 0 && (
                  <div className="text-xs font-semibold text-red-600 mt-1">
                    {lateTasks.length} tâche{lateTasks.length > 1 ? "s" : ""} en retard
                  </div>
                )}
                <div className="mt-3 h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-primary-600"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-200 bg-amber-50/20">
              <CardHeader className="border-b border-amber-100 bg-amber-50/60">
                <div className="text-sm text-gray-600">Statut</div>
              </CardHeader>
              <CardContent className="space-y-2">
                <select
                  className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-sm"
                  value={projectStatusValue}
                  disabled={statusUpdating || !canManageProject}
                  onChange={(event) =>
                    handleUpdateProjectStatus(event.target.value as ProjectStatusValue)
                  }
                >
                  {PROJECT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-gray-500">
                  Dernière maj : {project?.updated_at ? formatDate(project.updated_at) : "-"}
                </div>
                {projectStatusValue !== "termine" && canManageProject && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateProjectStatus("termine")}
                    disabled={statusUpdating || !canManageProject}
                  >
                    Cloturer le projet
                  </Button>
                )}
                {projectStatusValue === "termine" && canManageProject && (
                  <Button variant="outline" size="sm" onClick={openPublishModal}>
                    Publier sur le profil
                  </Button>
                )}
                {canManageProject && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600"
                    onClick={handleDeleteProject}
                  >
                    Supprimer le projet
                  </Button>
                )}
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-violet-200 bg-violet-50/20">
              <CardHeader className="border-b border-violet-100 bg-violet-50/60">
                <div className="text-sm text-gray-600">Participants</div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-semibold text-gray-900">{members.length}</div>
                <div className="text-xs text-gray-500">Membres invites et actifs</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-l-4 border-l-primary-200">
              <CardHeader className="border-b border-primary-100 bg-primary-50/40">
                <div className="font-semibold text-gray-900">Prochains rendez-vous</div>
                <div className="text-sm text-gray-500">Tâches à venir.</div>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingTasks.length === 0 && (
                  <div className="text-sm text-gray-500">Aucun rendez-vous planifie.</div>
                )}
                {upcomingTasks.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-500 hidden">
                        {formatDate(item.date)} {item.timeLabel ? `â€¢ ${item.timeLabel}` : ""}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(item.date)} {item.timeLabel ? `à ${item.timeLabel}` : ""}
                      </div>
                      {item.description && (
                        <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab("planning")}>
                      Voir planning
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-slate-200 bg-slate-50/30">
              <CardHeader className="border-b border-slate-100 bg-slate-50/60">
                <div className="font-semibold text-gray-900">Informations</div>
                <div className="text-sm text-gray-500">Résumé du chantier.</div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-700">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">Type</div>
                  <div>{project?.project_type || "Non défini"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">Localisation</div>
                  <div>
                    {project?.address || "-"} {project?.city || ""}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">Description</div>
                  <div>{project?.description || "Aucune description."}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Suivi des tâches</div>
              <div className="text-sm text-gray-500">
                Mettez à jour l'état des tâches pour suivre l'avancement.
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks.length === 0 && (
                <div className="text-sm text-gray-500">Aucune tâche pour le moment.</div>
              )}
              {tasks.map((task) => {
                const statusValue = normalizeTaskStatus(task.status);
                const dueDate = getTaskDueDate(task);
                const delayLabel = getTaskDelayLabel(task);
                return (
                  <div
                    key={task.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 ${getTaskCardStyle(
                      task
                    )}`}
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{task.name}</div>
                      <div className="text-xs text-gray-500">
                        {dueDate ? `Échéance: ${formatDate(dueDate)}` : "Sans date définie"}
                      </div>
                      {delayLabel && (
                        <div className="text-xs font-semibold text-red-600 mt-1">{delayLabel}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        value={statusValue}
                        disabled={!canEditTasks}
                        onChange={(event) =>
                          handleUpdateTaskStatus(task, event.target.value as TaskStatusValue)
                        }
                      >
                        {TASK_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {delayLabel && !isTaskCompleted(task.status) && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Retard
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}

      {!loading && activeTab === "phases" && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Phases ({phases.length})</h2>
              <p className="text-sm text-gray-500">Structure hiérarchique Projet → Phases → Lots.</p>
            </div>
            {canManageProject && (
              <Button size="sm" onClick={() => setPhaseModalOpen(true)}>
                + Ajouter une phase
              </Button>
            )}
          </div>

          {phasesLoading ? (
            <div className="text-sm text-gray-500">Chargement des phases...</div>
          ) : phases.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-gray-600">
                Aucune phase pour le moment. Créez une phase (ex: "Démolition", "Second œuvre", "Finitions") puis ajoutez
                des lots.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {phases.map((phase) => (
                <Card
                  key={phase.id}
                  className="cursor-pointer hover:shadow-sm transition"
                  onClick={() => router.push(`/dashboard/projets/${projectId}/phases/${phase.id}?role=${role}`)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-gray-900">
                        {phase.phaseOrder}. {phase.name}
                      </div>
                      <div className="text-xs text-gray-500">{phase.status}</div>
                    </div>
                    {phase.description && <div className="text-sm text-gray-500">{phase.description}</div>}
                  </CardHeader>
                  <CardContent className="text-sm text-gray-700 space-y-2">
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">Lots</div>
                        <div>{phase.lotsCount}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">Budget</div>
                        <div>
                          {formatCurrency(phase.budgetActual)} / {formatCurrency(phase.budgetEstimated)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-gray-400">Dates</div>
                        <div>
                          {phase.startDate ? formatDate(phase.startDate) : "-"} →{" "}
                          {phase.endDate ? formatDate(phase.endDate) : "-"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && activeTab === "chat" && (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr] items-start">
          <div className="space-y-3">
            {!canInviteMembers && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                Seuls les professionnels peuvent inviter des membres.
              </div>
            )}
            <ChatBox context={{ projectId }} title="Discussion projet" />
          </div>

          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Participants</div>
              <div className="text-sm text-gray-500">Membres du projet</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="text-sm text-gray-700">
                  <div className="font-medium">
                    {member.user?.full_name || member.user?.email || member.invited_email || "Invité"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatMemberRole(member.role)} - {formatMemberStatus(member.status)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {!loading && activeTab === "devis" && (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr] items-start">
          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Devis du projet</div>
              <div className="text-sm text-gray-500">Documents liés au chantier.</div>
            </CardHeader>
            <CardContent className="space-y-3">
              <DocumentsList context={{ projectId }} title="Documents (projet)" showUpload={canManageProject} />
              {quotes.length === 0 && (
                <div className="text-sm text-gray-500">Aucun devis lié au projet.</div>
              )}
              {quotes.map((quote) => {
                const workflowStatus = resolveWorkflowStatus(quote);
                const isUpdating = quoteStatusUpdatingId === quote.id;
                const isDeleting = quoteDeletingId === quote.id;
                const isBusy = isUpdating || isDeleting;
                return (
                <div
                  key={quote.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-4"
                >
                  <div>
                    <div className="font-semibold text-gray-900">{quote.title}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getWorkflowBadge(
                          workflowStatus
                        )}`}
                      >
                        {getWorkflowLabel(workflowStatus)}
                      </span>
                      <span>Mis à jour : {formatDate(quote.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewQuote(quote)}
                      disabled={isBusy || (!quote.fileUrl && !quote.previewData)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                      aria-label="Voir"
                      title="Voir"
                    >
                      <img src="/images/file-pdf.png" alt="" className="w-5 h-5 object-contain" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadQuote(quote)}
                      disabled={isBusy || (!quote.fileUrl && !quote.previewData)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                      aria-label="Télécharger"
                      title="Télécharger"
                    >
                      <img src="/images/download-simple.png" alt="" className="w-5 h-5 object-contain" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuoteWorkflow(quote, "valide")}
                      disabled={isBusy || workflowStatus === "valide" || !canEditQuotes}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-green-200 bg-white transition hover:bg-green-50 disabled:opacity-50"
                      aria-label="Valider"
                      title="Valider"
                    >
                      <img src="/images/check-circle%20(1).png" alt="" className="w-5 h-5 object-contain" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateQuoteWorkflow(quote, "refuse")}
                      disabled={isBusy || workflowStatus === "refuse" || !canEditQuotes}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-white transition hover:bg-red-50 disabled:opacity-50"
                      aria-label="Refuser"
                      title="Refuser"
                    >
                      <img src="/images/x-circle%20(1).png" alt="" className="w-5 h-5 object-contain" />
                    </button>
                    {canEditQuotes && profile?.user_type === "pro" && (
                      <button
                        type="button"
                        onClick={() => handleDeleteQuote(quote)}
                        disabled={isDeleting}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-white transition hover:bg-red-50 disabled:opacity-50"
                        aria-label="Supprimer"
                        title="Supprimer"
                      >
                        <img src="/images/trash.png" alt="" className="w-5 h-5 object-contain" />
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </CardContent>
          </Card>

          {canEditQuotes && (
            <Card>
              <CardHeader>
                <div className="font-semibold text-gray-900">Lier un devis</div>
                <div className="text-sm text-gray-500">Associer un devis existant.</div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Devis disponible</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={selectedQuoteId}
                    onChange={(event) => setSelectedQuoteId(event.target.value)}
                  >
                    <option value="">Sélectionner</option>
                    {availableQuotes.map((quote) => (
                      <option key={quote.id} value={quote.id}>
                        {quote.title}
                      </option>
                    ))}
                  </select>
                </div>
                <Button onClick={handleAttachQuote} disabled={!selectedQuoteId}>
                  Lier au projet
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {!loading && activeTab === "planning" && (
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-gray-900">Planning</div>
                  <div className="text-sm text-gray-500">
                    Semaine du {formatDate(weekDays[0])} au {formatDate(weekDays[6])}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                    Semaine précédente
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
                  <div className="grid grid-cols-[80px_repeat(7,minmax(140px,1fr))] border-b border-gray-200">
                    <div className="sticky left-0 z-30 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                      Heure
                    </div>
                    {weekDays.map((day) => {
                      const dayKey = toDateKey(day);
                      const isToday = dayKey === todayKey;
                      return (
                        <div
                          key={dayKey}
                          className={`border-l border-gray-200 px-3 py-2 text-sm font-semibold ${
                            isToday ? "bg-primary-50 text-primary-900" : "bg-gray-50 text-gray-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{formatDayLabel(day)}</span>
                            {isToday && (
                              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                                Aujourd'hui
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-[80px_repeat(7,minmax(140px,1fr))] border-b border-gray-200">
                    <div className="sticky left-0 z-20 bg-gray-50 px-3 py-3 text-[11px] font-medium text-gray-500">
                      Toute la journée
                    </div>
                    {weekDays.map((day) => {
                      const dayKey = toDateKey(day);
                      const dayTasks = taskSlots.allDay.get(dayKey) ?? [];
                      const isToday = dayKey === todayKey;
                      return (
                        <div
                          key={dayKey}
                          role="button"
                          tabIndex={0}
                          onClick={() => canEditPlanning && openTaskModal(day)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && canEditPlanning) openTaskModal(day);
                          }}
                          className={`min-h-[72px] border-l border-gray-200 px-2 py-2 ${
                            canEditPlanning ? "cursor-pointer" : "cursor-default"
                          } ${isToday ? "bg-primary-50/30" : "bg-white hover:bg-primary-50/20"}`}
                        >
                          {dayTasks.length === 0 ? (
                            <div className="text-[11px] text-gray-400">Aucune action</div>
                          ) : (
                            <div className="space-y-2">
                              {dayTasks.map((task) => {
                                const parsed = splitTaskDescription(task.description);
                                const colorClass = pickTaskColor(task.name);
                                return (
                                  <div
                                    key={task.id}
                                    onClick={(event) => event.stopPropagation()}
                                    className={cn(
                                      "min-w-0 overflow-hidden break-words",
                                      "rounded-md border-l-4 border px-2 py-1 text-[11px] shadow-sm",
                                      colorClass
                                    )}
                                  >
                                    <div className="font-medium text-gray-900">{task.name}</div>
                                    {parsed.time && (
                                      <div className="text-[10px] font-medium text-gray-700">
                                        {parsed.time}
                                      </div>
                                    )}
                                    {parsed.text && (
                                      <div className="text-[10px] text-gray-600 break-words">{parsed.text}</div>
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

                  <div className="grid grid-cols-[80px_repeat(7,minmax(140px,1fr))] border-t border-gray-200">
                    <div className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200">
                      {timeSlots.map((hour) => (
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
                      const dayKey = toDateKey(day);
                      const isToday = dayKey === todayKey;
                      const blocks = timedTaskBlocks.get(dayKey) ?? [];
                      return (
                        <div
                          key={dayKey}
                          role="button"
                          tabIndex={0}
                          onClick={() => canEditPlanning && openTaskModal(day)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && canEditPlanning) openTaskModal(day);
                          }}
                          className={`relative border-l border-gray-200 ${
                            canEditPlanning ? "cursor-pointer" : "cursor-default"
                          } ${isToday ? "bg-primary-50/30" : "bg-white"}`}
                          style={{ height: `${planningRowHeight * timeSlots.length}px` }}
                        >
                          <div className="absolute inset-0">
                            {timeSlots.map((hour) => (
                              <div
                                key={`${dayKey}-${hour}`}
                                className="border-b border-gray-200"
                                style={{ height: `${planningRowHeight}px` }}
                              />
                            ))}
                          </div>
                          <div className="relative z-10">
                            {blocks.map((block) => (
                              <div
                                key={block.id}
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openTaskDetails(block.task);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.stopPropagation();
                                    openTaskDetails(block.task);
                                  }
                                }}
                                className={cn(
                                  "absolute left-2 right-2 rounded-md border-l-4 border px-3 py-2 text-[11px]",
                                  "shadow-sm overflow-hidden break-words",
                                  block.colorClass
                                )}
                                style={{ top: `${block.top}px`, height: `${block.height}px` }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className="min-w-0 font-medium leading-tight"
                                    style={{
                                      display: "-webkit-box",
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {block.task.name}
                                  </span>
                                  {block.timeLabel && (
                                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium">
                                      {block.timeLabel}
                                    </span>
                                  )}
                                </div>
                                {block.description && (
                                  <div
                                    className="text-[10px] text-gray-600 mt-1 break-words"
                                    style={{
                                      display: "-webkit-box",
                                      WebkitLineClamp: 3,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {block.description}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {!loading && activeTab === "membres" && (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr] items-start">
          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Membres du projet</div>
              <div className="text-sm text-gray-500">Clients et collaborateurs.</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="font-semibold text-gray-900">
                    {member.user?.full_name || member.user?.email || member.invited_email || "Invité"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatMemberRole(member.role)} - {formatMemberStatus(member.status)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Inviter un membre</div>
              <div className="text-sm text-gray-500">Ajoute un client ou collaborateur.</div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={inviteRole}
                  disabled={!canInviteMembers}
                  onChange={(event) => setInvitéRole(event.target.value)}
                >
                  <option value="client">Client</option>
                  <option value="collaborator">Collaborateur</option>
                </select>
              </div>

              <form className="space-y-2" onSubmit={handleInvitéByEmail}>
                <label className="text-sm font-medium">Inviter par email</label>
                <Input
                  value={inviteEmail}
                  onChange={(event) => setInvitéEmail(event.target.value)}
                  placeholder="client@email.com"
                  type="email"
                  disabled={!canInviteMembers}
                />
                <Button type="submit" disabled={!canInviteMembers || !inviteEmail.trim()}>
                  Envoyer l'invitation
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      )}
      {!loading && activeTab === "guide" && (
        <section className="space-y-6">
          <ProjectGuidePanel
            section={guideSectionParam}
            query={guideQueryParam}
            term={guideTermParam}
            onOpenGuide={openGuide}
            onOpenAssistant={openAssistantTab}
            totalBudget={totalBudget}
            hasBudget={hasBudget}
            quotes={quotes}
            projectType={project?.project_type ?? null}
          />
        </section>
      )}
      {!loading && activeTab === "assistant" && (
        <section ref={assistantSectionRef} className="grid gap-6">
          <div className="space-y-6">
            <Card className="min-h-[520px] h-[calc(100vh-280px)] flex flex-col">
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
                        <ChatMessageMarkdown content={msg.content} />
                      </div>
                    </div>
                  ))}
                  {assistantLoading && (
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
                  <div ref={assistantMessagesEndRef} />
                </div>
                <div className="flex gap-2 pb-2">
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
                    disabled={assistantLoading || !assistantInput.trim()}
                    className="h-14"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {userRole === "professionnel" && (
            <Card>
              <CardHeader>
                <div className="font-semibold text-gray-900">Proposition de planning</div>
                <div className="text-sm text-gray-500">À valider avant insertion des tâches.</div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!pendingProposal && (
                  <div className="text-sm text-gray-500">
                    Aucune proposition pour le moment. Demandez un planning à l'assistant.
                  </div>
                )}

                {pendingProposal && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-800">Résumé du planning</label>
                      <textarea
                        value={pendingProposal.summary ?? ""}
                        onChange={(event) => updateProposalSummary(event.target.value)}
                        className="w-full min-h-[90px] px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 selection:bg-primary-200 selection:text-neutral-900"
                        placeholder="Résumé rapide du planning proposé."
                      />
                    </div>
                    <div className="space-y-4">
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
                              onChange={(event) => updateProposalTask(index, { start_date: event.target.value })}
                            />
                            <Input
                              label="Fin"
                              type="date"
                              value={task.end_date ?? ""}
                              onChange={(event) => updateProposalTask(index, { end_date: event.target.value })}
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
      )}
      {taskDetailOpen && selectedTask && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-lg w-full p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Détails de la tâche</h3>
                <p className="text-sm text-neutral-600">Consultez ou mettez à jour la tâche.</p>
              </div>
              <Button variant="ghost" onClick={closeTaskDetails}>
                Fermer
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-lg font-semibold text-neutral-900">{selectedTask.name}</div>
                <div className="text-sm text-neutral-600">
                  {selectedTask.start_date ? formatDate(selectedTask.start_date) : "Sans date"}
                  {selectedTask.end_date && selectedTask.end_date !== selectedTask.start_date
                    ? ` -> ${formatDate(selectedTask.end_date)}`
                    : ""}
                  {selectedTaskInfo.time ? ` | ${selectedTaskInfo.time}` : ""}
                </div>
              </div>
              {selectedTaskInfo.text && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {selectedTaskInfo.text}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">Statut</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={normalizeTaskStatus(selectedTask.status)}
                  disabled={!canEditTasks}
                  onChange={(event) => handleUpdateTaskStatus(selectedTask, event.target.value as TaskStatusValue)}
                >
                  {TASK_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className={`flex items-center justify-end gap-2 ${canEditTasks ? "" : "hidden"}`}
              >
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600"
                  onClick={() => handleDeleteTask(selectedTask)}
                >
                  Supprimer la tâche
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {phaseModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-lg w-full p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Nouvelle phase</h3>
                <p className="text-sm text-neutral-600">Ajoutez une phase au projet, puis des lots.</p>
              </div>
              <Button variant="ghost" onClick={() => setPhaseModalOpen(false)}>
                Fermer
              </Button>
            </div>
            <form className="space-y-4" onSubmit={handleCreatePhase}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom *</label>
                <Input
                  value={phaseForm.name}
                  onChange={(event) => setPhaseForm({ ...phaseForm, name: event.target.value })}
                  placeholder="Démolition & Gros œuvre"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={phaseForm.description}
                  onChange={(event) => setPhaseForm({ ...phaseForm, description: event.target.value })}
                  placeholder="Travaux préparatoires, structure…"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ordre *</label>
                  <Input
                    type="number"
                    min={1}
                    value={phaseForm.phaseOrder}
                    onChange={(event) => setPhaseForm({ ...phaseForm, phaseOrder: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Budget estimé (€)</label>
                  <Input
                    type="number"
                    min={0}
                    value={phaseForm.budgetEstimated}
                    onChange={(event) => setPhaseForm({ ...phaseForm, budgetEstimated: event.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Début</label>
                  <Input
                    type="date"
                    value={phaseForm.startDate}
                    onChange={(event) => setPhaseForm({ ...phaseForm, startDate: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fin</label>
                  <Input
                    type="date"
                    value={phaseForm.endDate}
                    onChange={(event) => setPhaseForm({ ...phaseForm, endDate: event.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPhaseModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={phaseSubmitting || !canManageProject}>
                  {phaseSubmitting ? "Création..." : "Créer la phase"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-lg w-full p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Ajouter une tâche</h3>
                {selectedDay && (
                  <p className="text-sm text-neutral-600">Jour: {formatDate(selectedDay)}</p>
                )}
              </div>
              <Button variant="ghost" onClick={() => setIsTaskModalOpen(false)}>
                Fermer
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom *</label>
                <Input
                  value={taskName}
                  onChange={(event) => setTaskName(event.target.value)}
                  placeholder="Demolition / Electricite"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date debut</label>
                  <Input
                    type="date"
                    value={taskDates.start}
                    onChange={(event) => setTaskDates({ ...taskDates, start: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Heure debut</label>
                  <Input
                    type="time"
                    value={taskTime.start}
                    onChange={(event) => setTaskTime({ ...taskTime, start: event.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date fin</label>
                  <Input
                    type="date"
                    value={taskDates.end}
                    onChange={(event) => setTaskDates({ ...taskDates, end: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Heure fin</label>
                  <Input
                    type="time"
                    value={taskTime.end}
                    onChange={(event) => setTaskTime({ ...taskTime, end: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={taskDescription}
                  onChange={(event) => setTaskDescription(event.target.value)}
                  className="w-full min-h-[120px] px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 selection:bg-primary-200 selection:text-neutral-900"
                  placeholder="Précisions sur la tâche"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setIsTaskModalOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleAddTask} disabled={!canEditTasks || !taskName.trim()}>
                  Ajouter
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {publishModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-lg w-full p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Publier ce projet</h3>
                <p className="text-sm text-neutral-600">
                  Ce projet sera visible sur votre profil pro si votre portfolio public est actif.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setPublishModalOpen(false)}>
                Fermer
              </Button>
            </div>
            <div className="space-y-4">
              <Input
                label="Titre"
                value={publishForm.title}
                onChange={(event) => setPublishForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-800">Résumé</label>
                <textarea
                  value={publishForm.summary}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, summary: event.target.value }))}
                  className="w-full min-h-[120px] px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 selection:bg-primary-200 selection:text-neutral-900"
                  placeholder="Décrivez le projet terminé."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Budget total"
                  type="number"
                  inputMode="decimal"
                  value={publishForm.budgetTotal}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, budgetTotal: event.target.value }))}
                />
                <Input
                  label="Duree (jours)"
                  type="number"
                  inputMode="numeric"
                  value={publishForm.durationDays}
                  onChange={(event) =>
                    setPublishForm((prev) => ({ ...prev, durationDays: event.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Ville"
                  value={publishForm.city}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, city: event.target.value }))}
                />
                <Input
                  label="Code postal"
                  value={publishForm.postalCode}
                  onChange={(event) =>
                    setPublishForm((prev) => ({ ...prev, postalCode: event.target.value }))
                  }
                />
              </div>
              <Input
                label="Image (URL ou chemin)"
                value={publishForm.imagePath}
                onChange={(event) => setPublishForm((prev) => ({ ...prev, imagePath: event.target.value }))}
              />
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setPublishModalOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handlePublishProject} disabled={publishSubmitting}>
                  {publishSubmitting ? "Publication..." : "Publier"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}









