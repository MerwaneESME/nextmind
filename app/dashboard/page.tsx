"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  FileText,
  Eye,
  Download,
  FolderOpen,
  ImagePlus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  createProjectAsParticulier,
  fetchProjectsForUser,
  ProjectSummary,
  type CreateProjectParticulierInput,
  type QuestionnaireData,
} from "@/lib/projectsDb";
import { inferTypeFromFile, uploadDocument } from "@/lib/db/documentsDb";
import {
  PROJECT_TYPES_PARTICULIER,
  getQuestionnaireFields,
  type QuestionnaireField,
} from "@/lib/projectQuestionnaire";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { QuoteSummary } from "@/lib/quotesStore";
import { fetchDevisForUser } from "@/lib/devisDb";
import { downloadQuotePdf } from "@/lib/quotePdf";
import { supabase } from "@/lib/supabaseClient";

type WorkflowStatus = "a_faire" | "envoye" | "valide" | "refuse";

const resolveWorkflowStatus = (quote: QuoteSummary): WorkflowStatus => {
  const metadata = quote.rawMetadata ?? {};
  const workflow =
    typeof metadata.workflow_status === "string" ? metadata.workflow_status : null;
  if (workflow === "a_faire" || workflow === "envoye" || workflow === "valide" || workflow === "refuse") {
    return workflow;
  }
  const status = typeof quote.status === "string" ? quote.status.toLowerCase() : "";
  if (status === "valide" || status === "refuse") {
    return status as WorkflowStatus;
  }
  if (status === "envoye" || status === "published") {
    return "envoye";
  }
  return "a_faire";
};

type ProjectStatusKey = "draft" | "en_cours" | "termine" | "en_attente";

const resolveProjectStatus = (status: string | null): ProjectStatusKey => {
  if (!status) return "draft";
  const normalized = status.toLowerCase();
  if (["draft", "a_faire"].includes(normalized)) return "draft";
  if (["en_cours", "in_progress", "active"].includes(normalized)) return "en_cours";
  if (["termine", "completed", "done"].includes(normalized)) return "termine";
  if (["en_attente", "pending"].includes(normalized)) return "en_attente";
  return "en_attente";
};

const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getStatusBadge = (status: string) => {
  const styles = {
    draft: "bg-neutral-100 text-neutral-700",
    en_cours: "bg-primary-50 text-primary-700",
    termine: "bg-emerald-50 text-emerald-700",
    en_attente: "bg-amber-50 text-amber-700",
    a_faire: "bg-neutral-100 text-neutral-700",
    envoye: "bg-primary-50 text-primary-700",
    valide: "bg-emerald-50 text-emerald-700",
    refuse: "bg-red-50 text-red-700",
  };
  return styles[status as keyof typeof styles] || styles.en_attente;
};

