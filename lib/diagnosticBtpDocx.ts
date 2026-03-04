import * as fs from "node:fs/promises";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

const colors = {
  primaryBlue: "0066CC",
  darkBlue: "004999",
  lightBlue: "E8F4FF",
  darkGray: "2C3E50",
  mediumGray: "7F8C8D",
  lightGray: "F8F9FA",
  warningRed: "E74C3C",
  warningBg: "FFEBEE",
  borderLight: "E0E0E0",
  white: "FFFFFF",
} as const;

const pageSizeA4 = { width: 11906, height: 16838 } as const;
const margins1In = { top: 1440, right: 1440, bottom: 1440, left: 1440 } as const;
const contentWidthDxa = pageSizeA4.width - margins1In.left - margins1In.right;

export type DiagnosticBtpSectionType = "checklist" | "alerte" | "photos";

export type DiagnosticBtpSectionInput = {
  titre: string;
  type: DiagnosticBtpSectionType;
  items: string[];
};

export type DiagnosticBtpDocInput = {
  projet: string;
  date?: string;
  logoPath?: string;
  sections: DiagnosticBtpSectionInput[];
};

function formatDateTimeFr(date: Date): string {
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return formatted.replace(" ", " à ");
}

async function readLogoData(logoPath: string | undefined): Promise<Uint8Array | undefined> {
  const resolved =
    logoPath?.trim().length
      ? path.isAbsolute(logoPath)
        ? logoPath
        : path.join(process.cwd(), logoPath)
      : path.join(process.cwd(), "public", "images", "nextmind.png");

  try {
    const buffer = await fs.readFile(resolved);
    return new Uint8Array(buffer);
  } catch {
    return undefined;
  }
}

function paragraphWithBottomRule(): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        color: colors.primaryBlue,
        size: 48, // 6pt (1/8 pt units)
        space: 1,
        style: BorderStyle.SINGLE,
      },
    },
    spacing: { after: 300 },
    children: [new TextRun({ text: "" })],
  });
}

function sectionHeaderRow(title: string, sectionNumber: number, backgroundColor: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: contentWidthDxa, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: colors.white },
          bottom: { style: BorderStyle.NONE, size: 0, color: colors.white },
          left: { style: BorderStyle.NONE, size: 0, color: colors.white },
          right: { style: BorderStyle.NONE, size: 0, color: colors.white },
        },
        shading: { type: ShadingType.CLEAR, fill: backgroundColor },
        margins: { top: 200, bottom: 200, left: 300, right: 300 },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `${sectionNumber}. ${title.toUpperCase()}`,
                color: colors.white,
                bold: true,
                size: 26, // 13pt
                font: "Calibri",
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function itemRow(opts: {
  sectionType: DiagnosticBtpSectionType;
  itemText: string;
  itemIndex: number;
}): TableRow {
  const { sectionType, itemText, itemIndex } = opts;

  // Alternance de couleurs pour checklist et photos
  // Fond rose pour toutes les alertes
  const isAlternate = itemIndex % 2 === 1;
  const fill =
    sectionType === "alerte"
      ? colors.warningBg
      : isAlternate
        ? colors.lightBlue
        : colors.white;

  // Construire les TextRun pour l'icône/bullet + texte
  const runs: TextRun[] = [];

  if (sectionType === "alerte") {
    runs.push(
      new TextRun({ 
        text: "⚠  ", 
        color: colors.warningRed, 
        size: 32, // 16pt
        font: "Calibri"
      })
    );
  } else if (sectionType === "photos") {
    runs.push(
      new TextRun({ 
        text: "📷  ", 
        size: 28, // 14pt
        font: "Calibri"
      })
    );
  } else {
    // checklist
    runs.push(
      new TextRun({ 
        text: "•  ", 
        color: colors.primaryBlue, 
        bold: true, 
        size: 28, // 14pt
        font: "Calibri"
      })
    );
  }

  runs.push(
    new TextRun({
      text: itemText,
      color: colors.darkGray,
      size: 24, // 12pt
      bold: sectionType === "photos",
      font: "Calibri",
    })
  );

  return new TableRow({
    children: [
      new TableCell({
        width: { size: contentWidthDxa, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: colors.white },
          bottom: { style: BorderStyle.NONE, size: 0, color: colors.white },
          left: { style: BorderStyle.NONE, size: 0, color: colors.white },
          right: { style: BorderStyle.NONE, size: 0, color: colors.white },
        },
        shading: { type: ShadingType.CLEAR, fill },
        margins: { top: 180, bottom: 180, left: 300, right: 300 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            children: runs,
          }),
        ],
      }),
    ],
  });
}

