import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Inscription via API Admin - crée l'utilisateur avec email déjà confirmé
 * pour permettre la connexion immédiate sans validation d'email.
 * Toutes les infos du formulaire sont enregistrées dans le profil.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Configuration serveur manquante (SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 500 }
    );
  }

  let body: {
    email: string;
    password: string;
    profile: {
      full_name: string;
      email: string;
      phone: string | null;
      address: string | null;
      city: string | null;
      postal_code: string | null;
      department: string | null;
      user_type: "pro" | "client";
      company_name?: string | null;
      siret?: string | null;
      company_website?: string | null;
      company_description?: string | null;
    };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { email, password, profile } = body;
  if (!email?.trim() || !password || !profile) {
    return NextResponse.json(
      { error: "Email, mot de passe et profil requis." },
      { status: 400 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: profile.full_name },
  });

  if (authError) {
    const msg = authError.message ?? "Erreur lors de la création du compte.";
    const status = msg.toLowerCase().includes("already been registered") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  if (!authData.user) {
    return NextResponse.json({ error: "Création du compte impossible." }, { status: 500 });
  }

  const profileToSave: Record<string, unknown> = {
    id: authData.user.id,
    email: profile.email?.trim() ?? email.trim(),
    full_name: profile.full_name?.trim() ?? null,
    phone: profile.phone?.trim() || null,
    address: profile.address?.trim() || null,
    city: profile.city?.trim() || null,
    postal_code: profile.postal_code?.trim() || null,
    user_type: profile.user_type,
    company_name: profile.company_name?.trim() || null,
    siret: profile.siret?.trim() || null,
    company_website: profile.company_website?.trim() || null,
    company_description: profile.company_description?.trim() || null,
  };

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(profileToSave, { onConflict: "id" });

  // En cas d'erreur profil : on renvoie quand même le succès pour permettre la connexion.
  // applyPendingProfile (useAuth) enregistrera les données depuis le localStorage à la connexion.
  if (profileError) {
    // eslint-disable-next-line no-console
    console.error("[signup] Erreur profil:", profileError.message);
  }

  return NextResponse.json({ success: true, userId: authData.user.id });
}
