// Shared renderer for the Game Detail view.
// Used by /wc/game/[id] (fullscreen) AND by the popup overlay opened from
// fixtures / groups / bracket lists. Same content in both, different chrome.

import * as api from './api.js';
import * as data from './data.js';
import { flagSrc } from './flags.js';
import { dayLabel, dayLong, timeLabel, eur, initials, countdown as fmtCountdown, PHASE_LABEL, ROUND_LABEL } from './format.js';
import { pronounce } from './data.js';
import { liveCss, renderLiveInto } from './render-live.js';
import { icon } from './icons.js';

export const gameCss = `
  .gd-root{position:relative}
  .gd-phase-pill{display:inline-flex;align-items:center;gap:6px;font-family:var(--f-body);font-weight:900;font-size:11px;letter-spacing:0.07em;text-transform:uppercase;padding:4px 10px;border-radius:var(--r-xs)}
  .gd-phase-pill .d{width:7px;height:7px;border-radius:50%;background:currentColor}
  .gd-phase-pill.pre  {color:var(--accent-text);background:var(--accent-quiet)}
  .gd-phase-pill.live {color:var(--live-ink);background:var(--live)}
  .gd-phase-pill.live .d{background:var(--live-ink);animation:wc-dot-pulse 1.3s ease-in-out infinite}
  .gd-phase-pill.post {color:var(--text-2);background:var(--surface-2);border:1px solid var(--border)}
  .gd-stage{font-family:var(--f-body);font-weight:800;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-3);margin-left:10px}

  .gd-scoreboard{display:grid;grid-template-columns:1fr auto 1fr;align-items:start;gap:clamp(10px,3vw,46px);margin-top:18px;animation:wc-reveal-up .55s var(--ease-press) both}
  .gd-team{display:flex;flex-direction:column;align-items:center;gap:12px;min-width:0;text-decoration:none;color:inherit;transition:transform var(--dur-2) var(--ease-press),filter var(--dur-2);cursor:pointer}
  .gd-team:hover{transform:scale(1.04);filter:drop-shadow(0 0 10px var(--accent-line))}
  .gd-team:focus-visible{outline:2px solid var(--accent);outline-offset:4px;border-radius:var(--r-md)}
  .gd-flag{width:clamp(70px,13cqi,150px);height:clamp(52px,9.7cqi,112px);border-radius:11px;background-size:cover;background-position:center;box-shadow:var(--sh-3)}
  .gd-flag.empty{background:repeating-linear-gradient(135deg,var(--surface-2) 0 6px,var(--surface-3) 6px 12px);display:flex;align-items:center;justify-content:center;font-family:var(--f-display);font-size:clamp(26px,5cqi,52px);color:var(--text-3)}
  .gd-code{font-family:var(--f-display);font-size:clamp(30px,7cqi,80px);letter-spacing:0.02em;line-height:0.9;text-align:center;color:var(--text)}
  .gd-name{font-family:var(--f-body);font-weight:600;font-size:clamp(11px,1.3cqi,16px);color:var(--text-3);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .gd-middle{display:flex;flex-direction:column;align-items:center;gap:9px;padding-top:clamp(8px,2cqi,28px)}
  .gd-score{font-family:var(--f-display);font-size:clamp(40px,10cqi,124px);line-height:0.82;letter-spacing:-0.02em;white-space:nowrap;color:var(--text);font-variant-numeric:tabular-nums}
  .gd-score.pre{color:var(--accent-text)}
  .gd-score.live{color:var(--live)}
  .gd-time{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-body);font-weight:800;font-size:clamp(10px,1.3cqi,15px);letter-spacing:0.12em;text-transform:uppercase;white-space:nowrap;color:var(--text-3)}
  .gd-time.live{color:var(--live)}
  .gd-time.live::before{content:'';width:8px;height:8px;border-radius:50%;background:currentColor;animation:wc-dot-pulse 1.3s ease-in-out infinite}
  .gd-time.post{color:var(--text-2)}
  .gd-annot{font-family:var(--f-body);font-weight:800;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-2);background:var(--surface-2);padding:4px 11px;border-radius:var(--r-pill);text-align:center}

  .gd-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:9px;margin-top:clamp(18px,3cqi,34px);animation:wc-reveal-up .6s var(--ease-out) .12s both}
  .gd-chip{background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 16px;text-align:center}
  .gd-chip .lbl{display:inline-flex;align-items:center;gap:5px;font-family:var(--f-body);font-weight:900;font-size:9px;letter-spacing:0.12em;color:var(--text-3);text-transform:uppercase}
  .gd-chip .lbl .wc-ic{color:var(--text-3)}
  .gd-chip .val{font-family:var(--f-body);font-weight:700;font-size:13px;color:var(--text);margin-top:4px}

  .gd-section{background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px 20px;margin-top:14px;animation:wc-reveal-up .55s var(--ease-out) both}
  .gd-section h3{display:flex;align-items:center;gap:7px;font-family:var(--f-body);font-weight:900;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent-text);margin-bottom:14px}
  .gd-section h3 .wc-ic{color:var(--accent-text)}
  /* Icon-wrapper spans align cleanly in flex headers/labels (SVGs are inline by default). */
  .gd-ico{display:inline-flex;align-items:center}
  .gd-section h3.muted{color:var(--text-3)}
  .gd-section h3 .note{color:var(--text-3);font-weight:700;letter-spacing:0.06em;margin-left:8px}

  /* What's at stake (forecast) — tinted with the two teams' real colours (--home/--away set in JS) */
  .gd-stakes{--home:var(--accent-text);--home-rgb:212,175,55;--away:var(--away-text);--away-rgb:91,141,214}
  .gd-stk-odds{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .gd-stk-team{background:var(--surface-2);border:1px solid var(--border-subtle);border-radius:var(--r-md);padding:12px 14px}
  .gd-stk-team.home{box-shadow:inset 3px 0 0 var(--home)} .gd-stk-team.away{box-shadow:inset 3px 0 0 var(--away)}
  .gd-stk-team .who{display:flex;align-items:center;gap:8px;font-family:var(--f-display);font-size:16px;color:var(--text);margin-bottom:8px}
  .gd-stk-team .who .fl{width:22px;height:15px;border-radius:3px;flex:none;background-size:cover;background-position:center}
  .gd-stk-team .big{font-family:var(--f-display);font-size:30px;line-height:.9}
  .gd-stk-team.home .big{color:var(--home)} .gd-stk-team.away .big{color:var(--away)}
  .gd-stk-team .big i{font-style:normal;font-size:14px;opacity:.6;margin-left:1px}
  .gd-stk-team .big.thru{color:var(--success-text)!important;font-size:22px}
  .gd-stk-team .big.out{color:var(--text-disabled)!important;font-size:18px}
  .gd-stk-team .cap{font-family:var(--f-body);font-weight:700;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-top:4px}
  .gd-stk-team .track{height:6px;border-radius:99px;background:var(--surface-sunken);overflow:hidden;margin-top:9px}
  .gd-stk-team .fill{height:100%;border-radius:99px}
  .gd-stk-team.home .fill{background:var(--home)} .gd-stk-team.away .fill{background:var(--away)}
  .gd-stk-team .fill.thru{background:var(--success)!important}
  .gd-stk-scen{margin-top:16px}
  .gd-stk-scen .lbl{font-family:var(--f-body);font-weight:900;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:9px}
  .gd-stk-grid{display:flex;flex-direction:column;gap:9px}
  .gd-stk-srow{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center;background:var(--surface-2);border:1px solid var(--border-subtle);border-radius:var(--r-md);padding:11px 14px}
  .gd-stk-res{font-family:var(--f-body);font-weight:900;font-size:11px;letter-spacing:.03em;text-transform:uppercase;text-align:center;padding:8px 11px;border-radius:var(--r-xs);background:var(--surface-sunken);color:var(--text-2);line-height:1.05;white-space:nowrap}
  .gd-stk-res.home{background:rgba(var(--home-rgb),.16);color:var(--home)}
  .gd-stk-res.away{background:rgba(var(--away-rgb),.16);color:var(--away)}
  .gd-stk-res.draw{background:var(--surface-sunken);color:var(--text-3)}
  .gd-stk-cell{min-width:0}
  .gd-stk-ctop{display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin-bottom:7px}
  .gd-stk-ctop .tc{font-family:var(--f-display);font-size:13px;color:var(--text-3);letter-spacing:.02em}
  .gd-stk-ctop .pg{display:inline-flex;align-items:baseline;gap:4px}
  .gd-stk-ctop .pv{font-family:var(--f-mono);font-weight:800;font-size:15px;font-variant-numeric:tabular-nums;color:var(--text)}
  .gd-stk-ctop .pv.thru{color:var(--success-text)}
  .gd-stk-ctop .pv.out{color:var(--text-disabled);font-family:var(--f-body);font-size:10px;font-weight:900;letter-spacing:.08em}
  .gd-stk-ctop .dd{font-size:10px;font-weight:800}
  .gd-stk-ctop .dd.up{color:var(--success-text)} .gd-stk-ctop .dd.dn{color:var(--danger-text)}
  .gd-stk-cbar{height:5px;border-radius:99px;background:var(--surface-sunken);overflow:hidden;display:flex}
  .gd-stk-cbar.away{justify-content:flex-end}
  .gd-stk-cbar .f{height:100%;border-radius:99px;transition:width var(--dur-3) var(--ease-out)}
  .gd-stk-cbar .f.home{background:var(--home)} .gd-stk-cbar .f.away{background:var(--away)}
  .gd-stk-cbar .f.thru{background:var(--success)!important}

  .gd-storyline{background:var(--accent-quiet);border:1px solid var(--accent-line);border-radius:var(--r-lg);padding:16px 22px;margin-top:18px}
  .gd-storyline h3{display:flex;align-items:center;gap:7px;margin-bottom:7px;font-family:var(--f-body);font-weight:900;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent-text)}
  .gd-storyline h3 .wc-ic{color:var(--accent-text)}
  .gd-storyline p{font-family:var(--f-body);font-weight:600;font-size:clamp(14px,1.5vw,19px);line-height:1.4;color:var(--text)}

  .gd-tot-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
  .gd-tot-header .ttl{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-body);font-weight:900;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent-text)}
  .gd-tot-header .ttl .wc-ic{color:var(--accent-text)}
  .gd-tot-header .sub{font-family:var(--f-body);font-weight:700;font-size:9px;color:var(--text-3);letter-spacing:0.08em;text-transform:uppercase}
  .gd-tot-row{display:grid;grid-template-columns:64px 1fr 64px;align-items:center;gap:16px;margin:16px 0}
  .gd-tot-row .v1{font-family:var(--f-display);font-size:clamp(16px,2.2vw,22px);color:var(--accent-text);text-align:right;font-variant-numeric:tabular-nums}
  .gd-tot-row .v2{font-family:var(--f-display);font-size:clamp(16px,2.2vw,22px);color:var(--away-text);font-variant-numeric:tabular-nums}
  .gd-tot-row .lbl{font-family:var(--f-body);font-weight:800;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);text-align:center;margin-bottom:7px}
  .gd-tot-bar{display:flex;height:8px;border-radius:var(--r-pill);overflow:hidden;background:var(--surface-2)}
  .gd-tot-bar .a{height:100%;background:var(--accent);transform-origin:left;animation:wc-grow-x .7s var(--ease-out) both}
  .gd-tot-bar .b{height:100%;background:var(--away);transform-origin:right;animation:wc-grow-x .7s var(--ease-out) both}

  .gd-stand-head{display:grid;grid-template-columns:26px 1fr 40px 40px 40px;gap:6px;padding:0 8px 8px;font-family:var(--f-body);font-weight:900;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-3)}
  .gd-stand-row{display:grid;grid-template-columns:26px 1fr 40px 40px 40px;gap:6px;align-items:center;padding:9px 8px;border-radius:var(--r-sm);margin-bottom:2px;transition:background var(--dur-2)}
  a.gd-stand-row:hover{background:var(--surface-2)}
  a.gd-stand-row:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
  .gd-stand-row .flag{width:24px;height:17px;flex:none;border-radius:3px;background-size:cover;background-position:center;box-shadow:0 0 0 1px rgba(0,0,0,.2)}
  .gd-stand-name{display:flex;align-items:center;gap:9px;min-width:0}
  .gd-stand-name span{font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .gd-stand-pos{font-family:var(--f-display);font-size:15px;color:var(--text-3);text-align:center}
  .gd-stand-g{text-align:center;font-family:var(--f-body);font-weight:700;font-size:13px;color:var(--text-2);font-variant-numeric:tabular-nums}
  .gd-stand-p{text-align:center;font-family:var(--f-display);font-size:18px;color:var(--text);font-variant-numeric:tabular-nums}
  .gd-stand-row.q{background:var(--success-quiet)}
  .gd-stand-row.q .gd-stand-pos{color:var(--success-text)}
  .gd-stand-row.me{background:var(--accent-quiet)}
  .gd-stand-row.me .gd-stand-name span{color:var(--text);font-weight:800}
  .gd-stand-row.me .gd-stand-pos,.gd-stand-row.me .gd-stand-p{color:var(--accent-text)}
  .gd-stand-legend{display:flex;flex-wrap:wrap;gap:16px;margin-top:10px}
  .gd-stand-legend span{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-body);font-size:11px;color:var(--text-2)}
  .gd-stand-legend i{width:12px;height:12px;border-radius:3px;display:inline-block}

  .gd-h2h-summary{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;margin-bottom:14px}
  .gd-h2h-summary .col{text-align:center}
  .gd-h2h-summary .label{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.1em;color:var(--text-3);text-transform:uppercase}
  .gd-h2h-summary .big{font-family:var(--f-display);font-size:clamp(26px,4vw,42px);line-height:1;margin-top:6px;color:var(--text);font-variant-numeric:tabular-nums}
  .gd-h2h-summary .big.home{color:var(--accent-text)}
  .gd-h2h-summary .big.away{color:var(--away-text)}
  .gd-h2h-summary .big.draws{color:var(--text-2)}
  .gd-h2h-agg{text-align:center;font-family:var(--f-body);font-weight:600;font-size:11px;color:var(--text-3);margin-bottom:10px}
  .gd-h2h-sub{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.1em;color:var(--text-3);text-transform:uppercase;margin-top:14px;margin-bottom:6px}
  .gd-h2h-last{display:grid;grid-template-columns:80px 1fr auto 1fr;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--border-subtle)}
  .gd-h2h-last .when{font-family:var(--f-mono);font-weight:700;font-size:11px;color:var(--text-3);font-variant-numeric:tabular-nums}
  .gd-h2h-last .a, .gd-h2h-last .b{font-family:var(--f-body);font-weight:700;font-size:13px;color:var(--text-2)}
  .gd-h2h-last .a{text-align:right}
  .gd-h2h-last .b{text-align:left}
  .gd-h2h-last .score{font-family:var(--f-display);font-size:16px;color:var(--accent-text);text-align:center;min-width:54px;font-variant-numeric:tabular-nums}
  .gd-muted-note{font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--text-3)}

  .gd-kp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
  .gd-kp-card .ttl{display:flex;align-items:center;gap:6px;font-family:var(--f-body);font-weight:900;font-size:9px;letter-spacing:0.1em;color:var(--text-3);text-transform:uppercase;margin-bottom:12px}
  .gd-kp-row{display:flex;align-items:center;gap:11px;padding:8px 0;border-top:1px solid var(--border-subtle);text-decoration:none;color:inherit;transition:background var(--dur-2)}
  .gd-kp-row:first-of-type{border-top:none}
  .gd-kp-row:hover{background:var(--surface-2)}
  .gd-kp-row:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:var(--r-sm)}
  .gd-kp-portrait{width:40px;height:40px;flex:none}
  .gd-kp-portrait.wc-avatar{font-size:14px}
  .gd-kp-info{flex:1;min-width:0}
  .gd-kp-info .name{font-family:var(--f-body);font-weight:700;font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .gd-kp-info .pos{font-family:var(--f-body);font-weight:600;font-size:12px;color:var(--text-3)}
  .gd-kp-val{font-family:var(--f-mono);font-weight:700;font-size:13px;color:var(--accent-text)}
  .gd-kp-empty{font-family:var(--f-body);font-weight:600;font-size:12px;color:var(--text-3);padding:6px 0}

  .gd-events{position:relative;padding-left:30px}
  .gd-events::before{content:'';position:absolute;left:7px;top:6px;bottom:6px;width:2px;background:var(--border-strong)}
  .gd-event{position:relative;padding-bottom:16px}
  .gd-event .dot{position:absolute;left:-30px;top:2px;width:16px;height:16px;border-radius:50%;box-shadow:0 0 0 4px var(--surface-1)}
  .gd-event .min{font-family:var(--f-mono);font-weight:700;font-size:14px;min-width:38px;display:inline-block;font-variant-numeric:tabular-nums}
  .gd-event .type{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.06em;text-transform:uppercase;border-radius:var(--r-xs);padding:2px 7px}
  .gd-event .who{font-family:var(--f-body);font-weight:800;font-size:13px;color:var(--text);margin-left:8px}
  a.gd-plink{color:inherit;text-decoration:none;cursor:pointer;transition:color var(--dur-1)}
  a.gd-plink:hover{color:var(--accent-text)}
  a.gd-plink:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:3px}
  .gd-event .team{font-family:var(--f-body);font-weight:700;font-size:10px;color:var(--text-3);margin-left:8px}
  .gd-event .detail{font-family:var(--f-body);font-weight:600;font-size:11px;color:var(--text-3);margin-top:2px;display:block;margin-left:46px}
  .gd-event-goal{--c:var(--accent-text);--bg:var(--accent-quiet)}
  .gd-event-yellow{--c:var(--warning);--bg:var(--warning-quiet)}
  .gd-event-red{--c:var(--danger-text);--bg:var(--danger-quiet)}
  .gd-event-sub{--c:var(--away-text);--bg:var(--away-quiet)}

  .gd-stat-row{margin-bottom:13px}
  .gd-stat-row .head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}
  .gd-stat-row .v1{font-family:var(--f-display);font-size:16px;color:var(--accent-text);font-variant-numeric:tabular-nums}
  .gd-stat-row .v2{font-family:var(--f-display);font-size:16px;color:var(--away-text);font-variant-numeric:tabular-nums}
  .gd-stat-row .lbl{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-3)}
  .gd-stat-row .bar{display:flex;height:8px;border-radius:var(--r-pill);overflow:hidden;background:var(--surface-2)}
  .gd-stat-row .bar .f1{background:var(--accent)}
  .gd-stat-row .bar .f2{background:var(--away)}
  .gd-stat-pending{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;padding:7px 0;border-top:1px solid var(--border-subtle)}
  .gd-stat-pending .lbl{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-3)}
  .gd-stat-pending .v{font-family:var(--f-body);font-weight:700;font-size:10px;color:var(--text-3);letter-spacing:0.04em}

  .gd-weather-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:1px;background:var(--border-subtle);border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden}
  .gd-weather-cell{background:var(--surface-1);padding:14px 10px;text-align:center}
  .gd-weather-cell .ic{display:flex;justify-content:center;color:var(--text-3);margin-bottom:6px}
  .gd-weather-cell .v{font-family:var(--f-display);font-size:22px;color:var(--text);font-variant-numeric:tabular-nums}
  .gd-weather-cell .v.warm{color:var(--accent-text)}
  .gd-weather-cell .v.cool{color:var(--away-text)}
  .gd-weather-cell .lbl{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-3);margin-top:6px}

  .gd-sc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
  .gd-sc-card .ttl{display:flex;align-items:center;gap:6px;font-family:var(--f-body);font-weight:900;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px}
  .gd-sc-card .ttl .wc-ic{color:var(--accent-text)}
  .gd-sc-card .row{font-family:var(--f-body);font-weight:700;font-size:13px;color:var(--text);padding:2px 0}
  .gd-sc-card .row.empty{color:var(--text-3)}
  .gd-sc-card .mins{color:var(--text-3);font-weight:600;font-variant-numeric:tabular-nums}

  .gd-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}

  .gd-shootout-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  .gd-shootout-row .code{font-family:var(--f-body);font-weight:800;font-size:11px;color:var(--text);min-width:42px}
  .gd-shootout-row .dots{display:flex;gap:6px}
  .gd-shootout-row .k{width:15px;height:15px;border-radius:50%;display:inline-block}
  .gd-shootout-row .k.ok{background:var(--success)}
  .gd-shootout-row .k.miss{background:var(--danger-quiet);border:1px solid var(--danger)}

  /* Container-query rules can't match here: .gd-kp-grid / .gd-sc-grid / .gd-grid-2
     are appended directly to the popup body / page #content (no container-type
     ancestor), so @container never fires. Use @media so they stack on phones. */
  @media (max-width:680px){.gd-grid-2{grid-template-columns:1fr}}
  @media (max-width:560px){.gd-kp-grid,.gd-sc-grid{grid-template-columns:1fr}}

  .gd-loading{padding:60px 20px;text-align:center;font-family:var(--f-body);font-weight:700;font-size:13px;color:var(--text-3)}
  .gd-loading::before{content:'';display:inline-block;width:14px;height:14px;border:2px solid var(--border-strong);border-top-color:var(--accent);border-radius:50%;animation:wc-spin .9s linear infinite;vertical-align:middle;margin-right:10px}
  .gd-error{padding:30px 20px;text-align:center;font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--danger-text);background:var(--danger-quiet);border:1px solid var(--danger);border-radius:var(--r-md);max-width:580px;margin:30px auto}
` + liveCss;

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

