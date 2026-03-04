/**
 * Création des particuliers Paris-Lille + projets liés aux pros (Historique).
 * Idempotent : si un email existe déjà, le compte est réutilisé et le profil mis à jour.
 * Usage : npx tsx scripts/seed-particuliers-paris-lille.ts
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

// Données : Nom & Prénom | Téléphone | Email | Localisation | Historique (Pro)
const PARTICULIERS_DATA: Array<{
  fullName: string;
  phone: string;
  email: string;
  location: string;
  historiquePro: string; // Nom de l'entreprise pro associée (vide si aucun)
}> = [
  { fullName: "Thomas Lefebvre", phone: "06 12 34 56 78", email: "t.lefebvre@email.com", location: "15 Rue Royale, Lille", historiquePro: "Goutte d'Eau" },
  { fullName: "Camille Durand", phone: "06 23 45 67 89", email: "camille.d@email.com", location: "12 Rue Monge, Paris", historiquePro: "Lumière & Co" },
  { fullName: "Marc Antoine", phone: "06 34 56 78 90", email: "m.antoine@email.com", location: "40 Rue de l'Hôpital, Lille", historiquePro: "" },
  { fullName: "Sophie Martin", phone: "06 45 67 89 01", email: "sophie.m@email.com", location: "5 bis Rue de la Paix, Paris", historiquePro: "" },
  { fullName: "Julien Morel", phone: "06 56 78 90 12", email: "j.morel@email.com", location: "122 Boulevard de la Liberté, Lille", historiquePro: "Menuiserie Des Bois" },
  { fullName: "Élodie Petit", phone: "06 67 89 01 23", email: "elodie.p@email.com", location: "22 Rue Daguerre, Paris", historiquePro: "Toiture d'Élite" },
  { fullName: "Nicolas Dubois", phone: "06 78 90 12 34", email: "n.dubois@email.com", location: "88 Rue de Saint-André, Lille", historiquePro: "Lille Carrelage" },
  { fullName: "Marie Leroy", phone: "06 89 01 23 45", email: "m.leroy@email.com", location: "14 Avenue de Suffren, Paris", historiquePro: "Serrurerie Moderne" },
  { fullName: "Antoine Garcia", phone: "06 90 12 34 56", email: "a.garcia@email.com", location: "3 Rue de Gand, Lille", historiquePro: "Bati-Mixte" },
  { fullName: "Léa Bernard", phone: "07 11 22 33 44", email: "lea.b@email.com", location: "67 Boulevard Raspail, Paris", historiquePro: "Bati-Mixte" },
  { fullName: "Hugo Roux", phone: "07 22 33 44 55", email: "h.roux@email.com", location: "10 Square Morisson, Lille", historiquePro: "Turbo Gaz" },
  { fullName: "Chloé Vincent", phone: "07 33 44 55 66", email: "chloe.v@email.com", location: "4 Place des Ternes, Paris", historiquePro: "Design Intérieur 75" },
  { fullName: "Maxime Simon", phone: "07 44 55 66 77", email: "m.simon@email.com", location: "21 Rue de la Barre, Lille", historiquePro: "Artisan Global" },
  { fullName: "Inès Robert", phone: "07 55 66 77 88", email: "i.robert@email.com", location: "99 Rue de l'Université, Paris", historiquePro: "" },
  { fullName: "Paul Richard", phone: "07 66 77 88 99", email: "p.richard@email.com", location: "56 Rue du Molinel, Lille", historiquePro: "Maçonnerie du Nord" },
  { fullName: "Sarah Michel", phone: "07 77 88 99 00", email: "s.michel@email.com", location: "18 Rue de Turenne, Paris", historiquePro: "Élec Pro Paris" },
  { fullName: "Kevin Fontaine", phone: "07 88 99 00 11", email: "k.fontaine@email.com", location: "2 Avenue du Peuple Belge, Lille", historiquePro: "Clim & Confort" },
  { fullName: "Julie Masson", phone: "07 99 00 11 22", email: "j.masson@email.com", location: "142 Rue de Belleville, Paris", historiquePro: "Plâtre & Forme" },
  { fullName: "Alexandre David", phone: "06 10 20 30 40", email: "a.david@email.com", location: "19 Rue Esquermoise, Lille", historiquePro: "Plâtre & Forme" },
  { fullName: "Manon Girard", phone: "06 50 60 70 80", email: "m.girard@email.com", location: "31 Rue de Passy, Paris", historiquePro: "Paris Renovation" },
  { fullName: "Benoît Lefort", phone: "06 11 99 88 77", email: "b.lefort@email.com", location: "25 Rue de Valmy, Lille", historiquePro: "Nord Étanchéité" },
  { fullName: "Alice Vasseur", phone: "06 22 88 77 66", email: "a.vasseur@email.com", location: "40 Rue Caulaincourt, Paris", historiquePro: "L'Atelier du Verre" },
  { fullName: "Sébastien Proust", phone: "06 33 77 66 55", email: "s.proust@email.com", location: "12 Rue de Roubaix, Lille", historiquePro: "" },
  { fullName: "Claire Fournier", phone: "06 44 66 55 44", email: "c.fournier@email.com", location: "102 Rue du Bac, Paris", historiquePro: "Paris Sols Dur" },
  { fullName: "Jérôme Vallet", phone: "06 55 55 44 33", email: "j.vallet@email.com", location: "5 bis Rue d'Isly, Lille", historiquePro: "Lille Domotique" },
  { fullName: "Mélanie Costa", phone: "06 66 44 33 22", email: "m.costa@email.com", location: "15 Boulevard Magenta, Paris", historiquePro: "Façade Pro 75" },
  { fullName: "Thomas Gauthier", phone: "06 77 33 22 11", email: "t.gauthier@email.com", location: "33 Rue de la Louvière, Lille", historiquePro: "" },
  { fullName: "Karine Morel", phone: "06 88 22 11 00", email: "k.morel@email.com", location: "8 Rue de Passy, Paris", historiquePro: "Éco-Rénov Paris" },
  { fullName: "Fabien Roussel", phone: "06 99 11 00 99", email: "f.roussel@email.com", location: "2 Place du Concert, Lille", historiquePro: "Jardin du Nord" },
  { fullName: "Émilie Legrand", phone: "07 10 20 30 40", email: "e.legrand@email.com", location: "55 Rue Vieille du Temple, Paris", historiquePro: "" },
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

function getPostalCode(city: string): string {
  return city === "Lille" ? "59000" : "75001";
}

function normalizePhone(phone: string): string {
  return phone.replace(/\s/g, "");
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

  // Récupérer les pro_ids par company_name
  const { data: proProfiles } = await supabase
    .from("profiles")
    .select("id, company_name")
    .eq("user_type", "pro");
  const proByCompany = new Map<string, string>();
  for (const p of proProfiles ?? []) {
    if (p.company_name) proByCompany.set(p.company_name.trim(), p.id);
  }
  console.log(`Profilés ${proByCompany.size} pros trouvés.`);

  const rows: string[][] = [];
  const headers = ["role", "email", "password", "full_name", "phone", "address", "city", "postal_code", "historique_pro", "project_id"];

  for (const p of PARTICULIERS_DATA) {
    const { address, city } = parseLocation(p.location);
    const postalCode = getPostalCode(city);

    let userId: string | null = null;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: p.email,
      password: basePassword,
      email_confirm: true,
      user_metadata: { full_name: p.fullName },
    });

    if (authError) {
      if (authError.message?.includes("already been registered")) {
        const { data: existing } = await supabase.from("profiles").select("id").eq("email", p.email).maybeSingle();
        if (existing?.id) {
          userId = existing.id;
          console.log(`  ${p.fullName}: compte existant, mise à jour du profil`);
        }
      }
      if (!userId) {
        console.error(`✗ ${p.fullName}:`, authError.message ?? "Erreur auth");
        continue;
      }
    } else if (authData?.user?.id) {
      userId = authData.user.id;
    }

    if (!userId) continue;

    const profilePayload = {
      id: userId,
      full_name: p.fullName,
      email: p.email,
      phone: normalizePhone(p.phone),
      user_type: "client" as const,
      address,
      city,
      postal_code: postalCode,
      avatar_url: null,
      preferences: { email_notifications: true, project_alerts: true, message_alerts: true },
    };

    const { error: profileError } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
    if (profileError) {
      console.error(`  Profil ${p.fullName}:`, profileError.message);
    }

    let projectId: string | null = null;

    if (p.historiquePro.trim()) {
      const proId = proByCompany.get(p.historiquePro.trim());
      if (proId) {
        const { data: userProjects } = await supabase.from("projects").select("id").eq("created_by", userId);
        const projectIds = (userProjects ?? []).map((x) => x.id);
        let proMembers: { project_id: string }[] | null = null;
        if (projectIds.length > 0) {
          const { data } = await supabase
            .from("project_members")
            .select("project_id")
            .eq("user_id", proId)
            .in("project_id", projectIds);
          proMembers = data ?? [];
        }
        const alreadyHasProject = (proMembers ?? []).length > 0;

        if (alreadyHasProject) {
          projectId = (proMembers ?? [])[0]?.project_id ?? null;
          console.log(`  ${p.fullName}: projet déjà existant avec ${p.historiquePro}`);
        } else {
          const projectName = `Projet ${p.fullName} - ${p.historiquePro}`;
          const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .insert({
            name: projectName,
            description: `Projet réalisé avec ${p.historiquePro}.`,
            project_type: "renovation",
            address,
            city,
            created_by: userId,
            status: "draft",
          })
          .select("id")
          .single();

        if (!projectError && projectData?.id) {
          projectId = projectData.id;

          const now = new Date().toISOString();
          await supabase.from("project_members").insert({
            project_id: projectId,
            user_id: userId,
            role: "owner",
            status: "accepted",
            invited_by: userId,
            accepted_at: now,
          });
          await supabase.from("project_members").insert({
            project_id: projectId,
            user_id: proId,
            role: "pro",
            status: "accepted",
            invited_by: userId,
            accepted_at: now,
          });
          console.log(`✓ ${p.fullName} + projet avec ${p.historiquePro}`);
          } else {
            console.error(`  Projet ${p.fullName}:`, projectError?.message ?? "Erreur création");
          }
        }
      } else {
        console.warn(`  Pro "${p.historiquePro}" introuvable pour ${p.fullName}`);
      }
    }
    console.log(`✓ ${p.fullName}`);

    rows.push([
      "particulier",
      p.email,
      basePassword,
      p.fullName,
      normalizePhone(p.phone),
      address,
      city,
      postalCode,
      p.historiquePro,
      projectId ?? "",
    ]);
  }

  const escape = (v: string) => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const outPath = path.resolve(process.cwd(), "seed-particuliers-paris-lille-output.csv");
  await fs.writeFile(outPath, csv, "utf-8");

  const withProject = rows.filter((r) => r[9]).length;
  console.log(`\n${rows.length} particuliers créés (${withProject} avec projet lié au pro).`);
  console.log(`Export : ${outPath}`);
  console.log(`Mot de passe : ${basePassword}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
