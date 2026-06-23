// Shared renderer for the Player Dossier view.

import * as data from './data.js';
import { flagSrc } from './flags.js';
import { eur, initials } from './format.js';
import { pronounce } from './data.js';

export const playerCss = `
  .pd-root{position:relative;container-type:inline-size}
  .pd-hero{position:relative;overflow:hidden;padding:clamp(18px,4cqi,56px);background:radial-gradient(120% 120% at 88% 0%,rgba(245,199,18,0.13),transparent 58%);border-radius:18px;animation:wc-reveal-up .6s cubic-bezier(.34,1.56,.64,1) both}
  .pd-bigno{position:absolute;right:-2%;top:-16%;font-family:Anton;font-size:clamp(160px,46cqi,520px);color:rgba(245,199,18,0.06);line-height:1;pointer-events:none;z-index:0;user-select:none}
  .pd-hero-inner{position:relative;z-index:1;display:flex;align-items:flex-end;gap:clamp(14px,3cqi,34px);flex-wrap:wrap}
  .pd-portrait{width:clamp(86px,24cqi,240px);aspect-ratio:3/4;flex:none;border-radius:16px;overflow:hidden;background:linear-gradient(165deg,#1c241a,#0c1310);border:1px solid #26341f;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 24px 50px -22px rgba(0,0,0,0.9);position:relative;background-size:cover;background-position:center}
  .pd-portrait::before{content:'';position:absolute;inset:0;background-image:repeating-linear-gradient(135deg,rgba(245,199,18,0.05) 0 2px,transparent 2px 11px)}
  .pd-portrait .init{font-family:Anton;font-size:clamp(36px,11cqi,96px);color:#8aa68a;line-height:0.8;position:relative}
  .pd-portrait .no{font-family:Anton;font-size:clamp(18px,4cqi,40px);color:#f5c712;position:relative;margin-top:6px}
  .pd-portrait .src{position:absolute;bottom:8px;font-family:JetBrains Mono,monospace;font-weight:500;font-size:9px;letter-spacing:0.08em;color:#4a5a4a}
  .pd-meta{flex:1;min-width:0}
  .pd-pos-pill{display:inline-block;font-family:Archivo Expanded,Archivo;font-weight:800;font-size:clamp(9px,1.4cqi,14px);letter-spacing:0.16em;text-transform:uppercase;color:#f5c712;background:rgba(245,199,18,0.1);padding:5px 13px;border-radius:999px}
  .pd-name{font-family:Anton;font-size:clamp(32px,11cqi,124px);line-height:0.82;text-transform:uppercase;margin-top:12px;color:#f4f2ea}
  .pd-name .last{color:#f5c712}
  .pd-nat{display:flex;align-items:center;gap:11px;margin-top:14px;flex-wrap:wrap}
  .pd-nat-flag{width:clamp(34px,6cqi,62px);height:clamp(26px,4.5cqi,46px);flex:none;border-radius:6px;background-size:cover;background-position:center}
  .pd-nat-text{font-family:Archivo;font-weight:700;font-size:clamp(12px,1.6cqi,19px);color:#9bbaa2;text-decoration:none}
  a.pd-nat-text:hover{color:#f5c712}
  .pd-pron{display:inline-flex;align-items:center;gap:6px;margin-left:10px;background:rgba(245,199,18,0.12);border:1px solid rgba(245,199,18,0.3);border-radius:999px;padding:5px 12px;font-family:Archivo;font-weight:800;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#f5c712;cursor:pointer}
  .pd-pron:hover{background:rgba(245,199,18,0.22)}
  .pd-pron svg .wv{opacity:.55}
  .pd-pron[data-playing="1"] svg .wv1{animation:pron-wv 0.9s ease-in-out infinite}
  .pd-pron[data-playing="1"] svg .wv2{animation:pron-wv 0.9s ease-in-out infinite 0.18s}
  @keyframes pron-wv{0%,100%{opacity:.15}50%{opacity:1}}

  .pd-section{background:#0e1610;border:1px solid #18241a;border-radius:16px;padding:18px 20px;margin-top:14px;animation:wc-reveal-up .55s ease both;container-type:inline-size}
  .pd-section h3{font-family:Archivo;font-weight:900;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#f5c712;margin-bottom:14px}

  .pd-bio-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px}
  .pd-bio-cell .k{font-family:Archivo;font-weight:800;font-size:9px;color:#3a5a3a;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:5px}
  .pd-bio-cell .v{font-family:Archivo;font-weight:700;font-size:14px;color:#dfe6df}
  .pd-bio-cell .v.big{font-family:Anton;font-size:24px;color:#f4f2ea}

  .pd-vstack{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:14px}
  .pd-vstack .card{background:#0c1310;border:1px solid #16201a;border-radius:10px;padding:12px 14px}
  .pd-vstack .lbl{font-family:Archivo;font-weight:800;font-size:9px;color:#3a5a3a;letter-spacing:0.12em;text-transform:uppercase}
  .pd-vstack .v{font-family:JetBrains Mono,monospace;font-weight:700;font-size:24px;color:#f4f2ea;margin-top:6px}
  .pd-vstack .v.accent{color:#f5c712}

  .pd-chart{width:100%;height:200px;background:#0c1310;border:1px solid #16201a;border-radius:10px;padding:14px}
  .pd-chart svg{width:100%;height:100%;display:block}

  .pd-tl{position:relative;padding-left:30px}
  .pd-tl::before{content:'';position:absolute;left:7px;top:6px;bottom:6px;width:2px;background:linear-gradient(#1e2a1e,#2a3a2a)}
  .pd-tl-row{position:relative;padding:9px 0}
  .pd-tl-row::before{content:'';position:absolute;left:-29px;top:13px;width:14px;height:14px;border-radius:50%;background:#f5c712;box-shadow:0 0 0 4px #0e1610}
  .pd-tl-row .top{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
  .pd-tl-row .season{font-family:JetBrains Mono,monospace;font-weight:700;font-size:11px;color:#5a7a5a;min-width:55px}
  .pd-tl-row .from{font-family:Archivo;font-weight:600;font-size:13px;color:#9bbaa2}
  .pd-tl-row .arrow{color:#3a5a3a}
  .pd-tl-row .to{font-family:Archivo;font-weight:800;font-size:14px;color:#f4f2ea}
  .pd-tl-row .fee{margin-left:auto;font-family:JetBrains Mono,monospace;font-weight:700;font-size:12px;color:#f5c712}
  .pd-tl-row .fee.free{color:#9bbaa2}
  .pd-tl-rec{margin-left:auto;font-family:Archivo;font-weight:800;font-size:9px;letter-spacing:0.06em;text-transform:uppercase;color:#0a0e0c;background:#f5c712;padding:2px 7px;border-radius:5px}
  .pd-tl-row .pd-tl-rec + .fee{margin-left:10px}

  .pd-honors{display:flex;flex-wrap:wrap;gap:8px}
  .pd-honor{background:rgba(245,199,18,0.06);border:1px solid rgba(245,199,18,0.18);border-radius:8px;padding:8px 12px;font-family:Archivo;font-weight:700;font-size:12px;color:#f4f2ea}

  .pd-empty{font-family:Archivo;font-weight:600;font-size:13px;color:#4a5a4a;line-height:1.45}
  .pd-ext{display:inline-flex;align-items:center;gap:5px;color:#9bbaa2;font-family:Archivo;font-weight:700;font-size:11px;text-decoration:none;border:1px solid #2a3a2a;padding:6px 10px;border-radius:6px;margin-top:8px}
  .pd-ext:hover{color:#f5c712;border-color:#f5c712}

  .pd-loading{padding:40px 20px;text-align:center;font-family:Archivo;font-weight:700;font-size:13px;color:#5a6a5a}
  .pd-loading::before{content:'';display:inline-block;width:14px;height:14px;border:2px solid #2a3a2a;border-top-color:#f5c712;border-radius:50%;animation:wc-spin .9s linear infinite;vertical-align:middle;margin-right:10px}
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

function pronIconSvg(size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 14 14" fill="none" aria-hidden="true">`
    + `<path d="M2 5v4h2l3 2.5V2.5L4 5H2z" fill="currentColor"/>`
    + `<path class="wv wv1" d="M9 5c.8.8.8 3.2 0 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>`
    + `<path class="wv wv2" d="M11 3.5c1.5 1.5 1.5 5.5 0 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/>`
    + `</svg>`;
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
  container.innerHTML = `<div class="pd-loading">Loading player…</div>`;

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
      <div style="padding:24px 18px;font-family:Archivo;color:#9bbaa2;line-height:1.5">
        <div style="font-family:Anton;font-size:22px;color:#f4f2ea;margin-bottom:10px">No record for ${escapeHtml(String(idOrName))}.</div>
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
    },
      el('span', { html: pronIconSvg(14) }),
      ' Hear name');
    natLine.appendChild(pron);
  }
  meta.appendChild(natLine);
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
  if (player.tmUrl) bio.appendChild(el('a', { class: 'pd-ext', href: player.tmUrl, target: '_blank', rel: 'noopener' }, 'Transfermarkt profile ↗'));
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
      const row = el('div', { class: 'pd-tl-row' });
      const isRecord = maxFee > 0 && x.feeEur === maxFee;
      row.appendChild(el('div', { class: 'top' },
        el('span', { class: 'season' }, x.season || ''),
        el('span', { class: 'from' }, x.fromClub || ''),
        el('span', { class: 'arrow' }, '→'),
        el('span', { class: 'to' }, x.toClub || ''),
        isRecord ? el('span', { class: 'pd-tl-rec' }, '★ record') : null,
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
    for (const ach of player.achievements) wrap.appendChild(el('div', { class: 'pd-honor' }, ach));
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

function buildValueChart(history) {
  const wrap = el('div', { class: 'pd-chart' });
  const W = 800, H = 200, PAD_L = 50, PAD_R = 14, PAD_T = 12, PAD_B = 32;
  const points = history
    .map(p => ({ t: new Date(p.date).getTime(), v: +p.valueEur || 0 }))
    .filter(p => !isNaN(p.t) && p.v > 0)
    .sort((a, b) => a.t - b.t);
  if (points.length < 2) return wrap;
  const minT = points[0].t, maxT = points[points.length - 1].t;
  const maxV = Math.max(...points.map(p => p.v));
  const sx = (t) => PAD_L + (t - minT) / (maxT - minT) * (W - PAD_L - PAD_R);
  const sy = (v) => PAD_T + (1 - v / maxV) * (H - PAD_T - PAD_B);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.t).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(' ');
  const areaD = `${d} L ${sx(maxT).toFixed(1)} ${H - PAD_B} L ${sx(minT).toFixed(1)} ${H - PAD_B} Z`;
  const years = new Set();
  for (const p of points) years.add(new Date(p.t).getFullYear());
  const yearArr = Array.from(years).sort();
  const yLabels = [maxV, maxV / 2, 0];

  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pd-g1" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#f5c712" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#f5c712" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${yLabels.map(v => {
        const y = sy(v);
        return `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y}" y2="${y}" stroke="#1c241f" stroke-dasharray="3 4"/>
                <text x="${PAD_L - 8}" y="${y + 3}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" fill="#5a7a5a">${eur(v)}</text>`;
      }).join('')}
      <path d="${areaD}" fill="url(#pd-g1)"/>
      <path d="${d}" stroke="#f5c712" stroke-width="2" fill="none" stroke-linejoin="round"/>
      ${points.map(p => `<circle cx="${sx(p.t).toFixed(1)}" cy="${sy(p.v).toFixed(1)}" r="2.5" fill="#0a0e0c" stroke="#f5c712" stroke-width="1.5"/>`).join('')}
      ${yearArr.map((y, i, arr) => {
        if (arr.length > 8 && i % 2) return '';
        const t = new Date(y + '-06-01').getTime();
        const x = sx(Math.max(minT, Math.min(maxT, t)));
        return `<text x="${x}" y="${H - 8}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#5a7a5a">${y}</text>`;
      }).join('')}
    </svg>`;
  return wrap;
}
