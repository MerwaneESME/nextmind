/**
 * Géocodage d'adresses : Nominatim (OSM) en priorité pour précision, BAN en fallback
 */

export type GeoCoords = { lat: number; lng: number };

const CACHE_KEY_PREFIX = "nm:geocode-v2:";

function cacheKey(query: string): string {
  return `${CACHE_KEY_PREFIX}${query.toLowerCase().trim()}`;
}

async function geocodeNominatim(query: string, signal?: AbortSignal): Promise<GeoCoords | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query}, France`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    signal,
    headers: { "User-Agent": "NextMind/1.0 (https://nextmind.fr)" },
  });
  if (!response.ok) return null;
  const results = await response.json();
  const first = Array.isArray(results) ? results[0] : null;
  if (!first?.lat || !first?.lon) return null;
  return { lat: Number(first.lat), lng: Number(first.lon) };
}

async function geocodeBAN(query: string, signal?: AbortSignal): Promise<GeoCoords | null> {
  const url = new URL("https://api-adresse.data.gouv.fr/search/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) return null;
  const payload = await response.json();
  const feature = payload?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  return { lng: Number(coords[0]), lat: Number(coords[1]) };
}

export async function geocodeAddress(
  query: string,
  signal?: AbortSignal
): Promise<GeoCoords | null> {
  const q = query.trim();
  if (!q) return null;

  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem(cacheKey(q));
      if (cached) {
        const parsed = JSON.parse(cached) as GeoCoords;
        if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") return parsed;
      }
    } catch {
      // ignore
    }
  }

  let loc: GeoCoords | null = null;
  if (q.length > 10) loc = await geocodeNominatim(q, signal);
  if (!loc) loc = await geocodeBAN(q, signal);
  if (!loc) return null;

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(cacheKey(q), JSON.stringify(loc));
    }
  } catch {
    // ignore
  }
  return loc;
}

/**
 * Construit une requête de géocodage à partir des champs d'adresse du profil
 */
export function buildAddressQuery(profile: {
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
}): string {
  const parts = [
    profile.address,
    profile.postal_code,
    profile.city,
  ]
    .filter(Boolean)
    .map((s) => String(s).trim());
  return parts.join(" ");
}
