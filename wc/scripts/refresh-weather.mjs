#!/usr/bin/env node
/**
 * refresh-weather.mjs — Refresh per-match-day weather for all 16 venues from
 * Open-Meteo (keyless). Past match days use the archive (observed) API; upcoming
 * ones within the ~16-day forecast horizon use the forecast API. Match days
 * beyond the horizon are left as-is and fill in on a later run.
 *
 * Reads/writes: data/enrichment/stadium-weather.json (updates each match's
 * `weather` object + `weather_source`, and refreshes `generated_at`/`forecast_window`).
 *
 * Run:  node wc/scripts/refresh-weather.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'data', 'enrichment', 'stadium-weather.json');
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max';

const todayIso = () => new Date().toISOString().slice(0, 10);

async function fetchDay(lat, lng, tz, date, isPast) {
  const base = isPast ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
  const url = `${base}?latitude=${lat}&longitude=${lng}&daily=${DAILY}&timezone=${encodeURIComponent(tz || 'UTC')}&start_date=${date}&end_date=${date}`;
  // Per-request timeout so one slow/hung response can't stall an unattended run.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let r;
  try { r = await fetch(url, { signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
  if (!r.ok) return null;
  const d = (await r.json()).daily;
  if (!d || !d.time || !d.time.length) return null;
  return {
    temp_max_c: d.temperature_2m_max?.[0] ?? null,
    temp_min_c: d.temperature_2m_min?.[0] ?? null,
    precip_mm: d.precipitation_sum?.[0] ?? null,
    precip_prob_max_pct: d.precipitation_probability_max?.[0] ?? null,
    wind_max_kmh: d.wind_speed_10m_max?.[0] ?? null,
    uv_index_max: d.uv_index_max?.[0] ?? null,
  };
}

async function main() {
  const doc = JSON.parse(readFileSync(FILE, 'utf8'));
  const today = todayIso();
  const horizon = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
  let updated = 0, skipped = 0;
  for (const [name, venue] of Object.entries(doc.stadiums)) {
    const lat = venue.coords?.lat, lng = venue.coords?.lng, tz = venue.timezone;
    if (lat == null || lng == null) continue;
    for (const m of (venue.matches || [])) {
      const isPast = m.date < today;
      if (!isPast && m.date > horizon) { skipped++; continue; }   // beyond forecast horizon
      const wx = await fetchDay(lat, lng, tz, m.date, isPast).catch(() => null);
      if (wx) { m.weather = wx; m.weather_source = isPast ? 'observed' : 'forecast'; updated++; }
      await new Promise((r) => setTimeout(r, 250)); // be polite to the free API
    }
    console.log(`  ${name}: done`);
  }
  doc.generated_at = today;
  doc.forecast_window = { start: today, end: horizon };
  writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
  console.log(`✔ weather refreshed: ${updated} match-days updated, ${skipped} beyond horizon (will fill closer to the date).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
