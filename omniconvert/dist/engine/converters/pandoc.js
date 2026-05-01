import path from "node:path";
import { findExecutable } from "../tooling.js";
import { execLogged } from "../exec.js";
const DOCS = new Set([
    "md",
    "txt",
    "html",
    "rtf",
    "docx",
    "odt",
    "epub",
    "pdf"
]);
export const pandocConverter = {
    id: "pandoc",
    label: "Pandoc",
    description: "Document/markup conversion via `pandoc` (best effort).",
    availability: async () => {
        const pandoc = await findExecutable(["pandoc"]);
        if (!pandoc)
            return { ok: false, reason: "Executable `pandoc` not found in PATH" };
        return { ok: true, executables: { pandoc } };
    },
    supports: (from, to) => DOCS.has(from) && DOCS.has(to) && from !== to,
    convert: async ({ inputPath, originalFilename, to, outputDir, ctx }) => {
        const pandoc = await findExecutable(["pandoc"]);
        if (!pandoc)
            throw new Error("Pandoc not available (`pandoc` not found)");
        const base = safeBasename(originalFilename);
        const outputFilename = `${base}.${to}`;
        const outputPath = path.join(outputDir, outputFilename);
        const argv = [inputPath, "-o", outputPath];
        const { code } = await execLogged({ cmd: pandoc, argv, signal: ctx.signal, log: ctx.log });
        if (code !== 0)
            throw new Error(`Pandoc failed with exit code ${code}`);
        return { outputPath, outputFilename };
    }
};
function safeBasename(filename) {
    const base = path.parse(filename).name || "output";
    return base.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "output";
}
