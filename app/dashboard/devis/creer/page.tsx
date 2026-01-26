"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Plus, Trash2, ArrowLeft, Download, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { QuotePreviewLine, QuotePreviewData } from "@/lib/quotesStore";
import { calculateTotals } from "@/lib/quotePreview";
import { saveDevisFromPreview } from "@/lib/devisDb";
import { formatCurrency } from "@/lib/utils";

const QUOTE_PREVIEW_KEY = "quote_preview";

const defaultLine = (): QuotePreviewLine => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
  description: "",
  quantity: 1,
  unit: "unite",
  unitPrice: 0,
});

export default function CreateDevisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const roleParam = searchParams.get("role");
  const role = roleParam === "professionnel" ? "professionnel" : "particulier";

  const [projectType, setProjectType] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [lines, setLines] = useState<QuotePreviewLine[]>([defaultLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyName && profile?.company_name) {
      setCompanyName(profile.company_name);
    }
  }, [profile, companyName]);

  const isFormReady = useMemo(() => {
    if (!projectType.trim() || !clientName.trim() || !companyName.trim()) return false;
    if (!lines.length) return false;
    return lines.every(
      (line) =>
        line.description.trim() &&
        Number(line.quantity) > 0 &&
        line.unit &&
        Number(line.unitPrice) > 0
    );
  }, [projectType, clientName, companyName, lines]);

  const totals = useMemo(() => {
    const payload: QuotePreviewData = {
      projectType,
      clientName,
      clientEmail,
      companyName,
      lines,
      createdAt: new Date().toISOString(),
    };
    return calculateTotals(payload);
  }, [projectType, clientName, clientEmail, companyName, lines]);

  const addLine = () => {
    setLines((prev) => [...prev, defaultLine()]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== id) : prev));
  };

  const updateLine = (id: string, field: keyof QuotePreviewLine, value: string | number) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const handleGenerate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormReady) return;
    const payload: QuotePreviewData = {
      projectType: projectType.trim(),
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      companyName: companyName.trim(),
      lines: lines.map((line) => ({
        ...line,
        quantity: Number.isFinite(Number(line.quantity)) ? Number(line.quantity) : 0,
        unitPrice: Number.isFinite(Number(line.unitPrice)) ? Number(line.unitPrice) : 0,
      })),
      createdAt: new Date().toISOString(),
    };
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(QUOTE_PREVIEW_KEY, JSON.stringify(payload));
    }
    router.push(`/dashboard/devis/apercu?role=${role}`);
  };

  const handleSaveDraft = async () => {
    if (!user?.id) {
      router.push("/login");
      return;
    }
    if (!isFormReady) return;
    setSaving(true);
    setError("");
    const payload: QuotePreviewData = {
      projectType: projectType.trim(),
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      companyName: companyName.trim(),
      lines: lines.map((line) => ({
        ...line,
        quantity: Number.isFinite(Number(line.quantity)) ? Number(line.quantity) : 0,
        unitPrice: Number.isFinite(Number(line.unitPrice)) ? Number(line.unitPrice) : 0,
      })),
      createdAt: new Date().toISOString(),
    };
    try {
      await saveDevisFromPreview(user.id, payload, "en_etude");
      router.push(`/dashboard/devis?role=${role}`);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de sauvegarder le devis.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Creer un devis</h1>
          <p className="text-gray-600">Remplissez les informations pour generer votre devis</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/dashboard/devis?role=${role}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux devis
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form className="grid gap-6 lg:grid-cols-3" onSubmit={handleGenerate}>
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Informations du chantier</h2>
              <p className="text-sm text-gray-600">Type de travaux et details du projet</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-800">
                  Type de chantier *
                </label>
                <select
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  required
                >
                  <option value="">Selectionnez un type</option>
                  <option value="renovation">Renovation</option>
                  <option value="electricite">Electricite</option>
                  <option value="plomberie">Plomberie</option>
                  <option value="maconnerie">Maconnerie</option>
                  <option value="peinture">Peinture</option>
                  <option value="menuiserie">Menuiserie</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Informations client</h2>
              <p className="text-sm text-gray-600">Coordonnées du client</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Nom du client *"
                  placeholder="Jean Dupont"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="jean.dupont@email.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Votre entreprise</h2>
              <p className="text-sm text-gray-600">Informations de votre societe</p>
            </CardHeader>
            <CardContent>
              <Input
                label="Nom de l'entreprise *"
                placeholder="Votre entreprise BTP"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Detail des prestations</h2>
              <p className="text-sm text-gray-600">Ajoutez les lignes de votre devis</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {lines.map((line, index) => (
                <div key={line.id} className="space-y-3 p-4 border border-gray-200 rounded-lg bg-white">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Ligne {index + 1}</span>
                    {lines.length > 1 && (
                      <Button variant="ghost" size="sm" type="button" onClick={() => removeLine(line.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-800">Description</label>
                    <textarea
                      className="w-full min-h-[90px] px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Description de la prestation"
                      value={line.description}
                      onChange={(e) => updateLine(line.id, "description", e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-neutral-800">Quantite</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, "quantity", parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-neutral-800">Unite</label>
                      <select
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={line.unit}
                        onChange={(e) => updateLine(line.id, "unit", e.target.value)}
                        required
                      >
                        <option value="unite">Unite</option>
                        <option value="m2">m2</option>
                        <option value="m">m</option>
                        <option value="heure">Heure</option>
                        <option value="jour">Jour</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-neutral-800">Prix unitaire HT</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.id, "unitPrice", parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-neutral-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total ligne HT</span>
                      <span className="font-medium">
                        {formatCurrency(line.quantity * line.unitPrice)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full" type="button" onClick={addLine}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter une ligne
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-20">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Recapitulatif</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total HT</span>
                  <span className="font-medium">{formatCurrency(totals.ht)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">TVA (20%)</span>
                  <span className="font-medium">{formatCurrency(totals.tva)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold">Total TTC</span>
                  <span className="text-xl font-bold text-primary-700">
                    {formatCurrency(totals.ttc)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <Button type="submit" className="w-full" disabled={!isFormReady}>
                  <Download className="mr-2 h-4 w-4" />
                  Generer le devis PDF
                </Button>
                <Button variant="outline" className="w-full" type="button" onClick={handleSaveDraft} disabled={!isFormReady || saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Sauvegarde..." : "Enregistrer le brouillon"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
