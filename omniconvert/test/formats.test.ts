import test from "node:test";
import assert from "node:assert/strict";
import { inferFormatFromFilename } from "../src/engine/formats.js";

test("inferFormatFromFilename detects common extensions", () => {
  assert.equal(inferFormatFromFilename("photo.JPG"), "jpg");
  assert.equal(inferFormatFromFilename("clip.mp4"), "mp4");
  assert.equal(inferFormatFromFilename("archive.tar.gz"), "tgz");
  assert.equal(inferFormatFromFilename("notes.md"), "md");
});

