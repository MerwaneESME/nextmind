"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import ChatBox from "@/components/chat/ChatBox";
import { ChatWindow } from "@/components/chat/ChatWindow";
import DocumentsList from "@/components/documents/DocumentsList";
import Breadcrumb from "@/components/ui/Breadcrumb";
import LotBudgetPanel from "@/components/lot/LotBudgetPanel";
import StatCard from "@/components/ui/StatCard";
import ProgressBar from "@/components/ui/ProgressBar";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { canEditLot } from "@/lib/accessControl";
import { getMyPhaseMembership } from "@/lib/phaseMembersDb";
import { fetchLotTasks, createLotTask, updateLotTask, deleteLotTask, type LotTask } from "@/lib/lotTasksDb";
import { getLotById, type LotRow } from "@/lib/lotsDb";
import { getPhaseById, type PhaseRow } from "@/lib/phasesDb";
import { supabase } from "@/lib/supabaseClient";

type ProjectLite = { id: string; created_by: string | null; name: string | null };

type TabKey = "overview" | "taches" | "chat" | "budget" | "documents" | "planning" | "assistant";

const tabItems: Array<{ key: TabKey; label: string; iconSrc: string }> = [
  { key: "overview", label: "Aperçu", iconSrc: "/images/grey/eye.png" },
  { key: "taches", label: "Tâches", iconSrc: "/images/grey/files.png" },
  { key: "chat", label: "Chat", iconSrc: "/images/grey/chat-teardrop-dots.png" },
  { key: "budget", label: "Budget", iconSrc: "/images/grey/files.png" },
  { key: "documents", label: "Documents", iconSrc: "/images/grey/files.png" },
  { key: "planning", label: "Planning", iconSrc: "/images/grey/calendar%20(1).png" },
  { key: "assistant", label: "Assistant IA", iconSrc: "/images/grey/robot.png" },
];

