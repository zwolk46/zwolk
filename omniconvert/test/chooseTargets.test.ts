import test from "node:test";
import assert from "node:assert/strict";
import { getTargetsForFilename } from "../src/engine/capabilities.js";

test("getTargetsForFilename returns target list for known input", () => {
  const { from, targets } = getTargetsForFilename("example.json");
  assert.equal(from, "json");
  assert.ok(targets.includes("yaml"));
});

