/**
 * Smart Planning Fallback
 *
 * When the AI backend does not return structured JSON, this module builds
 * a context-aware PlanningProposal from the project name, description, and
 * existing interventions using BTP domain knowledge.
 */

import type {
  PlanningProposal,
  PlanningSuggestedTask,
  PlanningSuggestedIntervention,
} from "@/lib/ai-service";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectInfo = {
  name: string;
  description?: string | null;
  project_type?: string | null;
};

type ExistingLot = {
  id: string;
  name: string;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shift(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return fmt(d);
}

// ─── Category detection ───────────────────────────────────────────────────────

type ProjectCategory =
  | "terrasse"
  | "salle_de_bain"
  | "cuisine"
  | "renovation"
  | "extension"
  | "construction_neuf"
  | "toiture"
  | "facade"
  | "combles"
  | "piscine"
  | "generic";

const CATEGORY_KEYWORDS: Record<ProjectCategory, string[]> = {
  terrasse: ["terrasse", "terasse", "deck", "pergola", "patio", "exterieur", "extérieur"],
  salle_de_bain: ["salle de bain", "sdb", "douche", "baignoire", "sanitaire", "robinetterie", "wc"],
  cuisine: ["cuisine", "kitchenette", "plan de travail", "credence"],
  renovation: ["rénovation", "renovation", "rénover", "renover", "réhabilitation", "rehabilitation", "mise a jour", "rafraichissement"],
  extension: ["extension", "agrandissement", "ajout", "annexe", "véranda", "veranda", "surélévation", "surelevation"],
  construction_neuf: ["construction neuf", "maison neuve", "bâtiment neuf", "batiment neuf", "villa", "construction d"],
  toiture: ["toiture", "charpente", "couverture", "zinguerie", "ardoise", "tuile"],
  facade: ["façade", "facade", "ravalement", "enduit"],
  combles: ["combles", "grenier", "mansarde", "sous-toiture"],
  piscine: ["piscine", "spa", "bassin", "jacuzzi"],
  generic: [],
};

export function detectProjectCategory(info: ProjectInfo): ProjectCategory {
  const raw = `${info.name} ${info.description ?? ""} ${info.project_type ?? ""}`;
  const text = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ProjectCategory, string[]][]) {
    if (cat === "generic") continue;
    for (const kw of keywords) {
      const normalized = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (text.includes(normalized)) return cat as ProjectCategory;
    }
  }
  return "generic";
}

// ─── Intervention templates per category ──────────────────────────────────────

type InterventionTemplate = {
  name: string;
  lot_type: string;
  reason: string;
  keywords: string[]; // to avoid duplicating existing lots
  buildTasks: (today: Date, offset: number) => PlanningSuggestedTask[];
};

