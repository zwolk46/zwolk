import os from "node:os";
import path from "node:path";
import fsp from "node:fs/promises";
import { detectFormatFromFile, inferFormatFromFilename } from "./formats.js";
import { ALL_CONVERTERS } from "./converters/index.js";
export async function runConversion(args) {
    const { inputPath, originalFilename, to, requestedConverter } = args;
    const from = (await detectFormatFromFile(inputPath, originalFilename)) ||
        inferFormatFromFilename(originalFilename) ||
        "unknown";
    const converter = await chooseConverter({
        from,
        to,
        requestedConverter,
        log: args.log
    });
    const outputDir = await fsp.mkdtemp(path.join(os.tmpdir(), "omniconvert-out-"));
    const ctx = { signal: args.signal, log: args.log };
    const { outputPath, outputFilename } = await converter.convert({
        inputPath,
        originalFilename,
        from,
        to,
        outputDir,
        ctx
    });
    return { converterId: converter.id, outputPath, outputFilename };
}
async function chooseConverter(args) {
    const to = args.to.toLowerCase();
    const from = args.from.toLowerCase();
    const candidates = ALL_CONVERTERS.filter((c) => c.supports(from, to));
    if (candidates.length === 0) {
        throw new Error(`No converter supports ${from} -> ${to}`);
    }
    if (args.requestedConverter) {
        const forced = candidates.find((c) => c.id === args.requestedConverter);
        if (!forced)
            throw new Error(`Requested converter not valid for ${from} -> ${to}`);
        const avail = await forced.availability();
        if (!avail.ok)
            throw new Error(`Requested converter unavailable: ${avail.reason || "unknown"}`);
        return forced;
    }
    for (const c of candidates) {
        const avail = await c.availability();
        if (avail.ok)
            return c;
        args.log(`[skip:${c.id}] ${avail.reason || "unavailable"}`);
    }
    throw new Error(`Converters exist for ${from} -> ${to}, but none are available on PATH`);
}