// Wrap a player name in a popup link resolved by name. Live event/scorer feeds
// only carry names (no tmId); the player renderer resolves "name:<Name>" and
// degrades gracefully if there's no match. Returns a text node if no name.
function playerLink(name, className = 'gd-plink') {
  if (!name) return document.createTextNode('');
  return el('a', { class: className, href: `/wc/player/${encodeURIComponent('name:' + name)}` }, name);
}

export async function renderGameInto(container, matchId, opts = {}) {
  container.classList.add('gd-root');

  // Demo entry points for the live view: /wc/game/test (wc2026api sandbox match
  // that cycles through phases live) and /wc/game/mock (frozen, fully-populated
  // state that makes no API calls). Both render the dedicated live experience.
  if (matchId === 'mock' || matchId === 'test' || String(matchId) === '9999') {
    return renderLiveInto(container, { mode: matchId === 'mock' ? 'mock' : 'test', matchId, setTitle: opts.setTitle });
  }

  container.innerHTML = `<div class="gd-loading">Loading match…</div>`;

  let m;
  try {
    const match = await api.getMatch(matchId);
    m = Array.isArray(match) ? match[0] : (match.data || match);
    if (!m || !m.id) throw new Error('match not found');
  } catch (err) {
    // Live API unavailable/over-cap — fall back to the complete local schedule
    // so every match still opens with its full pre-game context and result.
    try {
      const all = await data.getMatchesSample();
      m = (Array.isArray(all) ? all : []).find(x => String(x.id) === String(matchId)) || null;
    } catch {}
    if (!m || !m.id) {
      container.innerHTML = `<div class="gd-error">Couldn't load match ${matchId}: ${err.message}</div>`;
      return;
    }
  }

  const enrich = await Promise.allSettled([
    data.resolveTeam(m.home_team).then(t => t || data.teamByCode(m.home_team_code)),
    data.resolveTeam(m.away_team).then(t => t || data.teamByCode(m.away_team_code)),
    data.getHeadToHead(),
    data.getEloRatings(),
    data.getFifaRankings(),
    data.getStadiumWeather(),
    data.getCountries(),
    data.getPlayersByTeamSample(),
    data.getTeamRecords(),
    (m.round === 'group') ? api.getGroups().catch(() => null) : Promise.resolve(null),
    (m.status !== 'scheduled') ? api.getMatchStats(m.id).catch(() => null) : Promise.resolve(null),
    data.getSportsdbTeams(),
    (m.round === 'group') ? data.getGroupsSample().catch(() => null) : Promise.resolve(null),
  ]);
  const [home, away, h2h, elo, fifa, weather, countries, playersByTeam, records, groups, stats, sportsdb, groupsStatic] =
    enrich.map(r => r.status === 'fulfilled' ? r.value : null);

  // Update popup title once teams resolve
  if (opts.setTitle && (home || away)) {
    const t = (home && away) ? `${home.fifa_code} vs ${away.fifa_code}` : (home ? home.name : (away ? away.name : 'Match'));
    opts.setTitle(t);
  }

  // Live matches get the dedicated live experience (in the popup AND the full
  // page). It runs its own seconds-precision clock and budget-safe poll loop, so
  // we hand off entirely rather than rebuilding the generic layout on a timer.
  if (m.status === 'live') {
    // Full-screen page: hand off to the dedicated /wc/live broadcast view so a
    // live game lives there until full time. The hover popup keeps its inline
    // live view (no navigation).
    if (opts.fullPage) { location.replace('/wc/live'); return; }
    return renderLiveInto(container, {
      mode: 'live', matchId, setTitle: opts.setTitle,
      seed: { m, home, away, stats, groups, groupsStatic },
    });
  }

  render({ m, home, away, h2h, elo, fifa, weather, countries, playersByTeam, records, groups, groupsStatic, stats, sportsdb, container });
}

