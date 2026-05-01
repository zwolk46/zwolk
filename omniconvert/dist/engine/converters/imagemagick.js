import path from "node:path";
import { findExecutable } from "../tooling.js";
import { execLogged } from "../exec.js";
const IMAGE_FORMATS = new Set([
    "png",
    "jpg",
    "webp",
    "gif",
    "tiff",
    "bmp",
    "ico",
    "heic",
    "svg",
    "pdf"
]);
export const imagemagickConverter = {
    id: "imagemagick",
    label: "ImageMagick",
    description: "Image conversion (raster/vector) via `magick`.",
    availability: async () => {
        const magick = await findExecutable(["magick"]);
        if (!magick)
            return { ok: false, reason: "Executable `magick` not found in PATH" };
        return { ok: true, executables: { magick } };
    },
    supports: (from, to) => IMAGE_FORMATS.has(from) && IMAGE_FORMATS.has(to) && from !== to,
    convert: async ({ inputPath, originalFilename, to, outputDir, ctx }) => {
        const magick = await findExecutable(["magick"]);
        if (!magick)
            throw new Error("ImageMagick not available (`magick` not found)");
        const base = safeBasename(originalFilename);
        const outputFilename = `${base}.${to}`;
        const outputPath = path.join(outputDir, outputFilename);
        // ImageMagick chooses behavior based on extensions; keep it simple.
        const { code } = await execLogged({
            cmd: magick,
            argv: [inputPath, outputPath],
            signal: ctx.signal,
            log: ctx.log
        });
        if (code !== 0)
            throw new Error(`ImageMagick failed with exit code ${code}`);
        return { outputPath, outputFilename };
    }
};
function safeBasename(filename) {
    const base = path.parse(filename).name || "output";
    return base.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "output";
}
