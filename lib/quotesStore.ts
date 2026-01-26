export type QuoteStatus = "draft" | "published" | "en_etude" | "valide" | "refuse" | "envoye";

export type QuotePreviewLine = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type QuotePreviewData = {
  projectType: string;
  clientName: string;
  clientEmail?: string;
  companyName: string;
  lines: QuotePreviewLine[];
  createdAt?: string;
};

export type QuoteSummary = {
  id: string;
  title: string;
  status: QuoteStatus;
  totalTtc?: number | null;
  updatedAt: string;
  clientName?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  previewData?: QuotePreviewData | null;
  rawMetadata?: Record<string, unknown> | null;
};
