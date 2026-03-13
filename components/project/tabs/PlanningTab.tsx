import { useState, useMemo, useEffect } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import GanttView from "@/components/project/GanttView";
import { cn, formatDate } from "@/lib/utils";
import {
  startOfWeek,
  addDays,
  toDateKey,
  formatDayLabel,
  buildDayRange,
  parseTimeRange,
} from "@/lib/dateHelpers";
import {
  splitTaskDescription,
  pickTaskColor,
  hourRange,
  planningRowHeight,
  formatHourLabel,
  type Task
} from "@/lib/taskHelpers";
import type { LotSummary } from "@/lib/lotsDb";
import type { LotLabelColorKey } from "@/lib/lotLabelColors";

export interface PlanningTabProps {
  canEditPlanning: boolean;
  interventions: LotSummary[];
  tasks: Task[];
  lotLabelColors: Record<string, LotLabelColorKey>;
  openTaskModal: (date: Date) => void;
  openTaskDetails: (task: Task) => void;
}

export function PlanningTab({
  canEditPlanning,
  interventions,
  tasks,
  lotLabelColors,
  openTaskModal,
  openTaskDetails,
}: PlanningTabProps) {
  const searchParams = useSearchParams();
  const planningDateParam = searchParams.get("planningDate");
  const planningTaskIdParam = searchParams.get("planningTaskId");

  const [planningView, setPlanningView] = useState<"week" | "gantt">("gantt");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  useEffect(() => {
    if (planningDateParam) {
      const d = new Date(`${planningDateParam}T00:00:00`);
      if (!Number.isNaN(d.getTime())) setWeekStart(startOfWeek(d));
    } else {
      setWeekStart(startOfWeek(new Date()));
    }
  }, [planningDateParam]);

  useEffect(() => {
    if (!planningTaskIdParam) return;
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-task-id="${planningTaskIdParam}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary-500", "ring-offset-2");
        window.setTimeout(() => el.classList.remove("ring-2", "ring-primary-500", "ring-offset-2"), 2500);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [planningTaskIdParam, planningView]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(weekStart);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [weekStart]);

  const dayKeys = useMemo(() => weekDays.map((day) => toDateKey(day)), [weekDays]);
  const dayKeySet = useMemo(() => new Set(dayKeys), [dayKeys]);
  
  const timeSlots = useMemo(
    () =>
      Array.from({ length: hourRange.end - hourRange.start + 1 }, (_, index) => hourRange.start + index),
    []
  );
  
  const todayKey = toDateKey(new Date());

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
    const LUNCH_START = 12 * 60; // 720
    const LUNCH_END   = 13 * 60; // 780

    type Block = {
      id: string;
      task: Task;
      top: number;
      height: number;
      timeLabel: string | null;
      description: string | null;
      colorClass: string;
      colIndex: number;
      totalCols: number;
    };
    const byDay = new Map<string, Block[]>();
    dayKeys.forEach((dayKey) => byDay.set(dayKey, []));

    tasks.forEach((task) => {
      if (!task.start_date) return;
      const parsed = splitTaskDescription(task.description);
      const timeRange = parseTimeRange(parsed.time ?? null);
      if (!timeRange) return;
      const startKey = task.start_date;
      const endKey = task.end_date ?? task.start_date;
      const dayRange = buildDayRange(startKey, endKey);
      const rawStart = timeRange.startHour * 60 + timeRange.startMinute;
      const rawEnd   = timeRange.endHour   * 60 + timeRange.endMinute;
      const crossesLunch = rawStart < LUNCH_START && rawEnd > LUNCH_END;

      const addBlock = (
        start: number, end: number,
        label: string, desc: string | null,
        dayKey: string, idSuffix: string
      ) => {
        const s = Math.max(start, dayStartMinutes);
        const e = Math.min(end,   dayEndMinutes);
        if (e <= s) return;
        const top    = ((s - dayStartMinutes) / 60) * planningRowHeight;
        const height = Math.max(22, ((e - s) / 60) * planningRowHeight);
        const blocks = byDay.get(dayKey) ?? [];
        blocks.push({
          id: `${task.id}-${dayKey}${idSuffix}`,
          task, top, height,
          timeLabel: label,
          description: desc,
          colorClass: pickTaskColor(task.name),
          colIndex: 0,
          totalCols: 1,
        });
        byDay.set(dayKey, blocks);
      };

      dayRange.forEach((dayKey) => {
        if (!dayKeySet.has(dayKey)) return;
        if (crossesLunch) {
          addBlock(rawStart, LUNCH_START, `${String(timeRange.startHour).padStart(2,"0")}:00–12:00`, parsed.text ?? null, dayKey, "-am");
          addBlock(LUNCH_END, rawEnd,     `13:00–${String(timeRange.endHour).padStart(2,"0")}:00`,   null,                dayKey, "-pm");
        } else {
          addBlock(rawStart, rawEnd, timeRange.label ?? "", parsed.text ?? null, dayKey, "");
        }
      });
    });

    // Assign columns so overlapping blocks appear side-by-side
    byDay.forEach((blocks) => {
      blocks.sort((a, b) => a.top - b.top);
      const colEnds: number[] = [];
      for (const block of blocks) {
        const blockEnd = block.top + block.height;
        let placed = false;
        for (let c = 0; c < colEnds.length; c++) {
          if (colEnds[c] <= block.top + 1) {
            block.colIndex = c;
            colEnds[c] = blockEnd;
            placed = true;
            break;
          }
        }
        if (!placed) {
          block.colIndex = colEnds.length;
          colEnds.push(blockEnd);
        }
      }
      const totalCols = Math.max(1, colEnds.length);
      blocks.forEach((b) => { b.totalCols = totalCols; });
    });

    return byDay;
  }, [tasks, dayKeys, dayKeySet]);

  return (
    <section className="space-y-6">
      {/* ── View toggle ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex rounded-xl border border-neutral-200 bg-white shadow-sm p-1 gap-1">
          <button
            type="button"
            onClick={() => setPlanningView("gantt")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
              planningView === "gantt"
                ? "bg-gradient-to-r from-primary-400 to-primary-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            Vue Gantt
          </button>
          <button
            type="button"
            onClick={() => setPlanningView("week")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
              planningView === "week"
                ? "bg-gradient-to-r from-primary-400 to-primary-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            Calendrier semaine
          </button>
        </div>
        {planningView === "week" && (
          <div className="flex items-center gap-2">
            {canEditPlanning && (
              <Button
                size="sm"
                className="inline-flex items-center gap-2"
                onClick={() => openTaskModal(new Date())}
              >
                <Plus className="w-4 h-4" />
                Ajouter un événement
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              Semaine précédente
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Semaine suivante
            </Button>
          </div>
        )}
      </div>

      {/* ── Gantt view ── */}
      {planningView === "gantt" && (
        <GanttView
          interventions={interventions}
          tasks={tasks.filter((t) => !!t.lot_id) as import("@/components/project/GanttView").GanttTask[]}
          lotLabelColors={lotLabelColors}
        />
      )}

      {/* ── Week calendar ── */}
      {planningView === "week" && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-gray-900">Planning</div>
                <div className="text-sm text-gray-500">
                  Semaine du {formatDate(weekDays[0])} au {formatDate(weekDays[6])}
                </div>
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
                                  data-task-id={task.id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openTaskDetails(task);
                                  }}
                                  className={cn(
                                    "min-w-0 overflow-hidden break-words transition-shadow",
                                    "rounded-md border-l-4 border px-2 py-1 text-[11px] shadow-sm",
                                    colorClass,
                                    canEditPlanning && "cursor-pointer hover:shadow-md"
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
                          {blocks.map((block) => {
                            const colW = 100 / block.totalCols;
                            const colL = block.colIndex * colW;
                            return (
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
                                  "absolute rounded-md border-l-4 border px-2 py-1 text-[11px]",
                                  "shadow-sm overflow-hidden break-words transition-shadow",
                                  block.colorClass,
                                  canEditPlanning && "cursor-pointer hover:shadow-md"
                                )}
                                style={{
                                  top: `${block.top}px`,
                                  height: `${block.height}px`,
                                  left: `calc(${colL}% + 2px)`,
                                  width: `calc(${colW}% - 4px)`,
                                }}
                                data-task-id={block.task.id}
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
      )}
    </section>
  );
}
