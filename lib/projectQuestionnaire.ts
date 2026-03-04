/**
 * Configuration du questionnaire de création de projet (particulier)
 * Champs adaptés par type de travaux pour fournir des informations précises aux pros
 */

export type QuestionnaireFieldType = "text" | "textarea" | "select" | "number";

export type QuestionnaireField = {
  key: string;
  label: string;
  type: QuestionnaireFieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
};

export const PROJECT_TYPES_PARTICULIER = [
  { value: "", label: "Sélectionnez le type de travaux" },
  { value: "renovation", label: "Rénovation globale" },
  { value: "construction", label: "Construction neuve" },
  { value: "extension", label: "Extension" },
  { value: "plomberie", label: "Plomberie" },
  { value: "electricite", label: "Électricité" },
  { value: "peinture", label: "Peinture" },
  { value: "carrelage", label: "Carrelage / Faïence" },
  { value: "menuiserie", label: "Menuiserie" },
  { value: "chauffage", label: "Chauffage / Climatisation" },
  { value: "toiture", label: "Toiture / Zinguerie" },
  { value: "isolation", label: "Isolation" },
  { value: "autre", label: "Autre" },
] as const;

/** Champs du questionnaire par type de travaux - tous obligatoires */
export const QUESTIONNAIRE_BY_TYPE: Record<string, QuestionnaireField[]> = {
  renovation: [
    {
      key: "piecesConcernes",
      label: "Pièces concernées *",
      type: "text",
      placeholder: "Ex. cuisine, salon, salle de bain, chambre...",
    },
    {
      key: "etatActuel",
      label: "État actuel du logement *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "a_refaire", label: "À refaire entièrement" },
        { value: "reamenagement", label: "Réaménagement / modernisation" },
        { value: "mise_aux_normes", label: "Mise aux normes" },
        { value: "cosmetique", label: "Travaux cosmétiques uniquement" },
      ],
    },
    {
      key: "besoinsSpecifiques",
      label: "Besoins spécifiques *",
      type: "textarea",
      placeholder: "Architecte, travaux électriques inclus, plomberie, isolation...",
    },
  ],
  construction: [
    {
      key: "typeTerrain",
      label: "Type de terrain *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "terrain_nu", label: "Terrain nu" },
        { value: "lotissement", label: "Lotissement" },
        { value: "remplacement", label: "Remplacement d'un bâtiment existant" },
        { value: "autre", label: "Autre" },
      ],
    },
    {
      key: "surfaceConstructible",
      label: "Surface constructible (m²) *",
      type: "number",
      min: 1,
      max: 2000,
      step: 1,
      placeholder: "Ex. 120",
    },
    {
      key: "permisConstruire",
      label: "Permis de construire *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "obtenu", label: "Obtenu" },
        { value: "en_cours", label: "En cours de demande" },
        { value: "pas_encore", label: "Pas encore demandé" },
      ],
    },
  ],
  extension: [
    {
      key: "surfaceAjouter",
      label: "Surface à ajouter (m²) *",
      type: "number",
      min: 5,
      max: 500,
      step: 1,
      placeholder: "Ex. 25",
    },
    {
      key: "typeLocal",
      label: "Type de local à créer *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "sejour", label: "Séjour / salon" },
        { value: "chambre", label: "Chambre" },
        { value: "bureau", label: "Bureau" },
        { value: "salle_de_bain", label: "Salle de bain" },
        { value: "cuisine", label: "Cuisine" },
        { value: "garage", label: "Garage / dépendance" },
        { value: "autre", label: "Autre" },
      ],
    },
    {
      key: "accesExist",
      label: "Accès existant au bâtiment *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "oui_facile", label: "Oui, accès facile" },
        { value: "oui_difficile", label: "Oui, accès difficile" },
        { value: "non", label: "Non, à créer" },
      ],
    },
  ],
  plomberie: [
    {
      key: "typePlomberie",
      label: "Type de travaux plomberie *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "salle_de_bain", label: "Salle de bain complète" },
        { value: "cuisine", label: "Cuisine (évier, robinetterie)" },
        { value: "wc", label: "WC / sanitaires" },
        { value: "chauffage", label: "Chauffage / radiateurs" },
        { value: "depannage", label: "Dépannage / réparation" },
        { value: "autre", label: "Autre" },
      ],
    },
    {
      key: "travauxExistants",
      label: "Nature des travaux *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "remplacement", label: "Remplacement d'équipements existants" },
        { value: "installation_neuve", label: "Installation neuve" },
        { value: "depannage", label: "Dépannage / réparation" },
      ],
    },
    {
      key: "nbPieces",
      label: "Nombre de pièces concernées *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "1", label: "1 pièce" },
        { value: "2_3", label: "2 à 3 pièces" },
        { value: "toute_maison", label: "Toute la maison" },
      ],
    },
  ],
  electricite: [
    {
      key: "nbPieces",
      label: "Nombre de pièces à équiper *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "1_2", label: "1 à 2 pièces" },
        { value: "3_5", label: "3 à 5 pièces" },
        { value: "6_plus", label: "6 pièces et plus" },
        { value: "toute_maison", label: "Toute la maison" },
      ],
    },
    {
      key: "tableauExistant",
      label: "Tableau électrique existant *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "oui_conforme", label: "Oui, conforme aux normes" },
        { value: "oui_a_remplacer", label: "Oui, à remplacer" },
        { value: "non", label: "Non, à installer" },
      ],
    },
    {
      key: "miseAuxNormes",
      label: "Mise aux normes NF C 15-100 *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "oui", label: "Oui, nécessaire" },
        { value: "non", label: "Non, déjà aux normes" },
        { value: "a_verifier", label: "À vérifier" },
      ],
    },
  ],
  peinture: [
    {
      key: "pieces",
      label: "Pièces à peindre *",
      type: "text",
      placeholder: "Ex. salon, chambre 1 et 2, couloir...",
    },
    {
      key: "typePeinture",
      label: "Type de peinture *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "interieur", label: "Intérieur uniquement" },
        { value: "exterieur", label: "Extérieur uniquement" },
        { value: "les_deux", label: "Intérieur et extérieur" },
      ],
    },
    {
      key: "preparationSupport",
      label: "État du support *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "propre", label: "Propre, prêt à peindre" },
        { value: "a_preparer", label: "À préparer (enduit, ponçage...)" },
        { value: "a_definir", label: "À définir avec le pro" },
      ],
    },
  ],
  carrelage: [
    {
      key: "pieces",
      label: "Pièces à carreler *",
      type: "text",
      placeholder: "Ex. salle de bain, cuisine, entrée...",
    },
    {
      key: "typePose",
      label: "Type de pose *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "sol", label: "Sol uniquement" },
        { value: "mur", label: "Mur uniquement (faïence)" },
        { value: "sol_et_mur", label: "Sol et murs" },
      ],
    },
    {
      key: "formatCarreaux",
      label: "Format des carreaux souhaité *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "petit", label: "Petit format (< 30 cm)" },
        { value: "moyen", label: "Moyen format (30-60 cm)" },
        { value: "grand", label: "Grand format (> 60 cm)" },
        { value: "conseil_pro", label: "Conseil du professionnel" },
      ],
    },
  ],
  menuiserie: [
    {
      key: "typeMenuiserie",
      label: "Type de menuiserie *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "portes", label: "Portes intérieures" },
        { value: "fenetres", label: "Fenêtres" },
        { value: "placards", label: "Placards / dressing" },
        { value: "escalier", label: "Escalier" },
        { value: "parquet", label: "Parquet / sol bois" },
        { value: "autre", label: "Autre" },
      ],
    },
    {
      key: "nbPieces",
      label: "Nombre de pièces / éléments *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "1_2", label: "1 à 2 éléments" },
        { value: "3_5", label: "3 à 5 éléments" },
        { value: "6_plus", label: "6 éléments et plus" },
      ],
    },
    {
      key: "materiaux",
      label: "Matériaux souhaités *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "bois", label: "Bois" },
        { value: "pvc", label: "PVC" },
        { value: "aluminium", label: "Aluminium" },
        { value: "mixte", label: "Mixte (conseil du pro)" },
      ],
    },
  ],
  chauffage: [
    {
      key: "typeChauffage",
      label: "Type de chauffage souhaité *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "chaudiere_gaz", label: "Chaudière gaz" },
        { value: "chaudiere_fioul", label: "Chaudière fioul" },
        { value: "pac", label: "Pompe à chaleur (PAC)" },
        { value: "radiateurs", label: "Radiateurs électriques" },
        { value: "plancher_chauffant", label: "Plancher chauffant" },
        { value: "poele", label: "Poêle (bois, granulés)" },
        { value: "autre", label: "Autre" },
      ],
    },
    {
      key: "combustibleActuel",
      label: "Énergie actuelle *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "gaz", label: "Gaz" },
        { value: "fioul", label: "Fioul" },
        { value: "electrique", label: "Électrique" },
        { value: "bois", label: "Bois / granulés" },
        { value: "aucun", label: "Aucun (construction neuve)" },
      ],
    },
    {
      key: "surfaceChauffer",
      label: "Surface à chauffer (m²) *",
      type: "number",
      min: 10,
      max: 500,
      step: 1,
      placeholder: "Ex. 80",
    },
  ],
  toiture: [
    {
      key: "typeToiture",
      label: "Type de couverture *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "tuiles", label: "Tuiles" },
        { value: "ardoises", label: "Ardoises" },
        { value: "zinc", label: "Zinc" },
        { value: "bac_acier", label: "Bac acier" },
        { value: "shingle", label: "Shingle (bardeaux)" },
        { value: "autre", label: "Autre" },
      ],
    },
    {
      key: "acces",
      label: "Accès au toit *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "facile", label: "Facile (échelle suffisante)" },
        { value: "difficile", label: "Difficile (hauteur, pente)" },
        { value: "echafaudage", label: "Échafaudage nécessaire" },
      ],
    },
    {
      key: "travauxZinguerie",
      label: "Travaux de zinguerie inclus ? *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "oui", label: "Oui (gouttières, faîtage...)" },
        { value: "non", label: "Non" },
        { value: "a_verifier", label: "À vérifier" },
      ],
    },
  ],
  isolation: [
    {
      key: "typeIsolation",
      label: "Type d'isolation *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "combles", label: "Combles / toiture" },
        { value: "iti", label: "ITI (intérieur)" },
        { value: "ite", label: "ITE (extérieur)" },
        { value: "sous_sol", label: "Sous-sol / cave" },
        { value: "mixte", label: "Plusieurs types" },
      ],
    },
    {
      key: "materiaux",
      label: "Matériaux souhaités *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "laine_roche", label: "Laine de roche" },
        { value: "ouate_cellulose", label: "Ouate de cellulose" },
        { value: "polystyrene", label: "Polystyrène" },
        { value: "laine_bois", label: "Laine de bois" },
        { value: "conseil_pro", label: "Conseil du professionnel" },
      ],
    },
    {
      key: "performance",
      label: "Objectif de performance *",
      type: "select",
      options: [
        { value: "", label: "Sélectionnez" },
        { value: "confort", label: "Confort thermique" },
        { value: "economies", label: "Économies d'énergie" },
        { value: "re2020", label: "Conformité RE 2020" },
        { value: "conseil_pro", label: "Conseil du professionnel" },
      ],
    },
  ],
  autre: [
    {
      key: "descriptionDetaillee",
      label: "Description détaillée du projet *",
      type: "textarea",
      placeholder: "Décrivez précisément vos besoins : type de travaux, pièces concernées, contraintes, délais...",
    },
  ],
};

