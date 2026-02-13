"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MapLibre = any;

type ProMapItem = {
  pro_id: string;
  title: string;
  city?: string | null;
  postal_code?: string | null;
  specialties?: string[];
  lat?: number | null;
  lng?: number | null;
  addressLabel?: string | null;
};

type UserLocation = { lat: number; lng: number };

type Props = {
  items: ProMapItem[];
  selectedProId?: string | null;
  onSelectProId?: (proId: string) => void;
  onUserLocation?: (loc: UserLocation | null) => void;
  className?: string;
};

const MAPLIBRE_JS = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.min.js";
const MAPLIBRE_CSS = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.min.css";

const FRANCE_FALLBACK: { center: [number, number]; zoom: number } = {
  center: [2.2137, 46.2276],
  zoom: 4.7,
};

const toTitle = (value: string) => value || "Professionnel";

const normalizeAddressLabel = (item: ProMapItem) => {
  const parts = [item.addressLabel, item.postal_code, item.city].filter(Boolean);
  const label = parts.join(" ");
  return label.trim() || null;
};

async function ensureMapLibreLoaded(): Promise<MapLibre> {
  if (typeof window === "undefined") return null;
  const w = window as any;
  if (w.maplibregl) return w.maplibregl;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-maplibre]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("MapLibre failed")), { once: true });
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = MAPLIBRE_CSS;
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = MAPLIBRE_JS;
    script.async = true;
    script.dataset.maplibre = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("MapLibre failed"));
    document.head.appendChild(script);
  });

  return (window as any).maplibregl;
}

const getGeocodeQuery = (item: ProMapItem) => {
  const q = [item.addressLabel, item.postal_code, item.city].filter(Boolean).join(" ");
  return q.trim();
};

const geocodeCacheKey = (q: string) => `nm:pro-geocode:${q.toLowerCase()}`;

async function geocodeFrance(query: string, signal: AbortSignal): Promise<UserLocation | null> {
  const cached = typeof window !== "undefined" ? window.localStorage.getItem(geocodeCacheKey(query)) : null;
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as UserLocation;
      if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") return parsed;
    } catch {
      // ignore
    }
  }

  const url = new URL("https://api-adresse.data.gouv.fr/search/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) return null;
  const payload = await response.json();
  const feature = payload?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const loc = { lng: Number(coords[0]), lat: Number(coords[1]) };
  if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null;

  try {
    window.localStorage.setItem(geocodeCacheKey(query), JSON.stringify(loc));
  } catch {
    // ignore
  }
  return loc;
}

