"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Mail, MapPin, Phone } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatCurrency, formatDate } from "@/lib/utils";

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

const normalizeImageSrc = (value: string | null) => {
  if (!value) return null;
  return value;
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">{displayName}</h1>
          {profile?.company_description && (
            <p className="text-neutral-600 mt-1">{profile.company_description}</p>
          )}
        </div>
        <Button variant="outline" onClick={() => router.push(`/dashboard/professionnels?role=${role}`)}>
          Retour
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && <div className="text-sm text-neutral-600">Chargement du profil...</div>}

      {!loading && profile && (
        <Card>
          <CardHeader>
            <div className="font-semibold text-neutral-900">Informations de contact</div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm text-neutral-700">
              {profile.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {profile.city}
                  {profile.postal_code ? ` (${profile.postal_code})` : ""}
                </span>
              )}
              {profile.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  {profile.phone}
                </span>
              )}
              {profile.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {profile.email}
                </span>
              )}
            </div>
            {profile.address && <div className="text-sm text-neutral-700">{profile.address}</div>}
            {profile.company_website && (
              <div className="text-sm text-neutral-600">{profile.company_website}</div>
            )}

            {specialties.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {specialties.map((service) => (
                  <span
                    key={service}
                    className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs border border-neutral-200"
                  >
                    {service}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Articles du portfolio</h2>
          <p className="text-sm text-neutral-600">Projets publiés par ce professionnel.</p>
        </div>

        {projects.length === 0 && (
          <div className="text-sm text-neutral-600">Aucun projet public pour le moment.</div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => {
            const imageSrc = normalizeImageSrc(project.image_path);
            return (
              <article
                key={project.id}
                className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="grid md:grid-cols-[220px_1fr]">
                  <div className="relative h-44 md:h-full">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={project.title ?? "Projet"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                          Projet
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                  </div>

                  <div className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900">
                          {project.title || "Projet terminé"}
                        </h3>
                        <div className="text-xs text-neutral-500 mt-1">
                          Publié le {project.created_at ? formatDate(project.created_at) : "-"}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setSelectedProject(project)}>
                        Lire l article
                      </Button>
                    </div>

                    <p className="text-sm text-neutral-700">
                      {project.summary || "Résumé non fourni."}
                    </p>

                    <div className="mt-auto flex flex-wrap gap-2 text-xs text-neutral-700">
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
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {selectedProject && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-2xl w-full p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">
                  {selectedProject.title || "Projet terminé"}
                </h3>
                <p className="text-sm text-neutral-600">
                  Publié le {selectedProject.created_at ? formatDate(selectedProject.created_at) : "-"}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setSelectedProject(null)}>
                Fermer
              </Button>
            </div>
            {selectedProject.image_path && (
              <div className="mb-4 overflow-hidden rounded-lg border border-neutral-200">
                <img
                  src={selectedProject.image_path}
                  alt={selectedProject.title ?? "Projet"}
                  className="w-full h-56 object-cover"
                />
              </div>
            )}
            <div className="space-y-3 text-sm text-neutral-700">
              <p>{selectedProject.summary || "Résumé non fourni."}</p>
              <div className="flex flex-wrap gap-3 text-xs text-neutral-600">
                <span>
                  Budget:{" "}
                  {typeof selectedProject.budget_total === "number"
                    ? formatCurrency(selectedProject.budget_total)
                    : "-"}
                </span>
                <span>Duree: {formatDurationLabel(selectedProject.duration_days)}</span>
                {(selectedProject.city || selectedProject.postal_code) && (
                  <span>
                    Zone: {selectedProject.city || "-"} {selectedProject.postal_code || ""}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setSelectedProject(null)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
