import fs from "node:fs";
import { nanoid } from "nanoid";
import path from "node:path";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export type JobRecord = {
  id: string;
  status: JobStatus;
  originalFilename: string;
  inputPath: string;
  to: string;
  requestedConverter: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  converterId: string | null;
  outputPath: string | null;
  outputFilename: string | null;
  error: string | null;
  logs: Array<{ t: number; line: string }>;
};

export class JobStore {
  private readonly ttlMs: number;
  private readonly jobs = new Map<string, JobRecord>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(opts: { ttlMs: number }) {
    this.ttlMs = opts.ttlMs;
    this.cleanupTimer = setInterval(() => this.cleanup(), Math.min(60_000, this.ttlMs)).unref();
  }

  create(input: {
    originalFilename: string;
    inputPath: string;
    to: string;
    requestedConverter: string | null;
    id?: string;
  }): JobRecord {
    const id = input.id || nanoid();
    const now = Date.now();
    const job: JobRecord = {
      id,
      status: "queued",
      originalFilename: input.originalFilename,
      inputPath: input.inputPath,
      to: input.to,
      requestedConverter: input.requestedConverter,
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      converterId: null,
      outputPath: null,
      outputFilename: null,
      error: null,
      logs: []
    };
    this.jobs.set(id, job);
    return job;
  }

  get(id: string) {
    return this.jobs.get(id) || null;
  }

  markRunning(id: string, patch: { startedAt: number }) {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = "running";
    job.startedAt = patch.startedAt;
  }

  markSucceeded(
    id: string,
    patch: { outputPath: string; outputFilename: string; converterId: string; finishedAt: number }
  ) {
    const job = this.jobs.get(id);
    if (!job) return;
    if (job.status === "canceled") return;
    job.status = "succeeded";
    job.outputPath = patch.outputPath;
    job.outputFilename = patch.outputFilename;
    job.converterId = patch.converterId;
    job.finishedAt = patch.finishedAt;
  }

  markFailed(id: string, patch: { error: string; finishedAt: number }) {
    const job = this.jobs.get(id);
    if (!job) return;
    if (job.status === "canceled") return;
    job.status = "failed";
    job.error = patch.error;
    job.finishedAt = patch.finishedAt;
  }

  markCanceled(id: string, patch: { finishedAt: number }) {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = "canceled";
    job.finishedAt = patch.finishedAt;
  }

  appendLog(id: string, line: string) {
    const job = this.jobs.get(id);
    if (!job) return;
    job.logs.push({ t: Date.now(), line });
    if (job.logs.length > 4000) job.logs.splice(0, job.logs.length - 4000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      const age = now - job.createdAt;
      if (age <= this.ttlMs) continue;
      this.jobs.delete(id);
      this.safeRm(path.dirname(job.inputPath));
      if (job.outputPath) this.safeRm(path.dirname(job.outputPath));
    }
  }

  private safeRm(dirPath: string) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  // nanoid provides sufficient uniqueness for this use-case.
}
