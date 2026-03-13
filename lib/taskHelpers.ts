import { parseTimeRange, toLocalDate } from "./dateHelpers";

// ─── Task Types ───────────────────────────────────────────────────────────────

export type Task = {
  id: string;
  name: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  completed_at?: string | null;
  lot_id?: string;
  task_type?: string | null;
  attendees?: string[] | null;
};

export const TASK_STATUS_OPTIONS = [
  { value: "not_started", label: "À faire" },
  { value: "in_progress", label: "En cours" },
  { value: "done", label: "Terminée" },
] as const;

export type TaskStatusValue = (typeof TASK_STATUS_OPTIONS)[number]["value"];

export const TASK_STATUS_DB_MAP: Record<TaskStatusValue, string[]> = {
  not_started: ["not_started", "todo", "a_faire", "draft"],
  in_progress: ["in_progress", "active", "ongoing", "en_cours", "paused"],
  done: ["done", "completed", "termine", "finished", "validated"],
};

// ─── Task Status Helpers ──────────────────────────────────────────────────────

export const normalizeTaskStatus = (status: string | null): TaskStatusValue => {
  if (!status) return "not_started";
  const normalized = status.toLowerCase();
  if (["done", "completed", "termine", "finished", "validated"].includes(normalized))
    return "done";
  if (["in_progress", "active", "ongoing", "en_cours", "paused"].includes(normalized))
    return "in_progress";
  if (["not_started", "todo", "a_faire", "draft"].includes(normalized))
    return "not_started";
  return "not_started";
};

export const isTaskCompleted = (status: string | null) =>
  normalizeTaskStatus(status) === "done";

// ─── Task Date & Delay Helpers ────────────────────────────────────────────────

export const getTaskDueDate = (task: Task) => {
  const raw = task.end_date ?? task.start_date;
  return raw ? toLocalDate(raw) : null;
};

export const getTaskCompletionDate = (task: Task) => {
  if (!task.completed_at) return null;
  const parsed = new Date(task.completed_at);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getTaskDelayLabel = (task: Task) => {
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

export const isTaskLate = (task: Task) => Boolean(getTaskDelayLabel(task));

export const getTaskCardStyle = (task: Task) => {
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

// ─── Task Description Parsing ─────────────────────────────────────────────────

export function splitTaskDescription(description: string | null) {
  if (!description) return { time: null, text: null };
  const withoutStart = description.replace(
    /\[\[start:\d{4}-\d{2}-\d{2}\]\]\s*/g,
    ""
  );
  const match = withoutStart.match(/^\[\[time:([^\]]+)\]\]\s*(.*)$/);
  if (!match) return { time: null, text: withoutStart || null };
  return { time: match[1], text: match[2] || "" };
}

export const computeDurationHours = (task: Task) => {
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

// ─── Planning Visual Helpers ──────────────────────────────────────────────────

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

export const pickTaskColor = (label: string) => {
  if (!label) return taskPalette[0];
  return taskPalette[hashString(label) % taskPalette.length];
};

export const hourRange = { start: 7, end: 20 };
export const planningRowHeight = 64;

export const formatHourLabel = (hour: number) =>
  `${hour.toString().padStart(2, "0")}:00`;
