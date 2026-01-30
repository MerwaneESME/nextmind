"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { UserRole } from "@/types";
import { supabase } from "@/lib/supabaseClient";
import { mapRoleToUserType, mapUserTypeToRole, savePendingProfile } from "@/hooks/useAuth";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("particulier");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError("");
    setNotice("");

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Le nom est requis";
    if (!formData.email.trim()) newErrors.email = "L'email est requis";
    if (formData.password.length < 8) {
      newErrors.password = "Le mot de passe doit contenir au moins 8 caractères";
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Les mots de passe ne correspondent pas";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    const userType = mapRoleToUserType(role);
    const profilePayload = {
      full_name: formData.name.trim(),
      email: formData.email.trim(),
      user_type: userType,
    };

    savePendingProfile(profilePayload);

    const { data, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
    });

    if (authError || !data.user) {
      setFormError(authError?.message ?? "Inscription impossible.");
      setIsLoading(false);
      return;
    }

    if (data.session?.user?.id) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profilePayload)
        .eq("id", data.session.user.id);
      if (profileError) {
        setFormError(profileError.message);
        setIsLoading(false);
        return;
      }
      const nextRole = mapUserTypeToRole(userType);
      router.push(`/dashboard?role=${nextRole}`);
      setIsLoading(false);
      return;
    }

    setNotice("Compte cree. Verifiez vos emails puis connectez-vous.");
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center mb-4">
            <img
              src="/images/nextmind.png"
              alt="NextMind"
              className="h-8 w-auto"
            />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Créer un compte
          </h1>
          <p className="text-gray-600">
            Rejoignez NEXTMIND et commencez dès aujourd'hui
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Sélection du type de compte */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Je suis un :
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("particulier")}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  role === "particulier"
                    ? "border-primary-600 bg-primary-50 text-primary-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium mb-1">Particulier</div>
                <div className="text-xs text-gray-600">
                  Pour mes projets personnels
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRole("professionnel")}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  role === "professionnel"
                    ? "border-primary-600 bg-primary-50 text-primary-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium mb-1">Professionnel</div>
                <div className="text-xs text-gray-600">
                  Pour mon entreprise BTP
                </div>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {formError}
              </div>
            )}
            {notice && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {notice}
              </div>
            )}
            <Input
              label="Nom complet"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={errors.name}
              required
            />

            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={errors.email}
              required
            />

            <Input
              label="Mot de passe"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={errors.password}
              required
            />

            <Input
              label="Confirmer le mot de passe"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              error={errors.confirmPassword}
              required
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Création du compte..." : "Créer mon compte"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
