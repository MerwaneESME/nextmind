export const formatMemberRole = (role?: string | null): { label: string; color: string } => {
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

export const formatMemberStatus = (status?: string | null): { label: string; color: string } => {
  if (!status) return { label: "En attente", color: "text-amber-600" };
  const normalized = status.toLowerCase();
  if (normalized === "accepted" || normalized === "active")
    return { label: "Actif", color: "text-green-600" };
  if (normalized === "pending" || normalized === "invited")
    return { label: "En attente", color: "text-amber-600" };
  if (normalized === "declined" || normalized === "refused")
    return { label: "Refusé", color: "text-red-500" };
  if (normalized === "removed")
    return { label: "Retiré", color: "text-gray-400" };
  return { label: status, color: "text-gray-500" };
};
