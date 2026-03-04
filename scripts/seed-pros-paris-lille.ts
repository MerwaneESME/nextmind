/**
 * Création des 30 profils pros Paris-Lille à partir des données fournies.
 * Usage : npx tsx scripts/seed-pros-paris-lille.ts
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

// Données fournies : Nom de Société | Secteur(s) | Localisation | Téléphone | Email
const PROS_DATA: Array<{
  companyName: string;
  sectors: string;
  location: string;
  phone: string;
  email: string;
}> = [
  { companyName: "BatiNord Services", sectors: "Maçonnerie, Façade", location: "12 Rue de Béthune, Lille", phone: "03 20 11 22 33", email: "contact@batinord.fr" },
  { companyName: "Lumière & Co", sectors: "Électricité", location: "45 Rue de Courcelles, Paris", phone: "01 42 55 66 77", email: "sav@lumiereco.com" },
  { companyName: "Goutte d'Eau", sectors: "Plomberie, Chauffage", location: "8 Rue Faidherbe, Lille", phone: "03 20 44 55 66", email: "info@gouttedeau.fr" },
  { companyName: "Pinceau Parisien", sectors: "Peinture, Revêtement", location: "112 Rue de Rivoli, Paris", phone: "01 40 88 99 00", email: "devis@pinceau-paris.fr" },
  { companyName: "Multi-Renov 59", sectors: "Électricité, Peinture", location: "22 Avenue du Peuple Belge, Lille", phone: "03 28 00 11 22", email: "staff@multirenov59.com" },
  { companyName: "Toiture d'Élite", sectors: "Couverture, Isolation", location: "30 Rue de Vaugirard, Paris", phone: "01 45 66 77 88", email: "contact@toiture-elite.fr" },
  { companyName: "Lille Carrelage", sectors: "Carrelage, Mosaïque", location: "5 Rue de la Monnaie, Lille", phone: "03 20 99 88 77", email: "carrelage.lille@gmail.com" },
  { companyName: "Serrurerie Moderne", sectors: "Serrurerie, Ferronnerie", location: "18 Boulevard Haussmann, Paris", phone: "01 48 22 33 44", email: "urgence@serrureriemoderne.fr" },
  { companyName: "Menuiserie Des Bois", sectors: "Menuiserie, Ebénisterie", location: "14 Rue Solférino, Lille", phone: "03 20 33 44 55", email: "ateliers@desbois.fr" },
  { companyName: "Sol & Style", sectors: "Parquet, Moquette", location: "62 Rue de Rennes, Paris", phone: "01 43 99 88 11", email: "hello@solstyle.fr" },
  { companyName: "Artisan Global", sectors: "Plomberie, Électricité", location: "102 Rue Gambetta, Lille", phone: "03 20 77 66 55", email: "contact@artisan-global.fr" },
  { companyName: "Vert & Jardin", sectors: "Aménagement extérieur", location: "25 Rue de Passy, Paris", phone: "01 47 33 22 11", email: "jardin@vert-paris.fr" },
  { companyName: "Turbo Gaz", sectors: "Chauffage, Gaz", location: "15 Rue de l'Hôpital Militaire, Lille", phone: "03 20 55 44 33", email: "technique@turbogaz.fr" },
  { companyName: "Design Intérieur 75", sectors: "Peinture, Décoration", location: "88 Avenue des Ternes, Paris", phone: "01 44 11 22 33", email: "studio@design75.fr" },
  { companyName: "Maçonnerie du Nord", sectors: "Gros œuvre", location: "54 Rue Nationale, Lille", phone: "03 20 66 77 88", email: "chantier@maconnerienord.fr" },
  { companyName: "Élec Pro Paris", sectors: "Électricité", location: "12 Rue de la Paix, Paris", phone: "01 42 11 22 33", email: "contact@elecpro.paris" },
  { companyName: "Clim & Confort", sectors: "Climatisation", location: "9 Rue Pierre Mauroy, Lille", phone: "03 28 44 33 22", email: "clim@confort59.fr" },
  { companyName: "Plâtre & Forme", sectors: "Plâtrerie, Cloisons", location: "201 Rue d'Alésia, Paris", phone: "01 45 00 11 22", email: "platre@forme.fr" },
  { companyName: "Bati-Mixte", sectors: "Maçonnerie, Plomberie", location: "33 Boulevard de la Liberté, Lille", phone: "03 20 22 11 00", email: "admin@batimixte.fr" },
  { companyName: "Paris Renovation", sectors: "Rénovation complète", location: "5 Avenue Bosquet, Paris", phone: "01 47 00 88 99", email: "projets@parisreno.fr" },
  { companyName: "Nord Étanchéité", sectors: "Isolation, Toiture", location: "42 Rue de la Clef, Lille", phone: "03 20 12 34 56", email: "contact@nord-etanche.fr" },
  { companyName: "L'Atelier du Verre", sectors: "Vitrerie, Miroiterie", location: "150 Rue du Faubourg St-Antoine, Paris", phone: "01 43 21 00 99", email: "atelier@verre-paris.fr" },
  { companyName: "Chauffage Flamand", sectors: "Chauffage, Plomberie", location: "12 Boulevard Carnot, Lille", phone: "03 20 88 77 66", email: "sav@chauffage-flamand.fr" },
  { companyName: "Paris Sols Dur", sectors: "Carrelage, Béton ciré", location: "28 Rue de Charenton, Paris", phone: "01 48 55 44 33", email: "info@parissols.fr" },
  { companyName: "Lille Domotique", sectors: "Électricité, Alarme", location: "5 Avenue Louise Michel, Lille", phone: "03 28 55 22 11", email: "contact@lille-domo.com" },
  { companyName: "Façade Pro 75", sectors: "Ravalement, Peinture", location: "12 Avenue de Clichy, Paris", phone: "01 42 33 22 11", email: "devis@facadepro.fr" },
  { companyName: "Bois & Tradition", sectors: "Charpente, Menuiserie", location: "88 Rue de Douai, Lille", phone: "03 20 44 99 88", email: "contact@boistradition.fr" },
  { companyName: "Éco-Rénov Paris", sectors: "Isolation, Plâtrerie", location: "64 Rue de la Pompe, Paris", phone: "01 45 11 00 22", email: "projet@ecorenov.fr" },
  { companyName: "Jardin du Nord", sectors: "Paysagisme, Clôture", location: "14 Rue des Postes, Lille", phone: "03 20 66 11 00", email: "vert@jardindunord.fr" },
  { companyName: "Plombier du Marais", sectors: "Plomberie", location: "10 Rue des Francs-Bourgeois, Paris", phone: "01 44 88 55 22", email: "depannage@plombier-marais.fr" },
];

// Noms de contact pour chaque pro (générés)
const NOMS_CONTACT = [
  "Jean Martin", "Pierre Dubois", "Marc Bernard", "Philippe Leroy", "Thomas Moreau",
  "François Petit", "Nicolas Simon", "Laurent Dupont", "David Morel", "Stéphane Roux",
  "Olivier Blanc", "Michel Garnier", "Patrick Faure", "Christophe Mercier", "Bruno Lambert",
  "Alain Girard", "Sébastien Robin", "Vincent Gaillard", "Julien Lefebvre", "Romain Chevalier",
  "Maxime Perrin", "Antoine Lemoine", "Guillaume Barbier", "Nicolas Fontaine", "Alexandre Roy",
  "Cédric Masson", "Jérôme Bonnet", "Fabrice Renaud", "Thierry Guerin", "Pascal Henry",
];

function parseLocation(loc: string): { address: string; city: string } {
  const lastComma = loc.lastIndexOf(",");
  if (lastComma > 0) {
    return {
      address: loc.slice(0, lastComma).trim(),
      city: loc.slice(lastComma + 1).trim(),
    };
  }
  return { address: loc, city: "Paris" };
}

function getPostalCode(city: string, address: string): string {
  if (city === "Lille") return "59000";
  if (city === "Paris") {
    // Approximation par quartier (Rivoli=75001, Vaugirard=75015, etc.)
    if (address.includes("Rivoli") || address.includes("Paix")) return "75001";
    if (address.includes("Courcelles") || address.includes("Ternes")) return "75017";
    if (address.includes("Vaugirard")) return "75015";
    if (address.includes("Haussmann") || address.includes("Charenton")) return "75009";
    if (address.includes("Rennes")) return "75006";
    if (address.includes("Passy")) return "75016";
    if (address.includes("Alésia")) return "75014";
    if (address.includes("Bosquet") || address.includes("Pompe")) return "75016";
    if (address.includes("Faubourg St-Antoine") || address.includes("Clichy")) return "75011";
    if (address.includes("Francs-Bourgeois")) return "75004";
    return "75001";
  }
  return "59000";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function main() {
  await loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Erreur : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const basePassword = "NextMind2024!";

  const rows: string[][] = [];
  const headers = ["role", "email", "password", "full_name", "company_name", "phone", "address", "city", "postal_code", "siret", "company_website", "company_description", "specialties"];

  for (let i = 0; i < PROS_DATA.length; i++) {
    const p = PROS_DATA[i]!;
    const { address, city } = parseLocation(p.location);
    const postalCode = getPostalCode(city, address);
    const fullName = NOMS_CONTACT[i % NOMS_CONTACT.length]!;
    const siret = String(10000000000000 + Math.floor(Math.random() * 1000000000000));
    const slug = slugify(p.companyName);
    const companyWebsite = `https://www.${slug}.fr`;
    const companyDescription = `${p.companyName} est une entreprise spécialisée en ${p.sectors}. Nous intervenons sur Paris et la région Nord. Plus de 10 ans d'expérience. Devis gratuit et rapide.`;
    const sectorsList = p.sectors.split(",").map((s) => s.trim()).filter(Boolean);

    // Email unique pour auth (éviter doublons si déjà existant)
    const authEmail = p.email.includes("@") ? p.email : `pro.${randomId()}@nextmind-demo.fr`;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: authEmail,
      password: basePassword,
      email_confirm: true,
      user_metadata: { company_name: p.companyName },
    });

    if (authError || !authData.user) {
      console.error(`✗ ${p.companyName}:`, authError?.message ?? "Erreur auth");
      continue;
    }

    const proId = authData.user.id;

    const ratingAvg = Math.round((3 + Math.random() * 2) * 100) / 100;
    const ratingCount = Math.floor(Math.random() * 50) + 5;

    const profilePayload: Record<string, unknown> = {
      id: proId,
      full_name: fullName,
      email: authEmail,
      phone: p.phone,
      user_type: "pro" as const,
      company_name: p.companyName,
      siret,
      address,
      city,
      postal_code: postalCode,
      company_website: companyWebsite,
      company_description: companyDescription,
      public_portfolio_enabled: true,
      avatar_url: null,
      preferences: { email_notifications: true, project_alerts: true, message_alerts: true },
      display_name: p.companyName,
      rating_avg: ratingAvg,
      rating_count: ratingCount,
    };

    const { error: profileError } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
    if (profileError) {
      console.error(`  Profil ${p.companyName}:`, profileError.message);
    }

    for (const label of sectorsList) {
      await supabase.from("pro_specialties").insert({ pro_id: proId, label });
    }

    // 1 projet portfolio par pro
    await supabase.from("pro_portfolio_projects").insert({
      pro_id: proId,
      title: `Projet ${p.companyName} - ${city}`,
      summary: `Réalisation complète par ${p.companyName}. Secteur : ${p.sectors}.`,
      budget_total: 15000 + Math.floor(Math.random() * 50000),
      duration_days: 30 + Math.floor(Math.random() * 90),
      city,
      postal_code: postalCode,
      is_public: true,
    });

    rows.push([
      "professionnel",
      authEmail,
      basePassword,
      fullName,
      p.companyName,
      p.phone,
      address,
      city,
      postalCode,
      siret,
      companyWebsite,
      companyDescription,
      sectorsList.join("; "),
    ]);

    console.log(`✓ ${p.companyName} (${city})`);
  }

  const escape = (v: string) => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const outPath = path.resolve(process.cwd(), "seed-pros-paris-lille-output.csv");
  await fs.writeFile(outPath, csv, "utf-8");

  console.log(`\n${rows.length} pros créés. Export : ${outPath}`);
  console.log(`Mot de passe : ${basePassword}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
