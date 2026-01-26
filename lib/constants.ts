/**
 * Constantes de l'application
 */

export const APP_NAME = "NEXTMIND";
export const APP_TAGLINE = "Tout sur le BTP pour mieux vous accompagner";

export const USER_ROLES = {
  PARTICULIER: "particulier",
  PROFESSIONNEL: "professionnel",
} as const;

export const PROJECT_STATUS = {
  EN_COURS: "en_cours",
  TERMINE: "termine",
  EN_ATTENTE: "en_attente",
} as const;

export const QUOTE_STATUS = {
  A_FAIRE: "a_faire",
  ENVOYE: "envoye",
  VALIDE: "valide",
  REFUSE: "refuse",
} as const;

export const ALERT_TYPES = {
  RETARD_CHANTIER: "retard_chantier",
  NOUVEAU_MESSAGE: "nouveau_message",
  DEVIS_EXPIRE: "devis_expire",
  AUTRE: "autre",
} as const;

export const NAVIGATION = {
  PARTICULIER: [
    { href: "/dashboard", label: "Mes projets" },
    { href: "/dashboard/professionnels", label: "Professionnels" },
    { href: "/dashboard/messages", label: "Messages" },
    { href: "/dashboard/settings", label: "Paramètres" },
  ],
  PROFESSIONNEL: [
    { href: "/dashboard", label: "Tableau de bord" },
    { href: "/dashboard/projets", label: "Projets" },
    { href: "/dashboard/devis", label: "Devis" },
    { href: "/dashboard/messages", label: "Messages" },
    { href: "/dashboard/settings", label: "Paramètres" },
  ],
} as const;