const TERRASSE_INTERVENTIONS: InterventionTemplate[] = [
  {
    name: "Gros Œuvre / Maçonnerie",
    lot_type: "Gros œuvre",
    reason: "Fondations, dalle béton ou murets de soutènement nécessaires pour supporter la terrasse.",
    keywords: ["gros", "maçonnerie", "maconnerie", "fondation", "dalle"],
    buildTasks: (today, off) => [
      { title: "Implantation et terrassement", description: "Délimitation de l'emprise, fouilles et évacuation des terres.", start_date: shift(today, off), end_date: shift(today, off + 5) },
      { title: "Ferraillage et coulage de la dalle béton", description: "Pose du treillis soudé et coulage du béton de propreté.", start_date: shift(today, off + 5), end_date: shift(today, off + 10) },
      { title: "Maçonnerie des murets et bordures", description: "Montage des murets périmètriques en parpaings ou béton banché.", start_date: shift(today, off + 10), end_date: shift(today, off + 17) },
    ],
  },
  {
    name: "Revêtement de sol",
    lot_type: "Carrelage / Sols",
    reason: "Pose du revêtement de sol extérieur (carrelage antidérapant, béton désactivé ou bois composite).",
    keywords: ["revêtement", "revetement", "carrelage", "sol", "dallage", "bois composite"],
    buildTasks: (today, off) => [
      { title: "Préparation du support et chape de forme", description: "Ragréage et création des pentes d'écoulement.", start_date: shift(today, off), end_date: shift(today, off + 4) },
      { title: "Pose du revêtement extérieur", description: "Carrelage antidérapant, dalles béton ou lames bois composite.", start_date: shift(today, off + 4), end_date: shift(today, off + 12) },
      { title: "Jointoiement et finitions", description: "Joints de dilatation, nettoyage et protection de surface.", start_date: shift(today, off + 12), end_date: shift(today, off + 15) },
    ],
  },
  {
    name: "Menuiserie extérieure",
    lot_type: "Menuiserie extérieure",
    reason: "Garde-corps réglementaire, pergola ou brise-vue pour sécuriser et aménager la terrasse.",
    keywords: ["menuiserie", "garde-corps", "garde corps", "pergola", "store", "brise-vue"],
    buildTasks: (today, off) => [
      { title: "Fourniture et pose du garde-corps", description: "Garde-corps réglementaire (hauteur 1 m min) en aluminium ou inox.", start_date: shift(today, off), end_date: shift(today, off + 5) },
      { title: "Pose de la pergola ou structure couverte", description: "Structure bois ou aluminium avec toiture polycarbonate ou lames orientables.", start_date: shift(today, off + 5), end_date: shift(today, off + 10) },
    ],
  },
  {
    name: "Électricité extérieure",
    lot_type: "Électricité",
    reason: "Éclairage, prises étanches et points d'eau extérieurs pour rendre la terrasse fonctionnelle.",
    keywords: ["électricité", "electricite", "éclairage", "eclairage", "prise", "courant"],
    buildTasks: (today, off) => [
      { title: "Passage des gaines et câblage", description: "Câblage sous gaine ICTA enterrée ou encastrée pour éclairage et prises.", start_date: shift(today, off), end_date: shift(today, off + 3) },
      { title: "Pose appareillage et luminaires extérieurs", description: "Spots encastrés, bornes, prises IP67 et disjoncteur différentiel.", start_date: shift(today, off + 3), end_date: shift(today, off + 6) },
    ],
  },
];

const SALLE_DE_BAIN_INTERVENTIONS: InterventionTemplate[] = [
  {
    name: "Démolition",
    lot_type: "Démolition",
    reason: "Dépose des anciens sanitaires, carrelage et cloisons pour repartir sur une base saine.",
    keywords: ["démolition", "demolition", "dépose", "depose"],
    buildTasks: (today, off) => [
      { title: "Dépose des sanitaires existants", description: "Débranchement et évacuation baignoire, lavabo, WC.", start_date: shift(today, off), end_date: shift(today, off + 2) },
      { title: "Dépose du carrelage mural et sol", description: "Piquage du carrelage et préparation des supports.", start_date: shift(today, off + 2), end_date: shift(today, off + 5) },
    ],
  },
  {
    name: "Plomberie",
    lot_type: "Plomberie",
    reason: "Mise à niveau et modification des alimentations eau et évacuations selon le nouveau plan.",
    keywords: ["plomberie", "plomb", "alimentation", "évacuation", "evacuation", "eau"],
    buildTasks: (today, off) => [
      { title: "Déplacement des arrivées d'eau et évacuations", description: "Modification des réseaux selon le nouveau plan de la salle de bain.", start_date: shift(today, off), end_date: shift(today, off + 5) },
      { title: "Pose des receveurs de douche et baignoire", description: "Scellement du receveur avec siphon de sol et raccordement.", start_date: shift(today, off + 5), end_date: shift(today, off + 8) },
      { title: "Raccordement des équipements sanitaires", description: "Pose lavabo, WC, robinetterie et vérification étanchéité.", start_date: shift(today, off + 18), end_date: shift(today, off + 22) },
    ],
  },
  {
    name: "Carrelage",
    lot_type: "Carrelage / Sols",
    reason: "Pose du carrelage mural et sol pour l'étanchéité et l'esthétique.",
    keywords: ["carrelage", "faïence", "faience", "sol", "mur"],
    buildTasks: (today, off) => [
      { title: "Préparation des supports (ragréage, enduit)", description: "Mise à niveau et application d'un primaire d'accrochage.", start_date: shift(today, off), end_date: shift(today, off + 3) },
      { title: "Pose du carrelage au sol", description: "Carrelage antidérapant avec pente vers siphon de sol.", start_date: shift(today, off + 3), end_date: shift(today, off + 7) },
      { title: "Pose de la faïence murale", description: "Faïence et bandes d'étanchéité autour de la douche et baignoire.", start_date: shift(today, off + 7), end_date: shift(today, off + 13) },
    ],
  },
  {
    name: "Électricité",
    lot_type: "Électricité",
    reason: "Mise aux normes électriques de la salle de bain (zones d'eau).",
    keywords: ["électricité", "electricite", "courant", "éclairage"],
    buildTasks: (today, off) => [
      { title: "Câblage et points lumineux", description: "Éclairage adapté aux zones humides (IP44 minimum).", start_date: shift(today, off), end_date: shift(today, off + 3) },
      { title: "Pose des appareillages", description: "Interrupteurs, prises rasoir, ventilation mécanique.", start_date: shift(today, off + 10), end_date: shift(today, off + 13) },
    ],
  },
];

