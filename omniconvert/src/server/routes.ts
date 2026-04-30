import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pipeline } from "node:stream/promises";
import { nanoid } from "nanoid";
import { getCapabilities, getTargetsForFilename } from "../engine/capabilities.js";
import { runConversion } from "../engine/runConversion.js";
import { JobStore } from "./store.js";
import { TaskQueue } from "./taskQueue.js";

type CreateJobBody = {
  to?: string;
  converter?: string;
};

function getEnvNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function registerRoutes(app: FastifyInstance) {
  const store = new JobStore({
    ttlMs: getEnvNumber("JOB_TTL_MS", 3_600_000)
  });
  const queue = new TaskQueue({
    maxConcurrency: getEnvNumber("MAX_CONCURRENCY", 2)
  });

  app.get("/api/health", async () => {
    return { ok: true };
  });

  app.get("/api/capabilities", async () => {
    return getCapabilities();
  });

  app.get("/api/targets", async (req) => {
    const filename = (req.query as { filename?: string }).filename;
    if (!filename) return { ok: false, error: "Missing filename" };
    return { ok: true, ...getTargetsForFilename(filename) };
  });

  app.post("/api/jobs", async (req, reply) => {
    const parts = req.parts();

    const id = nanoid();
    let uploadTmpPath: string | null = null;
    let uploadDir: string | null = null;
    let originalFilename: string | null = null;
    const body: CreateJobBody = {};

    try {
      for await (const part of parts) {
        if (part.type === "file") {
          if (uploadTmpPath) {
            await reply.code(400).send({ ok: false, error: "Only one file allowed" });
            return;
          }

          originalFilename = part.filename || "upload";
          uploadDir = await fsp.mkdtemp(path.join(os.tmpdir(), `omniconvert-${id}-`));
          uploadTmpPath = path.join(uploadDir, `input-${sanitizeFilename(originalFilename)}`);
          await pipeline(part.file, fs.createWriteStream(uploadTmpPath));
        } else {
          if (part.fieldname === "to") body.to = String(part.value || "");
          if (part.fieldname === "converter") body.converter = String(part.value || "");
        }
      }
    } catch (err) {
      if (uploadDir) await safeRm(uploadDir);
      throw err;
    }

    if (!uploadTmpPath || !originalFilename) {
      if (uploadDir) await safeRm(uploadDir);
      await reply.code(400).send({ ok: false, error: "Missing file field `file`" });
      return;
    }

    const to = (body.to || "").trim().toLowerCase();
    if (!to) {
      if (uploadDir) await safeRm(uploadDir);
      await reply.code(400).send({ ok: false, error: "Missing target format field `to`" });
      return;
    }

    const job = store.create({
      id,
      originalFilename,
      inputPath: uploadTmpPath,
      to,
      requestedConverter: (body.converter || "").trim() || null
    });

    queue.enqueue(
      job.id,
      async (signal, log) => {
      store.markRunning(job.id, { startedAt: Date.now() });
      try {
        const result = await runConversion({
          inputPath: job.inputPath,
          originalFilename: job.originalFilename,
          to: job.to,
          requestedConverter: job.requestedConverter,
          signal,
          log
        });
        store.markSucceeded(job.id, {
          outputPath: result.outputPath,
          outputFilename: result.outputFilename,
          converterId: result.converterId,
          finishedAt: Date.now()
        });
      } catch (err) {
        store.markFailed(job.id, {
          error: err instanceof Error ? err.message : String(err),
          finishedAt: Date.now()
        });
      }
      },
      (line) => {
        if (line) store.appendLog(job.id, line);
      }
    );

    return { ok: true, job: store.get(job.id) };
  });

  app.get("/api/jobs/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const job = store.get(id);
    if (!job) return reply.code(404).send({ ok: false, error: "Not found" });
    return { ok: true, job };
  });

  app.post("/api/jobs/:id/cancel", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const job = store.get(id);
    if (!job) return reply.code(404).send({ ok: false, error: "Not found" });
    const canceled = queue.cancel(id);
    if (!canceled) return { ok: false, error: "Not cancelable (already finished or not started)" };
    store.markCanceled(id, { finishedAt: Date.now() });
    return { ok: true };
  });

  app.get("/api/jobs/:id/download", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const job = store.get(id);
    if (!job) return reply.code(404).send({ ok: false, error: "Not found" });
    if (job.status !== "succeeded" || !job.outputPath || !job.outputFilename) {
      return reply.code(409).send({ ok: false, error: "Job has no output yet" });
    }
    return reply
      .header("Content-Disposition", `attachment; filename="${job.outputFilename}"`)
      .send(fs.createReadStream(job.outputPath));
  });
}

function sanitizeFilename(name: string) {
  return name.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "file";
}

async function safeRm(dirPath: string) {
  try {
    await fsp.rm(dirPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
