import path from "node:path";

import { generateDiagnosticBtpDocxBuffer, type DiagnosticBtpDocInput } from "@/lib/diagnosticBtpDocx";

export const runtime = "nodejs";

function sanitizeProjetForFilename(projet: string): string {
  return projet
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-À-ÿ_]/g, "");
}

function dateToFilenamePart(dateText: string): string {
  const firstPart = dateText.trim().split(" ")[0] ?? "";
  return firstPart.replace(/\//g, "-");
}

function resolveSafeLogoPath(logoPath: unknown): string | undefined {
  if (typeof logoPath !== "string") return undefined;
  const trimmed = logoPath.trim();
  if (!trimmed) return undefined;

  if (path.isAbsolute(trimmed)) return undefined;

  const normalized = path.posix.normalize(trimmed.replaceAll("\\", "/"));
  if (normalized.startsWith("..")) return undefined;

  return normalized;
}

export async function POST(req: Request): Promise<Response> {
  let payload: DiagnosticBtpDocInput;
  try {
    payload = (await req.json()) as DiagnosticBtpDocInput;
  } catch {
    return Response.json({ error: "JSON invalide." }, { status: 400 });
  }

  if (!payload?.projet?.trim()) {
    return Response.json({ error: "Le champ 'projet' est requis." }, { status: 400 });
  }

  if (!Array.isArray(payload.sections) || payload.sections.length === 0) {
    return Response.json({ error: "Le champ 'sections' est requis." }, { status: 400 });
  }

  const safeLogoPath = resolveSafeLogoPath(payload.logoPath);
  const dateText = payload.date?.trim().length ? payload.date : "";
  const filename = `Diagnostic_BTP_${sanitizeProjetForFilename(payload.projet)}_${
    dateText ? dateToFilenamePart(dateText) : ""
  }`.replace(/_+$/, "");

  try {
    const buffer = await generateDiagnosticBtpDocxBuffer({
      ...payload,
      logoPath: safeLogoPath,
    });

    const view = new Uint8Array(buffer);
    const safeArrayBuffer = new ArrayBuffer(view.byteLength);
    new Uint8Array(safeArrayBuffer).set(view);

    return new Response(safeArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return Response.json({ error: message }, { status: 500 });
  }
}

