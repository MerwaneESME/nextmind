"use client";

import { cn } from "@/lib/utils";

export type TimelinePhaseData = {
  title: string;
  duration?: string;
  description?: string;
  dates?: string;
  warnings?: string;
};

export function TimelinePhase({
  phase,
  index,
  isLast,
}: {
  phase: TimelinePhaseData;
  index: number;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-4 pb-8 relative">
      {!isLast && <div className="absolute left-6 top-12 w-0.5 h-full bg-indigo-200" aria-hidden />}
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center z-10">
        {index + 1}
      </div>
      <div className="flex-1 bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="font-bold text-neutral-900">{phase.title}</h3>
          {phase.duration && <span className="text-sm text-neutral-500">{phase.duration}</span>}
        </div>
        {phase.description && <p className="text-sm text-neutral-700 mb-3">{phase.description}</p>}
        {phase.dates && (
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span aria-hidden className="text-xs font-medium text-neutral-400">Date:</span>
            <span>{phase.dates}</span>
          </div>
        )}
        {phase.warnings && (
          <div className={cn("mt-3 rounded bg-orange-50 px-3 py-2 text-sm text-orange-800")}>
            <span aria-hidden>⚠ </span>
            {phase.warnings}
          </div>
        )}
      </div>
    </div>
  );
}

