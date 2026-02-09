import { supabase } from "@/lib/supabaseClient";

export type InvoiceStatus = "emise" | "validee" | "payee" | "contestee";

export interface Invoice {
  id: string;
  lot_id: string;
  quote_id: string | null;
  invoice_number: string | null;
  title: string;
  amount: number;
  status: InvoiceStatus | string;
  file_url: string | null;
  issued_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  created_at: string;
  updated_at: string;
}

export async function getInvoices(lotId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("lot_id", lotId)
    .order("issued_date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Invoice[];
}

export async function createInvoice(input: {
  lotId: string;
  quoteId?: string | null;
  invoiceNumber?: string | null;
  title: string;
  amount: number;
  status?: InvoiceStatus;
  fileUrl?: string | null;
  issuedDate?: string | null;
  dueDate?: string | null;
}) {
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      lot_id: input.lotId,
      quote_id: input.quoteId ?? null,
      invoice_number: input.invoiceNumber?.trim() || null,
      title: input.title.trim(),
      amount: input.amount,
      status: input.status ?? "emise",
      file_url: input.fileUrl ?? null,
      issued_date: input.issuedDate ?? null,
      due_date: input.dueDate ?? null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Invoice;
}

export async function markInvoicePaid(invoiceId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .update({
      status: "payee",
      paid_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Invoice;
}

