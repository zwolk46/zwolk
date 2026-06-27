// Shared renderer for the Player Dossier view.

import * as data from './data.js';
import { flagSrc } from './flags.js';
import { eur, initials } from './format.js';
import { pronounce } from './data.js';
import { icon } from './icons.js';

export const playerCss = `
  .pd-root{position:relative;container-type:inline-size}

  /* ── HERO ─────────────────────────────────────────────────────────────── */
  .pd-hero{position:relative;overflow:hidden;padding:clamp(18px,4cqi,56px);background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-xl);animation:wc-reveal-up .6s var(--ease-spring) both}
  .pd-bigno{position:absolute;right:-2%;top:-16%;font-family:var(--f-display);font-size:clamp(160px,46cqi,520px);color:var(--accent-quiet);line-height:1;pointer-events:none;z-index:0;user-select:none}
  .pd-hero-inner{position:relative;z-index:1;display:flex;align-items:flex-end;gap:clamp(14px,3cqi,34px);flex-wrap:wrap}
  .pd-portrait{width:clamp(86px,24cqi,240px);aspect-ratio:3/4;flex:none;border-radius:var(--r-lg);overflow:hidden;background:var(--surface-2);border:1px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:var(--sh-3);position:relative;background-size:cover;background-position:center}
  .pd-portrait.has-photo{border-color:var(--accent-line)}
  .pd-portrait .init{font-family:var(--f-display);font-size:clamp(36px,11cqi,96px);color:var(--text-3);line-height:0.8;position:relative}
  .pd-portrait .no{font-family:var(--f-display);font-size:clamp(18px,4cqi,40px);color:var(--accent-text);position:relative;margin-top:6px}
  .pd-portrait .src{position:absolute;bottom:8px;font-family:var(--f-mono);font-weight:500;font-size:9px;letter-spacing:0.08em;color:var(--text-3)}
  .pd-meta{flex:1;min-width:0}
  .pd-pos-pill{display:inline-flex;align-items:center;font-family:'Archivo Expanded',var(--f-body);font-weight:800;font-size:clamp(9px,1.4cqi,14px);letter-spacing:0.16em;text-transform:uppercase;color:var(--accent-text);background:var(--accent-quiet);border:1px solid var(--accent-line);padding:5px 13px;border-radius:var(--r-pill)}
  .pd-name{font-family:var(--f-display);font-size:clamp(32px,11cqi,124px);line-height:0.82;text-transform:uppercase;margin-top:12px;color:var(--text)}
  .pd-name .last{color:var(--accent-text)}
  .pd-nat{display:flex;align-items:center;gap:11px;margin-top:14px;flex-wrap:wrap}
  .pd-nat-flag{width:clamp(34px,6cqi,62px);height:clamp(26px,4.5cqi,46px);flex:none;border-radius:var(--r-xs);background-size:cover;background-position:center;box-shadow:0 0 0 1px var(--border)}
  .pd-nat-text{font-family:var(--f-body);font-weight:700;font-size:clamp(12px,1.6cqi,19px);color:var(--text-2);text-decoration:none;transition:color var(--dur-2) var(--ease-out)}
  a.pd-nat-text:hover{color:var(--accent-text)}
  .pd-tagline{margin-top:11px;font-family:var(--f-body);font-weight:600;font-size:clamp(12px,1.5cqi,15px);line-height:1.45;color:var(--text-2);max-width:48ch}

  /* pronunciation "Hear name" — Lucide volume-2 icon + kept audio behaviour */
  .pd-pron{display:inline-flex;align-items:center;gap:6px;margin-left:10px;background:var(--accent-quiet);border:1px solid var(--accent-line);border-radius:var(--r-pill);padding:5px 12px;font-family:var(--f-body);font-weight:800;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent-text);cursor:pointer;transition:background var(--dur-2) var(--ease-out),transform var(--dur-1) var(--ease-press)}
  .pd-pron:hover{background:var(--accent-line)}
  .pd-pron:active{transform:scale(.95)}
  .pd-pron .wc-ic{transition:transform var(--dur-2) var(--ease-out)}
  .pd-pron[data-playing="1"] .wc-ic{animation:wc-pulse .9s ease-in-out infinite}

  /* ── SECTIONS ─────────────────────────────────────────────────────────── */
  .pd-section{background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px 20px;margin-top:14px;animation:wc-reveal-up .55s var(--ease-out) both;container-type:inline-size}
  .pd-section h3{font-family:var(--f-body);font-weight:900;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent-text);margin-bottom:14px}

  .pd-bio-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px}
  .pd-bio-cell .k{font-family:var(--f-body);font-weight:800;font-size:9px;color:var(--text-3);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:5px}
  .pd-bio-cell .v{font-family:var(--f-body);font-weight:700;font-size:14px;color:var(--text)}
  .pd-bio-cell .v.big{font-family:var(--f-display);font-size:24px;color:var(--text);font-weight:400}

  /* value / career stat cards — .wc-stat look */
  .pd-vstack{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:14px}
  .pd-vstack .card{background:var(--surface-sunken);border:1px solid var(--border-subtle);border-radius:var(--r-md);padding:14px 16px;transition:border-color var(--dur-2) var(--ease-out)}
  .pd-vstack .card:hover{border-color:var(--border-strong)}
  .pd-vstack .lbl{font-family:var(--f-body);font-weight:800;font-size:9px;color:var(--text-3);letter-spacing:0.12em;text-transform:uppercase}
  .pd-vstack .v{font-family:var(--f-mono);font-weight:700;font-size:24px;color:var(--text);margin-top:6px;font-variant-numeric:tabular-nums}
  .pd-vstack .v.accent{color:var(--accent-text)}

  /* ── MARKET-VALUE CHART (responsive: viewBox = real px box, no stretch) ── */
  .pd-chart{position:relative;width:100%;min-height:150px;background:var(--surface-sunken);border:1px solid var(--border-subtle);border-radius:var(--r-md);padding:14px}
  .pd-chart svg{width:100%;height:auto;display:block;overflow:visible}
  .pd-chart .grid{stroke:var(--border-subtle)}
  .pd-chart .axis{font-family:var(--f-mono);font-size:10px;fill:var(--text-3)}
  .pd-chart .area{fill:var(--accent);fill-opacity:.14}
  .pd-chart .line{stroke:var(--accent);stroke-width:2;fill:none}
  .pd-chart .pd-pt{fill:var(--surface-sunken);stroke:var(--accent);stroke-width:1.5;cursor:pointer;transition:stroke-width var(--dur-1) var(--ease-out)}
  .pd-chart .pd-pt:hover,.pd-chart .pd-pt:focus-visible{stroke-width:2.5;outline:none}
  .pd-tip{position:absolute;transform:translate(-50%,-100%);pointer-events:none;background:var(--surface-3);border:1px solid var(--border-strong);color:var(--text);font-family:var(--f-mono);font-weight:700;font-size:11px;padding:5px 9px;border-radius:var(--r-sm);white-space:nowrap;box-shadow:var(--sh-2);z-index:2}

  /* ── CAREER TIMELINE (token spine + node dots, NO left-edge accent stripe) */
  .pd-tl{position:relative;padding-left:30px}
  .pd-tl::before{content:'';position:absolute;left:7px;top:6px;bottom:6px;width:2px;background:var(--border)}
  .pd-tl-row{position:relative;padding:9px 0}
  .pd-tl-row::before{content:'';position:absolute;left:-29px;top:13px;width:13px;height:13px;border-radius:50%;background:var(--surface-1);border:2px solid var(--border-strong);box-shadow:0 0 0 4px var(--surface-1)}
  .pd-tl-row.record::before{background:var(--accent);border-color:var(--accent)}
  .pd-tl-row .top{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  .pd-tl-row .season{font-family:var(--f-mono);font-weight:700;font-size:11px;color:var(--text-3);min-width:55px;font-variant-numeric:tabular-nums}
  .pd-tl-row .from{font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--text-2)}
  .pd-tl-row .arrow{color:var(--text-3);display:inline-flex;align-items:center}
  .pd-tl-row .to{font-family:var(--f-body);font-weight:800;font-size:14px;color:var(--text)}
  .pd-tl-row .fee{margin-left:auto;font-family:var(--f-mono);font-weight:700;font-size:12px;color:var(--accent-text);font-variant-numeric:tabular-nums}
  .pd-tl-row .fee.free{color:var(--text-2)}
  .pd-tl-rec{margin-left:auto;display:inline-flex;align-items:center;gap:4px;font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.06em;text-transform:uppercase;color:var(--on-accent);background:var(--accent);padding:2px 7px;border-radius:var(--r-xs)}
  .pd-tl-row .pd-tl-rec + .fee{margin-left:10px}

  /* ── TROPHY CHIPS ─────────────────────────────────────────────────────── */
  .pd-honors{display:flex;flex-wrap:wrap;gap:8px}
  .pd-honor{display:inline-flex;align-items:center;gap:7px;background:var(--accent-quiet);border:1px solid var(--accent-line);border-radius:var(--r-sm);padding:8px 12px;font-family:var(--f-body);font-weight:700;font-size:12px;color:var(--text)}
  .pd-honor .wc-ic{color:var(--accent-text)}

  .pd-empty{font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--text-3);line-height:1.45}
  .pd-ext{display:inline-flex;align-items:center;gap:6px;color:var(--text-2);font-family:var(--f-body);font-weight:700;font-size:11px;text-decoration:none;border:1px solid var(--border);background:var(--surface-1);padding:6px 12px;border-radius:var(--r-sm);margin-top:10px;transition:color var(--dur-2) var(--ease-out),border-color var(--dur-2) var(--ease-out),transform var(--dur-1) var(--ease-press)}
  .pd-ext:hover{color:var(--accent-text);border-color:var(--accent-line)}
  .pd-ext:active{transform:scale(.97)}

  .pd-loading{padding:40px 20px;text-align:center;font-family:var(--f-body);font-weight:700;font-size:13px;color:var(--text-3)}
  .pd-loading::before{content:'';display:inline-block;width:14px;height:14px;border:2px solid var(--border-strong);border-top-color:var(--accent);border-radius:50%;animation:wc-spin .9s linear infinite;vertical-align:middle;margin-right:10px}
  .pd-error{padding:24px 18px;font-family:var(--f-body);color:var(--text-2);line-height:1.5}
  .pd-error .ttl{font-family:var(--f-display);font-size:22px;color:var(--text);margin-bottom:10px}
`;

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v != null) e.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

