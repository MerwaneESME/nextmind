"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  AlertCircle,
  ChevronDown,
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
import {
  resolveWorkflowStatus,
  resolveProjectStatus,
  getStatusBadge,
  getStatusDotClass,
  getStatusLabel,
} from "@/lib/statusHelpers";
import { toMonthKey } from "@/lib/dateHelpers";

type UpcomingItem = {
  id: string;
  name: string;
  date: string | null;
  project_id: string | null;
  kind: "task" | "intervention";
  task_type?: string | null;
  attendees?: string[] | null;
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
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [devisExpanded, setDevisExpanded] = useState(false);
  const [upcomingItems, setUpcomingItems] = useState<UpcomingItem[]>([]);
  const [attendeeProfiles, setAttendeeProfiles] = useState<Map<string, { full_name: string | null; avatar_url: string | null }>>(new Map());
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

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

  const loadUpcomingItems = async (projectList: typeof projects) => {
    if (!user?.id || !projectList.length) return;
    // Only show loading spinner on first load — avoids flicker on silent refresh
    if (upcomingItems.length === 0) setTasksLoading(true);
    setTasksError(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const projectIds = projectList.map((p) => p.id);

      // Batch query: project_tasks (correct table) for all projects at once
      const { data: taskData, error: taskError } = await supabase
        .from("project_tasks")
        .select("id, name, start_date, end_date, completed_at, project_id, task_type, attendees")
        .in("project_id", projectIds)
        .is("completed_at", null)
        .limit(200);

      if (taskError) throw taskError;

      // Batch query: phases for all projects, then lots
      const { data: phaseData, error: phaseError } = await supabase
        .from("phases")
        .select("id, project_id")
        .in("project_id", projectIds);

      if (phaseError) throw phaseError;

      const phaseMap = new Map<string, string>(); // phaseId -> projectId
      for (const ph of (phaseData ?? [])) phaseMap.set(String(ph.id), String(ph.project_id));

      const phaseIds = [...phaseMap.keys()];
      const LOT_DONE = new Set(["termine", "valide"]);
      let lotData: any[] = [];

      if (phaseIds.length > 0) {
        const { data, error: lotError } = await supabase
          .from("lots")
          .select("id, phase_id, name, start_date, end_date, status")
          .in("phase_id", phaseIds);
        if (lotError) throw lotError;
        lotData = (data ?? []).filter((lot: any) => !LOT_DONE.has(String(lot.status ?? "").toLowerCase()));
      }

      const items: UpcomingItem[] = [];

      // Add tasks
      for (const t of (taskData ?? []) as any[]) {
        const date: string | null = t.start_date ?? t.end_date ?? null;
        if (!date || date < today) continue;
        const attendees = Array.isArray(t.attendees) ? (t.attendees as string[]) : null;
        items.push({ id: String(t.id), name: String(t.name ?? "Tâche"), date, project_id: t.project_id, kind: "task", task_type: t.task_type ?? "task", attendees });
      }

      // Add lots/interventions
      for (const lot of lotData) {
        const date: string | null = lot.start_date ?? lot.end_date ?? null;
        if (!date || date < today) continue;
        const projectId = phaseMap.get(String(lot.phase_id)) ?? null;
        items.push({ id: String(lot.id), name: String(lot.name ?? "Intervention"), date, project_id: projectId, kind: "intervention" });
      }

      items.sort((a, b) => (a.date ?? "9999") < (b.date ?? "9999") ? -1 : 1);
      const finalItems = items.slice(0, 6);
      setUpcomingItems(finalItems);

      // Load profiles for RDV attendees
      const allAttendeeIds = [...new Set(finalItems.flatMap((it) => it.attendees ?? []))];
      if (allAttendeeIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", allAttendeeIds);
        const map = new Map<string, { full_name: string | null; avatar_url: string | null }>();
        for (const p of (profileData ?? []) as any[]) map.set(String(p.id), { full_name: p.full_name ?? null, avatar_url: p.avatar_url ?? null });
        setAttendeeProfiles(map);
      }
    } catch (e: any) {
      setTasksError(e?.message ?? "Erreur chargement");
      setUpcomingItems([]);
    } finally {
      setTasksLoading(false);
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

  useEffect(() => {
    if (user?.id) void loadUpcomingItems(projects);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, user?.id]);

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


  const revenueSeries = useMemo(() => {
    const series = monthSeries.map((point) => ({ ...point, value: 0, count: 0 }));
    const seriesMap = new Map(series.map((point) => [point.key, point]));
    quotes.forEach((quote) => {
      if (resolveWorkflowStatus(quote) !== "valide") return;
      if (typeof quote.totalTtc !== "number") return;
      const date = new Date(quote.updatedAt);
      const key = toMonthKey(date);
      const bucket = seriesMap.get(key);
      if (bucket) {
        bucket.value += quote.totalTtc;
        bucket.count += 1;
      }
    });
    return series;
  }, [quotes, monthSeries]);


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

  const maxRevenue = useMemo(
    () => Math.max(...revenueSeries.map((p) => p.value), 0),
    [revenueSeries]
  );

  const activeMonth =
    monthSeries.find((point) => point.key === activeMonthKey) ??
    monthSeries[monthSeries.length - 1];
  const activeDevis = useMemo(() => {
    if (!activeMonth) return [];
    return quotes.filter((q) => {
      if (resolveWorkflowStatus(q) !== "valide") return false;
      return toMonthKey(new Date(q.updatedAt)) === activeMonth.key;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes, activeMonth?.key]);
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
        <div className="absolute inset-0 bg-white" />
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
          <div className="absolute inset-0 bg-white" />
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
                {revenueSeries.map((point) => {
                  const isActive = activeMonth?.key === point.key;
                  const revenueValue = point.value;
                  const barHeight = maxRevenue > 0
                    ? Math.max(8, Math.round((revenueValue / maxRevenue) * 100))
                    : 0;
                  const hasRevenue = revenueValue > 0;
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
                        {hasRevenue ? (
                          <div
                            className={`w-full rounded-md transition-all ${
                              isActive
                                ? "bg-gradient-to-t from-primary-600 via-primary-500 to-primary-300"
                                : "bg-gradient-to-t from-primary-500 via-primary-400 to-primary-200"
                            }`}
                            style={{ height: `${barHeight}%` }}
                          />
                        ) : (
                          <div className="w-full rounded-sm bg-neutral-100" style={{ height: "4px" }} />
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`text-[10px] uppercase tracking-wide ${
                            isActive ? "text-primary-700" : "text-neutral-500"
                          }`}
                        >
                          {point.label}
                        </span>
                        <span className={`text-[10px] ${hasRevenue ? "text-primary-600 font-medium" : "text-neutral-300"}`}>
                          {hasRevenue ? formatCurrency(revenueValue) : "—"}
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
                  Devis validés — {activeMonth?.label} {activeMonth?.year}
                </span>
                <span className="text-neutral-600 font-medium">
                  {activeDevis.length > 0
                    ? `${activeDevis.length} devis · ${formatCurrency(activeDevis.reduce((s, q) => s + (q.totalTtc ?? 0), 0))}`
                    : "Aucun devis validé ce mois"}
                </span>
              </div>
              {activeDevis.length > 0 && (
                <div className="mt-3 space-y-2">
                  {activeDevis.map((quote) => {
                    const projectName = projects.find((p) => p.id === quote.projectId)?.name ?? null;
                    return (
                      <div key={quote.id} className="rounded-lg border border-primary-100/70 bg-white px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-900 truncate">
                            {projectName ?? quote.clientName ?? quote.title}
                          </p>
                          {quote.clientName && projectName && (
                            <p className="text-xs text-neutral-500 truncate">{quote.clientName}</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-primary-700 flex-shrink-0">
                          {typeof quote.totalTtc === "number" ? formatCurrency(quote.totalTtc) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-white" />
          <CardHeader className="relative z-10 border-neutral-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">À venir</p>
                <p className="text-lg font-semibold text-neutral-900">Prochaines tâches</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-primary-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            {tasksLoading && upcomingItems.length === 0 ? (
              <p className="text-sm text-neutral-400 py-4 text-center">Chargement...</p>
            ) : tasksError ? (
              <p className="text-xs text-red-500 py-4 text-center">{tasksError}</p>
            ) : upcomingItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <FolderOpen className="w-8 h-8 text-neutral-200" />
                <p className="text-sm text-neutral-400">Aucun élément à venir</p>
                <p className="text-xs text-neutral-300">Tâches et interventions planifiées apparaîtront ici</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {upcomingItems.map((item) => {
                  const projectName = projects.find((p) => p.id === item.project_id)?.name ?? null;
                  const itemDate = item.date ? new Date(`${item.date}T00:00:00`) : null;
                  const todayMs = new Date(); todayMs.setHours(0, 0, 0, 0);
                  const diffDays = itemDate
                    ? Math.ceil((itemDate.getTime() - todayMs.getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  const isUrgent = diffDays !== null && diffDays <= 3;
                  const isToday = diffDays === 0;
                  return (
                    <li key={`${item.kind}-${item.id}`} className="flex items-start gap-3 rounded-lg border border-neutral-100 bg-neutral-50/60 px-3 py-2.5">
                      <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${isUrgent ? "bg-red-400" : item.kind === "intervention" ? "bg-amber-400" : item.task_type === "rdv" ? "bg-violet-400" : "bg-primary-400"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900 truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {projectName && <p className="text-xs text-neutral-500 truncate">{projectName}</p>}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium ${item.kind === "intervention" ? "bg-amber-50 text-amber-700" : item.task_type === "rdv" ? "bg-violet-50 text-violet-700" : "bg-primary-50 text-primary-700"}`}>
                            {item.kind === "intervention" ? "Lot" : item.task_type === "rdv" ? "RDV" : "Tâche"}
                          </span>
                        </div>
                        {item.task_type === "rdv" && item.attendees && item.attendees.length > 0 && (
                          <div className="flex items-center mt-1.5 -space-x-1.5">
                            {item.attendees.slice(0, 4).map((uid) => {
                              const profile = attendeeProfiles.get(uid);
                              const name = profile?.full_name ?? uid;
                              const initials = name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
                              const colors = ["from-primary-400 to-primary-600", "from-violet-400 to-violet-600", "from-emerald-400 to-emerald-600", "from-amber-400 to-amber-600"];
                              const color = colors[item.attendees!.indexOf(uid) % colors.length];
                              return profile?.avatar_url ? (
                                <img key={uid} src={profile.avatar_url} alt={name} title={name} className="h-5 w-5 rounded-full object-cover ring-1 ring-white" />
                              ) : (
                                <div key={uid} title={name} className={`h-5 w-5 rounded-full ring-1 ring-white bg-gradient-to-br ${color} flex items-center justify-center text-[9px] font-semibold text-white`}>
                                  {initials}
                                </div>
                              );
                            })}
                            {item.attendees.length > 4 && (
                              <div className="h-5 w-5 rounded-full ring-1 ring-white bg-neutral-200 flex items-center justify-center text-[9px] font-medium text-neutral-600">
                                +{item.attendees.length - 4}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {itemDate && (
                        <span className={`text-[10px] font-semibold flex-shrink-0 px-2 py-0.5 rounded-full ${
                          isToday ? "bg-red-100 text-red-700"
                          : isUrgent ? "bg-amber-100 text-amber-700"
                          : "bg-neutral-100 text-neutral-600"
                        }`}>
                          {isToday ? "Aujourd'hui" : diffDays === 1 ? "Demain" : `J+${diffDays}`}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-white" />
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
                  {projects.slice(0, projectsExpanded ? undefined : 2).map((project) => {
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
              {projects.length > 2 && (
                <button
                  onClick={() => setProjectsExpanded((v) => !v)}
                  className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 text-sm text-neutral-500 hover:text-primary-600 hover:bg-neutral-50 rounded-lg transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${projectsExpanded ? "rotate-180" : ""}`} />
                  {projectsExpanded ? "Voir moins" : `Voir ${projects.length - 2} de plus`}
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-white" />
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
              {quotes.slice(0, devisExpanded ? undefined : 2).map((quote) => {
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
          {quotes.length > 2 && (
            <button
              onClick={() => setDevisExpanded((v) => !v)}
              className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 text-sm text-neutral-500 hover:text-primary-600 hover:bg-neutral-50 rounded-lg transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${devisExpanded ? "rotate-180" : ""}`} />
              {devisExpanded ? "Voir moins" : `Voir ${quotes.length - 2} de plus`}
            </button>
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

  const questionnaireFields = getQuestionnaireFields(formData.projectType ?? "");
  const needsSurface = ["renovation", "construction", "extension", "peinture", "carrelage", "toiture"].includes(formData.projectType ?? "");

  const handleOpenProject = (projectId: string) => {
    const roleParam = user?.role === "professionnel" ? "professionnel" : "particulier";
    router.push(`/dashboard/projets/${projectId}?role=${roleParam}`);
  };

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-white" />
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
                  value={formData.projectType ?? ""}
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
                value={formData.name ?? ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex. Rénovation cuisine"
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="Adresse du chantier *"
                    value={formData.address ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="Numéro et rue"
                    required
                  />
                </div>
                <div>
                  <Input
                    label="Code postal *"
                    value={formData.postalCode ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="75001"
                    required
                  />
                </div>
              </div>
              <Input
                label="Ville *"
                value={formData.city ?? ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="Paris"
                required
              />
              {formData.projectType !== "autre" && (
                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1">Description détaillée *</label>
                  <textarea
                    value={formData.description ?? ""}
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
                  value={formData.surfaceSqmStr ?? ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, surfaceSqmStr: e.target.value }))}
                  placeholder="Ex. 25"
                  required
                />
              )}
              <Input
                label="Budget (€) *"
                type="number"
                min={0}
                value={formData.budgetStr ?? ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, budgetStr: e.target.value }))}
                placeholder="Ex. 10000"
                required
              />
              <Input
                label="Date de début souhaitée *"
                type="date"
                value={formData.desiredStartDate ?? ""}
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
