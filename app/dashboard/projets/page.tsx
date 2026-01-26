"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Plus, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
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

const statusBadge = (status: StatusKey) => {
  const styles = {
    draft: "bg-gray-100 text-gray-800",
    en_cours: "bg-blue-100 text-blue-800",
    termine: "bg-green-100 text-green-800",
    en_attente: "bg-yellow-100 text-yellow-800",
  };
  return styles[status];
};

const statusLabel = (status: StatusKey) => {
  const labels: Record<StatusKey, string> = {
    draft: "À faire",
    en_cours: "En cours",
    termine: "Termine",
    en_attente: "En attente",
  };
  return labels[status];
};

export default function ProjetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const roleParam = searchParams.get("role");
  const role =
    user?.role ?? (roleParam === "professionnel" ? "professionnel" : "particulier");

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | StatusKey>("all");
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    projectType: "",
    address: "",
    city: "",
    description: "",
    clientEmail: "",
  });

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

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      const statusKey = resolveStatusKey(project.status);
      const matchesStatus = filter === "all" || statusKey === filter;
      const matchesSearch =
        !query ||
        project.name.toLowerCase().includes(query) ||
        (project.description ?? "").toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [projects, search, filter]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id || !form.name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const projectId = await createProject(user.id, {
        name: form.name,
        projectType: form.projectType,
        address: form.address,
        city: form.city,
        description: form.description,
      });
      if (form.clientEmail.trim()) {
        await inviteProjectMemberByEmail(user.id, projectId, form.clientEmail.trim(), "client");
      }
      setForm({
        name: "",
        projectType: "",
        address: "",
        city: "",
        description: "",
        clientEmail: "",
      });
      setIsCreating(false);
      await loadProjects();
    } catch (err: any) {
      setError(err?.message ?? "Impossible de creer le projet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpen = (projectId: string) => {
    router.push(`/dashboard/projets/${projectId}?role=${role}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Projets</h1>
          <p className="text-gray-600">Gérez tous vos projets BTP</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau projet
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher un projet..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={filter}
              onChange={(event) => setFilter(event.target.value as "all" | StatusKey)}
            >
              <option value="all">Tous les statuts</option>
              <option value="draft">À faire</option>
              <option value="en_cours">En cours</option>
              <option value="en_attente">En attente</option>
              <option value="termine">Termine</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">
            Liste des projets ({filteredProjects.length})
          </h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement des projets...</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projet</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date de creation</TableHead>
                <TableHead>Dernière mise à jour</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {filteredProjects.map((project) => {
                    const statusKey = resolveStatusKey(project.status);
                    return (
                      <TableRow key={project.id} onClick={() => handleOpen(project.id)}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{project.name}</p>
                            {project.description && (
                              <p className="text-sm text-gray-500">{project.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {project.projectType || "-"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(
                              statusKey
                            )}`}
                          >
                            {statusLabel(statusKey)}
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
              {!filteredProjects.length && (
                <p className="text-sm text-gray-500 mt-4">Aucun projet pour ce filtre.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {isCreating && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-xl w-full p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Creer un projet</h3>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom du projet *</label>
                <input
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Renovation appartement"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email client (optionnel)</label>
                <input
                  type="email"
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={form.clientEmail}
                  onChange={(event) => setForm((prev) => ({ ...prev, clientEmail: event.target.value }))}
                  placeholder="client@email.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type de chantier</label>
                <input
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={form.projectType}
                  onChange={(event) => setForm((prev) => ({ ...prev, projectType: event.target.value }))}
                  placeholder="Renovation / Electricite / Plomberie"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Adresse</label>
                  <input
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={form.address}
                    onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                    placeholder="Adresse du chantier"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ville</label>
                  <input
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={form.city}
                    onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                    placeholder="Ville"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full min-h-[120px] px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Résumé des besoins et objectifs."
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
