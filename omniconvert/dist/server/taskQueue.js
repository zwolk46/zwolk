export class TaskQueue {
    maxConcurrency;
    running = 0;
    order = [];
    tasks = new Map();
    constructor(opts) {
        this.maxConcurrency = Math.max(1, Math.floor(opts.maxConcurrency));
    }
    enqueue(id, fn, log) {
        if (this.tasks.has(id))
            return;
        this.tasks.set(id, { status: "queued", fn, log });
        this.order.push(id);
        this.pump();
    }
    cancel(id) {
        const state = this.tasks.get(id);
        if (!state)
            return false;
        if (state.status === "queued") {
            this.tasks.set(id, { status: "finished" });
            return true;
        }
        if (state.status === "running") {
            state.controller.abort();
            return true;
        }
        return false;
    }
    pump() {
        while (this.running < this.maxConcurrency) {
            const nextId = this.order.shift();
            if (!nextId)
                return;
            const state = this.tasks.get(nextId);
            if (!state || state.status !== "queued")
                continue;
            const controller = new AbortController();
            this.tasks.set(nextId, { status: "running", controller, log: state.log });
            this.running += 1;
            state
                .fn(controller.signal, state.log)
                .catch(() => {
                // job store owns error details
            })
                .finally(() => {
                this.running -= 1;
                this.tasks.set(nextId, { status: "finished" });
                this.pump();
            });
        }
    }
}
