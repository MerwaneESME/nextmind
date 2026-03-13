import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatMemberRole, formatMemberStatus } from "@/lib/memberHelpers";

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
  canInviteMembers: boolean;
  onInvite: (email: string, role: string) => Promise<void>;
}

export function MembersTab({ members, canInviteMembers, onInvite }: MembersTabProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("client");
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canInviteMembers) {
      setError("Seuls les professionnels peuvent inviter des membres.");
      return;
    }
    const emailToInvite = inviteEmail.trim();
    if (!emailToInvite) return;

    setError(null);
    setIsInviting(true);
    try {
      await onInvite(emailToInvite, inviteRole);
      setInviteEmail(""); // Clear the input on success
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'envoyer l'invitation.");
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[2fr_1fr] items-start">
      <Card>
        <CardHeader>
          <div className="font-semibold text-gray-900">Membres du projet</div>
          <div className="text-sm text-gray-500">Gestion des accès et permissions.</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((member) => {
            const roleInfo = formatMemberRole(member.role);
            const statusInfo = formatMemberStatus(member.status);
            return (
              <div key={member.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
                {member.user?.avatar_url ? (
                  <img
                    src={member.user.avatar_url}
                    alt={`Avatar de ${member.user?.full_name || member.user?.email || "membre"}`}
                    className="h-10 w-10 rounded-full object-cover shrink-0 border border-white/40 shadow-sm"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                    {(member.user?.full_name || member.user?.email || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">
                    {member.user?.full_name || member.user?.email || member.invited_email || "Invité"}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleInfo.color}`}>
                      {roleInfo.label}
                    </span>
                    <span className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-semibold text-gray-900">Inviter un membre</div>
          <div className="text-sm text-gray-500">Ajoutez un collaborateur ou un client au projet.</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Role</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={inviteRole}
              disabled={!canInviteMembers || isInviting}
              onChange={(event) => setInviteRole(event.target.value)}
            >
              <option value="collaborator">Collaborateur (peut modifier)</option>
              <option value="client">Client (lecture seule)</option>
            </select>
            <p className="text-xs text-gray-400">
              {inviteRole === "client"
                ? "Le client pourra consulter le projet sans le modifier."
                : "Le collaborateur pourra modifier le projet et les interventions."}
            </p>
          </div>

          <form className="space-y-2" onSubmit={handleInvite}>
            <label className="text-sm font-medium">Inviter par email</label>
            <Input
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="email@exemple.com"
              type="email"
              disabled={!canInviteMembers || isInviting}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button type="submit" disabled={!canInviteMembers || !inviteEmail.trim() || isInviting}>
              {isInviting ? "Envoi..." : "Envoyer l'invitation"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