function render(ctx) {
  const { m, container } = ctx;
  container.innerHTML = '';

  const phase = phaseClass(m);

  const headRow = el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px' });
  headRow.appendChild(el('span', { class: `gd-phase-pill ${phase}` },
    el('span', { class: 'd' }), statusLabel(m)));
  headRow.appendChild(el('span', { class: 'gd-stage' }, stageLabel(m)));
  container.appendChild(headRow);

  container.appendChild(buildScoreboard(ctx));

  const stadName = m.stadium || '—';
  const venueInfo = pickStadiumInfo(ctx.weather, stadName);
  const kickoffDate = new Date(m.kickoff_utc);
  const koLabel = phase === 'pre' ? 'Kickoff' : (phase === 'live' ? 'Started' : 'Played');
  const koDateTime = dayLabel(kickoffDate) + ' · ' + timeLabel(kickoffDate) + ' ET';
  const chips = el('div', { class: 'gd-chips' },
    metaChip('Stadium', stadName, 'map-pin'),
    venueInfo && venueInfo.city ? metaChip('City', venueInfo.city) : null,
    venueInfo && venueInfo.capacity ? metaChip('Capacity', venueInfo.capacity.toLocaleString()) : null,
    metaChip(koLabel, koDateTime, 'clock'),
    phase === 'pre' ? metaChip('Kicks off in', fmtCountdown(kickoffDate), 'clock') : null,
  );
  container.appendChild(chips);

  const stk = buildStakes(ctx);
  if (stk) container.appendChild(stk);

  if (phase === 'pre') renderPre(container, ctx);
  else                 renderLiveOrPost(container, ctx);
}

