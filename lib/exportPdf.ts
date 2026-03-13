/**
 * Export PDF – Project Report Generator (v2 — professional redesign)
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

// ─── Color palette ───────────────────────────────────────────────────────────
const NAVY: [number, number, number]         = [10, 15, 51];   // deep navy header
const BLUE_PRIMARY: [number, number, number] = [24, 0, 173];   // #1800ad
const BLUE_LIGHT: [number, number, number]   = [56, 182, 255]; // #38b6ff
const BLUE_50: [number, number, number]      = [238, 242, 255];
const GRAY_50: [number, number, number]      = [248, 250, 252];
const GRAY_100: [number, number, number]     = [241, 245, 249];
const GRAY_200: [number, number, number]     = [226, 232, 240];
const GRAY_500: [number, number, number]     = [100, 116, 139];
const GRAY_700: [number, number, number]     = [51, 65, 85];
const GRAY_900: [number, number, number]     = [15, 23, 42];
const WHITE: [number, number, number]        = [255, 255, 255];
const GREEN: [number, number, number]        = [16, 185, 129];
const GREEN_LIGHT: [number, number, number]  = [209, 250, 229];
const AMBER: [number, number, number]        = [245, 158, 11];
const AMBER_LIGHT: [number, number, number]  = [254, 243, 199];
const SLATE: [number, number, number]        = [100, 116, 139];
const SLATE_LIGHT: [number, number, number]  = [241, 245, 249];
const RED: [number, number, number]          = [239, 68, 68];
const RED_LIGHT: [number, number, number]    = [254, 226, 226];

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sanitizePdfText(value: string): string {
  return (value ?? "")
    .replace(/\u202F/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\u2007/g, " ")
    .replace(/\u2009/g, " ")
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
    const date = isoDay
      ? new Date(`${isoDay[1]}-${isoDay[2]}-${isoDay[3]}T12:00:00.000Z`)
      : new Date(dateStr);
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
    }).format(date);
  } catch {
    return dateStr;
  }
}

function statusLabel(status: string | null): string {
  switch (status) {
    case "en_cours": case "in_progress": return "En cours";
    case "termine":  case "completed":   return "Terminé";
    case "en_attente": case "pending":   return "En attente";
    default: return status ?? "—";
  }
}

function lotStatusLabel(status: string): string {
  switch (status) {
    case "en_cours":   return "En cours";
    case "termine":    return "Terminé";
    case "en_attente": return "En attente";
    case "planifie":   return "Planifié";
    case "annule":     return "Annulé";
    default: return status;
  }
}

function statusColors(status: string | null): { fg: [number,number,number]; bg: [number,number,number] } {
  switch (status) {
    case "en_cours": case "in_progress": return { fg: BLUE_PRIMARY, bg: BLUE_50 };
    case "termine":  case "completed":   return { fg: [5, 150, 105], bg: GREEN_LIGHT };
    case "en_attente": case "pending":   return { fg: [146, 64, 14], bg: AMBER_LIGHT };
    default: return { fg: GRAY_700, bg: GRAY_100 };
  }
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(sanitizePdfText(text), maxWidth) as string[];
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - 60) {
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
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.onload  = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Design primitives ───────────────────────────────────────────────────────

/** Section heading: colored label + decorative line */
function drawSectionHeading(doc: jsPDF, y: number, title: string, sectionIndex?: number): number {
  // Accent square bullet
  doc.setFillColor(...BLUE_PRIMARY);
  doc.roundedRect(MARGIN, y, 4, 14, 1, 1, "F");

  // Optional section number
  if (sectionIndex !== undefined) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...BLUE_LIGHT);
    doc.text(`0${sectionIndex}`, MARGIN + 9, y + 10);
  }

  // Section title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GRAY_900);
  const textX = sectionIndex !== undefined ? MARGIN + 24 : MARGIN + 9;
  doc.text(sanitizePdfText(title.toUpperCase()), textX, y + 10);

  // Full-width separator line
  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 18, PAGE_W - MARGIN, y + 18);

  return y + 28;
}

/** Italic note below a section */
function drawNote(doc: jsPDF, y: number, text: string): number {
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY_500);
  const lines = wrapText(doc, text, CONTENT_W);
  doc.text(lines, MARGIN, y);
  return y + lines.length * 11 + 8;
}

