import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fsp from "node:fs/promises";
import yaml from "js-yaml";
import { runConversion } from "../src/engine/runConversion.js";

test("built-in converter can convert json -> yaml", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "omniconvert-test-"));
  try {
    const inputPath = path.join(dir, "input.json");
    await fsp.writeFile(inputPath, JSON.stringify({ a: 1, b: "x" }), "utf8");

    const ac = new AbortController();
    const result = await runConversion({
      inputPath,
      originalFilename: "input.json",
      to: "yaml",
      requestedConverter: null,
      signal: ac.signal,
      log: () => {}
    });

    const out = await fsp.readFile(result.outputPath, "utf8");
    const obj = yaml.load(out);
    assert.deepEqual(obj, { a: 1, b: "x" });
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

