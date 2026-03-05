"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import {
  Camera,
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  Globe,
  FileText,
  Bell,
  BriefcaseBusiness,
  Loader2,
  Save,
  Shield,
} from "lucide-react";

type ProfilePreferences = {
  email_notifications: boolean;
  project_alerts: boolean;
  message_alerts: boolean;
};

const AVATARS_STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET ?? "avatar";

const DEFAULT_PREFERENCES: ProfilePreferences = {
  email_notifications: true,
  project_alerts: true,
  message_alerts: true,
};

const normalizeText = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <label htmlFor={id} className="relative inline-flex items-center cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-neutral-200 rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-primary-400 peer-checked:to-primary-600 transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-all peer-checked:after:translate-x-5" />
    </label>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-100">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary-600" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const isPro = profile?.user_type === "pro";
  const roleLabel = useMemo(
    () => (profile?.user_type === "pro" ? "Professionnel" : "Particulier"),
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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

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
    setPreferences({ ...DEFAULT_PREFERENCES, ...(profile.preferences ?? {}) });
  }, [profile, user?.email]);

  const handlePickAvatar = () => {
    avatarInputRef.current?.click();
  };

  const uploadAvatar = async (file: File) => {
    if (!user?.id) return;

    if (!file.type?.startsWith("image/")) {
      setError("Veuillez choisir une image (PNG/JPG/WebP...).");
      return;
    }
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError("Image trop volumineuse (max 5 Mo).");
      return;
    }

    setAvatarUploading(true);
    setError(null);
    setSuccess(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Session invalide. Veuillez vous reconnecter.");
      setAvatarUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/profile/avatar", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const json = (await response.json().catch(() => null)) as { avatarUrl?: string; error?: string } | null;
    if (!response.ok) {
      const message = json?.error ?? `Erreur upload (HTTP ${response.status})`;
      if (/bucket not found/i.test(message)) {
        setError(
          `Bucket Supabase Storage introuvable: "${AVATARS_STORAGE_BUCKET}". Créez ce bucket dans Supabase Storage, ou définissez NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET.`
        );
      } else if (/SUPABASE_SERVICE_ROLE_KEY/i.test(message)) {
        setError(
          `Upload serveur non configuré: ajoutez SUPABASE_SERVICE_ROLE_KEY dans l'environnement (Next.js) ou configurez des policies RLS sur le bucket "${AVATARS_STORAGE_BUCKET}".`
        );
      } else {
        setError(message);
      }
      setAvatarUploading(false);
      return;
    }

    await refreshProfile();
    setAvatarUploading(false);
    setSuccess("Photo de profil mise à jour.");
  };

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
    setSuccess("Profil mis à jour avec succès.");
  };

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-500">
        Chargement du profil...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-neutral-500">
        Connectez-vous pour accéder à votre profil.
      </div>
    );
  }

  const initials = form.fullName
    ? form.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user.email?.[0] ?? "U").toUpperCase();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page header with avatar */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={handlePickAvatar}
              disabled={avatarUploading}
              className="group relative w-16 h-16 rounded-2xl overflow-hidden shadow-md flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Changer la photo de profil"
              title="Changer la photo de profil"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Photo de profil"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-xl">{initials}</span>
              )}
              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
              <span className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 text-neutral-800 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                {avatarUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadAvatar(file);
              }}
            />
          </div>


        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{form.fullName || "Mon profil"}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
              {roleLabel}
            </span>
            {form.email && (
              <span className="text-sm text-neutral-500">{form.email}</span>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* Informations personnelles */}
      <Card>
        <CardContent className="p-6">
          <SectionHeader
            icon={User}
            title="Informations personnelles"
            subtitle="Vos coordonnées de base"
          />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                <User className="w-3 h-3" /> Nom complet
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> Email de contact
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> Téléphone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                <Shield className="w-3 h-3" /> Rôle
              </label>
              <input
                type="text"
                value={roleLabel}
                disabled
                className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-neutral-50 text-neutral-500 cursor-not-allowed"
              />
            </div>
            {!isPro && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> Adresse
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> Ville
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Code postal
                  </label>
                  <input
                    type="text"
                    value={form.postalCode}
                    onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Informations entreprise (pro only) */}
      {isPro && (
        <Card>
          <CardContent className="p-6">
            <SectionHeader
              icon={Building2}
              title="Informations entreprise"
              subtitle="Visibles sur votre profil professionnel public"
            />
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                  <BriefcaseBusiness className="w-3 h-3" /> Entreprise
                </label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> SIRET (privé)
                </label>
                <input
                  type="text"
                  value={form.siret}
                  onChange={(e) => setForm((p) => ({ ...p, siret: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Adresse
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Ville
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  Code postal
                </label>
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> Site web
                </label>
                <input
                  type="url"
                  value={form.companyWebsite}
                  onChange={(e) => setForm((p) => ({ ...p, companyWebsite: e.target.value }))}
                  placeholder="https://"
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Description */}
            <div className="mt-4 space-y-1.5">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                Présentation
              </label>
              <textarea
                value={form.companyDescription}
                onChange={(e) => setForm((p) => ({ ...p, companyDescription: e.target.value }))}
                rows={4}
                placeholder="Résumé de votre activité et expertise..."
                className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all resize-none"
              />
            </div>

            {/* Portfolio toggle */}
            <div className="mt-4 flex items-center justify-between p-4 rounded-xl bg-neutral-50 border border-neutral-100">
              <div>
                <p className="text-sm font-medium text-neutral-800">Portfolio public actif</p>
                <p className="text-xs text-neutral-500 mt-0.5">Rendre votre portfolio visible publiquement</p>
              </div>
              <Toggle
                id="portfolio"
                checked={form.publicPortfolioEnabled}
                onChange={(v) => setForm((p) => ({ ...p, publicPortfolioEnabled: v }))}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Préférences & notifications */}
      <Card>
        <CardContent className="p-6">
          <SectionHeader
            icon={Bell}
            title="Préférences & notifications"
            subtitle="Gérez vos alertes et communications"
          />
          <div className="space-y-3">
            {[
              {
                id: "email_notif",
                label: "Notifications email",
                subtitle: "Recevez les mises à jour par email",
                key: "email_notifications" as const,
              },
              {
                id: "project_alerts",
                label: "Alertes projets",
                subtitle: "Soyez notifié des changements sur vos projets",
                key: "project_alerts" as const,
              },
              {
                id: "message_alerts",
                label: "Nouveaux messages",
                subtitle: "Notification lors de nouveaux messages",
                key: "message_alerts" as const,
              },
            ].map((pref) => (
              <div
                key={pref.id}
                className="flex items-center justify-between p-4 rounded-xl bg-neutral-50 border border-neutral-100"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-800">{pref.label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{pref.subtitle}</p>
                </div>
                <Toggle
                  id={pref.id}
                  checked={preferences[pref.key]}
                  onChange={(v) => setPreferences((p) => ({ ...p, [pref.key]: v }))}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex items-center justify-end pb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-400 to-primary-600 text-white font-semibold text-sm shadow-sm hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
        >
          <Save className="w-4 h-4" />
          {saving ? "Sauvegarde..." : "Sauvegarder les modifications"}
        </button>
      </div>
    </div>
  );
}
