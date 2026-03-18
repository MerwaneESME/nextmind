"use client";

import { OverviewTab } from "@/components/project/tabs/OverviewTab";
import { DevisTab } from "@/components/project/tabs/DevisTab";
import { MembersTab } from "@/components/project/tabs/MembersTab";
import { PlanningTab } from "@/components/project/tabs/PlanningTab";
import { AssistantTab } from "@/components/project/tabs/AssistantTab";
import { GuideTab } from "@/components/project/tabs/GuideTab";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import StatCard from "@/components/ui/StatCard";
import { ArrowLeft, Bot, Calendar, CheckCircle2, Clock, Euro, FileText, MapPin, Paperclip, Pencil, Plus, Send, Trash2, TrendingUp, Users, Wrench, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatMemberRole, formatMemberStatus, hasPermission, type CustomRole } from "@/lib/memberHelpers";
import { normalizeProjectStatus } from "@/lib/statusHelpers";
import { mapUserTypeToRole, useAuth } from "@/hooks/useAuth";
import { cn, formatCurrency, formatDate, isValidDateRange, normalizeDateValue } from "@/lib/utils";
import { deleteDevisWithItems, mapDevisRowToSummary } from "@/lib/devisDb";
import { downloadQuotePdf } from "@/lib/quotePdf";
import { deleteProjectCascade, inviteProjectMemberByEmail, updateProjectMetadata, updateMemberRole, removeProjectMember } from "@/lib/projectsDb";
import { fetchLotsForProject, createLotForProject, createLot, deleteLot, getOrCreateDefaultPhase, updateLot, type LotSummary } from "@/lib/lotsDb";
import { getLotLabelColorMap, LOT_LABEL_COLORS, lotLabelColorByKey, removeLotLabelColor, setLotLabelColor, type LotLabelColorKey } from "@/lib/lotLabelColors";
import type { QuoteSummary } from "@/lib/quotesStore";
import { ChatMessageMarkdown } from "@/components/chat/ChatMessageMarkdown";
import ChatBox from "@/components/chat/ChatBox";
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
  metadata?: any;
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
  const match = withoutStart.match(/^\[\[time:([^\]]+)\]\]\s*([\s\S]*)$/);
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
  const [editInfoForm, setEditInfoForm] = useState({ name: "", description: "", project_type: "", address: "", city: "" });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
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

  const membersViewParam = searchParams.get("membersView");
  const initialMembersView =
    membersViewParam === "roles" || membersViewParam === "invite" || membersViewParam === "list"
      ? (membersViewParam as "list" | "roles" | "invite")
      : "list";

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
  const customRoles = project?.metadata?.roles || [];
  const effectiveRole = isOwnerByProject ? "owner" : memberRole;
  const canManageProject = isAcceptedMember && hasPermission(effectiveRole, "admin", customRoles);
  const canManageInterventions = isAcceptedMember && hasPermission(effectiveRole, "interventions", customRoles);
  const canManageMembers = isAcceptedMember && hasPermission(effectiveRole, "members", customRoles);
  const canInviteMembers = canManageMembers;
  const canEditTasks = canManageInterventions;
  const canEditPlanning = canManageInterventions;
  const canEditQuotes = canManageProject;
  const canUseAssistantPlanning = canManageInterventions;

  useEffect(() => {
    if (project && user) {
      console.log("Project permissions check:", {
        projectId: project.id,
        isOwnerByProject,
        canManageProject,
        userId: user.id,
        projectCreatorId: project.created_by,
        memberRole: effectiveRole,
        memberStatus: memberStatus
      });
    }
  }, [project, user, isOwnerByProject, canManageProject]);

  const openCreateInterventionModal = () => {
    if (!canManageInterventions) return;
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
    if (!canManageInterventions) return;
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
    if (!canManageInterventions) return;
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

      // Auto-fix for project creator
      const creatorId = (projectRes.data as Project)?.created_by;
      if (creatorId && user.id === creatorId) {
        const myMember = normalizedMembers.find(m => m.user?.id === user.id);
        if (myMember && myMember.role !== "owner") {
          try {
            await supabase.from("project_members").update({ role: "owner" }).eq("project_id", projectId).eq("user_id", user.id);
            setMembers(prev => prev.map(m => m.user?.id === user.id ? { ...m, role: "owner" } : m));
          } catch (e) {
            console.error("Auto-fix role failed:", e);
          }
        }
      }

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
    if (activeTab !== "interventions" && activeTab !== "overview" && activeTab !== "budget" && activeTab !== "planning") return;
    void loadInterventions();
  }, [activeTab, projectId]);


  

  const handleCreateIntervention = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageInterventions) {
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

  const [editInfoPortalReady, setEditInfoPortalReady] = useState(false);
  useEffect(() => setEditInfoPortalReady(true), []);

  useEffect(() => {
    if (!editInfoModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditInfoModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [editInfoModalOpen]);

  const handleSaveProjectInfo = async () => {
    if (!canManageProject || !projectId) return;
    if (!editInfoForm.name.trim()) return;
    setEditInfoSubmitting(true);
    try {
      const { error: updErr } = await supabase
        .from("projects")
        .update({
          name: editInfoForm.name.trim(),
          description: editInfoForm.description.trim() || null,
          project_type: editInfoForm.project_type.trim() || null,
          address: editInfoForm.address.trim() || null,
          city: editInfoForm.city.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
      if (updErr) throw updErr;
      await loadProject();
      setEditInfoModalOpen(false);
    } catch (err: any) {
      console.error("handleSaveProjectInfo error:", err);
      setError(err.message || "Erreur lors de la mise à jour");
    } finally {
      setEditInfoSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!canManageProject || !projectId) return;
    setDeleteSubmitting(true);
    try {
      await deleteProjectCascade(projectId);
      router.replace(`/dashboard/projets?role=${role}`);
    } catch (err: any) {
      console.error("handleDeleteProject error:", err);
      setError(err.message || "Erreur lors de la suppression du projet");
      setDeleteConfirmOpen(false);
    } finally {
      setDeleteSubmitting(false);
    }
  };


  const handleDeleteProjectOld = async () => {
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
              onClick={openEditInfoModal}
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
          openCreateInterventionModal={openCreateInterventionModal}
          loadProject={loadProject}
          setError={setError}
        />
      )}

      {!loading && activeTab === "interventions" && (
        <InterventionsTab
          interventions={interventions}
          loading={interventionsLoading}
          projectId={projectId}
          canManage={canManageInterventions}
          onEditIntervention={openEditInterventionModal}
          onDeleteIntervention={handleDeleteIntervention}
          onCreateIntervention={openCreateInterventionModal}
          lotLabelColors={lotLabelColors}
        />
      )}

      {!loading && activeTab === "budget" && (
        <ProjectBudgetPanel
          projectId={projectId}
          projectName={project?.name || null}
          interventions={interventions}
          role={role || "client"}
          totalBudgetEstimated={totalBudget}
        />
      )}

      {!loading && activeTab === "chat" && (
        <ChatBox
          context={{ projectId }}
          title={project?.name || "Chat du projet"}
        />
      )}

      {!loading && activeTab === "devis" && (
        <DevisTab
          projectId={projectId}
          user={user as any}
          role={role}
          canManageProject={canManageProject}
          canEditQuotes={canEditQuotes}
          quotes={quotes}
          loadProject={loadProject}
          onError={(msg) => setError(msg)}
          setQuotes={setQuotes}
        />
      )}

      {!loading && activeTab === "planning" && (
        <PlanningTab
          canEditPlanning={canEditPlanning}
          interventions={interventions}
          tasks={tasks}
          lotLabelColors={lotLabelColors}
          openTaskModal={openTaskModal}
          openTaskDetails={openTaskDetails}
        />
      )}

      {!loading && activeTab === "membres" && (
        <MembersTab
          members={members}
          project={project as any}
          initialView={initialMembersView}
          onViewChange={(v) => updateQuery({ membersView: v })}
          canInviteMembers={canInviteMembers}
          currentUserId={user?.id}
          onInvite={async (email, r) => { 
            if (user?.id) await inviteProjectMemberByEmail(user.id, projectId, email, r); 
          }}
          onUpdateMetadata={async (m) => {
            await updateProjectMetadata(projectId, m);
            await loadProject();
          }}
          onUpdateMemberRole={async (uId, r) => {
            await updateMemberRole(projectId, uId, r);
            await loadProject();
          }}
          onRemoveMember={async (uId) => {
            await removeProjectMember(projectId, uId);
            await loadProject();
          }}
        />
      )}

      {!loading && activeTab === "assistant" && (
        <AssistantTab
          projectId={projectId}
          user={user as any}
          userRole={userRole}
          project={project as any}
          totalBudget={totalBudget}
          quotes={quotes}
          canUseAssistantPlanning={canUseAssistantPlanning}
          loadProject={loadProject}
          openGuide={openGuide}
        />
      )}

      {!loading && activeTab === "guide" && (
        <ProjectGuidePanel
          section={guideSectionParam}
          query={guideQueryParam}
          term={guideTermParam}
          onOpenGuide={openGuide}
          onOpenAssistant={openAssistantTab}
          projectType={project?.project_type || undefined}
          totalBudget={totalBudget}
          hasBudget={Boolean(totalBudget)}
          quotes={quotes}
        />
      )}
    </div>

    {/* Modals */}
    {interventionModalOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <h3 className="text-lg font-semibold text-neutral-900">
              {editingInterventionId ? "Modifier l'intervention" : "Nouvelle intervention"}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setInterventionModalOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <form onSubmit={handleCreateIntervention} className="p-6 space-y-4">
            <Input
              label="Nom de l'intervention"
              required
              value={interventionForm.name}
              onChange={(e) => setInterventionForm(prev => ({ ...prev, name: e.target.value }))}
            />
            <Input
              label="Entreprise / Intervenant"
              value={interventionForm.companyName}
              onChange={(e) => setInterventionForm(prev => ({ ...prev, companyName: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Début"
                type="date"
                value={interventionForm.startDate}
                onChange={(e) => setInterventionForm(prev => ({ ...prev, startDate: e.target.value }))}
              />
              <Input
                label="Fin estimée"
                type="date"
                value={interventionForm.endDate}
                onChange={(e) => setInterventionForm(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <Input
              label="Budget estimé (€ h.t.)"
              type="number"
              value={interventionForm.budgetEstimated}
              onChange={(e) => setInterventionForm(prev => ({ ...prev, budgetEstimated: e.target.value }))}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-800">Couleur du badge</label>
              <div className="flex flex-wrap gap-2">
                {LOT_LABEL_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setInterventionForm(p => ({ ...p, labelColor: c.key }))}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition",
                      c.swatchClass,
                      interventionForm.labelColor === c.key ? "border-neutral-900 scale-110 shadow-sm" : "border-transparent hover:scale-105"
                    )}
                  />
                ))}
              </div>
            </div>
            {formError && <p className="text-sm text-red-600 font-medium">{formError}</p>}
            <div className="pt-2 flex justify-end gap-3">
              <Button variant="ghost" type="button" onClick={() => setInterventionModalOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={interventionSubmitting}>
                {interventionSubmitting ? "Enregistrement..." : editingInterventionId ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}

    {taskDetailOpen && selectedTask && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900">{selectedTask.name}</h3>
            <Button variant="ghost" size="sm" onClick={closeTaskDetails}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-neutral-600">
                <Calendar className="h-4 w-4" />
                <span>
                  {selectedTask.start_date ? formatDate(selectedTask.start_date) : "Pas de début"}
                  {selectedTask.end_date && selectedTask.end_date !== selectedTask.start_date && (
                    <> — {formatDate(selectedTask.end_date)}</>
                  )}
                </span>
              </div>
              {selectedTaskInfo.time && (
                <div className="flex items-center gap-3 text-sm text-neutral-600">
                  <Clock className="h-4 w-4" />
                  <span>{selectedTaskInfo.time}</span>
                </div>
              )}
              {selectedTaskInfo.text && (
                <div className="text-sm text-neutral-700 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                  {selectedTaskInfo.text}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">Statut de la tâche</label>
              <div className="grid grid-cols-3 gap-2">
                {TASK_STATUS_OPTIONS.map((opt) => {
                  const isActive = normalizeTaskStatus(selectedTask.status) === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleUpdateTaskStatus(selectedTask, opt.value)}
                      className={cn(
                        "px-3 py-2 text-xs font-medium rounded-lg border transition-all",
                        isActive 
                          ? "bg-primary-50 border-primary-200 text-primary-700 shadow-sm" 
                          : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
              <Button
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => handleDeleteTask(selectedTask)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
              <Button onClick={closeTaskDetails}>Fermer</Button>
            </div>
          </div>
        </div>
      </div>
    )}

    {isTaskModalOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900">Ajouter une tâche</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsTaskModalOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-6 space-y-4">
            <Input
              label="Nom de la tâche"
              required
              autoFocus
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Début"
                type="date"
                value={taskDates.start}
                onChange={(e) => setTaskDates(p => ({ ...p, start: e.target.value }))}
              />
              <Input
                label="Fin"
                type="date"
                value={taskDates.end}
                onChange={(e) => setTaskDates(p => ({ ...p, end: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Heure début"
                type="time"
                value={taskTime.start}
                onChange={(e) => setTaskTime(p => ({ ...p, start: e.target.value }))}
              />
              <Input
                label="Heure fin"
                type="time"
                value={taskTime.end}
                onChange={(e) => setTaskTime(p => ({ ...p, end: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-neutral-800">Notes (optionnel)</label>
              <textarea
                className="w-full px-4 py-2 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 min-h-[80px]"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
              />
            </div>
            {formError && <p className="text-sm text-red-600 font-medium">{formError}</p>}
            <div className="pt-2 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsTaskModalOpen(false)}>Annuler</Button>
              <Button onClick={handleAddTask}>Ajouter</Button>
            </div>
          </div>
        </div>
      </div>
    )}

    {editInfoModalOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <h3 className="text-lg font-semibold text-neutral-900">Modifier les informations</h3>
            <Button variant="ghost" size="sm" onClick={() => setEditInfoModalOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-6 space-y-4">
            <Input
              label="Nom du projet"
              value={editInfoForm.name}
              onChange={(e) => setEditInfoForm(p => ({ ...p, name: e.target.value }))}
            />
            <Input
              label="Type de projet"
              value={editInfoForm.project_type}
              onChange={(e) => setEditInfoForm(p => ({ ...p, project_type: e.target.value }))}
            />
            <Input
              label="Adresse"
              value={editInfoForm.address}
              onChange={(e) => setEditInfoForm(p => ({ ...p, address: e.target.value }))}
            />
            <Input
              label="Ville"
              value={editInfoForm.city}
              onChange={(e) => setEditInfoForm(p => ({ ...p, city: e.target.value }))}
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-neutral-800">Description</label>
              <textarea
                className="w-full px-4 py-2 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 min-h-[100px]"
                value={editInfoForm.description}
                onChange={(e) => setEditInfoForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            {(canManageProject || isOwnerByProject) && (
              <div className="pt-4 border-t border-neutral-100">
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    onClick={() => {
                      console.log("Opening delete confirmation. ProjectID:", projectId);
                      setEditInfoModalOpen(false);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer le projet
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditInfoModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveProjectInfo} disabled={editInfoSubmitting}>
              {editInfoSubmitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>
    )}

    {deleteConfirmOpen && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-red-100 animate-in fade-in zoom-in duration-200">
          <div className="p-8 text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-red-50 rounded-full flex items-center justify-center shadow-inner">
              <Trash2 className="h-10 w-10 text-red-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-neutral-900">Supprimer le projet ?</h3>
              <p className="text-neutral-500 leading-relaxed text-balance">
                Cette action est <span className="text-red-600 font-semibold underline decoration-2">irréversible</span>.
                Toutes les interventions, tâches, documents et messages associés seront définitivement supprimés.
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <Button
                variant="primary"
                className="w-full py-6 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200"
                onClick={handleDeleteProject}
                disabled={deleteSubmitting}
              >
                {deleteSubmitting ? "Suppression en cours..." : "Oui, supprimer définitivement"}
              </Button>
              <Button
                variant="ghost"
                className="w-full py-6 text-neutral-600 hover:bg-neutral-100 rounded-2xl"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Annuler
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}

    {publishModalOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900">Publier dans le portfolio</h3>
            <Button variant="ghost" size="sm" onClick={() => setPublishModalOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
              <div className="h-5 w-5 mt-0.5 text-blue-600 flex-shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">Mettez en valeur votre travail</p>
                <p className="text-sm text-blue-700">Le projet sera visible dans votre catalogue public mais vos budgets exacts restent confidentiels.</p>
              </div>
            </div>
            <Input
              label="Titre public"
              value={publishForm.title}
              onChange={(e) => setPublishForm(p => ({ ...p, title: e.target.value }))}
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-neutral-800">Résumé du projet</label>
              <textarea
                className="w-full px-4 py-2 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 min-h-[100px]"
                value={publishForm.summary}
                onChange={(e) => setPublishForm(p => ({ ...p, summary: e.target.value }))}
                placeholder="Décrivez les points forts du chantier..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Budget total (€)"
                type="number"
                value={publishForm.budgetTotal}
                onChange={(e) => setPublishForm(p => ({ ...p, budgetTotal: e.target.value }))}
              />
              <Input
                label="Durée (jours)"
                type="number"
                value={publishForm.durationDays}
                onChange={(e) => setPublishForm(p => ({ ...p, durationDays: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Ville"
                value={publishForm.city}
                onChange={(e) => setPublishForm(p => ({ ...p, city: e.target.value }))}
              />
              <Input
                label="Code postal"
                value={publishForm.postalCode}
                onChange={(e) => setPublishForm(p => ({ ...p, postalCode: e.target.value }))}
              />
            </div>
            <Input
              label="Image de couverture (URL)"
              value={publishForm.imagePath}
              onChange={(e) => setPublishForm(p => ({ ...p, imagePath: e.target.value }))}
              placeholder="https://images.unsplash.com/..."
            />
            <div className="pt-2 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setPublishModalOpen(false)}>Annuler</Button>
              <Button onClick={handlePublishProject} disabled={publishSubmitting}>
                {publishSubmitting ? "Publication..." : "Publier"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}

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

function InterventionsTab({
  interventions,
  loading,
  projectId,
  canManage,
  onEditIntervention,
  onDeleteIntervention,
  onCreateIntervention,
  lotLabelColors,
}: {
  interventions: LotSummary[];
  loading: boolean;
  projectId: string;
  canManage: boolean;
  onEditIntervention: (intervention: LotSummary) => void;
  onDeleteIntervention: (intervention: LotSummary) => Promise<void>;
  onCreateIntervention: () => void;
  lotLabelColors: Record<string, import("@/lib/lotLabelColors").LotLabelColorKey>;
}) {
  const router = useRouter();
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Suivi des interventions</h2>
          <p className="text-sm text-neutral-500">Gérez les différents corps de métier du chantier.</p>
        </div>
        {canManage && (
          <Button onClick={onCreateIntervention} className="rounded-xl shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle intervention
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="sm:col-span-2 lg:col-span-3 py-12 flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-neutral-300">
            <div className="h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-neutral-500">Chargement des interventions...</p>
          </div>
        ) : interventions.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3 py-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-neutral-300">
            <div className="h-12 w-12 rounded-full bg-neutral-50 flex items-center justify-center mb-4 text-neutral-400">
              <Wrench className="h-6 w-6" />
            </div>
            <p className="text-neutral-600 font-medium">Aucune intervention</p>
            <p className="text-sm text-neutral-500 mb-6">Commencez par ajouter une intervention pour structurer votre projet.</p>
            {canManage && (
              <Button variant="outline" onClick={onCreateIntervention}>
                Ajouter maintenant
              </Button>
            )}
          </div>
        ) : (
          interventions.map((intervention) => {
            const colorKey = lotLabelColors[intervention.id] ?? "slate";
            const colorDef = lotLabelColorByKey[colorKey] ?? lotLabelColorByKey.slate;

            return (
            <div
              key={intervention.id}
              className={`group relative rounded-2xl border border-neutral-200 p-5 hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden border-l-4 ${colorDef.subtleBorderClass} ${colorDef.cardGradientClass}`}
              onClick={() => router.push(`/dashboard/projets/${projectId}/interventions/${intervention.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors truncate">
                    {intervention.name}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5 truncate">
                    {intervention.companyName || "Non assigné"}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditIntervention(intervention); }}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteIntervention(intervention); }}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">Avancement</span>
                  <span className="font-semibold text-neutral-900">{intervention.progressPercentage}%</span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${colorKey === "slate" ? "bg-neutral-100" : "bg-white/60"}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${colorDef.swatchClass}`}
                    style={{ width: `${intervention.progressPercentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between pt-2 text-[11px] text-neutral-500 border-t border-neutral-50">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{intervention.startDate ? formatDate(intervention.startDate) : "—"}</span>
                  </div>
                  <div className="font-medium text-neutral-900">
                    {intervention.tasksDone}/{intervention.tasksTotal} tâches
                  </div>
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>
    </section>
  );
}
