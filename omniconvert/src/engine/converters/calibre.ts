import path from "node:path";
import type { Converter } from "../types.js";
import { findExecutable } from "../tooling.js";
import { execLogged } from "../exec.js";

const EBOOKS = new Set(["epub", "mobi", "pdf", "html", "txt", "docx"]);

export const calibreConverter: Converter = {
  id: "calibre",
  label: "Calibre",
  description: "Ebook conversions via `ebook-convert` (best effort).",
  availability: async () => {
    const ebookConvert = await findExecutable(["ebook-convert"]);
    if (!ebookConvert) return { ok: false, reason: "Executable `ebook-convert` not found in PATH" };
    return { ok: true, executables: { "ebook-convert": ebookConvert } };
  },
  supports: (from, to) => EBOOKS.has(from) && EBOOKS.has(to) && from !== to,
  convert: async ({ inputPath, originalFilename, to, outputDir, ctx }) => {
    const ebookConvert = await findExecutable(["ebook-convert"]);
    if (!ebookConvert) throw new Error("Calibre not available (`ebook-convert` not found)");
    const base = safeBasename(originalFilename);
    const outputFilename = `${base}.${to}`;
    const outputPath = path.join(outputDir, outputFilename);

    const argv = [inputPath, outputPath];
    const { code } = await execLogged({ cmd: ebookConvert, argv, signal: ctx.signal, log: ctx.log });
    if (code !== 0) throw new Error(`Calibre failed with exit code ${code}`);
    return { outputPath, outputFilename };
  }
};

function safeBasename(filename: string) {
  const base = path.parse(filename).name || "output";
  return base.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "output";
}