// "What's at stake" — qualification odds for both teams + how each result shifts
// them (group matches only; uses the Elo Monte-Carlo forecast, filled async).
function buildStakes(ctx) {
  const { m, home, away } = ctx;
  if (m.round !== 'group' || !home || !away) return null;
  const sec = el('div', { class: 'gd-section gd-stakes' });
  import('./team-accent.js').then((tc) => tc.applyTeamVars(sec, home.fifa_code, away.fifa_code)).catch(() => {});
  sec.appendChild(el('h3', {},
    el('span', { class: 'gd-ico', html: icon('trending-up', { size: 13 }) }), 'What’s at stake',
    el('span', { class: 'note' }, 'modelled')));
  const body = el('div', {}, el('div', { class: 'gd-muted-note' }, 'Calculating qualification odds…'));
  sec.appendChild(body);
  fillStakes(body, ctx).catch(() => {
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'gd-muted-note' }, 'Qualification odds unavailable right now.'));
  });
  return sec;
}

async function fillStakes(body, ctx) {
  const { m, home, away } = ctx;
  const fc = await import('./forecast-client.js');
  const f = await fc.getForecast({ focusMatch: m.match_number });
  const H = home.fifa_code, A = away.fifa_code;
  const th = f.teams[H], ta = f.teams[A];
  if (!th || !ta) throw new Error('teams missing from forecast');
  body.innerHTML = '';

  const oddsGrid = el('div', { class: 'gd-stk-odds' });
  oddsGrid.appendChild(stakeTeamCard(home, th.qualify, 'home'));
  oddsGrid.appendChild(stakeTeamCard(away, ta.qualify, 'away'));
  body.appendChild(oddsGrid);

  if (m.status !== 'finished' && f.focus && f.focus.H && f.focus.D && f.focus.A) {
    // Map buckets by TEAM CODE (the forecast's home/away orientation can differ
    // from the display's), so a team's "win" row always shows that team winning.
    const homeWinB = (f.focus.homeCode === H) ? f.focus.H : f.focus.A;
    const awayWinB = (f.focus.homeCode === H) ? f.focus.A : f.focus.H;
    const scen = el('div', { class: 'gd-stk-scen' });
    scen.appendChild(el('div', { class: 'lbl' }, 'If this match ends…'));
    const grid = el('div', { class: 'gd-stk-grid' });
    // Each scenario row: home team's outcome (left) · result (centre) · away team's outcome (right).
    const mkRow = (label, cls, bucket) => el('div', { class: 'gd-stk-srow' },
      stakeCell(H, bucket.teams[H]?.qualify ?? th.qualify, th.qualify, 'home'),
      el('div', { class: `gd-stk-res ${cls}` }, label),
      stakeCell(A, bucket.teams[A]?.qualify ?? ta.qualify, ta.qualify, 'away'));
    grid.appendChild(mkRow(`${H} win`, 'home', homeWinB));
    grid.appendChild(mkRow('Draw', 'draw', f.focus.D));
    grid.appendChild(mkRow(`${A} win`, 'away', awayWinB));
    scen.appendChild(grid);
    body.appendChild(scen);
  } else if (m.status === 'finished') {
    body.appendChild(el('div', { class: 'gd-muted-note', style: 'margin-top:10px' },
      'Result is in — these are the live qualification odds after this match.'));
  }
}

function stakeTeamCard(team, q, side) {
  const card = el('div', { class: 'gd-stk-team ' + (side || '') });
  const who = el('div', { class: 'who' });
  const fl = el('span', { class: 'fl' });
  if (flagSrc(team.fifa_code)) fl.style.backgroundImage = `url(${flagSrc(team.fifa_code)})`;
  who.appendChild(fl); who.appendChild(document.createTextNode(team.fifa_code));
  card.appendChild(who);
  const big = el('div', { class: 'big' });
  if (q >= 0.9995) { big.classList.add('thru'); big.textContent = '✓ Through'; }
  else if (q <= 0.0005) { big.classList.add('out'); big.textContent = 'Eliminated'; }
  else { big.appendChild(document.createTextNode(String(Math.min(99, Math.max(1, Math.round(q * 100)))))); big.appendChild(el('i', {}, '%')); }
  card.appendChild(big);
  card.appendChild(el('div', { class: 'cap' }, 'to reach Round of 32'));
  const track = el('div', { class: 'track' });
  track.appendChild(el('div', { class: 'fill' + (q >= 0.9995 ? ' thru' : ''), style: `width:${q <= 0.0005 ? 0 : Math.max(4, Math.round(q * 100))}%` }));
  card.appendChild(track);
  return card;
}

