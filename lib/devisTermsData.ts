export interface TermExplanation {
  id: string;
  category: string;
  categoryIcon: string;
  categoryColor: string;
  term: string;
  termIcon: string;
  definition: string;
  importance: string;
  example: string;
  typicalCost?: string;
  tips?: string[];
  warnings?: string[];
}

export const categoryColors = {
  diagnostics: {
    color: "#3B82F6",
    icon: "📋",
    lightBg: "#EFF6FF",
    name: "Préparations & Diagnostics",
  },
  travauxCourants: {
    color: "#10B981",
    icon: "🔨",
    lightBg: "#F0FDF4",
    name: "Travaux Courants",
  },
  couts: {
    color: "#8B5CF6",
    icon: "💰",
    lightBg: "#F5F3FF",
    name: "Coûts & Paiements",
  },
  garanties: {
    color: "#F59E0B",
    icon: "🛡️",
    lightBg: "#FFFBEB",
    name: "Garanties & Assurances",
  },
} as const;

export const devisTerms: TermExplanation[] = [
  // ==================== DIAGNOSTICS ====================
  {
    id: "diagnostic-amiante",
    category: categoryColors.diagnostics.name,
    categoryIcon: categoryColors.diagnostics.icon,
    categoryColor: categoryColors.diagnostics.color,
    term: "Diagnostic amiante/plomb",
    termIcon: "🔍",
    definition:
      "Analyse avant travaux pour détecter des matériaux dangereux (amiante, plomb) dans les bâtiments anciens.",
    importance:
      "Si positif, il faut un chantier spécialisé avec protections et filière déchets dédiée, donc un surcoût important.",
    example:
      "Test amiante avant de casser une cloison → si positif : chantier spécialisé (+30–50% sur la démolition).",
    typicalCost: "100–300€ selon surface",
    tips: [
      "Recommandé/obligatoire selon l’âge du bâtiment et la nature des travaux.",
      "Demandez le rapport (et sa date) avant de signer.",
    ],
  },
  {
    id: "diagnostic-structure",
    category: categoryColors.diagnostics.name,
    categoryIcon: categoryColors.diagnostics.icon,
    categoryColor: categoryColors.diagnostics.color,
    term: "Diagnostic structure",
    termIcon: "📐",
    definition:
      "Vérification de la solidité des murs, planchers et charpente par un ingénieur structure.",
    importance:
      "Indispensable avant de toucher à un mur porteur : évite les risques de fissures, affaissement ou danger.",
    example:
      "Avant d’abattre un mur porteur → l’ingénieur dimensionne un renfort (poutre IPN) et ses appuis.",
    typicalCost: "500–1500€ selon complexité",
  },
  {
    id: "etude-sols",
    category: categoryColors.diagnostics.name,
    categoryIcon: categoryColors.diagnostics.icon,
    categoryColor: categoryColors.diagnostics.color,
    term: "Étude de sol (géotechnique)",
    termIcon: "🌍",
    definition:
      "Analyse du terrain pour adapter les fondations (portance, argile, eau, risques).",
    importance:
      "Réduit le risque de fissures/tassements et peut imposer des fondations spécifiques.",
    example:
      "Extension 30m² → étude pour choisir semelles adaptées ou solution type micropieux.",
    typicalCost: "1000–2500€",
  },
  {
    id: "recherche-reseaux",
    category: categoryColors.diagnostics.name,
    categoryIcon: categoryColors.diagnostics.icon,
    categoryColor: categoryColors.diagnostics.color,
    term: "Recherche de réseaux",
    termIcon: "🔌",
    definition:
      "Repérage des réseaux (eau, gaz, électricité, télécoms) avant de creuser ou percer.",
    importance:
      "Évite de toucher un câble ou une canalisation : dangereux et très coûteux à réparer.",
    example:
      "Avant de creuser pour une terrasse → repérage pour éviter de couper un câble électrique.",
    typicalCost: "200–800€ selon zone",
    warnings: [
      "En cas de dégâts sur réseau public, les frais peuvent être très élevés.",
    ],
  },

  // ==================== TRAVAUX COURANTS ====================
  {
    id: "demolition-evacuation",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Démolition & évacuation",
    termIcon: "🧹",
    definition:
      "Dépose/démolition d’éléments existants (cloison, carrelage, cuisine…) + enlèvement des gravats.",
    importance:
      "Le coût dépend surtout du volume, de l’accès (étage, ascenseur) et de la filière de déchets.",
    example:
      "Démolition cloison placo 3m² + évacuation → 300–600€ selon accès.",
    typicalCost: "Souvent au forfait ou au m³",
    tips: ["Vérifiez si la mise en décharge est incluse.", "Demandez si la protection des zones est prévue."],
  },
  {
    id: "gros-oeuvre",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Gros œuvre (murs/cloisons)",
    termIcon: "🧱",
    definition:
      "Travaux de structure : création, modification ou suppression de murs (porteurs ou non).",
    importance:
      "Conditionne la solidité et l’agencement : une erreur peut impacter tout le bâtiment.",
    example:
      "Ouverture dans mur porteur + pose IPN → 1500–4000€ selon largeur et reprises.",
    typicalCost:
      "Cloisons : 100–200€/m² • Mur porteur : 1000–3000€+",
    tips: [
      "Toujours confirmer si un mur est porteur (plan/sondage/ingénieur).",
      "Vérifier si l’étaiement est inclus.",
    ],
  },
  {
    id: "ipn",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "IPN / poutre métallique",
    termIcon: "🏗️",
    definition:
      "Poutre acier (ou équivalent) posée pour reprendre une charge, souvent après ouverture d’un mur porteur.",
    importance:
      "Mal dimensionnée ou mal posée, elle peut créer des fissures, affaissements ou désordres graves.",
    example:
      "Ouverture de 2,5 m dans mur porteur → pose IPN + reprises d’appuis.",
    tips: ["Demandez la note de calcul ou l’avis d’un ingénieur structure.", "Vérifiez les appuis (massifs, poteaux, platines)."],
  },
  {
    id: "placo-ba13",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Placo / BA13",
    termIcon: "🧩",
    definition:
      "Plaque de plâtre (souvent 13 mm) utilisée pour faire des cloisons et doublages sur ossature.",
    importance:
      "Le type de plaque change selon les pièces (hydrofuge en salle de bain, phonique…).",
    example:
      "Cloison placo + isolant + bandes → prix au m² selon épaisseur et performance.",
    typicalCost: "40–90€/m² (selon complexité)",
    tips: ["Hydrofuge (vert) en pièce humide.", "Demandez si l’isolant est inclus (thermique/phonique)."],
  },
  {
    id: "electricite",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Installation électrique",
    termIcon: "⚡",
    definition:
      "Rénovation ou création du réseau : câbles, prises, interrupteurs, éclairage, tableau.",
    importance:
      "La mise aux normes protège contre l’incendie/électrocution et évite des problèmes à la revente.",
    example:
      "T3 (60 m²) : tableau + 30 prises + 15 points lumineux → 3000–6000€.",
    typicalCost: "80–150€ par point (prise/interrupteur)",
    tips: [
      "Vérifier le nombre de points inclus.",
      "Demander la conformité et le schéma/repérage du tableau.",
    ],
    warnings: [
      "Une installation non conforme peut poser problème avec l’assurance en cas de sinistre.",
    ],
  },
  {
    id: "consuel",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Attestation Consuel",
    termIcon: "🧾",
    definition:
      "Document qui atteste que l’installation électrique neuve/modifiée est conforme.",
    importance:
      "Peut être requis pour la mise en service (ou remise en service) de l’électricité selon les cas.",
    example:
      "Rénovation complète avec nouveau tableau → Consuel parfois demandé avant remise sous tension.",
    tips: ["Demandez au pro si le Consuel est inclus dans le devis (démarche + coût)."],
  },
  {
    id: "plomberie",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Plomberie / sanitaire",
    termIcon: "🚰",
    definition:
      "Réseau d’eau (arrivée/évacuation) et pose des équipements (douche, WC, lavabo).",
    importance:
      "Une mauvaise étanchéité peut entraîner des dégâts des eaux coûteux (et des litiges).",
    example:
      "Création salle de bain complète → 2500–5000€ selon équipements.",
    typicalCost: "Pose WC : 200–400€ • Douche : 400–1200€ (pose)",
    tips: ["Vérifier qui fournit les sanitaires (vous ou l’entreprise).", "Demander les tests d’étanchéité si prévus."],
  },
  {
    id: "chauffage",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Chauffage / climatisation",
    termIcon: "🌡️",
    definition:
      "Pose ou remplacement du système (chaudière, PAC, radiateurs) et réglages.",
    importance:
      "Un bon dimensionnement évite surconsommation et inconfort sur 15–20 ans.",
    example:
      "PAC air/eau maison 100 m² → 12 000–18 000€ (hors aides).",
    typicalCost: "Chaudière : 3000–5000€ • PAC : 10 000–15 000€",
    tips: ["Demandez un bilan thermique si changement important.", "Vérifier l’éligibilité aux aides (selon travaux)."],
  },
  {
    id: "etancheite",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Étanchéité (SdB/toiture/terrasse)",
    termIcon: "💧",
    definition:
      "Ensemble des protections contre l’eau (membranes, SPEC/SEL, joints, relevés…).",
    importance:
      "C’est souvent le point le plus critique : une fuite peut provoquer moisissures et dommages structurels.",
    example:
      "Douche à l’italienne → étanchéité + relevés + test avant carrelage.",
    tips: ["Demandez le système prévu (produit, couches, temps de séchage).", "Vérifier si un test d’étanchéité est prévu."],
  },
  {
    id: "chape",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Chape",
    termIcon: "🧱",
    definition:
      "Couche de mortier/béton posée sur une dalle pour obtenir un sol plan avant revêtement.",
    importance:
      "Détermine la planéité et la durabilité du sol (carrelage, parquet).",
    example:
      "Chape pour rattraper 2 cm sur 40 m² → coût au m² + temps de séchage.",
    typicalCost: "20–45€/m² (selon type)",
    tips: ["Demandez le type (liquide, traditionnelle) et le délai avant pose du revêtement."],
  },
  {
    id: "ragreage",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Ragréage",
    termIcon: "📏",
    definition:
      "Enduit de sol autonivelant pour corriger les défauts (bosses/creux) avant un revêtement.",
    importance:
      "Si le support n’est pas plan, le carrelage/parquet peut sonner creux, se fissurer ou mal vieillir.",
    example:
      "Ragréage avant parquet sur 30 m² → +10–20€/m² selon épaisseur.",
    typicalCost: "10–25€/m²",
  },
  {
    id: "isolation",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Isolation thermique",
    termIcon: "🏠",
    definition:
      "Pose d’isolant dans combles, murs ou sols pour limiter les pertes de chaleur.",
    importance:
      "Améliore le confort et peut réduire nettement la facture énergétique (et ouvrir droit à des aides).",
    example:
      "Combles perdus 100 m² (soufflage) → 2500–4000€ selon matériau et accès.",
    typicalCost: "25–50€/m² (combles) • 50–90€/m² (murs ITI)",
  },
  {
    id: "menuiseries",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Menuiseries (portes/fenêtres)",
    termIcon: "🪟",
    definition:
      "Fourniture/pose de fenêtres, portes et volets (PVC, alu, bois…).",
    importance:
      "Impacte l’isolation, l’acoustique et la sécurité. La pose est aussi importante que le produit.",
    example:
      "Remplacement 8 fenêtres PVC DV → 4000–7000€ selon gamme et pose.",
    typicalCost: "Fenêtre PVC : 400–800€ • Alu : 600–1200€",
  },
  {
    id: "revetements-sol",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Revêtements de sol",
    termIcon: "🧩",
    definition:
      "Pose de carrelage, parquet, vinyle, moquette… (souvent avec sous-couche).",
    importance:
      "Le prix dépend du support, du format, des découpes et des plinthes/finition.",
    example:
      "Pose carrelage salon 25 m² (fourniture + pose) → 1500–3000€.",
    typicalCost: "Carrelage : 40–80€/m² • Parquet : 35–120€/m²",
  },
  {
    id: "peinture",
    category: categoryColors.travauxCourants.name,
    categoryIcon: categoryColors.travauxCourants.icon,
    categoryColor: categoryColors.travauxCourants.color,
    term: "Peinture / revêtements muraux",
    termIcon: "🖌️",
    definition:
      "Préparation des supports (enduit, ponçage) + sous-couche + 1–2 couches de finition.",
    importance:
      "La qualité vient surtout de la préparation : elle évite les défauts visibles (traces, fissures).",
    example:
      "Peinture T3 (murs + plafonds, 2 couches) → 2000–4000€ selon état.",
    typicalCost: "20–35€/m² (fourniture + main d’œuvre)",
    tips: ["Demander si la préparation (rebouchage/enduit) est incluse.", "Vérifier les marques/gammes de peinture."],
  },

  // ==================== COÛTS & PAIEMENTS ====================
  {
    id: "acompte",
    category: categoryColors.couts.name,
    categoryIcon: categoryColors.couts.icon,
    categoryColor: categoryColors.couts.color,
    term: "Acompte",
    termIcon: "💳",
    definition:
      "Somme versée à la signature pour lancer le chantier (souvent 20–30% du total).",
    importance:
      "Permet de réserver les dates et de commander des matériaux. À encadrer sur le devis/contrat.",
    example:
      "Devis 10 000€ → acompte 3 000€ → solde 7 000€ selon échéancier.",
    typicalCost: "Souvent 20–30% du total",
    tips: ["Demandez un échéancier clair (acompte, situations, solde).", "Évitez 100% avant travaux."],
    warnings: ["Méfiez-vous si on vous demande une très grosse avance sans justification."],
  },
  {
    id: "situation-travaux",
    category: categoryColors.couts.name,
    categoryIcon: categoryColors.couts.icon,
    categoryColor: categoryColors.couts.color,
    term: "Situation de travaux",
    termIcon: "🧾",
    definition:
      "Facturation intermédiaire liée à l’avancement (par étapes ou pourcentage).",
    importance:
      "Évite de payer tout à la fin et protège aussi l’entreprise sur les achats et la trésorerie.",
    example:
      "Planning 6 semaines → 30% acompte, 40% à mi-parcours, 30% à la réception.",
    tips: ["Demandez les jalons précis (après quoi on facture ?).", "Conservez les preuves (photos, PV)."],
  },
  {
    id: "tva",
    category: categoryColors.couts.name,
    categoryIcon: categoryColors.couts.icon,
    categoryColor: categoryColors.couts.color,
    term: "TVA (Taxe sur la Valeur Ajoutée)",
    termIcon: "📊",
    definition:
      "Taxe ajoutée au prix HT. Le taux dépend du type de travaux et de l’âge du logement.",
    importance:
      "Le taux (5,5%, 10% ou 20%) peut changer fortement le prix TTC.",
    example:
      "Isolation 10 000€ HT → TVA 5,5% = 10 550€ TTC (au lieu de 12 000€ à 20%).",
    tips: [
      "5,5% : rénovation énergétique (selon conditions).",
      "10% : rénovation logement >2 ans (selon travaux).",
      "20% : neuf, certains travaux/achats fournis par vous.",
    ],
  },
  {
    id: "reserve-imprevus",
    category: categoryColors.couts.name,
    categoryIcon: categoryColors.couts.icon,
    categoryColor: categoryColors.couts.color,
    term: "Réserve pour imprévus",
    termIcon: "🧰",
    definition:
      "Marge de sécurité (souvent 10–15%) pour gérer les surprises découvertes en chantier.",
    importance:
      "Dans l’ancien, des aléas sont fréquents (réseaux cachés, supports abîmés) : mieux vaut anticiper.",
    example:
      "Ouverture de mur → découverte d’un câble à déplacer → la réserve évite de bloquer le chantier.",
    typicalCost: "10–15% du budget total",
  },
  {
    id: "penalites-retard",
    category: categoryColors.couts.name,
    categoryIcon: categoryColors.couts.icon,
    categoryColor: categoryColors.couts.color,
    term: "Pénalités de retard",
    termIcon: "⏰",
    definition:
      "Somme due si le délai contractuel est dépassé (si prévu au contrat).",
    importance:
      "Incite à respecter le planning et protège contre les retards non justifiés.",
    example:
      "Devis 10 000€ + pénalités 1%/semaine → 2 semaines de retard = 200€.",
    tips: ["À négocier et à écrire noir sur blanc (avec exceptions réalistes)."],
  },

  // ==================== GARANTIES & ASSURANCES ====================
  {
    id: "assurance-decennale",
    category: categoryColors.garanties.name,
    categoryIcon: categoryColors.garanties.icon,
    categoryColor: categoryColors.garanties.color,
    term: "Assurance décennale",
    termIcon: "🛡️",
    definition:
      "Assurance obligatoire du professionnel qui couvre certains désordres graves pendant 10 ans après la réception.",
    importance:
      "C’est votre meilleure protection sur les travaux qui touchent la solidité ou l’étanchéité.",
    example:
      "Infiltration importante 2 ans après rénovation toiture → prise en charge selon garanties.",
    tips: ["Demandez l’attestation avant signature et vérifiez l’activité couverte."],
    warnings: ["Un pro sans décennale (si obligatoire pour ses travaux) est un gros signal d’alerte."],
  },
  {
    id: "garantie-parfait-achevement",
    category: categoryColors.garanties.name,
    categoryIcon: categoryColors.garanties.icon,
    categoryColor: categoryColors.garanties.color,
    term: "Garantie de parfait achèvement",
    termIcon: "✅",
    definition:
      "Garantie d’un an : le pro doit corriger les défauts signalés à la réception ou dans l’année.",
    importance:
      "Permet de faire reprendre les petits défauts (joints, peinture, réglages).",
    example:
      "Porte qui frotte 3 mois après → reprise incluse au titre du parfait achèvement.",
    tips: ["Faites une réception des travaux avec un PV et des réserves détaillées."],
  },
  {
    id: "garantie-biennale",
    category: categoryColors.garanties.name,
    categoryIcon: categoryColors.garanties.icon,
    categoryColor: categoryColors.garanties.color,
    term: "Garantie biennale (bon fonctionnement)",
    termIcon: "⚙️",
    definition:
      "Garantie de 2 ans sur les équipements dissociables (robinets, radiateurs, volets…).",
    importance:
      "Couvre les éléments remplaçables sans dégrader le bâti.",
    example:
      "Robinet qui fuit 18 mois après → remplacement pris en charge (selon conditions).",
  },
  {
    id: "rc-pro",
    category: categoryColors.garanties.name,
    categoryIcon: categoryColors.garanties.icon,
    categoryColor: categoryColors.garanties.color,
    term: "RC Pro (Responsabilité Civile Pro)",
    termIcon: "🔒",
    definition:
      "Assurance qui couvre les dommages causés à des tiers pendant le chantier.",
    importance:
      "Utile si un dégât est causé chez un voisin ou sur une partie commune.",
    example:
      "Casse d’une vitre dans les parties communes → indemnisation via RC Pro.",
    tips: ["Demandez l’attestation (à jour) comme pour la décennale."],
  },
  {
    id: "dommage-ouvrage",
    category: categoryColors.garanties.name,
    categoryIcon: categoryColors.garanties.icon,
    categoryColor: categoryColors.garanties.color,
    term: "Dommages-ouvrage",
    termIcon: "🏗️",
    definition:
      "Assurance du maître d’ouvrage (vous) qui permet une indemnisation rapide en cas de sinistre, avant recours.",
    importance:
      "Très utile sur gros chantiers : accélère la prise en charge sans attendre de longues procédures.",
    example:
      "Sinistre important → avance des réparations, puis l’assureur se retourne contre les responsables.",
    typicalCost: "Environ 1–4% du montant des travaux",
  },
  {
    id: "reception-travaux",
    category: categoryColors.garanties.name,
    categoryIcon: categoryColors.garanties.icon,
    categoryColor: categoryColors.garanties.color,
    term: "Réception des travaux (PV, réserves)",
    termIcon: "📝",
    definition:
      "Moment officiel où vous acceptez les travaux (avec ou sans réserves) et où démarrent les garanties.",
    importance:
      "Une réception bien faite protège vos droits (réserves, délais de reprise, garanties).",
    example:
      "PV signé avec réserves (joints, retouches) → le pro doit corriger avant levée des réserves.",
    tips: ["Notez tout sur le PV, même les détails.", "Évitez de signer ‘sans réserve’ si quelque chose cloche."],
  },
];

function normalizeForSearch(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Helper pour rechercher des termes (accents tolérés)
export function searchTerms(query: string): TermExplanation[] {
  const q = normalizeForSearch(query);
  if (!q) return devisTerms;

  return devisTerms.filter((term) => {
    const haystack = normalizeForSearch(
      `${term.term} ${term.definition} ${term.category} ${(term.tips || []).join(" ")} ${(term.warnings || []).join(" ")}`
    );
    return haystack.includes(q);
  });
}

// Helper pour obtenir les termes par catégorie
export function getTermsByCategory(categoryName: string): TermExplanation[] {
  return devisTerms.filter((term) => term.category === categoryName);
}

// Helper pour obtenir un terme par ID
export function getTermById(id: string): TermExplanation | undefined {
  return devisTerms.find((term) => term.id === id);
}

// Stats par catégorie
export function getCategoryStats() {
  const stats = new Map<string, number>();
  devisTerms.forEach((term) => {
    const count = stats.get(term.category) || 0;
    stats.set(term.category, count + 1);
  });
  return Object.fromEntries(stats);
}

