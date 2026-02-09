"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { listPhaseMembersWithProfiles, type PhaseMemberWithProfile } from "@/lib/phaseMembersDb";

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
      setError(err?.message ?? "Impossible de charger les membres de la phase.");
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
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-gray-900">Membres de la phase</div>
          <div className="text-sm text-gray-600">Uniquement les personnes assignées à cette phase.</div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Actualiser
        </Button>
      </header>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      <Card>
        <CardHeader>
          <div className="font-semibold text-gray-900">Liste</div>
          <div className="text-sm text-gray-500">{members.length} membre{members.length > 1 ? "s" : ""}</div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="text-sm text-gray-500">Chargement...</div>
          ) : members.length === 0 ? (
            <div className="text-sm text-gray-500">Aucun membre assigné à cette phase.</div>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {m.user?.full_name || m.user?.company_name || m.user?.email || m.user_id}
                  </div>
                  <div className="text-xs text-gray-500">
                    Rôle: {m.role} • {m.can_edit ? "Éditeur" : "Lecture seule"}
                  </div>
                </div>
                {Array.isArray(m.assigned_lots) && m.assigned_lots.length > 0 ? (
                  <div className="text-xs text-gray-500">Lots assignés: {m.assigned_lots.length}</div>
                ) : (
                  <div className="text-xs text-gray-400">Tous les lots</div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

