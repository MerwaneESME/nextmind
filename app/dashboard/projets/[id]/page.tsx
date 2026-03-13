"use client";

import { OverviewTab } from "@/components/project/tabs/OverviewTab";
import { DevisTab } from "@/components/project/tabs/DevisTab";
import { MembersTab } from "@/components/project/tabs/MembersTab";
import { PlanningTab } from "@/components/project/tabs/PlanningTab";
import { AssistantTab } from "@/components/project/tabs/AssistantTab";
import { GuideTab } from "@/components/project/tabs/GuideTab";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import StatCard from "@/components/ui/StatCard";
import { ArrowLeft, Bot, Calendar, CheckCircle2, Clock, Euro, FileText, MapPin, Paperclip, Pencil, Plus, Send, Trash2, TrendingUp, Users, Wrench, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatMemberRole, formatMemberStatus } from "@/lib/memberHelpers";
import { mapUserTypeToRole, useAuth } from "@/hooks/useAuth";
import { cn, formatCurrency, formatDate, isValidDateRange, normalizeDateValue } from "@/lib/utils";
import { deleteDevisWithItems, mapDevisRowToSummary } from "@/lib/devisDb";
import { downloadQuotePdf } from "@/lib/quotePdf";
import { deleteProjectCascade, inviteProjectMemberByEmail } from "@/lib/projectsDb";
import { fetchLotsForProject, createLotForProject, createLot, deleteLot, getOrCreateDefaultPhase, updateLot, type LotSummary } from "@/lib/lotsDb";
import { getLotLabelColorMap, LOT_LABEL_COLORS, lotLabelColorByKey, removeLotLabelColor, setLotLabelColor, type LotLabelColorKey } from "@/lib/lotLabelColors";
import type { QuoteSummary } from "@/lib/quotesStore";
import { ChatMessageMarkdown } from "@/components/chat/ChatMessageMarkdown";
import ChatBox from "@/components/chat/ChatBox";
import ProjectDocumentsPanel from "@/components/documents/ProjectDocumentsPanel";
import type { AssistantActionButton } from "@/components/assistant/ActionButton";
import { ActionMenu } from "@/components/assistant/ActionMenu";
import { formatAssistantReply, type AssistantUiMode } from "@/lib/assistantResponses";
import { ProjectGuidePanel } from "@/components/guide/ProjectGuidePanel";
import { PlanningProposalWindow } from "@/components/assistant/PlanningProposalWindow";
import {
  sendPlanningMessageToAI,
  type PlanningProposal,
  type PlanningSuggestedTask,
} from "@/lib/ai-service";
import { detectPlanningIntent } from "@/lib/planning-prompt";
import { buildSmartPlanningFallback } from "@/lib/planning-fallback";
import { createLotTask, deleteAllLotTasks } from "@/lib/lotTasksDb";
import { Badge } from "@/components/ui/Badge";
import ProjectBudgetPanel from "@/components/project/ProjectBudgetPanel";
import GanttView from "@/components/project/GanttView";
import ExportProjectModal from "@/components/project/ExportProjectModal";

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
    avatar_url?: string | null;
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
  lot_id?: string; // set for lot_tasks — used by GanttView
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

/** Extended proposal returned by the enriched planning engine */
type AssistantPlanningProposal = PlanningProposal;

type ProjectQuickAction = {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
};

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  proposal?: AssistantProposal | null;
  planningProposal?: AssistantPlanningProposal | null;
  requires_devis?: boolean;
  suggestions?: string[];
  quickActions?: ProjectQuickAction[];
  attachedFileName?: string | null;
};

type TabKey = "overview" | "interventions" | "budget" | "chat" | "devis" | "planning" | "membres" | "assistant" | "guide";
type WorkflowStatus = "a_faire" | "envoye" | "valide" | "refuse";