const CUISINE_INTERVENTIONS: InterventionTemplate[] = [
  {
    name: "Démolition",
    lot_type: "Démolition",
    reason: "Dépose de l'ancienne cuisine pour libérer l'espace.",
    keywords: ["démolition", "demolition", "dépose", "depose"],
    buildTasks: (today, off) => [
      { title: "Dépose des meubles et équipements existants", description: "Démontage meubles hauts/bas, électroménager, plans de travail.", start_date: shift(today, off), end_date: shift(today, off + 3) },
    ],
  },
  {
    name: "Plomberie",
    lot_type: "Plomberie",
    reason: "Alimentation eau froide/chaude et évacuations pour évier et lave-vaisselle.",
    keywords: ["plomberie", "alimentation", "évacuation"],
    buildTasks: (today, off) => [
      { title: "Déplacement / création des arrivées d'eau", description: "Réseaux encastrés pour évier, lave-vaisselle et plaque de cuisson gaz si nécessaire.", start_date: shift(today, off), end_date: shift(today, off + 4) },
      { title: "Pose et raccordement de l'évier", description: "Fixation et raccordement eau + évacuation.", start_date: shift(today, off + 18), end_date: shift(today, off + 20) },
    ],
  },
  {
    name: "Électricité",
    lot_type: "Électricité",
    reason: "Circuits dédiés pour les gros électroménagers (four, plaque, réfrigérateur).",
    keywords: ["électricité", "electricite"],
    buildTasks: (today, off) => [
      { title: "Câblage circuits dédiés cuisine", description: "Circuits 20A et 32A pour électroménagers, prises de plan de travail.", start_date: shift(today, off), end_date: shift(today, off + 4) },
      { title: "Pose appareillage et raccordement", description: "Prises, interrupteurs, hotte aspirante et réglette LED.", start_date: shift(today, off + 16), end_date: shift(today, off + 19) },
    ],
  },
  {
    name: "Menuiserie cuisine",
    lot_type: "Menuiserie intérieure",
    reason: "Pose de la cuisine équipée : meubles, plan de travail, crédence.",
    keywords: ["menuiserie", "meuble", "plan de travail", "credence", "crédence"],
    buildTasks: (today, off) => [
      { title: "Pose des meubles bas et hauts", description: "Installation meubles, calage et fixation murale.", start_date: shift(today, off), end_date: shift(today, off + 5) },
      { title: "Pose du plan de travail et crédence", description: "Découpe et fixation plan de travail, pose crédence et joint silicone.", start_date: shift(today, off + 5), end_date: shift(today, off + 8) },
      { title: "Intégration de l'électroménager", description: "Encastrement four, lave-vaisselle, réfrigérateur.", start_date: shift(today, off + 8), end_date: shift(today, off + 10) },
    ],
  },
];

