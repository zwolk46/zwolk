// lib/forecast-worker.js — runs the Monte-Carlo off the main thread.
import { runForecast, runCrossImpact } from './forecast.js';

self.onmessage = (e) => {
  const { reqId, ctx, opts, mode } = e.data || {};
  try {
    const res = mode === 'cross' ? runCrossImpact(ctx, opts || {}) : runForecast(ctx, opts || {});
    self.postMessage({ reqId, ok: true, res });
  } catch (err) {
    self.postMessage({ reqId, ok: false, error: String((err && err.message) || err) });
  }
};
