// ─── Date Helpers ─────────────────────────────────────────────────────────────

export const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatDayLabel = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "short" })
    .format(date)
    .replace(".", "");

export const buildDayRange = (startKey: string, endKey: string) => {
  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);
  const days: string[] = [];
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    days.push(toDateKey(date));
  }
  return days;
};

export const toLocalDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export type TimeRangeInfo = {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  label: string;
};

export const parseTimeRange = (value: string | null): TimeRangeInfo | null => {
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

export const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
