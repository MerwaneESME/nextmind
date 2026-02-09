import { supabase } from "@/lib/supabaseClient";

export type DocumentType = "devis" | "facture" | "plan" | "photo" | "autre";

const DOCUMENTS_STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET ?? "documents";

export interface DocumentRow {
  id: string;
  name: string;
  file_url: string;
  storage_path: string | null;
  file_type: DocumentType | string;
  file_size: number;
  uploaded_by: string;
  project_id: string | null;
  phase_id: string | null;
  lot_id: string | null;
  created_at: string;
  updated_at: string;
  uploader?: { id: string; email: string | null; full_name: string | null } | null;
}

export async function getDocuments(context: { projectId?: string; phaseId?: string; lotId?: string; fileType?: DocumentType }) {
  let query = supabase
    .from("documents")
    .select("*,uploader:profiles!documents_uploaded_by_fkey(id,email,full_name)")
    .order("created_at", { ascending: false });

  if (context.projectId) {
    query = query.eq("project_id", context.projectId).is("phase_id", null).is("lot_id", null);
  } else if (context.phaseId) {
    query = query.eq("phase_id", context.phaseId).is("project_id", null).is("lot_id", null);
  } else if (context.lotId) {
    query = query.eq("lot_id", context.lotId).is("project_id", null).is("phase_id", null);
  } else {
    return [];
  }

  if (context.fileType) {
    query = query.eq("file_type", context.fileType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DocumentRow[];
}

export async function uploadDocument(
  file: File,
  context: { projectId?: string; phaseId?: string; lotId?: string; fileType: DocumentType }
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Non authentifié");

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^\p{L}\p{N}\s._-]/gu, "").replace(/\s+/g, "_");
  const fileName = `${timestamp}_${safeName}`;

  const storagePath = context.lotId
    ? `lots/${context.lotId}/${fileName}`
    : context.phaseId
      ? `phases/${context.phaseId}/${fileName}`
      : `projects/${context.projectId}/${fileName}`;

  const { error: uploadError } = await supabase.storage.from(DOCUMENTS_STORAGE_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) {
    const message = uploadError.message ?? String(uploadError);
    if (/bucket not found/i.test(message)) {
      throw new Error(
        `Bucket Supabase Storage introuvable: "${DOCUMENTS_STORAGE_BUCKET}". Créez ce bucket dans Supabase Storage, ou définissez NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET.`
      );
    }
    throw uploadError;
  }

  const { data: publicData } = supabase.storage.from(DOCUMENTS_STORAGE_BUCKET).getPublicUrl(storagePath);
  const publicUrl = publicData.publicUrl;

  const { data, error } = await supabase
    .from("documents")
    .insert({
      name: file.name,
      content: "",
      file_url: publicUrl,
      storage_path: storagePath,
      file_type: context.fileType,
      file_size: file.size,
      uploaded_by: user.id,
      project_id: context.projectId ?? null,
      phase_id: context.phaseId ?? null,
      lot_id: context.lotId ?? null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as DocumentRow;
}

export async function deleteDocument(documentId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Non authentifié");

  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("id,storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!doc) return;

  const storagePath = (doc as any).storage_path as string | null;
  if (storagePath) {
    await supabase.storage.from(DOCUMENTS_STORAGE_BUCKET).remove([storagePath]);
  }

  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) throw error;
}
