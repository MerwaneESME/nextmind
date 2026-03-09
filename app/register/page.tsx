"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { UserRole } from "@/types";
import { supabase } from "@/lib/supabaseClient";
import { mapRoleToUserType, savePendingProfile } from "@/hooks/useAuth";
import { DEPARTEMENTS } from "@/lib/departements";
import { cn } from "@/lib/utils";

const contentVariants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -30, transition: { duration: 0.2 } },
};

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("particulier");
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    address: "",
    city: "",
    postalCode: "",
    department: "",
    companyName: "",
    siret: "",
    companyWebsite: "",
    companyDescription: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const stepsParticulier = [
    { id: "infos", title: "Infos" },
    { id: "adresse", title: "Adresse" },
    { id: "motdepasse", title: "Mot de passe" },
  ];

  const stepsProfessionnel = [
    { id: "infos", title: "Infos" },
    { id: "adresse", title: "Adresse" },
    { id: "entreprise", title: "Entreprise" },
    { id: "motdepasse", title: "Mot de passe" },
  ];

  const steps = role === "professionnel" ? stepsProfessionnel : stepsParticulier;

  useEffect(() => {
    if (currentStep >= steps.length) {
      setCurrentStep(steps.length - 1);
    }
  }, [role, steps.length, currentStep]);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 0) {
      if (!formData.name.trim()) newErrors.name = "Le nom est requis";
      if (!formData.email.trim()) newErrors.email = "L'email est requis";
      if (!formData.phone.trim()) newErrors.phone = "Le téléphone est requis";
    } else if (step === 1) {
      if (!formData.address.trim()) newErrors.address = "L'adresse est requise";
      if (!formData.city.trim()) newErrors.city = "La ville est requise";
      if (!formData.postalCode.trim()) newErrors.postalCode = "Le code postal est requis";
      if (!formData.department) newErrors.department = "Le département est requis";
    } else if (step === 2 && role === "professionnel") {
      if (!formData.companyName.trim()) newErrors.companyName = "Le nom de l'entreprise est requis";
      if (!formData.siret.trim()) newErrors.siret = "Le SIRET est requis";
      if (formData.siret.trim().length !== 14) {
        newErrors.siret = "Le SIRET doit contenir 14 chiffres";
      }
    } else if (step === steps.length - 1) {
      if (formData.password.length < 8) {
        newErrors.password = "Le mot de passe doit contenir au moins 8 caractères";
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Les mots de passe ne correspondent pas";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isStepValid = (step: number): boolean => {
    if (step === 0) {
      return !!formData.name.trim() && !!formData.email.trim() && !!formData.phone.trim();
    }
    if (step === 1) {
      return (
        !!formData.address.trim() &&
        !!formData.city.trim() &&
        !!formData.postalCode.trim() &&
        !!formData.department
      );
    }
    if (step === 2 && role === "professionnel") {
      return (
        !!formData.companyName.trim() &&
        formData.siret.trim().length === 14
      );
    }
    if (step === steps.length - 1) {
      return (
        formData.password.length >= 8 &&
        formData.password === formData.confirmPassword
      );
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep) && currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setErrors({});
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(currentStep)) return;

    setIsLoading(true);
    setFormError("");
    setNotice("");

    const userType = mapRoleToUserType(role);
    const profilePayload = {
      full_name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      city: formData.city.trim(),
      postal_code: formData.postalCode.trim(),
      user_type: userType,
      ...(role === "professionnel" && {
        company_name: formData.companyName.trim(),
        siret: formData.siret.trim(),
        company_website: formData.companyWebsite.trim() || null,
        company_description: formData.companyDescription.trim() || null,
      }),
    };

    savePendingProfile(profilePayload);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.email,
        password: formData.password,
        profile: profilePayload,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setFormError(data.error ?? "Inscription impossible.");
      setIsLoading(false);
      return;
    }

    // Ne pas effacer le profil en attente ici : applyPendingProfile (useAuth) le fera
    // après connexion, ce qui garantit que toutes les données du formulaire sont bien
    // enregistrées dans le profil (même si l'API a eu un souci partiel).

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    if (signInError) {
      setFormError("Compte créé. Connectez-vous via la page de connexion.");
      router.push("/login?inscription=ok");
      setIsLoading(false);
      return;
    }

    router.push(`/dashboard?role=${role}`);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center mb-4">
            <img src="/images/nextmind.png" alt="NextMind" className="h-8 w-auto logo-blend" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Créer un compte</h1>
          <p className="text-gray-600">Rejoignez Nextmind et commencez dès aujourd&apos;hui</p>
          <img
            src="/images/subscribe.png"
            alt="Inscription Nextmind"
            className="mt-6 mx-auto h-32 w-auto object-contain logo-blend"
          />
        </div>

        <Card className="border border-gray-200 shadow-md rounded-2xl overflow-hidden">
          <form onSubmit={handleSubmit}>
            {formError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {formError}
              </div>
            )}
            {notice && (
              <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {notice}
              </div>
            )}

            <AnimatePresence mode="wait">
              {/* Étape 0 : Type de compte + Infos personnelles */}
              {currentStep === 0 && (
                <motion.div
                  key="step0"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={contentVariants}
                >
                  <CardHeader className="pb-2">
                    <h2 className="text-lg font-semibold text-neutral-900">
                      Informations personnelles
                    </h2>
                    <p className="text-sm text-neutral-500">
                      Commençons par vos coordonnées
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Je suis un : <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setRole("particulier")}
                          className={cn(
                            "p-4 rounded-lg border-2 transition-colors text-left",
                            role === "particulier"
                              ? "border-primary-600 bg-primary-50 text-primary-700"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <div className="font-medium mb-1">Particulier</div>
                          <div className="text-xs text-neutral-600">Pour mes projets personnels</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole("professionnel")}
                          className={cn(
                            "p-4 rounded-lg border-2 transition-colors text-left",
                            role === "professionnel"
                              ? "border-primary-600 bg-primary-50 text-primary-700"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <div className="font-medium mb-1">Professionnel</div>
                          <div className="text-xs text-neutral-600">Pour mon entreprise BTP</div>
                        </button>
                      </div>
                    </div>
                    <Input
                      label="Nom complet"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      error={errors.name}
                      required
                      showRequired
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      error={errors.email}
                      required
                      showRequired
                    />
                    <Input
                      label="Téléphone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      error={errors.phone}
                      required
                      showRequired
                    />
                  </CardContent>
                </motion.div>
              )}

              {/* Étape 1 : Adresse */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={contentVariants}
                >
                  <CardHeader className="pb-2">
                    <h2 className="text-lg font-semibold text-neutral-900">Votre adresse</h2>
                    <p className="text-sm text-neutral-500">
                      Où souhaitez-vous être contacté ?
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <AddressAutocomplete
                      label="Adresse"
                      value={formData.address}
                      onChange={(v) => setFormData((p) => ({ ...p, address: v }))}
                      onSelect={(s) =>
                        setFormData((p) => ({
                          ...p,
                          address: s.address,
                          city: s.city,
                          postalCode: s.postalCode,
                          department: s.department,
                        }))
                      }
                      error={errors.address}
                      required
                      showRequired
                      placeholder="Commencez à taper votre adresse..."
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Ville"
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        error={errors.city}
                        required
                        showRequired
                        placeholder="Paris"
                      />
                      <Input
                        label="Code postal"
                        type="text"
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        error={errors.postalCode}
                        required
                        showRequired
                        maxLength={5}
                        placeholder="75001"
                      />
                    </div>
                    <div>
                      <label htmlFor="department" className="block text-sm font-medium text-neutral-800 mb-1.5">
                        Département <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="department"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className={cn(
                          "w-full px-4 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500",
                          errors.department ? "border-red-500" : "border-neutral-300"
                        )}
                        required
                      >
                        <option value="">Sélectionnez un département</option>
                        {DEPARTEMENTS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      {errors.department && (
                        <p className="mt-1 text-sm text-red-600">{errors.department}</p>
                      )}
                    </div>
                  </CardContent>
                </motion.div>
              )}

              {/* Étape 2 (pro uniquement) : Entreprise */}
              {currentStep === 2 && role === "professionnel" && (
                <motion.div
                  key="step2"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={contentVariants}
                >
                  <CardHeader className="pb-2">
                    <h2 className="text-lg font-semibold text-neutral-900">
                      Informations entreprise
                    </h2>
                    <p className="text-sm text-neutral-500">
                      Votre activité professionnelle
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      label="Nom de l'entreprise"
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      error={errors.companyName}
                      required
                      showRequired
                    />
                    <Input
                      label="SIRET (14 chiffres)"
                      type="text"
                      value={formData.siret}
                      onChange={(e) =>
                        setFormData({ ...formData, siret: e.target.value.replace(/\D/g, "") })
                      }
                      error={errors.siret}
                      required
                      showRequired
                      maxLength={14}
                      placeholder="12345678901234"
                    />
                    <Input
                      label="Site web (optionnel)"
                      type="url"
                      value={formData.companyWebsite}
                      onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                      placeholder="https://www.mon-entreprise.fr"
                    />
                    <div>
                      <label htmlFor="companyDescription" className="block text-sm font-medium text-neutral-800 mb-1.5">
                        Description de l&apos;entreprise (optionnel)
                      </label>
                      <textarea
                        id="companyDescription"
                        value={formData.companyDescription}
                        onChange={(e) => setFormData({ ...formData, companyDescription: e.target.value })}
                        placeholder="Présentez votre activité..."
                        rows={3}
                        className={cn(
                          "w-full px-4 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500",
                          "border-neutral-300 resize-none"
                        )}
                      />
                    </div>
                  </CardContent>
                </motion.div>
              )}

              {/* Dernière étape : Mot de passe */}
              {currentStep === steps.length - 1 && (
                <motion.div
                  key="step-password"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={contentVariants}
                >
                  <CardHeader className="pb-2">
                    <h2 className="text-lg font-semibold text-neutral-900">
                      Sécurisez votre compte
                    </h2>
                    <p className="text-sm text-neutral-500">
                      Choisissez un mot de passe sécurisé
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      label="Mot de passe"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      error={errors.password}
                      required
                      showRequired
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
                      showRequired
                    />
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-between p-6 pt-4 border-t border-neutral-100">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> Retour
              </Button>
              {currentStep < steps.length - 1 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!isStepValid(currentStep)}
                  className="flex items-center gap-1"
                >
                  Suivant <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isLoading || !isStepValid(currentStep)}
                  className="flex items-center gap-1"
                >
                  {isLoading ? (
                    "Création..."
                  ) : (
                    <>
                      Créer mon compte <Check className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-600">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
