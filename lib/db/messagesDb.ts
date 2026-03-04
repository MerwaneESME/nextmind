import { supabase } from "@/lib/supabaseClient";

export type MessageAuthor = {
  id: string;
  email: string | null;
  full_name: string | null;
};

export interface Message {
  id: string;
  author_id: string;
  content: string;
  attachments: string[];

  project_id: string | null;
  phase_id: string | null;
  lot_id: string | null;

  created_at: string;
  updated_at: string;

  author?: MessageAuthor | null;
}

export async function getMessages(context: { projectId?: string; phaseId?: string; lotId?: string }) {
  let query = supabase
    .from("messages")
    .select("*,author:profiles!messages_author_id_fkey(id,email,full_name)")
    .order("created_at", { ascending: true });

  if (context.projectId) {
    query = query.eq("project_id", context.projectId).is("phase_id", null).is("lot_id", null);
  } else if (context.phaseId) {
    query = query.eq("phase_id", context.phaseId).is("project_id", null).is("lot_id", null);
  } else if (context.lotId) {
    query = query.eq("lot_id", context.lotId).is("project_id", null).is("phase_id", null);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function createMessage(input: {
  content: string;
  attachments?: string[];
  projectId?: string;
  phaseId?: string;
  lotId?: string;
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Non authentifié");

  const payload = {
    author_id: user.id,
    content: input.content,
    attachments: input.attachments ?? [],
    project_id: input.projectId ?? null,
    phase_id: input.phaseId ?? null,
    lot_id: input.lotId ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("messages").insert(payload).select("*").single();
  if (error) throw error;
  return data as Message;
}

export async function updateMessage(messageId: string, content: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Non authentifié");

  const { data, error } = await supabase
    .from("messages")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("author_id", user.id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Message;
}

export async function deleteMessage(messageId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Non authentifié");

  const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("author_id", user.id);
  if (error) throw error;
}