function playPron(btn, url) {
  if (!url || !btn) return;
  const audio = new Audio(url);
  btn.dataset.playing = '1';
  const stop = () => { delete btn.dataset.playing; };
  audio.addEventListener('ended', stop);
  audio.addEventListener('error', stop);
  audio.addEventListener('pause', stop);
  audio.play().catch(stop);
}

export async function renderPlayerInto(container, idOrName, opts = {}) {
  container.classList.add('pd-root');
  container.innerHTML = `<div class="wc-skel-hero"></div><div class="wc-skel-stack"><i></i><i></i><i></i></div>`;

  // Resolution order:
  //   1) numeric tmId    → players.json (sample, 20 entries)
  //   2) `name:<Name>`   → 2026 enrichment squads (full 48-squad roster, no tmId/value)
  //   3) bare name       → either of the above
  const players = await data.getPlayersSample();
  let player = null;
  let source = null;
  let nationalTeamHint = null;

  // (1) Try tmId first.
  if (/^\d+$/.test(String(idOrName))) {
    player = players.find(p => String(p.tmId) === String(idOrName));
    if (player) source = 'sample';
  }
  // (2) Try the `name:` prefix or bare name — exact first, then accent/case-
  //     insensitive fuzzy (by last name) so FIFA's live spellings still resolve.
  if (!player) {
    const name = String(idOrName).replace(/^name:/, '');
    player = players.find(p => p.name === name) || pickByName(players, name, p => p.name);
    if (player) source = 'sample';
    if (!player) {
      const squads = await data.get2026Squads().catch(() => null);
      if (squads && Array.isArray(squads)) {
        let hit = null, teamEntry = null, best = 0;
        for (const te of squads) {
          for (const p of (te.players || [])) {
            if (p.name === name) { hit = p; teamEntry = te; best = 100; break; }
            const s = nameScore(p.name, name);
            if (s > best) { best = s; hit = p; teamEntry = te; }
          }
          if (best === 100) break;
        }
        if (hit && best >= 72) {
          // Synthesize the same shape as a Transfermarkt-sampled player so the
          // rest of render() works unchanged. Most fields are null because
          // the 2026 enrichment squads only carry basic identity.
          player = {
            tmId: null,
            name: hit.name,
            shirtNumber: hit.number || null,
            position: POS_FULL[hit.pos] || hit.pos,
            currentClub: hit.club?.name || null,
            currentLeague: hit.club?.country ? hit.club.country + ' league' : null,
            dateOfBirth: hit.date_of_birth || null,
            age: ageFromDOB(hit.date_of_birth),
            nationality: teamEntry.name,
            nationalTeam: teamEntry.name,
            marketValueEur: null,
            marketValuePeak: null,
            marketValueHistory: [],
            transferHistory: [],
            achievements: [],
            tmUrl: null,
            internationalCaps: null,
            internationalGoals: null,
            _enrichmentSource: 'wc26-squads',
          };
          nationalTeamHint = teamEntry.fifa_code;
          source = 'wc26-squads';
        }
      }
    }
  }

  if (!player) {
    container.innerHTML = `
      <div class="pd-error">
        <div class="ttl">No record for ${escapeHtml(String(idOrName))}.</div>
        Tried both the local Transfermarkt sample (~20 players) and the 2026
        enrichment squads (~1,250 names). Once the full Transfermarkt sweep
        runs, every player URL becomes live.
      </div>`;
    return;
  }

  if (opts.setTitle) opts.setTitle(player.name);

  const team = nationalTeamHint
    ? await data.teamByCode(nationalTeamHint)
    : await data.resolveTeam(player.nationalTeam);
  const prons = await data.getPronunciations().catch(() => null);
  const thumbs = await data.getPlayerThumbs().catch(() => null);

  render({ player, team, prons, thumbs, container, source });
}

