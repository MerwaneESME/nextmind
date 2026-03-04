"use client";

import { type TermExplanation } from "@/lib/devisTermsData";
import { cn } from "@/lib/utils";

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return `rgba(0,0,0,${alpha})`;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function TermExplanationCard({
  data,
  className,
}: {
  data: TermExplanation;
  className?: string;
}) {
  const headerBg = hexToRgba(data.categoryColor, 0.08);
  const accent = data.categoryColor;

  return (
    <div
      className={cn(
        "bg-white rounded-lg shadow-sm border border-neutral-200 p-5",
        "border-l-4",
        className
      )}
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            {data.termIcon}
          </span>
          <h3 className="text-base font-semibold text-neutral-900">{data.term}</h3>
        </div>

        <div
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: headerBg, color: accent }}
          title={data.category}
        >
          <span className="mr-1" aria-hidden>
            {data.categoryIcon}
          </span>
          {data.category}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div>
          <p className="text-xs font-semibold text-neutral-700">Ce que c&apos;est</p>
          <p className="text-sm text-neutral-700">{data.definition}</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-neutral-700">Pourquoi c&apos;est important</p>
          <p className="text-sm text-neutral-700">{data.importance}</p>
        </div>

        <div
          className="rounded-md border-l-4 px-4 py-3"
          style={{ borderLeftColor: accent, backgroundColor: headerBg }}
        >
          <p className="text-xs font-semibold" style={{ color: accent }}>
            💡 Exemple concret
          </p>
          <p className="text-sm text-neutral-800">{data.example}</p>
        </div>

        {data.typicalCost && (
          <div className="rounded-md bg-neutral-50 border border-neutral-200 px-4 py-3">
            <p className="text-sm">
              <span className="font-semibold text-neutral-800">Coût typique :</span>{" "}
              <span className="text-neutral-700">{data.typicalCost}</span>
            </p>
          </div>
        )}

        {data.tips && data.tips.length > 0 && (
          <div className="rounded-md bg-success-50 border border-success-100 px-4 py-3">
            <p className="text-xs font-semibold text-success-800">À vérifier / conseils</p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-success-900">
              {data.tips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {data.warnings && data.warnings.length > 0 && (
          <div className="rounded-md bg-warning-50 border border-warning-100 px-4 py-3">
            <p className="text-xs font-semibold text-warning-800">Points d&apos;attention</p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-warning-900">
              {data.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

