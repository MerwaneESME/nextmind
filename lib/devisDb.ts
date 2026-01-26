import { supabase } from "@/lib/supabaseClient";
import { calculateTotals } from "@/lib/quotePreview";
import type { QuotePreviewData, QuoteSummary } from "@/lib/quotesStore";

const DEVIS_STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DEVIS_BUCKET ?? "devis-pdfs";

type DevisRow = {
  id: string;
  status: string | null;
  total: number | null;
  updated_at: string | null;
  created_at?: string | null;
  metadata: Record<string, unknown> | null;
};

const getMetadata = (row: DevisRow) =>
  row.metadata && typeof row.metadata === "object" ? row.metadata : {};

const buildTitle = (previewData?: QuotePreviewData | null, fallback?: string | null, alt?: string | null) => {
  if (fallback) return fallback;
  if (alt) return alt;
  if (previewData?.clientName) return `Devis ${previewData.clientName}`;
  if (previewData?.projectType) return `Devis ${previewData.projectType}`;
  return "Devis";
};

export const mapDevisRowToSummary = (row: DevisRow): QuoteSummary => {
  const metadata = getMetadata(row);
  let previewData = (metadata.preview_data as QuotePreviewData | undefined) ?? null;
  if (!previewData && Array.isArray(metadata.line_items)) {
    const items = metadata.line_items as Array<Record<string, unknown>>;
    const customer = metadata.customer as Record<string, unknown> | undefined;
    const supplier = metadata.supplier as Record<string, unknown> | undefined;
    const customerName = typeof customer?.name === "string" ? customer.name : "";
    const customerContact = typeof customer?.contact === "string" ? customer.contact : undefined;
    const supplierName = typeof supplier?.name === "string" ? supplier.name : "";
    previewData = {
      projectType: (metadata.project_label as string | undefined) ?? (metadata.doc_type as string | undefined) ?? "",
      clientName: customerName,
      clientEmail: customerContact,
      companyName: supplierName,
      lines: items.map((item, index) => ({
        id: String(index + 1),
        description: String(item.description ?? ""),
        quantity: Number(item.quantity ?? 0),
        unit: String(item.unit ?? ""),
        unitPrice: Number(item.unit_price_ht ?? 0),
      })),
      createdAt: (metadata.date as string | undefined) ?? row.created_at ?? undefined,
    };
  }
  const title = buildTitle(
    previewData,
    (metadata.title as string | undefined) ?? null,
    (metadata.number as string | undefined) ?? null
  );
  const customer = metadata.customer as Record<string, unknown> | undefined;
  const customerName = typeof customer?.name === "string" ? customer.name : null;
  const metadataClientName = typeof metadata.client_name === "string" ? metadata.client_name : null;
  return {
    id: row.id,
    title,
    status: (row.status as QuoteSummary["status"]) ?? "en_etude",
    totalTtc: row.total ?? null,
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    clientName: previewData?.clientName ?? metadataClientName ?? customerName,
    fileUrl:
      (metadata.pdf_url as string | undefined) ??
      (metadata.pdf_data_url as string | undefined) ??
      null,
    fileName: (metadata.file_name as string | undefined) ?? null,
    previewData,
    rawMetadata: metadata,
  };
};

export const fetchDevisForUser = async (userId: string, limit?: number) => {
  let query = supabase
    .from("devis")
    .select("id,status,total,updated_at,created_at,metadata")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const mapped = (data ?? []).map((row) => mapDevisRowToSummary(row as DevisRow));
  const enriched = await Promise.all(
    mapped.map(async (quote) => {
      if (!quote.rawMetadata) return quote;
      const bucket = quote.rawMetadata.pdf_bucket;
      const path = quote.rawMetadata.pdf_path;
      if (typeof bucket !== "string" || typeof path !== "string") return quote;
      try {
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
        return { ...quote, fileUrl: signed?.signedUrl ?? quote.fileUrl };
      } catch {
        return quote;
      }
    })
  );
  return enriched;
};

