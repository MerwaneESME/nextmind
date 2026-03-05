"use client";

import { useState } from "react";
import { AlertTriangle, Plus, Trash2, X } from "lucide-react";
import type {
  PlanningProposal,
  PlanningSuggestedTask,
} from "@/lib/ai-service";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface PlanningProposalWindowProps {
  proposal: PlanningProposal;
  onValidate: (proposal: PlanningProposal) => Promise<void>;
  onCancel: () => void;
}

export function PlanningProposalWindow({
  proposal,
  onValidate,
  onCancel,
}: PlanningProposalWindowProps) {
  const [editable, setEditable] = useState<PlanningProposal>(() => ({
    ...proposal,
    existing_interventions: proposal.existing_interventions.map((i) => ({
      ...i,
      suggested_tasks: [...i.suggested_tasks],
    })),
    suggested_interventions: proposal.suggested_interventions.map((i) => ({
      ...i,
      suggested_tasks: [...i.suggested_tasks],
    })),
  }));

  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Helpers: existing interventions ──────────────────────────────────────

  const updateExistingTask = (
    iIdx: number,
    tIdx: number,
    patch: Partial<PlanningSuggestedTask>
  ) => {
    setEditable((prev) => {
      const interventions = prev.existing_interventions.map((iv, i) => {
        if (i !== iIdx) return iv;
        return {
          ...iv,
          suggested_tasks: iv.suggested_tasks.map((t, j) =>
            j === tIdx ? { ...t, ...patch } : t
          ),
        };
      });
      return { ...prev, existing_interventions: interventions };
    });
  };

  const removeExistingTask = (iIdx: number, tIdx: number) => {
    setEditable((prev) => ({
      ...prev,
      existing_interventions: prev.existing_interventions.map((iv, i) =>
        i !== iIdx
          ? iv
          : { ...iv, suggested_tasks: iv.suggested_tasks.filter((_, j) => j !== tIdx) }
      ),
    }));
  };

  // ── Helpers: suggested interventions ─────────────────────────────────────

  const removeSuggestedIntervention = (iIdx: number) => {
    setEditable((prev) => ({
      ...prev,
      suggested_interventions: prev.suggested_interventions.filter(
        (_, i) => i !== iIdx
      ),
    }));
  };

  const updateSuggestedTask = (
    iIdx: number,
    tIdx: number,
    patch: Partial<PlanningSuggestedTask>
  ) => {
    setEditable((prev) => {
      const interventions = prev.suggested_interventions.map((iv, i) => {
        if (i !== iIdx) return iv;
        return {
          ...iv,
          suggested_tasks: iv.suggested_tasks.map((t, j) =>
            j === tIdx ? { ...t, ...patch } : t
          ),
        };
      });
      return { ...prev, suggested_interventions: interventions };
    });
  };

  const removeSuggestedTask = (iIdx: number, tIdx: number) => {
    setEditable((prev) => ({
      ...prev,
      suggested_interventions: prev.suggested_interventions.map((iv, i) =>
        i !== iIdx
          ? iv
          : { ...iv, suggested_tasks: iv.suggested_tasks.filter((_, j) => j !== tIdx) }
      ),
    }));
  };

  // ── Add helpers ───────────────────────────────────────────────────────────

  const emptyTask = (): PlanningSuggestedTask => ({ title: "", description: "", start_date: "", end_date: "" });

  const addExistingTask = (iIdx: number) => {
    setEditable((prev) => ({
      ...prev,
      existing_interventions: prev.existing_interventions.map((iv, i) =>
        i !== iIdx ? iv : { ...iv, suggested_tasks: [...iv.suggested_tasks, emptyTask()] }
      ),
    }));
  };

  const addSuggestedTask = (iIdx: number) => {
    setEditable((prev) => ({
      ...prev,
      suggested_interventions: prev.suggested_interventions.map((iv, i) =>
        i !== iIdx ? iv : { ...iv, suggested_tasks: [...iv.suggested_tasks, emptyTask()] }
      ),
    }));
  };

  const addSuggestedIntervention = () => {
    setEditable((prev) => ({
      ...prev,
      suggested_interventions: [
        ...prev.suggested_interventions,
        { name: "Nouvelle intervention", lot_type: "", reason: "", suggested_tasks: [emptyTask()] },
      ],
    }));
  };

  // ── Validate ──────────────────────────────────────────────────────────────

  const handleValidate = async () => {
    setIsValidating(true);
    setError(null);
    try {
      await onValidate(editable);
    } catch (err: any) {
      setError(err?.message ?? "Une erreur est survenue.");
      setIsValidating(false);
    }
  };

  const hasSuggestedContent =
    editable.existing_interventions.some((i) => i.suggested_tasks.length > 0) ||
    editable.suggested_interventions.length > 0;

  // ── Shared input classes ──────────────────────────────────────────────────

  const inputCls =
    "flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300";

  const dateCls =
    "text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] mx-4 rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Proposition de planning IA
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Modifiez les suggestions avant de les appliquer au projet
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isValidating}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Summary */}
          {editable.summary && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {editable.summary}
            </div>
          )}

          {/* Warnings */}
          {editable.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
              {editable.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                  <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* ── Existing interventions ─────────────────────────────────── */}
          {editable.existing_interventions.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">
                Tâches à ajouter aux interventions existantes
              </h3>
              {editable.existing_interventions.map((intervention, iIdx) => (
                <div
                  key={intervention.intervention_id}
                  className="rounded-xl border border-neutral-100 bg-white p-4 space-y-3 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-indigo-400" />
                    <span className="font-medium text-gray-900 text-sm">
                      {intervention.intervention_name}
                    </span>
                  </div>

                  {/* Existing tasks — read-only context */}
                  {intervention.existing_tasks.length > 0 && (
                    <div className="space-y-1 pl-4">
                      <div className="text-xs text-gray-400 font-medium mb-1">
                        Tâches actuelles
                      </div>
                      {intervention.existing_tasks.map((task) => (
                        <div
                          key={task.task_id}
                          className="flex items-center gap-2 text-xs text-gray-500"
                        >
                          <span
                            className={cn(
                              "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
                              task.status === "done"
                                ? "bg-emerald-500"
                                : task.status === "in_progress"
                                ? "bg-blue-500"
                                : "bg-gray-300"
                            )}
                          />
                          {task.title}
                          {task.note && (
                            <span className="text-amber-500">({task.note})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggested tasks — editable */}
                  <div className="space-y-2 border-t border-dashed border-neutral-100 pt-3">
                    {intervention.suggested_tasks.length > 0 && (
                      <div className="text-xs font-medium text-indigo-700">
                        Tâches suggérées à ajouter
                      </div>
                    )}
                    {intervention.suggested_tasks.map((task, tIdx) => (
                      <div
                        key={tIdx}
                        className="flex flex-col gap-1.5 pl-3 border-l-2 border-indigo-200 py-1"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            className={inputCls}
                            value={task.title}
                            onChange={(e) =>
                              updateExistingTask(iIdx, tIdx, { title: e.target.value })
                            }
                            placeholder="Titre de la tâche"
                          />
                          <button
                            onClick={() => removeExistingTask(iIdx, tIdx)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                            title="Supprimer cette tâche"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            className={dateCls}
                            value={task.start_date ?? ""}
                            onChange={(e) =>
                              updateExistingTask(iIdx, tIdx, { start_date: e.target.value })
                            }
                          />
                          <input
                            type="date"
                            className={dateCls}
                            value={task.end_date ?? ""}
                            onChange={(e) =>
                              updateExistingTask(iIdx, tIdx, { end_date: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => addExistingTask(iIdx)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors mt-1"
                    >
                      <Plus size={13} /> Ajouter une tâche
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* ── New suggested interventions ────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-emerald-800">
                Nouvelles interventions à créer
              </h3>
              <button
                onClick={addSuggestedIntervention}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 transition-colors"
              >
                <Plus size={13} /> Ajouter une intervention
              </button>
            </div>
            {editable.suggested_interventions.length === 0 && (
              <div className="text-xs text-gray-400 italic">Aucune nouvelle intervention suggérée.</div>
            )}
              {editable.suggested_interventions.map((intervention, iIdx) => (
                <div
                  key={iIdx}
                  className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-medium text-gray-900 text-sm">
                        {intervention.name}
                      </span>
                      {intervention.lot_type && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          {intervention.lot_type}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeSuggestedIntervention(iIdx)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      title="Supprimer cette intervention"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {intervention.reason && (
                    <p className="text-xs text-gray-500 italic pl-4">
                      {intervention.reason}
                    </p>
                  )}

                  <div className="space-y-2 border-t border-dashed border-emerald-200 pt-3">
                    {intervention.suggested_tasks.length > 0 && (
                      <div className="text-xs font-medium text-emerald-700">Tâches</div>
                    )}
                    {intervention.suggested_tasks.map((task, tIdx) => (
                      <div
                        key={tIdx}
                        className="flex flex-col gap-1.5 pl-3 border-l-2 border-emerald-300 py-1"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            className={inputCls}
                            value={task.title}
                            onChange={(e) =>
                              updateSuggestedTask(iIdx, tIdx, { title: e.target.value })
                            }
                            placeholder="Titre de la tâche"
                          />
                          <button
                            onClick={() => removeSuggestedTask(iIdx, tIdx)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                            title="Supprimer cette tâche"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            className={dateCls}
                            value={task.start_date ?? ""}
                            onChange={(e) =>
                              updateSuggestedTask(iIdx, tIdx, { start_date: e.target.value })
                            }
                          />
                          <input
                            type="date"
                            className={dateCls}
                            value={task.end_date ?? ""}
                            onChange={(e) =>
                              updateSuggestedTask(iIdx, tIdx, { end_date: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => addSuggestedTask(iIdx)}
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 transition-colors mt-1"
                    >
                      <Plus size={13} /> Ajouter une tâche
                    </button>
                  </div>
                </div>
              ))}
            </section>

          {/* Priorities — read-only */}
          {editable.next_week_priorities.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">
                Priorités de la semaine
              </h3>
              <div className="space-y-1">
                {editable.next_week_priorities.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="font-medium text-gray-400 min-w-[16px]">{i + 1}.</span>
                    {p}
                  </div>
                ))}
              </div>
            </section>
          )}

          {!hasSuggestedContent && (
            <div className="text-sm text-gray-400 italic text-center py-6">
              Aucune tâche ou intervention à appliquer.
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            {hasSuggestedContent
              ? "La validation créera les interventions et tâches dans le projet."
              : "Aucun contenu à appliquer."}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={isValidating}>
              Annuler
            </Button>
            <Button
              onClick={handleValidate}
              disabled={isValidating || !hasSuggestedContent}
              className="bg-gradient-to-r from-primary-400 to-primary-600 text-white"
            >
              {isValidating ? "Application…" : "Valider et Appliquer au Projet"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