const RENOVATION_INTERVENTIONS: InterventionTemplate[] = [
  {
    name: "Démolition",
    lot_type: "Démolition",
    reason: "Démolition des éléments à remplacer : cloisons, revêtements, ouvertures.",
    keywords: ["démolition", "demolition"],
    buildTasks: (today, off) => [
      { title: "Dépose des revêtements existants", description: "Dépose moquette, carrelage, papier peint et anciens plafonds.", start_date: shift(today, off), end_date: shift(today, off + 5) },
      { title: "Démolition des cloisons non porteuses", description: "Abattage des cloisons inutiles et évacuation gravats.", start_date: shift(today, off + 5), end_date: shift(today, off + 10) },
    ],
  },
  {
    name: "Électricité",
    lot_type: "Électricité",
    reason: "Mise aux normes du tableau électrique et des circuits selon NF C 15-100.",
    keywords: ["électricité", "electricite", "tableau", "norme"],
    buildTasks: (today, off) => [
      { title: "Mise aux normes du tableau électrique", description: "Remplacement du tableau, disjoncteurs différentiels par pièce.", start_date: shift(today, off), end_date: shift(today, off + 5) },
      { title: "Réfection des circuits et prises", description: "Nouveaux circuits en apparent ou encastré selon finitions prévues.", start_date: shift(today, off + 5), end_date: shift(today, off + 14) },
    ],
  },
  {
    name: "Plomberie",
    lot_type: "Plomberie",
    reason: "Remplacement des réseaux d'alimentation et évacuation vétustes.",
    keywords: ["plomberie", "eau", "alimentation", "tuyauterie"],
    buildTasks: (today, off) => [
      { title: "Remplacement des colonnes d'alimentation", description: "Cuivre ou multicouche pour eau froide et chaude.", start_date: shift(today, off), end_date: shift(today, off + 7) },
      { title: "Mise à niveau des évacuations", description: "Remplacement tuyaux PVC encastrés ou en gaine technique.", start_date: shift(today, off + 7), end_date: shift(today, off + 12) },
    ],
  },
  {
    name: "Plâtrerie / Cloisons",
    lot_type: "Plâtrerie / Cloisons",
    reason: "Création des nouvelles cloisons et finition des murs et plafonds.",
    keywords: ["plâtrerie", "platrerie", "cloison", "placo", "enduit"],
    buildTasks: (today, off) => [
      { title: "Montage des nouvelles cloisons en placo", description: "Rails, montants et plaques de plâtre selon plan.", start_date: shift(today, off), end_date: shift(today, off + 7) },
      { title: "Enduit de lissage murs et plafonds", description: "Application d'enduit et ponçage pour préparation peinture.", start_date: shift(today, off + 7), end_date: shift(today, off + 14) },
    ],
  },
  {
    name: "Peinture",
    lot_type: "Peinture",
    reason: "Peinture de finition pour l'ensemble des pièces rénovées.",
    keywords: ["peinture", "peintre", "décoration"],
    buildTasks: (today, off) => [
      { title: "Ponçage et impression des murs", description: "Préparation des surfaces et application d'une couche d'impression.", start_date: shift(today, off), end_date: shift(today, off + 4) },
      { title: "Peinture finition 2 couches", description: "Application de la peinture de finition en 2 couches.", start_date: shift(today, off + 4), end_date: shift(today, off + 10) },
    ],
  },
];

const EXTENSION_INTERVENTIONS: InterventionTemplate[] = [
  {
    name: "Fondations",
    lot_type: "Gros œuvre",
    reason: "Création des fondations de l'extension selon l'étude de sol.",
    keywords: ["fondation", "terrassement"],
    buildTasks: (today, off) => [
      { title: "Terrassement et fouilles", description: "Excavation selon plan masse, évacuation terres.", start_date: shift(today, off), end_date: shift(today, off + 5) },
      { title: "Coulage des fondations", description: "Béton armé de semelles filantes ou isolées selon étude de sol.", start_date: shift(today, off + 5), end_date: shift(today, off + 10) },
      { title: "Vide sanitaire ou dalle basse", description: "Construction vide sanitaire ventilé ou dalle béton avec hérisson.", start_date: shift(today, off + 10), end_date: shift(today, off + 18) },
    ],
  },
  {
    name: "Gros Œuvre / Structure",
    lot_type: "Gros œuvre",
    reason: "Montage des murs et de la structure porteuse de l'extension.",
    keywords: ["gros", "structure", "mur", "maçonnerie", "maconnerie"],
    buildTasks: (today, off) => [
      { title: "Montage des murs (parpaings / briques)", description: "Élévation des murs extérieurs et refends.", start_date: shift(today, off), end_date: shift(today, off + 14) },
      { title: "Pose du plancher haut (si R+1)", description: "Hourdis ou dalle béton pour le plancher intermédiaire.", start_date: shift(today, off + 14), end_date: shift(today, off + 21) },
    ],
  },
  {
    name: "Charpente / Toiture",
    lot_type: "Toiture",
    reason: "Fermeture en toiture de l'extension pour hors d'eau.",
    keywords: ["charpente", "toiture", "couverture", "toit"],
    buildTasks: (today, off) => [
      { title: "Pose de la charpente", description: "Charpente traditionnelle ou fermettes industrielles.", start_date: shift(today, off), end_date: shift(today, off + 7) },
      { title: "Couverture et raccord avec l'existant", description: "Tuiles ou bac acier, raccordement avec le toit existant.", start_date: shift(today, off + 7), end_date: shift(today, off + 14) },
    ],
  },
  {
    name: "Menuiseries extérieures",
    lot_type: "Menuiserie extérieure",
    reason: "Pose des fenêtres et baies pour le clos et couvert.",
    keywords: ["menuiserie", "fenêtre", "fenetre", "baie", "porte"],
    buildTasks: (today, off) => [
      { title: "Pose des fenêtres et baies vitrées", description: "Menuiseries PVC ou aluminium avec double vitrage.", start_date: shift(today, off), end_date: shift(today, off + 5) },
    ],
  },
];

