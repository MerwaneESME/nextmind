/**
 * Recherche d'adresses - API BAN data.gouv.fr + Photon
 * https://adresse.data.gouv.fr/
 */

export type AddressSuggestion = {
  label: string;
  address: string;
  city: string;
  postalCode: string;
  department: string;
};

type ApiFeature = {
  type: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: {
    label: string;
    name?: string;
    housenumber?: string;
    street?: string;
    postcode: string;
    city: string;
    context?: string;
    type?: string;
  };
};

type ApiResponse = {
  type: string;
  features: ApiFeature[];
};

function extractDepartment(context: string | undefined): string {
  if (!context) return "";
  const part = context.split(",")[0]?.trim();
  return part || "";
}

function mapFeaturesToSuggestions(data: ApiResponse): AddressSuggestion[] {
  if (!data.features?.length) return [];
  return data.features.map((f) => {
    const { label, name, postcode, city, context } = f.properties;
    const address = (name || label.split(" ").slice(0, -2).join(" ") || label).trim();
    return {
      label,
      address,
      city,
      postalCode: postcode,
      department: extractDepartment(context),
    };
  });
}

async function searchViaProxy(query: string, limit: number): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await fetch(`/api/address-search?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data: ApiResponse = await res.json();
  return mapFeaturesToSuggestions(data);
}

async function searchDirect(query: string, limit: number): Promise<AddressSuggestion[]> {
  const url = `https://api-adresse.data.gouv.fr/search/?${new URLSearchParams({ q: query, limit: String(limit) })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data: ApiResponse = await res.json();
  return mapFeaturesToSuggestions(data);
}

async function searchPhoton(query: string, limit: number): Promise<AddressSuggestion[]> {
  const url = `https://photon.komoot.io/api/?${new URLSearchParams({ q: query, limit: String(limit) })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.features?.length) return [];
  return data.features
    .filter((f: { properties?: { countrycode?: string } }) => f.properties?.countrycode === "FR")
    .slice(0, limit)
    .map((f: {
      properties: {
        housenumber?: string;
        street?: string;
        postcode?: string;
        city?: string;
      };
    }) => {
      const p = f.properties;
      const street = [p.housenumber, p.street].filter(Boolean).join(" ") || p.street || "";
      const address = street.trim();
      const city = p.city || "";
      const postalCode = p.postcode || "";
      const dept =
        postalCode.length >= 3 && postalCode.startsWith("97")
          ? postalCode.slice(0, 3)
          : postalCode.slice(0, 2);
      const label = [address, postalCode, city].filter(Boolean).join(" ");
      return { label, address, city, postalCode, department: dept };
    });
}

export async function searchAddresses(query: string, limit = 5): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const results = await searchDirect(q, limit);
    if (results.length > 0) return results;
  } catch {
    // Continue
  }
  try {
    const results = await searchViaProxy(q, limit);
    if (results.length > 0) return results;
  } catch {
    // Continue
  }
  try {
    return await searchPhoton(q, limit);
  } catch {
    return [];
  }
}
