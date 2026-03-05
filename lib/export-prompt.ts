/**
 * Export Report – AI Prompt Builder
 *
 * Builds the system prompt injected when the user requests a project PDF export.
 * The AI returns a structured JSON report that is then rendered with jsPDF.
 */

export type ExportPresetId = "resume" | "avancement" | "cloture";

export const EXPORT_PRESETS: Array<{
  id: ExportPresetId;
  label: string;
  description: string;
  icon: string; // emoji fallback
}> = [
  {
    id: "resume",
    label: "Résumé de projet",
    description: "Fiche synthèse : statut, budget, membres et interventions",
    icon: "📄",
  },
  {
    id: "avancement",
    label: "Rapport d'avancement",
    description: "Détail du progrès par intervention, tâches et planning",
    icon: "📊",
  },
  {
    id: "cloture",
    label: "Rapport de clôture",
    description: "Bilan complet pour projet terminé ou livré",
    icon: "✅",
  },
];

export type ExportAiContent = {
  report_title: string;
  executive_summary: string;
  key_points: string[];
  section_notes: {
    budget?: string;
    interventions?: string;
    planning?: string;
    members?: string;
  };
  recommendations: string[];
  conclusion: string;
};

const PRESET_INSTRUCTIONS: Record<ExportPresetId, string> = {
  resume: `Tu génères une FICHE SYNTHÈSE de projet (format 1-2 pages).
- Résumé exécutif concis (3-4 phrases max)
- Points clés : budget, statut, avancement global, nb d'intervenants
- Pas de détail tâche par tâche, seulement la vue d'ensemble
- Conclusion adaptée au statut (en_cours → "Projet sur les rails" / en_attente → "En attente de démarrage")`,

  avancement: `Tu génères un RAPPORT D'AVANCEMENT détaillé (format 2-4 pages).
- Résumé exécutif avec état actuel et tendance
- Points clés : % avancement, tâches terminées/en retard, risques identifiés
- Section interventions : analyse de chaque lot (bien avancé ? retard ? blocage ?)
- Section planning : la timeline est-elle respectée ? quelles actions urgentes ?
- Recommandations opérationnelles concrètes (min 3)
- Conclusion avec prochaines étapes prioritaires`,

  cloture: `Tu génères un RAPPORT DE CLÔTURE professionnel (format 2-4 pages).
- Résumé exécutif : bilan de l'opération, objectifs atteints ou non
- Points clés : budget final vs estimé, durée réelle vs prévue, intervenants
- Section interventions : retour sur chaque lot (délais, qualité perçue)
- Section budget : analyse des écarts (dépassements, économies)
- Recommandations : retours d'expérience, points d'amélioration pour futurs projets
- Conclusion : valorisation du projet livré`,
};

export function buildExportSystemPrompt(
  preset: ExportPresetId,
  projectContext: string,
  userNotes: string
): string {
  const presetInfo = PRESET_INSTRUCTIONS[preset];

  return `Tu es un conducteur de travaux expérimenté rédigeant un rapport officiel BTP.

${userNotes?.trim() ? `PRÉCISIONS DE L'UTILISATEUR : ${userNotes.trim()}\n` : ""}

TYPE DE RAPPORT : ${EXPORT_PRESETS.find((p) => p.id === preset)?.label ?? preset}
${presetInfo}

═══════════════════════════════════════════════════
DONNÉES DU PROJET
═══════════════════════════════════════════════════

${projectContext}

═══════════════════════════════════════════════════
FORMAT DE RÉPONSE
═══════════════════════════════════════════════════

Tu DOIS répondre avec un JSON valide dans un bloc \`\`\`json ... \`\`\` :

{
  "report_title": "Titre complet du rapport (ex: 'Rapport d'avancement — Extension terrasse — Mars 2026')",
  "executive_summary": "Texte de synthèse professionnel en 3-5 phrases. Ton neutre et factuel.",
  "key_points": [
    "Point clé factuel 1 (ex: 'Avancement global : 45%')",
    "Point clé 2",
    "Point clé 3",
    "Point clé 4 (optionnel)",
    "Point clé 5 (optionnel)"
  ],
  "section_notes": {
    "budget": "Analyse du budget en 2-3 phrases (présent uniquement si données budget disponibles)",
    "interventions": "Analyse des interventions en 2-3 phrases",
    "planning": "État du planning en 2-3 phrases (présent si des tâches existent)",
    "members": "Commentaire sur l'équipe en 1-2 phrases (optionnel)"
  },
  "recommendations": [
    "Recommandation actionnable 1",
    "Recommandation actionnable 2",
    "Recommandation actionnable 3"
  ],
  "conclusion": "Texte de conclusion en 2-3 phrases. Adapté au statut du projet."
}

RÈGLES STRICTES :
- N'écris RIEN en dehors du bloc \`\`\`json ... \`\`\`
- Rédige UNIQUEMENT en français professionnel BTP
- Base-toi UNIQUEMENT sur les données réelles du projet
- Si une information manque (ex : budget non renseigné), omets la section correspondante
- NE JAMAIS inventer de données chiffrées non présentes dans le contexte
- Sois factuel, précis et direct`;
}

