"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProfessionnelsMap } from "@/components/professionnels/ProfessionnelsMap";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  MapPin,
  Phone,
  SlidersHorizontal,
  Star,
} from "lucide-react";
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
  [key: string]: unknown;
};

type Filters = {
  city: string;
  postalCode: string;
  specialty: string;
};

const buildSearchPattern = (value: string) => `%${value}%`;

type UserLocation = { lat: number; lng: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeSearchText = (value: string) =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toTagKey = (value: string) => normalizeSearchText(value);

const TAG_LABEL_OVERRIDES: Record<string, string> = {
  electricite: "Électricité",
  etancheite: "Étanchéité",
  maconnerie: "Maçonnerie",
  "gros oeuvre": "Gros œuvre",
  plomberie: "Plomberie",
  renovation: "Rénovation",
};

const toTagLabel = (value: string) => {
  const key = toTagKey(value);
  if (!key) return "";
  const mapped = TAG_LABEL_OVERRIDES[key] ?? key;
  return mapped.charAt(0).toLocaleUpperCase("fr-FR") + mapped.slice(1);
};

const extractNumber = (value: unknown) => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};

const extractLatLng = (profile: ProProfile): { lat: number; lng: number } | null => {
  const candidates = [
    { lat: profile.latitude, lng: profile.longitude },
    { lat: profile.lat, lng: profile.lng },
    { lat: profile.geo_lat, lng: profile.geo_lng },
    { lat: (profile as any).location_lat, lng: (profile as any).location_lng },
  ] as Array<{ lat: unknown; lng: unknown }>;

  for (const c of candidates) {
    const lat = extractNumber(c.lat);
    const lng = extractNumber(c.lng);
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  }
  return null;
};

const getRating = (profile: ProProfile) => {
  const avg =
    extractNumber(profile.rating_avg) ??
    extractNumber(profile.rating_average) ??
    extractNumber(profile.avg_rating) ??
    extractNumber((profile as any).note_moyenne);

  const count =
    extractNumber(profile.reviews_count) ??
    extractNumber(profile.rating_count) ??
    extractNumber((profile as any).avis_count);

  return {
    avg: avg === null ? null : clamp(avg, 0, 5),
    count: count === null ? null : Math.max(0, Math.round(count)),
  };
};

const haversineKm = (a: UserLocation, b: UserLocation) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
};