export function getQuestionnaireFields(projectType: string): QuestionnaireField[] {
  if (!projectType) return [];
  return QUESTIONNAIRE_BY_TYPE[projectType] ?? [];
}

/** Libellés lisibles pour les clés du questionnaire (fallback) */
const QUESTIONNAIRE_KEY_LABELS: Record<string, string> = {
  piecesConcernes: "Pièces concernées",
  etatActuel: "État actuel du logement",
  besoinsSpecifiques: "Besoins spécifiques",
  typeTerrain: "Type de terrain",
  surfaceConstructible: "Surface constructible (m²)",
  permisConstruire: "Permis de construire",
  surfaceAjouter: "Surface à ajouter (m²)",
  typeLocal: "Type de local à créer",
  accesExist: "Accès existant au bâtiment",
  typePlomberie: "Type de travaux plomberie",
  travauxExistants: "Travaux existants",
  nbPieces: "Nombre de pièces",
  tableauExistant: "Tableau électrique existant",
  miseAuxNormes: "Mise aux normes",
  pieces: "Pièces concernées",
  typePeinture: "Type de travaux peinture",
  preparationSupport: "Préparation du support",
  typePose: "Type de pose",
  formatCarreaux: "Format des carreaux",
  typeCarrelage: "Type de carrelage",
  typeMenuiserie: "Type de menuiserie",
  materiaux: "Matériaux souhaités",
  typeChauffage: "Type de chauffage",
  combustibleActuel: "Combustible actuel",
  surfaceChauffer: "Surface à chauffer (m²)",
  typeToiture: "Type de couverture",
  acces: "Accès au toit",
  travauxZinguerie: "Travaux de zinguerie inclus",
  typeIsolation: "Type d'isolation",
  performance: "Objectif de performance",
  descriptionDetaillee: "Description détaillée",
};

