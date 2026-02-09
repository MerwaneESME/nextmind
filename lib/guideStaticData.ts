export type DelaiType = {
  id: string;
  title: string;
  duration: string;
  factors: string[];
  example: string;
};

export type PointAttention = {
  id: string;
  title: string;
  category: string;
  riskLevel: "faible" | "moyen" | "élevé";
  description: string;
  howToCheck?: string;
  solution?: string;
};

export const delaisTypes: DelaiType[] = [
  {
    id: "peinture-piece",
    title: "Peinture d’une pièce",
    duration: "1–3 jours",
    factors: ["surface", "état des murs", "nombre de couches"],
    example: "Chambre 15m² : 2 jours (préparation + 2 couches).",
  },
  {
    id: "renovation-sdb",
    title: "Rénovation complète salle de bain",
    duration: "10–20 jours",
    factors: ["plomberie", "carrelage", "étanchéité", "surface"],
    example: "SDB 5m² : 15 jours (démolition, plomberie, carrelage, finitions).",
  },
  {
    id: "cuisine-complete",
    title: "Cuisine complète",
    duration: "5–15 jours",
    factors: ["sur-mesure", "électricité", "plomberie", "livraisons"],
    example: "Cuisine 10m² : 10 jours (pose, raccordements, finitions).",
  },
];

export const pointsAttention: PointAttention[] = [
  {
    id: "amiante-pre-1997",
    title: "Amiante (logement avant 1997)",
    category: "Sécurité",
    riskLevel: "élevé",
    description:
      "Tout logement construit avant 1997 peut contenir de l’amiante (dalles, colles, isolation). Une découverte en cours peut bloquer le chantier.",
    howToCheck: "Demander un diagnostic amiante avant travaux de démolition/perçage/ponçage.",
    solution: "Si présence confirmée : désamiantage par une entreprise certifiée (coût variable).",
  },
  {
    id: "humidite-ventilation",
    title: "Humidité & ventilation",
    category: "Technique",
    riskLevel: "moyen",
    description:
      "Une mauvaise ventilation peut causer moisissures, cloques de peinture et dégâts sur les supports, surtout en pièces humides.",
    howToCheck: "Vérifier VMC/extracteur, traces de moisissures, odeurs, humidité persistante.",
    solution: "Traiter la cause (VMC, étanchéité, infiltration) avant de refaire les finitions.",
  },
];