const TOITURE_INTERVENTIONS: InterventionTemplate[] = [
  {
    name: "Échafaudage",
    lot_type: "Échafaudage",
    reason: "Mise en place d'un échafaudage sécurisé pour les travaux en hauteur.",
    keywords: ["échafaudage", "echafaudage"],
    buildTasks: (today, off) => [
      { title: "Montage de l'échafaudage", description: "Pose et sécurisation du dispositif de travail en hauteur.", start_date: shift(today, off), end_date: shift(today, off + 2) },
      { title: "Démontage de l'échafaudage", description: "Démontage après fin des travaux de couverture.", start_date: shift(today, off + 30), end_date: shift(today, off + 32) },
    ],
  },
  {
    name: "Charpente",
    lot_type: "Charpente",
    reason: "Vérification et réfection de la charpente porteuse si nécessaire.",
    keywords: ["charpente", "panne", "chevron"],
    buildTasks: (today, off) => [
      { title: "Diagnostic de la charpente", description: "Contrôle de l'état des éléments porteurs, identification des pièces à remplacer.", start_date: shift(today, off), end_date: shift(today, off + 2) },
      { title: "Remplacement des pièces endommagées", description: "Purlin, chevrons ou pannes défectueux.", start_date: shift(today, off + 2), end_date: shift(today, off + 10) },
    ],
  },
  {
    name: "Couverture",
    lot_type: "Toiture",
    reason: "Dépose de l'ancienne couverture et pose des nouveaux matériaux.",
    keywords: ["couverture", "tuile", "ardoise", "zinc"],
    buildTasks: (today, off) => [
      { title: "Dépose de l'ancienne couverture", description: "Dépose des tuiles, ardoises ou bac acier et évacuation.", start_date: shift(today, off), end_date: shift(today, off + 5) },
      { title: "Pose sous-toiture et liteaux", description: "Film pare-pluie et liteaux de support.", start_date: shift(today, off + 5), end_date: shift(today, off + 8) },
      { title: "Pose de la nouvelle couverture", description: "Tuiles, ardoises ou bac acier selon choix.", start_date: shift(today, off + 8), end_date: shift(today, off + 18) },
    ],
  },
  {
    name: "Zinguerie",
    lot_type: "Zinguerie",
    reason: "Gouttières, noues et faîtières pour évacuation des eaux pluviales.",
    keywords: ["zinguerie", "gouttière", "gouttiere", "noue", "faîtière"],
    buildTasks: (today, off) => [
      { title: "Pose des gouttières et descentes EP", description: "Gouttières zinc ou PVC et raccordement aux descentes eaux pluviales.", start_date: shift(today, off), end_date: shift(today, off + 5) },
    ],
  },
];

