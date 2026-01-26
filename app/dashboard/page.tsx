"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Eye,
  Download,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createProject, fetchProjectsForUser, ProjectSummary } from "@/lib/projectsDb";
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

const getStatusBadge = (status: string) => {
  const styles = {
    draft: "bg-gray-100 text-gray-800",
    en_cours: "bg-blue-100 text-blue-800",
    termine: "bg-green-100 text-green-800",
    en_attente: "bg-yellow-100 text-yellow-800",
    a_faire: "bg-gray-100 text-gray-800",
    envoye: "bg-blue-100 text-blue-800",
    valide: "bg-green-100 text-green-800",
    refuse: "bg-red-100 text-red-800",
  };
  return styles[status as keyof typeof styles] || styles.en_attente;
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    draft: "En étude",
    en_cours: "En cours",
    termine: "Termine",
    en_attente: "En attente",
    a_faire: "En étude",
    envoye: "Envoyé",
    valide: "Validé",
    refuse: "Refuse",
  };
  return labels[status] || status;
};

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const userRole: "particulier" | "professionnel" =
    roleParam === "professionnel" ? "professionnel" : "particulier";

  if (userRole === "professionnel") {
    return <ProfessionalDashboard />;
  }

  return <ParticulierDashboard />;
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

  const normalizeStoragePath = (bucket?: string, path?: string) => {
    if (!bucket || !path) return path;
    return path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  };

  const loadProjects = async () => {
    if (!user?.id) return;
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const data = await fetchProjectsForUser(user.id, 5);
      setProjects(data);
    } catch (err: any) {
      setProjectsError(err?.message ?? "Impossible de charger les projets.");
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  const loadQuotes = async () => {
    if (!user?.id) return;
    setQuotesLoading(true);
    setQuotesError(null);
    try {
      const data = await fetchDevisForUser(user.id, 5);
      setQuotes(data);
    } catch (err: any) {
      setQuotesError(err?.message ?? "Impossible de charger les devis.");
      setQuotes([]);
    } finally {
      setQuotesLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
    void loadQuotes();
  }, [user?.id]);

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tableau de bord</h1>
        <p className="text-gray-600">Vue d'ensemble de votre activité</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Projets en cours</p>
                <p className="text-2xl font-bold text-gray-900">{projectsEnCours}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Projets achevés</p>
                <p className="text-2xl font-bold text-gray-900">{projectsTermines}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Devis à faire</p>
                <p className="text-2xl font-bold text-gray-900">{devisStats.a_faire}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Alertes</p>
                <p className="text-2xl font-bold text-gray-900">{alertesNonLues}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Projets récents</h2>
            <Button variant="outline" size="sm" onClick={openProjects}>
              Voir tout
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {projectsError && (
            <div className="text-sm text-red-600 mb-3">{projectsError}</div>
          )}
          {projectsLoading ? (
            <p className="text-sm text-gray-500">Chargement des projets...</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projet</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date de creation</TableHead>
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
                            <p className="font-medium text-gray-900">{project.name}</p>
                            {project.description && (
                              <p className="text-sm text-gray-500">{project.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(
                              statusKey
                            )}`}
                          >
                            {getStatusLabel(statusKey)}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {project.createdAt ? formatDate(project.createdAt) : "-"}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {project.updatedAt ? formatDate(project.updatedAt) : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </tbody>
              </Table>
              {!projects.length && (
                <p className="text-sm text-gray-500 mt-4">Aucun projet pour le moment.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Devis récents</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                En étude: {devisStats.a_faire} | Envoyés: {devisStats.envoye} | Validés: {devisStats.valide}
              </span>
              <Button variant="outline" size="sm" onClick={openDevis}>
                Voir tout
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
              {quotes.map((quote) => {
                const workflowStatus = resolveWorkflowStatus(quote);
                return (
                  <TableRow key={quote.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{quote.title}</p>
                        {quote.clientName && (
                          <p className="text-xs text-gray-500">Client: {quote.clientName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {typeof quote.totalTtc === "number" ? formatCurrency(quote.totalTtc) : "-"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(
                          workflowStatus
                        )}`}
                      >
                        {getStatusLabel(workflowStatus)}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-600">
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
            <p className="text-sm text-gray-500 mt-4">Aucun devis pour le moment.</p>
          )}
          {quotesLoading && (
            <p className="text-sm text-gray-500 mt-4">Chargement des devis...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ParticulierDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });

  const loadProjects = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjectsForUser(user.id);
      setProjects(data);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les projets.");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
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
      await createProject(user.id, {
        name: formData.name,
        description: formData.description,
      });
      setFormData({ name: "", description: "" });
      setIsCreating(false);
      await loadProjects();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de creer le projet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenProject = (projectId: string) => {
    const roleParam = user?.role === "professionnel" ? "professionnel" : "particulier";
    router.push(`/dashboard/projets/${projectId}?role=${roleParam}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mes projets</h1>
          <p className="text-gray-600">Gérez vos projets BTP</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          Creer un nouveau projet
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Projets en cours</p>
                <p className="text-2xl font-bold text-gray-900">
                  {projectsEnCours}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Projets termines</p>
                <p className="text-2xl font-bold text-gray-900">
                  {projectsTermines}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Devis recus</p>
                <p className="text-2xl font-bold text-gray-900">{devisRecus}</p>
              </div>
              <FileText className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Mes projets</h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement des projets...</p>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => {
                const statusKey = resolveProjectStatus(project.status);
                return (
              <div
                key={project.id}
                onClick={() => handleOpenProject(project.id)}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-gray-600 mb-2">{project.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Cree le {project.createdAt ? formatDate(project.createdAt) : "-"}</span>
                      <span className="capitalize">
                        Statut: {getStatusLabel(statusKey)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
                );
              })}
              {!projects.length && (
                <p className="text-sm text-gray-500">Aucun projet pour le moment.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isCreating && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Creer un nouveau projet</h3>
            <form className="space-y-4" onSubmit={handleCreateProject}>
              <Input
                label="Titre du projet"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
              <div>
                <label className="block text-sm font-medium text-neutral-800 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full min-h-[120px] px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Decrivez votre projet (dimensions, pieces concernees, budget estime, delais...)"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creation..." : "Creer le projet"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
