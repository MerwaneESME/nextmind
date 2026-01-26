"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Bot, Loader2, Mail, MapPin, Phone } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

type ProSpecialty = {
  pro_id: string;
  label: string;
};

type Filters = {
  city: string;
  postalCode: string;
  specialty: string;
};

const buildSearchPattern = (value: string) => `%${value}%`;

export default function ProfessionnelsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const role = roleParam === "professionnel" ? "professionnel" : "particulier";

  const [profiles, setProfiles] = useState<ProProfile[]>([]);
  const [specialties, setSpecialties] = useState<Record<string, string[]>>({});
  const [specialtyOptions, setSpecialtyOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ city: "", postalCode: "", specialty: "" });
  const [agentMode, setAgentMode] = useState(false);
  const [agentQuery, setAgentQuery] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentInfo, setAgentInfo] = useState<{
    tags: string[];
    city?: string | null;
    postal_code?: string | null;
  } | null>(null);
  const agentPulseClass = agentLoading ? "ring-2 ring-primary-200 animate-pulse" : "";

  const loadSpecialtiesFor = async (ids: string[]) => {
    if (!ids.length) {
      setSpecialties({});
      return;
    }
    const { data: specRows } = await supabase
      .from("pro_specialties")
      .select("pro_id,label")
      .in("pro_id", ids);
    const grouped: Record<string, string[]> = {};
    (specRows ?? []).forEach((item) => {
      if (!grouped[item.pro_id]) grouped[item.pro_id] = [];
      grouped[item.pro_id].push(item.label);
    });
    setSpecialties(grouped);
  };

  const loadSpecialtyOptions = async () => {
    const { data, error: fetchError } = await supabase.from("pro_specialties").select("label");
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    const labels = Array.from(
      new Set((data ?? []).map((item) => item.label.trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    setSpecialtyOptions(labels);
  };

  const loadProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      let proIds: string[] | null = null;
      if (filters.specialty.trim()) {
        const { data: matches, error: specialtyError } = await supabase
          .from("pro_specialties")
          .select("pro_id")
          .ilike("label", buildSearchPattern(filters.specialty.trim()));
        if (specialtyError) throw specialtyError;
        proIds = Array.from(new Set((matches ?? []).map((item) => item.pro_id)));
        if (proIds.length === 0) {
          setProfiles([]);
          setSpecialties({});
          return;
        }
      }

      let query = supabase
        .from("public_pro_profiles")
        .select(
          "pro_id,display_name,company_name,city,postal_code,company_description,company_website,email,phone,address"
        );

      if (proIds) {
        query = query.in("pro_id", proIds);
      }

      if (filters.city.trim()) {
        query = query.ilike("city", buildSearchPattern(filters.city.trim()));
      }

      if (filters.postalCode.trim()) {
        query = query.ilike("postal_code", buildSearchPattern(filters.postalCode.trim()));
      }

      const queryText = search.trim();
      if (queryText) {
        const pattern = buildSearchPattern(queryText);
        query = query.or(
          [
            `display_name.ilike.${pattern}`,
            `company_name.ilike.${pattern}`,
            `city.ilike.${pattern}`,
            `postal_code.ilike.${pattern}`,
            `company_description.ilike.${pattern}`,
          ].join(",")
        );
      }

      const { data, error: fetchError } = await query.order("company_name", { ascending: true });
      if (fetchError) throw fetchError;

      const rows = (data ?? []) as ProProfile[];
      setProfiles(rows);

      await loadSpecialtiesFor(rows.map((row) => row.pro_id));
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les profils.");
      setProfiles([]);
      setSpecialties({});
    } finally {
      setLoading(false);
    }
  };

  const runAgentSearch = async () => {
    const queryText = agentQuery.trim();
    if (!queryText) {
      setAgentError("Veuillez decrire votre projet.");
      return;
    }
    const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL;
    if (!apiUrl) {
      setAgentError("AI API non configuree.");
      return;
    }
    setAgentLoading(true);
    setAgentError(null);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/pro-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: queryText,
          city: filters.city || null,
          postal_code: filters.postalCode || null,
          limit: 30,
        }),
      });
      if (!response.ok) {
        throw new Error("Impossible de lancer la recherche agent.");
      }
      const payload = await response.json();
      const rows = (payload?.results ?? []) as ProProfile[];
      setProfiles(rows);
      setAgentInfo({
        tags: (payload?.interpreted?.tags ?? []) as string[],
        city: payload?.interpreted?.city ?? null,
        postal_code: payload?.interpreted?.postal_code ?? null,
      });
      await loadSpecialtiesFor(rows.map((row) => row.pro_id));
    } catch (err: any) {
      setAgentError(err?.message ?? "Impossible de lancer la recherche agent.");
      setProfiles([]);
      setSpecialties({});
    } finally {
      setAgentLoading(false);
    }
  };

  useEffect(() => {
    void loadSpecialtyOptions();
  }, []);

  useEffect(() => {
    if (!agentMode) {
      void loadProfiles();
    }
  }, [agentMode, search, filters.city, filters.postalCode, filters.specialty]);

  const handleOpenProfile = (pro: ProProfile) => {
    const params = new URLSearchParams({ role });
    router.push(`/dashboard/professionnels/${pro.pro_id}?${params.toString()}`);
  };

  const handleContact = (pro: ProProfile) => {
    const params = new URLSearchParams({
      role,
      proId: pro.pro_id,
      proName: pro.company_name || pro.display_name || "Professionnel",
    });
    router.push(`/dashboard/messages?${params.toString()}`);
  };

  const filterSummary = useMemo(() => {
    const parts = [];
    if (filters.city.trim()) parts.push(`Ville: ${filters.city}`);
    if (filters.postalCode.trim()) parts.push(`Code postal: ${filters.postalCode}`);
    if (!agentMode && filters.specialty.trim()) parts.push(`Specialite: ${filters.specialty}`);
    return parts.join(" | ");
  }, [agentMode, filters]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Professionnels</h1>
        <p className="text-gray-600">
          Recherchez un professionnel par specialite et zone d intervention.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <div className="flex-1">
          <div className="relative">
            {agentMode ? (
              <textarea
                className={`w-full min-h-[96px] rounded-lg border border-neutral-300 px-4 pt-3 pb-2 pr-12 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-primary-500 ${agentPulseClass}`}
                placeholder="Decrivez votre projet (ex: renovation maison, plomberie, salle de bain, budget, delais)"
                value={agentQuery}
                onChange={(event) => setAgentQuery(event.target.value)}
              />
            ) : (
              <Input
                className="pr-12 pt-3 pb-2 leading-6"
                placeholder="Rechercher un pro (nom, specialite, ville, code postal)"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
            <Button
              variant={agentMode ? "primary" : "outline"}
              size="sm"
              title={agentMode ? "Recherche agent activee" : "Activer la recherche agent"}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-2"
              onClick={() => setAgentMode((value) => !value)}
            >
              {agentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="relative flex items-center gap-2">
          {agentMode && (
            <Button onClick={runAgentSearch} disabled={agentLoading}>
              {agentLoading ? "Recherche..." : "Rechercher"}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowFilters((value) => !value)}>
            Filtres
          </Button>
          {showFilters && (
            <div className="absolute right-0 top-10 w-80 bg-white border border-neutral-200 rounded-lg shadow-lg p-4 z-10">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1">Ville</label>
                  <Input
                    value={filters.city}
                    onChange={(event) => setFilters((prev) => ({ ...prev, city: event.target.value }))}
                    placeholder="Ville"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1">Code postal</label>
                  <Input
                    value={filters.postalCode}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, postalCode: event.target.value }))
                    }
                    placeholder="Code postal"
                  />
                </div>
                {!agentMode && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-800 mb-1">Specialite</label>
                    <select
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      value={filters.specialty}
                      onChange={(event) =>
                        setFilters((prev) => ({ ...prev, specialty: event.target.value }))
                      }
                    >
                      <option value="">Toutes</option>
                      {specialtyOptions.map((spec) => (
                        <option key={spec} value={spec}>
                          {spec}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilters({ city: "", postalCode: "", specialty: "" });
                      setShowFilters(false);
                    }}
                  >
                    Reinitialiser
                  </Button>
                  <Button size="sm" onClick={() => setShowFilters(false)}>
                    Appliquer
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {agentMode && agentError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {agentError}
        </div>
      )}

      {agentMode && agentInfo && (
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700">
          <div className="flex flex-wrap items-center gap-2">
            <span>Agent: </span>
            {agentInfo.tags.length ? (
              agentInfo.tags.map((tag) => (
                <span
                  key={`agent-tag-${tag}`}
                  className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 text-xs border border-neutral-200"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-neutral-500">aucun tag detecte</span>
            )}
            {agentInfo.city && <span className="text-neutral-500">ville: {agentInfo.city}</span>}
            {agentInfo.postal_code && (
              <span className="text-neutral-500">code postal: {agentInfo.postal_code}</span>
            )}
          </div>
        </div>
      )}

      {filterSummary && (
        <div className="text-sm text-neutral-600">Filtres actifs: {filterSummary}</div>
      )}

      {loading ? (
        <div className="text-sm text-neutral-600">Chargement des professionnels...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((professional) => {
            const proSpecialties = specialties[professional.pro_id] ?? [];
            return (
              <Card key={professional.pro_id}>
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {professional.company_name || professional.display_name || "Professionnel"}
                    </h3>
                    {professional.city && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 mt-2">
                        <MapPin className="w-4 h-4" />
                        <span>
                          {professional.city}
                          {professional.postal_code ? ` (${professional.postal_code})` : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {professional.company_description && (
                    <p className="text-sm text-gray-600 line-clamp-3">{professional.company_description}</p>
                  )}

                  {proSpecialties.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {proSpecialties.map((service) => (
                        <span
                          key={`${professional.pro_id}-${service}`}
                          className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs border border-neutral-200"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
                    {professional.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{professional.phone}</span>
                      </div>
                    )}
                    {professional.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span>{professional.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => handleOpenProfile(professional)}>
                      Voir le profil
                    </Button>
                    <Button className="flex-1" onClick={() => handleContact(professional)}>
                      Contacter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && profiles.length === 0 && (
        <div className="text-sm text-neutral-600">Aucun professionnel ne correspond a votre recherche.</div>
      )}

      
    </div>
  );
}

