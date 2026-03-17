import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMemberRole, formatMemberStatus, type CustomRole } from "@/lib/memberHelpers";
import { mergeWithDefaultProjectRoles } from "@/lib/defaultProjectRoles";
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  ListChecks,
  Lock,
  MessageCircle,
  Palette,
  Plus,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";

export type Member = {
  id: string;
  role: string | null;
  status: string | null;
  invited_email: string | null;
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    company_name: string | null;
    avatar_url?: string | null;
  } | null;
};

export interface MembersTabProps {
  members: Member[];
  project: {
    id: string;
    metadata?: {
      roles?: CustomRole[];
    };
    created_by?: string | null;
  };
  initialView?: "list" | "roles" | "invite";
  onViewChange?: (view: "list" | "roles" | "invite") => void;
  canInviteMembers: boolean;
  currentUserId?: string | null;
  onInvite: (email: string, role: string) => Promise<void>;
  onUpdateMetadata: (metadata: any) => Promise<void>;
  onUpdateMemberRole: (userId: string, role: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
}

export function MembersTab({
  members,
  project,
  initialView = "list",
  onViewChange,
  canInviteMembers,
  currentUserId,
  onInvite,
  onUpdateMetadata,
  onUpdateMemberRole,
  onRemoveMember,
}: MembersTabProps) {
  const [view, setView] = useState<"list" | "roles" | "invite">(initialView);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("client");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States for role management
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#3b82f6");
  const [newRolePerms, setNewRolePerms] = useState({
    admin: false,
    read: true,
    interventions: false,
    tasks: false,
    planning: false,
    documents: false,
    budget: false,
    chat: false,
    members: false,
    assistant: false,
  });

  console.log("[MembersTab] Debug:", { 
    currentUserId, 
    projectCreator: project?.created_by,
    isCreator: project?.created_by === currentUserId 
  });

  if (!project) {
    return (
      <Card className="border-none shadow-sm bg-white/60 backdrop-blur-md p-8 flex flex-col items-center justify-center min-h-[300px]">
        <div className="h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Chargement des membres...</p>
      </Card>
    );
  }

  const customRoles = mergeWithDefaultProjectRoles(project?.metadata?.roles || []);
  const isBaseRole = (id: string) => id.startsWith("base_");

  const setViewAndPersist = (next: "list" | "roles" | "invite") => {
    setView(next);
    onViewChange?.(next);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setError(null);
    setIsProcessing(true);
    try {
      await onInvite(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      setViewAndPersist("list");
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'invitation");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveRole = async () => {
    if (!newRoleName.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const perms: string[] = [];
      const permKeys = [
        "read",
        "chat",
        "documents",
        "budget",
        "interventions",
        "tasks",
        "planning",
        "members",
        "assistant",
        "admin",
      ] as const;
      for (const key of permKeys) {
        if ((newRolePerms as any)[key]) perms.push(key);
      }
      if (!perms.includes("read")) perms.unshift("read");

      let updatedRoles = [...customRoles];
      if (editingRole) {
        updatedRoles = updatedRoles.map(r => 
          r.id === editingRole.id 
            ? { ...r, name: newRoleName, color: newRoleColor, permissions: perms }
            : r
        );
      } else {
        const newRole: CustomRole = {
          id: `role_${Date.now()}`,
          name: newRoleName,
          color: newRoleColor,
          permissions: perms,
        };
        updatedRoles.push(newRole);
      }

      await onUpdateMetadata({ ...project?.metadata, roles: updatedRoles });
      setEditingRole(null);
      setNewRoleName("");
      setNewRoleColor("#3b82f6");
      setNewRolePerms({
        admin: false,
        read: true,
        interventions: false,
        tasks: false,
        planning: false,
        documents: false,
        budget: false,
        chat: false,
        members: false,
        assistant: false,
      });
      setViewAndPersist("roles");
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la sauvegarde du rôle");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (isBaseRole(roleId)) {
      setError("Ce rôle de base ne peut pas être supprimé.");
      return;
    }
    if (!confirm("Supprimer ce rôle ?")) return;
    setIsProcessing(true);
    try {
      const updatedRoles = customRoles.filter(r => r.id !== roleId);
      await onUpdateMetadata({ ...project?.metadata, roles: updatedRoles });
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la suppression");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button 
            variant={view === "list" ? "primary" : "ghost"} 
            size="sm"
            onClick={() => setViewAndPersist("list")}
            className="rounded-full"
          >
            <Users className="h-4 w-4 mr-2" />
            Membres
          </Button>
          <Button 
            variant={view === "roles" ? "primary" : "ghost"} 
            size="sm"
            onClick={() => setViewAndPersist("roles")}
            className="rounded-full"
          >
            <Shield className="h-4 w-4 mr-2" />
            Rôles
          </Button>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setViewAndPersist("invite")}
          disabled={!canInviteMembers}
          className="rounded-full border-primary-200 text-primary-700 hover:bg-primary-50"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Inviter
        </Button>
      </div>

      {view === "list" && (
        <Card className="border-none shadow-sm bg-white/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary-500" />
              Membres du projet ({members.length})
            </h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map((member) => {
              const roleInfo = formatMemberRole(member.role, customRoles);
              const statusInfo = formatMemberStatus(member.status);
              const isOwner = member.role?.toLowerCase() === 'owner';
              const isCreator = project.created_by === currentUserId;
              const isMemberCreator = member.user?.id === project.created_by;
              const isSelf = member.user?.id === currentUserId;
              
              // On peut gérer si :
              // 1. On est le créateur (sauf soi-même)
              // 2. OU on est un owner/manager (canInviteMembers) ET on ne touche pas au créateur ni à soi-même
              const isManagingAllowed = !isSelf && (isCreator || (canInviteMembers && !isMemberCreator));

              return (
                <div key={member.id} className="group flex items-center gap-4 p-3 rounded-xl border border-gray-100 bg-white hover:border-primary-100 hover:shadow-sm transition-all">
                  <div className="relative">
                    {member.user?.avatar_url ? (
                      <img src={member.user.avatar_url} className="h-10 w-10 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                        {(member.user?.full_name || member.invited_email || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${member.status?.toLowerCase() === 'active' || member.status?.toLowerCase() === 'accepted' ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate flex items-center gap-2">
                      {member.user?.full_name || member.invited_email}
                      {isOwner && <Shield className="h-3 w-3 text-amber-500" />}
                    </div>
                    <div className="text-xs text-gray-500">{member.user?.email || member.invited_email}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs font-medium rounded-lg border-gray-200 bg-gray-50 px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                      value={member.role || ""}
                      disabled={!isManagingAllowed || isProcessing}
                      onChange={(e) => onUpdateMemberRole(member.id, e.target.value)}
                    >
                      <option value="owner">Chef de projet</option>
                      <option value="collaborator">Collaborateur</option>
                      <option value="client">Client</option>
                      {customRoles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    
                    {isManagingAllowed && (
                      <button
                        onClick={() => onRemoveMember(member.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        title="Retirer le membre"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {view === "roles" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <Card className="border-none shadow-sm h-fit">
            <CardHeader className="pb-2">
              <h3 className="font-semibold text-gray-900">Rôles existants</h3>
            </CardHeader>
            <CardContent className="space-y-2">
              {customRoles.length === 0 && (
                <p className="text-sm text-gray-500 italic">Aucun rôle personnalisé.</p>
              )}
              {customRoles.map(role => (
                <div 
                  key={role.id} 
                  className={`group flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all ${editingRole?.id === role.id ? 'border-primary-500 bg-primary-50' : 'border-gray-100 hover:border-primary-200'}`}
                  onClick={() => {
                    if (isBaseRole(role.id)) {
                      setError("Les rôles de base ne sont pas modifiables.");
                      return;
                    }
                    setEditingRole(role);
                    setNewRoleName(role.name);
                    setNewRoleColor(role.color);
                    setNewRolePerms({
                      admin: role.permissions.includes("admin"),
                      read: true,
                      interventions: role.permissions.includes("interventions"),
                      tasks: role.permissions.includes("tasks"),
                      planning: role.permissions.includes("planning"),
                      documents: role.permissions.includes("documents"),
                      budget: role.permissions.includes("budget"),
                      chat: role.permissions.includes("chat"),
                      members: role.permissions.includes("members"),
                      assistant: role.permissions.includes("assistant"),
                    });
                    setError(null);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: role.color }} />
                    <span className="text-sm font-medium">{role.name}</span>
                    {isBaseRole(role.id) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        Base
                      </span>
                    )}
                  </div>
                  {!isBaseRole(role.id) && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2 border-dashed border-2 border-gray-200 text-gray-500 w-full"
                onClick={() => {
                  setEditingRole(null);
                  setNewRoleName("");
                  setNewRoleColor("#3b82f6");
                  setNewRolePerms({
                    admin: false,
                    read: true,
                    interventions: false,
                    tasks: false,
                    planning: false,
                    documents: false,
                    budget: false,
                    chat: false,
                    members: false,
                    assistant: false,
                  });
                  setError(null);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouveau rôle
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <h3 className="font-semibold text-gray-900">
                {editingRole ? `Modifier le rôle: ${editingRole.name}` : "Créer un nouveau rôle"}
              </h3>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nom du rôle</label>
                  <Input 
                    value={newRoleName} 
                    onChange={e => setNewRoleName(e.target.value)} 
                    placeholder="Ex: Architecte, Client VIP..."
                  />
                </div>
                <div className="space-y-1.5 text-center">
                  <label className="text-sm font-medium block text-left">Couleur</label>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="color" 
                      value={newRoleColor} 
                      onChange={e => setNewRoleColor(e.target.value)}
                      className="h-10 w-16 p-1 rounded-lg cursor-pointer"
                    />
                    <Input 
                      value={newRoleColor} 
                      onChange={e => setNewRoleColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary-500" />
                  Permissions
                </label>
                
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { key: "read", label: "Lecture seule", desc: "Consulter le projet sans modification.", locked: true, icon: Eye },
                    { key: "chat", label: "Chat", desc: "Envoyer des messages dans le projet.", icon: MessageCircle },
                    { key: "documents", label: "Documents", desc: "Ajouter, lier ou supprimer des documents.", icon: FileText },
                    { key: "budget", label: "Budget", desc: "Gérer le budget et les éléments financiers.", icon: Wallet },
                    { key: "interventions", label: "Interventions", desc: "Créer et modifier les interventions.", icon: Wrench },
                    { key: "tasks", label: "Tâches", desc: "Créer et modifier les tâches.", icon: ListChecks },
                    { key: "planning", label: "Planning", desc: "Gérer le planning et les rendez-vous.", icon: CalendarDays },
                    { key: "members", label: "Membres", desc: "Inviter et gérer les rôles des membres.", icon: Users },
                    { key: "assistant", label: "Assistant IA", desc: "Utiliser les assistants IA du projet.", icon: Bot },
                    { key: "admin", label: "Administrateur", desc: "Configuration complète du projet.", icon: Shield },
                  ].map((perm) => {
                    const checked = Boolean((newRolePerms as any)[perm.key]);
                    const Icon = (perm as any).icon as any;
                    const locked = Boolean((perm as any).locked);
                    return (
                      <label key={perm.key} className={`relative ${locked ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}>
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={checked}
                          disabled={locked}
                          onChange={(e) => setNewRolePerms((p) => ({ ...p, [perm.key]: e.target.checked }))}
                        />
                        <div
                          className={[
                            "group flex items-start gap-3 rounded-2xl border p-4 transition-all",
                            "bg-white border-slate-200 hover:border-primary-200 hover:shadow-sm",
                            checked ? "border-primary-400 ring-2 ring-primary-100 bg-primary-50/40" : "",
                            locked ? "hover:shadow-none" : "",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "mt-0.5 h-10 w-10 shrink-0 rounded-xl flex items-center justify-center",
                              checked ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-700",
                            ].join(" ")}
                          >
                            <Icon className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-slate-900">{perm.label}</div>
                              {locked && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                  <Lock className="h-3 w-3" />
                                  Obligatoire
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-600 leading-snug">{perm.desc}</div>
                          </div>

                          <div className="pt-1">
                            {checked ? (
                              <CheckCircle2 className="h-5 w-5 text-primary-600" />
                            ) : (
                              <div className="h-5 w-5 rounded-full border border-slate-300 bg-white" />
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                {editingRole && (
                  <Button variant="ghost" onClick={() => setEditingRole(null)}>Annuler</Button>
                )}
                <Button onClick={handleSaveRole} disabled={isProcessing || !newRoleName.trim()}>
                  {isProcessing ? "Sauvegarde..." : (editingRole ? "Mettre à jour" : "Créer le rôle")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {view === "invite" && (
        <Card className="max-w-md mx-auto border-none shadow-lg">
          <CardHeader>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary-500" />
              Inviter un nouveau membre
            </h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email du destinataire</label>
                <Input 
                  type="email" 
                  autoFocus
                  placeholder="name@company.com" 
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Attribuer un rôle</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                >
                  <optgroup label="Rôles système">
                    <option value="collaborator">Collaborateur</option>
                    <option value="client">Client</option>
                  </optgroup>
                  {customRoles.length > 0 && (
                    <optgroup label="Rôles personnalisés">
                      {customRoles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-2 pt-4">
                <Button variant="ghost" className="w-full" onClick={() => setViewAndPersist("list")}>Annuler</Button>
                <Button type="submit" className="w-full" disabled={isProcessing || !inviteEmail}>
                  {isProcessing ? "Envoi..." : "Envoyer l'invitation"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
