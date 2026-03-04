/**
 * Script de création de profils professionnels et particuliers pour NextMind.
 * Utilise l'API Admin Supabase (clé service_role).
 *
 * Prérequis :
 * - Ajouter SUPABASE_SERVICE_ROLE_KEY dans .env.local (Dashboard Supabase > Settings > API)
 * - NEXT_PUBLIC_SUPABASE_URL doit être défini
 *
 * Usage : npx tsx scripts/seed-users.ts
 * Options : --count=5 (nombre de chaque type, défaut 3)
 *           --output=comptes.csv (fichier de sortie, défaut seed-users-output.csv)
 *
 * Pour lister les colonnes de votre table profiles (Supabase SQL Editor) :
 *   SELECT column_name, data_type FROM information_schema.columns
 *   WHERE table_schema = 'public' AND table_name = 'profiles' ORDER BY ordinal_position;
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Charger .env.local
async function loadEnv() {
  const envPaths = [".env.local", ".env"];
  for (const p of envPaths) {
    try {
      const content = await fs.readFile(p, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[key] = val;
        }
      }
      break;
    } catch {
      continue;
    }
  }
}

const NOMS_PARTICULIERS = [
  "Marie Dupont",
  "Jean Martin",
  "Sophie Bernard",
  "Pierre Leroy",
  "Isabelle Petit",
  "Thomas Moreau",
  "Nathalie Simon",
  "François Laurent",
];

const NOMS_PRO = [
  "BTP Martin & Fils",
  "Rénovation Express",
  "Artisans du Bâtiment",
  "Construction Pro",
  "Travaux Plus",
  "Électricité Sécurité",
  "Plomberie Moderne",
  "Peinture Déco",
];

// Nom complet du contact (personne) pour chaque pro
const NOMS_CONTACT_PRO = [
  "Jean Martin",
  "Pierre Dubois",
  "Marc Bernard",
  "Philippe Leroy",
  "Thomas Moreau",
  "François Petit",
  "Nicolas Simon",
  "Laurent Dupont",
];

const SPECIALITES = [
  "Rénovation",
  "Gros œuvre",
  "Électricité",
  "Plomberie",
  "Peinture",
  "Maçonnerie",
  "Menuiserie",
  "Carrelage",
  "Étanchéité",
  "Chauffage",
];

const VILLES = [
  "Paris",
  "Lyon",
  "Marseille",
  "Toulouse",
  "Nice",
  "Nantes",
  "Strasbourg",
  "Montpellier",
];

const CP = ["75001", "69001", "13001", "31000", "06000", "44000", "67000", "34000"];

const PORTFOLIO_TITRES = [
  "Rénovation appartement 80m²",
  "Extension maison individuelle",
  "Mise aux normes électrique",
  "Ravalement façade immeuble",
  "Aménagement combles",
  "Cuisine sur mesure",
  "Salle de bain complète",
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function parseArgs(): { count: number; output: string } {
  const args = process.argv.slice(2);
  let count = 3;
  let output = "seed-users-output.csv";
  for (const arg of args) {
    if (arg.startsWith("--count=")) count = parseInt(arg.split("=")[1] ?? "3", 10) || 3;
    if (arg.startsWith("--output=")) output = arg.split("=")[1] ?? output;
  }
  return { count, output };
}

type UserType = "client" | "pro";

interface CreatedUser {
  role: "particulier" | "professionnel";
  userType: UserType;
  userId: string;
  email: string;
  password: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  companyName?: string;
  siret?: string;
  companyWebsite?: string;
  companyDescription?: string;
  displayName?: string;
  avatarUrl?: string;
  latitude?: number;
  longitude?: number;
  specialties?: string;
  portfolioCount?: number;
}

async function main() {
  await loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "Erreur : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis.\n" +
        "Ajoutez SUPABASE_SERVICE_ROLE_KEY dans .env.local (Supabase Dashboard > Settings > API > service_role)."
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { count, output } = parseArgs();

  const created: CreatedUser[] = [];
  const basePassword = "NextMind2024!";

  // --- Particuliers ---
  for (let i = 0; i < count; i++) {
    const suffix = randomId();
    const email = `particulier.${suffix}@nextmind-demo.fr`;
    const fullName = NOMS_PARTICULIERS[i % NOMS_PARTICULIERS.length]!;
    const city = randomItem(VILLES);
    const cp = CP[VILLES.indexOf(city)] ?? "75001";

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: basePassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authError || !authData.user) {
      console.error(`Erreur création particulier ${email}:`, authError?.message ?? "Inconnu");
      continue;
    }

    const profilePayload: Record<string, unknown> = {
      id: authData.user.id,
      email,
      full_name: fullName,
      user_type: "client" as const,
      phone: `06${String(Math.floor(Math.random() * 90000000) + 10000000)}`,
      address: `${Math.floor(Math.random() * 150) + 1} rue de la Paix`,
      city,
      postal_code: cp,
      avatar_url: null,
      preferences: { email_notifications: true, project_alerts: true, message_alerts: true },
    };

    const { error: profileError } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
    if (profileError) {
      console.error(`Erreur profil particulier ${email}:`, profileError.message);
    }

    created.push({
      role: "particulier",
      userType: "client",
      userId: authData.user.id,
      email,
      password: basePassword,
      fullName,
      phone: profilePayload.phone as string,
      address: profilePayload.address as string,
      city,
      postalCode: cp,
    });
    console.log(`✓ Particulier créé : ${email}`);
  }

  // --- Professionnels (tous les champs profiles + pro_specialties + pro_portfolio_projects) ---
  for (let i = 0; i < count; i++) {
    const suffix = randomId();
    const email = `pro.${suffix}@nextmind-demo.fr`;
    const companyName = NOMS_PRO[i % NOMS_PRO.length]!;
    const city = randomItem(VILLES);
    const cp = CP[VILLES.indexOf(city)] ?? "75001";
    const siret = String(10000000000000 + Math.floor(Math.random() * 1000000000000));
    const lat = 43 + Math.random() * 8;
    const lng = -1 + Math.random() * 8;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: basePassword,
      email_confirm: true,
      user_metadata: { company_name: companyName },
    });

    if (authError || !authData.user) {
      console.error(`Erreur création pro ${email}:`, authError?.message ?? "Inconnu");
      continue;
    }

    const proId = authData.user.id;
    const fullName = NOMS_CONTACT_PRO[i % NOMS_CONTACT_PRO.length]!; // Nom complet du contact
    const phone = `06${String(Math.floor(Math.random() * 90000000) + 10000000)}`;
    const address = `${Math.floor(Math.random() * 150) + 1} avenue des Champs`;
    const companyWebsite = `https://${companyName.toLowerCase().replace(/\s+/g, "-").replace(/[&]/g, "")}.fr`;
    const companyDescription = `Entreprise spécialisée dans les travaux de rénovation et construction. ${companyName} intervient depuis plus de 10 ans. Nous réalisons vos projets avec soin et professionnalisme.`;

    // Profil pro : tous les champs du formulaire (Nom complet, Email, Téléphone, Role, Entreprise, SIRET, Adresse, Ville, Code postal, Site web, Présentation)
    const profilePayload: Record<string, unknown> = {
      id: proId,
      full_name: fullName, // Nom complet
      email, // Email de contact
      phone, // Téléphone
      user_type: "pro" as const, // Role (professionnel)
      company_name: companyName, // Entreprise
      siret, // SIRET (privé)
      address, // Adresse
      city, // Ville
      postal_code: cp, // Code postal
      company_website: companyWebsite, // Site web
      company_description: companyDescription, // Présentation
      public_portfolio_enabled: true,
      avatar_url: null,
      preferences: { email_notifications: true, project_alerts: true, message_alerts: true },
      // Champs additionnels (ignorés si colonne absente)
      display_name: companyName,
      latitude: Math.round(lat * 1000000) / 1000000,
      longitude: Math.round(lng * 1000000) / 1000000,
      rating_avg: 4 + Math.random(),
      rating_count: Math.floor(Math.random() * 50) + 5,
    };

    const ratingAvg = Math.round((3 + Math.random() * 2) * 100) / 100;
    const ratingCount = Math.floor(Math.random() * 50) + 5;
    profilePayload.rating_avg = ratingAvg;
    profilePayload.rating_count = ratingCount;

    const { display_name, latitude, longitude, ...basePayload } = profilePayload;
    const { error: profileError } = await supabase.from("profiles").upsert(basePayload, { onConflict: "id" });
    if (profileError) {
      console.error(`Erreur profil pro ${email}:`, profileError.message);
    } else {
      const optional: Record<string, unknown> = {};
      if (display_name != null) optional.display_name = display_name;
      if (latitude != null) optional.latitude = latitude;
      if (longitude != null) optional.longitude = longitude;
      if (Object.keys(optional).length > 0) {
        await supabase.from("profiles").update(optional).eq("id", proId);
      }
    }

    // Spécialités (pro_specialties)
    const numSpecs = 2 + Math.floor(Math.random() * 2);
    const shuffled = [...SPECIALITES].sort(() => Math.random() - 0.5);
    const specs = shuffled.slice(0, numSpecs);
    for (const label of specs) {
      const { error: specError } = await supabase.from("pro_specialties").insert({ pro_id: proId, label });
      if (specError) console.warn(`  Spécialité "${label}" ignorée:`, specError.message);
    }

    // Portfolio (pro_portfolio_projects)
    const numProjects = 1 + Math.floor(Math.random() * 2);
    const shuffledTitres = [...PORTFOLIO_TITRES].sort(() => Math.random() - 0.5);
    for (let p = 0; p < numProjects; p++) {
      const titre = shuffledTitres[p] ?? "Projet BTP";
      const { error: portError } = await supabase.from("pro_portfolio_projects").insert({
        pro_id: proId,
        title: titre,
        summary: `Réalisation complète de ce projet. Client satisfait, livraison dans les délais.`,
        budget_total: 15000 + Math.floor(Math.random() * 85000),
        duration_days: 30 + Math.floor(Math.random() * 120),
        city,
        postal_code: cp,
        image_path: null,
        is_public: true,
      });
      if (portError) console.warn(`  Portfolio "${titre}" ignoré:`, portError.message);
    }

    created.push({
      role: "professionnel",
      userType: "pro",
      userId: proId,
      email,
      password: basePassword,
      fullName, // Nom complet
      phone,
      address,
      city,
      postalCode: cp,
      companyName, // Entreprise
      siret,
      companyWebsite,
      companyDescription, // Présentation
      displayName: companyName,
      latitude: profilePayload.latitude as number,
      longitude: profilePayload.longitude as number,
      specialties: specs.join("; "),
      portfolioCount: numProjects,
    });
    console.log(`✓ Professionnel créé : ${email} (${specs.join(", ")})`);
  }

  // CSV
  const headers = [
    "role",
    "user_type",
    "user_id",
    "email",
    "password",
    "full_name",
    "phone",
    "address",
    "city",
    "postal_code",
    "company_name",
    "siret",
    "company_website",
    "company_description",
    "display_name",
    "latitude",
    "longitude",
    "specialties",
    "portfolio_count",
  ];
  const toRow = (u: CreatedUser) => [
    u.role,
    u.userType,
    u.userId,
    u.email,
    u.password,
    u.fullName,
    u.phone,
    u.address,
    u.city,
    u.postalCode,
    u.companyName ?? "",
    u.siret ?? "",
    u.companyWebsite ?? "",
    u.companyDescription ?? "",
    u.displayName ?? "",
    u.latitude ?? "",
    u.longitude ?? "",
    u.specialties ?? "",
    u.portfolioCount ?? "",
  ];
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = created.map((u) => toRow(u).map(escape).join(","));
  const csv = [headers.join(","), ...rows].join("\n");

  const outPath = path.resolve(process.cwd(), output);
  await fs.writeFile(outPath, csv, "utf-8");
  console.log(`\n${created.length} comptes créés. Export : ${outPath}`);
  console.log(`Mot de passe commun : ${basePassword}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
