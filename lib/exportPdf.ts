/**
 * Export PDF – Project Report Generator
 *
 * Generates a professional PDF report for a project using jsPDF + jspdf-autotable.
 * Returns a Blob that can be shown in an iframe or downloaded.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/utils";
import type { LotSummary } from "@/lib/lotsDb";
import type { QuoteSummary } from "@/lib/quotesStore";
import type { ExportAiContent, ExportPresetId } from "@/lib/export-prompt";

type Project = {
  id: string;
  name: string;
  description: string | null;
  project_type: string | null;
  status: string | null;
  address: string | null;
  city: string | null;
  created_at: string | null;
};

type Member = {
  id: string;
  role: string | null;
  status: string | null;
  invited_email: string | null;
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    company_name: string | null;
  } | null;
};

type Task = {
  id: string;
  name: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
};

// ─── Colors ─────────────────────────────────────────────────────────────────
const BLUE_PRIMARY: [number, number, number] = [24, 0, 173]; // #1800ad
const BLUE_LIGHT: [number, number, number] = [56, 182, 255]; // #38b6ff
const GRAY_100: [number, number, number] = [245, 247, 250];
const GRAY_600: [number, number, number] = [75, 85, 99];
const GRAY_900: [number, number, number] = [17, 24, 39];
const TABLE_HEAD_BG: [number, number, number] = [248, 250, 252];
const TABLE_LINE: [number, number, number] = [232, 236, 245];
const GREEN: [number, number, number] = [16, 185, 129];
const AMBER: [number, number, number] = [251, 191, 36];
const SLATE: [number, number, number] = [100, 116, 139];

const PAGE_W = 595.28; // A4 width in pts
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sanitizePdfText(value: string): string {
  return (value ?? "")
    .replace(/\u202F/g, " ") // narrow no-break space (Intl fr-FR thousands sep)
    .replace(/\u00A0/g, " ") // no-break space
    .replace(/\u2007/g, " ") // figure space
    .replace(/\u2009/g, " ") // thin space
    .replace(/\s+/g, " ")
    .trim();
}

function formatCurrencyPdf(amount: number): string {
  return sanitizePdfText(formatCurrency(amount));
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const isoDay = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    // If the backend returns an ISO timestamp, keep the calendar day stable (avoid TZ shifts)
    const date = isoDay ? new Date(`${isoDay[1]}-${isoDay[2]}-${isoDay[3]}T12:00:00.000Z`) : new Date(dateStr);

    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return dateStr;
  }
}

function statusLabel(status: string | null): string {
  switch (status) {
    case "en_cours": return "En cours";
    case "in_progress": return "En cours";
    case "termine": return "Terminé";
    case "completed": return "Terminé";
    case "en_attente": return "En attente";
    case "pending": return "En attente";
    default: return status ?? "—";
  }
}

function statusColor(status: string | null): [number, number, number] {
  switch (status) {
    case "en_cours": return BLUE_LIGHT;
    case "in_progress": return BLUE_LIGHT;
    case "termine": return GREEN;
    case "completed": return GREEN;
    case "en_attente": return AMBER;
    case "pending": return AMBER;
    default: return SLATE;
  }
}

function lotStatusLabel(status: string): string {
  switch (status) {
    case "en_cours": return "En cours";
    case "termine": return "Terminé";
    case "en_attente": return "En attente";
    case "planifie": return "Planifié";
    case "annule": return "Annulé";
    default: return status;
  }
}

/** Wrap text to fit within maxWidth, returns lines */
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(sanitizePdfText(text), maxWidth) as string[];
}

/** Draw section heading with left accent bar */
function drawSectionHeading(doc: jsPDF, y: number, title: string): number {
  const h = 22;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.roundedRect(MARGIN, y, CONTENT_W, h, 8, 8, "FD");

  doc.setFillColor(...BLUE_PRIMARY);
  doc.roundedRect(MARGIN, y, 5, h, 8, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GRAY_900);
  doc.text(sanitizePdfText(title), MARGIN + 14, y + 15);
  return y + h + 14;
}

/** Add a footer to the current page */
function addFooter(doc: jsPDF, pageNum: number, totalPages: number): void {
  const footerY = PAGE_H - 20;
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, footerY - 4, PAGE_W - MARGIN, footerY - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_600);
  doc.text(
    sanitizePdfText(`Généré le ${new Date().toLocaleDateString("fr-FR")} par NextMind`),
    MARGIN,
    footerY + 4
  );
  doc.text(
    `Page ${pageNum} / ${totalPages}`,
    PAGE_W - MARGIN,
    footerY + 4,
    { align: "right" }
  );
}

