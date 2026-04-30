#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { runConversion } from "./engine/runConversion.js";

const program = new Command();

program
  .name("omniconvert")
  .description("Convert files using OmniConvert's plugin engine")
  .argument("<input>", "input file path")
  .requiredOption("--to <format>", "target format id (e.g. pdf, png, mp3)")
  .option("--converter <id>", "force a converter id")
  .option("--out <dir>", "copy result into this directory")
  .parse(process.argv);

const input = program.args[0];
const opts = program.opts<{ to: string; converter?: string; out?: string }>();

const ac = new AbortController();
process.on("SIGINT", () => ac.abort());

const inputPath = path.resolve(input);
await fs.access(inputPath);

const result = await runConversion({
  inputPath,
  originalFilename: path.basename(inputPath),
  to: opts.to,
  requestedConverter: opts.converter || null,
  signal: ac.signal,
  log: (line) => {
    if (line) process.stderr.write(line + "\n");
  }
});

let finalPath = result.outputPath;
if (opts.out) {
  const outDir = path.resolve(opts.out);
  await fs.mkdir(outDir, { recursive: true });
  const dest = path.join(outDir, result.outputFilename);
  await fs.copyFile(result.outputPath, dest);
  finalPath = dest;
}

process.stdout.write(finalPath + "\n");

