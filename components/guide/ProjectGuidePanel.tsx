"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import {
  AlertTriangle,
  BookOpenText,
  Clock3,
  FileText,
  Search,
  Wallet,
} from "lucide-react";
import type { QuoteSummary } from "@/lib/quotesStore";
import { cn, formatCurrency } from "@/lib/utils";
import { TermsSearch } from "@/components/TermsSearch";
import { DelaisTypesList } from "@/components/guide/DelaisTypesList";
import { PointsAttentionList } from "@/components/guide/PointsAttentionList";
import { buildPaymentSchedule } from "@/lib/guideBuilders";

type GuideSection = "lexique" | "delais-types" | "points-attention" | "mon-devis" | "mon-budget";

const displayFont = Fraunces({
  subsets: ["latin"],
  display: "swap",
  // Display font for titles (architectural / editorial vibe)
  variable: "--nm-guide-display",
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  // Body font (fintech clarity)
  variable: "--nm-guide-body",
  weight: ["400", "500", "600"],
});

function normalizeSearch(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

type RiskLevel = "faible" | "moyen" | "élevé";

type AttentionPoint = {
  riskLevel: RiskLevel;
  category: string;
  title: string;
  description: string;
  howToCheck?: string;
  solution?: string;
};

function normalizeProjectType(value: string | null | undefined) {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return null;
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getAttentionPoints(projectType: string | null | undefined): { label: string; points: AttentionPoint[] } | null {
  const normalized = normalizeProjectType(projectType);
  const isCuisine = normalized?.includes("cuisine") ?? false;
  if (!isCuisine) return null;

  return {
    label: "Rénovation cuisine",
    points: [
      {
        riskLevel: "élevé",
        category: "Électricité",
        title: "Circuits dédiés gros électroménager",
        description:
          "Plaque de cuisson, four : circuits dédiés obligatoires (NF C 15-100) + protections adaptées.",
        howToCheck: "Vérifier tableau, calibres (ex: 32A plaque), section des câbles, repérage des circuits.",
        solution: "Prévoir circuits dédiés, différentiels adaptés, et tests avant fermeture des cloisons.",
      },
      {
        riskLevel: "élevé",
        category: "Plomberie",
        title: "Arrivées/évacuations évier & lave-vaisselle",
        description: "Positionnement précis + évacuation correcte (pente, diamètre) pour éviter reflux et fuites.",
        howToCheck: "Contrôler étanchéité, pression, accès aux vannes, pente d’évacuation, siphon.",
        solution: "Test d’étanchéité avant pose du mobilier + accès maintenance (trappes/tiroirs).",
      },
      {
        riskLevel: "moyen",
        category: "Ventilation",
        title: "Extraction hotte & renouvellement d’air",
        description: "Limiter humidité/odeurs : extraction (si possible) > recyclage, conduit étanche.",
        howToCheck: "Vérifier parcours du conduit, clapet, débit, prises d’air, bruit.",
        solution: "Prévoir extraction extérieure si faisable, sinon hotte performante + VMC adaptée.",
      },
      {
        riskLevel: "moyen",
        category: "Supports & finitions",
        title: "Crédence et zones exposées",
        description: "Projections d’eau/chaleur : protéger les supports (évier, cuisson) et soigner les joints.",
        howToCheck: "Contrôler planéité, étanchéité des joints, compatibilité colle/support, zones chaudes.",
        solution: "Crédence continue + joints adaptés (silicone sanitaire), protections avant peinture.",
      },
      {
        riskLevel: "faible",
        category: "Ergonomie",
        title: "Triangle évier-plaque-frigo",
        description: "Optimiser les déplacements et l’ouverture des portes/tiroirs (confort au quotidien).",
        howToCheck: "Tester gabarits, passages, butées, zones de manœuvre, hauteurs.",
        solution: "Valider un plan (2D/3D) avant commande + vérifier les retours d’angles.",
      },
      {
        riskLevel: "faible",
        category: "Éclairage",
        title: "Lumière du plan de travail",
        description: "Éclairage sous-meubles conseillé (4000K) pour confort et précision.",
        howToCheck: "Prévoir alimentations, commandes, zones d’ombre, indice IP proche évier.",
        solution: "Ajouter réglettes LED + interrupteur dédié, câblage anticipé avant pose.",
      },
    ],
  };
}

function getQuoteStatusLabel(status: QuoteSummary["status"]) {
  switch (status) {
    case "valide":
      return "Validé";
    case "refuse":
      return "Refusé";
    case "envoye":
      return "Envoyé";
    case "en_etude":
      return "En étude";
    case "published":
      return "Publié";
    case "draft":
    default:
      return "Brouillon";
  }
}

function GuideCard({
  title,
  description,
  eyebrow,
  icon,
  tone = "steel",
  onClick,
  className,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  icon: ReactNode;
  tone?: "steel" | "concrete" | "wood" | "accent";
  onClick: () => void;
  className?: string;
}) {
  const toneStyles = {
    steel:
      "from-[color:var(--nm-steel-1)]/65 to-[color:var(--nm-steel-2)]/15 ring-[color:var(--nm-border)]",
    concrete:
      "from-[color:var(--nm-concrete-1)]/70 to-[color:var(--nm-concrete-2)]/18 ring-[color:var(--nm-border)]",
    wood:
      "from-[color:var(--nm-wood-1)]/65 to-[color:var(--nm-wood-2)]/18 ring-[color:var(--nm-border)]",
    accent:
      "from-[color:var(--nm-accent)]/16 to-[color:var(--nm-accent)]/6 ring-[color:var(--nm-accent)]/20",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-[var(--nm-radius)] text-left",
        "bg-gradient-to-br ring-1 backdrop-blur-sm",
        "px-5 py-5 sm:px-6 sm:py-6",
        "transition duration-300 ease-out transform-gpu",
        "hover:-translate-y-1 hover:shadow-[var(--nm-shadow)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nm-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nm-bg)]",
        toneStyles[tone],
        className
      )}
      aria-label={title}
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--nm-muted)]">
              {eyebrow}
            </div>
          ) : null}
          <div
            className={cn(
              "mt-2 text-[18px] leading-tight text-[color:var(--nm-ink)]",
              "font-[550] tracking-[-0.01em]",
              "[font-family:var(--nm-guide-display),serif]"
            )}
          >
            {title}
          </div>
          <div className="mt-2 text-sm text-[color:var(--nm-muted)] max-w-[60ch]">
            {description}
          </div>
        </div>

        <div
          className={cn(
            "shrink-0 rounded-2xl ring-1 ring-[color:var(--nm-border)]",
            "bg-black/5 backdrop-blur",
            "p-3",
            "transition duration-300 ease-out",
            "group-hover:bg-black/8 group-hover:-rotate-1 group-hover:scale-[1.02]"
          )}
          aria-hidden
        >
          {icon}
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between gap-3">
        <div className="text-xs text-[color:var(--nm-muted)]">
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-[color:var(--nm-accent)]/70"
            />
            Ouvrir le guide
          </span>
        </div>
        <div
          className={cn(
            "text-xs font-medium text-[color:var(--nm-ink)]",
            "opacity-0 translate-y-1 transition duration-300 ease-out",
            "group-hover:opacity-100 group-hover:translate-y-0"
          )}
          aria-hidden
        >
          Entrée rapide →
        </div>
      </div>
    </button>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--nm-radius)] ring-1 ring-[color:var(--nm-border)]",
        "bg-[color:var(--nm-surface)]",
        className
      )}
      aria-hidden
    >
      <div className="p-6 space-y-3">
        <div className="h-3 w-24 rounded bg-black/10" />
        <div className="h-6 w-3/5 rounded bg-black/10" />
        <div className="h-4 w-4/5 rounded bg-black/10" />
        <div className="h-4 w-2/3 rounded bg-black/10" />
      </div>
    </div>
  );
}

