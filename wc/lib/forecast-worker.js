// lib/forecast-worker.js — runs the Monte-Carlo off the main thread.
import { runForecast } from './forecast.js';

self.onmessage = (e) => {
  const { reqId, ctx, opts } = e.data || {};
  try {
    const res = runForecast(ctx, opts || {});
    self.postMessage({ reqId, ok: true, res });
  } catch (err) {
    self.postMessage({ reqId, ok: false, error: String((err && err.message) || err) });
  }
};
