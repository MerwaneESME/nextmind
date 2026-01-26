import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { QuotePreviewData } from "@/lib/quotesStore";
import { calculateTotals, formatPreviewDate } from "@/lib/quotePreview";

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const formatAmount = (value: number) => `${value.toFixed(2)} EUR`;

export const downloadQuotePdf = (data: QuotePreviewData, title: string) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Devis", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 18;
  doc.text(`Date: ${formatPreviewDate(data)}`, margin, y);
  y += 12;
  doc.text(`Projet: ${data.projectType || "-"}`, margin, y);
  y += 12;
  doc.text(`Entreprise: ${data.companyName || "-"}`, margin, y);
  y += 12;
  doc.text(`Client: ${data.clientName || "-"}`, margin, y);
  if (data.clientEmail) {
    y += 12;
    doc.text(`Email: ${data.clientEmail}`, margin, y);
  }

  const body = data.lines.map((line) => {
    const total = line.quantity * line.unitPrice;
    return [
      line.description || "-",
      line.unit || "-",
      String(line.quantity),
      formatAmount(line.unitPrice),
      formatAmount(total),
    ];
  });

  autoTable(doc, {
    startY: y + 16,
    head: [["Description", "Unite", "Qte", "PU HT", "Total HT"]],
    body,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [245, 245, 245], textColor: [55, 65, 81] },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  const totals = calculateTotals(data);
  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 32;
  const totalsY = lastY + 20;
  const rightX = pageWidth - margin;
  const labelX = rightX - 160;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Total HT", labelX, totalsY);
  doc.text(formatAmount(totals.ht), rightX, totalsY, { align: "right" });
  doc.text("TVA (20%)", labelX, totalsY + 14);
  doc.text(formatAmount(totals.tva), rightX, totalsY + 14, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text("Total TTC", labelX, totalsY + 30);
  doc.text(formatAmount(totals.ttc), rightX, totalsY + 30, { align: "right" });

  const safeTitle = sanitizeFileName(title || "devis");
  doc.save(`${safeTitle}.pdf`);
};