const POS_FULL = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
};

function ageFromDOB(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
}

// Accent/case-insensitive name matching so live-feed spellings (e.g. "MESSI",
// "Lionel Andrés Messi") still resolve to a squad entry ("Lionel Messi").
function _normName(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();}
function nameScore(cand, q){
  const c=_normName(cand), n=_normName(q); if(!c||!n) return 0;
  if(c===n) return 100;
  const ct=c.split(' '), nt=n.split(' ');
  const cl=ct[ct.length-1]||'', nl=nt[nt.length-1]||'';
  if(cl && cl===nl){ if(ct[0]===nt[0]) return 92; if((ct[0][0]||'')===(nt[0][0]||'')) return 82; return 72; }
  if(c.includes(n)||n.includes(c)) return 60;
  return 0;
}
function pickByName(list, q, getName){ let best=null,score=0; for(const it of list){const s=nameScore(getName(it),q); if(s>score){score=s;best=it;}} return score>=72?best:null; }

// A one-line "known for" descriptor synthesized from the player's data — trophies
// when we have them, otherwise role + international record + standout value.
function knownForLine(p) {
  if (Array.isArray(p.achievements) && p.achievements.length) {
    return 'Honours: ' + p.achievements.slice(0, 3).join(' · ');
  }
  const bits = [];
  const role = (p.positionDetail && p.positionDetail !== p.position) ? p.positionDetail : p.position;
  if (role) bits.push(role + (p.nationalTeam ? ` for ${p.nationalTeam}` : ''));
  if (p.internationalGoals != null && p.internationalCaps) bits.push(`${p.internationalGoals} ${p.internationalGoals === 1 ? 'goal' : 'goals'} in ${p.internationalCaps} caps`);
  else if (p.internationalCaps) bits.push(`${p.internationalCaps} caps`);
  if (p.marketValuePeak && p.marketValueEur && p.marketValuePeak >= p.marketValueEur * 1.4) bits.push(`peaked at ${eur(p.marketValuePeak)}`);
  else if (p.currentLeague) bits.push(`plays in the ${p.currentLeague}`);
  return bits.length ? bits.slice(0, 3).join(' · ') : null;
}

