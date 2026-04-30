import path from "node:path";
import fs from "node:fs/promises";
import type { Converter } from "../types.js";
import { findExecutable } from "../tooling.js";
import { execLogged } from "../exec.js";

// LibreOffice can convert many office formats; we keep a conservative set.
const OFFICE = new Set(["docx", "odt", "pptx", "xlsx", "rtf", "txt", "html"]);

export const libreofficeConverter: Converter = {
  id: "libreoffice",
  label: "LibreOffice",
  description: "Office document conversion via `soffice --headless`.",
  availability: async () => {
    const soffice = await findExecutable(["soffice", "libreoffice"]);
    if (!soffice) return { ok: false, reason: "Executable `soffice` not found in PATH" };
    return { ok: true, executables: { soffice } };
  },
  supports: (from, to) => {
    if (!OFFICE.has(from)) return false;
    if (from === to) return false;
    // Most common: office -> pdf, and sometimes -> txt/html
    return ["pdf", "txt", "html"].includes(to);
  },
  convert: async ({ inputPath, originalFilename, to, outputDir, ctx }) => {
    const soffice = await findExecutable(["soffice", "libreoffice"]);
    if (!soffice) throw new Error("LibreOffice not available (`soffice` not found)");

    // LibreOffice writes into outdir with same basename.
    const argv = [
      "--headless",
      "--nologo",
      "--nolockcheck",
      "--nodefault",
      "--nofirststartwizard",
      "--convert-to",
      to,
      "--outdir",
      outputDir,
      inputPath
    ];

    const { code } = await execLogged({ cmd: soffice, argv, signal: ctx.signal, log: ctx.log });
    if (code !== 0) throw new Error(`LibreOffice failed with exit code ${code}`);

    const expected = path.join(outputDir, `${path.parse(originalFilename).name}.${to}`);
    const outputPath = await locateConvertedFile(outputDir, to, expected);
    const outputFilename = path.basename(outputPath);
    return { outputPath, outputFilename };
  }
};

async function locateConvertedFile(outputDir: string, to: string, expected: string) {
  try {
    await fs.access(expected);
    return expected;
  } catch {
    // Some LO builds normalize names; fall back to searching.
    const entries = await fs.readdir(outputDir);
    const match = entries.find((e) => e.toLowerCase().endsWith(`.${to.toLowerCase()}`));
    if (!match) throw new Error("LibreOffice finished but output file was not found");
    return path.join(outputDir, match);
  }
}