const GENERIC_INTERVENTIONS: InterventionTemplate[] = [
  {
    name: "Préparation et installation de chantier",
    lot_type: "Organisation",
    reason: "Mise en place du chantier, protections, bennes et coordination des entreprises.",
    keywords: ["préparation", "preparation", "installation", "organisation"],
    buildTasks: (today, off) => [
      { title: "Mise en place du chantier", description: "Bennes, protections, accès et signalisation.", start_date: shift(today, off), end_date: shift(today, off + 2) },
      { title: "Coordination des intervenants", description: "Planning des entreprises et réunion de chantier.", start_date: shift(today, off), end_date: shift(today, off + 3) },
    ],
  },
  {
    name: "Travaux principaux",
    lot_type: "Gros œuvre",
    reason: "Exécution des travaux structurels et techniques du projet.",
    keywords: ["travaux", "principal", "réalisation"],
    buildTasks: (today, off) => [
      { title: "Phase 1 — Préparation", description: "Démolition et préparation des zones de travaux.", start_date: shift(today, off), end_date: shift(today, off + 7) },
      { title: "Phase 2 — Réalisation", description: "Exécution des travaux selon CCTP.", start_date: shift(today, off + 7), end_date: shift(today, off + 28) },
      { title: "Phase 3 — Finitions", description: "Finitions, nettoyage et levée des réserves.", start_date: shift(today, off + 28), end_date: shift(today, off + 35) },
    ],
  },
  {
    name: "Réception des travaux",
    lot_type: "Réception",
    reason: "Réception et levée des réserves avant remise des clés.",
    keywords: ["réception", "reception", "levée des réserves"],
    buildTasks: (today, off) => [
      { title: "Visite de chantier et établissement du PV", description: "Tour du chantier avec le maître d'ouvrage et rédaction du PV de réception.", start_date: shift(today, off), end_date: shift(today, off + 1) },
      { title: "Levée des réserves", description: "Correction des défauts constatés lors de la réception.", start_date: shift(today, off + 1), end_date: shift(today, off + 14) },
    ],
  },
];

const TEMPLATES_BY_CATEGORY: Record<ProjectCategory, InterventionTemplate[]> = {
  terrasse: TERRASSE_INTERVENTIONS,
  salle_de_bain: SALLE_DE_BAIN_INTERVENTIONS,
  cuisine: CUISINE_INTERVENTIONS,
  renovation: RENOVATION_INTERVENTIONS,
  extension: EXTENSION_INTERVENTIONS,
  construction_neuf: [...EXTENSION_INTERVENTIONS, ...RENOVATION_INTERVENTIONS.filter(i => i.name === "Électricité" || i.name === "Plâtrerie / Cloisons")],
  toiture: TOITURE_INTERVENTIONS,
  facade: [
    {
      name: "Échafaudage",
      lot_type: "Échafaudage",
      reason: "Mise en place d'un échafaudage pour accès sécurisé à la façade.",
      keywords: ["échafaudage"],
      buildTasks: (today, off) => [
        { title: "Montage de l'échafaudage", description: "Pose périmétrique selon surface de façade.", start_date: shift(today, off), end_date: shift(today, off + 2) },
        { title: "Démontage de l'échafaudage", description: "Après réception des travaux de façade.", start_date: shift(today, off + 28), end_date: shift(today, off + 30) },
      ],
    },
    {
      name: "Ravalement de façade",
      lot_type: "Façade",
      reason: "Nettoyage, traitement et application de l'enduit ou revêtement de façade.",
      keywords: ["ravalement", "façade", "enduit"],
      buildTasks: (today, off) => [
        { title: "Nettoyage et traitement de la façade", description: "Nettoyage haute pression, démoussage et traitement anti-humidité.", start_date: shift(today, off), end_date: shift(today, off + 5) },
        { title: "Réparation des fissures et reprises", description: "Rebouchage des fissures, remplacement des joints.", start_date: shift(today, off + 5), end_date: shift(today, off + 10) },
        { title: "Application enduit ou revêtement", description: "Enduit taloché, bardage ou peinture façade.", start_date: shift(today, off + 10), end_date: shift(today, off + 20) },
      ],
    },
  ],
  combles: [
    {
      name: "Isolation combles",
      lot_type: "Isolation",
      reason: "Isolation thermique des combles par soufflage ou rouleaux.",
      keywords: ["isolation", "combles"],
      buildTasks: (today, off) => [
        { title: "Préparation des combles", description: "Nettoyage, traitement charpente si nécessaire.", start_date: shift(today, off), end_date: shift(today, off + 2) },
        { title: "Pose isolation thermique", description: "Soufflage de laine de verre ou pose de rouleaux en combles perdus.", start_date: shift(today, off + 2), end_date: shift(today, off + 5) },
      ],
    },
    {
      name: "Aménagement des combles",
      lot_type: "Second œuvre",
      reason: "Création d'une pièce habitable dans les combles.",
      keywords: ["aménagement", "amenagement", "habitables"],
      buildTasks: (today, off) => [
        { title: "Création du plancher", description: "Pose d'un plancher sur lambourdes.", start_date: shift(today, off), end_date: shift(today, off + 5) },
        { title: "Cloisons et placo sous rampants", description: "Placo sur fourrures pour habiller les rampants.", start_date: shift(today, off + 5), end_date: shift(today, off + 15) },
        { title: "Fenêtres de toit (Velux)", description: "Création d'ouvertures et pose de fenêtres de toit.", start_date: shift(today, off + 3), end_date: shift(today, off + 8) },
      ],
    },
  ],
  piscine: [
    {
      name: "Terrassement piscine",
      lot_type: "Terrassement",
      reason: "Excavation du bassin selon le gabarit de la piscine.",
      keywords: ["terrassement"],
      buildTasks: (today, off) => [
        { title: "Terrassement et évacuation des terres", description: "Excavation au volume de la piscine + enrobage.", start_date: shift(today, off), end_date: shift(today, off + 5) },
      ],
    },
    {
      name: "Structure du bassin",
      lot_type: "Gros œuvre",
      reason: "Construction des parois béton ou pose de la coque.",
      keywords: ["structure", "bassin", "coque", "béton"],
      buildTasks: (today, off) => [
        { title: "Ferraillage et coulage du bassin", description: "Béton armé imperméabilisé ou pose coque polyester.", start_date: shift(today, off), end_date: shift(today, off + 14) },
        { title: "Étanchéité et revêtement intérieur", description: "Liner, carrelage ou résine étanche.", start_date: shift(today, off + 14), end_date: shift(today, off + 21) },
      ],
    },
    {
      name: "Équipements et plomberie piscine",
      lot_type: "Plomberie",
      reason: "Installation des équipements de filtration, chauffage et traitement.",
      keywords: ["filtration", "pompe", "chauffage"],
      buildTasks: (today, off) => [
        { title: "Pose des skimmers, buses et refoulements", description: "Intégration des équipements hydrauliques dans les parois.", start_date: shift(today, off), end_date: shift(today, off + 5) },
        { title: "Installation local technique", description: "Pompe, filtre, électrolyseur ou traitement.", start_date: shift(today, off + 5), end_date: shift(today, off + 10) },
      ],
    },
  ],
  generic: GENERIC_INTERVENTIONS,
};

