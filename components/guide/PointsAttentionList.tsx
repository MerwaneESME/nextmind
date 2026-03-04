"use client";

import { cn } from "@/lib/utils";
import { pointsAttention } from "@/lib/guideStaticData";

const riskStyles: Record<string, string> = {
  faible: "border-emerald-200 bg-emerald-50 text-emerald-900",
  moyen: "border-orange-200 bg-orange-50 text-orange-900",
  élevé: "border-red-200 bg-red-50 text-red-900",
};

export function PointsAttentionList() {
  return (
    <div className="grid gap-3">
      {pointsAttention.map((item) => (
        <div
          key={item.id}
          className="rounded-[var(--nm-radius,0.75rem)] border border-[color:var(--nm-border,#e5e7eb)] bg-[color:var(--nm-surface,#ffffff)] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[color:var(--nm-ink,#111827)]">{item.title}</div>
              <div className="text-xs text-[color:var(--nm-muted,#4b5563)] mt-1">{item.category}</div>
            </div>
            <span
              className={cn(
                "text-xs font-semibold rounded-full px-2.5 py-1 border uppercase tracking-wide",
                riskStyles[item.riskLevel]
              )}
            >
              {item.riskLevel}
            </span>
          </div>
          <p className="text-sm text-[color:var(--nm-ink,#1f2937)] mt-3">{item.description}</p>
          {(item.howToCheck || item.solution) && (
            <div className="mt-3 grid gap-2">
              {item.howToCheck && (
                <div className="rounded-2xl bg-[color:var(--nm-surface-2,#f9fafb)] border border-[color:var(--nm-border,#e5e7eb)] px-3 py-2 text-sm text-[color:var(--nm-ink,#1f2937)]">
                  <span className="font-semibold">Vérifier :</span> {item.howToCheck}
                </div>
              )}
              {item.solution && (
                <div className="rounded-2xl bg-[color:var(--nm-surface-2,#f9fafb)] border border-[color:var(--nm-border,#e5e7eb)] px-3 py-2 text-sm text-[color:var(--nm-ink,#1f2937)]">
                  <span className="font-semibold">Solution :</span> {item.solution}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
