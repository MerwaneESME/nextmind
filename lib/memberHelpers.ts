import React from "react";

export type CustomRole = {
  id: string;
  name: string;
  color: string;
  permissions: string[];
};

export type ProjectPermission =
  | "read"
  | "chat"
  | "documents"
  | "budget"
  | "interventions"
  | "tasks"
  | "planning"
  | "members"
  | "assistant"
  | "admin";

export const hasPermission = (
  role: string | null | undefined,
  permission: ProjectPermission,
  customRoles: CustomRole[] = []
): boolean => {
  if (!role) return false;
  const normalized = role.toLowerCase();

  // Owner always has all permissions
  if (normalized === "owner") return true;

  // System roles
  if (normalized === "collaborator" || normalized === "collaborateur" || normalized === "pro" || normalized === "professionnel") {
    // These roles historically have full management rights in this project
    return true; 
  }
  
  if (normalized === "client" || normalized === "particulier") {
    return permission === "read" || permission === "chat";
  }

  // Custom roles
  const customRole = customRoles.find(r => r.id === role || r.name === role);
  if (customRole) {
    const perms = (customRole.permissions || []) as string[];
    const normalizedPerms = perms.map(p => p.toLowerCase());
    const permSet = new Set(normalizedPerms);
    if (permSet.has("admin")) return true;

    if (permission === "admin") return false;
    if (permission === "read") return true;

    if (permission === "tasks") return permSet.has("tasks") || permSet.has("interventions");
    if (permission === "planning") return permSet.has("planning") || permSet.has("interventions");
    if (permission === "assistant") return permSet.has("assistant") || permSet.has("interventions");
    if (permission === "interventions") return permSet.has("interventions");

    return permSet.has(permission);
  }

  return false;
};

export const formatMemberRole = (
  role?: string | null,
  customRoles: CustomRole[] = []
): { label: string; color: string; style?: React.CSSProperties } => {
  if (!role) return { label: "Membre", color: "bg-gray-100 text-gray-700" };
  
  const normalized = role.toLowerCase();

  // Try to find in custom roles first
  const customRole = customRoles.find(r => r.id === role || r.name === role);
  if (customRole) {
    return { 
      label: customRole.name, 
      color: "text-white", 
      style: { backgroundColor: customRole.color } 
    };
  }

  if (normalized === "owner")
    return { label: "Chef de projet", color: "bg-indigo-100 text-indigo-700" };
  if (normalized === "collaborator" || normalized === "collaborateur")
    return { label: "Collaborateur", color: "bg-blue-100 text-blue-700" };
  if (normalized === "client" || normalized === "particulier")
    return { label: "Client", color: "bg-amber-100 text-amber-700" };
  if (normalized === "pro" || normalized === "professionnel")
    return { label: "Professionnel", color: "bg-emerald-100 text-emerald-700" };

  if (role.startsWith("custom:")) {
    const parts = role.split(":");
    let customName = "Personnalisé";
    let permsStr = "";
    
    if (parts.length >= 3) {
      customName = parts[1];
      permsStr = parts.slice(2).join(":");
    } else if (parts.length === 2) {
      permsStr = parts[1];
    }

    const perms = (permsStr.split(",").filter(Boolean)) as string[];
    if (perms.length === 0) {
      return { label: customName, color: "bg-purple-100 text-purple-700" };
    }
    const translated = perms.map((p: string) => {
      const low = p.toLowerCase();
      if (low === "admin") return "Admin";
      if (low === "read") return "Lecture";
      if (low === "interventions") return "Interventions";
      if (low === "tasks") return "Tâches";
      if (low === "planning") return "Planning";
      if (low === "documents") return "Documents";
      if (low === "budget") return "Budget";
      if (low === "chat") return "Chat";
      if (low === "members") return "Membres";
      if (low === "assistant") return "Assistant IA";
      return p;
    });
    return { label: `${customName} (${translated.join(", ")})`, color: "bg-purple-100 text-purple-700" };
  }

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