// ─── Keyword match checker ────────────────────────────────────────────────────

function alreadyExists(template: InterventionTemplate, existingNames: string[]): boolean {
  const existingLower = existingNames.map((n) =>
    n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );
  for (const kw of template.keywords) {
    const norm = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (existingLower.some((name) => name.includes(norm))) return true;
  }
  // Also check if template name words appear in existing names
  const templateWords = template.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[\s\/]+/);
  for (const word of templateWords) {
    if (word.length < 4) continue;
    if (existingLower.some((name) => name.includes(word))) return true;
  }
  return false;
}

// ─── Default tasks for existing lots ─────────────────────────────────────────

function buildDefaultTasksForLot(lotName: string, today: Date): PlanningSuggestedTask[] {
  const lower = lotName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Try to find a matching template across all categories
  for (const templates of Object.values(TEMPLATES_BY_CATEGORY)) {
    for (const tmpl of templates) {
      if (alreadyExists({ ...tmpl, keywords: [lower] }, [tmpl.name]) === false) {
        for (const kw of tmpl.keywords) {
          const norm = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (lower.includes(norm)) {
            return tmpl.buildTasks(today, 0);
          }
        }
      }
    }
  }
  // Generic fallback — durées compactes et réalistes (2+5+2 = 9 jours)
  return [
    { title: `Préparation — ${lotName}`, description: "Phase de préparation et organisation", start_date: fmt(today), end_date: shift(today, 2) },
    { title: `Réalisation — ${lotName}`, description: "Exécution des travaux", start_date: shift(today, 2), end_date: shift(today, 7) },
    { title: `Finitions — ${lotName}`, description: "Contrôle qualité et finitions", start_date: shift(today, 7), end_date: shift(today, 9) },
  ];
}

