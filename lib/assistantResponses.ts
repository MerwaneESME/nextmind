import { formatCurrency } from "@/lib/utils";
import type { QuoteSummary } from "@/lib/quotesStore";

type AssistantUiMode = "devis" | "steps" | "budget" | "terms" | "delays" | "risks";

export type AssistantUiContext = {
  projectName?: string | null;
  projectType?: string | null;
  totalBudgetTtc?: number | null;
  quotes?: QuoteSummary[];
};

function toJsonFence(language: string, payload: unknown): string {
  return `\n\`\`\`${language}\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`;
}

function clampText(value: string, max = 4000): string {
  const v = (value || "").trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max)}…`;
}

function buildGenericPhases(projectType?: string | null) {
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

function buildRiskGroups() {
  return [
    {
      icon: "🏗️",
      title: "Structure / caché (murs porteurs, fissures, humidité, amiante)",
      variant: "danger",
      description:
        "Sans repérage avant de casser, une découverte en cours peut ajouter coût + délai (et parfois bloquer le chantier).",
      actions: [
        "Si doute sur mur porteur : avis structure avant ouverture.",
        "Si bâtiment ancien : vérifier diagnostics (amiante/plomb) avant démolition.",
        "Prévoir une réserve imprévus (10–15%) + marge planning.",
      ],
    },
    {
      icon: "⚡",
      title: "Techniques cachées (électricité, plomberie, conduits)",
      variant: "warning",
      description:
        "Les réseaux sont souvent la source de surprises (mise aux normes, tuyaux vétustes, sections insuffisantes).",
      actions: [
        "Faire préciser le nombre de points électriques et la mise aux normes.",
        "Valider l’étanchéité et les tests avant fermeture des cloisons.",
        "Demander qui fournit quoi (matériel vs main d’œuvre).",
      ],
    },
    {
      icon: "📋",
      title: "Administratif / assurances / voisinage",
      variant: "info",
      description:
        "Certaines modifications nécessitent des démarches (copropriété, mairie) et les assurances doivent être vérifiées avant signature.",
      actions: [
        "Demander attestations décennale + RC Pro (à jour) avant démarrage.",
        "Vérifier autorisations si modification façade/structure/extension.",
        "Prévenir voisinage / syndic si nuisance ou parties communes.",
      ],
    },
  ] as const;
}

function buildQuotePayload(quotes: QuoteSummary[] | undefined, totalBudgetTtc?: number | null) {
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

export function formatAssistantReply(
  mode: AssistantUiMode,
  reply: string,
  ctx: AssistantUiContext
): string {
  const safeReply = clampText(reply);
  const projectLabel = ctx.projectName ? ` — ${ctx.projectName}` : "";

  if (mode === "terms") {
    return (
      `## ❓ Termes techniques${projectLabel}\n` +
      "Je vous affiche un lexique des termes courants. Dites-moi un mot précis si vous voulez que je le détaille.\n" +
      toJsonFence("devis-terms", { query: "" }) +
      (safeReply ? `### Détails\n${safeReply}\n` : "")
    );
  }

  if (mode === "budget") {
    const total = typeof ctx.totalBudgetTtc === "number" ? ctx.totalBudgetTtc : null;
    const payments =
      typeof total === "number"
        ? [
            { label: "Acompte à la signature", percent: 30, amount: Math.round(total * 0.3) },
            { label: "Mi-parcours", percent: 40, amount: Math.round(total * 0.4) },
            { label: "Solde à la réception", percent: 30, amount: Math.round(total * 0.3) },
          ]
        : [{ label: "Acompte / situations / solde", note: "Échéancier à préciser selon le devis" }];

    const hint = total ? `Total TTC estimé sur les devis liés : ${formatCurrency(total)}.` : "Ajoutez un devis pour un total fiable.";

    return (
      `## 💰 Budget${projectLabel}\n` +
      toJsonFence("assistant-budget", { ttc: total, hint, payments }) +
      `### Détails\n${safeReply}\n`
    );
  }

  if (mode === "steps") {
    return (
      `## ✓ Étapes principales${projectLabel}\n` +
      toJsonFence("assistant-timeline", {
        totalDuration: "6–10 semaines (selon lot/accès/aléas)",
        phases: buildGenericPhases(ctx.projectType),
      }) +
      `### Détails\n${safeReply}\n`
    );
  }

  if (mode === "delays") {
    return (
      `## ⏰ Délais & jalons${projectLabel}\n` +
      toJsonFence("assistant-timeline", {
        title: "Jalons recommandés",
        totalDuration: "Variable selon lots et aléas",
        phases: [
          { title: "Avant démarrage", duration: "1–2 semaines", description: "Validation devis + assurances + commandes." },
          { title: "Chantier", duration: "4–10 semaines", description: "Travaux principaux, contrôles, finitions." },
          { title: "Réception", duration: "1–5 jours", description: "PV + réserves + corrections." },
        ],
      }) +
      `### Détails\n${safeReply}\n`
    );
  }

  if (mode === "risks") {
    return (
      `## ⚠ Points d’attention${projectLabel}\n` +
      toJsonFence("assistant-risks", {
        groups: buildRiskGroups(),
        safetyBudget: [
          { label: "Réserve imprévus (10–15%)", value: "Recommandée" },
          { label: "Marge délai", value: "1–2 semaines" },
        ],
      }) +
      `### Détails\n${safeReply}\n`
    );
  }

  return (
    `## 📄 Devis${projectLabel}\n` +
    toJsonFence("assistant-devis", buildQuotePayload(ctx.quotes, ctx.totalBudgetTtc)) +
    `### Détails\n${safeReply}\n`
  );
}

export type { AssistantUiMode };