function stakeCell(code, q, base, side) {
  const cell = el('div', { class: 'gd-stk-cell ' + side });
  const top = el('div', { class: 'gd-stk-ctop' });
  let txt, vcls = 'pv';
  if (q >= 0.9995) { vcls += ' thru'; txt = '✓'; }
  else if (q <= 0.0005) { vcls += ' out'; txt = 'OUT'; }
  else txt = `${Math.min(99, Math.max(1, Math.round(q * 100)))}%`;
  const v = el('span', { class: vcls }, txt);
  const d = Math.round((q - base) * 100);
  const dd = (Math.abs(d) >= 1 && q > 0.0005 && q < 0.9995)
    ? el('span', { class: 'dd ' + (d > 0 ? 'up' : 'dn') }, `${d > 0 ? '▲' : '▼'}${Math.abs(d)}`) : null;
  const codeEl = el('span', { class: 'tc' }, code);
  const valGrp = el('span', { class: 'pg' });
  // Values point toward the centre (next to the result chip); codes to the outer edge.
  if (side === 'home') { valGrp.appendChild(v); if (dd) valGrp.appendChild(dd); top.appendChild(codeEl); top.appendChild(valGrp); }
  else { if (dd) valGrp.appendChild(dd); valGrp.appendChild(v); top.appendChild(valGrp); top.appendChild(codeEl); }
  cell.appendChild(top);
  const bar = el('div', { class: 'gd-stk-cbar ' + side });
  bar.appendChild(el('div', { class: 'f' + (q >= 0.9995 ? ' thru' : '') + ' ' + side, style: `width:${q <= 0.0005 ? 0 : Math.max(4, Math.round(q * 100))}%` }));
  cell.appendChild(bar);
  return cell;
}

function buildScoreboard(ctx) {
  const { m, home, away } = ctx;
  const phase = phaseClass(m);
  const wrap = el('div', { class: 'gd-scoreboard' });
  wrap.appendChild(teamSide(home, m.home_team_source));

  const middle = el('div', { class: 'gd-middle' });
  const scoreText = (phase === 'pre') ? 'VS' : `${m.home_score ?? 0}–${m.away_score ?? 0}`;
  middle.appendChild(el('div', { class: `gd-score ${phase}` }, scoreText));
  const timeText = (phase === 'pre')
    ? `KO ${timeLabel(new Date(m.kickoff_utc))}`
    : (phase === 'live' ? (PHASE_LABEL[m.phase] || m.phase || 'LIVE') : (m.phase === 'FT_PEN' ? 'Full time (pens)' : 'Full time'));
  middle.appendChild(el('div', { class: `gd-time ${phase}` }, timeText));
  if (m.phase === 'FT_PEN') middle.appendChild(el('div', { class: 'gd-annot' }, 'Decided on penalties'));
  wrap.appendChild(middle);

  wrap.appendChild(teamSide(away, m.away_team_source));
  return wrap;
}

function teamSide(team, sourceText) {
  if (!team) {
    return el('div', { class: 'gd-team', style: 'cursor:default' },
      el('div', { class: 'gd-flag empty' }, '?'),
      el('div', { class: 'gd-code' }, sourceText || 'TBD'),
      el('div', { class: 'gd-name', style: 'font-style:italic' }, sourceText ? 'Slot undecided' : 'Awaiting team'),
    );
  }
  const a = el('a', { class: 'gd-team', href: `/wc/team/${team.fifa_code}` });
  const flag = el('div', { class: 'gd-flag' });
  if (flagSrc(team.fifa_code)) flag.style.backgroundImage = `url(${flagSrc(team.fifa_code)})`;
  else { flag.classList.add('empty'); flag.textContent = team.fifa_code.slice(0, 2); }
  a.appendChild(flag);
  a.appendChild(el('div', { class: 'gd-code' }, team.fifa_code));
  a.appendChild(el('div', { class: 'gd-name' }, team.name));
  // Lets list-page click handlers intercept this in popup mode if they want.
  a.dataset.teamCode = team.fifa_code;
  return a;
}

function metaChip(label, value, iconName) {
  const lbl = el('div', { class: 'lbl' });
  if (iconName) lbl.appendChild(el('span', { class: 'gd-ico', html: icon(iconName, { size: 12, stroke: 2.2 }) }));
  lbl.appendChild(document.createTextNode(label));
  return el('div', { class: 'gd-chip' },
    lbl,
    el('div', { class: 'val' }, value || '—'),
  );
}

function statusLabel(m) {
  if (m.status === 'live') return PHASE_LABEL[m.phase] || 'Live';
  if (m.status === 'finished') return m.phase === 'FT_PEN' ? 'Full time (pens)' : 'Full time';
  return 'Upcoming';
}
function phaseClass(m) {
  if (m.status === 'live') return 'live';
  if (m.status === 'finished') return 'post';
  return 'pre';
}
function stageLabel(m) {
  if (m.round === 'group') return `Group ${m.group_name || '?'} · Match ${m.match_number}`;
  return `${ROUND_LABEL[m.round] || m.round} · Match ${m.match_number}`;
}

function renderPre(root, ctx) {
  const { m, home, away, h2h, elo, fifa, weather, playersByTeam, records, groups } = ctx;

  const story = el('div', { class: 'gd-storyline' });
  story.appendChild(el('h3', {}, el('span', { class: 'gd-ico', html: icon('info', { size: 13 }) }), 'The Storyline'));
  story.appendChild(el('p', {}, buildStoryline(ctx)));
  root.appendChild(story);

  if (home && away) {
    const tot = el('div', { class: 'gd-section' });
    tot.appendChild(el('div', { class: 'gd-tot-header' },
      el('span', { class: 'ttl' }, el('span', { class: 'gd-ico', html: icon('scan-search', { size: 12 }) }), 'Tale of the Tape'),
      el('span', { class: 'sub' }, `${home.fifa_code} vs ${away.fifa_code}`),
    ));
    const rows = buildToTRows(home, away, elo, fifa, records);
    if (rows.length === 0) {
      tot.appendChild(el('div', { class: 'gd-muted-note' }, 'Comparison data warming up.'));
    }
    for (const r of rows) tot.appendChild(buildToTRow(r));
    root.appendChild(tot);
  }

  if (home && away && h2h) {
    const pairKey = data.h2hKey(home.fifa_code, away.fifa_code);
    const pair = h2h[pairKey];
    if (pair) root.appendChild(buildH2H(home, away, pair));
  }

  if (m.round === 'group' && home && away) {
    const groupLetter = m.group_name || home.group;
    const live = pickGroupStandings(groups, groupLetter);
    const standings = (live && live.length) ? live : pickGroupStandings(ctx.groupsStatic, groupLetter);
    if (standings && standings.length) root.appendChild(buildStandings(standings, [home.fifa_code, away.fifa_code], groupLetter, home, away));
  }

  if (home || away) {
    root.appendChild(buildKeyPlayers(home, away, playersByTeam));
  }

  const wx = pickWeather(weather, m);
  if (wx) root.appendChild(buildWeather(wx, m));
}

function buildStoryline(ctx) {
  const { m, home, away } = ctx;
  if (!home || !away) return `Knockout tie — teams confirmed once the qualifying matches finish.`;
  const kickoffWhen = dayLong(new Date(m.kickoff_utc));
  if (m.round === 'group') {
    return `${home.name} face ${away.name} in Group ${m.group_name} on ${kickoffWhen}. Result feeds the live Group ${m.group_name} table.`;
  }
  return `${home.name} meet ${away.name} in the ${(ROUND_LABEL[m.round] || m.round).toLowerCase()} on ${kickoffWhen}.`;
}

function buildToTRows(home, away, elo, fifa, records) {
  const rows = [];
  if (fifa) {
    const fh = fifa[home.fifa_code], fa = fifa[away.fifa_code];
    if (fh && fa) {
      const rh = fh.live_rank ?? fh.official_rank;
      const ra = fa.live_rank ?? fa.official_rank;
      if (rh && ra) rows.push({ label: 'FIFA rank', v1: '#' + rh, v2: '#' + ra, p1: invRank(rh), p2: invRank(ra) });
    }
  }
  if (elo) {
    const eh = elo[home.fifa_code], ea = elo[away.fifa_code];
    if (eh && ea) {
      const r1 = eh.current_rating || 0;
      const r2 = ea.current_rating || 0;
      if (r1 && r2) rows.push({ label: 'Elo rating', v1: Math.round(r1), v2: Math.round(r2), p1: r1, p2: r2 });
    }
  }
  if (records) {
    const rh = records[home.fifa_code], ra = records[away.fifa_code];
    if (rh && ra) {
      const wr1 = rh.win_pct != null ? rh.win_pct : (rh.played ? (rh.wins / rh.played * 100) : 0);
      const wr2 = ra.win_pct != null ? ra.win_pct : (ra.played ? (ra.wins / ra.played * 100) : 0);
      rows.push({ label: 'All-time win %', v1: wr1.toFixed(1) + '%', v2: wr2.toFixed(1) + '%', p1: wr1, p2: wr2 });
    }
  }
  return rows;
}
function invRank(r) { return r ? Math.max(1, 250 - r) : 0; }

