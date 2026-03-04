/**
 * Crée uniquement les projets pour les particuliers existants (avec Historique Pro).
 * À lancer après seed-particuliers-paris-lille si les projets ont échoué.
 * Usage : npx tsx scripts/seed-particuliers-projects-only.ts
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

const PARTICULIERS_AVEC_PRO: Array<{ fullName: string; email: string; location: string; historiquePro: string }> = [
  { fullName: "Thomas Lefebvre", email: "t.lefebvre@email.com", location: "15 Rue Royale, Lille", historiquePro: "Goutte d'Eau" },
  { fullName: "Camille Durand", email: "camille.d@email.com", location: "12 Rue Monge, Paris", historiquePro: "Lumière & Co" },
  { fullName: "Julien Morel", email: "j.morel@email.com", location: "122 Boulevard de la Liberté, Lille", historiquePro: "Menuiserie Des Bois" },
  { fullName: "Élodie Petit", email: "elodie.p@email.com", location: "22 Rue Daguerre, Paris", historiquePro: "Toiture d'Élite" },
  { fullName: "Nicolas Dubois", email: "n.dubois@email.com", location: "88 Rue de Saint-André, Lille", historiquePro: "Lille Carrelage" },
  { fullName: "Marie Leroy", email: "m.leroy@email.com", location: "14 Avenue de Suffren, Paris", historiquePro: "Serrurerie Moderne" },
  { fullName: "Antoine Garcia", email: "a.garcia@email.com", location: "3 Rue de Gand, Lille", historiquePro: "Bati-Mixte" },
  { fullName: "Léa Bernard", email: "lea.b@email.com", location: "67 Boulevard Raspail, Paris", historiquePro: "Bati-Mixte" },
  { fullName: "Hugo Roux", email: "h.roux@email.com", location: "10 Square Morisson, Lille", historiquePro: "Turbo Gaz" },
  { fullName: "Chloé Vincent", email: "chloe.v@email.com", location: "4 Place des Ternes, Paris", historiquePro: "Design Intérieur 75" },
  { fullName: "Maxime Simon", email: "m.simon@email.com", location: "21 Rue de la Barre, Lille", historiquePro: "Artisan Global" },
  { fullName: "Paul Richard", email: "p.richard@email.com", location: "56 Rue du Molinel, Lille", historiquePro: "Maçonnerie du Nord" },
  { fullName: "Sarah Michel", email: "s.michel@email.com", location: "18 Rue de Turenne, Paris", historiquePro: "Élec Pro Paris" },
  { fullName: "Kevin Fontaine", email: "k.fontaine@email.com", location: "2 Avenue du Peuple Belge, Lille", historiquePro: "Clim & Confort" },
  { fullName: "Julie Masson", email: "j.masson@email.com", location: "142 Rue de Belleville, Paris", historiquePro: "Plâtre & Forme" },
  { fullName: "Alexandre David", email: "a.david@email.com", location: "19 Rue Esquermoise, Lille", historiquePro: "Plâtre & Forme" },
  { fullName: "Manon Girard", email: "m.girard@email.com", location: "31 Rue de Passy, Paris", historiquePro: "Paris Renovation" },
  { fullName: "Benoît Lefort", email: "b.lefort@email.com", location: "25 Rue de Valmy, Lille", historiquePro: "Nord Étanchéité" },
  { fullName: "Alice Vasseur", email: "a.vasseur@email.com", location: "40 Rue Caulaincourt, Paris", historiquePro: "L'Atelier du Verre" },
  { fullName: "Claire Fournier", email: "c.fournier@email.com", location: "102 Rue du Bac, Paris", historiquePro: "Paris Sols Dur" },
  { fullName: "Jérôme Vallet", email: "j.vallet@email.com", location: "5 bis Rue d'Isly, Lille", historiquePro: "Lille Domotique" },
  { fullName: "Mélanie Costa", email: "m.costa@email.com", location: "15 Boulevard Magenta, Paris", historiquePro: "Façade Pro 75" },
  { fullName: "Karine Morel", email: "k.morel@email.com", location: "8 Rue de Passy, Paris", historiquePro: "Éco-Rénov Paris" },
  { fullName: "Fabien Roussel", email: "f.roussel@email.com", location: "2 Place du Concert, Lille", historiquePro: "Jardin du Nord" },
];

function parseLocation(loc: string): { address: string; city: string } {
  const lastComma = loc.lastIndexOf(",");
  if (lastComma > 0) {
    return { address: loc.slice(0, lastComma).trim(), city: loc.slice(lastComma + 1).trim() };
  }
  return { address: loc, city: "Paris" };
}

async function main() {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Erreur : variables d'environnement requises.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: proProfiles } = await supabase.from("profiles").select("id, company_name").eq("user_type", "pro");
  const proByCompany = new Map<string, string>();
  for (const p of proProfiles ?? []) {
    if (p.company_name) proByCompany.set(p.company_name.trim(), p.id);
  }

  let created = 0;
  for (const p of PARTICULIERS_AVEC_PRO) {
    const { data: partProfile } = await supabase.from("profiles").select("id").eq("email", p.email).maybeSingle();
    if (!partProfile?.id) {
      console.warn(`Particulier ${p.email} introuvable.`);
      continue;
    }

    const proId = proByCompany.get(p.historiquePro.trim());
    if (!proId) {
      console.warn(`Pro "${p.historiquePro}" introuvable.`);
      continue;
    }

    const { address, city } = parseLocation(p.location);
    const projectName = `Projet ${p.fullName} - ${p.historiquePro}`;

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: projectName,
        description: `Projet réalisé avec ${p.historiquePro}.`,
        project_type: "renovation",
        address,
        city,
        created_by: partProfile.id,
        status: "draft",
      })
      .select("id")
      .single();

    if (projectError || !projectData?.id) {
      console.error(`  ${p.fullName}:`, projectError?.message ?? "Erreur projet");
      continue;
    }

    const now = new Date().toISOString();
    await supabase.from("project_members").insert({
      project_id: projectData.id,
      user_id: partProfile.id,
      role: "owner",
      status: "accepted",
      invited_by: partProfile.id,
      accepted_at: now,
    });
    await supabase.from("project_members").insert({
      project_id: projectData.id,
      user_id: proId,
      role: "pro",
      status: "accepted",
      invited_by: partProfile.id,
      accepted_at: now,
    });

    console.log(`✓ Projet créé : ${p.fullName} ↔ ${p.historiquePro}`);
    created++;
  }

  console.log(`\n${created} projets créés.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
