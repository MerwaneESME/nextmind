import type { QuoteSummary } from "@/lib/quotesStore";
import type { TimelinePhaseData } from "@/components/assistant/TimelinePhase";

export function buildGenericPhases(projectType?: string | null): TimelinePhaseData[] {
  const label = projectType ? ` (${projectType})` : "";
  return [
    {
      title: `Préparation & repérages${label}`,
      duration: "1–3 jours",
      description: "Visite, protections, repérages (réseaux), organisation du chantier.",
      warnings: "Si diagnostics nécessaires (amiante/plomb), prévoir du délai en plus.",
    },
    {
      title: "Dépose / démolition",
      duration: "2–7 jours",
      description: "Dépose des éléments existants + évacuation des gravats.",
    },
    {
      title: "Réseaux (élec / plomberie)",
      duration: "3–10 jours",
      description: "Passage des réseaux, mises aux normes, tests avant fermeture.",
      warnings: "On valide avant de fermer (placo/sol) pour éviter des reprises coûteuses.",
    },
    {
      title: "Supports (cloisons, sols, étanchéité)",
      duration: "1–2 semaines",
      description: "Cloisons/placo, chape/ragréage, étanchéité SdB si besoin.",
    },
    {
      title: "Finitions",
      duration: "1–3 semaines",
      description: "Revêtements (sols/murs), peinture, menuiseries, équipements.",
    },
    {
      title: "Réception & levée des réserves",
      duration: "1–5 jours",
      description: "PV de réception, réserves, corrections, remise des documents.",
    },
  ];
}

export function buildPaymentSchedule(totalTtc?: number | null) {
  if (typeof totalTtc !== "number") {
    return [{ label: "Acompte / situations / solde", note: "Échéancier à préciser selon le devis" }];
  }
  return [
    { label: "Acompte à la signature", percent: 30, amount: Math.round(totalTtc * 0.3) },
    { label: "Mi-parcours", percent: 40, amount: Math.round(totalTtc * 0.4) },
    { label: "Solde à la réception", percent: 30, amount: Math.round(totalTtc * 0.3) },
  ];
}

export function buildQuotePayload(quotes: QuoteSummary[] | undefined, totalBudgetTtc?: number | null) {
  const items = (quotes || []).map((q) => ({
    id: q.id,
    title: q.title,
    status: q.status,
    totalTtc: typeof q.totalTtc === "number" ? q.totalTtc : null,
    updatedAt: q.updatedAt,
  }));
  const total = typeof totalBudgetTtc === "number" ? totalBudgetTtc : null;
  return { totalTtc: total, quotes: items };
}

