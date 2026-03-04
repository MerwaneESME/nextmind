/**
 * Attribue une note (1-5 étoiles) aux pros qui n'en ont pas.
 * Usage : npx tsx scripts/backfill-pro-rating.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs/promises";

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

function randomRating(): { avg: number; count: number } {
  const avg = Math.round((3 + Math.random() * 2) * 100) / 100;
  const count = Math.floor(Math.random() * 50) + 5;
  return { avg, count };
}

async function main() {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  const { data: pros, error } = await supabase
    .from("profiles")
    .select("id, full_name, company_name, rating_avg, rating_count")
    .eq("user_type", "pro");

  if (error) {
    console.error("Erreur:", error.message);
    process.exit(1);
  }

  const toUpdate = (pros ?? []).filter(
    (p) => p.rating_avg == null || p.rating_count == null || p.rating_count === 0
  );

  let updated = 0;
  for (const p of toUpdate) {
    const { avg, count } = randomRating();
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ rating_avg: avg, rating_count: count })
      .eq("id", p.id);
    if (!updErr) {
      console.log(`✓ ${p.company_name || p.full_name}: ${avg} étoiles (${count} avis)`);
      updated++;
    } else {
      console.error(`✗ ${p.company_name || p.full_name}:`, updErr.message);
    }
  }

  console.log(`\n${updated} pros mis à jour sur ${toUpdate.length} sans note.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
