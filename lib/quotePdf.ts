import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { QuotePreviewData } from "@/lib/quotesStore";
import { calculateTotals, formatPreviewDate } from "@/lib/quotePreview";
import { formatCurrency } from "@/lib/utils";

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

// jsPDF + certaines polices gèrent mal les espaces fines (U+202F) renvoyées par Intl en fr-FR,
// ce qui peut afficher des "/" ou des séparateurs cassés. On force un format simple ASCII.
const formatAmountPdf = (value: number) => {
  const n = Number.isFinite(value) ? value : 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const fixed = abs.toFixed(2); // "1234.50"
  const [intPart, decPart] = fixed.split(".");
  const withGroups = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " "); // "1 234"
  return `${sign}${withGroups},${decPart} €`;
};

export const downloadQuotePdf = (data: QuotePreviewData, title: string) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;

  // Theme
  // Palette alignée sur Tailwind `primary` du site:
  // primary-600 = #1800ad, primary-400 = #38b6ff
  const primary = { r: 24, g: 0, b: 173 }; // #1800ad
  const primaryLight = { r: 56, g: 182, b: 255 }; // #38b6ff
  const ink = { r: 15, g: 23, b: 42 }; // slate-900
  const muted = { r: 71, g: 85, b: 105 }; // slate-600
  const line = { r: 226, g: 232, b: 240 }; // slate-200
  const soft = { r: 248, g: 250, b: 252 }; // slate-50

  const setColor = (c: { r: number; g: number; b: number }) => doc.setTextColor(c.r, c.g, c.b);
  const drawLine = (y: number) => {
    doc.setDrawColor(line.r, line.g, line.b);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
  };
  const rounded = (x: number, y: number, w: number, h: number, r = 10) => {
    doc.roundedRect(x, y, w, h, r, r, "F");
  };

  // Header band
  // Header band (flat, proche de la charte du site)
  doc.setFillColor(primary.r, primary.g, primary.b);
  doc.rect(0, 0, pageWidth, 86, "F");
  // Subtle accent line
  doc.setFillColor(primaryLight.r, primaryLight.g, primaryLight.b);
  doc.rect(0, 84, pageWidth, 2, "F");

  // Brand + Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Artisia", margin, 36);

  doc.setFontSize(26);
  doc.text("DEVIS", margin, 68);

  // Document meta (right)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  const dateLabel = `Date: ${formatPreviewDate(data)}`;
  const safeTitle = (title || "Devis").trim();
  doc.text(dateLabel, pageWidth - margin, 36, { align: "right" });
  doc.text(safeTitle, pageWidth - margin, 54, { align: "right" });

  // Body starts
  let y = 110;

  // Info cards
  const colGap = 16;
  const colW = (pageWidth - margin * 2 - colGap) / 2;
  const leftX = margin;
  const rightX = margin + colW + colGap;
  const cardH = 86;

  doc.setFillColor(soft.r, soft.g, soft.b);
  rounded(leftX, y, colW, cardH, 12);
  rounded(rightX, y, colW, cardH, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setColor(ink);
  doc.text("Projet", leftX + 14, y + 20);
  doc.text("Client", rightX + 14, y + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(muted);
  doc.text(`Libellé: ${data.projectType || "-"}`, leftX + 14, y + 38);
  doc.text(`Entreprise: ${data.companyName || "-"}`, leftX + 14, y + 56);

  doc.text(`Nom: ${data.clientName || "-"}`, rightX + 14, y + 38);
  doc.text(`Email: ${data.clientEmail || "-"}`, rightX + 14, y + 56);

  y += cardH + 18;
  drawLine(y);
  y += 18;

  const body = data.lines.map((line) => {
    const total = line.quantity * line.unitPrice;
    return [
      line.description || "-",
      line.unit || "-",
      String(line.quantity),
      formatAmountPdf(line.unitPrice),
      formatAmountPdf(total),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Description", "Unité", "Qté", "PU HT", "Total HT"]],
    body,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 6,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 1,
    },
    headStyles: {
      fillColor: [primary.r, primary.g, primary.b],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 280 }, // Description
      1: { cellWidth: 70 },  // Unité
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  const totals = calculateTotals(data);

  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 200;
  const boxW = 240;
  const boxH = 86;
  const boxX = pageWidth - margin - boxW;
  let boxY = lastY + 18;
  if (boxY + boxH > pageHeight - 64) boxY = pageHeight - 64 - boxH;

  doc.setFillColor(soft.r, soft.g, soft.b);
  rounded(boxX, boxY, boxW, boxH, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(muted);
  doc.text("Total HT", boxX + 14, boxY + 26);
  doc.text(formatAmountPdf(totals.ht), boxX + boxW - 14, boxY + 26, { align: "right" });
  doc.text("TVA (20%)", boxX + 14, boxY + 46);
  doc.text(formatAmountPdf(totals.tva), boxX + boxW - 14, boxY + 46, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setColor(ink);
  doc.text("Total TTC", boxX + 14, boxY + 70);
  doc.text(formatAmountPdf(totals.ttc), boxX + boxW - 14, boxY + 70, { align: "right" });

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(muted);
  doc.text("Document généré par Artisia — devis non contractuel.", margin, pageHeight - 34);

  const safeFile = sanitizeFileName((safeTitle || "devis").toLowerCase());
  doc.save(`${safeFile}.pdf`);
};