function buildToTRow(r) {
  const total = (r.p1 + r.p2) || 1;
  // One flat solid split bar: gold (home) segment meets away segment at the split.
  let aPct = Math.round(r.p1 / total * 100);
  aPct = Math.min(92, Math.max(8, aPct));
  const bPct = 100 - aPct;
  return el('div', { class: 'gd-tot-row' },
    el('span', { class: 'v1' }, String(r.v1)),
    el('div', {},
      el('div', { class: 'lbl' }, r.label),
      el('div', { class: 'gd-tot-bar' },
        el('div', { class: 'a', style: `width:${aPct}%` }),
        el('div', { class: 'b', style: `width:${bPct}%` }),
      ),
    ),
    el('span', { class: 'v2' }, String(r.v2)),
  );
}

function buildH2H(home, away, pair) {
  const sec = el('div', { class: 'gd-section' });
  sec.appendChild(el('h3', {}, el('span', { class: 'gd-ico', html: icon('git-fork', { size: 12 }) }), 'Head to head'));

  const pairCodes = pair.pair || [];
  const homeIsFirst = pairCodes[0] === home.fifa_code;
  const homeWins = homeIsFirst ? pair.first_wins : pair.second_wins;
  const awayWins = homeIsFirst ? pair.second_wins : pair.first_wins;
  const homeGoals = homeIsFirst ? pair.first_goals : pair.second_goals;
  const awayGoals = homeIsFirst ? pair.second_goals : pair.first_goals;
  const played = pair.played ?? 0;

  if (played > 0) {
    sec.appendChild(el('div', { class: 'gd-h2h-summary' },
      el('div', { class: 'col' },
        el('div', { class: 'label' }, `${home.fifa_code} wins`),
        el('div', { class: 'big home' }, String(homeWins ?? 0)),
      ),
      el('div', { class: 'col' },
        el('div', { class: 'label' }, `Draws · ${played} played`),
        el('div', { class: 'big draws' }, String(pair.draws ?? 0)),
      ),
      el('div', { class: 'col' },
        el('div', { class: 'label' }, `${away.fifa_code} wins`),
        el('div', { class: 'big away' }, String(awayWins ?? 0)),
      ),
    ));
    sec.appendChild(el('div', { class: 'gd-h2h-agg' },
      `Aggregate goals · ${home.fifa_code} ${homeGoals ?? 0} – ${awayGoals ?? 0} ${away.fifa_code}`));
  } else {
    sec.appendChild(el('div', { class: 'gd-muted-note' }, 'No prior senior international meetings recorded.'));
    return sec;
  }

  const last = pair.last5 || [];
  if (last.length) {
    sec.appendChild(el('div', { class: 'gd-h2h-sub' }, 'Last meetings'));
    for (const meet of last.slice(0, 5)) {
      const dateStr = (meet.date || '').slice(0, 10);
      sec.appendChild(el('div', { class: 'gd-h2h-last' },
        el('div', { class: 'when' }, dateStr),
        el('div', { class: 'a' }, meet.home || ''),
        el('div', { class: 'score' }, meet.score || 'vs'),
        el('div', { class: 'b' }, meet.away || ''),
      ));
    }
  }
  return sec;
}

function pickGroupStandings(groups, letter) {
  if (!groups || !letter) return null;
  const arr = Array.isArray(groups) ? groups : (groups.data || groups.groups || []);
  if (!Array.isArray(arr)) return null;
  const g = arr.find(x => (x.group_name || x.group) === letter || x.letter === letter);
  return g ? (g.standings || g.table || []) : null;
}

function buildStandings(rows, meCodes, letter, home, away) {
  const sec = el('div', { class: 'gd-section' });
  sec.appendChild(el('h3', {}, el('span', { class: 'gd-ico', html: icon('list-ordered', { size: 12 }) }), `Group ${letter} · Standings`));
  sec.appendChild(el('div', { class: 'gd-stand-head' },
    el('span', {}, '#'), el('span', {}, 'Team'),
    el('span', { style:'text-align:center' }, 'P'),
    el('span', { style:'text-align:center' }, 'GD'),
    el('span', { style:'text-align:center' }, 'PTS'),
  ));
  const meNames = new Set();
  if (home) { meNames.add(home.name); meNames.add(home.name_normalised); }
  if (away) { meNames.add(away.name); meNames.add(away.name_normalised); }
  rows.forEach((r, i) => {
    const teamName = r.team || r.name;
    const isMe = meNames.has(teamName);
    const qual = i < 2;
    const t = (data.teamSync && data.teamSync(teamName)) || (r.code && data.teamSync && data.teamSync(r.code));
    const cls = `gd-stand-row${isMe ? ' me' : ''}${qual && !isMe ? ' q' : ''}`;
    // Clickable into the team popup when we can resolve a FIFA code.
    const row = t
      ? el('a', { class: cls, href: `/wc/team/${t.fifa_code}`, style: 'text-decoration:none;color:inherit' })
      : el('div', { class: cls });
    row.appendChild(el('span', { class: 'gd-stand-pos' }, String(i + 1)));
    const name = el('div', { class: 'gd-stand-name' });
    const flag = el('span', { class: 'flag' });
    if (t && flagSrc(t.fifa_code)) flag.style.backgroundImage = `url(${flagSrc(t.fifa_code)})`;
    name.appendChild(flag);
    name.appendChild(el('span', {}, teamName));
    row.appendChild(name);
    row.appendChild(el('span', { class: 'gd-stand-g' }, String(r.played ?? 0)));
    const gd = (r.gd != null) ? r.gd : ((r.gf ?? 0) - (r.ga ?? 0));
    row.appendChild(el('span', { class: 'gd-stand-g' }, gd > 0 ? `+${gd}` : String(gd)));
    row.appendChild(el('span', { class: 'gd-stand-p' }, String(r.points ?? 0)));
    sec.appendChild(row);
  });
  sec.appendChild(el('div', { class: 'gd-stand-legend' },
    el('span', {}, el('i', { style: 'background:var(--success)' }), 'Qualifies (top 2)'),
    el('span', {}, el('i', { style: 'background:var(--accent)' }), 'This match'),
  ));
  return sec;
}

function buildKeyPlayers(home, away, playersByTeam) {
  const sec = el('div', { class: 'gd-kp-grid' });
  for (const t of [home, away]) {
    const card = el('div', { class: 'gd-section gd-kp-card' });
    card.appendChild(el('div', { class: 'ttl' },
      el('span', { class: 'gd-ico', html: icon('users', { size: 12 }) }),
      (t ? t.fifa_code : '?') + ' · Watch'));
    const top = topPlayers(t, playersByTeam);
    if (!top.length) {
      card.appendChild(el('div', { class: 'gd-kp-empty' }, 'Squad data not yet wired for this team.'));
    } else {
      for (const p of top) {
        const playerId = p.tmId || `name:${p.name}`;
        // Make each row clickable to the player popup.
        const row = el('a', { class: 'gd-kp-row', href: `/wc/player/${encodeURIComponent(playerId)}` });
        row.appendChild(el('div', { class: 'gd-kp-portrait wc-avatar' }, initials(p.name)));
        row.appendChild(el('div', { class: 'gd-kp-info' },
          el('div', { class: 'name' }, p.name),
          el('div', { class: 'pos' }, p.position || ''),
        ));
        row.appendChild(el('div', { class: 'gd-kp-val' }, eur(p.marketValueEur)));
        card.appendChild(row);
      }
    }
    sec.appendChild(card);
  }
  return sec;
}
function topPlayers(team, playersByTeam) {
  if (!team || !playersByTeam) return [];
  return data.squadFor(playersByTeam, team).slice(0, 3);
}

