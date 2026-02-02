"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";

type ProfilePreferences = {
  email_notifications: boolean;
  project_alerts: boolean;
  message_alerts: boolean;
};

const DEFAULT_PREFERENCES: ProfilePreferences = {
  email_notifications: true,
  project_alerts: true,
  message_alerts: true,
};

const normalizeText = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export default function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const isPro = profile?.user_type === "pro";
  const roleLabel = useMemo(
    () => (profile?.user_type === "pro" ? "professionnel" : "particulier"),
    [profile?.user_type]
  );

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    companyName: "",
    siret: "",
    address: "",
    city: "",
    postalCode: "",
    companyWebsite: "",
    companyDescription: "",
    publicPortfolioEnabled: false,
  });
  const [preferences, setPreferences] = useState<ProfilePreferences>(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      fullName: profile.full_name ?? "",
      email: profile.email ?? user?.email ?? "",
      phone: profile.phone ?? "",
      companyName: profile.company_name ?? "",
      siret: profile.siret ?? "",
      address: profile.address ?? "",
      city: profile.city ?? "",
      postalCode: profile.postal_code ?? "",
      companyWebsite: profile.company_website ?? "",
      companyDescription: profile.company_description ?? "",
      publicPortfolioEnabled: Boolean(profile.public_portfolio_enabled),
    });
    setPreferences({
      ...DEFAULT_PREFERENCES,
      ...(profile.preferences ?? {}),
    });
  }, [profile, user?.email]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      full_name: normalizeText(form.fullName),
      email: normalizeText(form.email),
      phone: normalizeText(form.phone),
      address: normalizeText(form.address),
      city: normalizeText(form.city),
      postal_code: normalizeText(form.postalCode),
      preferences,
    };

    if (isPro) {
      payload.company_name = normalizeText(form.companyName);
      payload.siret = normalizeText(form.siret);
      payload.company_website = normalizeText(form.companyWebsite);
      payload.company_description = normalizeText(form.companyDescription);
      payload.public_portfolio_enabled = form.publicPortfolioEnabled;
    }

    const { error: updateError } = await supabase.from("profiles").update(payload).eq("id", user.id);
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    await refreshProfile();
    setSaving(false);
    setSuccess("Profil mis à jour.");
  };

  if (loading && !profile) {
    return <div className="text-sm text-neutral-600">Chargement du profil...</div>;
  }

  if (!user) {
    return <div className="text-sm text-neutral-600">Connectez-vous pour acceder a votre profil.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Profil</h1>
        <p className="text-neutral-600">Informations et parametres de votre compte</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-neutral-900">Informations personnelles</h2>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Nom complet"
              value={form.fullName}
              onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
            />
            <Input
              label="Email de contact"
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
            <Input
              label="Téléphone"
              type="tel"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
            <Input label="Role" value={roleLabel} disabled />
            {!isPro && (
              <>
                <Input
                  label="Adresse"
                  value={form.address}
                  onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                />
                <Input
                  label="Ville"
                  value={form.city}
                  onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                />
                <Input
                  label="Code postal"
                  value={form.postalCode}
                  onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {isPro && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-neutral-900">Informations entreprise</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-600 mb-4">
              Les informations suivantes (entreprise, ville, adresse, site, téléphone, email) sont visibles sur votre
              profil professionnel public.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Entreprise"
                value={form.companyName}
                onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
              />
              <Input
                label="SIRET (prive)"
                value={form.siret}
                onChange={(event) => setForm((prev) => ({ ...prev, siret: event.target.value }))}
              />
              <Input
                label="Adresse"
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              />
              <Input
                label="Ville"
                value={form.city}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              />
              <Input
                label="Code postal"
                value={form.postalCode}
                onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
              />
              <Input
                label="Site web"
                type="url"
                value={form.companyWebsite}
                onChange={(event) => setForm((prev) => ({ ...prev, companyWebsite: event.target.value }))}
              />
            </div>
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium text-neutral-800">Presentation</label>
              <textarea
                value={form.companyDescription}
                onChange={(event) => setForm((prev) => ({ ...prev, companyDescription: event.target.value }))}
                className="w-full min-h-[120px] px-4 py-2 border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Résumé de votre activité et expertise."
              />
            </div>
            <label className="mt-4 flex items-center justify-between">
              <span className="text-neutral-800">Portfolio public actif</span>
              <input
                type="checkbox"
                checked={form.publicPortfolioEnabled}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, publicPortfolioEnabled: event.target.checked }))
                }
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-neutral-900">Preferences</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-neutral-800">Notifications email</span>
              <input
                type="checkbox"
                checked={preferences.email_notifications}
                onChange={(event) =>
                  setPreferences((prev) => ({ ...prev, email_notifications: event.target.checked }))
                }
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-neutral-800">Alertes projets</span>
              <input
                type="checkbox"
                checked={preferences.project_alerts}
                onChange={(event) =>
                  setPreferences((prev) => ({ ...prev, project_alerts: event.target.checked }))
                }
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-neutral-800">Nouveaux messages</span>
              <input
                type="checkbox"
                checked={preferences.message_alerts}
                onChange={(event) =>
                  setPreferences((prev) => ({ ...prev, message_alerts: event.target.checked }))
                }
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </div>
    </div>
  );
}
