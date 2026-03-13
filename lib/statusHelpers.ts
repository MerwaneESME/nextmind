import type { QuoteSummary } from "@/lib/quotesStore";

// ─── Workflow Status (Devis) ──────────────────────────────────────────────────

export type WorkflowStatus = "a_faire" | "envoye" | "valide" | "refuse";

export const resolveWorkflowStatus = (quote: QuoteSummary): WorkflowStatus => {
  const metadata = quote.rawMetadata ?? {};
  const workflow =
    typeof metadata.workflow_status === "string" ? metadata.workflow_status : null;
  if (
    workflow === "a_faire" ||
    workflow === "envoye" ||
    workflow === "valide" ||
    workflow === "refuse"
  ) {
    return workflow;
  }
  const status = typeof quote.status === "string" ? quote.status.toLowerCase() : "";
  if (status === "valide" || status === "refuse") {
    return status as WorkflowStatus;
  }
  if (status === "envoye" || status === "published") {
    return "envoye";
  }
  return "a_faire";
};

export const getWorkflowLabel = (status: WorkflowStatus) => {
  const labels: Record<WorkflowStatus, string> = {
    a_faire: "En étude",
    envoye: "Envoyé",
    valide: "Validé",
    refuse: "Refusé",
  };
  return labels[status];
};

export const getWorkflowBadge = (status: WorkflowStatus) => {
  const styles: Record<WorkflowStatus, string> = {
    a_faire: "bg-amber-100 text-amber-800",
    envoye: "bg-blue-100 text-blue-800",
    valide: "bg-green-100 text-green-800",
    refuse: "bg-red-100 text-red-800",
  };
  return styles[status];
};

// ─── Project Status ───────────────────────────────────────────────────────────

export type ProjectStatusKey = "draft" | "en_cours" | "termine" | "en_attente";

export const resolveProjectStatus = (status: string | null): ProjectStatusKey => {
  if (!status) return "draft";
  const normalized = status.toLowerCase();
  if (["draft", "a_faire"].includes(normalized)) return "draft";
  if (["en_cours", "in_progress", "active"].includes(normalized)) return "en_cours";
  if (["termine", "completed", "done"].includes(normalized)) return "termine";
  if (["en_attente", "pending"].includes(normalized)) return "en_attente";
  return "en_attente";
};

export type ProjectStatusValue = "draft" | "en_cours" | "en_attente" | "termine";

export const PROJECT_STATUS_OPTIONS = [
  { value: "draft", label: "À faire" },
  { value: "en_cours", label: "En cours" },
  { value: "en_attente", label: "En attente" },
  { value: "termine", label: "Terminé" },
] as const;

export const PROJECT_STATUS_DB_MAP: Record<ProjectStatusValue, string[]> = {
  draft: ["draft", "a_faire"],
  en_cours: ["en_cours", "in_progress", "active"],
  en_attente: ["en_attente", "pending", "paused", "quoted", "cancelled"],
  termine: ["termine", "completed", "done"],
};

export const normalizeProjectStatus = (status: string | null): ProjectStatusValue => {
  if (!status) return "draft";
  const normalized = status.toLowerCase();
  if (["en_cours", "in_progress", "active"].includes(normalized)) return "en_cours";
  if (["termine", "completed", "done"].includes(normalized)) return "termine";
  if (["en_attente", "pending", "paused", "quoted", "cancelled"].includes(normalized))
    return "en_attente";
  return "draft";
};

// ─── Generic Status Display Helpers ───────────────────────────────────────────

export const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    draft: "bg-neutral-100 text-neutral-700",
    en_cours: "bg-primary-50 text-primary-700",
    termine: "bg-emerald-50 text-emerald-700",
    en_attente: "bg-amber-50 text-amber-700",
    a_faire: "bg-neutral-100 text-neutral-700",
    envoye: "bg-primary-50 text-primary-700",
    valide: "bg-emerald-50 text-emerald-700",
    refuse: "bg-red-50 text-red-700",
  };
  return styles[status] || styles.en_attente;
};

export const getStatusDotClass = (status: string) => {
  const dots: Record<string, string> = {
    draft: "bg-neutral-400",
    en_cours: "bg-primary-400",
    termine: "bg-emerald-400",
    en_attente: "bg-amber-400",
    a_faire: "bg-neutral-400",
    envoye: "bg-primary-400",
    valide: "bg-emerald-400",
    refuse: "bg-red-400",
  };
  return dots[status] || dots.en_attente;
};

export const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    draft: "En étude",
    en_cours: "En cours",
    termine: "Terminé",
    en_attente: "En attente",
    a_faire: "En étude",
    envoye: "Envoyé",
    valide: "Validé",
    refuse: "Refusé",
  };
  return labels[status] || status;
};

// ─── Member Display Helpers ───────────────────────────────────────────────────

export const formatMemberRole = (
  role?: string | null
): { label: string; color: string } => {
  if (!role) return { label: "Membre", color: "bg-gray-100 text-gray-700" };
  const normalized = role.toLowerCase();
  if (normalized === "owner")
    return { label: "Chef de projet", color: "bg-indigo-100 text-indigo-700" };
  if (normalized === "collaborator" || normalized === "collaborateur")
    return { label: "Collaborateur", color: "bg-blue-100 text-blue-700" };
  if (normalized === "client" || normalized === "particulier")
    return { label: "Client", color: "bg-amber-100 text-amber-700" };
  if (normalized === "pro" || normalized === "professionnel")
    return { label: "Professionnel", color: "bg-emerald-100 text-emerald-700" };
  return { label: role, color: "bg-gray-100 text-gray-700" };
};

export const formatMemberStatus = (
  status?: string | null
): { label: string; color: string } => {
  if (!status) return { label: "En attente", color: "text-amber-600" };
  const normalized = status.toLowerCase();
  if (normalized === "accepted" || normalized === "active")
    return { label: "Actif", color: "text-green-600" };
  if (normalized === "pending" || normalized === "invited")
    return { label: "En attente", color: "text-amber-600" };
  if (normalized === "declined" || normalized === "refused")
    return { label: "Refusé", color: "text-red-500" };
  if (normalized === "removed") return { label: "Retiré", color: "text-gray-400" };
  return { label: status, color: "text-gray-500" };
};
