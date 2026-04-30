import path from "node:path";
import fsp from "node:fs/promises";
import os from "node:os";
import type { Converter } from "../types.js";
import { findExecutable } from "../tooling.js";
import { execLogged } from "../exec.js";

const ARCHIVES = new Set(["zip", "7z", "tar", "tgz"]);

export const sevenZipConverter: Converter = {
  id: "7zip",
  label: "7-Zip",
  description: "Archive repacking via `7z` (extract then re-pack).",
  availability: async () => {
    const exe = await findExecutable(["7z", "7za", "7zz"]);
    if (!exe) return { ok: false, reason: "Executable `7z`/`7za`/`7zz` not found in PATH" };
    return { ok: true, executables: { "7z": exe } };
  },
  supports: (from, to) => ARCHIVES.has(from) && ARCHIVES.has(to) && from !== to && (to === "zip" || to === "7z"),
  convert: async ({ inputPath, originalFilename, to, outputDir, ctx }) => {
    const exe = await findExecutable(["7z", "7za", "7zz"]);
    if (!exe) throw new Error("7-Zip not available (`7z` not found)");

    const base = safeBasename(originalFilename);
    const outputFilename = `${base}.${to}`;
    const outputPath = path.join(outputDir, outputFilename);

    const extractDir = await fsp.mkdtemp(path.join(os.tmpdir(), "omniconvert-7z-extract-"));
    try {
      // Extract
      const extractArgv = ["x", "-y", `-o${extractDir}`, inputPath];
      const extracted = await execLogged({
        cmd: exe,
        argv: extractArgv,
        signal: ctx.signal,
        log: ctx.log
      });
      if (extracted.code !== 0) throw new Error(`7-Zip extract failed with exit code ${extracted.code}`);

      // Re-pack
      const typeFlag = to === "zip" ? "-tzip" : "-t7z";
      const addArgv = ["a", "-y", typeFlag, outputPath, "."];
      const added = await execLogged({
        cmd: exe,
        argv: addArgv,
        cwd: extractDir,
        signal: ctx.signal,
        log: ctx.log
      });
      if (added.code !== 0) throw new Error(`7-Zip pack failed with exit code ${added.code}`);

      return { outputPath, outputFilename };
    } finally {
      // best-effort cleanup; ignore failures
      try {
        await fsp.rm(extractDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
};

function safeBasename(filename: string) {
  const base = path.parse(filename).name || "output";
  return base.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "output";
}