// Returns the match-day weather entry (has .weather and .weather_source) or null.
function pickWeather(weather, m) {
  if (!weather || !m.stadium) return null;
  const stadiums = weather.stadiums;
  if (!stadiums || typeof stadiums !== 'object') return null;
  const venue = stadiums[m.stadium];
  if (!venue) return null;
  const matches = venue.matches || [];
  const targetDate = m.kickoff_utc.slice(0, 10);
  // Match by date (preferred) or by the team pair (loose fallback).
  return matches.find(d => d.date === targetDate) || null;
}

// Top-level stadium info (city, capacity, timezone) from the same weather file.
function pickStadiumInfo(weather, stadiumName) {
  if (!weather || !stadiumName) return null;
  const stadiums = weather.stadiums;
  if (!stadiums || typeof stadiums !== 'object') return null;
  return stadiums[stadiumName] || null;
}

function buildWeather(wx, m) {
  const sec = el('div', { class: 'gd-section' });
  const w = wx.weather || {};
  const src = wx.weather_source;
  // Title varies by data source: observed = past, forecast = upcoming, beyond = too far out.
  const titleNote = src === 'observed' ? '(observed)' : (src === 'forecast' ? '(forecast)' : '');
  sec.appendChild(el('h3', {}, el('span', { class: 'gd-ico', html: icon('cloud-sun', { size: 12 }) }), `Match-day weather · ${m.stadium} ${titleNote}`.trim()));

  if (src === 'beyond_forecast_window' || !w || Object.keys(w).length === 0) {
    sec.appendChild(el('div', { class: 'gd-muted-note', style: 'line-height:1.5' },
      src === 'beyond_forecast_window'
        ? 'Outside the 16-day forecast window — refresh closer to the match for accurate conditions.'
        : 'Forecast not yet populated for this match day.'));
    return sec;
  }

  const grid = el('div', { class: 'gd-weather-grid' });
  if (w.temp_max_c != null) grid.appendChild(weatherCell('High', `${Math.round(w.temp_max_c)}°C`, 'warm', 'thermometer'));
  if (w.temp_min_c != null) grid.appendChild(weatherCell('Low', `${Math.round(w.temp_min_c)}°C`, 'cool', 'thermometer'));
  if (w.precip_mm != null) grid.appendChild(weatherCell('Precip', `${w.precip_mm}mm`, null, 'cloud-rain'));
  if (w.precip_prob_max_pct != null) grid.appendChild(weatherCell('Rain prob', `${w.precip_prob_max_pct}%`, null, 'droplets'));
  if (w.wind_max_kmh != null) grid.appendChild(weatherCell('Wind', `${Math.round(w.wind_max_kmh)} km/h`, null, 'wind'));
  if (w.uv_index_max != null) grid.appendChild(weatherCell('UV', String(w.uv_index_max), null, 'sun'));
  if (!grid.children.length) {
    sec.appendChild(el('div', { class: 'gd-muted-note' }, 'Weather slot present but unspecified.'));
  } else {
    sec.appendChild(grid);
  }
  sec.appendChild(el('div', { class: 'gd-muted-note', style: 'font-size:10px;margin-top:10px;text-align:right' },
    'Source: Open-Meteo · ' + (src || 'forecast')));
  return sec;
}
function weatherCell(label, value, tone, iconName) {
  return el('div', { class: 'gd-weather-cell' },
    iconName ? el('div', { class: 'ic', html: icon(iconName, { size: 18 }) }) : null,
    el('div', { class: 'v' + (tone ? ' ' + tone : '') }, value),
    el('div', { class: 'lbl' }, label),
  );
}

function renderLiveOrPost(root, ctx) {
  const { m, stats, home, away } = ctx;

  // Goalscorers (per side) when there's at least one goal event.
  const scorers = extractScorers(stats, home, away);
  if (scorers.home.length || scorers.away.length) {
    const sec = el('div', { class: 'gd-sc-grid' });
    for (const side of ['home', 'away']) {
      const team = side === 'home' ? home : away;
      const list = scorers[side];
      const card = el('div', { class: 'gd-section gd-sc-card' });
      card.appendChild(el('div', { class: 'ttl' },
        el('span', { class: 'gd-ico', html: icon('trophy', { size: 12 }) }),
        `${team ? team.fifa_code : '?'} scorers`));
      if (!list.length) {
        card.appendChild(el('div', { class: 'row empty' }, '—'));
      } else {
        for (const s of list) {
          card.appendChild(el('div', { class: 'row' },
            playerLink(s.name), ' ',
            el('span', { class: 'mins' }, s.mins.join(', ')),
          ));
        }
      }
      sec.appendChild(card);
    }
    root.appendChild(sec);
  }

  const cols = el('div', { class: 'gd-grid-2' });
  cols.appendChild(buildEvents(stats, m, ctx));
  cols.appendChild(buildLiveStats(stats, m));
  root.appendChild(cols);

  // Penalty shootout block when applicable.
  if (m.phase === 'PEN' || m.phase === 'FT_PEN') {
    root.appendChild(buildShootout(stats, home, away));
  }

  if (m.status === 'finished') {
    const story = el('div', { class: 'gd-storyline' });
    story.appendChild(el('h3', {}, el('span', { class: 'gd-ico', html: icon('trophy', { size: 13 }) }), 'Result'));
    story.appendChild(el('p', {}, buildPostStoryline(ctx)));
    root.appendChild(story);
  }
}

function extractScorers(stats, home, away) {
  const events = extractEvents(stats);
  const homeCode = home?.fifa_code;
  const awayCode = away?.fifa_code;
  const buckets = { home: new Map(), away: new Map() };
  for (const ev of events) {
    if (ev.type !== 'goal') continue;
    // Match by FIFA code OR by home/away marker (the wc2026api stats schema isn't
    // fully pinned, so accept both team_code strings and side markers).
    const tc = String(ev.teamCode || '').toUpperCase();
    const bucket = (tc === homeCode || tc === 'HOME' || tc === 'H') ? 'home'
                : (tc === awayCode || tc === 'AWAY' || tc === 'A') ? 'away'
                : null;
    if (!bucket) continue;
    if (!buckets[bucket].has(ev.player)) buckets[bucket].set(ev.player, []);
    buckets[bucket].get(ev.player).push(ev.min);
  }
  const collapse = (m) => Array.from(m.entries()).map(([name, mins]) => ({ name, mins }));
  return { home: collapse(buckets.home), away: collapse(buckets.away) };
}

function buildShootout(stats, home, away) {
  const sec = el('div', { class: 'gd-section' });
  sec.appendChild(el('h3', {}, el('span', { class: 'gd-ico', html: icon('circle-dot', { size: 12 }) }), 'Penalty shootout'));
  // The stats schema for shootouts isn't pinned. Try a few common shapes.
  const shootout = stats && (stats.shootout || stats.penalties || stats.penalty_shootout);
  if (!shootout) {
    sec.appendChild(el('div', { class: 'gd-muted-note' },
      home && away ? `${home.fifa_code} vs ${away.fifa_code} decided on penalties — per-kick detail loads once the stats endpoint returns it.` : 'Decided on penalties.'));
    return sec;
  }
  // Try a generic { home_kicks: [bool], away_kicks: [bool] } or array of {team, scored, player}.
  const homeKicks = shootout.home_kicks || shootout.home;
  const awayKicks = shootout.away_kicks || shootout.away;
  if (Array.isArray(homeKicks) && Array.isArray(awayKicks)) {
    sec.appendChild(buildKickRow(home, homeKicks));
    sec.appendChild(buildKickRow(away, awayKicks));
  } else if (Array.isArray(shootout)) {
    // Flat list — bucket by team
    const homeArr = [], awayArr = [];
    for (const k of shootout) {
      const tc = String(k.team_code || k.team || '').toUpperCase();
      const ok = k.scored ?? k.success ?? !!k.goal;
      if (tc === home?.fifa_code) homeArr.push(ok);
      else if (tc === away?.fifa_code) awayArr.push(ok);
    }
    sec.appendChild(buildKickRow(home, homeArr));
    sec.appendChild(buildKickRow(away, awayArr));
  } else {
    sec.appendChild(el('div', { class: 'gd-muted-note' },
      'Shootout data present but in unexpected shape — refresh later.'));
  }
  return sec;
}
function buildKickRow(team, kicks) {
  const row = el('div', { class: 'gd-shootout-row' });
  row.appendChild(el('span', { class: 'code' }, team?.fifa_code || '?'));
  const dots = el('div', { class: 'dots' });
  for (const ok of kicks) {
    dots.appendChild(el('span', { class: 'k ' + (ok ? 'ok' : 'miss') }));
  }
  row.appendChild(dots);
  return row;
}