const tabItems: Array<{ key: TabKey; label: string; iconSrc: string }> = [
  { key: "overview", label: "Apercu", iconSrc: "/images/grey/eye.png" },
  { key: "interventions", label: "Interventions", iconSrc: "/images/grey/files.png" },
  { key: "budget", label: "Budget", iconSrc: "/images/grey/files.png" },
  { key: "chat", label: "Chat", iconSrc: "/images/grey/chat-teardrop-dots.png" },
  { key: "devis", label: "Documents", iconSrc: "/images/grey/files.png" },
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
  // Strip [[start:YYYY-MM-DD]] metadata (stored for multi-day lot_tasks range recovery)
  const withoutStart = description.replace(/\[\[start:\d{4}-\d{2}-\d{2}\]\]\s*/g, "");
  const match = withoutStart.match(/^\[\[time:([^\]]+)\]\]\s*(.*)$/);
  if (!match) return { time: null, text: withoutStart || null };
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

  const [interventions, setInterventions] = useState<LotSummary[]>([]);
  const [interventionsLoading, setInterventionsLoading] = useState(false);
  const [lotLabelColors, setLotLabelColors] = useState<Record<string, LotLabelColorKey>>({});

  const [interventionModalOpen, setInterventionModalOpen] = useState(false);
  const [interventionSubmitting, setInterventionSubmitting] = useState(false);
  const [editingInterventionId, setEditingInterventionId] = useState<string | null>(null);
  const [interventionForm, setInterventionForm] = useState({
    name: "",
    description: "",
    companyName: "",
    startDate: "",
    endDate: "",
    budgetEstimated: "",
    labelColor: "slate" as LotLabelColorKey,
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
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);






  const [statusUpdating, setStatusUpdating] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishSubmitting, setPublishSubmitting] = useState(false);

  const [editInfoModalOpen, setEditInfoModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [editInfoSubmitting, setEditInfoSubmitting] = useState(false);
  const [editInfoForm, setEditInfoForm] = useState({ name: "", project_type: "", address: "", city: "", description: "" });
  const [publishForm, setPublishForm] = useState({
    title: "",
    summary: "",
    budgetTotal: "",
    durationDays: "",
    city: "",
    postalCode: "",
    imagePath: "",
  });

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

  const { setBreadcrumb } = useBreadcrumb();
  useEffect(() => {
    setBreadcrumb([
      { label: "Projets", href: `/dashboard?role=${role}` },
      { label: project?.name ?? "Projet" },
    ]);
    return () => setBreadcrumb([]);
  }, [project?.name, role]);

  useEffect(() => {
    if (!isTabKey(tabParam)) return;
    if (tabParam === activeTab) return;
    setActiveTab(tabParam);
  }, [tabParam, activeTab]);

  useEffect(() => {
    setLotLabelColors(getLotLabelColorMap(user?.id));
  }, [user?.id]);




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

  const openCreateInterventionModal = () => {
    if (!canManageProject) return;
    setEditingInterventionId(null);
    setInterventionForm({
      name: "",
      description: "",
      companyName: "",
      startDate: "",
      endDate: "",
      budgetEstimated: "",
      labelColor: "slate",
    });
    setFormError(null);
    setInterventionModalOpen(true);
  };

  const openEditInterventionModal = (intervention: LotSummary) => {
    if (!canManageProject) return;
    setEditingInterventionId(intervention.id);
    const storedColor = lotLabelColors[intervention.id] ?? null;
    setInterventionForm({
      name: intervention.name ?? "",
      description: intervention.description ?? "",
      companyName: intervention.companyName ?? "",
      startDate: intervention.startDate ?? "",
      endDate: intervention.endDate ?? "",
      budgetEstimated:
        typeof intervention.budgetEstimated === "number" ? String(intervention.budgetEstimated) : "",
      labelColor: storedColor ?? "slate",
    });
    setFormError(null);
    setInterventionModalOpen(true);
  };

  const handleDeleteIntervention = async (intervention: LotSummary) => {
    if (!canManageProject) return;
    const confirmed =
      typeof window !== "undefined" &&
      window.confirm(
        `Supprimer l'intervention “${intervention.name}” ? Cette action supprimera aussi ses tâches et documents associés.`
      );
    if (!confirmed) return;

    setError(null);
    try {
      await deleteLot(intervention.id);
      removeLotLabelColor(user?.id, intervention.id);
      setLotLabelColors((prev) => {
        const next = { ...prev };
        delete next[intervention.id];
        return next;
      });
      await loadInterventions();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de supprimer l'intervention.");
    }
  };

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
            "id,role,status,invited_email,user:profiles!project_members_user_id_fkey(id,full_name,email,company_name,avatar_url)"
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

      // Fetch intervention (lot) tasks and merge with project tasks
      let allTasks: Task[] = (tasksRes.data as Task[]) ?? [];
      try {
        const phasesRes = await supabase.from("phases").select("id").eq("project_id", projectId);
        if (!phasesRes.error && phasesRes.data && phasesRes.data.length > 0) {
          const phaseIds = phasesRes.data.map((p: any) => p.id);
          const lotsRes = await supabase.from("lots").select("id,name").in("phase_id", phaseIds);
          if (!lotsRes.error && lotsRes.data && lotsRes.data.length > 0) {
            const lotIds = lotsRes.data.map((l: any) => l.id);
            const lotNameMap = new Map<string, string>(lotsRes.data.map((l: any) => [l.id, l.name]));
            const lotTasksRes = await supabase
              .from("lot_tasks")
              .select("id,lot_id,title,description,status,due_date,completed_at")
              .in("lot_id", lotIds)
              .order("due_date", { ascending: true });
            if (!lotTasksRes.error && lotTasksRes.data) {
              const interventionTasks: Task[] = lotTasksRes.data.map((row: any) => {
                const lotName = lotNameMap.get(row.lot_id) ?? "";
                const prefix = lotName ? `[${lotName}] ` : "";
                // Recover start_date stored as [[start:YYYY-MM-DD]] in description
                const startFromDesc = (row.description as string | null)
                  ?.match(/\[\[start:(\d{4}-\d{2}-\d{2})\]\]/)?.[1] ?? null;
                return {
                  id: `lot-${row.id}`,
                  name: `${prefix}${row.title}`,
                  status: row.status ?? "todo",
                  start_date: startFromDesc ?? row.due_date ?? null,
                  end_date: row.due_date ?? null,
                  description: row.description ?? null,
                  completed_at: row.completed_at ?? null,
                  lot_id: row.lot_id as string,
                };
              });
              allTasks = [...allTasks, ...interventionTasks];
            }
          }
        }
      } catch {
        // Silently fail - project tasks still work
      }

      allTasks.sort((a, b) => {
        const aDate = a.start_date ?? "";
        const bDate = b.start_date ?? "";
        return aDate.localeCompare(bDate);
      });

      setTasks(allTasks);
      const mappedQuotes = (devisRes.data ?? []).map((row) => mapDevisRowToSummary(row as any));
      setQuotes(mappedQuotes);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger le projet.");
    } finally {
      setLoading(false);
    }
  };

  

  const loadInterventions = async () => {
    if (!projectId) return;
    setInterventionsLoading(true);
    try {
      const data = await fetchLotsForProject(projectId);
      setInterventions(data);
    } catch {
      setInterventions([]);
    } finally {
      setInterventionsLoading(false);
    }
  };

  useEffect(() => {
    void loadProject();
  }, [projectId, user?.id]);

  useEffect(() => {
    if (activeTab !== "interventions" && activeTab !== "overview" && activeTab !== "budget") return;
    void loadInterventions();
  }, [activeTab, projectId]);


  

  const handleCreateIntervention = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageProject) {
      setError("Acces refuse: vous ne pouvez pas creer une intervention.");
      return;
    }
    if (!projectId || !interventionForm.name.trim()) return;
    if (!isValidDateRange(interventionForm.startDate, interventionForm.endDate)) {
      setFormError("La date de fin doit être supérieure ou égale à la date de début.");
      return;
    }
    setInterventionSubmitting(true);
    setFormError(null);
    setError(null);
    try {
      const patch = {
        name: interventionForm.name,
        description: interventionForm.description || null,
        companyName: interventionForm.companyName || null,
        startDate: interventionForm.startDate || null,
        endDate: interventionForm.endDate || null,
        budgetEstimated: interventionForm.budgetEstimated ? Number(interventionForm.budgetEstimated) : 0,
        status: "planifie" as const,
      };

      if (editingInterventionId) {
        await updateLot(editingInterventionId, patch);
        setLotLabelColor(user?.id, editingInterventionId, interventionForm.labelColor);
        setLotLabelColors((prev) => ({ ...prev, [editingInterventionId]: interventionForm.labelColor }));
      } else {
        const createdId = await createLotForProject(projectId, patch);
        setLotLabelColor(user?.id, createdId, interventionForm.labelColor);
        setLotLabelColors((prev) => ({ ...prev, [createdId]: interventionForm.labelColor }));
      }
      setInterventionForm({
        name: "",
        description: "",
        companyName: "",
        startDate: "",
        endDate: "",
        budgetEstimated: "",
        labelColor: "slate",
      });
      setEditingInterventionId(null);
      setInterventionModalOpen(false);
      await loadInterventions();
    } catch (err: any) {
      setFormError(err?.message ?? "Impossible de creer l'intervention.");
    } finally {
      setInterventionSubmitting(false);
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
    setFormError(null);
    setIsTaskModalOpen(true);
  };

  const handleAddTask = async () => {
    if (!canEditTasks) {
      setError("Seuls les professionnels peuvent modifier le planning.");
      return;
    }
    if (!taskName.trim()) return;
    if (!isValidDateRange(taskDates.start, taskDates.end)) {
      setFormError("La date de fin doit être supérieure ou égale à la date de début.");
      return;
    }
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
      setFormError(insertError.message ?? "Impossible d'ajouter la tâche.");
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

  const openEditInfoModal = () => {
    setEditInfoForm({
      name: project?.name ?? "",
      project_type: project?.project_type ?? "",
      address: project?.address ?? "",
      city: project?.city ?? "",
      description: project?.description ?? "",
    });
    setEditInfoModalOpen(true);
  };

  const handleSaveProjectInfo = async () => {
    if (!canManageProject || !projectId) return;
    setEditInfoSubmitting(true);
    const { data, error: updateError } = await supabase
      .from("projects")
      .update({
        name: editInfoForm.name.trim() || project?.name,
        project_type: editInfoForm.project_type.trim() || null,
        address: editInfoForm.address.trim() || null,
        city: editInfoForm.city.trim() || null,
        description: editInfoForm.description.trim() || null,
      })
      .eq("id", projectId)
      .select()
      .single();
    setEditInfoSubmitting(false);
    if (updateError) { setError(updateError.message); return; }
    if (data) setProject(data as Project);
    setEditInfoModalOpen(false);
  };


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


  

  const completedTasks = useMemo(
    () => tasks.filter((task) => isTaskCompleted(task.status)).length,
    [tasks]
  );

  const totalTasks = tasks.length;
  const progressPercent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const lateTasks = useMemo(() => tasks.filter((task) => isTaskLate(task)), [tasks]);

  const interventionsBudgetTotal = useMemo(
    () => interventions.reduce((sum, i) => sum + (Number(i.budgetEstimated) || 0), 0),
    [interventions]
  );
  const interventionsBudgetActual = useMemo(
    () => interventions.reduce((sum, i) => sum + (Number(i.budgetActual) || 0), 0),
    [interventions]
  );
  const quotesBudgetTotal = useMemo(
    () => quotes.reduce((sum, quote) => sum + (quote.totalTtc ?? 0), 0),
    [quotes]
  );
  const totalBudget = useMemo(
    () => interventionsBudgetTotal + quotesBudgetTotal,
    [interventionsBudgetTotal, quotesBudgetTotal]
  );
  const hasBudget = useMemo(
    () => interventionsBudgetTotal > 0 || quotes.some((quote) => typeof quote.totalTtc === "number"),
    [interventionsBudgetTotal, quotes]
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

  /** Interventions à venir (au niveau lot) */
  
  /** Tâches à venir (niveau projet + interventions) */
  
  /** Combinaison pour les prochains rendez-vous (tâches + interventions) */
  
  
  const projectStatusValue = normalizeProjectStatus(project?.status ?? null);

  
  const selectedTaskInfo = selectedTask ? splitTaskDescription(selectedTask.description) : { time: null, text: null };

  

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
    <>
    <div className="space-y-6">
      <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-neutral-100 shadow-sm px-6 py-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <img
              src="/images/projet2.png"
              alt="Projet"
              className="h-28 w-28 object-contain logo-blend"
            />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project?.name ?? "Projet"}</h1>
              <p className="text-sm text-gray-600">
                Projet {project?.status ? project.status.replace("_", " ") : ""}
                {project?.updated_at && (
                  <> · Mis à jour {formatDate(project.updated_at)}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!project}
              onClick={() => setExportModalOpen(true)}
            >
              <FileText className="h-4 w-4" />
              Exporter
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="bg-gradient-to-r from-primary-400 to-primary-600 shadow-md hover:shadow-lg hover:brightness-105"
              onClick={() => setEditInfoModalOpen(true)}
            >
              Modifier le projet
            </Button>
          </div>
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
      </div>

      <nav className="sticky top-3 z-30" aria-label="Navigation du projet">
        <div className="flex flex-wrap gap-1 rounded-2xl border border-neutral-200 bg-white shadow-sm p-1">
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
                    ? "bg-white text-primary-600 shadow-sm ring-1 ring-primary-200/80"
                    : "text-neutral-600 hover:bg-white/80 hover:text-neutral-900",
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
                  className="w-4 h-4 object-contain transition logo-blend group-hover:scale-[1.02]"
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
        <OverviewTab
          projectId={projectId}
          project={project}
          role={role}
          members={members}
          tasks={tasks}
          interventions={interventions}
          interventionsLoading={interventionsLoading}
          totalTasks={totalTasks}
          completedTasks={completedTasks}
          progressPercent={progressPercent}
          hasBudget={hasBudget}
          totalBudget={totalBudget}
          interventionsBudgetActual={interventionsBudgetActual}
          canManageProject={canManageProject}
          onTabChange={(tab: string) => {
            setActiveTab(tab as TabKey);
            updateQuery({ tab });
          }}
          openEditInfoModal={openEditInfoModal}
          openCreateInterventionModal={openCreateInterventionModal}
          loadProject={loadProject}
          setError={setError}
          PROJECT_STATUS_OPTIONS={PROJECT_STATUS_OPTIONS}
        />
      )}

      {!loading && activeTab === "interventions" && (
        <section className="space-y-6">
          <div className="rounded-2xl bg-white border border-neutral-100 shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Interventions ({interventions.length})</h2>
              <p className="text-sm text-gray-500">Sous-traitants ou équipe interne — chaque intervention génère des tâches sur le chantier.</p>
            </div>
            {canManageProject && (
              <Button size="sm" onClick={openCreateInterventionModal}>
                + Nouvelle intervention
              </Button>
            )}
          </div>

          {interventionsLoading ? (
            <div className="text-sm text-gray-500">Chargement des interventions...</div>
          ) : interventions.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-sm text-gray-600 mb-3">
                  Aucune intervention pour le moment.
                </div>
                {canManageProject && (
                  <Button size="sm" onClick={openCreateInterventionModal}>
                    + Creer une intervention
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
              {interventions.map((intervention) => {
                const lotStatus = intervention.status === "en_cours" ? "en_cours" : intervention.status === "termine" || intervention.status === "valide" ? "termine" : intervention.status === "devis_en_cours" || intervention.status === "devis_valide" ? intervention.status : "planifie";
                const labelColorKey = lotLabelColors[intervention.id] ?? null;
                const labelColor = labelColorKey ? lotLabelColorByKey[labelColorKey] : null;
                return (
                  <Card
                    key={intervention.id}
                    className={cn(
                      "cursor-pointer transition-all duration-200",
                      "border border-neutral-200",
                      "hover:shadow-lg hover:-translate-y-[1px]",
                      "border-l-4",
                      "bg-white"
                    )}
                    style={{
                      borderLeftColor: labelColor?.accentHex ?? "#cbd5e1",
                      backgroundImage: labelColor?.accentHex
                        ? `linear-gradient(135deg, ${labelColor.accentHex}1f 0%, rgba(255,255,255,1) 70%)`
                        : undefined,
                    }}
                    onClick={() => router.push(`/dashboard/projets/${projectId}/interventions/${intervention.id}?role=${role}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-900 truncate">{intervention.name}</div>
                          {intervention.description && (
                            <div className="text-sm text-gray-500 mt-0.5 line-clamp-2">{intervention.description}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge type="lot" status={lotStatus} size="sm" className={cn("shrink-0", labelColor?.badgeClass ?? "")}>
                            {intervention.status === "en_cours" ? "En cours" : intervention.status === "termine" || intervention.status === "valide" ? "Terminé" : intervention.status?.replace(/_/g, " ") ?? "Planifié"}
                          </Badge>
                          {canManageProject && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-primary-700 transition-colors"
                                title="Modifier l'intervention"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditInterventionModal(intervention);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                                title="Supprimer l'intervention"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDeleteIntervention(intervention);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-700 pt-0">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-gray-400">Tâches</div>
                          <div className="font-medium">{intervention.tasksDone}/{intervention.tasksTotal}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-gray-400">Budget</div>
                          <div className="font-medium">{formatCurrency(intervention.budgetEstimated)}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-xs uppercase tracking-wide text-gray-400">Période</div>
                          <div>
                            {(intervention.startDate ?? intervention.tasksStartDate) ? formatDate((intervention.startDate ?? intervention.tasksStartDate) as string) : "-"} → {(intervention.endDate ?? intervention.tasksEndDate) ? formatDate((intervention.endDate ?? intervention.tasksEndDate) as string) : "-"}
                          </div>
                        </div>
                        {intervention.companyName && (
                          <div className="col-span-2">
                            <div className="text-xs uppercase tracking-wide text-gray-400">Entreprise / responsable</div>
                            <div>{intervention.companyName}</div>
                          </div>
                        )}
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Avancement</span>
                          <span className="font-semibold text-gray-700">{intervention.progressPercentage}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${intervention.progressPercentage}%` }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!loading && activeTab === "budget" && (
        <section>
          <ProjectBudgetPanel
            projectId={projectId}
            projectName={project?.name ?? null}
            interventions={interventions}
            role={role}
          />
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
            <CardContent className="space-y-2">
              {members.map((member) => {
                const roleInfo = formatMemberRole(member.role);
                const statusInfo = formatMemberStatus(member.status);
                return (
                  <div key={member.id} className="flex items-center gap-2 text-sm">
                    {member.user?.avatar_url ? (
                      <img
                        src={member.user.avatar_url}
                        alt={`Avatar de ${member.user?.full_name || member.user?.email || "membre"}`}
                        className="h-7 w-7 rounded-full object-cover shrink-0 border border-white/40 shadow-sm"
                      />
                    ) : (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                        {(member.user?.full_name || member.user?.email || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 truncate">
                        {member.user?.full_name || member.user?.email || member.invited_email || "Invité"}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                        <span className={`text-[10px] ${statusInfo.color}`}>{statusInfo.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}

      {!loading && activeTab === "devis" && (
        <DevisTab
          projectId={projectId}
          user={user}
          role={role}
          canManageProject={canManageProject}
          canEditQuotes={canEditQuotes}
          quotes={quotes}
          loadProject={loadProject}
          onError={setError}
          setQuotes={setQuotes}
        />
      )}

      {!loading && activeTab === "membres" && (
        <MembersTab
          members={members}
          canInviteMembers={canInviteMembers}
          onInvite={async (email, role) => {
            if (!user?.id || !projectId) return;
            await inviteProjectMemberByEmail(user.id, projectId, email, role);
            await loadProject();
          }}
        />
      )}
      {!loading && activeTab === "guide" && (
        <GuideTab
          guideSectionParam={guideSectionParam}
          guideQueryParam={guideQueryParam}
          guideTermParam={guideTermParam}
          openGuide={openGuide}
          openAssistantTab={openAssistantTab}
          totalBudget={totalBudget}
          hasBudget={hasBudget}
          quotes={quotes}
          projectType={project?.project_type ?? null}
        />
      )}

      {!loading && activeTab === "assistant" && (
        <AssistantTab
          projectId={projectId}
          user={user}
          userRole={userRole}
          project={project}
          totalBudget={totalBudget}
          quotes={quotes}
          canUseAssistantPlanning={canUseAssistantPlanning}
          loadProject={loadProject}
          contextPhaseId={contextPhaseId}
          contextLotId={contextLotId}
          openGuide={openGuide}
        />
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
      {interventionModalOpen && (
        <div
          className="fixed inset-0 bg-gradient-to-b from-black/15 via-black/35 to-black/35 backdrop-blur-md flex items-center justify-center z-[100] px-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setInterventionModalOpen(false); setFormError(null); } }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 max-w-lg w-full p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">
                    {editingInterventionId ? "Modifier l'intervention" : "Nouvelle intervention"}
                  </h3>
                  <p className="text-sm text-neutral-600">
                    {editingInterventionId ? "Mettez à jour l'intervention du projet." : "Ajoutez une intervention au projet."}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => { setInterventionModalOpen(false); setFormError(null); }}>
                  Fermer
                </Button>
              </div>
            {formError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}
            <form className="space-y-4" onSubmit={handleCreateIntervention}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom *</label>
                <Input
                  value={interventionForm.name}
                  onChange={(event) => setInterventionForm({ ...interventionForm, name: event.target.value })}
                  placeholder="Demolition, Electricite, Plomberie..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={interventionForm.description}
                  onChange={(event) => setInterventionForm({ ...interventionForm, description: event.target.value })}
                  placeholder="Details de l'intervention"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Entreprise</label>
                <Input
                  value={interventionForm.companyName}
                  onChange={(event) => setInterventionForm({ ...interventionForm, companyName: event.target.value })}
                  placeholder="Nom de l'entreprise (optionnel)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Couleur</label>
                <div className="flex flex-wrap gap-2">
                  {LOT_LABEL_COLORS.map((c) => {
                    const selected = interventionForm.labelColor === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setInterventionForm({ ...interventionForm, labelColor: c.key })}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-all",
                          "hover:-translate-y-[1px] hover:shadow-sm",
                          selected ? "border-neutral-900 ring-2 ring-neutral-900/15 bg-neutral-50" : "border-neutral-200 bg-white hover:bg-neutral-50"
                        )}
                        aria-pressed={selected}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: c.accentHex }}
                        />
                        <span className="text-neutral-800">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Budget estime</label>
                  <Input
                    type="number"
                    min={0}
                    value={interventionForm.budgetEstimated}
                    onChange={(event) => setInterventionForm({ ...interventionForm, budgetEstimated: event.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Debut</label>
                  <Input
                    type="date"
                    value={interventionForm.startDate}
                    onChange={(event) => setInterventionForm({ ...interventionForm, startDate: normalizeDateValue(event.target.value) || event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fin</label>
                  <Input
                    type="date"
                    value={interventionForm.endDate}
                    onChange={(event) => setInterventionForm({ ...interventionForm, endDate: normalizeDateValue(event.target.value) || event.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setInterventionModalOpen(false); setFormError(null); }}>
                  Annuler
                </Button>
                <Button type="submit" disabled={interventionSubmitting || !canManageProject}>
                  {interventionSubmitting
                    ? "Enregistrement..."
                    : editingInterventionId
                      ? "Enregistrer"
                      : "Créer l'intervention"}
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
              <Button variant="ghost" onClick={() => { setIsTaskModalOpen(false); setFormError(null); }}>
                Fermer
              </Button>
            </div>
            {formError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}
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
                    onChange={(event) => setTaskDates({ ...taskDates, start: normalizeDateValue(event.target.value) || event.target.value })}
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
                    onChange={(event) => setTaskDates({ ...taskDates, end: normalizeDateValue(event.target.value) || event.target.value })}
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

      {/* ── Edit project info modal ── */}
      {editInfoModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Modifier les informations</h2>
                <p className="text-sm text-neutral-500">Mettez à jour les détails du projet</p>
              </div>
              <button onClick={() => setEditInfoModalOpen(false)} className="h-8 w-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
                <X className="h-4 w-4 text-neutral-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Nom du projet</label>
                <input
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition"
                  value={editInfoForm.name}
                  onChange={(e) => setEditInfoForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex : Rénovation cuisine"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Type de travaux</label>
                <input
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition"
                  value={editInfoForm.project_type}
                  onChange={(e) => setEditInfoForm((f) => ({ ...f, project_type: e.target.value }))}
                  placeholder="Ex : Extension, Rénovation…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Adresse</label>
                  <input
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition"
                    value={editInfoForm.address}
                    onChange={(e) => setEditInfoForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="8 Rue du Parc"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Ville</label>
                  <input
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition"
                    value={editInfoForm.city}
                    onChange={(e) => setEditInfoForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Versailles"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Description</label>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition resize-none"
                  value={editInfoForm.description}
                  onChange={(e) => setEditInfoForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description du chantier…"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditInfoModalOpen(false)}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveProjectInfo}
                disabled={editInfoSubmitting}
                className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {editInfoSubmitting ? "Enregistrement…" : "Enregistrer"}
              </button>
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

    {exportModalOpen && project && (
      <ExportProjectModal
        project={project}
        projectId={projectId}
        userId={user?.id ?? ""}
        userRole={userRole}
        interventions={interventions}
        members={members}
        quotes={quotes}
        tasks={tasks}
        onClose={() => setExportModalOpen(false)}
      />
    )}
    </>
  );
}