function spacerRow(height: number): TableRow {
  return new TableRow({
    height: { value: height, rule: "exact" },
    children: [
      new TableCell({
        width: { size: contentWidthDxa, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: colors.white },
          bottom: { style: BorderStyle.NONE, size: 0, color: colors.white },
          left: { style: BorderStyle.NONE, size: 0, color: colors.white },
          right: { style: BorderStyle.NONE, size: 0, color: colors.white },
        },
        shading: { type: ShadingType.CLEAR, fill: colors.white },
        children: [new Paragraph({ text: "" })],
      }),
    ],
  });
}

function sectionTable(section: DiagnosticBtpSectionInput, sectionNumber: number): Table {
  const headerFill = section.type === "alerte" ? colors.warningRed : colors.primaryBlue;

  const rows: TableRow[] = [sectionHeaderRow(section.titre, sectionNumber, headerFill)];

  // Ajouter les items avec espacement pour les alertes
  section.items.forEach((itemText, idx) => {
    rows.push(itemRow({ sectionType: section.type, itemText, itemIndex: idx }));
    
    // Ajouter un espacement entre les items d'alerte (sauf après le dernier)
    if (section.type === "alerte" && idx < section.items.length - 1) {
      rows.push(spacerRow(150));
    }
  });

  return new Table({
    width: { size: contentWidthDxa, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: colors.white },
      bottom: { style: BorderStyle.NONE, size: 0, color: colors.white },
      left: { style: BorderStyle.NONE, size: 0, color: colors.white },
      right: { style: BorderStyle.NONE, size: 0, color: colors.white },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: colors.white },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: colors.white },
    },
    rows,
  });
}

function projectInfoTable(projet: string, date: string): Table {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: colors.white };
  const bottomBorder = { style: BorderStyle.SINGLE, size: 6, color: colors.borderLight };

  const labelCell = (text: string) =>
    new TableCell({
      width: { size: 2200, type: WidthType.DXA },
      borders: {
        top: noBorder,
        left: noBorder,
        right: noBorder,
        bottom: bottomBorder,
      },
      shading: { type: ShadingType.CLEAR, fill: colors.white },
      margins: { top: 120, bottom: 120, left: 0, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text.toUpperCase(),
              bold: true,
              color: colors.primaryBlue,
              size: 20, // 10pt
              font: "Calibri",
            }),
          ],
        }),
      ],
    });

  const valueCell = (text: string) =>
    new TableCell({
      width: { size: 6826, type: WidthType.DXA },
      borders: {
        top: noBorder,
        left: noBorder,
        right: noBorder,
        bottom: bottomBorder,
      },
      shading: { type: ShadingType.CLEAR, fill: colors.white },
      margins: { top: 120, bottom: 120, left: 200, right: 0 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              color: colors.darkGray,
              size: 24, // 12pt
              font: "Calibri",
            }),
          ],
        }),
      ],
    });

  return new Table({
    width: { size: contentWidthDxa, type: WidthType.DXA },
    borders: {
      top: noBorder,
      bottom: noBorder,
      left: noBorder,
      right: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
    },
    rows: [
      new TableRow({ children: [labelCell("Projet"), valueCell(projet)] }),
      new TableRow({ children: [labelCell("Date"), valueCell(date)] }),
    ],
  });
}

function footerBlock(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          top: {
            color: colors.borderLight,
            size: 6,
            space: 2,
            style: BorderStyle.SINGLE,
          },
        },
        spacing: { before: 300, after: 100 },
        children: [new TextRun({ text: "" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 150 },
        children: [
          new TextRun({
            text: "Document généré par NEXTMIND",
            bold: true,
            color: colors.primaryBlue,
            size: 20, // 10pt
            font: "Calibri",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "Assistant IA BTP professionnel",
            italics: true,
            color: colors.mediumGray,
            size: 18, // 9pt
            font: "Calibri",
          }),
        ],
      }),
    ],
  });
}

export async function generateDiagnosticBtpDocxBuffer(input: DiagnosticBtpDocInput): Promise<Buffer> {
  const dateText = input.date?.trim().length ? input.date : formatDateTimeFr(new Date());
  const logoData = await readLogoData(input.logoPath);

  const headerChildren: Paragraph[] = [];
  
  // Logo centré
  if (logoData) {
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new ImageRun({
            data: logoData,
            transformation: { width: 250, height: 46 },
          }),
        ],
      }),
    );
  }

  // Sous-titre
  headerChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: "Checklist Diagnostic BTP",
          color: colors.mediumGray,
          size: 24, // 12pt
          font: "Calibri",
        }),
      ],
    }),
  );

  // Ligne de séparation
  headerChildren.push(paragraphWithBottomRule());

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: colors.darkGray },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: margins1In,
            size: pageSizeA4,
          },
        },
        footers: { default: footerBlock() },
        children: [
          ...headerChildren,
          projectInfoTable(input.projet, dateText),
          new Paragraph({ spacing: { after: 400 } }),
          ...input.sections.flatMap((section, idx) => [
            sectionTable(section, idx + 1),
            new Paragraph({ spacing: { after: 350 } }),
          ]),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}