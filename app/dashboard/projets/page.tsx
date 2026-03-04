"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Plus, Search, FolderOpen, Clock, Layers } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import ProgressBar from "@/components/ui/ProgressBar";
import EmptyState from "@/components/ui/EmptyState";
import {
  createProject,
  fetchProjectsForUser,
  inviteProjectMemberByEmail,
  ProjectSummary,
} from "@/lib/projectsDb";

type StatusKey = "draft" | "en_cours" | "termine" | "en_attente";

const resolveStatusKey = (status: string | null): StatusKey => {
  if (!status) return "draft";
  const normalized = status.toLowerCase();
  if (["draft", "a_faire"].includes(normalized)) return "draft";
  if (["en_cours", "in_progress", "active"].includes(normalized)) return "en_cours";
  if (["termine", "completed", "done"].includes(normalized)) return "termine";
  if (["en_attente", "pending"].includes(normalized)) return "en_attente";
  return "en_attente";
};

const statusConfig: Record<StatusKey, { label: string; dot: string; badge: string; accent: string }> = {
  draft:      { label: "À faire",    dot: "bg-neutral-400", badge: "bg-neutral-50 text-neutral-600 border border-neutral-200",  accent: "bg-neutral-300" },
  en_cours:   { label: "En cours",   dot: "bg-primary-500", badge: "bg-primary-50 text-primary-700 border border-primary-200",  accent: "bg-primary-500" },
  termine:    { label: "Terminé",    dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",  accent: "bg-emerald-500" },
  en_attente: { label: "En attente", dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border border-amber-200",       accent: "bg-amber-500"  },
};

const getProgressPercent = (status: StatusKey) => {
  if (status === "termine") return 100;
  if (status === "en_cours") return 55;
  if (status === "en_attente") return 25;
  return 10;
};

const FIELD_CLASS =
  "w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all";

export default function ProjetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const roleParam = searchParams.get("role");
  const role = user?.role ?? (roleParam === "professionnel" ? "professionnel" : "particulier");
  const canCreateProject = role === "professionnel";

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | StatusKey>("all");
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", projectType: "", address: "", city: "", description: "", clientEmail: "",
  });

  const loadProjects = async (silent = false) => {
    if (!user?.id) return;
    if (!silent) { setLoading(true); setError(null); }
    try {
      setProjects(await fetchProjectsForUser(user.id));
    } catch (err: any) {
      if (!silent) setError(err?.message ?? "Impossible de charger les projets.");
      setProjects([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { void loadProjects(); }, [user?.id]);
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => void loadProjects(true), 20000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((p) => {
      const sk = resolveStatusKey(p.status);
      return (filter === "all" || sk === filter) &&
        (!query || p.name.toLowerCase().includes(query) || (p.description ?? "").toLowerCase().includes(query));
    });
  }, [projects, search, filter]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreateProject || !user?.id || !form.name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const projectId = await createProject(user.id, {
        name: form.name, projectType: form.projectType,
        address: form.address, city: form.city, description: form.description,
      });
      if (form.clientEmail.trim()) {
        await inviteProjectMemberByEmail(user.id, projectId, form.clientEmail.trim(), "client");
      }
      setForm({ name: "", projectType: "", address: "", city: "", description: "", clientEmail: "" });
      setIsCreating(false);
      await loadProjects();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de créer le projet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpen = (projectId: string) =>
    router.push(`/dashboard/projets/${projectId}?role=${role}`);

  // Status counts for filter pills
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length };
    projects.forEach((p) => {
      const sk = resolveStatusKey(p.status);
      c[sk] = (c[sk] ?? 0) + 1;
    });
    return c;
  }, [projects]);

  return (
    <div className="space-y-6">
      {/* ── Page header banner ── */}
      <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
        <div className="relative flex items-start justify-between gap-6 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <FolderOpen className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Projets</h1>
              <p className="text-neutral-600 mt-1">Gérez tous vos projets BTP</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
                  {projects.length} projet{projects.length !== 1 ? "s" : ""}
                </span>
                {(counts.en_cours ?? 0) > 0 && (
                  <span className="rounded-full border border-primary-200 bg-primary-50 text-primary-700 px-3 py-1">
                    {counts.en_cours} en cours
                  </span>
                )}
                {(counts.termine ?? 0) > 0 && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1">
                    {counts.termine} terminé{counts.termine !== 1 ? "s" : ""}
                  </span>
                )}
                {(counts.en_attente ?? 0) > 0 && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 text-amber-700 px-3 py-1">
                    {counts.en_attente} en attente
                  </span>
                )}
                {canCreateProject && (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-primary-400 to-primary-600 text-white font-semibold text-xs shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-3 h-3" />
                    Nouveau projet
                  </button>
                )}
              </div>
            </div>
          </div>
          <img
            src="/images/projet1.png"
            alt="Projets"
            className="hidden sm:block h-20 w-20 object-contain opacity-90 logo-blend flex-shrink-0"
          />
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}
      {!canCreateProject && (
        <div className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-primary-700 text-sm">
          Les particuliers peuvent consulter les projets partagés, mais seuls les professionnels peuvent en créer.
        </div>
      )}

      {/* ── Search + Filter bar ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher un projet..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all bg-neutral-50 focus:bg-white"
              />
            </div>
            {/* Filter pills */}
            <div className="flex items-center gap-1.5 bg-neutral-100/60 rounded-lg p-1">
              {([
                { key: "all", label: "Tous" },
                { key: "en_cours", label: "En cours" },
                { key: "en_attente", label: "En attente" },
                { key: "draft", label: "À faire" },
                { key: "termine", label: "Terminé" },
              ] as { key: "all" | StatusKey; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    filter === key
                      ? "bg-white shadow-sm text-primary-600"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  {label}
                  {counts[key] !== undefined && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      filter === key ? "bg-primary-100 text-primary-600" : "bg-neutral-200 text-neutral-500"
                    }`}>
                      {counts[key]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Project list ── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-neutral-900">
              Liste des projets
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                {filteredProjects.length}
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32 text-sm text-neutral-400">
              Chargement des projets...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-8">
              <EmptyState
                icon=""
                title="Aucun projet pour le moment"
                description={
                  canCreateProject
                    ? "Créez votre premier projet BTP pour commencer à gérer vos chantiers."
                    : "Aucun projet ne vous a encore été partagé."
                }
                action={canCreateProject ? { label: "+ Créer un projet", onClick: () => setIsCreating(true) } : undefined}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.map((project) => {
                const sk = resolveStatusKey(project.status);
                return (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    statusKey={sk}
                    progress={getProgressPercent(sk)}
                    onOpen={() => handleOpen(project.id)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create project modal ── */}
      {isCreating && canCreateProject && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-100 max-w-xl w-full p-6">
            {/* Modal header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center">
                <FolderOpen className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900">Créer un projet</h3>
                <p className="text-xs text-neutral-500">Remplissez les informations du chantier</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Nom du projet *
                  </label>
                  <input
                    className={FIELD_CLASS}
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Rénovation appartement"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Type de chantier
                  </label>
                  <input
                    className={FIELD_CLASS}
                    value={form.projectType}
                    onChange={(e) => setForm((p) => ({ ...p, projectType: e.target.value }))}
                    placeholder="Rénovation / Électricité..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Email client (optionnel)
                  </label>
                  <input
                    type="email"
                    className={FIELD_CLASS}
                    value={form.clientEmail}
                    onChange={(e) => setForm((p) => ({ ...p, clientEmail: e.target.value }))}
                    placeholder="client@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Adresse</label>
                  <input
                    className={FIELD_CLASS}
                    value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    placeholder="Adresse du chantier"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Ville</label>
                  <input
                    className={FIELD_CLASS}
                    value={form.city}
                    onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                    placeholder="Paris"
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className={`${FIELD_CLASS} resize-none`}
                    placeholder="Résumé des besoins et objectifs..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-primary-400 to-primary-600 text-white font-semibold text-sm shadow-sm hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  {isSubmitting ? "Création..." : "Créer le projet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project, statusKey, progress, onOpen,
}: {
  project: ProjectSummary;
  statusKey: StatusKey;
  progress: number;
  onOpen: () => void;
}) {
  const cfg = statusConfig[statusKey];

  return (
    <div
      className="group relative overflow-hidden rounded-xl bg-white border border-neutral-100 shadow-sm hover:shadow-md hover:border-primary-100 transition-all duration-200 cursor-pointer"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}
    >
      {/* Accent left border */}
      <div className={`absolute left-0 top-0 h-full w-1 ${cfg.accent} rounded-l-xl`} aria-hidden />

      <div className="pl-5 pr-6 py-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <h3 className="text-base font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors truncate">
                {project.name}
              </h3>
              {/* Status badge */}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold shadow-sm ${cfg.badge}`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
            {project.description && (
              <p className="text-sm text-neutral-500 line-clamp-1">{project.description}</p>
            )}
          </div>
          <span className="text-xs text-neutral-400 whitespace-nowrap flex-shrink-0">
            {project.updatedAt ? `Màj: ${formatDate(project.updatedAt)}` : ""}
          </span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-neutral-500 mb-4">
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            {project.lotsCount ?? 0} intervention{(project.lotsCount ?? 0) !== 1 ? "s" : ""}
          </span>
          {project.createdAt && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(project.createdAt)}
            </span>
          )}
        </div>

        {/* Progress */}
        <div className="mb-3">
          <ProgressBar percentage={progress} showLabel />
        </div>

        {/* Budget */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
          <span className="text-xs text-neutral-500">Budget</span>
          <span className="text-sm font-semibold text-neutral-900">
            {typeof project.budgetTotal === "number"
              ? `${project.budgetTotal.toLocaleString("fr-FR")} €`
              : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
