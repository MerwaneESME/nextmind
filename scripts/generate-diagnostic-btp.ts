import * as fs from "node:fs/promises";
import path from "node:path";

import {
  generateDiagnosticBtpDocxBuffer,
  type DiagnosticBtpDocInput,
} from "../lib/diagnosticBtpDocx";

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i] ?? "";
    if (!token.startsWith("--")) continue;
    const [key, inlineValue] = token.slice(2).split("=", 2);
    if (!key) continue;
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function defaultInput(): DiagnosticBtpDocInput {
  return {
    projet: "Rénovation Immeuble Haussmann",
    logoPath: "public/images/nextmind.png",
    sections: [
      {
        titre: "Points de contrôle prioritaires",
        type: "checklist",
        items: ["Inspection visuelle", "Mesures précises", "Photos", "État du support"],
      },
      {
        titre: "Signaux d'alerte",
        type: "alerte",
        items: ["Consulter un pro si doute", "Ne pas intervenir si risque structurel"],
      },
      {
        titre: "Photos à prendre",
        type: "photos",
        items: ["Vue d'ensemble", "Détails des points problématiques"],
      },
    ],
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const inputPath = typeof args.input === "string" ? args.input : undefined;
  const outPath = typeof args.out === "string" ? args.out : undefined;

  const input: DiagnosticBtpDocInput = inputPath
    ? (JSON.parse(await fs.readFile(inputPath, "utf-8")) as DiagnosticBtpDocInput)
    : defaultInput();

  const buffer = await generateDiagnosticBtpDocxBuffer(input);

  const datePart = (input.date ?? "").trim().split(" ")[0]?.replace(/\//g, "-") ?? "";
  const safeProjet = input.projet.trim().replace(/\s+/g, "_");
  const fileName =
    outPath ??
    path.join(
      process.cwd(),
      `Diagnostic_BTP_${safeProjet}${datePart ? `_${datePart}` : ""}.docx`,
    );

  await fs.writeFile(fileName, buffer);
  // eslint-disable-next-line no-console
  console.log(`✅ Document créé : ${fileName}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
