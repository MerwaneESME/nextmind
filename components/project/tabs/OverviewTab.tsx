import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Euro, TrendingUp, CheckCircle2, Users, Wrench, MapPin, FileText, Calendar, Clock, Pencil } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatMemberRole, formatMemberStatus } from "@/lib/memberHelpers";
import { supabase } from "@/lib/supabaseClient";

type OverviewTabProps = {
  projectId: string;
  project: any;
  role: string | null;
  members: any[];
  tasks: any[];
  interventions: any[];
  interventionsLoading: boolean;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
  hasBudget: boolean;
  totalBudget: number;
  interventionsBudgetActual: number;
  canManageProject: boolean;
  onTabChange: (tab: string) => void;
  openEditInfoModal: () => void;
  openCreateInterventionModal: () => void;
  loadProject: () => Promise<void>;
  setError: (msg: string | null) => void;
  PROJECT_STATUS_OPTIONS: readonly { value: string; label: string }[];
};

export function OverviewTab({
  projectId,
  project,
  role,
  members,
  tasks,
  interventions,
  interventionsLoading,
  totalTasks,
  completedTasks,
  progressPercent,
  hasBudget,
  totalBudget,
  interventionsBudgetActual,
  canManageProject,
  onTabChange,
  openEditInfoModal,
  openCreateInterventionModal,
  loadProject,
  setError,
  PROJECT_STATUS_OPTIONS,
}: OverviewTabProps) {
  const router = useRouter();
  const [rendezVousModalOpen, setRendezVousModalOpen] = useState(false);

  // Internal states handling project status
  const normalizeProjectStatus = (v: string | null) => {
    if (!v) return "a_faire";
    const allowed = ["a_faire", "en_attente", "en_cours", "termine"];
    if (allowed.includes(v)) return v;
    return "a_faire";
  };
  const [projectStatusValue, setProjectStatusValue] = useState(normalizeProjectStatus(project?.status ?? null));

  React.useEffect(() => {
    setProjectStatusValue(normalizeProjectStatus(project?.status ?? null));
  }, [project]);

  const handleUpdateProjectStatus = async (nextStatus: string) => {
    if (!canManageProject) return;
    setProjectStatusValue(nextStatus);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", projectId);
      if (error) throw error;
      await loadProject();
    } catch {
      setError("Impossible de mettre à jour le statut du projet.");
    }
  };

  const statusCardColorClass = useMemo(() => {
    switch (projectStatusValue) {
      case "termine":
        return {
          leftBorderColor: "#10b981",
          bg: "bg-emerald-50",
          iconBg: "bg-gradient-to-br from-emerald-100 to-emerald-50",
          iconColor: "text-emerald-700",
          selectClass: "border-emerald-200 text-emerald-700 hover:border-emerald-300",
        };
      case "en_cours":
        return {
          leftBorderColor: "#38b6ff",
          bg: "bg-sky-50",
          iconBg: "bg-gradient-to-br from-sky-100 to-sky-50",
          iconColor: "text-sky-600",
          selectClass: "border-sky-200 text-sky-700 hover:border-sky-300",
        };
      case "en_attente":
        return {
          leftBorderColor: "#fbbf24",
          bg: "bg-amber-50",
          iconBg: "bg-gradient-to-br from-amber-100 to-amber-50",
          iconColor: "text-amber-700",
          selectClass: "border-amber-200 text-amber-700 hover:border-amber-300",
        };
      default:
        return {
          leftBorderColor: "#94a3b8",
          bg: "bg-slate-50",
          iconBg: "bg-gradient-to-br from-slate-100 to-slate-50",
          iconColor: "text-slate-500",
          selectClass: "border-slate-200 text-slate-600 hover:border-slate-300",
        };
    }
  }, [projectStatusValue]);

  // Compute upcoming items
  const upcomingTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks
      .filter((task) => {
        if (task.completed_at) return false;
        const dateStr = task.start_date ?? task.end_date;
        if (!dateStr) return false;
        const d = new Date(`${dateStr}T00:00:00`);
        d.setHours(0, 0, 0, 0);
        return d >= today;
      })
      .map((task) => ({
        id: task.id,
        name: task.name,
        date: new Date(`${(task.start_date ?? task.end_date) ?? ""}T00:00:00`),
        companyName: null as string | null,
        description: task.description,
        kind: "task" as const,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [tasks]);

  const upcomingInterventions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return interventions
      .filter((lot) => {
        const dateStr = lot.startDate ?? lot.endDate;
        if (!dateStr) return false;
        const d = new Date(`${dateStr}T00:00:00`);
        d.setHours(0, 0, 0, 0);
        return d >= today;
      })
      .map((lot) => ({
        id: lot.id,
        name: lot.name,
        date: new Date(`${(lot.startDate ?? lot.endDate) ?? ""}T00:00:00`),
        companyName: lot.companyName ?? null,
        description: lot.description ?? null,
        kind: "intervention" as const,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [interventions]);

  const upcomingItems = useMemo(() => {
    const combined = [...upcomingTasks, ...upcomingInterventions];
    combined.sort((a, b) => a.date.getTime() - b.date.getTime());
    return combined;
  }, [upcomingTasks, upcomingInterventions]);

  return (
    <section className="space-y-6">
      {/* ── Stats cards ── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            key: "budget",
            label: "Budget estimé",
            value: hasBudget ? formatCurrency(totalBudget) : "—",
            extra: interventionsBudgetActual > 0 ? (
              <p className="text-xs text-neutral-500 mt-1">
                Dépensé : {formatCurrency(interventionsBudgetActual)}
              </p>
            ) : null,
            cta: interventions.length > 0 && (
              <button
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                onClick={() => onTabChange("budget")}
              >
                Voir budget →
              </button>
            ),
            colorClass: {
              leftBorderColor: "#10b981",
              bg: "bg-emerald-50",
              iconBg: "bg-gradient-to-br from-emerald-100 to-emerald-50",
              iconColor: "text-emerald-700",
            },
            icon: Euro,
          },
          {
            key: "progress",
            label: "Avancement",
            value: `${progressPercent}%`,
            extra: (
              <p className="text-xs text-neutral-500 mt-1">
                Sur {totalTasks} tâche{totalTasks !== 1 ? "s" : ""}
              </p>
            ),
            colorClass: {
              leftBorderColor: "#38b6ff",
              bg: "bg-sky-50",
              iconBg: "bg-gradient-to-br from-primary-100 to-primary-50",
              iconColor: "text-primary-600",
            },
            icon: TrendingUp,
          },
          {
            key: "status",
            label: "Statut projet",
            value: PROJECT_STATUS_OPTIONS.find((o) => o.value === projectStatusValue)?.label || "—",
            extra: (
              <p className="text-xs text-neutral-500 mt-1">
                Mis à jour : {project?.updated_at ? formatDate(project.updated_at) : "—"}
              </p>
            ),
            cta: canManageProject ? (
              <select
                className={cn(
                  "mt-2 text-xs rounded-lg border bg-white px-2 py-1 cursor-pointer transition-colors",
                  statusCardColorClass.selectClass
                )}
                value={projectStatusValue}
                onChange={(e) => void handleUpdateProjectStatus(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              >
                {PROJECT_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : null,
            colorClass: statusCardColorClass,
            icon: CheckCircle2,
          },
          {
            key: "participants",
            label: "Participants",
            value: String(members.length),
            extra: (
              <p className="text-xs text-neutral-500 mt-1">
                {members.filter((m) => formatMemberStatus(m.status).label === "Actif").length} actifs
              </p>
            ),
            colorClass: {
              leftBorderColor: "#1800ad",
              bg: "bg-violet-50",
              iconBg: "bg-gradient-to-br from-violet-100 to-violet-50",
              iconColor: "text-violet-700",
            },
            icon: Users,
          },
        ].map((stat) => (
          <div
            key={stat.key}
            className={cn(
              "relative rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-neutral-100",
              stat.colorClass.bg
            )}
            style={{ borderLeft: `3px solid ${stat.colorClass.leftBorderColor}` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-500">{stat.label}</p>
                <p className="mt-1 text-3xl font-bold text-neutral-900">{stat.value}</p>
                {stat.extra}
                {stat.cta}
              </div>
              <div
                className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0",
                  stat.colorClass.iconBg
                )}
              >
                <stat.icon className={cn("h-6 w-6", stat.colorClass.iconColor)} />
              </div>
            </div>
            {stat.key === "progress" && (
              <div className="mt-3 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Main 2-column layout ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informations */}
          <div className="rounded-xl border border-neutral-100 bg-white shadow-sm overflow-hidden card-hover">
            <div className="px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Informations</h3>
              {canManageProject && (
                <button
                  onClick={openEditInfoModal}
                  className="h-8 w-8 rounded-lg bg-neutral-100 hover:bg-primary-50 flex items-center justify-center transition-colors"
                  title="Modifier les informations"
                >
                  <Pencil className="h-4 w-4 text-neutral-500 hover:text-primary-600" />
                </button>
              )}
            </div>
            <div className="px-5 pb-5 grid sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary-100 flex-shrink-0">
                  <Wrench className="h-4 w-4 text-primary-600" />
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Type de travaux</p>
                  <p className="text-sm font-medium text-neutral-900 mt-0.5">
                    {project?.project_type || "Non défini"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary-100 flex-shrink-0">
                  <MapPin className="h-4 w-4 text-primary-600" />
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Localisation</p>
                  <p className="text-sm font-medium text-neutral-900 mt-0.5">
                    {[project?.address, project?.city].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              </div>
              {project?.description && (
                <div className="sm:col-span-2 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary-100 flex-shrink-0">
                    <FileText className="h-4 w-4 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Description</p>
                    <p className="text-sm font-medium text-neutral-900 mt-0.5 leading-relaxed">
                      {project.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Suivi des interventions */}
          <div className="rounded-xl border border-neutral-100 bg-white shadow-sm overflow-hidden card-hover">
            <div className="px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Suivi des tâches</h3>
              {interventions.length > 0 && (
                <button
                  className="text-xs text-primary-600 hover:underline"
                  onClick={() => onTabChange("interventions")}
                >
                  Voir tout →
                </button>
              )}
            </div>
            <div className="p-3 space-y-2">
              {interventionsLoading ? (
                <div className="px-4 py-6 text-sm text-neutral-500">Chargement...</div>
              ) : interventions.length === 0 ? (
                <div className="px-4 py-8 text-sm text-neutral-500 text-center">
                  Aucune intervention pour le moment.
                  {canManageProject && (
                    <div className="mt-2">
                      <Button size="sm" onClick={openCreateInterventionModal}>
                        + Nouvelle intervention
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                interventions.map((intervention) => {
                  const isDone = intervention.status === "termine" || intervention.status === "valide";
                  const isInProgress = intervention.status === "en_cours";
                  const isDevis = intervention.status === "devis_en_cours" || intervention.status === "devis_valide";
                  const statusLabel = isDone
                    ? "Terminé"
                    : isInProgress
                    ? "En cours"
                    : isDevis
                    ? "Devis"
                    : "Planifié";
                  const statusColor = isDone
                    ? "bg-success-50 text-success-700"
                    : isInProgress
                    ? "bg-primary-50 text-primary-700"
                    : isDevis
                    ? "bg-amber-50 text-amber-700"
                    : "bg-neutral-100 text-neutral-600";
                  const dotColor = isDone
                    ? "bg-success-500"
                    : isInProgress
                    ? "bg-primary-500"
                    : isDevis
                    ? "bg-amber-500"
                    : "bg-neutral-400";
                  const barGradient = isDone
                    ? "bg-gradient-to-r from-success-500 to-success-700"
                    : isInProgress
                    ? "bg-gradient-to-r from-primary-400 to-primary-600"
                    : isDevis
                    ? "bg-gradient-to-r from-amber-400 to-amber-600"
                    : "bg-neutral-300";
                  return (
                    <div
                      key={intervention.id}
                      className="px-4 py-4 rounded-xl cursor-pointer bg-white border border-neutral-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                      onClick={() =>
                        router.push(
                          `/dashboard/projets/${projectId}/interventions/${intervention.id}?role=${role}`
                        )
                      }
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="font-medium text-neutral-900 truncate">
                          {intervention.name}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0",
                            statusColor
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", dotColor)} />
                          {statusLabel}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all progress-fill", barGradient)}
                          style={{ width: `${intervention.progressPercentage}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-neutral-400">
                          {intervention.tasksDone}/{intervention.tasksTotal} tâches
                          {intervention.companyName ? ` · ${intervention.companyName}` : ""}
                        </span>
                        <span className="text-xs font-medium text-neutral-500">
                          {intervention.progressPercentage}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-6">
          {/* Prochains rendez-vous */}
          <div className="rounded-xl border border-neutral-100 bg-white shadow-sm overflow-hidden card-hover">
            <div className="px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Prochains rendez-vous</h3>
              {upcomingItems.length > 0 && (
                <button
                  className="text-xs text-primary-600 hover:underline"
                  onClick={() => setRendezVousModalOpen(true)}
                >
                  Voir tout
                </button>
              )}
            </div>
            <div className="p-3 space-y-2">
              {upcomingItems.length === 0 ? (
                <div className="px-4 py-6 text-sm text-neutral-500 text-center">
                  Aucun rendez-vous à venir.
                </div>
              ) : (
                upcomingItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-neutral-50/80 hover:bg-neutral-100/60 cursor-pointer transition-colors"
                    onClick={() => {
                      if (item.kind === "intervention") {
                        router.push(
                          `/dashboard/projets/${projectId}/interventions/${item.id}?role=${role}`
                        );
                      } else {
                        onTabChange("planning");
                      }
                    }}
                  >
                    <div className="p-2 rounded-lg bg-primary-100 flex-shrink-0">
                      <Calendar className="h-4 w-4 text-primary-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900 truncate">{item.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock className="h-3 w-3 text-neutral-400 flex-shrink-0" />
                        <span className="text-xs text-neutral-500">
                          {formatDate(item.date.toISOString().slice(0, 10))}
                          {item.companyName ? ` · ${item.companyName}` : ""}
                        </span>
                      </div>
                    </div>
                    <Badge variant="info" className="text-[10px] flex-shrink-0 gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                      {item.kind === "intervention" ? "Intervention" : "Tâche"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Membres */}
          <div className="rounded-xl border border-neutral-100 bg-white shadow-sm overflow-hidden card-hover">
            <div className="px-5 py-4 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Membres</h3>
              <span className="text-xs text-neutral-400">{members.length}</span>
            </div>
            <div className="divide-y divide-neutral-100">
              {members.length === 0 ? (
                <div className="px-5 py-6 text-sm text-neutral-500 text-center">Aucun membre.</div>
              ) : (
                members.slice(0, 5).map((member) => {
                  const roleInfo = formatMemberRole(member.role);
                  const name =
                    member.user?.full_name ||
                    member.user?.email ||
                    member.invited_email ||
                    "Invité";
                  return (
                    <div key={member.id} className="flex items-center gap-3 px-5 py-3">
                      {member.user?.avatar_url ? (
                        <img
                          src={member.user.avatar_url}
                          alt={`Avatar de ${name}`}
                          className="h-8 w-8 rounded-full object-cover flex-shrink-0 border border-white/40 shadow-sm"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-primary-500">
                            {name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900 truncate">{name}</p>
                        <p className="text-xs text-neutral-500">{roleInfo.label}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {rendezVousModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-2xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 p-6 border-b border-neutral-200">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Tous les rendez-vous à venir</h3>
                <p className="text-sm text-neutral-600">
                  Liste de toutes les interventions planifiées.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setRendezVousModalOpen(false)}>
                Fermer
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {upcomingItems.length === 0 ? (
                <div className="text-sm text-gray-500">Aucun rendez-vous à venir.</div>
              ) : (
                upcomingItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => {
                      setRendezVousModalOpen(false);
                      if (item.kind === "intervention") {
                        router.push(`/dashboard/projets/${projectId}/interventions/${item.id}?role=${role}`);
                      } else {
                        onTabChange("planning");
                      }
                    }}
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(item.date.toISOString().slice(0, 10))}
                        {item.companyName ? ` • ${item.companyName}` : ""}
                      </div>
                      {item.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRendezVousModalOpen(false);
                        if (item.kind === "intervention") {
                          router.push(`/dashboard/projets/${projectId}/interventions/${item.id}?role=${role}`);
                        } else {
                          onTabChange("planning");
                        }
                      }}
                    >
                      {item.kind === "intervention" ? "Voir intervention" : "Voir dans le planning"}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
