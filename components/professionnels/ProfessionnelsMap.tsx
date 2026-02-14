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
  onGeocoded?: (proId: string, loc: UserLocation) => void;
  onOpenProfile?: (proId: string) => void;
  onContact?: (proId: string) => void;
  className?: string;
};

const MAPLIBRE_JS = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.min.js";
const MAPLIBRE_CSS = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.min.css";

const PARIS_DEFAULT: { center: [number, number]; zoom: number } = {
  center: [2.3522, 48.8566],
  zoom: 13.2,
};

const toTitle = (value: string) => value || "Professionnel";

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const CITY_CENTERS: Record<string, UserLocation> = {
  paris: { lat: 48.8566, lng: 2.3522 },
  lille: { lat: 50.6292, lng: 3.0573 },
  lyon: { lat: 45.764, lng: 4.8357 },
  marseille: { lat: 43.2965, lng: 5.3698 },
  toulouse: { lat: 43.6047, lng: 1.4442 },
  bordeaux: { lat: 44.8378, lng: -0.5792 },
  nantes: { lat: 47.2184, lng: -1.5536 },
  nice: { lat: 43.7102, lng: 7.262 },
  strasbourg: { lat: 48.5734, lng: 7.7521 },
  montpellier: { lat: 43.6108, lng: 3.8767 },
  rennes: { lat: 48.1173, lng: -1.6778 },
};