function render(ctx) {
  const { player, team, prons, container } = ctx;
  container.innerHTML = '';

  // HERO
  const hero = el('div', { class: 'pd-hero' });
  if (player.shirtNumber) hero.appendChild(el('div', { class: 'pd-bigno' }, String(player.shirtNumber)));
  const inner = el('div', { class: 'pd-hero-inner' });

  const portrait = el('div', { class: 'pd-portrait' });
  const thumbEntry = ctx.thumbs && ctx.thumbs.players ? ctx.thumbs.players[player.name] : null;
  const photoUrl = player.localPhotoPath || player.tmPhotoUrl || (thumbEntry && (thumbEntry.cutout || thumbEntry.thumb)) || null;
  if (photoUrl) {
    portrait.classList.add('has-photo');
    portrait.style.backgroundImage = `url(${photoUrl})`;
    portrait.style.backgroundColor = 'transparent';
  } else {
    portrait.appendChild(el('div', { class: 'init' }, initials(player.name)));
    if (player.shirtNumber != null) portrait.appendChild(el('div', { class: 'no' }, `#${player.shirtNumber}`));
    portrait.appendChild(el('div', { class: 'src' }, 'PHOTO TBC'));
  }
  inner.appendChild(portrait);

  const meta = el('div', { class: 'pd-meta' });
  meta.appendChild(el('span', { class: 'pd-pos-pill' }, player.position || 'Player'));
  const parts = (player.name || '').trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : '';
  const first = parts.join(' ');
  const nameEl = el('div', { class: 'pd-name' });
  if (first) nameEl.appendChild(document.createTextNode(first));
  if (last) {
    if (first) nameEl.appendChild(document.createElement('br'));
    nameEl.appendChild(el('span', { class: 'last' }, last));
  }
  if (!first && !last) nameEl.appendChild(document.createTextNode(player.name || 'Unknown'));
  meta.appendChild(nameEl);

  const natLine = el('div', { class: 'pd-nat' });
  if (team) {
    const fl = el('div', { class: 'pd-nat-flag' });
    if (flagSrc(team.fifa_code)) fl.style.backgroundImage = `url(${flagSrc(team.fifa_code)})`;
    natLine.appendChild(fl);
    const link = el('a', { class: 'pd-nat-text', href: `/wc/team/${team.fifa_code}`, 'data-team-code': team.fifa_code },
      `${team.name}${player.currentClub ? ' · ' + player.currentClub : ''}`);
    natLine.appendChild(link);
  } else if (player.nationalTeam) {
    natLine.appendChild(el('span', { class: 'pd-nat-text' }, `${player.nationalTeam}${player.currentClub ? ' · ' + player.currentClub : ''}`));
  }
  const pronUrl = pronounce(prons, player.name, 'players');
  if (pronUrl) {
    const pron = el('button', {
      class: 'pd-pron',
      type: 'button',
      'aria-label': `Hear ${player.name}`,
      onclick: (ev) => playPron(ev.currentTarget, pronUrl),
      html: icon('volume-2', { size: 14 }) + ' Hear name',
    });
    natLine.appendChild(pron);
  }
  meta.appendChild(natLine);
  const known = knownForLine(player);
  if (known) meta.appendChild(el('div', { class: 'pd-tagline' }, known));
  inner.appendChild(meta);
  hero.appendChild(inner);
  container.appendChild(hero);

  // BIO
  const bio = el('div', { class: 'pd-section' });
  bio.appendChild(el('h3', {}, 'Bio'));
  const grid = el('div', { class: 'pd-bio-grid' });
  if (player.dateOfBirth) grid.appendChild(bioCell('Born', player.dateOfBirth + (player.age ? ` · age ${player.age}` : '')));
  else if (player.age != null) grid.appendChild(bioCell('Age', String(player.age), true));
  if (player.position) grid.appendChild(bioCell('Position', player.position));
  if (player.height) grid.appendChild(bioCell('Height', player.height + ' cm'));
  if (player.preferredFoot) grid.appendChild(bioCell('Foot', capitalize(player.preferredFoot)));
  if (player.shirtNumber != null) grid.appendChild(bioCell('Shirt', `#${player.shirtNumber}`, true));
  if (player.secondNationality) grid.appendChild(bioCell('2nd nationality', player.secondNationality));
  if (player.contractUntil) grid.appendChild(bioCell('Contract until', player.contractUntil));
  if (player.currentLeague) grid.appendChild(bioCell('League', player.currentLeague));
  bio.appendChild(grid);
  if (player.tmUrl) bio.appendChild(el('a', { class: 'pd-ext', href: player.tmUrl, target: '_blank', rel: 'noopener', html: 'Transfermarkt profile' + icon('external-link', { size: 13 }) }));
  container.appendChild(bio);

  // MARKET VALUE
  if (player.marketValueEur != null) {
    const mv = el('div', { class: 'pd-section' });
    mv.appendChild(el('h3', {}, 'Market value'));
    const stack = el('div', { class: 'pd-vstack' },
      vCard('Current', eur(player.marketValueEur), true),
      player.marketValuePeak != null ? vCard('All-time peak', eur(player.marketValuePeak)) : null,
      player.internationalCaps != null ? vCard('Caps', String(player.internationalCaps)) : null,
      player.internationalGoals != null ? vCard('Int. goals', String(player.internationalGoals)) : null,
    );
    mv.appendChild(stack);
    if (Array.isArray(player.marketValueHistory) && player.marketValueHistory.length >= 2) {
      mv.appendChild(buildValueChart(player.marketValueHistory));
    }
    container.appendChild(mv);
  }

  // CAREER AGGREGATES — derived from the full transfer + value history, which
  // otherwise only renders as the timeline below. Surfaces the headline numbers.
  const th = Array.isArray(player.transferHistory) ? player.transferHistory : [];
  if (th.length) {
    const totalFees = th.reduce((a, t) => a + (t.feeEur || 0), 0);
    const youthRe = /(U1\d|U2\d|Youth|Jugend|Academy|Reserve|\bII\b|\bB\b)/i;
    const clubs = new Set();
    for (const t of th) for (const c of [t.fromClub, t.toClub]) if (c && !youthRe.test(c)) clubs.add(c);
    const firstDate = th.map(t => t.date).filter(Boolean).sort()[0];
    const sinceYear = firstDate ? String(firstDate).slice(0, 4) : null;
    const cur = player.marketValueEur, peak = player.marketValuePeak;
    const cards = [];
    if (totalFees > 0) cards.push(vCard('Career transfer fees', eur(totalFees), true));
    if (clubs.size) cards.push(vCard('Senior clubs', String(clubs.size)));
    if (sinceYear) cards.push(vCard('Pro since', sinceYear));
    if (cur != null && peak) {
      const pct = Math.round((cur - peak) / peak * 100);
      cards.push(vCard('Now vs peak', pct === 0 ? 'At peak' : `${pct > 0 ? '+' : ''}${pct}%`));
    }
    if (cards.length) {
      const cs = el('div', { class: 'pd-section' });
      cs.appendChild(el('h3', {}, 'Career'));
      cs.appendChild(el('div', { class: 'pd-vstack' }, cards));
      container.appendChild(cs);
    }
  }

  // TRANSFER TIMELINE
  if (th.length) {
    const maxFee = Math.max(0, ...th.map(x => x.feeEur || 0));
    const tr = el('div', { class: 'pd-section' });
    tr.appendChild(el('h3', {}, 'Career timeline'));
    const tl = el('div', { class: 'pd-tl' });
    for (const x of player.transferHistory) {
      const isRecord = maxFee > 0 && x.feeEur === maxFee;
      const row = el('div', { class: 'pd-tl-row' + (isRecord ? ' record' : '') });
      row.appendChild(el('div', { class: 'top' },
        el('span', { class: 'season' }, x.season || ''),
        el('span', { class: 'from' }, x.fromClub || ''),
        el('span', { class: 'arrow', html: icon('arrow-up-right', { size: 13 }) }),
        el('span', { class: 'to' }, x.toClub || ''),
        isRecord ? el('span', { class: 'pd-tl-rec', html: icon('star', { size: 10 }) + 'record' }) : null,
        el('span', { class: 'fee ' + (x.feeEur === 0 ? 'free' : '') }, x.feeDisplay || (x.feeEur ? eur(x.feeEur) : '—')),
      ));
      tl.appendChild(row);
    }
    tr.appendChild(tl);
    container.appendChild(tr);
  }

  // HONORS
  if (Array.isArray(player.achievements) && player.achievements.length) {
    const ho = el('div', { class: 'pd-section' });
    ho.appendChild(el('h3', {}, 'Trophy cabinet'));
    const wrap = el('div', { class: 'pd-honors' });
    for (const ach of player.achievements) wrap.appendChild(el('div', { class: 'pd-honor', html: icon('trophy', { size: 13 }) }, ach));
    ho.appendChild(wrap);
    container.appendChild(ho);
  }

  // TOURNAMENT PERFORMANCE placeholder
  const tp = el('div', { class: 'pd-section' });
  tp.appendChild(el('h3', {}, 'WC 2026 performance'));
  tp.appendChild(el('div', { class: 'pd-empty' },
    'Goals, cards, and appearances populate from live match event timelines as the tournament progresses.'));
  container.appendChild(tp);
}