export default function LotPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const roleParam = searchParams.get("role");
  const tabParam = searchParams.get("tab");
  const role = roleParam === "professionnel" ? "professionnel" : "particulier";

  const projectId = typeof params.id === "string" ? params.id : "";
  const phaseId = typeof params.phaseId === "string" ? params.phaseId : "";
  const lotId = typeof params.lotId === "string" ? params.lotId : "";

  const [project, setProject] = useState<ProjectLite | null>(null);
  const [phase, setPhase] = useState<PhaseRow | null>(null);
  const [lot, setLot] = useState<LotRow | null>(null);
  const [tasks, setTasks] = useState<LotTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [membership, setMembership] = useState<any>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<string | null>(null);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", dueDate: "", description: "" });

  const canEditThisLot = useMemo(() => {
    return canEditLot({ projectMemberRole, phaseMembership: membership, lotId });
  }, [projectMemberRole, membership, lotId]);

  const isTabKey = (value: string | null): value is TabKey =>
    !!value && tabItems.some((tab) => tab.key === value);

  const [activeTab, setActiveTab] = useState<TabKey>(() => (isTabKey(tabParam) ? tabParam : "overview"));

  useEffect(() => {
    if (!isTabKey(tabParam)) return;
    if (tabParam === activeTab) return;
    setActiveTab(tabParam);
  }, [tabParam, activeTab]);

  const updateQuery = (patch: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.replace(
      `/dashboard/projets/${projectId}/phases/${phaseId}/lots/${lotId}?${next.toString()}`,
      { scroll: false }
    );
  };

  const progress = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [tasks]);

  const load = async () => {
    if (!user?.id || !projectId || !phaseId || !lotId) return;
    setLoading(true);
    setError(null);
    try {
      const [projectRes, memberRes, phaseRow, lotRow, taskRows, myMembership] = await Promise.all([
        supabase.from("projects").select("id,created_by,name").eq("id", projectId).maybeSingle(),
        supabase
          .from("project_members")
          .select("role,status")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle(),
        getPhaseById(phaseId),
        getLotById(lotId),
        fetchLotTasks(lotId),
        getMyPhaseMembership(phaseId, user.id),
      ]);

      if (projectRes.error) throw projectRes.error;
      if (memberRes.error) throw memberRes.error;

      setProject((projectRes.data as any) ?? null);
      const rawRole = (memberRes.data as any)?.role ?? null;
      const rawStatus = (memberRes.data as any)?.status ?? null;
      const normalizedStatus = String(rawStatus ?? "").toLowerCase();
      const isAccepted = normalizedStatus === "accepted" || normalizedStatus === "active";
      setProjectMemberRole(isAccepted ? rawRole : null);
      setMembership(myMembership);
      setPhase(phaseRow);
      setLot(lotRow);
      setTasks(taskRows);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger le lot.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id, projectId, phaseId, lotId]);

  const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEditThisLot) {
      setError("Accès refusé: vous ne pouvez pas ajouter une tâche.");
      return;
    }
    if (!taskForm.title.trim()) return;
    setTaskSubmitting(true);
    setError(null);
    try {
      await createLotTask(lotId, {
        title: taskForm.title,
        dueDate: taskForm.dueDate || null,
        description: taskForm.description,
        status: "todo",
        orderIndex: tasks.length,
      });
      setTaskForm({ title: "", dueDate: "", description: "" });
      setTaskModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de créer la tâche.");
    } finally {
      setTaskSubmitting(false);
    }
  };

  const toggleTask = async (task: LotTask) => {
    if (!canEditThisLot) return;
    const next = task.status === "done" ? "todo" : "done";
    try {
      await updateLotTask(task.id, { status: next });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de mettre à jour la tâche.");
    }
  };

  const removeTask = async (task: LotTask) => {
    if (!canEditThisLot) return;
    try {
      await deleteLotTask(task.id);
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de supprimer la tâche.");
    }
  };

  if (!projectId || !phaseId || !lotId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Lot introuvable.</p>
        <Button variant="outline" onClick={() => router.push(`/dashboard/projets?role=${role}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Breadcrumb
          items={[
            { label: "Projets", href: `/dashboard/projets?role=${role}` },
            { label: project?.name ?? "Projet", href: `/dashboard/projets/${projectId}?role=${role}&tab=phases` },
            { label: `Phase: ${phase?.name ?? phaseId}`, href: `/dashboard/projets/${projectId}/phases/${phaseId}?role=${role}` },
            { label: `Lot: ${lot?.name ?? lotId}` },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">
              Projet: {project?.name ?? projectId} • Phase: {phase?.name ?? phaseId}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Lot: {lot?.name ?? lotId}</h1>
            <p className="text-gray-600">{lot?.company_name ? `Entreprise: ${lot.company_name}` : "Entreprise: -"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/projets/${projectId}/phases/${phaseId}?role=${role}`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour phase
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(
                  `/dashboard/projets/${projectId}/phases/${phaseId}/lots/${lotId}?role=${role}&tab=assistant`
                )
              }
            >
              Assistant IA
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/dashboard/projets/${projectId}/phases/${phaseId}/lots/${lotId}?role=${role}&tab=budget`)
              }
            >
              Budget détaillé
            </Button>
            {canEditThisLot && activeTab === "taches" && (
              <Button size="sm" onClick={() => setTaskModalOpen(true)}>
                + Ajouter tâche
              </Button>
            )}
          </div>
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </header>

      <nav className="sticky top-3 z-30" aria-label="Navigation du lot">
        <div className="flex flex-wrap gap-1 rounded-2xl border border-neutral-200 bg-white/70 p-1 shadow-[0_18px_55px_-45px_rgba(0,0,0,0.35)] backdrop-blur">
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.key;
            const isAssistant = tab.key === "assistant";

            return (
              <button
                key={tab.key}
                type="button"
                aria-current={isActive ? "page" : undefined}
                className={[
                  "group inline-flex items-center gap-2 whitespace-nowrap",
                  "rounded-xl px-3 py-2 text-sm font-medium",
                  "transition duration-200 ease-out transform-gpu",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                  isActive
                    ? "bg-primary-600 text-white shadow-[0_16px_40px_-28px_rgba(24,0,173,0.45)]"
                    : "text-neutral-700 hover:bg-white hover:text-neutral-900",
                  !isActive ? "hover:-translate-y-[1px]" : "",
                ].join(" ")}
                onClick={() => {
                  setActiveTab(tab.key);
                  updateQuery({ tab: tab.key });
                }}
              >
                <img
                  src={tab.iconSrc}
                  alt=""
                  aria-hidden
                  className={`w-4 h-4 object-contain transition ${isActive ? "brightness-0 invert" : "logo-blend group-hover:scale-[1.02]"}`}
                />
                <span className="text-inherit">{tab.label}</span>
                {isActive && isAssistant ? (
                  <span
                    aria-hidden
                    className="ml-1 inline-flex h-2 w-2 rounded-full bg-primary-200 shadow-[0_0_0_3px_rgba(24,0,173,0.18)]"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {loading ? (
        <div className="text-sm text-gray-500">Chargement...</div>
      ) : (
        <>
          {activeTab === "overview" && (
            <>
              <section className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                      icon="📊"
                      iconBg="bg-green-50"
                      label="Avancement"
                      value={`${progress.pct}%`}
                      subtitle={`${progress.done}/${progress.total} tâches`}
                    />
                    <StatCard
                      icon="💰"
                      iconBg="bg-blue-50"
                      label="Budget"
                      value={formatCurrency(Number(lot?.budget_actual ?? 0))}
                      subtitle={`/ ${formatCurrency(Number(lot?.budget_estimated ?? 0))}`}
                    />
                    <StatCard
                      icon="📅"
                      iconBg="bg-purple-50"
                      label="Dates"
                      value={lot?.start_date ? formatDate(lot!.start_date!) : "Non défini"}
                      subtitle={lot?.end_date ? `→ ${formatDate(lot!.end_date!)}` : ""}
                    />
                  </div>

                  <Card>
                    <CardHeader>
                      <div className="font-semibold text-gray-900">Progression</div>
                      <div className="text-sm text-gray-500">Synthèse du lot.</div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ProgressBar percentage={progress.pct} showLabel />
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => updateQuery({ tab: "taches" })}>
                          Voir les tâches
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => updateQuery({ tab: "chat" })}>
                          Ouvrir le chat
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => updateQuery({ tab: "documents" })}>
                          Documents
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => updateQuery({ tab: "budget" })}>
                          Budget
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="font-semibold text-gray-900">Documents (lot)</div>
                      <div className="text-sm text-gray-500">Fichiers rattachés au lot.</div>
                    </CardHeader>
                    <CardContent className="h-[360px] overflow-auto">
                      <DocumentsList context={{ lotId }} title="Documents (lot)" showUpload={canEditThisLot} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="font-semibold text-gray-900">Accès</div>
                      <div className="text-sm text-gray-500">Cloisonnement des échanges.</div>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-700 space-y-2">
                      <div>💬 Chat privé au lot (chef + entreprise assignée).</div>
                      <div>💰 Budget (devis + factures) rattaché au lot.</div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              </section>

            {false && (
            <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-blue-200 bg-blue-50/20">
              <CardHeader className="border-b border-blue-100 bg-blue-50/60">
                <div className="text-sm text-gray-600">Progression</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">
                {progress.pct}% <span className="text-sm text-gray-500 font-normal">({progress.done}/{progress.total})</span>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-200 bg-emerald-50/20">
              <CardHeader className="border-b border-emerald-100 bg-emerald-50/60">
                <div className="text-sm text-gray-600">Budget</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">
                {formatCurrency(Number(lot?.budget_actual ?? 0))} / {formatCurrency(Number(lot?.budget_estimated ?? 0))}
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-slate-200 bg-slate-50/30">
              <CardHeader className="border-b border-slate-100 bg-slate-50/60">
                <div className="text-sm text-gray-600">Dates</div>
              </CardHeader>
              <CardContent className="text-sm text-gray-800">
                {lot?.start_date ? formatDate(lot!.start_date!) : "-"} → {lot?.end_date ? formatDate(lot!.end_date!) : "-"}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Checklist</div>
              <div className="text-sm text-gray-500">Tâches du lot (todo / en cours / done).</div>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.length === 0 ? (
                <div className="text-sm text-gray-500">Aucune tâche pour le moment.</div>
              ) : (
                tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{t.title}</div>
                      <div className="text-xs text-gray-500">
                        Statut: {t.status}
                        {t.dueDate ? ` • Échéance: ${formatDate(t.dueDate)}` : ""}
                      </div>
                      {t.description && <div className="text-xs text-gray-500 mt-1">{t.description}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canEditThisLot}
                        onClick={() => void toggleTask(t)}
                      >
                        {t.status === "done" ? "Réouvrir" : "Terminer"}
                      </Button>
                      {canEditThisLot && (
                        <Button variant="outline" size="sm" className="border-red-200 text-red-600" onClick={() => void removeTask(t)}>
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <ChatBox context={{ lotId }} title="Discussion (lot)" />
            <DocumentsList context={{ lotId }} title="Documents (lot)" showUpload={canEditThisLot} />
          </div>
        </section>
            )}
            </>
          )}

          {activeTab === "taches" && (
            <section className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="font-semibold text-gray-900">Checklist</div>
                  <div className="text-sm text-gray-500">Tâches du lot (todo / en cours / done).</div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasks.length === 0 ? (
                    <div className="text-sm text-gray-500">Aucune tâche pour le moment.</div>
                  ) : (
                    tasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{t.title}</div>
                          <div className="text-xs text-gray-500">
                            Statut: {t.status}
                            {t.dueDate ? ` • Échéance: ${formatDate(t.dueDate)}` : ""}
                          </div>
                          {t.description && <div className="text-xs text-gray-500 mt-1">{t.description}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canEditThisLot}
                            onClick={() => void toggleTask(t)}
                          >
                            {t.status === "done" ? "Réouvrir" : "Terminer"}
                          </Button>
                          {canEditThisLot && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-600"
                              onClick={() => void removeTask(t)}
                            >
                              Supprimer
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {activeTab === "chat" && (
            <section className="space-y-3">
              <div className="h-[60vh]">
                <ChatBox context={{ lotId }} title="Discussion (lot)" />
              </div>
              <div className="rounded-lg border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                Cette discussion est privée à ce lot (chef de projet + entreprise assignée).
              </div>
            </section>
          )}

          {activeTab === "budget" && (
            <LotBudgetPanel projectId={projectId} phaseId={phaseId} lotId={lotId} role={role} />
          )}

          {activeTab === "documents" && (
            <section className="h-[60vh]">
              <DocumentsList context={{ lotId }} title="Documents (lot)" showUpload={canEditThisLot} />
            </section>
          )}

          {activeTab === "planning" && (
            <section className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="font-semibold text-gray-900">Planning</div>
                  <div className="text-sm text-gray-500">Dates et échéances du lot.</div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-gray-700">
                  <div>
                    <span className="text-gray-500">Période:</span>{" "}
                    {lot?.start_date ? formatDate(lot!.start_date!) : "-"} → {lot?.end_date ? formatDate(lot!.end_date!) : "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">Progression:</span> {progress.pct}% ({progress.done}/{progress.total})
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-primary-600" style={{ width: `${progress.pct}%` }} />
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {activeTab === "assistant" && (
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
              <Card className="h-[60vh]">
                <CardContent className="p-0 h-full">
                  <div className="h-full">
                    <ChatWindow
                      userRole={user?.role ?? role}
                      userId={user?.id ?? "demo-user"}
                      projectId={projectId}
                      phaseId={phaseId}
                      lotId={lotId}
                      contextType="lot"
                      autoScroll={false}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card className="h-fit self-start">
                <CardHeader>
                  <div className="text-lg font-semibold text-neutral-900">Contexte lot</div>
                  <div className="text-sm text-neutral-600">L’assistant utilise le scope du lot.</div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-neutral-700">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                    Génère une checklist de contrôle qualité pour ce lot.
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                    Propose un ordre d’exécution et points de coordination.
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}

      {taskModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-lg w-full p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Nouvelle tâche</h3>
                <p className="text-sm text-neutral-600">Ajoutez une tâche à la checklist du lot.</p>
              </div>
              <Button variant="ghost" onClick={() => setTaskModalOpen(false)}>
                Fermer
              </Button>
            </div>
            <form className="space-y-4" onSubmit={handleCreateTask}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Titre *</label>
                <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Échéance</label>
                  <Input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    placeholder="Optionnel"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTaskModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={taskSubmitting}>
                  {taskSubmitting ? "Création..." : "Créer la tâche"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