export function ProfessionnelsMap({
  items,
  selectedProId,
  onSelectProId,
  onUserLocation,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const popupRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [geocoded, setGeocoded] = useState<Record<string, UserLocation>>({});

  const features = useMemo(() => {
    const rows = items
      .map((item) => {
        const title = toTitle(item.title);
        const hasCoords = typeof item.lat === "number" && typeof item.lng === "number";
        const coords = hasCoords ? { lat: item.lat as number, lng: item.lng as number } : geocoded[item.pro_id];
        if (!coords) return null;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [coords.lng, coords.lat] },
          properties: {
            pro_id: item.pro_id,
            title,
            city: item.city ?? "",
            postal_code: item.postal_code ?? "",
            specialties: (item.specialties ?? []).slice(0, 6).join(" • "),
            address: normalizeAddressLabel(item) ?? "",
          },
        };
      })
      .filter(Boolean);

    return {
      type: "FeatureCollection",
      features: rows,
    };
  }, [items, geocoded]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const maplibregl = await ensureMapLibreLoaded();
        if (!maplibregl || cancelled) return;
        if (!containerRef.current) return;
        if (mapRef.current) return;

        mapRef.current = new maplibregl.Map({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenStreetMap",
              },
            },
            layers: [{ id: "osm", type: "raster", source: "osm" }],
          },
          center: FRANCE_FALLBACK.center,
          zoom: FRANCE_FALLBACK.zoom,
        });

        popupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 14,
        });

        mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

        mapRef.current.on("load", () => {
          if (cancelled) return;
          setMapReady(true);
        });
      } catch {
        // ignore: the page still works without map
      }
    };
    void run();

    return () => {
      cancelled = true;
      try {
        popupRef.current?.remove?.();
        mapRef.current?.remove?.();
      } catch {
        // ignore
      } finally {
        popupRef.current = null;
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const srcId = "pros";
    const existing = map.getSource?.(srcId);
    if (!existing) {
      map.addSource(srcId, {
        type: "geojson",
        data: features as any,
        cluster: true,
        clusterRadius: 46,
        clusterMaxZoom: 12,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: srcId,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#38b6ff", 15, "#285bd6", 50, "#1800ad"],
          "circle-radius": ["step", ["get", "point_count"], 16, 15, 20, 50, 26],
          "circle-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: srcId,
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: srcId,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#285bd6",
          "circle-radius": 6,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "selected-point",
        type: "circle",
        source: srcId,
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "pro_id"], selectedProId ?? ""]],
        paint: {
          "circle-color": "#1800ad",
          "circle-radius": 9,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "clusters", async (e: any) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features?.[0]?.properties?.cluster_id;
        const source = map.getSource(srcId);
        if (!source?.getClusterExpansionZoom) return;
        source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          const coords = features?.[0]?.geometry?.coordinates;
          if (!Array.isArray(coords)) return;
          map.easeTo({ center: coords, zoom, duration: 420 });
        });
      });

      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("mouseenter", "unclustered-point", (e: any) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e?.features?.[0];
        const coords = f?.geometry?.coordinates;
        const props = f?.properties;
        if (!Array.isArray(coords) || !props) return;
        const html = `
          <div style="min-width:220px;max-width:260px">
            <div style="font-weight:700;color:#111827;margin-bottom:4px">${String(props.title)}</div>
            <div style="font-size:12px;color:#4b5563">${String(props.city)} ${String(props.postal_code ? `(${props.postal_code})` : "")}</div>
            ${
              props.specialties
                ? `<div style="margin-top:6px;font-size:12px;color:#374151">${String(props.specialties)}</div>`
                : ""
            }
          </div>`;
        popupRef.current?.setLngLat(coords).setHTML(html).addTo(map);
      });

      map.on("mouseleave", "unclustered-point", () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove?.();
      });

      map.on("click", "unclustered-point", (e: any) => {
        const f = e?.features?.[0];
        const props = f?.properties;
        const proId = props?.pro_id ? String(props.pro_id) : null;
        if (!proId) return;
        onSelectProId?.(proId);
      });
    } else {
      existing.setData(features as any);
    }

    try {
      map.setFilter("selected-point", [
        "all",
        ["!", ["has", "point_count"]],
        ["==", ["get", "pro_id"], selectedProId ?? ""],
      ]);
    } catch {
      // ignore
    }
  }, [features, mapReady, onSelectProId, selectedProId]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedProId) return;
    const map = mapRef.current;
    const source: any = map.getSource?.("pros");
    if (!source) return;

    const f = (features as any)?.features?.find((x: any) => x?.properties?.pro_id === selectedProId);
    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords)) return;

    map.easeTo({ center: coords, zoom: Math.max(map.getZoom?.() ?? 10, 11), duration: 500 });
  }, [features, mapReady, selectedProId]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (!navigator?.geolocation) {
      onUserLocation?.(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onUserLocation?.(loc);
        try {
          mapRef.current?.easeTo?.({ center: [loc.lng, loc.lat], zoom: 10.5, duration: 600 });
        } catch {
          // ignore
        }
      },
      () => {
        onUserLocation?.(null);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 }
    );
  }, [mapReady, onUserLocation]);

  useEffect(() => {
    const missing = items
      .filter(
        (item) =>
          !(typeof item.lat === "number" && typeof item.lng === "number") && !geocoded[item.pro_id]
      )
      .slice(0, 40);
    if (!missing.length) return;

    const controller = new AbortController();
    let alive = true;

    const run = async () => {
      for (const item of missing) {
        if (!alive) return;
        const q = getGeocodeQuery(item);
        if (!q) continue;
        const loc = await geocodeFrance(q, controller.signal);
        if (!loc) continue;
        if (!alive) return;
        setGeocoded((prev) => (prev[item.pro_id] ? prev : { ...prev, [item.pro_id]: loc }));
      }
    };

    void run();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [geocoded, items]);

  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full rounded-2xl border border-neutral-200 bg-white shadow-sm" />
    </div>
  );
}
