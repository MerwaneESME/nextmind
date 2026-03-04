"use client";

import { useMemo, useState } from "react";
import {
  categoryColors,
  devisTerms,
  getTermById,
  getTermsByCategory,
  searchTerms,
  type TermExplanation,
} from "@/lib/devisTermsData";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { TermExplanationCard } from "@/components/TermExplanationCard";

type CategoryKey = keyof typeof categoryColors;

type DevisTermsUiPayload = {
  query?: string;
  category?: string;
  ids?: string[];
};

const CATEGORY_ORDER: CategoryKey[] = ["diagnostics", "travauxCourants", "couts", "garanties"];

function pickInitialQuery(raw: string | undefined): string {
  const value = (raw || "").trim();
  if (!value) return "";
  if (value.length > 120) return "";

  const lowered = value.toLowerCase();
  const isGeneric =
    lowered.includes("termes") ||
    lowered.includes("mots") ||
    lowered.includes("jargon") ||
    (lowered.includes("devis") && (lowered.includes("expliquer") || lowered.includes("clarifier")));
  return isGeneric ? "" : value;
}

function buildTermsFromIds(ids: string[]): TermExplanation[] {
  const resolved = ids.map((id) => getTermById(id)).filter(Boolean) as TermExplanation[];
  if (resolved.length) return resolved;
  return [];
}

export function TermsSearch({
  initialPayload,
  className,
}: {
  initialPayload?: DevisTermsUiPayload;
  className?: string;
}) {
  const [query, setQuery] = useState(() => pickInitialQuery(initialPayload?.query));
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    const initial = (initialPayload?.category || "").trim();
    return initial ? initial : "all";
  });

  const pinnedTerms = useMemo(() => {
    const ids = initialPayload?.ids?.filter(Boolean) ?? [];
    return ids.length ? buildTermsFromIds(ids) : [];
  }, [initialPayload?.ids]);

  const filtered = useMemo(() => {
    let base: TermExplanation[] = [];

    if (pinnedTerms.length > 0) {
      base = pinnedTerms;
    } else if (selectedCategory !== "all" && !query) {
      base = getTermsByCategory(selectedCategory);
    } else {
      base = searchTerms(query);
    }

    if (selectedCategory !== "all") {
      base = base.filter((term) => term.category === selectedCategory);
    }

    return base;
  }, [pinnedTerms, query, selectedCategory]);

  const categoryStats = useMemo(() => {
    const stats = new Map<string, number>();
    for (const term of devisTerms) {
      stats.set(term.category, (stats.get(term.category) || 0) + 1);
    }
    return stats;
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-[var(--nm-radius,0.75rem)] border border-[color:var(--nm-border,#e5e7eb)] bg-[color:var(--nm-surface,#ffffff)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--nm-ink,#111827)]">📚 Lexique du devis BTP</p>
            <p className="text-xs text-[color:var(--nm-muted,#4b5563)]">
              Recherchez un terme ou filtrez par catégorie (ex: &quot;acompte&quot;, &quot;IPN&quot;, &quot;TVA&quot;).
            </p>
          </div>
          <button
            type="button"
            className="text-xs text-[color:var(--nm-muted,#4b5563)] underline underline-offset-2 hover:text-[color:var(--nm-ink,#111827)]"
            onClick={() => {
              setQuery("");
              setSelectedCategory("all");
            }}
          >
            Réinitialiser
          </button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un terme…"
            aria-label="Rechercher un terme"
            className="bg-[color:var(--nm-surface-2,#ffffff)] border-[color:var(--nm-border,#d1d5db)] text-[color:var(--nm-ink,#111827)] placeholder:text-[color:var(--nm-muted,#6b7280)]"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "rounded-full px-3 py-2 text-xs border transition-colors",
                selectedCategory === "all"
                  ? "bg-[color:var(--nm-ink,#111827)] text-[color:var(--nm-bg,#ffffff)] border-transparent"
                  : "bg-[color:var(--nm-surface-2,#ffffff)] text-[color:var(--nm-ink,#374151)] border-[color:var(--nm-border,#e5e7eb)] hover:border-[color:var(--nm-border,#d1d5db)]"
              )}
            >
              Toutes ({devisTerms.length})
            </button>

            {CATEGORY_ORDER.map((key) => {
              const c = categoryColors[key];
              const count = categoryStats.get(c.name) || 0;
              const isActive = selectedCategory === c.name;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedCategory(c.name)}
                  className={cn(
                    "rounded-full px-3 py-2 text-xs border flex items-center gap-1 transition-colors",
                    isActive
                      ? "text-white border-transparent"
                      : "bg-[color:var(--nm-surface-2,#ffffff)] text-[color:var(--nm-ink,#374151)] border-[color:var(--nm-border,#e5e7eb)] hover:border-[color:var(--nm-border,#d1d5db)]"
                  )}
                  style={isActive ? { backgroundColor: c.color } : undefined}
                  aria-pressed={isActive}
                >
                  <span aria-hidden>{c.icon}</span>
                  <span className="truncate max-w-[180px]">{c.name}</span>
                  <span className={cn("opacity-80", isActive ? "text-white" : "text-neutral-500")}>({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--nm-radius,0.75rem)] border border-[color:var(--nm-border,#e5e7eb)] bg-[color:var(--nm-surface,#ffffff)] p-4 text-sm text-[color:var(--nm-muted,#374151)]">
          Aucun terme trouvé. Essayez un autre mot-clé (ex: &quot;décennale&quot;, &quot;ragréage&quot;).
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((term) => (
            <TermExplanationCard key={term.id} data={term} />
          ))}
        </div>
      )}
    </div>
  );
}