const getStatusDotClass = (status: string) => {
  const dots = {
    draft: "bg-neutral-400",
    en_cours: "bg-primary-400",
    termine: "bg-emerald-400",
    en_attente: "bg-amber-400",
    a_faire: "bg-neutral-400",
    envoye: "bg-primary-400",
    valide: "bg-emerald-400",
    refuse: "bg-red-400",
  };
  return dots[status as keyof typeof dots] || dots.en_attente;
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    draft: "En étude",
    en_cours: "En cours",
    termine: "Terminé",
    en_attente: "En attente",
    a_faire: "En étude",
    envoye: "Envoyé",
    valide: "Validé",
    refuse: "Refusé",
  };
  return labels[status] || status;
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const userRole: "particulier" | "professionnel" =
    roleParam === "professionnel" ? "professionnel" : "particulier";

  if (userRole === "professionnel") {
    return <ProfessionalDashboard />;
  }

  return <ParticulierDashboard />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[400px] flex items-center justify-center text-neutral-600">
        Chargement du tableau de bord...
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function ProfessionalDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [activeMonthKey, setActiveMonthKey] = useState<string | null>(null);

  const normalizeStoragePath = (bucket?: string, path?: string) => {
    if (!bucket || !path) return path;
    return path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  };

  const loadProjects = async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setProjectsLoading(true);
    if (!silent) setProjectsError(null);
    try {
      const data = await fetchProjectsForUser(user.id);
      setProjects(data);
    } catch (err: any) {
      if (!silent) setProjectsError(err?.message ?? "Impossible de charger les projets.");
      setProjects([]);
    } finally {
      if (!silent) setProjectsLoading(false);
    }
  };

  const loadQuotes = async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setQuotesLoading(true);
    if (!silent) setQuotesError(null);
    try {
      const data = await fetchDevisForUser(user.id);
      setQuotes(data);
    } catch (err: any) {
      if (!silent) setQuotesError(err?.message ?? "Impossible de charger les devis.");
      setQuotes([]);
    } finally {
      if (!silent) setQuotesLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
    void loadQuotes();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      void loadProjects(true);
      void loadQuotes(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const monthSeries = useMemo(() => {
    const now = new Date();
    const windowEnd = new Date(now.getFullYear(), now.getMonth() - monthOffset * 6, 1);
    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(windowEnd.getFullYear(), windowEnd.getMonth() - (5 - index), 1);
      const label = monthDate
        .toLocaleDateString("fr-FR", { month: "short" })
        .replace(".", "")
        .toUpperCase();
      return {
        key: toMonthKey(monthDate),
        label,
        year: monthDate.getFullYear(),
        date: monthDate,
      };
    });
  }, [monthOffset]);

  useEffect(() => {
    if (!monthSeries.length) return;
    setActiveMonthKey((prev) => {
      if (prev && monthSeries.some((point) => point.key === prev)) {
        return prev;
      }
      return monthSeries[monthSeries.length - 1].key;
    });
  }, [monthSeries]);

  const devisStats = useMemo(() => {
    const counters = { a_faire: 0, envoye: 0, valide: 0 };
    quotes.forEach((quote) => {
      const status = resolveWorkflowStatus(quote);
      if (status === "a_faire") counters.a_faire += 1;
      if (status === "envoye") counters.envoye += 1;
      if (status === "valide") counters.valide += 1;
    });
    return counters;
  }, [quotes]);

  const conversionStats = useMemo(() => {
    const counters = { envoye: 0, valide: 0, refuse: 0 };
    quotes.forEach((quote) => {
      const status = resolveWorkflowStatus(quote);
      if (status === "envoye") counters.envoye += 1;
      if (status === "valide") counters.valide += 1;
      if (status === "refuse") counters.refuse += 1;
    });
    const total = counters.envoye + counters.valide + counters.refuse;
    const rate = total > 0 ? counters.valide / total : 0;
    return { ...counters, total, rate };
  }, [quotes]);

  const revenueSeries = useMemo(() => {
    const series = monthSeries.map((point) => ({ ...point, value: 0 }));
    const seriesMap = new Map(series.map((point) => [point.key, point]));
    quotes.forEach((quote) => {
      if (resolveWorkflowStatus(quote) !== "valide") return;
      if (typeof quote.totalTtc !== "number") return;
      const date = new Date(quote.updatedAt);
      const key = toMonthKey(date);
      const bucket = seriesMap.get(key);
      if (bucket) {
        bucket.value += quote.totalTtc;
      }
    });
    return series;
  }, [quotes, monthSeries]);

  const projectSeries = useMemo(() => {
    const series = monthSeries.map((point) => ({ ...point, items: [] as ProjectSummary[] }));
    const seriesMap = new Map(series.map((point) => [point.key, point]));
    projects.forEach((project) => {
      const source = project.createdAt ?? project.updatedAt;
      if (!source) return;
      const key = toMonthKey(new Date(source));
      const bucket = seriesMap.get(key);
      if (bucket) {
        bucket.items.push(project);
      }
    });
    return series;
  }, [projects, monthSeries]);

  const projectBudgetSeries = useMemo(
    () =>
      projectSeries.map((point) => ({
        key: point.key,
        value: point.items.reduce(
          (sum, project) =>
            sum + (typeof project.budgetTotal === "number" ? project.budgetTotal : 0),
          0
        ),
      })),
    [projectSeries]
  );

  const revenueTotal = useMemo(
    () => revenueSeries.reduce((sum, point) => sum + point.value, 0),
    [revenueSeries]
  );

  const revenueDelta = useMemo(() => {
    const current = revenueSeries[revenueSeries.length - 1]?.value ?? 0;
    const previous = revenueSeries[revenueSeries.length - 2]?.value ?? 0;
    if (previous === 0) {
      return { value: current > 0 ? 1 : 0, direction: current > 0 ? "up" : "flat" };
    }
    const change = (current - previous) / previous;
    return { value: Math.abs(change), direction: change >= 0 ? "up" : "down" };
  }, [revenueSeries]);

  const annualRevenue = useMemo(() => {
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return quotes.reduce((sum, quote) => {
      if (resolveWorkflowStatus(quote) !== "valide") return sum;
      if (typeof quote.totalTtc !== "number") return sum;
      const date = new Date(quote.updatedAt);
      if (date < windowStart || date > now) return sum;
      return sum + quote.totalTtc;
    }, 0);
  }, [quotes]);

  const totalProjectBudget = useMemo(
    () =>
      projects.reduce(
        (sum, project) => sum + (typeof project.budgetTotal === "number" ? project.budgetTotal : 0),
        0
      ),
    [projects]
  );

  const budgetBaseline = annualRevenue > 0 ? annualRevenue : totalProjectBudget;
  const budgetBaselineLabel =
    annualRevenue > 0 ? "CA annuel" : totalProjectBudget > 0 ? "Budget total" : "Base indisponible";
  const budgetBaselineDisplay =
    budgetBaselineLabel === "Base indisponible"
      ? budgetBaselineLabel
      : `Base ${budgetBaselineLabel}`;
  const budgetBaselineShortLabel =
    budgetBaselineLabel === "Base indisponible" ? "Base" : budgetBaselineLabel;

  const activeMonth =
    monthSeries.find((point) => point.key === activeMonthKey) ??
    monthSeries[monthSeries.length - 1];
  const activeProjects =
    projectSeries.find((point) => point.key === activeMonth?.key)?.items ?? [];
  const windowLabel = monthSeries.length
    ? `${monthSeries[0].label} ${monthSeries[0].year} - ${
        monthSeries[monthSeries.length - 1].label
      } ${monthSeries[monthSeries.length - 1].year}`
    : "";

  const alertesNonLues = 0;

  const openDevis = () => {
    const roleParam = user?.role === "professionnel" ? "professionnel" : "particulier";
    router.push(`/dashboard/devis?role=${roleParam}`);
  };

  const openProjects = () => {
    const roleParam = user?.role === "professionnel" ? "professionnel" : "particulier";
    router.push(`/dashboard/projets?role=${roleParam}`);
  };

  const handleOpenProject = (projectId: string) => {
    const roleParam = user?.role === "professionnel" ? "professionnel" : "particulier";
    router.push(`/dashboard/projets/${projectId}?role=${roleParam}`);
  };

  const projectsEnCours = projects.filter(
    (project) => resolveProjectStatus(project.status) === "en_cours"
  ).length;
  const projectsTermines = projects.filter(
    (project) => resolveProjectStatus(project.status) === "termine"
  ).length;
  const devisRecus = 0;
  const conversionPercent = Math.round(conversionStats.rate * 100);
  const conversionTarget = 35;

  const handleViewQuote = (quote: QuoteSummary) => {
    const roleParam = user?.role === "professionnel" ? "professionnel" : "particulier";
    router.push(`/dashboard/devis/visualiser/${quote.id}?role=${roleParam}`);
  };

  const handleDownloadQuote = async (quote: QuoteSummary) => {
    const bucket =
      typeof quote.rawMetadata?.pdf_bucket === "string" ? quote.rawMetadata.pdf_bucket : undefined;
    const rawPath =
      typeof quote.rawMetadata?.pdf_path === "string" ? quote.rawMetadata.pdf_path : undefined;
    const path = normalizeStoragePath(bucket, rawPath);

    if (bucket && path) {
      const { data } = await supabase.storage.from(bucket).download(path);
      if (data) {
        const url = URL.createObjectURL(data);
        const link = document.createElement("a");
        link.href = url;
        link.download = quote.fileName || `${quote.title}.pdf`;
        link.rel = "noopener";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return;
      }
    }

    if (quote.fileUrl) {
      const link = document.createElement("a");
      link.href = quote.fileUrl;
      link.download = quote.fileName || `${quote.title}.pdf`;
      link.rel = "noopener";
      link.click();
      return;
    }

    if (quote.previewData) {
      downloadQuotePdf(quote.previewData, quote.title);
    }
  };

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
        <div className="relative flex items-start justify-between gap-6 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Tableau de bord</h1>
              <p className="text-neutral-600 mt-1">Vue d'ensemble de votre activité</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
                  {projects.length} projet{projects.length !== 1 ? "s" : ""}
                </span>
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
                  {quotes.length} devis
                </span>
                {projects.filter((p) => resolveProjectStatus(p.status) === "en_cours").length > 0 && (
                  <span className="rounded-full border border-primary-200 bg-primary-50 text-primary-700 px-3 py-1">
                    {projects.filter((p) => resolveProjectStatus(p.status) === "en_cours").length} en cours
                  </span>
                )}
              </div>
            </div>
          </div>
          <img
            src="/images/dashboard.png"
            alt="Tableau de bord"
            className="hidden sm:block h-20 w-20 object-contain opacity-90 logo-blend flex-shrink-0"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-l-4 border-l-primary-400">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Projets en cours</p>
                <p className="text-3xl font-bold text-neutral-900">{projectsEnCours}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-primary-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-emerald-400">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Projets achevés</p>
                <p className="text-3xl font-bold text-neutral-900">{projectsTermines}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-amber-400">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Devis à faire</p>
                <p className="text-3xl font-bold text-neutral-900">{devisStats.a_faire}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-red-400">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Alertes</p>
                <p className="text-3xl font-bold text-neutral-900">{alertesNonLues}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="relative lg:col-span-2 overflow-hidden border border-primary-100 shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
          <CardHeader className="relative z-10 border-primary-100/80">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-neutral-500">Evolution du CA</p>
                <p className="text-lg font-semibold text-neutral-900">Revenus sur 6 mois</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Fenetre</p>
                  <p className="text-xs text-neutral-600">{windowLabel}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMonthOffset((prev) => prev + 1)}
                    className="h-8 w-8 rounded-full border border-primary-100 bg-primary-50 text-primary-700 transition hover:bg-primary-100"
                    aria-label="Mois precedents"
                  >
                    <ChevronLeft className="h-4 w-4 mx-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthOffset((prev) => Math.max(0, prev - 1))}
                    disabled={monthOffset === 0}
                    className="h-8 w-8 rounded-full border border-primary-100 bg-primary-50 text-primary-700 transition hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Mois suivants"
                  >
                    <ChevronRight className="h-4 w-4 mx-auto" />
                  </button>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary-600" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Total</p>
                <p className="text-3xl font-semibold text-neutral-900">{formatCurrency(revenueTotal)}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs">
                <span
                  className={`h-2 w-2 rounded-full ${
                    revenueDelta.direction === "down" ? "bg-red-500" : "bg-success-500"
                  }`}
                />
                <span
                  className={
                    revenueDelta.direction === "down" ? "text-red-600" : "text-success-600"
                  }
                >
                  {revenueDelta.direction === "flat"
                    ? "Stable vs mois dernier"
                    : `${revenueDelta.direction === "down" ? "-" : "+"}${Math.round(
                        revenueDelta.value * 100
                      )}% vs mois dernier`}
                </span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary-400/10 blur-3xl" />
              <div className="flex items-end gap-3 h-36">
                {revenueSeries.map((point, index) => {
                  const projectCount = projectSeries[index]?.items.length ?? 0;
                  const isActive = activeMonth?.key === point.key;
                  const hasProjects = projectCount > 0;
                  const projectBudget = projectBudgetSeries[index]?.value ?? 0;
                  const budgetBaseForBar = budgetBaseline > 0 ? budgetBaseline : 1;
                  const projectPercent =
                    projectBudget > 0 ? (projectBudget / budgetBaseForBar) * 100 : 0;
                  const projectHeight = projectBudget > 0
                    ? Math.max(12, Math.min(100, Math.round(projectPercent)))
                    : hasProjects
                      ? 12
                      : 0;
                  return (
                    <button
                      key={point.key}
                      type="button"
                      onClick={() => setActiveMonthKey(point.key)}
                      className="group flex flex-1 flex-col items-center gap-2 bg-transparent focus:outline-none"
                      aria-pressed={isActive}
                    >
                      <div
                        className={`relative w-full h-24 flex items-end rounded-md transition ${
                          isActive ? "ring-2 ring-primary-200/80" : ""
                        }`}
                      >
                        <div
                          className={`w-full rounded-md transition-all ${
                            isActive
                              ? "bg-gradient-to-t from-primary-600 via-primary-500 to-primary-300"
                              : "bg-gradient-to-t from-primary-500 via-primary-400 to-primary-200"
                          } ${projectHeight > 0 ? "opacity-100" : "opacity-0"}`}
                          style={{ height: `${projectHeight}%` }}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`text-[10px] uppercase tracking-wide ${
                            isActive ? "text-primary-700" : "text-neutral-500"
                          }`}
                        >
                          {point.label}
                        </span>
                        <span
                          className={`text-[10px] ${
                            hasProjects ? "text-primary-600" : "text-neutral-400"
                          }`}
                        >
                          {projectCount} projet{projectCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-primary-100/80 bg-primary-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-700">
                <span className="uppercase tracking-[0.2em] text-neutral-800">
                  Projets {activeMonth?.label} {activeMonth?.year}
                </span>
                <span className="text-neutral-600">
                  {activeProjects.length} projet{activeProjects.length > 1 ? "s" : ""} |{" "}
                  {budgetBaselineDisplay}
                  {budgetBaseline > 0 ? `: ${formatCurrency(budgetBaseline)}` : ""}
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {activeProjects.length ? (
                  activeProjects.map((project) => {
                    const statusKey = resolveProjectStatus(project.status);
                    const dotClass = {
                      draft: "bg-neutral-300",
                      en_cours: "bg-primary-300",
                      termine: "bg-success-300",
                      en_attente: "bg-warning-300",
                    }[statusKey];
                    const budgetValue =
                      typeof project.budgetTotal === "number" ? project.budgetTotal : 0;
                    const baseline = budgetBaseline > 0 ? budgetBaseline : 1;
                    const rawPercent = budgetValue > 0 ? (budgetValue / baseline) * 100 : 0;
                    const displayPercent =
                      budgetValue > 0 ? Math.max(6, Math.min(100, rawPercent)) : 0;
                    return (
                      <div
                        key={project.id}
                        className="rounded-lg border border-primary-100/70 bg-white px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-neutral-900 truncate">
                              {project.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${dotClass ?? "bg-neutral-300"}`}
                              />
                              <span className="uppercase tracking-[0.15em] text-neutral-500">
                                {project.projectType ?? "Projet"}
                              </span>
                              {budgetValue > 0 && (
                                <>
                                  <span className="text-neutral-400">|</span>
                                  <span className="text-neutral-700">{formatCurrency(budgetValue)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          {budgetValue > 0 ? (
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-semibold text-primary-600">
                                {Math.round(rawPercent)}%
                              </p>
                              <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">
                                {budgetBaselineShortLabel}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[10px] text-neutral-400 italic flex-shrink-0">Budget à définir</span>
                          )}
                        </div>
                        {budgetValue > 0 && (
                          <div className="mt-2 h-1.5 rounded-full bg-neutral-200">
                            <div
                              className="h-1.5 rounded-full bg-gradient-to-r from-primary-400 to-primary-600"
                              style={{ width: `${displayPercent}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <span className="text-xs text-neutral-500">Aucun projet ce mois</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
          <CardHeader className="relative z-10 border-neutral-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Taux de conversion client</p>
                <p className="text-lg font-semibold text-neutral-900">Conversion</p>
              </div>
              <img
                src="/images/conversion.png"
                alt="Conversion"
                className="h-28 w-28 object-contain logo-blend"
              />
            </div>
          </CardHeader>
          <CardContent className="relative z-10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-24">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(#10b981 ${Math.round(
                      conversionStats.rate * 360
                    )}deg, #e5e7eb 0deg)`,
                  }}
                />
                <div className="absolute inset-2 rounded-full bg-white shadow-sm flex items-center justify-center">
                  <span className="text-2xl font-semibold text-neutral-900">
                    {conversionPercent}%
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-6">
                  <span className="text-neutral-500">Envoyés</span>
                  <span className="font-semibold text-neutral-900">{conversionStats.envoye}</span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="text-neutral-500">Validés</span>
                  <span className="font-semibold text-neutral-900">{conversionStats.valide}</span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="text-neutral-500">Refusés</span>
                  <span className="font-semibold text-neutral-900">{conversionStats.refuse}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Objectif {conversionTarget}%</span>
              <span
                className={`font-semibold ${
                  conversionPercent >= conversionTarget ? "text-success-600" : "text-warning-600"
                }`}
              >
                {conversionPercent >= conversionTarget ? "Au-dessus" : "Sous l'objectif"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Projets récents</h2>
            <Button variant="outline" size="sm" onClick={openProjects}>
              Voir tout
            </Button>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          {projectsError && (
            <div className="text-sm text-red-600 mb-3">{projectsError}</div>
          )}
          {projectsLoading ? (
            <p className="text-sm text-neutral-500">Chargement des projets...</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projet</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date de création</TableHead>
                    <TableHead>Dernière mise à jour</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {projects.slice(0, 5).map((project) => {
                    const statusKey = resolveProjectStatus(project.status);
                    return (
                      <TableRow key={project.id} onClick={() => handleOpenProject(project.id)}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-neutral-900">{project.name}</p>
                            {project.description && (
                              <p className="text-sm text-neutral-500">{project.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(statusKey)}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(statusKey)}`} />
                            {getStatusLabel(statusKey)}
                          </span>
                        </TableCell>
                        <TableCell className="text-neutral-600">
                          {project.createdAt ? formatDate(project.createdAt) : "-"}
                        </TableCell>
                        <TableCell className="text-neutral-600">
                          {project.updatedAt ? formatDate(project.updatedAt) : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </tbody>
              </Table>
              {!projects.length && (
                <p className="text-sm text-neutral-500 mt-4">Aucun projet pour le moment.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Devis récents</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">
                En étude: {devisStats.a_faire} | Envoyés: {devisStats.envoye} | Validés: {devisStats.valide}
              </span>
              <Button variant="outline" size="sm" onClick={openDevis}>
                Voir tout
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          {quotesError && (
            <div className="text-sm text-red-600 mb-3">{quotesError}</div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projet</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <tbody>
              {quotes.slice(0, 5).map((quote) => {
                const workflowStatus = resolveWorkflowStatus(quote);
                return (
                  <TableRow key={quote.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-neutral-900">{quote.title}</p>
                        {quote.clientName && (
                          <p className="text-xs text-neutral-500">Client: {quote.clientName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-neutral-900">
                      {typeof quote.totalTtc === "number" ? formatCurrency(quote.totalTtc) : "-"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(workflowStatus)}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(workflowStatus)}`} />
                        {getStatusLabel(workflowStatus)}
                      </span>
                    </TableCell>
                    <TableCell className="text-neutral-600">
                      {formatDate(quote.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewQuote(quote)}
                          disabled={!quote.fileUrl && !quote.previewData}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadQuote(quote)}
                          disabled={!quote.fileUrl && !quote.previewData && !quote.rawMetadata?.pdf_bucket}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </tbody>
          </Table>
          {!quotesLoading && quotes.length === 0 && (
            <p className="text-sm text-neutral-500 mt-4">Aucun devis pour le moment.</p>
          )}
          {quotesLoading && (
            <p className="text-sm text-neutral-500 mt-4">Chargement des devis...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const initialParticulierForm: CreateProjectParticulierInput & {
  budgetStr: string;
  surfaceSqmStr: string;
  questionnaire: Record<string, string | number>;
} = {
  name: "",
  description: "",
  projectType: "",
  address: "",
  city: "",
  postalCode: "",
  budgetStr: "",
  surfaceSqmStr: "",
  desiredStartDate: "",
  questionnaire: {},
};

function QuestionnaireFieldInput({
  field,
  value,
  onChange,
}: {
  field: QuestionnaireField;
  value: string | number;
  onChange: (value: string | number) => void;
}) {
  const val = value ?? "";
  const commonClass = "w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";
  if (field.type === "textarea") {
    return (
      <div>
        <label className="block text-sm font-medium text-neutral-800 mb-1">{field.label}</label>
        <textarea
          value={String(val)}
          onChange={(e) => onChange(e.target.value)}
          className={`${commonClass} min-h-[100px]`}
          placeholder={field.placeholder}
          required
        />
      </div>
    );
  }
  if (field.type === "select") {
    const selectId = `q-${field.key}`;
    return (
      <div>
        <label htmlFor={selectId} className="block text-sm font-medium text-neutral-800 mb-1">{field.label}</label>
        <select
          id={selectId}
          aria-label={field.label}
          value={String(val)}
          onChange={(e) => onChange(e.target.value)}
          className={commonClass}
          required
        >
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === "number") {
    return (
      <Input
        label={field.label}
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={String(val)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v ? Number(v) : "");
        }}
        placeholder={field.placeholder}
        required
      />
    );
  }
  return (
    <Input
      label={field.label}
      value={String(val)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      required
    />
  );
}

const ACCEPTED_FILE_TYPES = "image/*,application/pdf,.doc,.docx,.xls,.xlsx";
const MAX_FILE_SIZE_MB = 10;

function ParticulierDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(initialParticulierForm);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.isArray(files) ? files : Array.from(files);
    const valid = arr.filter((f) => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024);
    setSelectedFiles((prev) => [...prev, ...valid]);
  };

  const loadProjects = async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const data = await fetchProjectsForUser(user.id);
      setProjects(data);
    } catch (err: any) {
      if (!silent) setError(err?.message ?? "Impossible de charger les projets.");
      setProjects([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => void loadProjects(true), 20000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const projectsEnCours = projects.filter(
    (project) => resolveProjectStatus(project.status) === "en_cours"
  ).length;
  const projectsTermines = projects.filter(
    (project) => resolveProjectStatus(project.status) === "termine"
  ).length;
  const devisRecus = 0;

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !formData.name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const budget = formData.budgetStr ? Number(formData.budgetStr.replace(/\s/g, "")) : undefined;
      const surfaceSqm = formData.surfaceSqmStr ? Number(formData.surfaceSqmStr.replace(/\s/g, "").replace(",", ".")) : undefined;
      const questionnaireData: QuestionnaireData = {};
      for (const [k, v] of Object.entries(formData.questionnaire)) {
        if (v !== "" && v !== null && v !== undefined) {
          questionnaireData[k] = typeof v === "number" ? v : String(v).trim();
        }
      }
      const description =
        formData.projectType === "autre" && questionnaireData.descriptionDetaillee
          ? String(questionnaireData.descriptionDetaillee)
          : formData.description || undefined;
      const projectId = await createProjectAsParticulier(user.id, {
        name: formData.name,
        description: description,
        projectType: formData.projectType || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        postalCode: formData.postalCode || undefined,
        budget: Number.isFinite(budget) ? budget : undefined,
        desiredStartDate: formData.desiredStartDate || undefined,
        surfaceSqm: Number.isFinite(surfaceSqm) ? surfaceSqm : undefined,
        questionnaireData: Object.keys(questionnaireData).length ? questionnaireData : undefined,
      });
      if (selectedFiles.length > 0 && projectId) {
        const uploadErrors: string[] = [];
        for (const file of selectedFiles) {
          try {
            await uploadDocument(file, {
              projectId,
              fileType: inferTypeFromFile(file),
            });
          } catch (uploadErr: any) {
            uploadErrors.push(`${file.name}: ${uploadErr?.message ?? "Erreur"}`);
          }
        }
        if (uploadErrors.length > 0) {
          setError(`Projet créé. Erreurs lors de l'upload : ${uploadErrors.join(" ; ")}`);
        }
      }
      setFormData(initialParticulierForm);
      setSelectedFiles([]);
      setIsCreating(false);
      await loadProjects();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de créer le projet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProjectTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      projectType: value,
      questionnaire: {},
    }));
  };

  const questionnaireFields = getQuestionnaireFields(formData.projectType);
  const needsSurface = ["renovation", "construction", "extension", "peinture", "carrelage", "toiture"].includes(formData.projectType);

  const handleOpenProject = (projectId: string) => {
    const roleParam = user?.role === "professionnel" ? "professionnel" : "particulier";
    router.push(`/dashboard/projets/${projectId}?role=${roleParam}`);
  };

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
        <div className="relative flex items-start justify-between gap-6 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <FolderOpen className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Mes projets</h1>
              <p className="text-neutral-600 mt-1">Gérez vos projets BTP</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
                  {projects.length} projet{projects.length !== 1 ? "s" : ""}
                </span>
                {projectsEnCours > 0 && (
                  <span className="rounded-full border border-primary-200 bg-primary-50 text-primary-700 px-3 py-1">
                    {projectsEnCours} en cours
                  </span>
                )}
                {projectsTermines > 0 && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1">
                    {projectsTermines} terminé{projectsTermines !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="mt-4">
                <Button onClick={() => setIsCreating(true)}>
                  Créer un nouveau projet
                </Button>
              </div>
            </div>
          </div>
          <img
            src="/images/dashboard.png"
            alt="Mes projets"
            className="hidden sm:block h-20 w-20 object-contain opacity-90 logo-blend flex-shrink-0"
          />
        </div>
      </header>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden border-l-4 border-l-primary-400">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Projets en cours</p>
                <p className="text-3xl font-bold text-neutral-900">{projectsEnCours}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-primary-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-emerald-400">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Projets terminés</p>
                <p className="text-3xl font-bold text-neutral-900">{projectsTermines}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-amber-400">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Devis reçus</p>
                <p className="text-3xl font-bold text-neutral-900">{devisRecus}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-neutral-900">Mes projets</h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-neutral-500">Chargement des projets...</p>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const statusKey = resolveProjectStatus(project.status);
                return (
                  <div
                    key={project.id}
                    onClick={() => handleOpenProject(project.id)}
                    className="p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 card-hover transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-neutral-900 mb-1 truncate">{project.name}</h3>
                        {project.description && (
                          <p className="text-sm text-neutral-600 mb-2 line-clamp-1">{project.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-neutral-500">
                          <span>Créé le {project.createdAt ? formatDate(project.createdAt) : "-"}</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getStatusBadge(statusKey)}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(statusKey)}`} />
                        {getStatusLabel(statusKey)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {!projects.length && (
                <p className="text-sm text-neutral-500">Aucun projet pour le moment.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isCreating && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-2xl w-full p-6 my-8 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">Nouvelle demande de projet</h3>
            <p className="text-sm text-neutral-500 mb-4">
              Remplissez ce formulaire. Les informations seront envoyées aux artisans compatibles pour une meilleure estimation.
            </p>
            <form className="space-y-4" onSubmit={handleCreateProject}>
              <div>
                <label htmlFor="particulier-project-type" className="block text-sm font-medium text-neutral-800 mb-1">Type de travaux *</label>
                <select
                  id="particulier-project-type"
                  aria-label="Type de travaux"
                  value={formData.projectType}
                  onChange={(e) => handleProjectTypeChange(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  {PROJECT_TYPES_PARTICULIER.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Titre du projet *"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex. Rénovation cuisine"
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="Adresse du chantier *"
                    value={formData.address}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="Numéro et rue"
                    required
                  />
                </div>
                <div>
                  <Input
                    label="Code postal *"
                    value={formData.postalCode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="75001"
                    required
                  />
                </div>
              </div>
              <Input
                label="Ville *"
                value={formData.city}
                onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="Paris"
                required
              />
              {formData.projectType !== "autre" && (
                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1">Description détaillée *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full min-h-[100px] px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Décrivez votre projet : dimensions, contraintes, délais souhaités..."
                    required
                  />
                </div>
              )}
              {questionnaireFields.map((field) => (
                <QuestionnaireFieldInput
                  key={field.key}
                  field={field}
                  value={formData.questionnaire[field.key] ?? ""}
                  onChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      questionnaire: { ...prev.questionnaire, [field.key]: value },
                    }))
                  }
                />
              ))}
              {needsSurface && (
                <Input
                  label="Surface à traiter (m²) *"
                  type="number"
                  min={1}
                  step={0.01}
                  value={formData.surfaceSqmStr}
                  onChange={(e) => setFormData((prev) => ({ ...prev, surfaceSqmStr: e.target.value }))}
                  placeholder="Ex. 25"
                  required
                />
              )}
              <Input
                label="Budget (€) *"
                type="number"
                min={0}
                value={formData.budgetStr}
                onChange={(e) => setFormData((prev) => ({ ...prev, budgetStr: e.target.value }))}
                placeholder="Ex. 10000"
                required
              />
              <Input
                label="Date de début souhaitée *"
                type="date"
                value={formData.desiredStartDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, desiredStartDate: e.target.value }))}
                required
              />
              <div className="space-y-2 pt-2 border-t border-neutral-200">
                <label className="block text-sm font-medium text-neutral-800 mb-1">
                  Documents ou photos (optionnel)
                </label>
                <p className="text-xs text-neutral-500 mb-3">
                  Ajoutez des plans, photos ou documents pour compléter votre demande. Max {MAX_FILE_SIZE_MB} Mo par fichier.
                </p>
                <input
                  ref={fileInputRef}
                  id="particulier-project-files"
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  multiple
                  className="hidden"
                  aria-label="Ajouter des documents ou photos"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <label
                  htmlFor="particulier-project-files"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed min-h-[140px] px-6 py-8 cursor-pointer transition-all block bg-blue-50 border-blue-400 shadow-sm hover:bg-blue-100 hover:border-blue-500 ${
                    dragOver ? "!border-blue-600 !bg-blue-100 ring-2 ring-blue-300" : ""
                  }`}
                >
                  <ImagePlus className="w-12 h-12 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-800">Déposer des documents ou photos</span>
                  <span className="text-xs text-gray-600">Cliquez ou glissez vos fichiers ici (images, PDF, Word, Excel)</span>
                </label>
                {selectedFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {selectedFiles.map((file, i) => (
                      <li
                        key={`${file.name}-${i}`}
                        className="flex items-center justify-between text-sm bg-neutral-50 rounded px-3 py-2"
                      >
                        <span className="truncate flex-1">{file.name}</span>
                        <span className="text-xs text-neutral-500 ml-2">
                          {(file.size / 1024).toFixed(1)} Ko
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-200">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedFiles([]);
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Création..." : "Créer la demande"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