function bioCell(k, v, big) {
  return el('div', { class: 'pd-bio-cell' },
    el('div', { class: 'k' }, k),
    el('div', { class: 'v' + (big ? ' big' : '') }, v),
  );
}
function vCard(lbl, v, accent) {
  return el('div', { class: 'card' },
    el('div', { class: 'lbl' }, lbl),
    el('div', { class: 'v' + (accent ? ' accent' : '') }, v),
  );
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// Responsive market-value line chart.
//
// The old version used `preserveAspectRatio="none"` inside a fixed `height:200px`
// box: on a narrow phone the 800×200 viewBox was squashed into a ~360×200 box,
// stretching the x-axis, turning the data-point circles into ovals and squishing
// the axis text (the classic SVG distortion documented at css-tricks.com/scale-svg).
//
// The fix (per .handoff/ui-research/05-feedback-dataviz.md §F):
//   • DROP `preserveAspectRatio="none"` — use the implicit default (xMidYMid meet).
//   • `height:auto` (CSS) so the box follows the viewBox aspect ratio, never a
//     fixed pixel height.
//   • A ResizeObserver redraw recomputes the geometry from the element's CURRENT
//     pixel width, so the viewBox always equals the real box → nothing is ever
//     stretched; circles stay round and text stays crisp at any width.
//   • `vector-effect="non-scaling-stroke"` keeps the line a true 2px.
// All colours come from CSS classes (token-driven) so it's correct in both themes.
function buildValueChart(history) {
  const wrap = el('div', { class: 'pd-chart' });

  const points = history
    .map(p => ({ t: new Date(p.date).getTime(), v: +p.valueEur || 0 }))
    .filter(p => !isNaN(p.t) && p.v > 0)
    .sort((a, b) => a.t - b.t);
  if (points.length < 2) return wrap;

  const minT = points[0].t, maxT = points[points.length - 1].t;
  const maxV = Math.max(...points.map(p => p.v));
  const yLabels = [maxV, maxV / 2, 0];

  function draw() {
    const cssW = Math.max(280, Math.round(wrap.clientWidth || 600));
    const H = Math.round(Math.min(240, Math.max(150, cssW * 0.42)));
    const PAD_L = 52, PAD_R = 14, PAD_T = 14, PAD_B = 30;
    const sx = (t) => PAD_L + (t - minT) / (maxT - minT || 1) * (cssW - PAD_L - PAD_R);
    const sy = (v) => PAD_T + (1 - v / (maxV || 1)) * (H - PAD_T - PAD_B);
    const line = points.map((p, i) => `${i ? 'L' : 'M'} ${sx(p.t).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(' ');
    const area = `${line} L ${sx(maxT).toFixed(1)} ${(H - PAD_B).toFixed(1)} L ${sx(minT).toFixed(1)} ${(H - PAD_B).toFixed(1)} Z`;
    const years = Array.from(new Set(points.map(p => new Date(p.t).getFullYear()))).sort();

    // viewBox now matches cssW × H (1:1 with pixels); DEFAULT preserveAspectRatio.
    wrap.innerHTML = `
      <svg viewBox="0 0 ${cssW} ${H}" role="img"
           aria-label="Market value history from ${new Date(minT).getFullYear()} to ${new Date(maxT).getFullYear()}, peak ${eur(maxV)}">
        <title>Market value over time</title>
        ${yLabels.map(v => {
          const y = sy(v).toFixed(1);
          return `<line class="grid" x1="${PAD_L}" x2="${cssW - PAD_R}" y1="${y}" y2="${y}" stroke-dasharray="3 4"/>`
            + `<text class="axis" x="${PAD_L - 8}" y="${(+y + 3).toFixed(1)}" text-anchor="end">${eur(v)}</text>`;
        }).join('')}
        <path class="area" d="${area}"/>
        <path class="line" d="${line}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        ${points.map(p => {
          const cx = sx(p.t).toFixed(1), cy = sy(p.v).toFixed(1);
          return `<circle class="pd-pt" tabindex="0" role="graphics-symbol"`
            + ` aria-label="${new Date(p.t).getFullYear()}: ${eur(p.v)}"`
            + ` data-label="${new Date(p.t).toLocaleDateString()} · ${eur(p.v)}"`
            + ` cx="${cx}" cy="${cy}" r="3.5"/>`;
        }).join('')}
        ${years.map((y, i, arr) => {
          if (arr.length > 8 && i % 2) return '';
          const t = Math.max(minT, Math.min(maxT, new Date(y + '-06-01').getTime()));
          return `<text class="axis" x="${sx(t).toFixed(1)}" y="${(H - 8).toFixed(1)}" text-anchor="middle">${y}</text>`;
        }).join('')}
      </svg>
      <div class="pd-tip" role="status" aria-live="polite" hidden></div>`;

    // Hover/focus tooltip (pointer + keyboard). Mirrors into an aria-live node.
    const svg = wrap.querySelector('svg'), tip = wrap.querySelector('.pd-tip');
    const show = (c) => {
      const r = c.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      tip.textContent = c.getAttribute('data-label');
      tip.style.left = (r.left - wr.left + r.width / 2) + 'px';
      tip.style.top = (r.top - wr.top - 8) + 'px';
      tip.hidden = false;
    };
    const hide = () => { tip.hidden = true; };
    svg.querySelectorAll('.pd-pt').forEach(c => {
      c.addEventListener('mouseenter', () => show(c));
      c.addEventListener('mouseleave', hide);
      c.addEventListener('focus', () => show(c));
      c.addEventListener('blur', hide);
    });
  }

  draw();
  if (typeof ResizeObserver !== 'undefined') {
    let raf;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); });
    ro.observe(wrap);
  } else {
    window.addEventListener('resize', () => requestAnimationFrame(draw));
  }
  return wrap;
}
