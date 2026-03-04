"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  BookOpen,
  Clock,
  MapPin,
  Euro,
  Pen,
  FileText,
  Image as ImageIcon,
  X,
  Upload,
} from "lucide-react";

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

const PORTFOLIO_BUCKET = "portfolio-images";

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

const getInitials = (title: string | null) => {
  if (!title) return "NM";
  return title
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
};

const gradientColors = [
  "from-neutral-200 to-neutral-300",
  "from-neutral-100 to-neutral-200",
  "from-slate-100 to-slate-200",
  "from-neutral-200 to-slate-200",
  "from-slate-100 to-neutral-200",
];

export default function PortfolioPage() {
  const { user, profile } = useAuth();

  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  const imageInputRef = useRef<HTMLInputElement>(null);

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
    setError(null);
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
    setError(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(PORTFOLIO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(path);
      setForm((prev) => ({ ...prev, imagePath: data.publicUrl }));
    } catch (err: any) {
      setError(err?.message ?? "Erreur lors de l'upload de l'image.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
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
      return "Portfolio public désactivé dans votre profil.";
    }
    return "Les articles publics sont visibles dans la page pro.";
  }, [profile?.public_portfolio_enabled]);

  if (!user) {
    return <div className="text-sm text-neutral-600">Connectez-vous pour accéder au portfolio.</div>;
  }

  if (!isPro) {
    return <div className="text-sm text-neutral-600">Le portfolio est réservé aux professionnels.</div>;
  }

  const publicCount = projects.filter((p) => p.is_public).length;
  const privateCount = projects.filter((p) => !p.is_public).length;
  const totalBudget = projects.reduce((s, p) => s + (p.budget_total || 0), 0);
  const featured = projects[0] ?? null;
  const rest = projects.slice(1);

  return (
    <div className="space-y-6">
      {/* Header card — même style que "Recherche pro" */}
      <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
        <div className="relative flex items-start justify-between gap-6 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Mon Portfolio</h1>
              <p className="text-neutral-600 mt-1">Gérez les projets publiés sur votre profil.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
                  {projects.length} article{projects.length !== 1 ? "s" : ""}
                </span>
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
                  {publicCount} publié{publicCount !== 1 ? "s" : ""}
                </span>
                {projects.length > 0 && (
                  <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
                    Budget cumulé : {formatCurrency(totalBudget)}
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-full border px-3 py-1",
                    profile?.public_portfolio_enabled
                      ? "border-success-200 bg-success-50 text-success-700"
                      : "border-neutral-200 bg-neutral-50 text-neutral-500"
                  )}
                >
                  {profile?.public_portfolio_enabled ? "Portfolio public actif" : "Portfolio public désactivé"}
                </span>
              </div>
            </div>
          </div>
          <img
            src="/images/portfolio.png"
            alt="Portfolio"
            className="hidden sm:block h-20 w-20 object-contain opacity-90 logo-blend"
          />
        </div>
      </header>

      {error && !selectedProject && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-neutral-500">Chargement des articles...</div>
      )}

      {!loading && projects.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 py-16 text-center text-sm text-neutral-500">
          Aucun article pour le moment.
        </div>
      )}

      {/* Featured Article */}
      {featured && (
        <div
          className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => openEditor(featured)}
        >
          <div className="flex flex-col md:flex-row">
            <div className="relative md:w-1/2 h-[260px] overflow-hidden flex-shrink-0">
              {featured.image_path ? (
                <img
                  src={featured.image_path}
                  alt={featured.title || ""}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div
                  className={cn(
                    "h-full w-full flex items-center justify-center bg-gradient-to-br",
                    gradientColors[0]
                  )}
                >
                  <span className="text-6xl font-bold text-neutral-400/40 select-none font-heading tracking-tight">
                    {getInitials(featured.title)}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                    featured.is_public
                      ? "bg-success-50 text-success-700"
                      : "bg-neutral-100 text-neutral-600"
                  )}
                >
                  {featured.is_public ? "Public" : "Privé"}
                </span>
              </div>
              <button
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-white/90 shadow-sm hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditor(featured);
                }}
                aria-label="Modifier l'article"
              >
                <Pen className="h-4 w-4 text-neutral-700" />
              </button>
            </div>
            <div className="flex-1 p-6 flex flex-col justify-center">
              <p className="text-xs text-neutral-400 mb-1 uppercase tracking-widest">
                {featured.created_at ? formatDate(featured.created_at) : "—"}
              </p>
              <h2 className="text-xl font-bold font-heading text-neutral-900 mb-2 group-hover:text-primary-600 transition-colors">
                {featured.title || "Projet terminé"}
              </h2>
              <p className="text-sm text-neutral-500 line-clamp-3 mb-4 leading-relaxed">
                {featured.summary || "Résumé non fourni."}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-bold text-primary-600 flex items-center gap-1">
                  <Euro className="h-3.5 w-3.5" />
                  {typeof featured.budget_total === "number"
                    ? formatCurrency(featured.budget_total)
                    : "—"}
                </span>
                <span className="text-neutral-300">·</span>
                <span className="text-neutral-500 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDurationLabel(featured.duration_days)}
                </span>
                {featured.city && (
                  <>
                    <span className="text-neutral-300">·</span>
                    <span className="text-neutral-500 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {featured.city}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid Articles */}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {rest.map((project, idx) => (
            <div
              key={project.id}
              className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              onClick={() => openEditor(project)}
            >
              <div className="relative h-[200px] overflow-hidden">
                {project.image_path ? (
                  <img
                    src={project.image_path}
                    alt={project.title || ""}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div
                    className={cn(
                      "h-full w-full flex items-center justify-center bg-gradient-to-br",
                      gradientColors[(idx + 1) % gradientColors.length]
                    )}
                  >
                    <span className="text-4xl font-bold text-neutral-400/40 select-none font-heading tracking-tight">
                      {getInitials(project.title)}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                      project.is_public
                        ? "bg-success-50 text-success-700"
                        : "bg-neutral-100 text-neutral-600"
                    )}
                  >
                    {project.is_public ? "Public" : "Privé"}
                  </span>
                </div>
                <button
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-white/90 shadow-sm hover:bg-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditor(project);
                  }}
                  aria-label="Modifier l'article"
                >
                  <Pen className="h-4 w-4 text-neutral-700" />
                </button>
              </div>
              <div className="p-5">
                <p className="text-xs text-neutral-400 uppercase tracking-widest mb-1">
                  {project.created_at ? formatDate(project.created_at) : "—"}
                </p>
                <h3 className="text-lg font-bold font-heading text-neutral-900 mb-1 group-hover:text-primary-600 transition-colors line-clamp-1">
                  {project.title || "Projet terminé"}
                </h3>
                <p className="text-sm text-neutral-500 line-clamp-2 mb-3 leading-relaxed">
                  {project.summary || "Résumé non fourni."}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold text-primary-600">
                    {typeof project.budget_total === "number"
                      ? formatCurrency(project.budget_total)
                      : "—"}
                  </span>
                  <span className="text-neutral-300">·</span>
                  <span className="text-neutral-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatDurationLabel(project.duration_days)}
                  </span>
                  {project.city && (
                    <>
                      <span className="text-neutral-300">·</span>
                      <span className="text-neutral-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {project.city}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-in Editor Panel — rendu via Portal pour éviter les problèmes de stacking context */}
      {selectedProject && typeof document !== "undefined" && createPortal(
        <>
          <div
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
            onClick={closeEditor}
          />
          <div className="fixed top-0 right-0 z-[201] h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/95 backdrop-blur-md border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-bold font-heading text-neutral-900">
                  Modifier l&apos;article
                </h2>
              </div>
              <button
                onClick={closeEditor}
                className="rounded-lg p-2 hover:bg-neutral-100 transition-colors"
                aria-label="Fermer"
              >
                <X className="h-5 w-5 text-neutral-600" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Image preview + upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-800">Image</label>

                {/* Preview */}
                {form.imagePath ? (
                  <div className="relative h-[200px] rounded-xl overflow-hidden group/img">
                    <img
                      src={form.imagePath}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors" />
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, imagePath: "" }))}
                      className="absolute top-2 right-2 rounded-full bg-black/40 p-1.5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-black/60"
                      aria-label="Supprimer l'image"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="h-[180px] rounded-xl bg-neutral-100 border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-2">
                    <ImageIcon className="h-10 w-10 text-neutral-300" />
                    <p className="text-sm text-neutral-400">Aucune image</p>
                  </div>
                )}

                {/* Upload button */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4 text-primary-600" />
                    {uploading ? "Upload en cours..." : "Choisir une image"}
                  </button>
                  <span className="text-xs text-neutral-400">ou entrer une URL ci-dessous</span>
                </div>

                {/* URL fallback */}
                <Input
                  value={form.imagePath}
                  onChange={(e) => setForm((prev) => ({ ...prev, imagePath: e.target.value }))}
                  placeholder="https://... ou laisser vide"
                />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-800">Titre de l&apos;article</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Titre du projet"
                />
              </div>

              {/* Summary */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-800">Résumé</label>
                <textarea
                  value={form.summary}
                  onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                  placeholder="Description du projet..."
                  rows={4}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
                />
              </div>

              {/* Budget + Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Budget (€)</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={form.budgetTotal}
                    onChange={(e) => setForm((prev) => ({ ...prev, budgetTotal: e.target.value }))}
                    placeholder="45000"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Durée (jours)</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={form.durationDays}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, durationDays: e.target.value }))
                    }
                    placeholder="30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Ville</label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Paris"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Code postal</label>
                  <Input
                    value={form.postalCode}
                    onChange={(e) => setForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="75000"
                  />
                </div>
              </div>

              {/* Publish toggle */}
              <div className="flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                <div>
                  <p className="text-sm font-medium text-neutral-800">Visible sur mon profil</p>
                  <p className="text-xs text-neutral-500">Les visiteurs pourront voir cet article</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isPublic}
                  onClick={() => setForm((prev) => ({ ...prev, isPublic: !prev.isPublic }))}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
                    form.isPublic ? "bg-primary-600" : "bg-neutral-200"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                      form.isPublic ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Sticky footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 bg-white/95 backdrop-blur-md border-t border-neutral-200">
              <Button variant="ghost" onClick={closeEditor}>
                Annuler
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving || uploading}>
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
