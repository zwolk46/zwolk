#!/usr/bin/env node
/**
 * build-scorers.mjs — Golden boot / tournament-scorers aggregation.
 *
 * Derives a top-scorers leaderboard (and a per-team breakdown) from the
 * wc2026api.com match event timelines (GET /matches/:id/stats), exactly as the
 * data spec requires. Only played matches (completed/live) are fetched, so the
 * call count equals the number of matches kicked off so far (well under the
 * daily cap). Output is overwritten each run (it is derived/refreshable).
 *
 * Reads WC_API_KEY from the environment (refresh-data sources it from .env.local).
 * Writes wc/data/enrichment/tournament-scorers.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(WC_DIR, 'data', 'enrichment', 'tournament-scorers.json');
const BASE = 'https://api.wc2026api.com';
const KEY = process.env.WC_API_KEY;

if (!KEY) {
  console.error('build-scorers: WC_API_KEY not set — skipping (live scorer data needs the key).');
  process.exit(2);
}

async function api(p) {
  const r = await fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`${r.status} on ${p}`);
  return r.json();
}

const PLAYED = new Set(['completed', 'finished', 'live']);

async function main() {
  const matches = await api('/matches');
  const arr = Array.isArray(matches) ? matches : (matches.data || []);
  const played = arr.filter((m) => PLAYED.has(String(m.status || '').toLowerCase()));

  const players = new Map();   // "CODE|Name" -> record
  const ownGoals = [];
  const typeSeen = new Set();
  let processed = 0;

  for (const m of played) {
    let st;
    try { st = await api(`/matches/${m.id}/stats`); }
    catch (e) { console.warn(`  skip match ${m.id}: ${e.message}`); continue; }
    processed++;
    const tl = Array.isArray(st.timeline) ? st.timeline : [];
    for (const ev of tl) {
      const type = String(ev.type || ev.event_type || '').toLowerCase();
      typeSeen.add(type);
      const code = String(ev.team || ev.team_code || '').toUpperCase();
      const name = ev.player || ev.player_name || ev.scorer || 'Unknown';
      const isOwn = type === 'own_goal' || type === 'owngoal' || type === 'own-goal';
      const isGoal = type === 'goal' || type === 'penalty' || type === 'penalty_goal' || type === 'pen';
      if (isOwn) { ownGoals.push({ player: name, team: code, match_number: m.match_number }); continue; }
      if (!isGoal) continue;
      const isPen = type.includes('pen') || /pen/i.test(String(ev.extra || ''));
      const k = `${code}|${name}`;
      const rec = players.get(k) || { rank: 0, player: name, team: code, goals: 0, penalties: 0, matches: [] };
      rec.goals++;
      if (isPen) rec.penalties++;
      if (!rec.matches.includes(m.match_number)) rec.matches.push(m.match_number);
      players.set(k, rec);
    }
  }

  const leaderboard = [...players.values()]
    .sort((a, b) => b.goals - a.goals || b.penalties - a.penalties || a.player.localeCompare(b.player));
  leaderboard.forEach((r, i) => { r.rank = i + 1; });

  const by_team = {};
  for (const r of leaderboard) (by_team[r.team] ||= []).push(r);

  const out = {
    _meta: {
      generated_at: new Date().toISOString(),
      source: 'wc2026api.com — GET /matches/:id/stats event timelines',
      matches_played: played.length,
      matches_processed: processed,
      total_scorers: leaderboard.length,
      total_goals: leaderboard.reduce((s, r) => s + r.goals, 0),
      own_goals: ownGoals.length,
      event_types_seen: [...typeSeen].sort(),
      join: 'by_team keyed by FIFA code (teams.json.code); leaderboard rows carry team code + player name',
      note: 'Golden boot / tournament scorers. Refreshable: rebuilt each refresh-data run.',
    },
    leaderboard,
    by_team,
    own_goals: ownGoals,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`build-scorers: ${leaderboard.length} scorers, ${out._meta.total_goals} goals from ${processed}/${played.length} played matches → ${path.relative(WC_DIR, OUT)}`);
  console.log(`  event types seen: ${[...typeSeen].join(', ')}`);
}

main().catch((e) => { console.error('build-scorers failed:', e.message); process.exit(1); });