export function ProjectGuidePanel({
  section,
  query,
  term,
  onOpenGuide,
  onOpenAssistant,
  totalBudget,
  hasBudget,
  quotes,
  projectType,
}: {
  section: string | null;
  query: string | null;
  term: string | null;
  onOpenGuide: (section?: GuideSection, patch?: Record<string, string | null | undefined>) => void;
  onOpenAssistant: () => void;
  totalBudget: number;
  hasBudget: boolean;
  quotes: QuoteSummary[];
  projectType?: string | null;
}) {
  const normalizedSection = (section || "") as GuideSection | "";
  const isKnownSection =
    normalizedSection === "" ||
    normalizedSection === "lexique" ||
    normalizedSection === "delais-types" ||
    normalizedSection === "points-attention" ||
    normalizedSection === "mon-devis" ||
    normalizedSection === "mon-budget";

  const activeSection = (isKnownSection ? normalizedSection : "") as GuideSection | "";
  const showBack = Boolean(section || query || term);

  const suggestions = useMemo(
    () => ["acompte", "IPN", "TVA", "DTU", "décennale", "ragréage", "GTL", "RGE"] as const,
    []
  );

  const [search, setSearch] = useState(() => term ?? query ?? "");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const quoteStats = useMemo(() => {
    const valid = quotes.filter((q) => q.status === "valide" && typeof q.totalTtc === "number");
    const validTotal = valid.reduce((sum, q) => sum + (q.totalTtc ?? 0), 0);
    const counts = quotes.reduce(
      (acc, q) => {
        acc.total += 1;
        acc.byStatus[q.status] = (acc.byStatus[q.status] || 0) + 1;
        return acc;
      },
      { total: 0, byStatus: {} as Record<QuoteSummary["status"], number> }
    );
    return {
      validTotalTtc: validTotal,
      validCount: valid.length,
      counts,
    };
  }, [quotes]);

  const attentionContext = useMemo(() => getAttentionPoints(projectType), [projectType]);

  useEffect(() => {
    setSearch(term ?? query ?? "");
  }, [term, query]);

  useEffect(() => {
    setIsTransitioning(true);
    const id = window.setTimeout(() => setIsTransitioning(false), 160);
    return () => window.clearTimeout(id);
  }, [activeSection]);

  const guideTokens = {
    // Surfaces / Ink
    ["--nm-bg" as any]: "#F7F8FA",
    ["--nm-surface" as any]: "rgba(255,255,255,0.72)",
    ["--nm-surface-2" as any]: "rgba(255,255,255,0.92)",
    ["--nm-ink" as any]: "#111827",
    ["--nm-muted" as any]: "#4B5563",
    ["--nm-border" as any]: "rgba(17,24,39,0.12)",
    // Materials
    ["--nm-concrete-1" as any]: "#E5E7EB",
    ["--nm-concrete-2" as any]: "#CBD5E1",
    ["--nm-steel-1" as any]: "#DBEAFE",
    ["--nm-steel-2" as any]: "#BFDBFE",
    ["--nm-wood-1" as any]: "#FEF3C7",
    ["--nm-wood-2" as any]: "#FDE68A",
    // Accent aligned with existing brand primary
    ["--nm-accent" as any]: "#1800ad",
    ["--nm-radius" as any]: "20px",
    ["--nm-shadow" as any]: "0 18px 55px -22px rgba(17,24,39,0.20)",
  } as CSSProperties;

  function runSearch(next?: string) {
    const value = normalizeSearch(next ?? search);
    onOpenGuide("lexique", { q: value });
  }

  return (
    <div
      className={cn(
        displayFont.variable,
        bodyFont.variable,
        "relative overflow-hidden rounded-3xl",
        "ring-1 ring-black/5 shadow-[0_30px_80px_-55px_rgba(0,0,0,0.6)]"
      )}
      style={guideTokens}
    >
      {/* Background (architectural grid + subtle spotlight) */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(900px 420px at 16% 8%, rgba(24,0,173,0.10), transparent 60%), radial-gradient(820px 420px at 85% 22%, rgba(56,182,255,0.10), transparent 65%), linear-gradient(180deg, rgba(247,248,250,1), rgba(245,246,248,1))",
        }}
      />

      <div
        className={cn(
          "relative p-4 sm:p-6 lg:p-8",
          "text-[color:var(--nm-ink)]",
          "[font-family:var(--nm-guide-body),sans-serif]"
        )}
      >
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "inline-flex items-center justify-center",
                  "h-10 w-10 rounded-2xl",
                  "bg-[color:var(--nm-surface)] ring-1 ring-[color:var(--nm-border)] backdrop-blur",
                  "shadow-[0_10px_25px_-18px_rgba(0,0,0,0.6)]"
                )}
                aria-hidden
              >
                <BookOpenText className="h-5 w-5 text-[color:var(--nm-ink)]" />
              </div>
              <div>
                <h2
                  className={cn(
                    "text-[28px] sm:text-[34px] leading-[1.05]",
                    "tracking-[-0.02em]",
                    "[font-family:var(--nm-guide-display),serif]"
                  )}
                >
                  Guide du projet
                </h2>
                <p className="mt-1 text-sm text-[color:var(--nm-muted)]">
                  Repères clairs, vocabulaire pro et outils pratiques pour piloter une rénovation.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showBack ? (
              <button
                type="button"
                onClick={() => onOpenGuide()}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm",
                  "bg-[color:var(--nm-surface)] ring-1 ring-[color:var(--nm-border)] backdrop-blur",
                  "hover:bg-[color:var(--nm-surface-2)] transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nm-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nm-bg)]"
                )}
              >
                <span aria-hidden>←</span>
                Retour
              </button>
            ) : null}
          </div>
        </div>

        {/* Search */}
        <div className="mt-5 sm:mt-6">
          <div
            className={cn(
              "rounded-[var(--nm-radius)]",
              "bg-[color:var(--nm-surface)] ring-1 ring-[color:var(--nm-border)] backdrop-blur",
              "p-3 sm:p-4"
            )}
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--nm-muted)]"
                  aria-hidden
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runSearch();
                  }}
                  list="nm-guide-suggestions"
                  placeholder="Rechercher un terme (acompte, IPN, TVA…) — Entrée pour lancer"
                  className={cn(
                    "w-full rounded-2xl pl-10 pr-3 py-2.5 text-sm",
                    "bg-[color:var(--nm-surface-2)] text-[color:var(--nm-ink)] placeholder:text-[color:var(--nm-muted)]",
                    "ring-1 ring-[color:var(--nm-border)]",
                    "transition duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-[color:var(--nm-accent)]"
                  )}
                  aria-label="Rechercher dans le lexique"
                />
                <datalist id="nm-guide-suggestions">
                  {suggestions.map((s) => (
                    <option value={s} key={s} />
                  ))}
                </datalist>
              </div>

              <button
                type="button"
                onClick={() => runSearch()}
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm font-medium",
                  "bg-[color:var(--nm-accent)] text-white",
                  "shadow-[0_18px_40px_-26px_rgba(24,0,173,0.30)]",
                  "hover:brightness-[1.04] transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nm-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nm-bg)]"
                )}
              >
                Rechercher
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="text-xs text-[color:var(--nm-muted)] mr-1">Suggestions :</div>
              {suggestions.slice(0, 6).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSearch(s);
                    runSearch(s);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs",
                    "bg-[color:var(--nm-surface-2)] ring-1 ring-[color:var(--nm-border)]",
                    "hover:bg-white transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nm-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nm-bg)]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          key={activeSection || "home"}
          className={cn(
            "mt-6 sm:mt-7",
            "motion-safe:animate-[nm-fade-up_420ms_cubic-bezier(0.22,1,0.36,1)_both]"
          )}
          aria-busy={isTransitioning ? "true" : "false"}
        >
          {isTransitioning ? (
            <div className="grid gap-4 md:grid-cols-12">
              <SkeletonBlock className="md:col-span-7" />
              <div className="grid gap-4 md:col-span-5">
                <SkeletonBlock />
                <SkeletonBlock />
              </div>
            </div>
          ) : (
            <>
              {!activeSection && (
                <div className="grid gap-6">
                  {/* Ressources générales (asymmetric layout) */}
                  <div className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--nm-muted)]">
                          Ressources générales
                        </div>
                        <div className="mt-1 text-sm text-[color:var(--nm-muted)]">
                          Comprendre, anticiper, décider — sans jargon inutile.
                        </div>
                      </div>
                      <div className="hidden sm:block text-xs text-[color:var(--nm-muted)]">
                        Astuce : survolez pour voir les détails.
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-12">
                      <GuideCard
                        className="md:col-span-7"
                        eyebrow="Lexique BTP"
                        title="Décoder un devis, poste par poste"
                        description="Les termes et abréviations les plus fréquents, expliqués clairement (TVA, DTU, IPN, décennale…)."
                        tone="steel"
                        icon={<BookOpenText className="h-6 w-6 text-[color:var(--nm-ink)]" />}
                        onClick={() => onOpenGuide("lexique")}
                      />

                      <div className="grid gap-4 md:col-span-5">
                        <GuideCard
                          eyebrow="Délais & étapes"
                          title="Durées types de rénovation"
                          description="Ordres de grandeur réalistes : préparation, chantier, finitions, réception."
                          tone="concrete"
                          icon={<Clock3 className="h-6 w-6 text-[color:var(--nm-ink)]" />}
                          onClick={() => onOpenGuide("delais-types")}
                        />
                        <GuideCard
                          eyebrow="Qualité & risques"
                          title="Points d’attention"
                          description="Ce qu’un pro vérifie : protections, supports, ventilation, tolérances, garanties."
                          tone="concrete"
                          icon={<AlertTriangle className="h-6 w-6 text-[color:var(--nm-ink)]" />}
                          onClick={() => onOpenGuide("points-attention")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mon projet */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--nm-muted)]">
                          Mon projet
                        </div>
                        <div className="mt-1 text-sm text-[color:var(--nm-muted)]">
                          Axé sur vos documents et votre budget.
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <GuideCard
                        tone="wood"
                        eyebrow="Analyse"
                        title="Explique mon devis"
                        description="Synthèse des devis liés et repères de lecture. Pour une analyse détaillée : onglet Assistant IA."
                        icon={<FileText className="h-6 w-6 text-[color:var(--nm-ink)]" />}
                        onClick={() => onOpenGuide("mon-devis")}
                      />
                      <GuideCard
                        tone="accent"
                        eyebrow="Budget"
                        title="Mon budget & paiements"
                        description="Total TTC, répartition, et un échéancier indicatif pour cadrer les acomptes."
                        icon={<Wallet className="h-6 w-6 text-[color:var(--nm-ink)]" />}
                        onClick={() => onOpenGuide("mon-budget")}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "lexique" && (
                <TermsSearch
                  className="max-w-4xl"
                  initialPayload={{ query: term ?? query ?? "" }}
                />
              )}

              {activeSection === "delais-types" && <DelaisTypesList />}
              {activeSection === "points-attention" && (
                <div className="grid gap-4">
                  {attentionContext ? (
                    <>
                      <div
                        className={cn(
                          "rounded-[var(--nm-radius)] bg-[color:var(--nm-surface)] ring-1 ring-[color:var(--nm-border)] backdrop-blur",
                          "p-4 sm:p-6"
                        )}
                      >
                        <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--nm-muted)]">
                          Points d’attention
                        </div>
                        <div className="mt-1 text-sm text-[color:var(--nm-muted)]">
                          Ce qu’un pro vérifie : protections, supports, ventilation, tolérances, garanties.
                        </div>
                        <div className="mt-2 text-xs text-[color:var(--nm-muted)]">
                          Contexte : <span className="font-medium text-[color:var(--nm-ink)]">{attentionContext.label}</span>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        {attentionContext.points.map((item) => {
                          const tone =
                            item.riskLevel === "élevé"
                              ? "border-red-200 bg-red-50 text-red-900"
                              : item.riskLevel === "moyen"
                                ? "border-orange-200 bg-orange-50 text-orange-900"
                                : "border-emerald-200 bg-emerald-50 text-emerald-900";
                          return (
                            <div
                              key={`${item.category}-${item.title}`}
                              className="rounded-[var(--nm-radius)] border border-[color:var(--nm-border)] bg-[color:var(--nm-surface)] p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-[color:var(--nm-ink)]">
                                    {item.title}
                                  </div>
                                  <div className="text-xs text-[color:var(--nm-muted)] mt-1">
                                    {item.category}
                                  </div>
                                </div>
                                <span className={cn("text-[10px] font-semibold rounded-full px-2.5 py-1 border uppercase tracking-wide", tone)}>
                                  {item.riskLevel}
                                </span>
                              </div>

                              <p className="text-sm text-[color:var(--nm-ink)] mt-3">{item.description}</p>

                              {(item.howToCheck || item.solution) && (
                                <div className="mt-3 grid gap-2">
                                  {item.howToCheck ? (
                                    <div className="rounded-2xl bg-[color:var(--nm-surface-2)] border border-[color:var(--nm-border)] px-3 py-2 text-sm text-[color:var(--nm-ink)]">
                                      <span className="font-semibold">Vérifier :</span> {item.howToCheck}
                                    </div>
                                  ) : null}
                                  {item.solution ? (
                                    <div className="rounded-2xl bg-[color:var(--nm-surface-2)] border border-[color:var(--nm-border)] px-3 py-2 text-sm text-[color:var(--nm-ink)]">
                                      <span className="font-semibold">Solution :</span> {item.solution}
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <PointsAttentionList />
                  )}
                </div>
              )}

              {activeSection === "mon-budget" && (
                <div className="grid gap-4">
                  <div
                    className={cn(
                      "rounded-[var(--nm-radius)] bg-[color:var(--nm-surface)] ring-1 ring-[color:var(--nm-border)] backdrop-blur",
                      "p-4 sm:p-6"
                    )}
                  >
                    <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--nm-muted)]">
                      Mon budget
                    </div>
                    <div className="mt-1 text-sm text-[color:var(--nm-muted)]">
                      Une vue claire pour cadrer la suite du chantier.
                    </div>

                    <div className="mt-4">
                      {quoteStats.validTotalTtc > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="rounded-2xl bg-[color:var(--nm-surface-2)] ring-1 ring-[color:var(--nm-border)] p-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--nm-muted)]">
                              Total TTC
                            </div>
                            <div className="mt-1 text-2xl font-semibold text-[color:var(--nm-ink)]">
                              {formatCurrency(quoteStats.validTotalTtc)}
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--nm-muted)]">
                              Base : devis validés uniquement.
                            </div>
                          </div>
                          <div className="rounded-2xl bg-[color:var(--nm-surface-2)] ring-1 ring-[color:var(--nm-border)] p-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--nm-muted)]">
                              Devis liés
                            </div>
                            <div className="mt-1 text-2xl font-semibold text-[color:var(--nm-ink)]">
                              {quotes.length}
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--nm-muted)] flex flex-wrap gap-x-2 gap-y-1">
                              <span>{quoteStats.validCount} validé(s)</span>
                              <span aria-hidden>•</span>
                              <span>{quoteStats.counts.byStatus.refuse || 0} refusé(s)</span>
                              <span aria-hidden>•</span>
                              <span>{quoteStats.counts.byStatus.envoye || 0} envoyé(s)</span>
                            </div>
                          </div>
                          <div className="rounded-2xl bg-[color:var(--nm-surface-2)] ring-1 ring-[color:var(--nm-border)] p-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--nm-muted)]">
                              Paiements types
                            </div>
                            <div className="mt-1 text-sm font-medium text-[color:var(--nm-ink)]">
                              30% · 40% · 30%
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--nm-muted)]">
                              Acompte, mi-parcours, solde.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-[color:var(--nm-surface-2)] ring-1 ring-[color:var(--nm-border)] p-4 text-sm text-[color:var(--nm-muted)]">
                          Aucun devis validé n’est lié à ce projet. Ajoutez/validez un devis pour obtenir un budget fiable.
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "rounded-[var(--nm-radius)] bg-[color:var(--nm-surface)] ring-1 ring-[color:var(--nm-border)] backdrop-blur",
                      "p-4 sm:p-6"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--nm-muted)]">
                          Échéancier indicatif
                        </div>
                        <div className="mt-1 text-sm text-[color:var(--nm-muted)]">
                          Base de discussion — adaptez selon votre entreprise et l’avancement.
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      {buildPaymentSchedule(quoteStats.validTotalTtc > 0 ? quoteStats.validTotalTtc : null).map((p: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-[color:var(--nm-surface-2)] ring-1 ring-[color:var(--nm-border)] px-4 py-3 text-sm"
                        >
                          <span className="text-[color:var(--nm-ink)]">{p.label}</span>
                          {"amount" in p ? (
                            <span className="font-semibold text-[color:var(--nm-ink)]">
                              {formatCurrency(p.amount)}
                            </span>
                          ) : (
                            <span className="text-[color:var(--nm-muted)]">{p.note}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "mon-devis" && (
                <div className="grid gap-4">
                  <div
                    className={cn(
                      "rounded-[var(--nm-radius)] bg-[color:var(--nm-surface)] ring-1 ring-[color:var(--nm-border)] backdrop-blur",
                      "p-4 sm:p-6"
                    )}
                  >
                    <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--nm-muted)]">
                      Explique mon devis
                    </div>
                    <div className="mt-1 text-sm text-[color:var(--nm-muted)]">
                      Synthèse rapide + accès direct aux devis liés.
                    </div>

                    <div className="mt-4 rounded-2xl bg-[color:var(--nm-surface-2)] ring-1 ring-[color:var(--nm-border)] p-4 text-sm text-[color:var(--nm-muted)]">
                      Pour une analyse détaillée et contextualisée de vos devis (comparaison de postes, incohérences, recommandations),
                      utilisez l’Assistant IA.
                    </div>
                  </div>

                  <div
                    className={cn(
                      "rounded-[var(--nm-radius)] bg-[color:var(--nm-surface)] ring-1 ring-[color:var(--nm-border)] backdrop-blur",
                      "p-4 sm:p-6"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--nm-muted)]">
                          Devis liés
                        </div>
                        <div className="mt-1 text-sm text-[color:var(--nm-muted)]">
                          {quotes.length} devis
                        </div>
                      </div>
                    </div>

                    {quotes.length === 0 ? (
                      <div className="mt-4 rounded-2xl bg-[color:var(--nm-surface-2)] ring-1 ring-[color:var(--nm-border)] p-4 text-sm text-[color:var(--nm-muted)]">
                        Aucun devis lié pour le moment.
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-2">
                        {quotes.map((q) => (
                          <div
                            key={q.id}
                            className={cn(
                              "flex items-center justify-between gap-3",
                              "rounded-2xl bg-[color:var(--nm-surface-2)] ring-1 ring-[color:var(--nm-border)] px-4 py-3"
                            )}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-[color:var(--nm-ink)] truncate">
                                {q.title}
                              </div>
                              <div className="text-xs text-[color:var(--nm-muted)]">{getQuoteStatusLabel(q.status)}</div>
                            </div>
                            <div className="text-sm font-semibold text-[color:var(--nm-ink)]">
                              {typeof q.totalTtc === "number" ? formatCurrency(q.totalTtc) : "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    className={cn(
                      "rounded-[var(--nm-radius)] bg-[color:var(--nm-surface)] ring-1 ring-[color:var(--nm-border)] backdrop-blur",
                      "p-4 sm:p-6"
                    )}
                  >
                    <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--nm-muted)]">
                      Comprendre un devis de rénovation
                    </div>
                    <div className="mt-1 text-sm text-[color:var(--nm-muted)]">
                      Exemples de postes typiques et points à vérifier.
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-2xl bg-[color:var(--nm-surface-2)] ring-1 ring-[color:var(--nm-border)] p-4">
                        <div className="text-xs font-semibold text-[color:var(--nm-ink)]">Exemple : Poste Électricité</div>
                        <div className="mt-3 grid gap-2 text-sm text-[color:var(--nm-ink)]">
                          <div className="flex items-start justify-between gap-3">
                            <span className="min-w-0">Tableau électrique (fourniture)</span>
                            <span className="font-medium whitespace-nowrap">450 €</span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="min-w-0">Main d’œuvre installation (6h)</span>
                            <span className="font-medium whitespace-nowrap">390 €</span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="min-w-0">Prises & câblage (20 unités)</span>
                            <span className="font-medium whitespace-nowrap">1 200 €</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between border-t border-[color:var(--nm-border)] pt-2">
                            <span className="font-semibold">Sous-total HT</span>
                            <span className="font-semibold">2 040 €</span>
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-[color:var(--nm-muted)]">
                          Points à vérifier : norme NF C 15-100, repérage circuits, garanties.
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[color:var(--nm-surface-2)] ring-1 ring-[color:var(--nm-border)] p-4">
                        <div className="text-xs font-semibold text-[color:var(--nm-ink)]">Abréviations fréquentes</div>
                        <dl className="mt-3 grid gap-2">
                          <div className="grid grid-cols-[88px_1fr] gap-3">
                            <dt className="text-sm font-semibold text-[color:var(--nm-ink)]">HT / TTC</dt>
                            <dd className="text-sm text-[color:var(--nm-muted)]">Hors taxes / Toutes taxes comprises</dd>
                          </div>
                          <div className="grid grid-cols-[88px_1fr] gap-3">
                            <dt className="text-sm font-semibold text-[color:var(--nm-ink)]">M.O.</dt>
                            <dd className="text-sm text-[color:var(--nm-muted)]">Main d’œuvre</dd>
                          </div>
                          <div className="grid grid-cols-[88px_1fr] gap-3">
                            <dt className="text-sm font-semibold text-[color:var(--nm-ink)]">U</dt>
                            <dd className="text-sm text-[color:var(--nm-muted)]">Unité (pièce, m², ml…)</dd>
                          </div>
                          <div className="grid grid-cols-[88px_1fr] gap-3">
                            <dt className="text-sm font-semibold text-[color:var(--nm-ink)]">TVA</dt>
                            <dd className="text-sm text-[color:var(--nm-muted)]">10% (rénovation) / 20% (standard)</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rounded-2xl bg-[color:var(--nm-surface-2)] ring-1 ring-[color:var(--nm-border)] p-4">
                        <div className="text-xs font-semibold text-[color:var(--nm-ink)]">Structure type d’un devis BTP</div>
                        <ol className="mt-3 space-y-2 text-sm text-[color:var(--nm-muted)] list-decimal pl-5">
                          <li><span className="font-medium text-[color:var(--nm-ink)]">En-tête</span> : SIRET, assurances, coordonnées</li>
                          <li><span className="font-medium text-[color:var(--nm-ink)]">Description</span> : périmètre, adresse, contraintes</li>
                          <li><span className="font-medium text-[color:var(--nm-ink)]">Postes</span> : fournitures + main d’œuvre par lot</li>
                          <li><span className="font-medium text-[color:var(--nm-ink)]">Conditions</span> : délais, acomptes, garanties</li>
                          <li><span className="font-medium text-[color:var(--nm-ink)]">Totaux</span> : HT, TVA, TTC</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "rounded-[var(--nm-radius)] bg-[color:var(--nm-surface)] ring-1 ring-[color:var(--nm-border)] backdrop-blur",
                      "p-4 sm:p-6"
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--nm-muted)]">
                          Analyse personnalisée
                        </div>
                        <div className="mt-1 text-sm text-[color:var(--nm-muted)]">
                          L’Assistant IA peut comparer vos devis, détecter des anomalies et proposer des questions à poser.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenAssistant}
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm font-medium",
                          "bg-[color:var(--nm-accent)] text-white",
                          "shadow-[0_18px_40px_-26px_rgba(24,0,173,0.30)]",
                          "hover:brightness-[1.04] transition",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nm-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nm-bg)]"
                        )}
                      >
                        Ouvrir l’Assistant IA
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