export const fetchDevisById = async (userId: string, devisId: string) => {
  const { data, error } = await supabase
    .from("devis")
    .select("id,status,total,updated_at,created_at,metadata")
    .eq("id", devisId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return null;

  let mapped = mapDevisRowToSummary(data as DevisRow);
  if (mapped.rawMetadata) {
    const bucket = mapped.rawMetadata.pdf_bucket;
    const path = mapped.rawMetadata.pdf_path;
    if (typeof bucket === "string" && typeof path === "string") {
      try {
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
        mapped = { ...mapped, fileUrl: signed?.signedUrl ?? mapped.fileUrl };
      } catch {
        // keep existing fileUrl
      }
    }
  }

  return mapped;
};

export const findDevisByPreviewId = async (userId: string, previewId: string) => {
  const { data, error } = await supabase
    .from("devis")
    .select("id")
    .eq("user_id", userId)
    .eq("metadata->>preview_id", previewId)
    .limit(1);

  if (error) {
    throw error;
  }

  return data && data.length ? data[0] : null;
};

export const saveDevisFromPreview = async (
  userId: string,
  previewData: QuotePreviewData,
  status: "draft" | "published" | "en_etude" | "envoye" | "valide" | "refuse" = "en_etude",
  previewId?: string
) => {
  const totals = calculateTotals(previewData);
  const title = buildTitle(previewData);
  const metadata = {
    title,
    preview_id: previewId ?? null,
    preview_data: previewData,
    client_name: previewData.clientName ?? null,
    project_type: previewData.projectType ?? null,
    source: "app",
  };

  const { data, error } = await supabase
    .from("devis")
    .insert({
      user_id: userId,
      status,
      metadata,
      total: totals.ttc,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create devis");
  }

  const items = previewData.lines.map((line) => {
    const qty = Number.isFinite(Number(line.quantity)) ? Number(line.quantity) : 0;
    const unitPrice = Number.isFinite(Number(line.unitPrice)) ? Number(line.unitPrice) : 0;
    return {
      devis_id: data.id,
      description: line.description || null,
      qty,
      unit_price: unitPrice,
      total: qty * unitPrice,
    };
  });

  if (items.length) {
    const { error: itemsError } = await supabase.from("devis_items").insert(items);
    if (itemsError) {
      // eslint-disable-next-line no-console
      console.error("Erreur insertion devis_items", itemsError);
      throw itemsError;
    }
  }

  return data.id as string;
};

export const createDevisDraft = async (userId: string, input: { title: string; total?: number | null; clientName?: string | null }) => {
  const metadata = {
    title: input.title,
    client_name: input.clientName ?? null,
    source: "manual",
  };

  const { data, error } = await supabase
    .from("devis")
    .insert({
      user_id: userId,
      status: "en_etude",
      metadata,
      total: input.total ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create devis");
  }

  return data.id as string;
};

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const uploadPdfToStorage = async (userId: string, file: File) => {
  const safeName = sanitizeFileName(file.name);
  const path = `${userId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(DEVIS_STORAGE_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "application/pdf",
  });
  if (error) {
    throw error;
  }
  const { data } = supabase.storage.from(DEVIS_STORAGE_BUCKET).getPublicUrl(path);
  return { bucket: DEVIS_STORAGE_BUCKET, path, publicUrl: data.publicUrl };
};

export const saveUploadedDevis = async (
  userId: string,
  file: File,
  title?: string,
  previewId?: string,
  extra?: { total?: number | null; clientName?: string | null }
) => {
  const upload = await uploadPdfToStorage(userId, file);
  const fallbackTitle = file.name.replace(/\.[^/.]+$/, "") || "Devis publié";
  const resolvedTitle = title ?? fallbackTitle;
  const metadata = {
    title: resolvedTitle,
    client_name: extra?.clientName ?? null,
    pdf_bucket: upload.bucket,
    pdf_path: upload.path,
    pdf_url: upload.publicUrl,
    file_name: file.name,
    preview_id: previewId ?? null,
    source: "upload",
  };

  const { data, error } = await supabase
    .from("devis")
    .insert({
      user_id: userId,
      status: "en_etude",
      metadata,
      total: extra?.total ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create devis");
  }

  return data.id as string;
};

export const attachPdfToDevis = async (userId: string, quote: QuoteSummary, file: File) => {
  const upload = await uploadPdfToStorage(userId, file);
  const base = quote.rawMetadata && typeof quote.rawMetadata === "object" ? quote.rawMetadata : {};
  const status = quote.status || "en_etude";
  const metadata = {
    ...base,
    title: (base.title as string | undefined) ?? quote.title,
    client_name: (base.client_name as string | undefined) ?? quote.clientName ?? null,
    preview_data: (base.preview_data as QuotePreviewData | undefined) ?? quote.previewData ?? null,
    source: (base.source as string | undefined) ?? (quote.previewData ? "app" : "upload"),
    pdf_bucket: upload.bucket,
    pdf_path: upload.path,
    pdf_url: upload.publicUrl,
    file_name: file.name,
  };

  const { error } = await supabase
    .from("devis")
    .update({
      status,
      metadata,
    })
    .eq("id", quote.id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
};

export const deleteDevisWithItems = async (
  userId: string,
  devisId: string,
  storage?: { bucket?: string; path?: string }
) => {
  if (storage?.bucket && storage?.path) {
    try {
      await supabase.storage.from(storage.bucket).remove([storage.path]);
    } catch {
      // ignore storage errors
    }
  }
  await supabase.from("devis_items").delete().eq("devis_id", devisId);
  const { error } = await supabase.from("devis").delete().eq("id", devisId).eq("user_id", userId);
  if (error) {
    throw error;
  }
};
