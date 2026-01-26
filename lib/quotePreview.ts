import type { QuotePreviewData } from "@/lib/quotesStore";

type QuoteTotals = { ht: number; tva: number; ttc: number };

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const calculateTotals = (data: QuotePreviewData): QuoteTotals => {
  const totalHT = data.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const totalTVA = totalHT * 0.2;
  return { ht: totalHT, tva: totalTVA, ttc: totalHT + totalTVA };
};

export const formatPreviewDate = (data: QuotePreviewData) => {
  if (!data.createdAt) return new Date().toISOString().slice(0, 10);
  const date = new Date(data.createdAt);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
};

export const printPreviewData = (data: QuotePreviewData, title: string) => {
  const totals = calculateTotals(data);
  const formattedDate = formatPreviewDate(data);
  const rows = data.lines
    .map((line) => {
      const lineTotal = line.quantity * line.unitPrice;
      return `<tr>
        <td>${escapeHtml(line.description || "-")}</td>
        <td>${escapeHtml(line.unit || "-")}</td>
        <td style="text-align:right;">${line.quantity}</td>
        <td style="text-align:right;">${line.unitPrice.toFixed(2)} EUR</td>
        <td style="text-align:right;">${lineTotal.toFixed(2)} EUR</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title || "Devis")}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      .meta { color: #475569; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
      th, td { border: 1px solid #e2e8f0; padding: 8px; }
      th { background: #f8fafc; text-align: left; }
      .totals { margin-top: 16px; width: 280px; margin-left: auto; font-size: 12px; }
      .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
      .totals .grand { font-weight: bold; border-top: 1px solid #e2e8f0; padding-top: 6px; }
    </style>
  </head>
  <body>
    <h1>Devis</h1>
    <div class="meta">Date: ${escapeHtml(formattedDate)}</div>
    <div class="meta">Projet: ${escapeHtml(data.projectType || "-")}</div>
    <div class="meta">Entreprise: ${escapeHtml(data.companyName || "-")}</div>
    <div class="meta">Client: ${escapeHtml(data.clientName || "-")}</div>
    ${data.clientEmail ? `<div class="meta">Email: ${escapeHtml(data.clientEmail)}</div>` : ""}
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Unite</th>
          <th style="text-align:right;">Qte</th>
          <th style="text-align:right;">PU HT</th>
          <th style="text-align:right;">Total HT</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <div class="totals">
      <div><span>Total HT</span><span>${totals.ht.toFixed(2)} EUR</span></div>
      <div><span>TVA (20%)</span><span>${totals.tva.toFixed(2)} EUR</span></div>
      <div class="grand"><span>Total TTC</span><span>${totals.ttc.toFixed(2)} EUR</span></div>
    </div>
  </body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 100);
};
