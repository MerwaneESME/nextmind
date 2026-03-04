"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabaseClient";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Euro,
  Building2,
  Briefcase,
  X,
} from "lucide-react";

type ProProfile = {
  pro_id: string;
  display_name: string | null;
  company_name: string | null;
  city: string | null;
  postal_code: string | null;
  company_description: string | null;
  company_website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type PortfolioProject = {
  id: string;
  title: string | null;
  summary: string | null;
  budget_total: number | null;
  duration_days: number | null;
  image_path: string | null;
  city: string | null;
  postal_code: string | null;
  created_at: string | null;
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

const getInitials = (name: string | null) => {
  if (!name) return "NM";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
};

export default function ProProfilePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const role = roleParam === "professionnel" ? "professionnel" : "particulier";
  const proId = typeof params.id === "string" ? params.id : "";

  const [profile, setProfile] = useState<ProProfile | null>(null);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<PortfolioProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    if (!proId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("public_pro_profiles")
        .select(
          "pro_id,display_name,company_name,city,postal_code,company_description,company_website,email,phone,address"
        )
        .eq("pro_id", proId)
        .maybeSingle();
      if (profileError) throw profileError;

      const { data: specialtyData, error: specialtyError } = await supabase
        .from("pro_specialties")
        .select("label")
        .eq("pro_id", proId);
      if (specialtyError) throw specialtyError;

      const { data: portfolioData, error: portfolioError } = await supabase
        .from("pro_portfolio_projects")
        .select("id,title,summary,budget_total,duration_days,image_path,city,postal_code,created_at")
        .eq("pro_id", proId)
        .eq("is_public", true)
        .order("created_at", { ascending: false });
      if (portfolioError) throw portfolioError;

      setProfile(profileData as ProProfile | null);
      setSpecialties((specialtyData ?? []).map((item) => item.label));
      setProjects((portfolioData ?? []) as PortfolioProject[]);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger le profil.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [proId]);

  const displayName = useMemo(
    () => profile?.company_name || profile?.display_name || "Professionnel",
    [profile]
  );

  const featured = projects[0] ?? null;
  const rest = projects.slice(1);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push(`/dashboard/professionnels?role=${role}`)}
        className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux professionnels
      </button>

      {/* Profile header card */}
      <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
        <div className="relative flex items-start justify-between gap-6 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold font-heading text-neutral-900">{displayName}</h1>
              {profile?.company_description && (
                <p className="text-neutral-500 mt-1 text-sm line-clamp-2">{profile.company_description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                {profile?.city && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1">
                    <MapPin className="h-3 w-3 text-primary-600" />
                    {profile.city}
                    {profile.postal_code ? ` ${profile.postal_code}` : ""}
                  </span>
                )}
                {specialties.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-primary-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-neutral-500 mb-4">Chargement du profil...</div>
      )}

      {/* Contact info card */}
      {!loading && profile && (
        <div className="mb-8 rounded-2xl border border-neutral-200 bg-white shadow-sm p-6 space-y-4">
          {/* Description */}
          {profile.company_description && (
            <p className="text-neutral-600 italic leading-relaxed">
              {profile.company_description}
            </p>
          )}

          {/* Contact chips */}
          <div className="flex flex-wrap gap-2">
            {profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-800 hover:bg-primary-50 transition-colors"
              >
                <Mail className="h-4 w-4 text-primary-600" />
                {profile.email}
              </a>
            )}
            {profile.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-800 hover:bg-primary-50 transition-colors"
              >
                <Phone className="h-4 w-4 text-primary-600" />
                {profile.phone}
              </a>
            )}
            {profile.company_website && (
              <a
                href={profile.company_website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-800 hover:bg-primary-50 transition-colors"
              >
                <Globe className="h-4 w-4 text-primary-600" />
                Site web
              </a>
            )}
            {profile.address && (
              <span className="inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-500">
                <Building2 className="h-4 w-4 text-primary-600" />
                {profile.address}
              </span>
            )}
          </div>

          {/* Specialty badges */}
          {specialties.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Articles section */}
      {!loading && projects.length > 0 && (
        <>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold font-heading text-neutral-900">Réalisations</h2>
            <span className="text-sm text-neutral-500">
              {projects.length} projet{projects.length !== 1 ? "s" : ""} publié{projects.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Featured article */}
          {featured && (
            <div
              className="relative mb-6 rounded-2xl overflow-hidden cursor-pointer group"
              onClick={() => setSelectedProject(featured)}
            >
              <div className="h-[340px] overflow-hidden">
                {featured.image_path ? (
                  <img
                    src={featured.image_path}
                    alt={featured.title || ""}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-neutral-200 to-neutral-300 flex items-center justify-center">
                    <span className="text-7xl font-bold text-neutral-400/40 select-none font-heading tracking-tight">
                      {getInitials(featured.title)}
                    </span>
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-white/70 text-xs uppercase tracking-widest mb-2">
                  {featured.created_at ? formatDate(featured.created_at) : "—"}
                </p>
                <h3 className="text-2xl font-bold text-white font-heading mb-3">
                  {featured.title || "Projet terminé"}
                </h3>
                <div className="flex items-center gap-3">
                  {typeof featured.budget_total === "number" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs text-white">
                      <Euro className="h-3 w-3" /> {formatCurrency(featured.budget_total)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs text-white">
                    <Clock className="h-3 w-3" /> {formatDurationLabel(featured.duration_days)}
                  </span>
                </div>
              </div>
              <div className="absolute bottom-6 right-6">
                <Button variant="primary" size="sm" className="shadow-lg flex items-center gap-2">
                  Lire l&apos;article <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Grid rest */}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              {rest.map((article) => (
                <div
                  key={article.id}
                  className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  onClick={() => setSelectedProject(article)}
                >
                  <div className="relative h-[200px] overflow-hidden">
                    {article.image_path ? (
                      <img
                        src={article.image_path}
                        alt={article.title || ""}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center">
                        <span className="text-5xl font-bold text-neutral-300/60 select-none font-heading tracking-tight">
                          {getInitials(article.title)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold font-heading text-neutral-900 mb-1 group-hover:text-primary-600 transition-colors line-clamp-1">
                      {article.title || "Projet terminé"}
                    </h3>
                    <p className="text-sm text-neutral-500 line-clamp-3 mb-3 leading-relaxed">
                      {article.summary || "Résumé non fourni."}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
                      {typeof article.budget_total === "number" && (
                        <>
                          <span className="font-bold text-primary-600">
                            {formatCurrency(article.budget_total)}
                          </span>
                          <span className="text-neutral-300">·</span>
                        </>
                      )}
                      <span className="text-neutral-500">
                        {formatDurationLabel(article.duration_days)}
                      </span>
                      {article.city && (
                        <>
                          <span className="text-neutral-300">·</span>
                          <span className="text-neutral-500">{article.city}</span>
                        </>
                      )}
                    </div>
                    <span className="text-xs font-medium text-primary-600 group-hover:underline flex items-center gap-1">
                      Lire l&apos;article <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && profile && projects.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 py-12 text-center text-sm text-neutral-500">
          Aucun projet public pour le moment.
        </div>
      )}

      {/* Article Modal */}
      {selectedProject && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
            onClick={() => setSelectedProject(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
              {/* Image header */}
              <div className="relative h-[300px] overflow-hidden">
                {selectedProject.image_path ? (
                  <img
                    src={selectedProject.image_path}
                    alt={selectedProject.title || ""}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-neutral-200 to-neutral-300 flex items-center justify-center">
                    <span className="text-7xl font-bold text-neutral-400/40 select-none font-heading tracking-tight">
                      {getInitials(selectedProject.title)}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute top-4 left-4 inline-flex items-center rounded-full bg-success-50 text-success-700 px-3 py-1 text-xs font-medium">
                  Chantier terminé
                </span>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="absolute top-4 right-4 rounded-full bg-black/30 backdrop-blur-sm p-2 text-white hover:bg-black/50 transition-colors"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <p className="text-xs text-neutral-400 uppercase tracking-widest">
                  {selectedProject.created_at ? formatDate(selectedProject.created_at) : "—"}
                </p>
                <h2 className="text-2xl font-bold font-heading text-neutral-900">
                  {selectedProject.title || "Projet terminé"}
                </h2>
                <div
                  className="h-0.5 w-10 rounded-full"
                  style={{
                    background: "linear-gradient(to right, #38b6ff, transparent)",
                  }}
                />
                <p className="text-neutral-600 leading-relaxed">
                  {selectedProject.summary || "Résumé non fourni."}
                </p>

                {/* Key info grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4 text-center">
                    <Euro className="h-5 w-5 mx-auto mb-1 text-primary-600" />
                    <p className="text-xs text-neutral-500">Budget</p>
                    <p className="font-bold text-neutral-900 text-sm">
                      {typeof selectedProject.budget_total === "number"
                        ? formatCurrency(selectedProject.budget_total)
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4 text-center">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-primary-600" />
                    <p className="text-xs text-neutral-500">Durée</p>
                    <p className="font-bold text-neutral-900 text-sm">
                      {formatDurationLabel(selectedProject.duration_days)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4 text-center">
                    <MapPin className="h-5 w-5 mx-auto mb-1 text-primary-600" />
                    <p className="text-xs text-neutral-500">Localisation</p>
                    <p className="font-bold text-neutral-900 text-sm">
                      {selectedProject.city || "—"}
                      {selectedProject.postal_code ? ` ${selectedProject.postal_code}` : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
                <Button variant="outline" onClick={() => setSelectedProject(null)}>
                  Fermer
                </Button>
                {profile?.email && (
                  <a href={`mailto:${profile.email}`}>
                    <Button variant="primary" className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Contacter ce pro
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
