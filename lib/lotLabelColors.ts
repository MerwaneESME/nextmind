export type LotLabelColorKey =
  | "slate"
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "violet";

export const LOT_LABEL_COLORS: Array<{
  key: LotLabelColorKey;
  name: string;
  accentHex: string;
  badgeClass: string;
  swatchClass: string;
  subtleBorderClass: string;
  cardGradientClass: string;
}> = [
  {
    key: "slate",
    name: "Gris",
    accentHex: "#64748b",
    swatchClass: "bg-slate-500",
    badgeClass: "bg-slate-50 text-slate-700 border border-slate-200",
    subtleBorderClass: "border-l-slate-400",
    cardGradientClass: "bg-gradient-to-br from-slate-100/60 via-white to-white",
  },
  {
    key: "sky",
    name: "Bleu",
    accentHex: "#0ea5e9",
    swatchClass: "bg-sky-500",
    badgeClass: "bg-sky-50 text-sky-700 border border-sky-200",
    subtleBorderClass: "border-l-sky-400",
    cardGradientClass: "bg-gradient-to-br from-sky-100/60 via-white to-white",
  },
  {
    key: "emerald",
    name: "Vert",
    accentHex: "#10b981",
    swatchClass: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    subtleBorderClass: "border-l-emerald-400",
    cardGradientClass: "bg-gradient-to-br from-emerald-100/60 via-white to-white",
  },
  {
    key: "amber",
    name: "Orange",
    accentHex: "#f59e0b",
    swatchClass: "bg-amber-500",
    badgeClass: "bg-amber-50 text-amber-800 border border-amber-200",
    subtleBorderClass: "border-l-amber-400",
    cardGradientClass: "bg-gradient-to-br from-amber-100/60 via-white to-white",
  },
  {
    key: "rose",
    name: "Rose",
    accentHex: "#f43f5e",
    swatchClass: "bg-rose-500",
    badgeClass: "bg-rose-50 text-rose-700 border border-rose-200",
    subtleBorderClass: "border-l-rose-400",
    cardGradientClass: "bg-gradient-to-br from-rose-100/60 via-white to-white",
  },
  {
    key: "violet",
    name: "Violet",
    accentHex: "#8b5cf6",
    swatchClass: "bg-violet-500",
    badgeClass: "bg-violet-50 text-violet-700 border border-violet-200",
    subtleBorderClass: "border-l-violet-400",
    cardGradientClass: "bg-gradient-to-br from-violet-100/60 via-white to-white",
  },
];

export const lotLabelColorByKey = LOT_LABEL_COLORS.reduce(
  (acc, c) => {
    acc[c.key] = c;
    return acc;
  },
  {} as Record<LotLabelColorKey, (typeof LOT_LABEL_COLORS)[number]>
);

const STORAGE_KEY = "nextmind.lotLabelColors";

export function getLotLabelColor(
  userId: string | null | undefined,
  lotId: string
): LotLabelColorKey | null {
  if (typeof window === "undefined") return null;
  if (!lotId) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, unknown>;
    const value = map?.[lotId];
    if (typeof value !== "string") return null;
    return (lotLabelColorByKey as any)[value] ? (value as LotLabelColorKey) : null;
  } catch {
    return null;
  }
}

export function getLotLabelColorMap(userId: string | null | undefined): Record<string, LotLabelColorKey> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, LotLabelColorKey> = {};
    for (const [k, v] of Object.entries(map ?? {})) {
      if (typeof v !== "string") continue;
      if ((lotLabelColorByKey as any)[v]) next[k] = v as LotLabelColorKey;
    }
    return next;
  } catch {
    return {};
  }
}

export function setLotLabelColor(
  userId: string | null | undefined,
  lotId: string,
  color: LotLabelColorKey
) {
  if (typeof window === "undefined") return;
  if (!lotId) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const next = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    next[lotId] = color;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function removeLotLabelColor(userId: string | null | undefined, lotId: string) {
  if (typeof window === "undefined") return;
  if (!lotId) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const next = JSON.parse(raw) as Record<string, unknown>;
    delete next[lotId];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
