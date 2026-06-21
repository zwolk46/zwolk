#!/usr/bin/env node
/**
 * merge-players.mjs — Normalize the raw Transfermarkt sweep (solidcode/
 * transfermarkt-scraper output) and merge it into the openfootball player
 * skeleton, then recompute team market-value totals.
 *
 * Reads:
 *   data/players.json                      (openfootball skeleton; from build-static.mjs)
 *   data/enrichment/transfermarkt-raw.json (from fetch-players-apify.mjs)
 *   data/enrichment/tm-verein-ids.json     (fifa_code → TM verein id, used to map sourceUrl → team)
 *   data/enrichment/teams-48.json          (verein id → team name)
 * Writes (in place):
 *   data/players.json, data/players-by-team.json, data/teams.json
 *
 * Each raw record's national team is derived from its sourceUrl (…/verein/<id>/…),
 * then matched to a skeleton player by normalized name within that team. Skeleton
 * fields (club name, DOB, shirt, position grouping) are preserved; TM adds tmId,
 * market value (+ history), height, foot, contract, detailed position, photo, tmUrl.
 *
 * Run:  node wc/scripts/merge-players.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'data');
const ENR = join(DATA, 'enrichment');
const RAW = join(ENR, 'transfermarkt-raw.json');

const rd = (p) => JSON.parse(readFileSync(p, 'utf8'));
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

function main() {
  if (!existsSync(RAW)) { console.error('✖ No raw file at', RAW, '— run fetch-players-apify.mjs first.'); process.exit(1); }
  const raw = rd(RAW);
  const players = rd(join(DATA, 'players.json'));
  const teams = rd(join(DATA, 'teams.json'));
  const vereinIds = rd(join(ENR, 'tm-verein-ids.json'));         // { FIFA: vereinId }
  const teams48 = rd(join(ENR, 'teams-48.json'));

  // verein id → team name
  const codeByVerein = {}; for (const [code, vid] of Object.entries(vereinIds)) codeByVerein[String(vid)] = code;
  const nameByCode = {}; for (const t of teams48) nameByCode[t.fifa_code] = t.name;
  const vereinToTeamName = {}; for (const [vid, code] of Object.entries(codeByVerein)) vereinToTeamName[vid] = nameByCode[code];

  // skeleton index: team name → (normName → player), plus an order-insensitive
  // token-set index (so "Son Heung-min" matches TM's "Heung-min Son").
  const tokenKey = (s) => norm(s).split(/\s+/).filter(Boolean).sort().join(' ');
  const byTeam = {};
  const byTeamTok = {};
  for (const p of players) {
    ((byTeam[p.nationalTeam] ||= new Map())).set(norm(p.name), p);
    ((byTeamTok[p.nationalTeam] ||= new Map())).set(tokenKey(p.name), p);
  }

  const playerRecs = raw.filter((r) => (r.recordType || '').toLowerCase() === 'player' || (!r.recordType && r.name && r.relativeUrl));
  console.log(`Merging ${playerRecs.length} TM player records into ${players.length} skeleton players…`);

  let matched = 0; const unmatched = [];
  for (const r of playerRecs) {
    const vid = (String(r.sourceUrl || '').match(/\/verein\/(\d+)/) || [])[1];
    const teamName = vereinToTeamName[vid];
    if (!teamName) { unmatched.push(`${r.name} (verein ${vid})`); continue; }
    const idx = byTeam[teamName];
    let p = idx && idx.get(norm(r.name));
    if (!p) { const tk = byTeamTok[teamName]; p = tk && tk.get(tokenKey(r.name)); }  // order-insensitive
    if (!p && idx) {
      // last resort: unique surname match within the team
      const surname = norm(r.name).split(' ').pop();
      const hits = [...idx.values()].filter((v) => norm(v.name).split(' ').pop() === surname);
      if (hits.length === 1) p = hits[0];
    }
    if (!p) { unmatched.push(`${r.name} → ${teamName}`); continue; }
    matched++;

    const mv = r.marketValue && r.marketValue.value != null ? r.marketValue.value : (typeof r.marketValueEur === 'number' ? r.marketValueEur : null);
    const hist = Array.isArray(r.marketValueHistory)
      ? r.marketValueHistory.map((h) => ({ date: (h.determined || '').slice(0, 10), valueEur: h.value })).filter((h) => h.date && h.valueEur != null)
      : [];
    const peak = hist.length ? Math.max(...hist.map((h) => h.valueEur), mv || 0) : (mv || null);
    const transfers = Array.isArray(r.transferHistory) ? r.transferHistory.map((t) => {
      const c = t.fee && t.fee.compact;
      return {
        season: t.seasonId ? `${t.seasonId}/${String((t.seasonId % 100) + 1).padStart(2, '0')}` : ((t.date || '').slice(0, 4) || null),
        date: (t.date || '').slice(0, 10) || null,
        fromClubId: t.fromClubId != null ? String(t.fromClubId) : null,
        toClubId: t.toClubId != null ? String(t.toClubId) : null,
        fromClub: null, toClub: null,                       // names backfilled by enrich-clubs.mjs
        feeEur: t.fee && typeof t.fee.value === 'number' ? t.fee.value : null,
        feeDisplay: c ? `${c.prefix || ''}${c.content || ''}${c.suffix || ''}` : (t.isLoan ? 'Loan' : (t.fee && t.fee.value === 0 ? 'Free transfer' : '—')),
      };
    }).sort((a, b) => String(a.date).localeCompare(String(b.date))) : [];

    p.tmId = r.id != null ? String(r.id) : p.tmId;
    p.tmUrl = r.relativeUrl ? 'https://www.transfermarkt.com' + r.relativeUrl : p.tmUrl;
    p.tmPhotoUrl = r.portraitUrl || null;
    p.shortName = r.shortName || p.shortName;
    p.dateOfBirth = p.dateOfBirth || r.dateOfBirth || null;
    p.age = (typeof r.age === 'number' ? r.age : p.age);
    p.height = (typeof r.heightMeters === 'number' && r.heightMeters > 0) ? Math.round(r.heightMeters * 100) : p.height;
    p.preferredFoot = r.preferredFoot || p.preferredFoot;
    p.positionDetail = r.positionName || null;            // granular ("Centre-Forward"); `position` kept generic for grouping
    p.contractUntil = r.contractUntil || p.contractUntil;
    p.marketValueEur = mv != null ? mv : p.marketValueEur;
    p.marketValuePeak = peak != null ? peak : p.marketValuePeak;
    p.marketValueHistory = hist.length ? hist : p.marketValueHistory;
    p.transferHistory = transfers.length ? transfers : p.transferHistory;
    p.source = 'transfermarkt';
  }

  // Regroup + sort by value desc.
  const grouped = {};
  for (const p of players) (grouped[p.nationalTeam] ||= []).push(p);
  for (const k of Object.keys(grouped)) grouped[k].sort((a, b) => (b.marketValueEur || 0) - (a.marketValueEur || 0) || (a.shirtNumber || 99) - (b.shirtNumber || 99));

  // Recompute team market-value totals.
  for (const t of teams) {
    const squad = grouped[t.name] || [];
    const vals = squad.map((p) => p.marketValueEur).filter((v) => v != null);
    t.totalMarketValueEur = vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    t.averageMarketValueEur = vals.length ? Math.round(t.totalMarketValueEur / vals.length) : null;
  }

  writeFileSync(join(DATA, 'players.json'), JSON.stringify(players, null, 2) + '\n');
  writeFileSync(join(DATA, 'players-by-team.json'), JSON.stringify(grouped, null, 2) + '\n');
  writeFileSync(join(DATA, 'teams.json'), JSON.stringify(teams, null, 2) + '\n');

  const withVal = players.filter((p) => p.marketValueEur != null).length;
  console.log(`✔ matched ${matched}/${playerRecs.length} · players with market value: ${withVal}/${players.length}`);
  const teamsWithVal = teams.filter((t) => t.totalMarketValueEur != null).length;
  console.log(`  teams with totals: ${teamsWithVal}/${teams.length}`);
  if (unmatched.length) console.log(`  ⚠ ${unmatched.length} TM records unmatched: ${unmatched.slice(0, 20).join(', ')}${unmatched.length > 20 ? ' …' : ''}`);
}
main();