/** Ensure y doesn't overflow the page — adds a new page if needed */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - 50) {
    doc.addPage();
    return 48;
  }
  return y;
}

async function loadImageDataUrl(path: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
    return dataUrl;
  } catch {
    return null;
  }
}

// ─── Main export function ─────────────────────────────────────────────────────
export async function generateProjectExportPdf(
  project: Project,
  interventions: LotSummary[],
  members: Member[],
  quotes: QuoteSummary[],
  tasks: Task[],
  aiContent: ExportAiContent,
  preset: ExportPresetId
): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // ── HEADER ──────────────────────────────────────────────────────────────────
  // Top accent bars (lightweight, closer to the app UI)
  doc.setFillColor(...BLUE_PRIMARY);
  doc.rect(0, 0, PAGE_W, 8, "F");
  doc.setFillColor(...BLUE_LIGHT);
  doc.rect(0, 8, PAGE_W, 2, "F");

  // Logo (fallback to text)
  const logoDataUrl = await loadImageDataUrl("/images/nextmind.png");
  let logoRendered = false;
  if (logoDataUrl) {
    try {
      const props = (doc as any).getImageProperties?.(logoDataUrl);
      const logoH = 20;
      const ratio = props?.width && props?.height ? props.width / props.height : 4;
      const logoW = Math.max(86, Math.min(150, logoH * ratio));
      doc.addImage(logoDataUrl, "PNG", MARGIN, 18, logoW, logoH);
      logoRendered = true;
    } catch {
      // ignore and fallback to text
    }
  }
  if (!logoRendered) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...BLUE_PRIMARY);
    doc.text("NextMind", MARGIN, 34);
  }

  // Report title + generation date (right aligned)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GRAY_900);
  doc.text(sanitizePdfText(aiContent.report_title), PAGE_W - MARGIN, 30, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_600);
  doc.text(`Généré le ${sanitizePdfText(fmtDate(new Date().toISOString()))}`, PAGE_W - MARGIN, 44, { align: "right" });

  let y = 72;

  // ── PROJECT INFO BOX ─────────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.roundedRect(MARGIN, y, CONTENT_W, 74, 10, 10, "FD");
  // Left accent
  doc.setFillColor(...BLUE_PRIMARY);
  doc.roundedRect(MARGIN, y, 5, 74, 10, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...GRAY_900);
  doc.text(sanitizePdfText(project.name), MARGIN + 18, y + 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_600);
  const infoLine1Parts: string[] = [];
  if (project.project_type) infoLine1Parts.push(project.project_type);
  if (project.address) infoLine1Parts.push(project.address);
  if (project.city) infoLine1Parts.push(project.city);
  doc.text(sanitizePdfText(infoLine1Parts.join("  ·  ")), MARGIN + 18, y + 40);

  // Status badge (colored rectangle)
  const statusText = sanitizePdfText(statusLabel(project.status));
  const statusCol = statusColor(project.status);
  const badgeX = MARGIN + 18;
  const badgeY = y + 50;
  doc.setFillColor(statusCol[0], statusCol[1], statusCol[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const statusTextW = doc.getTextWidth(statusText);
  const badgeW = Math.min(CONTENT_W - 24, Math.max(76, statusTextW + 24));
  doc.roundedRect(badgeX, badgeY, badgeW, 12, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(statusText, badgeX + badgeW / 2, badgeY + 8.5, { align: "center" });

  if (project.created_at) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_600);
    doc.text(sanitizePdfText(`Créé le ${fmtDate(project.created_at)}`), badgeX + badgeW + 10, badgeY + 8.5);
  }

  y += 94;

  // ── EXECUTIVE SUMMARY ────────────────────────────────────────────────────────
  y = ensureSpace(doc, y, 60);
  y = drawSectionHeading(doc, y, "Résumé exécutif");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY_900);
  const summaryLines = wrapText(doc, aiContent.executive_summary, CONTENT_W);
  doc.text(summaryLines, MARGIN, y);
  y += summaryLines.length * 13 + 10;

  // ── KEY POINTS ───────────────────────────────────────────────────────────────
  if (aiContent.key_points?.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = drawSectionHeading(doc, y, "Points clés");

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY_900);
    for (const point of aiContent.key_points) {
      y = ensureSpace(doc, y, 18);
      doc.setFillColor(...BLUE_PRIMARY);
      doc.circle(MARGIN + 4, y - 2, 2, "F");
      const pointLines = wrapText(doc, point, CONTENT_W - 16);
      doc.text(pointLines, MARGIN + 12, y);
      y += pointLines.length * 13 + 4;
    }
    y += 6;
  }

  // ── BUDGET ───────────────────────────────────────────────────────────────────
  const totalEstimated = interventions.reduce((s, i) => s + i.budgetEstimated, 0);
  const totalActual = interventions.reduce((s, i) => s + i.budgetActual, 0);
  const validatedQuotesTotal = quotes
    .filter((q) => q.status === "valide")
    .reduce((s, q) => s + (q.totalTtc ?? 0), 0);

  if (totalEstimated > 0 || totalActual > 0 || aiContent.section_notes?.budget) {
    y = ensureSpace(doc, y, 80);
    y = drawSectionHeading(doc, y, "Budget");

    const budgetRows = [
      ["Budget estimé (lots)", formatCurrencyPdf(totalEstimated)],
      ["Budget réel (lots)", formatCurrencyPdf(totalActual)],
    ];
    if (validatedQuotesTotal > 0) {
      budgetRows.push(["Devis validés (TTC)", formatCurrencyPdf(validatedQuotesTotal)]);
    }
    if (totalEstimated > 0 && totalActual > 0) {
      const diff = totalActual - totalEstimated;
      budgetRows.push([diff >= 0 ? "Écart (dépassement)" : "Écart (économie)", formatCurrencyPdf(Math.abs(diff))]);
    }

    autoTable(doc, {
      startY: y,
      head: [["Indicateur", "Montant"]],
      body: budgetRows.map((r) => [sanitizePdfText(String(r[0])), sanitizePdfText(String(r[1]))]),
      styles: { fontSize: 9, cellPadding: 4, textColor: GRAY_900 },
      headStyles: { fillColor: TABLE_HEAD_BG, textColor: BLUE_PRIMARY, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" } },
      alternateRowStyles: { fillColor: [250, 251, 253] },
      tableLineColor: TABLE_LINE,
      tableLineWidth: 0.5,
      margin: { left: MARGIN, right: MARGIN },
    });

    y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
    y += 8;

    if (aiContent.section_notes?.budget) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...GRAY_600);
      const budgetNoteLines = wrapText(doc, aiContent.section_notes.budget, CONTENT_W);
      doc.text(budgetNoteLines, MARGIN, y);
      y += budgetNoteLines.length * 12 + 8;
    }
  }

  // ── INTERVENTIONS ─────────────────────────────────────────────────────────────
  if (interventions.length > 0) {
    y = ensureSpace(doc, y, 80);
    y = drawSectionHeading(doc, y, "Interventions");

    const intRows = interventions.map((lot) => [
      lot.name,
      lot.lotType ?? "—",
      lot.companyName ?? "—",
      `${Math.round(Number.isFinite(lot.progressPercentage) ? lot.progressPercentage : 0)}%`,
      lotStatusLabel(lot.status),
      `${lot.tasksDone ?? 0}/${lot.tasksTotal ?? 0}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Lot", "Type", "Entreprise", "Avancement", "Statut", "Tâches"]],
      body: intRows.map((r) => r.map((c) => sanitizePdfText(String(c ?? "—")))),
      styles: { fontSize: 8.5, cellPadding: 3.5 },
      headStyles: { fillColor: TABLE_HEAD_BG, textColor: BLUE_PRIMARY, fontStyle: "bold" },
      columnStyles: {
        3: { halign: "center" },
        4: { halign: "center" },
        5: { halign: "center" },
      },
      alternateRowStyles: { fillColor: [250, 251, 253] },
      tableLineColor: TABLE_LINE,
      tableLineWidth: 0.5,
      margin: { left: MARGIN, right: MARGIN },
    });

    y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
    y += 8;

    if (aiContent.section_notes?.interventions) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...GRAY_600);
      const intNoteLines = wrapText(doc, aiContent.section_notes.interventions, CONTENT_W);
      doc.text(intNoteLines, MARGIN, y);
      y += intNoteLines.length * 12 + 8;
    }
  }

  // ── TASKS SUMMARY ─────────────────────────────────────────────────────────────
  if (tasks.length > 0 && (preset === "avancement" || preset === "cloture")) {
    const done = tasks.filter((t) => t.status === "done" || t.status === "termine").length;
    const inProgress = tasks.filter((t) => t.status === "en_cours" || t.status === "in_progress").length;
    const todo = tasks.filter((t) => t.status === "a_faire" || t.status === "todo").length;
    const today = new Date().toISOString().slice(0, 10);
    const late = tasks.filter((t) => t.end_date && t.end_date < today && t.status !== "done" && t.status !== "termine").length;

    y = ensureSpace(doc, y, 80);
    y = drawSectionHeading(doc, y, "Planning & Tâches");

    autoTable(doc, {
      startY: y,
      head: [["Terminées", "En cours", "À faire", "En retard", "Total"]],
      body: [[done, inProgress, todo, late, tasks.length].map(String)],
      styles: { fontSize: 9, cellPadding: 4, halign: "center", textColor: GRAY_900 },
      headStyles: { fillColor: TABLE_HEAD_BG, textColor: BLUE_PRIMARY, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 251, 253] },
      tableLineColor: TABLE_LINE,
      tableLineWidth: 0.5,
      margin: { left: MARGIN, right: MARGIN },
    });

    y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
    y += 8;

    if (aiContent.section_notes?.planning) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...GRAY_600);
      const planLines = wrapText(doc, aiContent.section_notes.planning, CONTENT_W);
      doc.text(planLines, MARGIN, y);
      y += planLines.length * 12 + 8;
    }
  }

  // ── MEMBERS ───────────────────────────────────────────────────────────────────
  if (members.length > 0) {
    y = ensureSpace(doc, y, 60);
    y = drawSectionHeading(doc, y, "Équipe projet");

    const memberRows = members.map((m) => [
      m.user?.full_name ?? m.invited_email ?? "—",
      m.user?.company_name ?? "—",
      m.role ?? "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Nom", "Entreprise", "Rôle"]],
      body: memberRows.map((r) => r.map((c) => sanitizePdfText(String(c ?? "—")))),
      styles: { fontSize: 9, cellPadding: 3.5 },
      headStyles: { fillColor: TABLE_HEAD_BG, textColor: BLUE_PRIMARY, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 251, 253] },
      tableLineColor: TABLE_LINE,
      tableLineWidth: 0.5,
      margin: { left: MARGIN, right: MARGIN },
    });

    y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
    y += 8;

    if (aiContent.section_notes?.members) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...GRAY_600);
      const memLines = wrapText(doc, aiContent.section_notes.members, CONTENT_W);
      doc.text(memLines, MARGIN, y);
      y += memLines.length * 12 + 8;
    }
  }

  // ── RECOMMENDATIONS ───────────────────────────────────────────────────────────
  if (aiContent.recommendations?.length > 0) {
    y = ensureSpace(doc, y, 50);
    y = drawSectionHeading(doc, y, "Recommandations");

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY_900);
    aiContent.recommendations.forEach((rec, idx) => {
      y = ensureSpace(doc, y, 20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLUE_PRIMARY);
      doc.text(`${idx + 1}.`, MARGIN, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY_900);
      const recLines = wrapText(doc, rec, CONTENT_W - 16);
      doc.text(recLines, MARGIN + 14, y);
      y += recLines.length * 13 + 5;
    });
    y += 5;
  }

  // ── CONCLUSION ────────────────────────────────────────────────────────────────
  if (aiContent.conclusion) {
    y = ensureSpace(doc, y, 60);
    y = drawSectionHeading(doc, y, "Conclusion");

    // Light blue background box
    doc.setFillColor(240, 244, 255);
    const conclusionLines = wrapText(doc, aiContent.conclusion, CONTENT_W - 24);
    const boxH = conclusionLines.length * 13 + 20;
    doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 4, 4, "F");
    doc.setFillColor(...BLUE_PRIMARY);
    doc.roundedRect(MARGIN, y, 4, boxH, 2, 2, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...GRAY_900);
    doc.text(conclusionLines, MARGIN + 14, y + 13);
    y += boxH + 16;
  }

  // ── FOOTERS (all pages) ───────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addFooter(doc, p, totalPages);
  }

  return doc.output("blob");
}
