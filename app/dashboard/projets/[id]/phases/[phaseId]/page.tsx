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
import StatCard from "@/components/ui/StatCard";
import PhaseDevisPanel from "@/components/phase/PhaseDevisPanel";
import PhaseLotsList from "@/components/phase/PhaseLotsList";
import PhaseMembersPanel from "@/components/phase/PhaseMembersPanel";
import PhasePlanningPanel from "@/components/phase/PhasePlanningPanel";
import { TermsSearch } from "@/components/TermsSearch";
import { DelaisTypesList } from "@/components/guide/DelaisTypesList";
import { PointsAttentionList } from "@/components/guide/PointsAttentionList";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { canEditPhase } from "@/lib/accessControl";
import { getMyPhaseMembership } from "@/lib/phaseMembersDb";
import { createLot, fetchLotsForPhase, type LotSummary } from "@/lib/lotsDb";
import { getPhaseById, type PhaseRow } from "@/lib/phasesDb";
import { supabase } from "@/lib/supabaseClient";

type ProjectLite = { id: string; created_by: string | null; name: string | null };

type TabKey =
  | "overview"
  | "lots"
  | "chat"
  | "devis"
  | "documents"
  | "planning"
  | "membres"
  | "assistant"
  | "guide";

const tabItems: Array<{ key: TabKey; label: string; iconSrc: string }> = [
  { key: "overview", label: "Aperçu", iconSrc: "/images/grey/eye.png" },
  { key: "lots", label: "Lots", iconSrc: "/images/grey/files.png" },
  { key: "chat", label: "Chat", iconSrc: "/images/grey/chat-teardrop-dots.png" },
  { key: "devis", label: "Devis", iconSrc: "/images/grey/files.png" },
  { key: "documents", label: "Documents", iconSrc: "/images/grey/files.png" },
  { key: "planning", label: "Planning", iconSrc: "/images/grey/calendar%20(1).png" },
  { key: "membres", label: "Membres", iconSrc: "/images/grey/users-three%20(1).png" },
  { key: "assistant", label: "Assistant IA", iconSrc: "/images/grey/robot.png" },
  { key: "guide", label: "Guide", iconSrc: "/images/clipboard-text.png" },
];