/** Formate les réponses du questionnaire pour affichage (récap pro) */
export function formatQuestionnaireForDisplay(
  projectType: string,
  questionnaireData: Record<string, string | number | null> | null
): { label: string; value: string }[] {
  if (!questionnaireData || !Object.keys(questionnaireData).length) return [];
  const fields = getQuestionnaireFields(projectType);
  const seen = new Set<string>();
  const result: { label: string; value: string }[] = [];
  for (const field of fields) {
    const raw = questionnaireData[field.key];
    if (raw === undefined || raw === null || raw === "") continue;
    seen.add(field.key);
    let value = String(raw);
    if (field.type === "select" && field.options) {
      const opt = field.options.find((o) => o.value === raw || o.value === value);
      if (opt) value = opt.label;
    }
    result.push({ label: field.label.replace(/\s*\*$/, ""), value });
  }
  for (const [key, raw] of Object.entries(questionnaireData)) {
    if (raw === undefined || raw === null || raw === "") continue;
    if (seen.has(key)) continue;
    const label = QUESTIONNAIRE_KEY_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    result.push({ label, value: String(raw) });
  }
  return result;
}

/** Libellé du type de travaux */
export function getProjectTypeLabel(value: string): string {
  const opt = PROJECT_TYPES_PARTICULIER.find((o) => o.value === value);
  return opt?.label ?? value;
}
