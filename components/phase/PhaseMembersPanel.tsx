"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { listPhaseMembersWithProfiles, type PhaseMemberWithProfile } from "@/lib/phaseMembersDb";

const formatPhaseRole = (role: string | null | undefined) => {
  if (!role) return { label: "Membre", color: "bg-gray-100 text-gray-700" };
  const r = role.toLowerCase();
  if (r === "phase_manager" || r === "responsable_phase")
    return { label: "Responsable", color: "bg-indigo-100 text-indigo-700" };
  if (r === "entreprise")
    return { label: "Entreprise", color: "bg-blue-100 text-blue-700" };
  if (r === "sous_traitant")
    return { label: "Sous-traitant", color: "bg-cyan-100 text-cyan-700" };
  if (r === "observateur")
    return { label: "Observateur", color: "bg-gray-100 text-gray-600" };
  return { label: role, color: "bg-gray-100 text-gray-700" };
};

export default function PhaseMembersPanel({ phaseId }: { phaseId: string }) {
  const [members, setMembers] = useState<PhaseMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!phaseId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listPhaseMembersWithProfiles(phaseId);
      setMembers(rows);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les membres.");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseId]);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-gray-900">Membres de la phase</div>
          <div className="text-sm text-gray-500">{members.length} membre{members.length !== 1 ? "s" : ""}</div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Actualiser
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            Chargement...
          </div>
        ) : members.length === 0 ? (
          <div className="text-sm text-gray-500">Aucun membre assigné.</div>
        ) : (
          members.map((m) => {
            const roleInfo = formatPhaseRole(m.role);
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                  {(m.user?.full_name || m.user?.email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {m.user?.full_name || m.user?.company_name || m.user?.email || "Utilisateur"}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleInfo.color}`}>
                      {roleInfo.label}
                    </span>
                    {m.can_edit && (
                      <span className="text-xs text-green-600">Peut modifier</span>
                    )}
                    {!m.can_edit && (
                      <span className="text-xs text-gray-400">Lecture seule</span>
                    )}
                  </div>
                </div>
                {Array.isArray(m.assigned_lots) && m.assigned_lots.length > 0 && (
                  <div className="text-xs text-gray-500 shrink-0">
                    {m.assigned_lots.length} interv.
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