export default function PhasePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const roleParam = searchParams.get("role");
  const tabParam = searchParams.get("tab");
  const role = roleParam === "professionnel" ? "professionnel" : "particulier";

  const projectId = typeof params.id === "string" ? params.id : "";
  const phaseId = typeof params.phaseId === "string" ? params.phaseId : "";

  const [project, setProject] = useState<ProjectLite | null>(null);
  const [phase, setPhase] = useState<PhaseRow | null>(null);
  const [lots, setLots] = useState<LotSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [membership, setMembership] = useState<any>(null);
  const [projectMemberRole, setProjectMemberRole] = useState<string | null>(null);

  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [lotSubmitting, setLotSubmitting] = useState(false);
  const [lotForm, setLotForm] = useState({
    name: "",
    lotType: "",
    companyName: "",
    budgetEstimated: "",
    startDate: "",
    endDate: "",
    description: "",
  });

  const canEditThisPhase = useMemo(() => {
    return canEditPhase({ projectMemberRole, phaseMembership: membership });
  }, [projectMemberRole, membership]);

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
    router.replace(`/dashboard/projets/${projectId}/phases/${phaseId}?${next.toString()}`, { scroll: false });
  };

  const load = async () => {
    if (!user?.id || !projectId || !phaseId) return;
    setLoading(true);
    setError(null);
    try {
      const [projectRes, memberRes, phaseRow, lotsRows, myMembership] = await Promise.all([
        supabase.from("projects").select("id,created_by,name").eq("id", projectId).maybeSingle(),
        supabase
          .from("project_members")
          .select("role,status")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle(),
        getPhaseById(phaseId),
        fetchLotsForPhase(phaseId),
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
      setLots(lotsRows);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger la phase.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id, projectId, phaseId]);

  const handleCreateLot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEditThisPhase) {
      setError("Accès refusé: vous ne pouvez pas créer un lot.");
      return;
    }
    if (!phaseId || !lotForm.name.trim()) return;
    setLotSubmitting(true);
    setError(null);
    try {
      await createLot(phaseId, {
        name: lotForm.name,
        lotType: lotForm.lotType || null,
        companyName: lotForm.companyName || null,
        budgetEstimated: lotForm.budgetEstimated ? Number(lotForm.budgetEstimated) : 0,
        startDate: lotForm.startDate || null,
        endDate: lotForm.endDate || null,
        description: lotForm.description,
        status: "planifie",
      });
      setLotForm({
        name: "",
        lotType: "",
        companyName: "",
        budgetEstimated: "",
        startDate: "",
        endDate: "",
        description: "",
      });
      setLotModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de créer le lot.");
    } finally {
      setLotSubmitting(false);
    }
  };

  if (!projectId || !phaseId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Phase introuvable.</p>
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
            { label: `Phase: ${phase?.name ?? phaseId}` },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">
              Projet: {project?.name ?? projectId}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Phase: {phase?.name ?? phaseId}
            </h1>
            {phase?.description && <p className="text-gray-600">{phase.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/projets/${projectId}?role=${role}&tab=phases`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour projet
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveTab("assistant");
                updateQuery({ tab: "assistant" });
              }}
            >
              Assistant IA
            </Button>
            {canEditThisPhase && activeTab === "lots" && (
              <Button size="sm" onClick={() => setLotModalOpen(true)}>
                + Ajouter un lot
              </Button>
            )}
          </div>
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </header>

      <nav className="sticky top-3 z-30" aria-label="Navigation de la phase">
        <div className="flex flex-wrap gap-1 rounded-2xl border border-neutral-200 bg-white/70 p-1 shadow-[0_18px_55px_-45px_rgba(0,0,0,0.35)] backdrop-blur">
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.key;
            const isGuideOrAssistant = tab.key === "guide" || tab.key === "assistant";

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
                {isActive && isGuideOrAssistant ? (
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
                      icon="💰"
                      iconBg="bg-blue-50"
                      label="Budget phase"
                      value={formatCurrency(Number(phase?.budget_actual ?? 0))}
                      subtitle={`/ ${formatCurrency(Number(phase?.budget_estimated ?? 0))}`}
                    />
                    <StatCard
                      icon="📅"
                      iconBg="bg-green-50"
                      label="Dates"
                      value={phase?.start_date ? formatDate(phase!.start_date!) : "Non défini"}
                      subtitle={phase?.end_date ? `→ ${formatDate(phase!.end_date!)}` : ""}
                    />
                    <StatCard
                      icon="🏗️"
                      iconBg="bg-purple-50"
                      label="Lots"
                      value={lots.length}
                      subtitle={`${lots.filter((l) => String(l.status ?? "").toLowerCase() === "termine").length} terminés`}
                    />
                  </div>

                  <PhaseLotsList
                    projectId={projectId}
                    phaseId={phaseId}
                    lots={lots}
                    onAddLot={canEditThisPhase ? () => setLotModalOpen(true) : undefined}
                  />
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="font-semibold text-gray-900">Documents (phase)</div>
                      <div className="text-sm text-gray-500">Fichiers rattachés à la phase.</div>
                    </CardHeader>
                    <CardContent className="h-[360px] overflow-auto">
                      <DocumentsList
                        context={{ phaseId }}
                        title="Documents (phase)"
                        showUpload={canEditThisPhase}
                      />
                    </CardContent>
                  </Card>

                  <PhaseMembersPanel phaseId={phaseId} />
                </div>
              </div>
              </section>

            {false && (
            <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-blue-200 bg-blue-50/20">
              <CardHeader className="border-b border-blue-100 bg-blue-50/60">
                <div className="text-sm text-gray-600">Budget phase</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">
                {formatCurrency(Number(phase?.budget_actual ?? 0))} / {formatCurrency(Number(phase?.budget_estimated ?? 0))}
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-slate-200 bg-slate-50/30">
              <CardHeader className="border-b border-slate-100 bg-slate-50/60">
                <div className="text-sm text-gray-600">Dates</div>
              </CardHeader>
              <CardContent className="text-sm text-gray-800">
                {phase?.start_date ? formatDate(phase!.start_date!) : "-"} →{" "}
                {phase?.end_date ? formatDate(phase!.end_date!) : "-"}
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-200 bg-emerald-50/20">
              <CardHeader className="border-b border-emerald-100 bg-emerald-50/60">
                <div className="text-sm text-gray-600">Lots</div>
              </CardHeader>
              <CardContent className="text-xl font-semibold text-gray-900">{lots.length}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="font-semibold text-gray-900">Lots ({lots.length})</div>
              <div className="text-sm text-gray-500">Chaque lot représente un corps d’état / entreprise.</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {lots.length === 0 ? (
                <div className="text-sm text-gray-500">Aucun lot pour le moment.</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {lots.map((lot) => (
                    <Card
                      key={lot.id}
                      className="cursor-pointer hover:shadow-sm transition"
                      onClick={() =>
                        router.push(`/dashboard/projets/${projectId}/phases/${phaseId}/lots/${lot.id}?role=${role}`)
                      }
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-gray-900">{lot.name}</div>
                          <div className="text-xs text-gray-500">{lot.status}</div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {lot.companyName ? `Entreprise: ${lot.companyName}` : "Entreprise: -"}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-gray-700">
                        <div className="flex flex-wrap items-center gap-4">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">Progression</div>
                            <div>{lot.progressPercentage}%</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">Budget</div>
                            <div>
                              {formatCurrency(lot.budgetActual)} / {formatCurrency(lot.budgetEstimated)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">Tâches</div>
                            <div>
                              {lot.tasksDone}/{lot.tasksTotal}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {lot.startDate ? formatDate(lot.startDate) : "-"} → {lot.endDate ? formatDate(lot.endDate) : "-"}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <ChatBox context={{ phaseId }} title="Discussion (phase)" />
            <DocumentsList context={{ phaseId }} title="Documents (phase)" showUpload={canEditThisPhase} />
          </div>
        </section>
            )}
            </>
          )}

          {activeTab === "lots" && (
            <>
              <PhaseLotsList
                projectId={projectId}
                phaseId={phaseId}
                lots={lots}
                onAddLot={canEditThisPhase ? () => setLotModalOpen(true) : undefined}
              />

              {false && (
            <section className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="font-semibold text-gray-900">Lots ({lots.length})</div>
                  <div className="text-sm text-gray-500">Chaque lot représente un corps d’état / entreprise.</div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lots.length === 0 ? (
                    <div className="text-sm text-gray-500">Aucun lot pour le moment.</div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {lots.map((lot) => (
                        <Card
                          key={lot.id}
                          className="cursor-pointer hover:shadow-sm transition"
                          onClick={() =>
                            router.push(
                              `/dashboard/projets/${projectId}/phases/${phaseId}/lots/${lot.id}?role=${role}`
                            )
                          }
                        >
                          <CardHeader>
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold text-gray-900">{lot.name}</div>
                              <div className="text-xs text-gray-500">{lot.status}</div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {lot.companyName ? `Entreprise: ${lot.companyName}` : "Entreprise: -"}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm text-gray-700">
                            <div className="flex flex-wrap items-center gap-4">
                              <div>
                                <div className="text-xs uppercase tracking-wide text-gray-400">Progression</div>
                                <div>{lot.progressPercentage}%</div>
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-wide text-gray-400">Budget</div>
                                <div>
                                  {formatCurrency(lot.budgetActual)} / {formatCurrency(lot.budgetEstimated)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-wide text-gray-400">Tâches</div>
                                <div>
                                  {lot.tasksDone}/{lot.tasksTotal}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {lot.startDate ? formatDate(lot.startDate) : "-"} →{" "}
                              {lot.endDate ? formatDate(lot.endDate) : "-"}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
              )}
            </>
          )}

          {activeTab === "chat" && (
            <section className="space-y-3">
              <div className="h-[60vh]">
                <ChatBox context={{ phaseId }} title="Discussion (phase)" />
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Cette discussion est privée à cette phase.
              </div>
            </section>
          )}

          {activeTab === "devis" && <PhaseDevisPanel phaseId={phaseId} />}

          {activeTab === "documents" && (
            <section className="h-[60vh]">
              <DocumentsList context={{ phaseId }} title="Documents (phase)" showUpload={canEditThisPhase} />
            </section>
          )}

          {activeTab === "planning" && <PhasePlanningPanel lots={lots} />}

          {activeTab === "membres" && <PhaseMembersPanel phaseId={phaseId} />}

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
                      contextType="phase"
                      autoScroll={false}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card className="h-fit self-start">
                <CardHeader>
                  <div className="text-lg font-semibold text-neutral-900">Contexte phase</div>
                  <div className="text-sm text-neutral-600">L’assistant utilise le scope de la phase.</div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-neutral-700">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                    Propose un plan d’exécution pour cette phase.
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                    Liste les risques et points de contrôle.
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {activeTab === "guide" && (
            <section className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="font-semibold text-gray-900">Guide (phase)</div>
                  <div className="text-sm text-gray-500">Ressources utiles au niveau phase.</div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-2">Lexique</div>
                    <TermsSearch />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-2">Délais types</div>
                    <DelaisTypesList />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-2">Points d’attention</div>
                    <PointsAttentionList />
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}

      {lotModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-lg w-full p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Nouveau lot</h3>
                <p className="text-sm text-neutral-600">Créez un lot (ex: Électricité, Plomberie…).</p>
              </div>
              <Button variant="ghost" onClick={() => setLotModalOpen(false)}>
                Fermer
              </Button>
            </div>
            <form className="space-y-4" onSubmit={handleCreateLot}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom *</label>
                <Input value={lotForm.name} onChange={(e) => setLotForm({ ...lotForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type de lot</label>
                <Input
                  value={lotForm.lotType}
                  onChange={(e) => setLotForm({ ...lotForm, lotType: e.target.value })}
                  placeholder="electricite, plomberie, menuiserie..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Entreprise</label>
                <Input
                  value={lotForm.companyName}
                  onChange={(e) => setLotForm({ ...lotForm, companyName: e.target.value })}
                  placeholder="Électro Plus"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Budget estimé (€)</label>
                  <Input
                    type="number"
                    min={0}
                    value={lotForm.budgetEstimated}
                    onChange={(e) => setLotForm({ ...lotForm, budgetEstimated: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={lotForm.description}
                    onChange={(e) => setLotForm({ ...lotForm, description: e.target.value })}
                    placeholder="Optionnel"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Début</label>
                  <Input
                    type="date"
                    value={lotForm.startDate}
                    onChange={(e) => setLotForm({ ...lotForm, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fin</label>
                  <Input
                    type="date"
                    value={lotForm.endDate}
                    onChange={(e) => setLotForm({ ...lotForm, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setLotModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={lotSubmitting}>
                  {lotSubmitting ? "Création..." : "Créer le lot"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