const formatDistance = (km: number) => {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
};

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

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [distanceKm, setDistanceKm] = useState(50);
  const [sortBy, setSortBy] = useState<"distance" | "note" | "popularite">("distance");
  const [selectedProId, setSelectedProId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [geocodedCoords, setGeocodedCoords] = useState<Record<string, UserLocation>>({});
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const listRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
        .select("*");

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
      setSelectedProId((prev) => (prev && rows.some((p) => p.pro_id === prev) ? prev : null));

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
      setSelectedProId((prev) => (prev && rows.some((p) => p.pro_id === prev) ? prev : null));
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

  useEffect(() => {
    if (!selectedProId) return;
    const el = listRefs.current[selectedProId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedProId]);

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

  const profileById = useMemo(() => {
    const map = new Map<string, ProProfile>();
    profiles.forEach((p) => map.set(p.pro_id, p));
    return map;
  }, [profiles]);

  const filterSummary = useMemo(() => {
    const parts = [];
    if (filters.city.trim()) parts.push(`Ville: ${filters.city}`);
    if (filters.postalCode.trim()) parts.push(`Code postal: ${filters.postalCode}`);
    if (!agentMode && filters.specialty.trim()) parts.push(`Spécialité: ${filters.specialty}`);
    return parts.join(" | ");
  }, [agentMode, filters]);

  const tagOptions = useMemo(() => {
    const specTags = Array.from(
      new Set(Object.values(specialties).flat().map((t) => t.trim()).filter(Boolean))
    );
    const agentTags = (agentInfo?.tags ?? []).map((t) => t.trim()).filter(Boolean);

    const map = new Map<string, string>();
    for (const raw of [...agentTags, ...specTags]) {
      const key = toTagKey(raw);
      if (!key) continue;
      if (!map.has(key)) map.set(key, toTagLabel(raw));
    }

    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [agentInfo?.tags, specialties]);

  const isAreaSearchActive = useMemo(() => {
    const cityOrPostal = Boolean(filters.city.trim() || filters.postalCode.trim());
    const agentCityOrPostal = Boolean(agentInfo?.city || agentInfo?.postal_code);
    return cityOrPostal || (agentMode && agentCityOrPostal);
  }, [agentInfo?.city, agentInfo?.postal_code, agentMode, filters.city, filters.postalCode]);

  const normalizedProfiles = useMemo(() => {
    return profiles.map((p) => {
      const title = p.company_name || p.display_name || "Professionnel";
      const proSpecialties = specialties[p.pro_id] ?? [];
      const coords = extractLatLng(p) ?? geocodedCoords[p.pro_id] ?? null;
      const rating = getRating(p);
      const description = (p.company_description ?? "").toString();
      return {
        raw: p,
        pro_id: p.pro_id,
        title,
        city: p.city,
        postal_code: p.postal_code,
        phone: p.phone,
        email: p.email,
        address: p.address,
        company_description: description,
        specialties: proSpecialties,
        coords,
        rating,
      };
    });
  }, [geocodedCoords, profiles, specialties]);

  const filteredAndSorted = useMemo(() => {
    const tags = selectedTags;
    const hasTags = tags.length > 0;

    const rows = normalizedProfiles
      .map((p) => {
        const distance = userLocation && p.coords ? haversineKm(userLocation, p.coords) : null;
        return { ...p, distance };
      })
      .filter((p) => {
        if (!hasTags) return true;
        const hay = normalizeSearchText(`${p.title} ${p.company_description} ${(p.specialties ?? []).join(" ")}`);
        return tags.every((t) => hay.includes(t));
      })
      .filter((p) => {
        if (!userLocation) return true;
        if (isAreaSearchActive) return true;
        if (!distanceKm) return true;
        if (p.distance === null) return true;
        return p.distance <= distanceKm;
      });

    const withTieBreaker = (a: any, b: any) => a.title.localeCompare(b.title, "fr");

    if (sortBy === "distance") {
      rows.sort((a, b) => {
        if (a.distance === null && b.distance === null) return withTieBreaker(a, b);
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        if (a.distance !== b.distance) return a.distance - b.distance;
        return withTieBreaker(a, b);
      });
    } else if (sortBy === "note") {
      rows.sort((a, b) => {
        const ar = a.rating.avg ?? -1;
        const br = b.rating.avg ?? -1;
        if (ar !== br) return br - ar;
        const ac = a.rating.count ?? 0;
        const bc = b.rating.count ?? 0;
        if (ac !== bc) return bc - ac;
        return withTieBreaker(a, b);
      });
    } else {
      rows.sort((a, b) => {
        const ap = a.rating.count ?? 0;
        const bp = b.rating.count ?? 0;
        if (ap !== bp) return bp - ap;
        return withTieBreaker(a, b);
      });
    }

    return rows;
  }, [distanceKm, isAreaSearchActive, normalizedProfiles, selectedTags, sortBy, userLocation]);

  const [visibleCount, setVisibleCount] = useState(18);
  useEffect(() => setVisibleCount(18), [search, filters, agentMode, selectedTags, distanceKm, sortBy]);

  const distanceMin = 5;
  const distanceMax = 150;
  const distancePct = useMemo(() => {
    const clamped = Math.min(distanceMax, Math.max(distanceMin, distanceKm));
    return ((clamped - distanceMin) / (distanceMax - distanceMin)) * 100;
  }, [distanceKm]);

  const visibleRows = useMemo(
    () => filteredAndSorted.slice(0, visibleCount),
    [filteredAndSorted, visibleCount]
  );

  const mapItems = useMemo(() => {
    return filteredAndSorted.map((p) => ({
      pro_id: p.pro_id,
      title: p.title,
      city: p.city,
      postal_code: p.postal_code,
      specialties: p.specialties,
      lat: p.coords?.lat ?? null,
      lng: p.coords?.lng ?? null,
      addressLabel: p.address ?? null,
    }));
  }, [filteredAndSorted]);

  const renderStars = (avg: number | null) => {
    const v = avg ?? 0;
    const full = Math.round(v);
    return (
      <div className="inline-flex items-center gap-1 text-xs text-neutral-600">
        <div className="flex items-center">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${i < full ? "fill-warning-500 text-warning-500" : "text-neutral-300"}`}
            />
          ))}
        </div>
        <span>{avg === null ? "Non noté" : avg.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
        <div className="relative flex items-start justify-between gap-6 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-sm">
              <MapPin className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">
                Trouver un professionnel près de chez vous
              </h1>
              <p className="text-neutral-600 mt-1">
                Recherchez par spécialité, zone d’intervention ou laissez l’agent vous guider.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
                  {filteredAndSorted.length} résultat{filteredAndSorted.length > 1 ? "s" : ""}
                </span>
                {filterSummary && (
                  <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
                    Filtres actifs: {filterSummary}
                  </span>
                )}
              </div>
            </div>
          </div>
          <img
            src="/images/pro.png"
            alt="Professionnels"
            className="hidden sm:block h-20 w-20 object-contain opacity-90 logo-blend"
          />
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
        <div className="relative z-10 p-4 sm:p-6 space-y-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
              <div className="relative">
                {agentMode ? (
                  <textarea
                    className={`w-full min-h-[104px] rounded-2xl border border-neutral-300 px-4 pt-3 pb-3 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-primary-500 ${agentPulseClass}`}
                    placeholder="Décrivez votre projet (ex: rénovation maison, plomberie, salle de bain, budget, délais)…"
                    value={agentQuery}
                    onChange={(event) => setAgentQuery(event.target.value)}
                  />
                ) : (
                  <Input
                    className="rounded-2xl py-3 text-sm"
                    placeholder="Nom, spécialité, ville, code postal…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={agentMode ? "primary" : "outline"}
                  className={`h-[46px] w-full md:w-auto rounded-2xl ${agentMode ? "!text-white" : ""}`}
                  onClick={() => {
                    setAgentMode((v) => !v);
                    setAgentError(null);
                  }}
                  title={agentMode ? "Recherche intelligente activée" : "Activer la recherche intelligente"}
                >
                  <span className={`inline-flex items-center gap-2 ${agentMode ? "!text-white" : ""}`}>
                    {agentLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                    <span className={`whitespace-nowrap ${agentMode ? "!text-white" : ""}`}>
                      Recherche intelligente
                    </span>
                  </span>
                </Button>
                {agentMode && (
                  <Button className="h-[46px] rounded-2xl" onClick={runAgentSearch} disabled={agentLoading}>
                    {agentLoading ? "Analyse..." : "Lancer"}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Input
                label="Ville"
                value={filters.city}
                onChange={(event) => setFilters((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="Paris, Lyon…"
              />
              <Input
                label="Code postal"
                value={filters.postalCode}
                onChange={(event) => setFilters((prev) => ({ ...prev, postalCode: event.target.value }))}
                placeholder="75000…"
              />
              <div>
                <label className="block text-sm font-medium text-neutral-800 mb-1.5">Spécialité</label>
                <select
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={filters.specialty}
                  onChange={(event) => setFilters((prev) => ({ ...prev, specialty: event.target.value }))}
                  disabled={agentMode}
                >
                  <option value="">Toutes</option>
                  {specialtyOptions.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
                {agentMode && (
                  <div className="mt-1 text-xs text-neutral-500">La spécialité est définie par l’agent.</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-2xl" onClick={() => setShowFilters((v) => !v)}>
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtres avancés
                  {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </Button>
              <div className="min-w-[190px]">
                <label className="sr-only">Trier</label>
                <select
                  className="w-full border border-neutral-300 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="distance">Tri: Distance</option>
                  <option value="note">Tri: Note</option>
                  <option value="popularite">Tri: Popularité</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <Button variant="outline" className="rounded-2xl" onClick={() => setMobileListOpen(true)}>
                Voir la liste
              </Button>
            </div>

            <Button
              variant="ghost"
              className="rounded-2xl"
              onClick={() => {
                setSearch("");
                setSelectedTags([]);
                setDistanceKm(50);
                setFilters({ city: "", postalCode: "", specialty: "" });
                setAgentInfo(null);
                setAgentError(null);
                setAgentQuery("");
              }}
            >
              Réinitialiser
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/40 p-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-neutral-900">Tags</div>
                  {selectedTags.length > 0 && (
                    <button
                      className="text-xs text-neutral-600 hover:text-neutral-900"
                      onClick={() => setSelectedTags([])}
                      type="button"
                    >
                      Effacer
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tagOptions.slice(0, 24).map((tag) => {
                    const active = selectedTags.includes(tag.key);
                    return (
                      <button
                        key={tag.key}
                        type="button"
                        onClick={() =>
                          setSelectedTags((prev) =>
                            prev.includes(tag.key)
                              ? prev.filter((t) => t !== tag.key)
                              : [...prev, tag.key]
                          )
                        }
                        className={[
                          "px-3 py-1 rounded-full text-xs border transition",
                          active
                            ? "bg-primary-600 text-white border-primary-600"
                            : "bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-50",
                        ].join(" ")}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                  {tagOptions.length === 0 && (
                    <div className="text-xs text-neutral-600">Les tags apparaîtront après une recherche.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-neutral-900">Distance</div>
                    <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700">
                      Autour de moi
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600">
                    {!userLocation
                      ? "Géoloc. requise"
                      : isAreaSearchActive
                        ? "Désactivé (ville/CP)"
                        : `${distanceKm} km`}
                  </div>
                </div>

                <div className="mt-3 grid gap-3">
                  <input
                    type="range"
                    min={distanceMin}
                    max={distanceMax}
                    step={5}
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(Number(e.target.value))}
                    disabled={!userLocation || isAreaSearchActive}
                    className={[
                      "w-full h-2 rounded-full appearance-none cursor-pointer",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    ].join(" ")}
                    style={{
                      background: `linear-gradient(to right, rgb(40 91 214) 0%, rgb(40 91 214) ${distancePct}%, rgb(213 215 220) ${distancePct}%, rgb(213 215 220) 100%)`,
                    }}
                  />

                  <div className="flex items-center justify-between text-[11px] text-neutral-500">
                    <span>{distanceMin} km</span>
                    <span>{distanceMax} km</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[10, 25, 50, 100, 150].map((v) => {
                      const active = distanceKm === v;
                      const disabled = !userLocation || isAreaSearchActive;
                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={disabled}
                          onClick={() => setDistanceKm(v)}
                          className={[
                            "px-3 py-1 rounded-full text-xs border transition",
                            disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-neutral-50",
                            active
                              ? "bg-primary-600 text-white border-primary-600"
                              : "bg-white text-neutral-800 border-neutral-200",
                          ].join(" ")}
                        >
                          {v} km
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2 text-xs text-neutral-600">
                  {!userLocation
                    ? "Activez la localisation dans votre navigateur pour trier/filtrer par distance."
                    : isAreaSearchActive
                      ? "Distance désactivée car une ville ou un code postal est renseigné."
                      : "Filtre les pros autour de votre position."}
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </section>

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

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="h-[62vh] lg:h-[72vh]">
            <ProfessionnelsMap
              items={mapItems}
              selectedProId={selectedProId}
              onSelectProId={(proId) => {
                setSelectedProId(proId);
                if (typeof window !== "undefined" && window.innerWidth < 1024) setMobileListOpen(true);
              }}
              onUserLocation={(loc) => setUserLocation(loc)}
              onGeocoded={(proId, loc) =>
                setGeocodedCoords((prev) => (prev[proId] ? prev : { ...prev, [proId]: loc }))
              }
              onOpenProfile={(proId) => {
                const pro = profileById.get(proId);
                if (!pro) return;
                handleOpenProfile(pro);
              }}
              onContact={(proId) => {
                const pro = profileById.get(proId);
                if (!pro) return;
                handleContact(pro);
              }}
              className="h-full"
            />
          </div>
          <div className="mt-2 text-xs text-neutral-600">
            Astuce: survolez un pin pour voir un aperçu. Cliquez pour synchroniser avec la liste.
          </div>
        </div>

        <div className="hidden lg:block lg:col-span-5">
          <div className="rounded-3xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-neutral-100 px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-900">Professionnels</div>
                <div className="text-xs text-neutral-600">{filteredAndSorted.length} résultat(s)</div>
              </div>
              {userLocation ? (
                <div className="text-xs text-neutral-600">Tri distance actif</div>
              ) : (
                <div className="text-xs text-neutral-500">Localisation non disponible</div>
              )}
            </div>

            <div className="max-h-[72vh] overflow-auto p-4 space-y-3">
              {loading ? (
                <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
                  <div className="relative p-6 text-center text-sm text-neutral-600">
                    Chargement des professionnels...
                  </div>
                </div>
              ) : (
                <>
                  {visibleRows.map((p) => {
                    const isActive = selectedProId === p.pro_id;
                    const distanceLabel = p.distance === null ? null : formatDistance(p.distance);
                    return (
                      <div
                        key={p.pro_id}
                        ref={(el) => {
                          listRefs.current[p.pro_id] = el;
                        }}
                      >
                        <Card
                          className={[
                            "relative overflow-hidden transition cursor-pointer rounded-2xl",
                            isActive
                              ? "border-primary-300 shadow-md"
                              : "hover:shadow-md hover:-translate-y-[1px]",
                          ].join(" ")}
                          onClick={() => setSelectedProId(p.pro_id)}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
                          <CardContent className="relative z-10 p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="truncate text-base font-semibold text-neutral-900">{p.title}</h3>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
                                  {(p.city || p.postal_code) && (
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin className="h-3.5 w-3.5" />
                                      {p.city || "-"}
                                      {p.postal_code ? ` (${p.postal_code})` : ""}
                                    </span>
                                  )}
                                  {distanceLabel && <span>à {distanceLabel}</span>}
                                </div>
                              </div>
                              <div className="shrink-0">{renderStars(p.rating.avg)}</div>
                            </div>

                            {p.company_description && (
                              <p className="mt-3 text-sm text-neutral-700 line-clamp-2">{p.company_description}</p>
                            )}

                            {p.specialties.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {p.specialties.slice(0, 6).map((service) => (
                                  <span
                                    key={`${p.pro_id}-${toTagKey(service) || service}`}
                                    className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs border border-neutral-200"
                                  >
                                    {toTagLabel(service) || service}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="mt-4 grid gap-2 sm:grid-cols-2 text-xs text-neutral-700">
                              {p.phone && (
                                <div className="inline-flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-neutral-500" />
                                  <span className="truncate">{p.phone}</span>
                                </div>
                              )}
                              {p.email && (
                                <div className="inline-flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-neutral-500" />
                                  <span className="truncate">{p.email}</span>
                                </div>
                              )}
                            </div>

                            <div className="mt-4 flex gap-2">
                              <Button
                                variant="outline"
                                className="flex-1 rounded-xl"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenProfile(p.raw);
                                }}
                              >
                                Voir profil
                              </Button>
                              <Button
                                className="flex-1 rounded-xl"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleContact(p.raw);
                                }}
                              >
                                Contacter
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}

                  {!loading && filteredAndSorted.length === 0 && (
                    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
                      <div className="relative p-6 text-center text-sm text-neutral-600">
                        Aucun professionnel ne correspond à votre recherche.
                      </div>
                    </div>
                  )}

                  {!loading && filteredAndSorted.length > visibleRows.length && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        className="w-full rounded-2xl"
                        onClick={() => setVisibleCount((v) => v + 18)}
                      >
                        Afficher plus
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile drawer */}
      <div
        className={["lg:hidden fixed inset-0 z-50", mobileListOpen ? "" : "pointer-events-none"].join(" ")}
        aria-hidden={!mobileListOpen}
      >
        <div
          className={[
            "absolute inset-0 bg-black/30 transition-opacity",
            mobileListOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
          onClick={() => setMobileListOpen(false)}
        />
        <div
          className={[
            "absolute inset-x-0 bottom-0 max-h-[82vh] rounded-t-3xl bg-white shadow-2xl border border-neutral-200",
            "transition-transform duration-300",
            mobileListOpen ? "translate-y-0" : "translate-y-full",
          ].join(" ")}
        >
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Professionnels</div>
              <div className="text-xs text-neutral-600">{filteredAndSorted.length} résultat(s)</div>
            </div>
            <Button variant="outline" className="rounded-2xl" onClick={() => setMobileListOpen(false)}>
              Fermer
            </Button>
          </div>
          <div className="p-4 overflow-auto max-h-[72vh] space-y-3">
            {loading ? (
              <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
                <div className="relative p-6 text-center text-sm text-neutral-600">
                  Chargement des professionnels...
                </div>
              </div>
            ) : (
              <>
                {visibleRows.map((p) => {
                  const isActive = selectedProId === p.pro_id;
                  const distanceLabel = p.distance === null ? null : formatDistance(p.distance);
                  return (
                    <div
                      key={p.pro_id}
                      ref={(el) => {
                        listRefs.current[p.pro_id] = el;
                      }}
                    >
                      <Card
                        className={[
                          "relative overflow-hidden transition cursor-pointer rounded-2xl",
                          isActive ? "border-primary-300 shadow-md" : "hover:shadow-md hover:-translate-y-[1px]",
                        ].join(" ")}
                        onClick={() => setSelectedProId(p.pro_id)}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
                        <CardContent className="relative z-10 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-semibold text-neutral-900">{p.title}</h3>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
                                {(p.city || p.postal_code) && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {p.city || "-"}
                                    {p.postal_code ? ` (${p.postal_code})` : ""}
                                  </span>
                                )}
                                {distanceLabel && <span>à {distanceLabel}</span>}
                              </div>
                            </div>
                            <div className="shrink-0">{renderStars(p.rating.avg)}</div>
                          </div>

                          {p.company_description && (
                            <p className="mt-3 text-sm text-neutral-700 line-clamp-2">{p.company_description}</p>
                          )}

                          {p.specialties.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {p.specialties.slice(0, 6).map((service) => (
                                <span
                                  key={`${p.pro_id}-${toTagKey(service) || service}`}
                                  className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs border border-neutral-200"
                                >
                                  {toTagLabel(service) || service}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-4 flex gap-2">
                            <Button
                              variant="outline"
                              className="flex-1 rounded-xl"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenProfile(p.raw);
                              }}
                            >
                              Voir profil
                            </Button>
                            <Button
                              className="flex-1 rounded-xl"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleContact(p.raw);
                              }}
                            >
                              Contacter
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}

                {!loading && filteredAndSorted.length > visibleRows.length && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      className="w-full rounded-2xl"
                      onClick={() => setVisibleCount((v) => v + 18)}
                    >
                      Afficher plus
                    </Button>
                  </div>
                )}

                {!loading && filteredAndSorted.length === 0 && (
                  <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-white" />
                    <div className="relative p-6 text-center text-sm text-neutral-600">
                      Aucun professionnel ne correspond à votre recherche.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