/** Calcule la durée en jours entre la première start_date et la dernière end_date d'un ensemble de tâches */
function computeTasksDurationDays(tasks: PlanningSuggestedTask[]): number {
  if (tasks.length === 0) return 7;
  const starts = tasks.map((t) => t.start_date).filter(Boolean);
  const ends = tasks.map((t) => t.end_date).filter(Boolean);
  if (starts.length === 0 || ends.length === 0) return 7;
  const minStart = starts.reduce((a, b) => (a < b ? a : b));
  const maxEnd = ends.reduce((a, b) => (a > b ? a : b));
  const ms = new Date(maxEnd).getTime() - new Date(minStart).getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build a smart PlanningProposal based on the project name/description/type
 * and the list of existing interventions.
 *
 * Used as fallback when the AI backend does not return structured JSON.
 */
export function buildSmartPlanningFallback(
  project: ProjectInfo,
  existingLots: ExistingLot[]
): PlanningProposal {
  const today = new Date();
  const category = detectProjectCategory(project);
  const existingNames = existingLots.map((l) => l.name);

  // Build existing_interventions with smart default tasks
  const existingInterventions = existingLots.map((lot) => ({
    intervention_id: lot.id,
    intervention_name: lot.name,
    existing_tasks: [],
    suggested_tasks: buildDefaultTasksForLot(lot.name, today),
  }));

  // Build suggested_interventions: templates not already covered by existing lots
  const templates = TEMPLATES_BY_CATEGORY[category] ?? GENERIC_INTERVENTIONS;
  let offset = 14; // suggested interventions start 2 weeks from now

  const suggestedInterventions: PlanningSuggestedIntervention[] = [];
  for (const tmpl of templates) {
    if (!alreadyExists(tmpl, existingNames)) {
      const tasks = tmpl.buildTasks(today, offset);
      suggestedInterventions.push({
        name: tmpl.name,
        lot_type: tmpl.lot_type,
        reason: tmpl.reason,
        suggested_tasks: tasks,
      });
      // Enchaîner l'intervention suivante 2 jours après la fin de celle-ci
      offset += computeTasksDurationDays(tasks) + 2;
    }
  }

  // Build the summary message
  const categoryLabels: Record<ProjectCategory, string> = {
    terrasse: "aménagement de terrasse",
    salle_de_bain: "rénovation salle de bain",
    cuisine: "rénovation cuisine",
    renovation: "rénovation intérieure",
    extension: "extension de bâtiment",
    construction_neuf: "construction neuve",
    toiture: "travaux de toiture",
    facade: "ravalement de façade",
    combles: "aménagement des combles",
    piscine: "construction piscine",
    generic: "travaux",
  };

  const isVague = !project.description?.trim() && !project.project_type;
  const categoryLabel = categoryLabels[category];

  const summary = isVague
    ? `Planning suggéré pour « ${project.name} ». Les interventions ci-dessous sont basées sur le nom du projet — n'hésitez pas à préciser le type et la description pour des suggestions plus personnalisées.`
    : `Planning proposé pour votre projet de ${categoryLabel} « ${project.name} ». ${suggestedInterventions.length > 0 ? `${suggestedInterventions.length} nouvelle(s) intervention(s) recommandée(s) en complément de l'existant.` : "Les tâches suggérées permettent de compléter vos interventions existantes."}`;

  const warnings: string[] = [];
  if (isVague) {
    warnings.push("Décrivez votre projet pour obtenir des suggestions plus précises (type, surface, matériaux souhaités).");
  }
  if (existingLots.length === 0 && suggestedInterventions.length > 0) {
    warnings.push("Aucune intervention existante — les nouvelles interventions proposées constituent un plan de départ complet.");
  }

  const priorities: string[] = [];
  if (existingInterventions.length > 0) {
    priorities.push(`Compléter les tâches de « ${existingInterventions[0].intervention_name} »`);
  }
  if (suggestedInterventions.length > 0) {
    priorities.push(`Créer l'intervention « ${suggestedInterventions[0].name} »`);
  }
  if (suggestedInterventions.length > 1) {
    priorities.push(`Planifier « ${suggestedInterventions[1].name} »`);
  }

  return {
    summary,
    existing_interventions: existingInterventions,
    suggested_interventions: suggestedInterventions,
    warnings,
    next_week_priorities: priorities,
  };
}