const extractCityAndPostal = (item: ProMapItem) => {
  const rawCity = (item.city ?? "").toString().trim();
  const rawPostal = (item.postal_code ?? "").toString().trim();
  const postalMatch = rawPostal.match(/\b\d{5}\b/) ?? rawCity.match(/\b\d{5}\b/);
  const postal = postalMatch?.[0] ?? "";

  const cityClean = rawCity
    .replace(/\(\s*\d{5}\s*\)/g, " ")
    .replace(/\b\d{5}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { city: cityClean, postal };
};

const inferCoords = (item: ProMapItem): UserLocation | null => {
  const { city, postal } = extractCityAndPostal(item);
  const cityKey = city ? normalizeKey(city) : "";
  if (cityKey && CITY_CENTERS[cityKey]) return CITY_CENTERS[cityKey];
  if (postal.startsWith("75")) return CITY_CENTERS.paris;
  if (postal.startsWith("59")) return CITY_CENTERS.lille;
  if (postal.startsWith("69")) return CITY_CENTERS.lyon;
  if (postal.startsWith("13")) return CITY_CENTERS.marseille;
  if (postal.startsWith("31")) return CITY_CENTERS.toulouse;
  if (postal.startsWith("33")) return CITY_CENTERS.bordeaux;
  if (postal.startsWith("44")) return CITY_CENTERS.nantes;
  if (postal.startsWith("06")) return CITY_CENTERS.nice;
  if (postal.startsWith("67")) return CITY_CENTERS.strasbourg;
  if (postal.startsWith("34")) return CITY_CENTERS.montpellier;
  if (postal.startsWith("35")) return CITY_CENTERS.rennes;
  return null;
};

const hashString = (value: string) => {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return hash >>> 0;
};

const jitterCoords = (base: UserLocation, key: string) => {
  const h = hashString(key);
  const angle = ((h % 360) * Math.PI) / 180;
  const radiusM = 30 + (h % 140); // 30m..169m
  const dx = radiusM * Math.cos(angle);
  const dy = radiusM * Math.sin(angle);

  const latRad = (base.lat * Math.PI) / 180;
  const metersPerDegLat = 110_540;
  const metersPerDegLng = 111_320 * Math.cos(latRad);
  const dLat = dy / metersPerDegLat;
  const dLng = metersPerDegLng ? dx / metersPerDegLng : 0;

  return { lat: base.lat + dLat, lng: base.lng + dLng };
};

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

const getAreaQuery = (item: ProMapItem) => {
  const q = [item.postal_code, item.city].filter(Boolean).join(" ");
  return q.trim() || getGeocodeQuery(item);
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
  onGeocoded,
  onOpenProfile,
  onContact,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const hoverPopupRef = useRef<any>(null);
  const clickPopupRef = useRef<any>(null);
  const clusterMarkersRef = useRef<Map<string, any>>(new Map());
  const onSelectProIdRef = useRef<Props["onSelectProId"]>(onSelectProId);
  const onOpenProfileRef = useRef<Props["onOpenProfile"]>(onOpenProfile);
  const onContactRef = useRef<Props["onContact"]>(onContact);
  const didAutoFitRef = useRef(false);
  const didUserInteractRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [geocoded, setGeocoded] = useState<Record<string, UserLocation>>({});

  useEffect(() => {
    onSelectProIdRef.current = onSelectProId;
  }, [onSelectProId]);
  useEffect(() => {
    onOpenProfileRef.current = onOpenProfile;
  }, [onOpenProfile]);
  useEffect(() => {
    onContactRef.current = onContact;
  }, [onContact]);

  const features = useMemo(() => {
    const baseRows = items
      .map((item) => {
        const title = toTitle(item.title);
        const hasCoords = typeof item.lat === "number" && typeof item.lng === "number";
        const coords = hasCoords
          ? { lat: item.lat as number, lng: item.lng as number }
          : geocoded[item.pro_id] ?? inferCoords(item);
        if (!coords) return null;
        const key = `${coords.lng.toFixed(5)},${coords.lat.toFixed(5)}`;
        return { item, title, coords, key };
      })
      .filter(Boolean) as Array<{ item: ProMapItem; title: string; coords: UserLocation; key: string }>;

    const duplicates = new Map<string, number>();
    for (const row of baseRows) {
      duplicates.set(row.key, (duplicates.get(row.key) ?? 0) + 1);
    }

    const rows = baseRows.map((row) => {
      const isDuplicate = (duplicates.get(row.key) ?? 0) > 1;
      const coords = isDuplicate ? jitterCoords(row.coords, row.item.pro_id) : row.coords;
          return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [coords.lng, coords.lat] },
        properties: {
          pro_id: row.item.pro_id,
          title: row.title,
          city: row.item.city ?? "",
          postal_code: row.item.postal_code ?? "",
          specialties: (row.item.specialties ?? []).slice(0, 6).join(" • "),
          address: normalizeAddressLabel(row.item) ?? "",
        },
      };
    });

    return {
      type: "FeatureCollection",
      features: rows,
    };
  }, [items, geocoded]);

  useEffect(() => {
    let cancelled = false;
    const markers = clusterMarkersRef.current;
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
                tiles: [
                  "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png",
                  "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png",
                  "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png",
                  "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png",
                ],
                tileSize: 256,
                attribution: "© OpenStreetMap © CARTO",
              },
            },
            layers: [{ id: "osm", type: "raster", source: "osm" }],
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
          },
          center: PARIS_DEFAULT.center,
          zoom: PARIS_DEFAULT.zoom,
        });

        hoverPopupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 14,
        });

        clickPopupRef.current = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          offset: 16,
          maxWidth: "320px",
        });

        mapRef.current.dragRotate.disable();
        mapRef.current.touchZoomRotate.disableRotation();
        mapRef.current.dragPan.enable();
        mapRef.current.scrollZoom.enable();

        mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

        mapRef.current.on("dragstart", () => {
          didUserInteractRef.current = true;
        });
        mapRef.current.on("zoomstart", () => {
          didUserInteractRef.current = true;
        });

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
        markers.forEach((marker) => marker?.remove?.());
        markers.clear();
        hoverPopupRef.current?.remove?.();
        clickPopupRef.current?.remove?.();
        mapRef.current?.remove?.();
      } catch {
        // ignore
      } finally {
        hoverPopupRef.current = null;
        clickPopupRef.current = null;
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
        clusterRadius: 60,
        clusterMaxZoom: 14,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: srcId,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#38b6ff", 15, "#285bd6", 50, "#1800ad"],
          "circle-radius": ["step", ["get", "point_count"], 20, 15, 26, 50, 32],
          "circle-opacity": 0.9,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      const renderClusterMarkers = () => {
        if (!map.getSource?.(srcId)) return;
        const visible = map.queryRenderedFeatures({ layers: ["clusters"] }) ?? [];
        const nextIds = new Set<string>();

        for (const f of visible) {
          const props: any = f?.properties ?? {};
          const id = String(props.cluster_id ?? "");
          const count = Number(props.point_count ?? 0);
          const coords = f?.geometry?.coordinates;
          if (!id || !Array.isArray(coords)) continue;
          nextIds.add(id);

          if (!clusterMarkersRef.current.has(id)) {
            const el = document.createElement("button");
            el.type = "button";
            const safeCount = Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1;
            const size = Math.min(56, 34 + Math.floor(Math.log10(safeCount + 1) * 10));
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
            el.style.borderRadius = "9999px";
            el.style.border = "2px solid #ffffff";
            el.style.background = "rgba(40,91,214,0.95)";
            el.style.color = "#ffffff";
            el.style.fontWeight = "700";
            el.style.fontSize = "12px";
            el.style.boxShadow = "0 10px 22px rgba(0,0,0,0.18)";
            el.style.display = "grid";
            el.style.placeItems = "center";
            el.style.cursor = "pointer";
            el.dataset.clusterId = id;
            el.dataset.pointCount = String(safeCount);
            el.dataset.lng = String(coords[0]);
            el.dataset.lat = String(coords[1]);
            el.setAttribute("aria-label", `Cluster ${safeCount} professionnels`);

            el.onclick = () => {
              const source: any = map.getSource?.(srcId);
              const clusterId = Number(el.dataset.clusterId);
              const lng = Number(el.dataset.lng);
              const lat = Number(el.dataset.lat);
              const center = Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : coords;

              if (!Number.isFinite(clusterId) || !source?.getClusterExpansionZoom) {
                map.easeTo({ center, zoom: Math.min((map.getZoom?.() ?? 12) + 2, 18), duration: 260 });
                return;
              }
              source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
                if (err) {
                  map.easeTo({ center, zoom: Math.min((map.getZoom?.() ?? 12) + 2, 18), duration: 260 });
                  return;
                }
                map.easeTo({ center, zoom, duration: 260 });
              });
            };

            const marker = new (window as any).maplibregl.Marker({ element: el, anchor: "center" })
              .setLngLat(coords)
              .addTo(map);
            clusterMarkersRef.current.set(id, marker);
          }

          const marker = clusterMarkersRef.current.get(id);
          const element = marker?.getElement?.() as HTMLButtonElement | undefined;
          if (element) {
            const safeCount = Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1;
            const size = Math.min(56, 34 + Math.floor(Math.log10(safeCount + 1) * 10));
            element.style.width = `${size}px`;
            element.style.height = `${size}px`;
            element.textContent = String(safeCount);
            element.dataset.pointCount = String(safeCount);
            element.dataset.lng = String(coords[0]);
            element.dataset.lat = String(coords[1]);
            element.setAttribute("aria-label", `Cluster ${safeCount} professionnels`);
          }
          marker?.setLngLat?.(coords);
        }

        for (const [id, marker] of clusterMarkersRef.current.entries()) {
          if (nextIds.has(id)) continue;
          marker?.remove?.();
          clusterMarkersRef.current.delete(id);
        }
      };

      map.on("render", renderClusterMarkers);
      map.on("moveend", renderClusterMarkers);
      map.on("zoomend", renderClusterMarkers);

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
        const hit = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const first = hit?.[0];
        const clusterId = Number(first?.properties?.cluster_id);
        const pointCount = Number(first?.properties?.point_count);
        const coords = first?.geometry?.coordinates;
        if (!Array.isArray(coords)) return;
        if (!Number.isFinite(clusterId)) {
          map.easeTo({ center: coords, zoom: Math.min((map.getZoom?.() ?? 12) + 2, 18), duration: 260 });
          return;
        }

        if (Number.isFinite(pointCount) && clickPopupRef.current) {
          const html = `
            <div style="min-width:220px">
              <div style="font-weight:700;color:#111827">Zone avec ${Math.round(pointCount)} professionnel(s)</div>
              <div style="margin-top:6px;font-size:12px;color:#4b5563">Zoom automatique sur la zone.</div>
            </div>`;
          clickPopupRef.current.setLngLat(coords).setHTML(html).addTo(map);
        }

        const source = map.getSource(srcId);
        if (!source?.getClusterExpansionZoom) {
          map.easeTo({ center: coords, zoom: Math.min((map.getZoom?.() ?? 12) + 2, 18), duration: 260 });
          return;
        }
        source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) {
            map.easeTo({ center: coords, zoom: Math.min((map.getZoom?.() ?? 12) + 2, 18), duration: 260 });
            return;
          }
          map.easeTo({ center: coords, zoom, duration: 260 });
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
        hoverPopupRef.current?.setLngLat(coords).setHTML(html).addTo(map);
      });

      map.on("mouseleave", "unclustered-point", () => {
        map.getCanvas().style.cursor = "";
        hoverPopupRef.current?.remove?.();
      });

      map.on("click", "unclustered-point", (e: any) => {
        const f = e?.features?.[0];
        const coords = f?.geometry?.coordinates;
        const props = f?.properties;
        const proId = props?.pro_id ? String(props.pro_id) : null;
        if (!proId) return;
        onSelectProIdRef.current?.(proId);

        if (Array.isArray(coords) && clickPopupRef.current) {
          const root = document.createElement("div");
          root.style.minWidth = "240px";
          root.style.maxWidth = "320px";

          const title = document.createElement("div");
          title.style.fontWeight = "700";
          title.style.color = "#111827";
          title.style.marginBottom = "4px";
          title.textContent = String(props?.title ?? "Professionnel");

          const sub = document.createElement("div");
          sub.style.fontSize = "12px";
          sub.style.color = "#4b5563";
          sub.textContent = `${String(props?.city ?? "")} ${String(
            props?.postal_code ? `(${props.postal_code})` : ""
          )}`.trim();

          const specs = document.createElement("div");
          specs.style.marginTop = "6px";
          specs.style.fontSize = "12px";
          specs.style.color = "#374151";
          specs.textContent = props?.specialties ? String(props.specialties) : "";
          if (!specs.textContent) specs.style.display = "none";

          const actions = document.createElement("div");
          actions.style.display = "flex";
          actions.style.gap = "8px";
          actions.style.marginTop = "10px";

          const mkBtn = (label: string, variant: "primary" | "outline") => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = label;
            btn.style.flex = "1";
            btn.style.padding = "8px 10px";
            btn.style.borderRadius = "10px";
            btn.style.fontSize = "12px";
            btn.style.fontWeight = "600";
            btn.style.cursor = "pointer";
            if (variant === "primary") {
              btn.style.border = "1px solid #1800ad";
              btn.style.background = "#1800ad";
              btn.style.color = "#ffffff";
            } else {
              btn.style.border = "1px solid #d5d7dc";
              btn.style.background = "#ffffff";
              btn.style.color = "#111827";
            }
            return btn;
          };

          const viewBtn = mkBtn("Voir profil", "outline");
          viewBtn.onclick = () => {
            onOpenProfileRef.current?.(proId);
          };

          const contactBtn = mkBtn("Contacter", "primary");
          contactBtn.onclick = () => {
            onContactRef.current?.(proId);
          };

          actions.appendChild(viewBtn);
          actions.appendChild(contactBtn);

          root.appendChild(title);
          root.appendChild(sub);
          root.appendChild(specs);
          root.appendChild(actions);

          clickPopupRef.current.setLngLat(coords).setDOMContent(root).addTo(map);
        }
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
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    if (didAutoFitRef.current) return;
    if (didUserInteractRef.current) return;
    const fs = (features as any)?.features ?? [];
    if (!Array.isArray(fs) || fs.length === 0) return;

    const coords = fs
      .map((f: any) => f?.geometry?.coordinates)
      .filter((c: any) => Array.isArray(c) && c.length >= 2)
      .slice(0, 300);
    if (coords.length === 0) return;

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const c of coords) {
      const lng = Number(c[0]);
      const lat = Number(c[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
    if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
      return;
    }

    const lngSpan = Math.abs(maxLng - minLng);
    const latSpan = Math.abs(maxLat - minLat);

    // Avoid auto-zooming too far out on first load (e.g. data spread across multiple cities).
    // We only auto-center when results are within a "metro" sized area.
    if (latSpan > 0.85 || lngSpan > 1.25) return;

    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;
    if (!Number.isFinite(centerLng) || !Number.isFinite(centerLat)) return;

    didAutoFitRef.current = true;
    try {
      map.resize?.();
      const zoom =
        latSpan <= 0.18 && lngSpan <= 0.22
          ? 13.3
          : 12.6;
      map.easeTo({ center: [centerLng, centerLat], zoom, duration: 0 });
    } catch {
      // ignore
    }
  }, [features, mapReady]);

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
      },
      () => {
        onUserLocation?.(null);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 }
    );
  }, [mapReady, onUserLocation]);

  useEffect(() => {
    const missing = items.filter(
      (item) =>
        !(typeof item.lat === "number" && typeof item.lng === "number") && !geocoded[item.pro_id]
    );
    if (!missing.length) return;

    const controller = new AbortController();
    let alive = true;

    const run = async () => {
      const groups = new Map<string, string[]>();
      for (const item of missing) {
        const q = getAreaQuery(item);
        if (!q) continue;
        const list = groups.get(q) ?? [];
        list.push(item.pro_id);
        groups.set(q, list);
      }

      const entries = Array.from(groups.entries()).slice(0, 30);
      if (!entries.length) return;

      const concurrency = 6;
      let cursor = 0;

      const worker = async () => {
        while (alive && cursor < entries.length) {
          const idx = cursor++;
          const [q, ids] = entries[idx];
          if (!q) continue;
          const loc = await geocodeFrance(q, controller.signal);
          if (!loc) continue;
          if (!alive) return;
          setGeocoded((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const id of ids) {
              if (next[id]) continue;
              next[id] = loc;
              changed = true;
            }
            return changed ? next : prev;
          });
          for (const id of ids) onGeocoded?.(id, loc);
        }
      };

      await Promise.all(Array.from({ length: concurrency }).map(() => worker()));
    };

    void run();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [geocoded, items, onGeocoded]);

  return (
    <div className={className}>
      <div ref={containerRef} className="nm-map h-full w-full rounded-2xl border border-neutral-200 bg-white shadow-sm" />
    </div>
  );
}

