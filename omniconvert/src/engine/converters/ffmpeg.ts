import path from "node:path";
import type { Converter } from "../types.js";
import { findExecutable } from "../tooling.js";
import { execLogged } from "../exec.js";

const AUDIO = new Set(["mp3", "wav", "flac", "aac", "m4a", "ogg", "opus"]);
const VIDEO = new Set(["mp4", "mkv", "webm", "mov", "avi", "gif"]);

export const ffmpegConverter: Converter = {
  id: "ffmpeg",
  label: "FFmpeg",
  description: "Audio/video conversion via `ffmpeg`.",
  availability: async () => {
    const ffmpeg = await findExecutable(["ffmpeg"]);
    if (!ffmpeg) return { ok: false, reason: "Executable `ffmpeg` not found in PATH" };
    return { ok: true, executables: { ffmpeg } };
  },
  supports: (from, to) => {
    const fromIsAudio = AUDIO.has(from);
    const fromIsVideo = VIDEO.has(from);
    const toIsAudio = AUDIO.has(to);
    const toIsVideo = VIDEO.has(to);
    if (from === to) return false;
    if (fromIsAudio && toIsAudio) return true;
    if (fromIsVideo && toIsVideo) return true;
    // allow video->audio extraction
    if (fromIsVideo && toIsAudio) return true;
    return false;
  },
  convert: async ({ inputPath, originalFilename, to, outputDir, ctx }) => {
    const ffmpeg = await findExecutable(["ffmpeg"]);
    if (!ffmpeg) throw new Error("FFmpeg not available (`ffmpeg` not found)");

    const base = safeBasename(originalFilename);
    const outputFilename = `${base}.${to}`;
    const outputPath = path.join(outputDir, outputFilename);

    const argv = ["-y", "-hide_banner", "-i", inputPath, outputPath];
    const { code } = await execLogged({ cmd: ffmpeg, argv, signal: ctx.signal, log: ctx.log });
    if (code !== 0) throw new Error(`FFmpeg failed with exit code ${code}`);
    return { outputPath, outputFilename };
  }
};

function safeBasename(filename: string) {
  const base = path.parse(filename).name || "output";
  return base.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "output";
}