function buildEvents(stats, m, ctx) {
  const sec = el('div', { class: 'gd-section' });
  sec.appendChild(el('h3', {}, el('span', { class: 'gd-ico', html: icon('radio', { size: 12 }) }), 'Match events'));
  let events = extractEvents(stats);
  // If the live stats feed has no timeline yet (or is unavailable), fall back to
  // the goal events baked into the local schedule for finished matches.
  if (!events.length) events = goalEventsFromMatch(m, ctx);
  if (!events.length) {
    sec.appendChild(el('div', { class: 'gd-muted-note' },
      m.status === 'scheduled' ? 'No events yet — kickoff imminent.' : 'No events recorded yet.'));
    return sec;
  }
  const timeline = el('div', { class: 'gd-events' });
  for (const ev of events) {
    const node = el('div', { class: 'gd-event gd-event-' + ev.type });
    node.appendChild(el('span', { class: 'dot', style: 'background:var(--c)' }));
    node.appendChild(el('span', { class: 'min', style: 'color:var(--c)' }, ev.min));
    node.appendChild(el('span', { class: 'type', style: 'color:var(--c);background:var(--bg)' }, ev.typeLabel));
    node.appendChild(el('span', { class: 'who' }, ev.player ? playerLink(ev.player) : ''));
    node.appendChild(el('span', { class: 'team' }, ev.teamCode || ''));
    if (ev.detail) node.appendChild(el('span', { class: 'detail' }, ev.detail));
    timeline.appendChild(node);
  }
  sec.appendChild(timeline);
  return sec;
}

function buildLiveStats(stats, m) {
  const sec = el('div', { class: 'gd-section' });
  const head = el('h3', {}, el('span', { class: 'gd-ico', html: icon('chart-line', { size: 12 }) }), 'Match stats');
  head.appendChild(el('span', { class: 'note' }, m.status === 'live' ? 'Partial · updating' : 'Final'));
  sec.appendChild(head);
  const rows = extractStatRows(stats);
  if (!rows.length) {
    sec.appendChild(el('div', { class: 'gd-muted-note' }, 'Stats unavailable for this match yet.'));
    return sec;
  }
  for (const r of rows) {
    if (r.pending) {
      sec.appendChild(el('div', { class: 'gd-stat-pending' },
        el('span', { class: 'lbl' }, r.label),
        el('span', { class: 'v' }, 'Populating…'),
      ));
    } else {
      const total = (r.v1 + r.v2) || 1;
      let p1 = Math.round(r.v1 / total * 100);
      p1 = Math.min(94, Math.max(6, p1));
      const p2 = 100 - p1;
      sec.appendChild(el('div', { class: 'gd-stat-row' },
        el('div', { class: 'head' },
          el('span', { class: 'v1' }, String(r.v1)),
          el('span', { class: 'lbl' }, r.label),
          el('span', { class: 'v2' }, String(r.v2)),
        ),
        el('div', { class: 'bar' },
          el('div', { class: 'f1', style: `width:${p1}%` }),
          el('div', { class: 'f2', style: `width:${p2}%` }),
        ),
      ));
    }
  }
  return sec;
}

function goalEventsFromMatch(m, ctx) {
  const goals = Array.isArray(m && m.goals) ? m.goals : [];
  if (!goals.length) return [];
  const codeFor = (teamName) => {
    if (ctx && ctx.home && teamName === m.home_team) return ctx.home.fifa_code;
    if (ctx && ctx.away && teamName === m.away_team) return ctx.away.fifa_code;
    return teamName || '';
  };
  return goals.map((g) => ({
    type: 'goal',
    typeLabel: g.ownGoal ? 'OG' : (g.penalty ? 'PEN' : 'GOAL'),
    detail: g.ownGoal ? 'Own goal' : (g.penalty ? 'Penalty' : 'Goal'),
    min: /'$/.test(String(g.minute)) ? String(g.minute) : `${g.minute}'`,
    player: g.player || '',
    teamCode: codeFor(g.team),
  }));
}

function extractEvents(stats) {
  if (!stats) return [];
  const tl = stats.timeline || stats.events || stats.minute_by_minute || [];
  if (!Array.isArray(tl)) return [];
  const TYPE = {
    goal: { typeLabel: 'GOAL', type: 'goal', detail: 'Goal' },
    own_goal: { typeLabel: 'OG', type: 'goal', detail: 'Own goal' },
    penalty: { typeLabel: 'PEN', type: 'goal', detail: 'Penalty' },
    yellow: { typeLabel: 'YC', type: 'yellow', detail: 'Yellow card' },
    yellow_card: { typeLabel: 'YC', type: 'yellow', detail: 'Yellow card' },
    red: { typeLabel: 'RC', type: 'red', detail: 'Red card' },
    red_card: { typeLabel: 'RC', type: 'red', detail: 'Red card' },
    substitution: { typeLabel: 'SUB', type: 'sub', detail: 'Substitution' },
    sub: { typeLabel: 'SUB', type: 'sub', detail: 'Substitution' },
  };
  return tl.map(ev => {
    const t = ev.type || ev.event_type || '';
    const meta = TYPE[t] || { typeLabel: t.toUpperCase().slice(0, 3), type: 'sub', detail: t };
    return {
      ...meta,
      min: (ev.minute != null ? ev.minute + "'" : (ev.time || '')),
      player: ev.player || ev.player_name || ev.scorer || '',
      teamCode: ev.team_code || ev.team || '',
    };
  }).filter(e => e.min || e.player);
}

function extractStatRows(stats) {
  if (!stats) return [];
  const out = [];
  const s = stats.stats || stats;
  const pairs = [
    ['Possession %', s.possession_home, s.possession_away],
    ['Shots', s.shots_home, s.shots_away],
    ['On target', s.shots_on_target_home ?? s.on_target_home, s.shots_on_target_away ?? s.on_target_away],
    ['Corners', s.corners_home, s.corners_away],
    ['Fouls', s.fouls_home, s.fouls_away],
    ['Yellow', s.yellow_home, s.yellow_away],
    ['Red', s.red_home, s.red_away],
  ];
  for (const [label, v1, v2] of pairs) {
    if (v1 == null && v2 == null) continue;
    if (v1 == null || v2 == null) out.push({ label, pending: true });
    else out.push({ label, v1, v2 });
  }
  return out;
}

function buildPostStoryline(ctx) {
  const { m, home, away } = ctx;
  const homeN = home?.name || m.home_team || 'Home';
  const awayN = away?.name || m.away_team || 'Away';
  const hs = m.home_score ?? 0, as = m.away_score ?? 0;
  const winner = hs > as ? homeN : (as > hs ? awayN : null);
  if (m.round === 'final') return winner ? `${winner} are crowned World Cup 2026 champions.` : `A drawn final goes the distance.`;
  if (m.round === 'group') return winner ? `${winner} take the points in Group ${m.group_name}.` : `Honours shared in Group ${m.group_name}.`;
  if (winner) return `${winner} advance to the next knockout round.`;
  return `Tied — see the live stage to see what comes next.`;
}
