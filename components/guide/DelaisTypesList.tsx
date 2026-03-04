"use client";

import { delaisTypes } from "@/lib/guideStaticData";

export function DelaisTypesList() {
  return (
    <div className="grid gap-3">
      {delaisTypes.map((item) => (
        <div
          key={item.id}
          className="rounded-[var(--nm-radius,0.75rem)] border border-[color:var(--nm-border,#e5e7eb)] bg-[color:var(--nm-surface,#ffffff)] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[color:var(--nm-ink,#111827)]">{item.title}</div>
              <div className="text-xs text-[color:var(--nm-muted,#4b5563)] mt-1">{item.example}</div>
            </div>
            <div className="text-xs font-semibold text-[color:var(--nm-ink,#374151)] whitespace-nowrap">
              {item.duration}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.factors.map((factor) => (
              <span
                key={factor}
                className="inline-flex items-center rounded-full border border-[color:var(--nm-border,#e5e7eb)] bg-[color:var(--nm-surface-2,#f9fafb)] px-2.5 py-1 text-xs text-[color:var(--nm-muted,#374151)]"
              >
                {factor}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
