import fs from "node:fs";
import { nanoid } from "nanoid";
import path from "node:path";
export class JobStore {
    ttlMs;
    jobs = new Map();
    cleanupTimer = null;
    constructor(opts) {
        this.ttlMs = opts.ttlMs;
        this.cleanupTimer = setInterval(() => this.cleanup(), Math.min(60_000, this.ttlMs)).unref();
    }
    create(input) {
        const id = input.id || nanoid();
        const now = Date.now();
        const job = {
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
    get(id) {
        return this.jobs.get(id) || null;
    }
    markRunning(id, patch) {
        const job = this.jobs.get(id);
        if (!job)
            return;
        job.status = "running";
        job.startedAt = patch.startedAt;
    }
    markSucceeded(id, patch) {
        const job = this.jobs.get(id);
        if (!job)
            return;
        if (job.status === "canceled")
            return;
        job.status = "succeeded";
        job.outputPath = patch.outputPath;
        job.outputFilename = patch.outputFilename;
        job.converterId = patch.converterId;
        job.finishedAt = patch.finishedAt;
    }
    markFailed(id, patch) {
        const job = this.jobs.get(id);
        if (!job)
            return;
        if (job.status === "canceled")
            return;
        job.status = "failed";
        job.error = patch.error;
        job.finishedAt = patch.finishedAt;
    }
    markCanceled(id, patch) {
        const job = this.jobs.get(id);
        if (!job)
            return;
        job.status = "canceled";
        job.finishedAt = patch.finishedAt;
    }
    appendLog(id, line) {
        const job = this.jobs.get(id);
        if (!job)
            return;
        job.logs.push({ t: Date.now(), line });
        if (job.logs.length > 4000)
            job.logs.splice(0, job.logs.length - 4000);
    }
    cleanup() {
        const now = Date.now();
        for (const [id, job] of this.jobs) {
            const age = now - job.createdAt;
            if (age <= this.ttlMs)
                continue;
            this.jobs.delete(id);
            this.safeRm(path.dirname(job.inputPath));
            if (job.outputPath)
                this.safeRm(path.dirname(job.outputPath));
        }
    }
    safeRm(dirPath) {
        try {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
        catch {
            // ignore
        }
    }
}
