import { supabase } from "@/lib/supabaseClient";

export type QuoteStatus = "en_attente" | "valide" | "refuse";

export interface Quote {
  id: string;
  lot_id: string;
  quote_number: string | null;
  title: string;
  amount: number;
  status: QuoteStatus | string;
  file_url: string | null;
  issued_date: string | null;
  valid_until: string | null;
  validated_at: string | null;
  validated_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getQuotes(lotId: string) {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("lot_id", lotId)
    .order("issued_date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Quote[];
}

export async function getQuotesForLots(lotIds: string[]) {
  const filtered = lotIds.filter(Boolean);
  if (filtered.length === 0) return [] as Quote[];
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .in("lot_id", filtered)
    .order("issued_date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Quote[];
}

export async function createQuote(input: {
  lotId: string;
  quoteNumber?: string | null;
  title: string;
  amount: number;
  status?: QuoteStatus;
  fileUrl?: string | null;
  issuedDate?: string | null;
  validUntil?: string | null;
}) {
  const { data, error } = await supabase
    .from("quotes")
    .insert({
      lot_id: input.lotId,
      quote_number: input.quoteNumber?.trim() || null,
      title: input.title.trim(),
      amount: input.amount,
      status: input.status ?? "en_attente",
      file_url: input.fileUrl ?? null,
      issued_date: input.issuedDate ?? null,
      valid_until: input.validUntil ?? null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Quote;
}

export async function validateQuote(quoteId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data, error } = await supabase
    .from("quotes")
    .update({
      status: "valide",
      validated_at: new Date().toISOString(),
      validated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Quote;
}

export async function refuseQuote(quoteId: string) {
  const { data, error } = await supabase
    .from("quotes")
    .update({ status: "refuse", updated_at: new Date().toISOString() })
    .eq("id", quoteId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Quote;
}
