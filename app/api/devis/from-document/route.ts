import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function requireUserId(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (!token) return { userId: null, error: "Missing Authorization bearer token" };
  const supabaseAdmin = getAdminClient();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.id) return { userId: null, error: error?.message ?? "Invalid token" };
  return { userId: data.user.id, error: null };
}

const isPdfName = (name: string) => name.trim().toLowerCase().endsWith(".pdf");
const titleFromName = (name: string) => name.replace(/\.[^/.]+$/, "").trim() || "Devis";

export async function POST(request: Request) {
  try {
    const { userId, error } = await requireUserId(request);
    if (!userId) return NextResponse.json({ error }, { status: 401 });

    const body = (await request.json().catch(() => null)) as
      | { projectId?: string; documentId?: string }
      | null;
    const projectId = body?.projectId ? String(body.projectId) : "";
    const documentId = body?.documentId ? String(body.documentId) : "";
    if (!projectId || !documentId) {
      return NextResponse.json({ error: "Missing projectId or documentId" }, { status: 400 });
    }

    const supabaseAdmin = getAdminClient();

    const { data: membership } = await supabaseAdmin
      .from("project_members")
      .select("id,status")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .in("status", ["accepted", "active"])
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not authorized for this project" }, { status: 403 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_type")
      .eq("id", userId)
      .maybeSingle();

    if ((profile as any)?.user_type !== "pro") {
      return NextResponse.json({ error: "Only professionals can link quotes" }, { status: 403 });
    }

    const { data: doc, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id,name,file_url,project_id")
      .eq("id", documentId)
      .maybeSingle();

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 400 });
    }
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    if ((doc as any).project_id !== projectId) {
      return NextResponse.json({ error: "Document not in this project" }, { status: 400 });
    }

    const name = String((doc as any).name ?? "");
    const fileUrl = String((doc as any).file_url ?? "");
    if (!fileUrl) {
      return NextResponse.json({ error: "Document has no file URL" }, { status: 400 });
    }
    if (!isPdfName(name)) {
      return NextResponse.json({ error: "Only PDF documents can be linked as quotes" }, { status: 400 });
    }

    // Avoid duplicates for the same project + URL
    const { data: existing } = await supabaseAdmin
      .from("devis")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .contains("metadata", { pdf_url: fileUrl })
      .maybeSingle();
    if (existing?.id) {
      return NextResponse.json({ devisId: existing.id });
    }

    const metadata = {
      title: titleFromName(name),
      pdf_url: fileUrl,
      file_name: name,
      source: "project_document",
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("devis")
      .insert({
        user_id: userId,
        project_id: projectId,
        status: "en_etude",
        metadata,
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      return NextResponse.json({ error: insertError?.message ?? "Failed to create quote" }, { status: 400 });
    }

    return NextResponse.json({ devisId: inserted.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

