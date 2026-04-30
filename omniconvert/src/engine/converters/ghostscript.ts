import path from "node:path";
import type { Converter } from "../types.js";
import { findExecutable } from "../tooling.js";
import { execLogged } from "../exec.js";

export const ghostscriptConverter: Converter = {
  id: "ghostscript",
  label: "Ghostscript",
  description: "PDF/PostScript conversions via `gs` (subset).",
  availability: async () => {
    const gs = await findExecutable(["gs"]);
    if (!gs) return { ok: false, reason: "Executable `gs` not found in PATH" };
    return { ok: true, executables: { gs } };
  },
  supports: (from, to) => {
    if (from === to) return false;
    if (from === "pdf" && to === "ps") return true;
    if (from === "ps" && to === "pdf") return true;
    // pdf -> png/jpg via Ghostscript; useful if ImageMagick isn't available.
    if (from === "pdf" && ["png", "jpg"].includes(to)) return true;
    return false;
  },
  convert: async ({ inputPath, originalFilename, to, outputDir, ctx }) => {
    const gs = await findExecutable(["gs"]);
    if (!gs) throw new Error("Ghostscript not available (`gs` not found)");
    const base = safeBasename(originalFilename);
    const outputFilename = `${base}.${to}`;
    const outputPath = path.join(outputDir, outputFilename);

    const argv =
      to === "ps"
        ? ["-dBATCH", "-dNOPAUSE", "-sDEVICE=ps2write", `-sOutputFile=${outputPath}`, inputPath]
        : to === "pdf"
          ? ["-dBATCH", "-dNOPAUSE", "-sDEVICE=pdfwrite", `-sOutputFile=${outputPath}`, inputPath]
          : to === "png"
            ? [
                "-dBATCH",
                "-dNOPAUSE",
                "-sDEVICE=png16m",
                "-r144",
                `-sOutputFile=${outputPath}`,
                inputPath
              ]
            : [
                "-dBATCH",
                "-dNOPAUSE",
                "-sDEVICE=jpeg",
                "-r144",
                `-sOutputFile=${outputPath}`,
                inputPath
              ];

    const { code } = await execLogged({ cmd: gs, argv, signal: ctx.signal, log: ctx.log });
    if (code !== 0) throw new Error(`Ghostscript failed with exit code ${code}`);
    return { outputPath, outputFilename };
  }
};

function safeBasename(filename: string) {
  const base = path.parse(filename).name || "output";
  return base.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "output";
}