/** Footer for each page */
function addFooter(doc: jsPDF, pageNum: number, totalPages: number, projectName: string): void {
  const fy = PAGE_H - 22;
  // Separator
  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, fy - 6, PAGE_W - MARGIN, fy - 6);

  // Left: brand + project
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...BLUE_PRIMARY);
  doc.text("NextMind", MARGIN, fy + 4);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY_500);
  doc.text(
    `  ·  ${sanitizePdfText(projectName)}  ·  Généré le ${new Date().toLocaleDateString("fr-FR")}`,
    MARGIN + doc.getTextWidth("NextMind"),
    fy + 4
  );

  // Right: page number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY_700);
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN, fy + 4, { align: "right" });
}

/** KPI card — small stat box */
function drawKpiCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  value: string, label: string,
  accentColor: [number, number, number]
): void {
  // Card background
  doc.setFillColor(...GRAY_50);
  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, w, h, 4, 4, "FD");

  // Top accent line
  doc.setFillColor(...accentColor);
  doc.roundedRect(x, y, w, 3, 2, 2, "F");

  // Value
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...accentColor);
  doc.text(sanitizePdfText(value), x + w / 2, y + 22, { align: "center" });

  // Label
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY_500);
  doc.text(sanitizePdfText(label), x + w / 2, y + 35, { align: "center" });
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

  // ── COVER HEADER ─────────────────────────────────────────────────────────────
  const HEADER_H = 110;

  // Dark navy background
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");

  // Bottom accent gradient bar
  doc.setFillColor(...BLUE_PRIMARY);
  doc.rect(0, HEADER_H, PAGE_W, 4, "F");
  doc.setFillColor(...BLUE_LIGHT);
  doc.rect(0, HEADER_H + 4, PAGE_W, 2, "F");

  // Logo
  const logoDataUrl = await loadImageDataUrl("/images/nextmind.png");
  let logoRendered = false;
  if (logoDataUrl) {
    try {
      const props = (doc as any).getImageProperties?.(logoDataUrl);
      const logoH = 22;
      const ratio = props?.width && props?.height ? props.width / props.height : 4;
      const logoW = Math.max(90, Math.min(160, logoH * ratio));
      doc.addImage(logoDataUrl, "PNG", MARGIN, 22, logoW, logoH);
      logoRendered = true;
    } catch { /* ignore */ }
  }
  if (!logoRendered) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...WHITE);
    doc.text("NextMind", MARGIN, 42);
  }

  // Preset type label (top right, small caps style)
  const presetLabels: Record<string, string> = {
    resume: "RÉSUMÉ DE PROJET",
    avancement: "RAPPORT D'AVANCEMENT",
    cloture: "RAPPORT DE CLÔTURE",
  };
  const presetLabel = presetLabels[preset] ?? "RAPPORT";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...BLUE_LIGHT);
  doc.text(sanitizePdfText(presetLabel), PAGE_W - MARGIN, 26, { align: "right" });

  // Report title (right-aligned, white, bold)
  const titleLines = wrapText(doc, aiContent.report_title, CONTENT_W * 0.55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  titleLines.forEach((line, i) => {
    doc.text(sanitizePdfText(line), PAGE_W - MARGIN, 46 + i * 16, { align: "right" });
  });

  // Generation date (right, subtle)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 220);
  doc.text(`Généré le ${fmtDate(new Date().toISOString())}`, PAGE_W - MARGIN, 46 + titleLines.length * 16 + 10, { align: "right" });

  let y = HEADER_H + 22;

  // ── PROJECT INFO HERO ────────────────────────────────────────────────────────
  const heroH = 68;
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(1);
  doc.roundedRect(MARGIN, y, CONTENT_W, heroH, 6, 6, "FD");

  // Left colored accent
  const sc = statusColors(project.status);
  doc.setFillColor(...sc.fg);
  doc.roundedRect(MARGIN, y, 5, heroH, 6, 6, "F");

  // Project name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...GRAY_900);
  doc.text(sanitizePdfText(project.name), MARGIN + 18, y + 22);

  // Info line
  const infoParts: string[] = [];
  if (project.project_type) infoParts.push(project.project_type);
  if (project.address) infoParts.push(project.address);
  if (project.city) infoParts.push(project.city);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_500);
  doc.text(sanitizePdfText(infoParts.join("  ·  ")), MARGIN + 18, y + 38);

  // Status badge (right side)
  const statusText = sanitizePdfText(statusLabel(project.status));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const badgeW = doc.getTextWidth(statusText) + 20;
  const badgeX = PAGE_W - MARGIN - badgeW - 4;
  const badgeY = y + 12;
  doc.setFillColor(...sc.bg);
  doc.roundedRect(badgeX, badgeY, badgeW, 14, 4, 4, "F");
  doc.setTextColor(...sc.fg);
  doc.text(statusText, badgeX + badgeW / 2, badgeY + 9.5, { align: "center" });

  // Created date
  if (project.created_at) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY_500);
    doc.text(`Créé le ${fmtDate(project.created_at)}`, badgeX + badgeW / 2, badgeY + 26, { align: "center" });
  }

  y += heroH + 22;

  // ── EXECUTIVE SUMMARY ────────────────────────────────────────────────────────
  y = ensureSpace(doc, y, 60);
  y = drawSectionHeading(doc, y, "Résumé exécutif", 1);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY_700);
  const summaryLines = wrapText(doc, aiContent.executive_summary, CONTENT_W);
  doc.text(summaryLines, MARGIN, y);
  y += summaryLines.length * 14 + 16;

  // ── KEY POINTS — KPI GRID ────────────────────────────────────────────────────
  if (aiContent.key_points?.length > 0) {
    y = ensureSpace(doc, y, 90);
    y = drawSectionHeading(doc, y, "Points clés", 2);

    const kpiH = 44;
    const cols = Math.min(aiContent.key_points.length, 3);
    const gap = 8;
    const kpiW = (CONTENT_W - gap * (cols - 1)) / cols;

    const kpiColors: [number,number,number][] = [
      BLUE_PRIMARY, [16, 185, 129], [245, 158, 11], [99, 102, 241], [239, 68, 68], SLATE,
    ];

    const rows = Math.ceil(aiContent.key_points.length / cols);
    for (let row = 0; row < rows; row++) {
      y = ensureSpace(doc, y, kpiH + 10);
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        if (idx >= aiContent.key_points.length) break;
        const rawPoint = aiContent.key_points[idx];
        // Parse "Label : Value" or "Label : —"
        const colonIdx = rawPoint.indexOf(":");
        const label = colonIdx > -1 ? rawPoint.slice(0, colonIdx).trim() : rawPoint;
        const value = colonIdx > -1 ? rawPoint.slice(colonIdx + 1).trim() : "—";
        const kx = MARGIN + col * (kpiW + gap);
        drawKpiCard(doc, kx, y, kpiW, kpiH, value, label, kpiColors[idx % kpiColors.length]);
      }
      y += kpiH + gap;
    }
    y += 8;
  }

  // ── BUDGET ───────────────────────────────────────────────────────────────────
  const totalEstimated = interventions.reduce((s, i) => s + i.budgetEstimated, 0);
  const totalActual    = interventions.reduce((s, i) => s + i.budgetActual, 0);
  const validatedQuotesTotal = quotes
    .filter((q) => q.status === "valide")
    .reduce((s, q) => s + (q.totalTtc ?? 0), 0);

  if (totalEstimated > 0 || totalActual > 0 || validatedQuotesTotal > 0 || aiContent.section_notes?.budget) {
    y = ensureSpace(doc, y, 90);
    y = drawSectionHeading(doc, y, "Budget", 3);

    const budgetRows: string[][] = [];
    if (totalEstimated > 0) budgetRows.push(["Budget estimé (interventions)", formatCurrencyPdf(totalEstimated)]);
    if (totalActual > 0)    budgetRows.push(["Budget réel (interventions)",   formatCurrencyPdf(totalActual)]);
    if (validatedQuotesTotal > 0) budgetRows.push(["Devis validés (TTC)", formatCurrencyPdf(validatedQuotesTotal)]);
    if (totalEstimated > 0 && totalActual > 0) {
      const diff = totalActual - totalEstimated;
      budgetRows.push([diff >= 0 ? "Écart (dépassement)" : "Écart (économie)", formatCurrencyPdf(Math.abs(diff))]);
    }

    if (budgetRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Indicateur", "Montant"]],
        body: budgetRows.map((r) => r.map((c) => sanitizePdfText(c))),
        styles: { fontSize: 9, cellPadding: 5, textColor: GRAY_900, lineColor: GRAY_200, lineWidth: 0.4 },
        headStyles: { fillColor: BLUE_PRIMARY, textColor: WHITE, fontStyle: "bold", fontSize: 9 },
        columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
        alternateRowStyles: { fillColor: GRAY_50 },
        margin: { left: MARGIN, right: MARGIN },
      });
      y = (doc as any).lastAutoTable?.finalY ?? y + 40;
      y += 8;
    }

    if (aiContent.section_notes?.budget) {
      y = drawNote(doc, y, aiContent.section_notes.budget);
    }
  }

  // ── INTERVENTIONS ────────────────────────────────────────────────────────────
  if (interventions.length > 0) {
    y = ensureSpace(doc, y, 90);
    y = drawSectionHeading(doc, y, "Interventions", 4);

    const intRows = interventions.map((lot) => [
      lot.name,
      lot.lotType ?? "—",
      lot.companyName ?? "—",
      `${Math.round(Number.isFinite(lot.progressPercentage) ? lot.progressPercentage : 0)}%`,
      lotStatusLabel(lot.status),
      `${lot.tasksDone ?? 0} / ${lot.tasksTotal ?? 0}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Intervention", "Type", "Entreprise", "Avancement", "Statut", "Tâches"]],
      body: intRows.map((r) => r.map((c) => sanitizePdfText(String(c ?? "—")))),
      styles: { fontSize: 8.5, cellPadding: 5, textColor: GRAY_900, lineColor: GRAY_200, lineWidth: 0.4 },
      headStyles: { fillColor: BLUE_PRIMARY, textColor: WHITE, fontStyle: "bold", fontSize: 9 },
      columnStyles: {
        0: { cellWidth: "auto" },
        3: { halign: "center", fontStyle: "bold" },
        4: { halign: "center" },
        5: { halign: "center" },
      },
      alternateRowStyles: { fillColor: GRAY_50 },
      margin: { left: MARGIN, right: MARGIN },
      didParseCell: (data) => {
        // Color status cells
        if (data.section === "body" && data.column.index === 4) {
          const statusVal = interventions[data.row.index]?.status ?? "";
          const c = statusColors(statusVal);
          data.cell.styles.textColor = c.fg;
          data.cell.styles.fillColor = c.bg;
          data.cell.styles.fontStyle = "bold";
        }
        // Color progress cells
        if (data.section === "body" && data.column.index === 3) {
          const pct = interventions[data.row.index]?.progressPercentage ?? 0;
          if (pct >= 100) data.cell.styles.textColor = [5, 150, 105];
          else if (pct > 0) data.cell.styles.textColor = BLUE_PRIMARY;
          else data.cell.styles.textColor = GRAY_500;
        }
      },
    });

    y = (doc as any).lastAutoTable?.finalY ?? y + 40;
    y += 8;

    if (aiContent.section_notes?.interventions) {
      y = drawNote(doc, y, aiContent.section_notes.interventions);
    }
  }

  // ── PLANNING & TÂCHES ────────────────────────────────────────────────────────
  if (tasks.length > 0 && (preset === "avancement" || preset === "cloture")) {
    const done       = tasks.filter((t) => t.status === "done" || t.status === "termine").length;
    const inProgress = tasks.filter((t) => t.status === "en_cours" || t.status === "in_progress").length;
    const todo       = tasks.filter((t) => t.status === "a_faire" || t.status === "todo").length;
    const today      = new Date().toISOString().slice(0, 10);
    const late       = tasks.filter((t) =>
      t.end_date && t.end_date < today && t.status !== "done" && t.status !== "termine"
    ).length;

    y = ensureSpace(doc, y, 90);
    y = drawSectionHeading(doc, y, "Planning & Tâches", 5);

    autoTable(doc, {
      startY: y,
      head: [["✓ Terminées", "⏳ En cours", "○ À faire", "⚠ En retard", "Total"]],
      body: [[done, inProgress, todo, late, tasks.length].map(String)],
      styles: {
        fontSize: 9, cellPadding: 7, halign: "center",
        textColor: GRAY_900, lineColor: GRAY_200, lineWidth: 0.4,
      },
      headStyles: { fillColor: BLUE_PRIMARY, textColor: WHITE, fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: GRAY_50 },
      margin: { left: MARGIN, right: MARGIN },
      didParseCell: (data) => {
        if (data.section === "body") {
          if (data.column.index === 0) { data.cell.styles.textColor = [5, 150, 105]; data.cell.styles.fontStyle = "bold"; }
          if (data.column.index === 1) { data.cell.styles.textColor = BLUE_PRIMARY; data.cell.styles.fontStyle = "bold"; }
          if (data.column.index === 3 && late > 0) { data.cell.styles.textColor = RED; data.cell.styles.fontStyle = "bold"; }
        }
      },
    });

    y = (doc as any).lastAutoTable?.finalY ?? y + 40;
    y += 8;

    if (aiContent.section_notes?.planning) {
      y = drawNote(doc, y, aiContent.section_notes.planning);
    }
  }

  // ── ÉQUIPE PROJET ────────────────────────────────────────────────────────────
  if (members.length > 0) {
    y = ensureSpace(doc, y, 80);
    y = drawSectionHeading(doc, y, "Équipe projet", 6);

    const memberRows = members.map((m) => [
      m.user?.full_name ?? m.invited_email ?? "—",
      m.user?.company_name ?? "—",
      m.role ?? "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Nom", "Entreprise", "Rôle"]],
      body: memberRows.map((r) => r.map((c) => sanitizePdfText(String(c ?? "—")))),
      styles: { fontSize: 9, cellPadding: 5, textColor: GRAY_900, lineColor: GRAY_200, lineWidth: 0.4 },
      headStyles: { fillColor: BLUE_PRIMARY, textColor: WHITE, fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: GRAY_50 },
      margin: { left: MARGIN, right: MARGIN },
    });

    y = (doc as any).lastAutoTable?.finalY ?? y + 40;
    y += 8;

    if (aiContent.section_notes?.members) {
      y = drawNote(doc, y, aiContent.section_notes.members);
    }
  }

  // ── RECOMMANDATIONS ──────────────────────────────────────────────────────────
  if (aiContent.recommendations?.length > 0) {
    y = ensureSpace(doc, y, 60);
    y = drawSectionHeading(doc, y, "Recommandations", 7);

    aiContent.recommendations.forEach((rec, idx) => {
      y = ensureSpace(doc, y, 30);
      // Numbered circle
      const circleX = MARGIN + 8;
      const circleY = y + 2;
      doc.setFillColor(...BLUE_PRIMARY);
      doc.circle(circleX, circleY, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...WHITE);
      doc.text(String(idx + 1), circleX, circleY + 2.5, { align: "center" });

      // Recommendation text
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...GRAY_700);
      const recLines = wrapText(doc, rec, CONTENT_W - 24);
      doc.text(recLines, MARGIN + 20, y);
      y += recLines.length * 14 + 8;
    });
    y += 4;
  }

  // ── CONCLUSION ───────────────────────────────────────────────────────────────
  if (aiContent.conclusion) {
    y = ensureSpace(doc, y, 80);
    y = drawSectionHeading(doc, y, "Conclusion", 8);

    const conclusionLines = wrapText(doc, aiContent.conclusion, CONTENT_W - 28);
    const boxH = conclusionLines.length * 14 + 24;

    // Blue-tinted background card
    doc.setFillColor(...BLUE_50);
    doc.setDrawColor(...BLUE_LIGHT);
    doc.setLineWidth(0.8);
    doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 6, 6, "FD");

    // Bold left stripe
    doc.setFillColor(...BLUE_PRIMARY);
    doc.roundedRect(MARGIN, y, 5, boxH, 4, 4, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...GRAY_700);
    doc.text(conclusionLines, MARGIN + 18, y + 15);
    y += boxH + 20;
  }

  // ── FOOTERS (all pages) ───────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addFooter(doc, p, totalPages, project.name);
  }

  return doc.output("blob");
}