export function parseExportAiContent(reply: string): ExportAiContent | null {
  const candidates: string[] = [];

  const fenceMatch = reply.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

  const rawMatch = reply.match(/\{[\s\S]*\}/);
  if (rawMatch?.[0]) candidates.push(rawMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== "object") continue;

      const obj = parsed as Record<string, unknown>;

      const reportTitle =
        (typeof obj.report_title === "string" ? obj.report_title : null) ??
        (typeof obj.reportTitle === "string" ? obj.reportTitle : null) ??
        (typeof obj.title === "string" ? obj.title : null) ??
        "";

      const executiveSummary =
        (typeof obj.executive_summary === "string" ? obj.executive_summary : null) ??
        (typeof obj.executiveSummary === "string" ? obj.executiveSummary : null) ??
        (typeof obj.summary === "string" ? obj.summary : null) ??
        "";

      const keyPointsRaw =
        (Array.isArray(obj.key_points) ? obj.key_points : null) ??
        (Array.isArray(obj.keyPoints) ? obj.keyPoints : null) ??
        (Array.isArray(obj.highlights) ? obj.highlights : null) ??
        null;

      const keyPoints = Array.isArray(keyPointsRaw)
        ? keyPointsRaw.filter((x): x is string => typeof x === "string")
        : typeof obj.key_points === "string"
          ? obj.key_points.split("\n").map((s) => s.trim()).filter(Boolean)
          : [];

      const sectionNotes =
        (obj.section_notes && typeof obj.section_notes === "object" && !Array.isArray(obj.section_notes)
          ? (obj.section_notes as Record<string, unknown>)
          : obj.sectionNotes && typeof obj.sectionNotes === "object" && !Array.isArray(obj.sectionNotes)
            ? (obj.sectionNotes as Record<string, unknown>)
            : {}) ?? {};

      const recommendationsRaw =
        (Array.isArray(obj.recommendations) ? obj.recommendations : null) ??
        (Array.isArray(obj.actions) ? obj.actions : null) ??
        (Array.isArray(obj.next_steps) ? obj.next_steps : null) ??
        null;

      const recommendations = Array.isArray(recommendationsRaw)
        ? recommendationsRaw.filter((x): x is string => typeof x === "string")
        : [];

      const conclusion =
        (typeof obj.conclusion === "string" ? obj.conclusion : null) ??
        (typeof obj.closing === "string" ? obj.closing : null) ??
        "";

      return {
        report_title: reportTitle,
        executive_summary: executiveSummary,
        key_points: keyPoints,
        section_notes: {
          budget: typeof sectionNotes.budget === "string" ? sectionNotes.budget : undefined,
          interventions: typeof sectionNotes.interventions === "string" ? sectionNotes.interventions : undefined,
          planning: typeof sectionNotes.planning === "string" ? sectionNotes.planning : undefined,
          members: typeof sectionNotes.members === "string" ? sectionNotes.members : undefined,
        },
        recommendations,
        conclusion,
      };
    } catch {
      // try next candidate
    }
  }
  return null;
}
