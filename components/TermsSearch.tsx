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
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">📚 Lexique du devis BTP</p>
            <p className="text-xs text-neutral-600">
              Recherchez un terme ou filtrez par catégorie (ex: &quot;acompte&quot;, &quot;IPN&quot;, &quot;TVA&quot;).
            </p>
          </div>
          <button
            type="button"
            className="text-xs text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
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
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "rounded-full px-3 py-2 text-xs border",
                selectedCategory === "all"
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300"
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
                    "rounded-full px-3 py-2 text-xs border flex items-center gap-1",
                    isActive ? "text-white border-transparent" : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300"
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
        <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
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

