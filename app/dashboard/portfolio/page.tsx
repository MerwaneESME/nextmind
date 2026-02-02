"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { formatCurrency, formatDate } from "@/lib/utils";

type PortfolioProject = {
  id: string;
  title: string | null;
  summary: string | null;
  budget_total: number | null;
  duration_days: number | null;
  image_path: string | null;
  city: string | null;
  postal_code: string | null;
  is_public: boolean;
  created_at: string | null;
};

type EditForm = {
  title: string;
  summary: string;
  budgetTotal: string;
  durationDays: string;
  city: string;
  postalCode: string;
  imagePath: string;
  isPublic: boolean;
};

const normalizeText = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const formatDurationLabel = (days: number | null) => {
  if (!days || days <= 0) return "-";
  if (days <= 13) return `${days} jour${days > 1 ? "s" : ""}`;
  if (days <= 59) {
    const weeks = Math.max(1, Math.round(days / 7));
    return `${weeks} semaine${weeks > 1 ? "s" : ""}`;
  }
  if (days <= 364) {
    const months = Math.max(1, Math.round(days / 30));
    return `${months} mois`;
  }
  const years = Math.max(1, Math.round(days / 365));
  return `${years} an${years > 1 ? "s" : ""}`;
};

export default function PortfolioPage() {
  const { user, profile } = useAuth();

  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<PortfolioProject | null>(null);
  const [form, setForm] = useState<EditForm>({
    title: "",
    summary: "",
    budgetTotal: "",
    durationDays: "",
    city: "",
    postalCode: "",
    imagePath: "",
    isPublic: false,
  });

  const isPro = profile?.user_type === "pro";

  const loadProjects = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("pro_portfolio_projects")
        .select(
          "id,title,summary,budget_total,duration_days,image_path,city,postal_code,is_public,created_at"
        )
        .eq("pro_id", user.id)
        .order("created_at", { ascending: false });
      if (fetchError) throw fetchError;
      setProjects((data ?? []) as PortfolioProject[]);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger vos articles.");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, [user?.id]);

  const openEditor = (project: PortfolioProject) => {
    setSelectedProject(project);
    setForm({
      title: project.title ?? "",
      summary: project.summary ?? "",
      budgetTotal: project.budget_total != null ? String(project.budget_total) : "",
      durationDays: project.duration_days != null ? String(project.duration_days) : "",
      city: project.city ?? "",
      postalCode: project.postal_code ?? "",
      imagePath: project.image_path ?? "",
      isPublic: Boolean(project.is_public),
    });
  };

  const closeEditor = () => {
    setSelectedProject(null);
  };

  const handleSave = async () => {
    if (!selectedProject || !user?.id) return;
    setSaving(true);
    setError(null);
    const budgetValue = form.budgetTotal ? Number(form.budgetTotal) : null;
    const durationValue = form.durationDays ? Number(form.durationDays) : null;
    const payload = {
      title: normalizeText(form.title),
      summary: normalizeText(form.summary),
      budget_total: Number.isFinite(budgetValue) ? budgetValue : null,
      duration_days: Number.isFinite(durationValue) ? durationValue : null,
      city: normalizeText(form.city),
      postal_code: normalizeText(form.postalCode),
      image_path: normalizeText(form.imagePath),
      is_public: form.isPublic,
    };

    const { error: updateError } = await supabase
      .from("pro_portfolio_projects")
      .update(payload)
      .eq("id", selectedProject.id)
      .eq("pro_id", user.id);
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    await loadProjects();
    setSaving(false);
    closeEditor();
  };

  const publicStatusLabel = useMemo(() => {
    if (!profile?.public_portfolio_enabled) {
      return "Portfolio public desactive dans votre profil.";
    }
    return "Les articles publics sont visibles dans la page pro.";
  }, [profile?.public_portfolio_enabled]);

  if (!user) {
    return <div className="text-sm text-neutral-600">Connectez-vous pour acceder au portfolio.</div>;
  }

  if (!isPro) {
    return <div className="text-sm text-neutral-600">Le portfolio est reserve aux professionnels.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <img
            src="/images/portfolio.png"
            alt="Portfolio"
            className="h-28 w-28 object-contain logo-blend"
          />
          <div>
          <h1 className="text-3xl font-bold text-neutral-900">Mes articles</h1>
          <p className="text-neutral-600">Gérez les projets publiés sur votre profil.</p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="text-sm text-neutral-700 p-4">{publicStatusLabel}</CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && <div className="text-sm text-neutral-600">Chargement des articles...</div>}

      {!loading && projects.length === 0 && (
        <div className="text-sm text-neutral-600">Aucun article pour le moment.</div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {projects.map((project) => (
          <Card key={project.id} className="border border-neutral-200">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-neutral-900">
                    {project.title || "Projet terminé"}
                  </div>
                  <div className="text-xs text-neutral-500">
                    Publié le {project.created_at ? formatDate(project.created_at) : "-"}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openEditor(project)}>
                  Modifier
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-neutral-700">{project.summary || "Résumé non fourni."}</p>
              <div className="flex flex-wrap gap-2 text-xs text-neutral-700">
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
                  Budget:{" "}
                  {typeof project.budget_total === "number"
                    ? formatCurrency(project.budget_total)
                    : "-"}
                </span>
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
                  Duree: {formatDurationLabel(project.duration_days)}
                </span>
                {(project.city || project.postal_code) && (
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
                    Zone: {project.city || "-"} {project.postal_code || ""}
                  </span>
                )}
                <span
                  className={`rounded-full px-3 py-1 ${
                    project.is_public ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {project.is_public ? "Public" : "Prive"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedProject && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-lg w-full p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Modifier l article</h3>
                <p className="text-sm text-neutral-600">Ajustez les informations du projet.</p>
              </div>
              <Button variant="ghost" onClick={closeEditor}>
                Fermer
              </Button>
            </div>
            <div className="space-y-4">
              <Input
                label="Titre"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-800">Résumé</label>
                <textarea
                  value={form.summary}
                  onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                  className="w-full min-h-[120px] px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Budget total"
                  type="number"
                  inputMode="decimal"
                  value={form.budgetTotal}
                  onChange={(event) => setForm((prev) => ({ ...prev, budgetTotal: event.target.value }))}
                />
                <Input
                  label="Duree (jours)"
                  type="number"
                  inputMode="numeric"
                  value={form.durationDays}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, durationDays: event.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Ville"
                  value={form.city}
                  onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                />
                <Input
                  label="Code postal"
                  value={form.postalCode}
                  onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                />
              </div>
              <Input
                label="Image (URL ou chemin)"
                value={form.imagePath}
                onChange={(event) => setForm((prev) => ({ ...prev, imagePath: event.target.value }))}
              />
              <label className="flex items-center justify-between">
                <span className="text-neutral-800">Publier cet article</span>
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={(event) => setForm((prev) => ({ ...prev, isPublic: event.target.checked }))}
                  className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
              </label>
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={closeEditor}>
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
