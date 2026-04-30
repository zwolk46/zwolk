import path from "node:path";
import type { Converter } from "../types.js";
import { findExecutable } from "../tooling.js";
import { execLogged } from "../exec.js";

export const inkscapeConverter: Converter = {
  id: "inkscape",
  label: "Inkscape",
  description: "Vector conversions (SVG ↔ PDF/PNG) via `inkscape`.",
  availability: async () => {
    const inkscape = await findExecutable(["inkscape"]);
    if (!inkscape) return { ok: false, reason: "Executable `inkscape` not found in PATH" };
    return { ok: true, executables: { inkscape } };
  },
  supports: (from, to) => {
    if (from === to) return false;
    if (from === "svg" && ["png", "pdf"].includes(to)) return true;
    if (from === "pdf" && to === "svg") return true;
    return false;
  },
  convert: async ({ inputPath, originalFilename, to, outputDir, ctx }) => {
    const inkscape = await findExecutable(["inkscape"]);
    if (!inkscape) throw new Error("Inkscape not available (`inkscape` not found)");
    const base = safeBasename(originalFilename);
    const outputFilename = `${base}.${to}`;
    const outputPath = path.join(outputDir, outputFilename);

    const argv =
      to === "png"
        ? ["--export-type=png", `--export-filename=${outputPath}`, inputPath]
        : to === "pdf"
          ? ["--export-type=pdf", `--export-filename=${outputPath}`, inputPath]
          : ["--export-type=svg", `--export-filename=${outputPath}`, inputPath];

    const { code } = await execLogged({ cmd: inkscape, argv, signal: ctx.signal, log: ctx.log });
    if (code !== 0) throw new Error(`Inkscape failed with exit code ${code}`);
    return { outputPath, outputFilename };
  }
};

function safeBasename(filename: string) {
  const base = path.parse(filename).name || "output";
  return base.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "output";
}

