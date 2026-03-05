import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AVATARS_STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET ?? "avatar";

function getAdminClient() {
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function requireUserId(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (!token) {
    return { userId: null, error: "Missing Authorization bearer token" };
  }
  const supabaseAdmin = getAdminClient();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.id) {
    return { userId: null, error: error?.message ?? "Invalid token" };
  }
  return { userId: data.user.id, error: null };
}

export async function POST(request: Request) {
  try {
    const { userId, error } = await requireUserId(request);
    if (!userId) return NextResponse.json({ error }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (!file.type?.startsWith("image/")) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "Image too large (max 5MB)" }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();
    const storagePath = `users/${userId}/avatar`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage.from(AVATARS_STORAGE_BUCKET).upload(storagePath, bytes, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const { data: publicData } = supabaseAdmin.storage.from(AVATARS_STORAGE_BUCKET).getPublicUrl(storagePath);
    const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabaseAdmin.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ avatarUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId, error } = await requireUserId(request);
    if (!userId) return NextResponse.json({ error }, { status: 401 });

    const supabaseAdmin = getAdminClient();
    const storagePath = `users/${userId}/avatar`;
    await supabaseAdmin.storage.from(AVATARS_STORAGE_BUCKET).remove([storagePath]);

    const { error: updateError } = await supabaseAdmin.from("profiles").update({ avatar_url: null }).eq("id", userId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

