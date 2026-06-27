// Shared renderer for the Team Detail view.

import * as api from './api.js';
import * as data from './data.js';
import { flagSrc } from './flags.js';
import { dayLabel, timeLabel, eur, initials, ordinal } from './format.js';
import { pronounce } from './data.js';
import { icon } from './icons.js';

export const teamCss = `
  .td-root{position:relative;container-type:inline-size}

  /* HERO — flag as a cover background with a scrim gradient fading to the page
     surface so the name plate reads in both themes (the one allowed gradient).
     The band is kept short so the flat geometric flag doesn't read as an empty
     void, and the team crest sits in the plate as a focal element. */
  .td-hero{position:relative;width:100%;height:clamp(180px,34cqi,360px);border-radius:0;margin:-22px -26px 18px;overflow:hidden;animation:wc-reveal-up .55s cubic-bezier(.34,1.56,.64,1) both}
  .td-hero .td-hero-bg{position:absolute;inset:0;background-size:cover;background-position:center}
  .td-hero .td-hero-scrim{position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,var(--scrim) 35%,transparent) 0%,color-mix(in srgb,var(--scrim) 10%,transparent) 34%,color-mix(in srgb,var(--surface-1) 78%,transparent) 76%,var(--surface-1) 100%)}
  .td-plate{position:absolute;left:0;right:0;bottom:clamp(14px,3cqi,24px);padding:0 clamp(18px,4cqi,38px);min-width:0;display:flex;align-items:flex-end;gap:clamp(12px,2.4cqi,22px)}
  .td-plate .td-crest{width:clamp(52px,10cqi,92px);height:clamp(52px,10cqi,92px);flex:none;object-fit:contain;filter:drop-shadow(0 4px 14px rgba(0,0,0,.5));margin-bottom:clamp(3px,0.6cqi,7px)}
  .td-plate .td-plate-text{min-width:0;flex:1}
  .td-plate .name{font-family:var(--f-display);font-size:clamp(36px,11cqi,108px);line-height:0.85;text-transform:uppercase;letter-spacing:-0.01em;color:var(--text)}
  .td-plate .meta{display:flex;align-items:center;gap:13px;margin-top:12px;flex-wrap:wrap}
  .td-plate .meta span{font-family:'Archivo Expanded',var(--f-body);font-weight:800;font-size:clamp(10px,1.4cqi,13px);letter-spacing:0.16em;text-transform:uppercase;color:var(--text-2)}
  .td-plate .meta .accent{color:var(--accent-text)}
  .td-plate .meta .dot{width:5px;height:5px;border-radius:50%;background:var(--accent)}
  .td-pron{display:inline-flex;align-items:center;gap:6px;margin-top:14px;background:var(--accent-quiet);border:1px solid var(--accent-line);border-radius:var(--r-pill);padding:6px 12px;font-family:var(--f-body);font-weight:800;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent-text);cursor:pointer;transition:background var(--dur-2),transform var(--dur-1) var(--ease-press)}
  .td-pron:hover{background:color-mix(in srgb,var(--accent-quiet) 70%,var(--accent))}
  .td-pron:active{transform:scale(.95)}
  .td-pron .wc-ic{width:14px;height:14px}
  .td-pron[data-playing="1"] .wc-ic{animation:wc-dot-pulse 0.9s ease-in-out infinite}

  .td-meta-bar{display:flex;align-items:stretch;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-bottom:12px;box-shadow:var(--sh-1)}
  .td-meta-bar .cell{flex:1;padding:13px 20px;border-right:1px solid var(--border-subtle)}
  .td-meta-bar .cell:last-child{border-right:none}
  .td-meta-bar .lbl{font-family:var(--f-body);font-weight:900;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:6px}
  .td-meta-bar .val{font-family:'Archivo Expanded',var(--f-body);font-weight:800;font-size:16px;letter-spacing:0.03em;color:var(--text)}
  .td-meta-bar .val.big{font-family:var(--f-display);font-size:20px;color:var(--accent-text);line-height:1}

  /* Record strip → token stat tiles (no gradient on the highlighted cell) */
  .td-record{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--border-subtle);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-bottom:14px;box-shadow:var(--sh-1)}
  .td-record .cell{background:var(--surface-1);padding:14px 6px;text-align:center}
  .td-record .cell.accent{background:var(--accent-quiet)}
  .td-record .v{font-family:var(--f-display);font-size:clamp(22px,3.4cqi,38px);color:var(--text)}
  .td-record .v.win{color:var(--success-text)} .td-record .v.draw{color:var(--warning-text)}
  .td-record .v.loss{color:var(--danger-text)} .td-record .v.pts{color:var(--accent-text)}
  .td-record .lbl{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.1em;margin-top:4px;color:var(--text-3)}
  .td-record .cell.accent .lbl{color:var(--accent-text)}
  .td-atr-meta{display:flex;flex-wrap:wrap;gap:18px;font-family:var(--f-body);font-weight:600;font-size:11px;color:var(--text-3)}

  .td-section{background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px 20px;margin-top:14px;animation:wc-reveal-up .55s ease both;container-type:inline-size;box-shadow:var(--sh-1)}
  .td-section h3{font-family:var(--f-body);font-weight:900;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent-text);margin-bottom:14px;display:flex;align-items:center;gap:8px}
  .td-section h3 .hi{display:inline-flex;align-items:center;color:var(--accent-text)}
  .td-section h3 .hi .wc-ic{width:14px;height:14px}
  .td-section h3 .note{color:var(--text-3);font-weight:700;letter-spacing:0.06em;margin-left:auto;text-transform:none}
  .td-empty-note{font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--text-3);line-height:1.45}

  .td-grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}

  .td-sv .num{font-family:var(--f-mono);font-weight:700;font-size:clamp(28px,4.5cqi,46px);color:var(--text);line-height:0.9;font-variant-numeric:tabular-nums}
  .td-sv .lbl{font-family:var(--f-body);font-weight:700;font-size:11px;color:var(--text-3);margin-top:6px}
  .td-sv .mvp{display:flex;align-items:center;gap:11px;margin-top:16px;padding-top:14px;border-top:1px solid var(--border-subtle)}
  .td-sv .face{width:34px;height:40px;flex:none;border-radius:var(--r-sm);background:var(--surface-2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-family:var(--f-display);font-size:13px;color:var(--text-3);background-size:cover;background-position:center 35%;overflow:hidden}
  .td-sv .info{flex:1;min-width:0}
  .td-sv .name{font-family:var(--f-body);font-weight:800;font-size:14px;color:var(--text)}
  .td-sv .sub{font-family:var(--f-body);font-weight:600;font-size:11px;color:var(--text-3)}
  .td-sv .val{font-family:var(--f-mono);font-weight:700;font-size:13px;color:var(--accent-text);font-variant-numeric:tabular-nums}

  .td-demo{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border-subtle);border-radius:var(--r-md);overflow:hidden;border:1px solid var(--border)}
  .td-demo .cell{background:var(--surface-1);padding:13px 10px;text-align:center}
  .td-demo .v{font-family:var(--f-display);font-size:24px;color:var(--text)}
  .td-demo .lbl{font-family:var(--f-body);font-weight:800;font-size:9px;color:var(--text-3);letter-spacing:0.08em;margin-top:3px;text-transform:uppercase}
  .td-pos-dist{margin-top:12px}
  .td-pos-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .td-pos-row .lbl{font-family:var(--f-body);font-weight:800;font-size:10px;letter-spacing:0.06em;color:var(--text-2);min-width:88px}
  .td-pos-row .bar{flex:1;height:8px;background:var(--surface-2);border-radius:var(--r-pill);overflow:hidden}
  .td-pos-row .fill{height:100%;background:var(--accent);border-radius:var(--r-pill);transform-origin:left;animation:wc-grow-x .7s cubic-bezier(.4,0,.18,1) both}
  .td-pos-row .n{font-family:var(--f-display);font-size:15px;color:var(--accent-text);min-width:20px;text-align:right}

  .td-stand-head{display:grid;grid-template-columns:24px 1fr 34px 34px 44px;gap:6px;padding:0 6px 8px;font-family:var(--f-body);font-weight:900;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-3)}
  .td-stand-row{display:grid;grid-template-columns:24px 1fr 34px 34px 44px;gap:6px;align-items:center;padding:9px 6px;border-radius:var(--r-sm);margin-bottom:2px;text-decoration:none;color:inherit;transition:background var(--dur-2)}
  .td-stand-row:hover{background:var(--surface-2)}
  .td-stand-row.me{background:var(--accent-quiet)}
  .td-stand-row.q{background:var(--success-quiet)}
  .td-stand-row .pos{font-family:var(--f-display);font-size:14px;color:var(--text-3)}
  .td-stand-row.me .pos{color:var(--accent-text)}
  .td-stand-row.q .pos{color:var(--success-text)}
  .td-stand-row .nm{display:flex;align-items:center;gap:8px;min-width:0}
  .td-stand-row .nm .flag{width:22px;height:16px;flex:none;border-radius:3px;background-size:cover;background-position:center;box-shadow:0 0 0 1px rgba(0,0,0,.18)}
  .td-stand-row .nm span{font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .td-stand-row.me .nm span{font-weight:800;color:var(--text)}
  .td-stand-row .c{text-align:center;font-family:var(--f-body);font-weight:700;font-size:12px;color:var(--text-2);font-variant-numeric:tabular-nums}
  .td-stand-row .c.gd-pos{color:var(--success-text)} .td-stand-row .c.gd-neg{color:var(--danger-text)}
  .td-stand-row .p{text-align:right;font-family:var(--f-display);font-size:16px;color:var(--text-2);font-variant-numeric:tabular-nums}
  .td-stand-row.me .p{color:var(--accent-text)}
  .td-stand-key{display:flex;align-items:center;gap:6px;margin-top:10px;font-family:var(--f-body);font-weight:700;font-size:10px;color:var(--text-3)}
  .td-stand-key span.s{width:11px;height:11px;border-radius:3px;background:var(--success)}

  .td-fix-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .td-form-chips{display:flex;gap:5px}
  .td-form-chip{font-family:var(--f-display);font-size:13px;width:22px;height:22px;border-radius:var(--r-xs);display:inline-flex;align-items:center;justify-content:center;color:var(--live-ink)}
  .td-form-W{background:var(--success)}
  .td-form-D{background:var(--warning)}
  .td-form-L{background:var(--danger)}
  .td-form-N{background:var(--surface-2);color:var(--text-3)}
  .td-fix-row{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid var(--border-subtle);text-decoration:none;color:inherit;cursor:pointer;transition:transform .2s,background .2s}
  .td-fix-row:hover{transform:translateX(3px)}
  .td-fix-row .when{display:flex;flex-direction:column;min-width:64px}
  .td-fix-row .when .d{font-family:var(--f-display);font-size:15px;line-height:1;color:var(--text)}
  .td-fix-row .when .t{font-family:var(--f-body);font-weight:700;font-size:10px;color:var(--text-3);margin-top:2px}
  .td-fix-row .vs{font-family:var(--f-body);font-weight:800;font-size:10px;color:var(--text-3)}
  .td-fix-row .opp-flag{width:26px;height:19px;flex:none;border-radius:3px;background-size:cover;background-position:center;box-shadow:0 0 0 1px rgba(0,0,0,.18)}
  .td-fix-row .opp-name{flex:1;font-family:var(--f-body);font-weight:700;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .td-fix-row .opp-name .res{font-family:var(--f-mono);font-weight:700;color:var(--success-text);margin-left:6px;font-variant-numeric:tabular-nums}
  .td-fix-row .opp-name .res.loss{color:var(--danger-text)}
  .td-fix-row .opp-name .res.draw{color:var(--warning-text)}
  .td-fix-row .opp-name .res.live{color:var(--live)}
  .td-fix-row .ven{font-family:var(--f-body);font-weight:600;font-size:10px;color:var(--text-3);white-space:nowrap;display:inline-flex;align-items:center;gap:3px}
  .td-fix-row .ven .hi{display:inline-flex;align-items:center}
  .td-fix-row .ven .wc-ic{width:11px;height:11px;color:var(--text-3)}

  .td-squad-controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
  .td-squad-controls .ctl-lbl{font-family:var(--f-body);font-weight:700;font-size:9px;letter-spacing:0.08em;color:var(--text-3);text-transform:uppercase}
  .td-sort-pill{display:flex;gap:3px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-sm);padding:3px}
  .td-sort-pill button{cursor:pointer;border:none;font-family:var(--f-body);font-weight:800;font-size:10px;letter-spacing:0.04em;text-transform:uppercase;padding:5px 11px;border-radius:var(--r-xs);background:transparent;color:var(--text-2);transition:background var(--dur-2),color var(--dur-2)}
  .td-sort-pill button.on{background:var(--accent);color:var(--on-accent)}
  .td-squad-section .ttl{display:flex;align-items:center;gap:10px;margin:16px 0 10px}
  .td-squad-section .ttl span{font-family:'Archivo Expanded',var(--f-body);font-weight:800;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:var(--accent-text)}
  .td-squad-section .ttl hr{flex:1;height:1px;background:var(--border);border:none}
  .td-squad-section .ttl .n{font-family:var(--f-body);font-weight:800;font-size:10px;color:var(--text-3)}
  .td-squad-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}
  .td-squad-card{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:var(--r-md);background:var(--surface-2);border:1px solid var(--border);text-decoration:none;color:inherit;transition:transform .2s,border-color .2s,background .2s}
  .td-squad-card:hover{transform:translateY(-2px);border-color:var(--accent-line);background:var(--surface-3)}
  .td-squad-card.mvp{background:var(--accent-quiet);border-color:var(--accent-line)}
  .td-squad-card .no{font-family:var(--f-display);font-size:19px;color:var(--text-3);min-width:26px;font-variant-numeric:tabular-nums}
  .td-squad-card.mvp .no{color:var(--accent-text)}
  .td-squad-card .info{flex:1;min-width:0}
  .td-squad-card .name{font-family:var(--f-body);font-weight:800;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .td-squad-card .sub{font-family:var(--f-body);font-weight:600;font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .td-squad-card .val{font-family:var(--f-mono);font-weight:700;font-size:12px;color:var(--accent-text);font-variant-numeric:tabular-nums}

  .td-country-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px}
  .td-country-cell{padding:6px 0}
  .td-country-cell .k{font-family:var(--f-body);font-weight:800;font-size:9px;color:var(--text-3);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px}
  .td-country-cell .v{font-family:var(--f-body);font-weight:700;font-size:13px;color:var(--text)}
  .td-country-cell .v.big{font-family:var(--f-display);font-size:22px;color:var(--text)}

  .td-rank-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @container (max-width:520px){.td-rank-grid{grid-template-columns:1fr}}
  .td-rank-card{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;text-align:center}
  .td-rank-card .src{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.12em;color:var(--text-3);text-transform:uppercase;display:inline-flex;align-items:center;justify-content:center;gap:5px}
  .td-rank-card .src .hi{display:inline-flex;align-items:center}
  .td-rank-card .src .wc-ic{width:12px;height:12px}
  .td-rank-card .num{font-family:var(--f-display);font-size:48px;color:var(--accent-text);line-height:0.9;margin-top:6px;font-variant-numeric:tabular-nums}
  .td-rank-card .peak{font-family:var(--f-body);font-weight:600;font-size:11px;color:var(--text-3);margin-top:8px}
  .td-rank-card .peak.up{color:var(--success-text)} .td-rank-card .peak.down{color:var(--danger-text)}

  .td-wc-hist-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:6px}
  .td-wc-hist-card{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);padding:11px 13px}
  .td-wc-hist-card .year{font-family:var(--f-display);font-size:22px;color:var(--text)}
  .td-wc-hist-card .out{font-family:var(--f-body);font-weight:700;font-size:11px;color:var(--text-2);margin-top:4px;display:flex;align-items:center;gap:5px}
  .td-wc-hist-card .out .hi{display:inline-flex;align-items:center;color:var(--accent-text)}
  .td-wc-hist-card .out .wc-ic{width:12px;height:12px}
  .td-wc-hist-card .pld{font-family:var(--f-body);font-weight:600;font-size:11px;color:var(--text-3);margin-top:2px}

  a.td-plink{color:inherit;text-decoration:none;cursor:pointer;transition:color .15s}
  a.td-plink:hover,.td-sc-name a:hover{color:var(--accent-text)}

  /* Tournament scorers list */
  .td-scorers{display:flex;flex-direction:column;gap:1px;background:var(--border-subtle);border-radius:var(--r-md);overflow:hidden;border:1px solid var(--border)}
  .td-scorers .row{display:flex;align-items:center;gap:10px;background:var(--surface-2);padding:11px 14px}
  .td-scorers .g{font-family:var(--f-display);font-size:20px;color:var(--accent-text);min-width:26px;text-align:center;font-variant-numeric:tabular-nums}
  .td-scorers .meta{flex:1;min-width:0}
  .td-scorers .name{font-family:var(--f-body);font-weight:800;font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .td-scorers .sub{font-family:var(--f-body);font-weight:600;font-size:11px;color:var(--text-3)}

  /* Squad value: MVP face photo + value-by-position bars (flat solid fill) */
  .td-svpos{margin-top:16px;padding-top:14px;border-top:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:8px}
  .td-svpos .row{display:flex;align-items:center;gap:10px}
  .td-svpos .lbl{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:0.06em;color:var(--text-2);min-width:84px;text-transform:uppercase}
  .td-svpos .track{flex:1;height:7px;background:var(--surface-2);border-radius:var(--r-pill);overflow:hidden}
  .td-svpos .fill{height:100%;background:var(--accent);border-radius:var(--r-pill);transform-origin:left;animation:wc-grow-x .7s cubic-bezier(.4,0,.18,1) both}
  .td-svpos .v{font-family:var(--f-mono);font-weight:700;font-size:10px;color:var(--text-3);min-width:42px;text-align:right;font-variant-numeric:tabular-nums}

  /* Squad profile extra chips (clubs / foreign-based / age range / height) */
  .td-demo2{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:1px;background:var(--border-subtle);border-radius:var(--r-md);overflow:hidden;margin-top:12px;border:1px solid var(--border)}
  .td-demo2 .cell{background:var(--surface-1);padding:11px 10px;text-align:center}
  .td-demo2 .v{font-family:var(--f-display);font-size:19px;color:var(--text);line-height:1}
  .td-demo2 .v.accent{color:var(--accent-text)}
  .td-demo2 .lbl{font-family:var(--f-body);font-weight:800;font-size:8px;letter-spacing:0.06em;color:var(--text-3);margin-top:4px;text-transform:uppercase}
  .td-foot{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
  .td-foot .seg{flex:none;display:flex;align-items:center;gap:6px;font-family:var(--f-body);font-weight:700;font-size:11px;color:var(--text-2)}
  .td-foot .dot{width:9px;height:9px;border-radius:50%}
  .td-foot .dot.right{background:var(--accent)} .td-foot .dot.left{background:var(--success)} .td-foot .dot.both{background:var(--text-3)}

  /* Where they play (flat solid bars) */
  .td-wtp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @container (max-width:520px){.td-wtp-grid{grid-template-columns:1fr}}
  .td-wtp h4{font-family:var(--f-body);font-weight:900;font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:11px}
  .td-wtp-row{display:flex;align-items:center;gap:9px;margin-bottom:8px}
  .td-wtp-row .lab{display:flex;align-items:center;gap:6px;min-width:0;flex:1}
  .td-wtp-row .lab .fl{width:18px;height:13px;flex:none;border-radius:2px;background-size:cover;background-position:center;box-shadow:0 0 0 1px rgba(0,0,0,.18)}
  .td-wtp-row .lab span{font-family:var(--f-body);font-weight:700;font-size:11px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .td-wtp-row .track{width:42%;flex:none;height:8px;background:var(--surface-2);border-radius:var(--r-pill);overflow:hidden}
  .td-wtp-row .fill{height:100%;background:var(--accent);border-radius:var(--r-pill);transform-origin:left;animation:wc-grow-x .7s cubic-bezier(.4,0,.18,1) both}
  .td-wtp-row .n{font-family:var(--f-display);font-size:13px;color:var(--accent-text);min-width:20px;text-align:right;font-variant-numeric:tabular-nums}

  /* Squad card photo + contract flag */
  .td-squad-card .face{width:38px;height:38px;flex:none;border-radius:50%;background:var(--surface-3);border:1px solid var(--border);background-size:cover;background-position:center 35%;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .td-squad-card .face .ini{font-family:var(--f-display);font-size:13px;color:var(--text-3)}
  .td-squad-card .sub .exp{color:var(--warning-text)}

  /* Federation card (SportsDB badge + socials) */
  .td-fed{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
  .td-fed .badge{height:80px;width:80px;object-fit:contain;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);padding:8px;flex:none}
  .td-fed .info{flex:1;min-width:200px}
  .td-fed .hi{display:inline-flex;align-items:center}
  .td-fed .home{font-family:var(--f-body);font-weight:700;font-size:13px;color:var(--text);display:flex;align-items:center;gap:6px}
  .td-fed .home .wc-ic{width:14px;height:14px;color:var(--text-3)}
  .td-fed .home span{color:var(--text-2)}
  .td-fed .socials{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
  .td-fed .socials a{display:inline-flex;align-items:center;gap:5px;font-family:var(--f-body);font-weight:700;font-size:11px;color:var(--text-2);border:1px solid var(--border);background:var(--surface-2);padding:6px 10px;border-radius:var(--r-sm);text-decoration:none;transition:border-color var(--dur-2),color var(--dur-2),background var(--dur-2)}
  .td-fed .socials a:hover{border-color:var(--accent-line);color:var(--text);background:var(--surface-3)}
  .td-fed .socials a .wc-ic{width:12px;height:12px}
  .td-fed-stadium{width:100%;height:180px;object-fit:cover;border-radius:var(--r-md);margin-top:14px;border:1px solid var(--border)}

  .td-loading{padding:40px 20px;text-align:center;font-family:var(--f-body);font-weight:700;font-size:13px;color:var(--text-3)}
  .td-loading::before{content:'';display:inline-block;width:14px;height:14px;border:2px solid var(--border-strong);border-top-color:var(--accent);border-radius:50%;animation:wc-spin .9s linear infinite;vertical-align:middle;margin-right:10px}
  .td-error{padding:24px 18px;text-align:center;font-family:var(--f-body);font-weight:600;font-size:13px;color:var(--danger-text);background:var(--danger-quiet);border:1px solid var(--danger);border-radius:var(--r-md);max-width:580px;margin:30px auto}

  /* What this team needs — odds + cross-impact rooting guide (card chrome from .td-section) */
  .tr-body{margin-top:2px}
  .tr-skel{font-family:var(--f-body);color:var(--text-3);font-size:13px;padding:6px 0}
  .tr-skel::before{content:'';display:inline-block;width:13px;height:13px;border:2px solid var(--border-strong);border-top-color:var(--accent);border-radius:50%;animation:wc-spin .9s linear infinite;vertical-align:middle;margin-right:9px}
  .tr-head{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
  .tr-odds{display:flex;flex-direction:column;gap:2px;min-width:118px}
  .tr-odds .big{font-family:var(--f-display);font-size:46px;line-height:.9;color:var(--text)}
  .tr-odds.in .big,.tr-odds.good .big{color:var(--success-text)}
  .tr-odds.mid .big{color:var(--accent-text)}
  .tr-odds.low .big,.tr-odds.out .big{color:var(--danger-text)}
  .tr-odds .cap{font-family:var(--f-body);font-weight:800;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3)}
  .tr-fin{display:flex;gap:8px;flex-wrap:wrap}
  .tr-fin .r{display:flex;flex-direction:column;gap:1px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-sm);padding:7px 13px;min-width:62px}
  .tr-fin .r span{font-family:var(--f-body);font-weight:800;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)}
  .tr-fin .r b{font-family:var(--f-mono);font-size:15px;color:var(--text);font-variant-numeric:tabular-nums}
  .tr-sub{font-family:var(--f-body);font-weight:900;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);margin:18px 0 9px}
  .tr-own-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .tr-col{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);padding:11px 8px;text-align:center}
  .tr-col .k{font-family:var(--f-body);font-weight:800;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3)}
  .tr-col .v{font-family:var(--f-mono);font-size:23px;margin-top:3px;color:var(--text);font-variant-numeric:tabular-nums}
  .tr-col.win .v{color:var(--success-text)} .tr-col.loss .v{color:var(--danger-text)} .tr-col.draw .v{color:var(--text-2)}
  .tr-game{display:grid;grid-template-columns:minmax(96px,auto) 1fr auto;gap:12px;align-items:center;padding:9px 13px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:6px}
  .tr-game .gm{display:flex;align-items:center;gap:7px;font-family:var(--f-mono);font-weight:700;font-size:13px;color:var(--text)}
  .tr-game .gm .x{color:var(--text-3);font-size:10px;font-family:var(--f-body)}
  .tr-game .gm-live{font-family:var(--f-body);font-weight:900;font-size:8px;letter-spacing:.06em;color:var(--live-ink);background:var(--live);padding:2px 5px;border-radius:4px}
  .tr-game .want{font-family:var(--f-body);font-size:12px;color:var(--text-2)}
  .tr-game .want b{color:var(--text)}
  .tr-game .want.win b{color:var(--success-text)} .tr-game .want.draw b{color:var(--accent-text)}
  .tr-game .sw{font-family:var(--f-mono);font-weight:700;font-size:12px;color:var(--text-3);font-variant-numeric:tabular-nums;justify-self:end}
  .tr-odds .big .rg-txt{font-family:var(--f-display);font-size:30px}
  .tr-route{display:grid;grid-template-columns:minmax(92px,auto) 1fr;gap:14px;align-items:center;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);padding:11px 14px;margin-bottom:6px}
  .tr-route .gm{display:flex;align-items:center;gap:7px;font-family:var(--f-mono);font-weight:700;font-size:13px;color:var(--text)}
  .tr-route .gm .x{color:var(--text-3);font-size:10px;font-family:var(--f-body)}
  .tr-route .need{font-family:var(--f-body);font-weight:800;font-size:13px;color:var(--accent-text)}
  .tr-routenote{font-family:var(--f-body);font-size:12px;color:var(--text-3);margin-top:4px}
  @media (max-width:560px){.tr-head{gap:14px}.tr-odds .big{font-size:40px}.tr-game{grid-template-columns:auto 1fr}.tr-game .sw{display:none}}
`;

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

// External <img> with a graceful failure path: a dead/blocked URL (broken
// SportsDB badge, missing stadium fanart, 404'd portrait) would otherwise render
// the browser's broken-image glyph. On error we hide the <img>; if a `fallback`
// node is supplied, it's swapped in (e.g. an initials monogram or placeholder).
function imgEl(attrs = {}, fallback = null) {
  const img = el('img', attrs);
  img.addEventListener('error', () => {
    img.style.display = 'none';
    if (fallback && img.parentNode && !img.dataset.fellBack) {
      img.dataset.fellBack = '1';
      img.parentNode.insertBefore(fallback, img);
    }
  });
  return img;
}

// Apply a background-image to a face/crest element, but only after the image has
// successfully loaded — so a 404 leaves the existing initials/placeholder visible
// instead of an empty box. Returns nothing; mutates `node` on load.
function setBgWhenLoaded(node, url) {
  if (!node || !url) return;
  const probe = new Image();
  probe.addEventListener('load', () => { node.style.backgroundImage = `url(${url})`; });
  probe.src = url;
}

// Wrap a player name in a popup link (resolved by tmId when known, else by name).
function playerLink(name, tmId, className = 'td-plink') {
  if (!name) return document.createTextNode('');
  const id = tmId || `name:${name}`;
  return el('a', { class: className, href: `/wc/player/${encodeURIComponent(id)}` }, name);
}

async function loadTeamMatches(teamCode, team) {
  // Prefer live (real-time scores/status); fall back to the complete local
  // schedule filtered to this team so fixtures always render.
  try {
    const r = await api.getMatches({ team: teamCode });
    const arr = Array.isArray(r) ? r : (r && r.data) || [];
    if (arr && arr.length) return arr;
  } catch {}
  try {
    const all = await data.getMatchesSample();
    const names = new Set([team.name, team.name_normalised].filter(Boolean));
    return (all || []).filter(m => names.has(m.home_team) || names.has(m.away_team));
  } catch { return null; }
}

export async function renderTeamInto(container, teamCode, opts = {}) {
  container.classList.add('td-root');
  container.innerHTML = `<div class="td-loading">Loading team…</div>`;

  const team = await data.teamByCode(teamCode);
  if (!team) {
    container.innerHTML = `<div class="td-error">Unknown team code: ${teamCode}</div>`;
    return;
  }

  if (opts.setTitle) opts.setTitle(team.name, { flagUrl: flagSrc(team.fifa_code) });

  const enrich = await Promise.allSettled([
    loadTeamMatches(teamCode, team),
    api.getGroups().catch(() => null),
    data.getCountries(),
    data.getEloRatings(),
    data.getFifaRankings(),
    data.getTeamRecords(),
    data.getPlayersByTeamSample(),
    data.get2026Squads().catch(() => null),
    data.getSportsdbTeams(),
    data.getPronunciations(),
    Promise.all([2010, 2014, 2018, 2022].map(y => data.getWcYear(y).catch(() => null))),
    api.getMatches().catch(() => null),          // all matches → live group table
    data.getTournamentScorers(),                  // golden boot / scorers
    data.getGroupsSample().catch(() => null),     // static standings fallback
  ]);
  const [matches, groups, countries, elo, fifa, records, playersSample, squads2026, sportsdb, prons, history, allMatches, scorers, groupsStatic] =
    enrich.map(r => r.status === 'fulfilled' ? r.value : null);

  const ctx = { team, matches, groups, countries, elo, fifa, records, playersSample, squads2026, sportsdb, prons, history, allMatches, scorers, groupsStatic, container, opts, sort: 'value' };
  render(ctx);
}

function render(ctx) {
  const { team, container } = ctx;
  container.innerHTML = '';

  const flagUrl = flagSrc(team.fifa_code) || '';
  const country = (ctx.countries || {})[team.fifa_code] || null;
  const sportsdbT = (ctx.sportsdb || {})[team.fifa_code] || null;
  // Try both the team name and the normalised name (e.g. "USA" vs "United States").
  const pronUrl = pronounce(ctx.prons, team.name, 'countries')
              || pronounce(ctx.prons, team.name_normalised, 'countries');

  // HERO — flag as a cover background, a scrim gradient fading to the page
  // surface under the name plate so it reads in both themes (no stretch/distort).
  const hero = el('div', { class: 'td-hero' });
  hero.appendChild(el('div', { class: 'td-hero-bg', style: flagUrl ? `background-image:url(${flagUrl})` : '' }));
  hero.appendChild(el('div', { class: 'td-hero-scrim' }));
  const plate = el('div', { class: 'td-plate' });
  // Team crest as a focal element in the plate (the flag band alone reads empty).
  // Hidden gracefully if the SportsDB badge URL fails to load.
  if (sportsdbT && sportsdbT.badge) {
    plate.appendChild(imgEl({ class: 'td-crest', src: sportsdbT.badge, alt: `${team.name} crest`, loading: 'lazy' }));
  }
  const plateText = el('div', { class: 'td-plate-text' });
  plateText.appendChild(el('div', { class: 'name' }, team.name));
  const meta = el('div', { class: 'meta' });
  meta.appendChild(el('span', {}, team.confed || 'FIFA'));
  meta.appendChild(el('span', { class: 'dot' }));
  meta.appendChild(el('span', {}, 'Group ' + team.group));
  plateText.appendChild(meta);
  if (pronUrl) {
    const pron = el('button', {
      class: 'td-pron',
      type: 'button',
      'aria-label': `Hear ${team.name}`,
      onclick: (ev) => playPron(ev.currentTarget, pronUrl),
    },
      el('span', { html: icon('volume-2', { size: 14 }) }),
      ' Hear name');
    plateText.appendChild(pron);
  }
  plate.appendChild(plateText);
  hero.appendChild(plate);
  container.appendChild(hero);

  // Meta bar
  // Live /groups gives membership only → compute the table from all matches
  // (joined by FIFA code, robust to name spelling); fall back to static standings.
  const liveGroup = (ctx.groups || []).find(g => (g.group_name || g.group || g.letter) === team.group);
  let standingsForGroup = pickGroupStandings(ctx.groups, team.group);
  if ((!standingsForGroup || !standingsForGroup.length) && ctx.allMatches) {
    standingsForGroup = data.computeGroupStandings(ctx.allMatches, liveGroup || { group_name: team.group });
  }
  if (!standingsForGroup || !standingsForGroup.length) standingsForGroup = pickGroupStandings(ctx.groupsStatic, team.group);
  const myRow = (standingsForGroup || []).find(r =>
    (r.code && r.code === team.fifa_code) || (r.team || r.name) === team.name || (r.team || r.name) === team.name_normalised);
  const pos = standingsForGroup ? standingsForGroup.findIndex(r => (r.team || r.name) === team.name || (r.team || r.name) === team.name_normalised) + 1 : 0;
  container.appendChild(el('div', { class: 'td-meta-bar' },
    el('div', { class: 'cell' }, el('div', { class: 'lbl' }, 'Confederation'), el('div', { class: 'val' }, team.confed || 'FIFA')),
    el('div', { class: 'cell' }, el('div', { class: 'lbl' }, 'Group'), el('div', { class: 'val big' }, team.group)),
    el('div', { class: 'cell' }, el('div', { class: 'lbl' }, 'Standing'), el('div', { class: 'val' }, pos > 0 ? ordinal(pos) : '—')),
  ));

  // Record strip → token stat tiles
  const w = myRow?.won ?? 0, d = myRow?.drawn ?? 0, l = myRow?.lost ?? 0, gp = myRow?.played ?? 0, pts = myRow?.points ?? 0;
  container.appendChild(el('div', { class: 'td-record' },
    cell(gp, 'PLAYED'),
    cell(w, 'WON', 'win'),
    cell(d, 'DREW', 'draw'),
    cell(l, 'LOST', 'loss'),
    cell(pts, 'POINTS', 'pts', true),
  ));

  // What this team needs — advancement odds + cross-impact rooting guide (async).
  container.appendChild(buildRootingGuide(team));

  // SV + demographics
  const sv = buildSquadValue(team, ctx.playersSample);
  const demo = buildDemographics(team, ctx.playersSample, ctx.squads2026);
  container.appendChild(el('div', { class: 'td-grid-2', style: 'margin-top:14px' }, sv, demo));

  // Rankings
  const rk = buildRankings(team, ctx.elo, ctx.fifa);
  if (rk) container.appendChild(rk);

  // Country panel
  if (country) container.appendChild(buildCountryPanel(country));

  // SportsDB federation card
  if (sportsdbT) container.appendChild(buildSportsdbCard(sportsdbT));

  // Standings + Fixtures
  const fixSection = buildFixtures(team, ctx.matches);
  const standSection = standingsForGroup ? buildStandings(standingsForGroup, team, team.group) : null;
  if (standSection && fixSection) container.appendChild(el('div', { class: 'td-grid-2' }, standSection, fixSection));
  else if (standSection) container.appendChild(standSection);
  else if (fixSection) container.appendChild(fixSection);

  // Tournament scorers (golden boot data, from live match timelines)
  container.appendChild(buildScorers(team, ctx.scorers, myRow?.gf ?? 0));

  // All-time international record (1872-present per team-all-time-records.json)
  if (ctx.records && ctx.records[team.fifa_code]) {
    container.appendChild(buildAllTimeRecord(ctx.records[team.fifa_code]));
  }

  // WC history
  const hist = buildWcHistory(team, ctx.history);
  if (hist) container.appendChild(hist);

  // Where they play (clubs + leagues that supply the squad)
  const wtp = buildWhereTheyPlay(team, ctx.playersSample);
  if (wtp) container.appendChild(wtp);

  // Full squad
  container.appendChild(buildSquad(team, ctx.playersSample, ctx.squads2026, ctx));
}

// ── What this team needs (forecast odds + cross-impact "rooting guide") ────────
// Returns a NODE: a real Lucide check when clinched, else a text node. (Never a ✓ glyph.)
function RG_MARK(v, size = 14) {
  if (v == null) return document.createTextNode('—');
  if (v >= 0.9995) return el('span', { class: 'rg-ck', html: icon('check', { size }) });
  if (v <= 0.0005) return document.createTextNode('out');
  return document.createTextNode(Math.min(99, Math.max(1, Math.round(v * 100))) + '%');
}
const RG_SWING = (q) => q ? Math.max(q.H, q.D, q.A) - Math.min(q.H, q.D, q.A) : 0;

function buildRootingGuide(team) {
  const sec = el('section', { class: 'td-section tr-guide' });
  sec.appendChild(sectionHead(`What ${team.name} needs`, 'trending-up', 'modelled'));
  const body = el('div', { class: 'tr-body' }, el('div', { class: 'tr-skel' }, 'Crunching scenarios…'));
  sec.appendChild(body);
  fillRootingGuide(body, team).catch(() => {
    body.innerHTML = '';
    body.appendChild(el('div', { class: 'td-empty-note' }, 'Scenario model unavailable right now.'));
  });
  return sec;
}

async function fillRootingGuide(body, team) {
  const code = team.fifa_code;
  const FC = await import('./forecast-client.js');
  const [fc, cx, liveMatches, C] = await Promise.all([
    FC.getForecast(), FC.getCrossImpact(),
    api.getMatches({ round: 'group' }).then((r) => (Array.isArray(r) ? r : (r && r.data) || [])).catch(() => []),
    import('./clinch.js'),
  ]);
  // DETERMINISTIC qualification — exact clinched/alive/eliminated + the precise
  // route. Never says "out" when a real (even sub-0.01%) path exists.
  let det = null; try { det = C.analyzeTeam(liveMatches, code); } catch {}
  const me = fc && fc.teams && fc.teams[code];
  body.innerHTML = '';
  if (!me || !cx || !cx.cross) {
    body.appendChild(el('div', { class: 'td-empty-note' }, 'No group-stage scenario for this team (through to the knockouts, or the group phase is complete).'));
    return;
  }

  // Headline — DETERMINISTIC status leads; the Monte-Carlo % is the likelihood.
  const q = me.qualify ?? 0;
  const status = det ? det.status : (q >= 0.9995 ? 'clinched' : q <= 0.0005 ? 'eliminated' : 'alive');
  let oddsEl, cap, tone;
  if (status === 'clinched') { oddsEl = el('span', { class: 'rg-ck', html: icon('check', { size: 30 }) }); cap = 'through to the Round of 32'; tone = 'in'; }
  else if (status === 'eliminated') { oddsEl = el('span', { class: 'rg-txt' }, 'OUT'); cap = 'eliminated from contention'; tone = 'out'; }
  else if (q <= 0.0005) { oddsEl = el('span', { class: 'rg-txt' }, 'ALIVE'); cap = 'still possible — see what must happen'; tone = 'low'; }
  else { oddsEl = RG_MARK(q, 30); cap = 'to reach Round of 32'; tone = q >= 0.6 ? 'good' : q >= 0.3 ? 'mid' : 'low'; }
  const fin = el('div', { class: 'tr-fin' });
  fin.appendChild(el('div', { class: 'r' }, el('span', {}, 'Win group'), el('b', {}, RG_MARK(me.first ?? 0))));
  fin.appendChild(el('div', { class: 'r' }, el('span', {}, 'Runner-up'), el('b', {}, RG_MARK(me.second ?? 0))));
  fin.appendChild(el('div', { class: 'r' }, el('span', {}, '3rd place'), el('b', {}, RG_MARK(me.third ?? 0))));
  body.appendChild(el('div', { class: 'tr-head' },
    el('div', { class: 'tr-odds ' + tone }, el('div', { class: 'big' }, oddsEl), el('div', { class: 'cap' }, cap)),
    fin));

  const matches = Object.values(cx.cross);
  // Their own remaining group game(s) — what they themselves need
  const own = matches.filter((m) => m.homeCode === code || m.awayCode === code).sort((a, b) => a.matchNumber - b.matchNumber);
  for (const m of own) {
    const isHome = m.homeCode === code;
    const opp = isHome ? m.awayCode : m.homeCode;
    const qme = m.qual[code] || {};
    const win = isHome ? qme.H : qme.A, lose = isHome ? qme.A : qme.H, draw = qme.D;
    const colp = (k, v, cls) => el('div', { class: 'tr-col ' + cls }, el('div', { class: 'k' }, k), el('div', { class: 'v' }, RG_MARK(v, 20)));
    body.appendChild(el('div', {},
      el('div', { class: 'tr-sub' }, (m.status === 'live' ? 'Their match (live) · vs ' : 'Their match · vs '), el('b', { style: 'color:var(--text)' }, opp)),
      el('div', { class: 'tr-own-grid' }, colp('Win', win, 'win'), colp('Draw', draw, 'draw'), colp('Lose', lose, 'loss'))));
  }

  // What must happen — EXACT deterministic route (margins + OR-cases), not a probability.
  if (status === 'alive') {
    const binding = (det && det.perMatch || []).filter((p) => p.kind === 'cond');
    const anyN = (det && det.perMatch || []).filter((p) => p.kind === 'any').length;
    body.appendChild(el('div', { class: 'tr-sub' }, 'What must happen'));
    if (binding.length) {
      for (const p of binding) body.appendChild(el('div', { class: 'tr-route' },
        el('div', { class: 'gm' }, el('span', {}, p.hc), el('span', { class: 'x' }, 'v'), el('span', {}, p.ac)),
        el('div', { class: 'need' }, p.text)));
      if (anyN) body.appendChild(el('div', { class: 'tr-routenote' }, `The other ${anyN} remaining game${anyN > 1 ? 's' : ''}: any result.`));
    } else {
      // no single clean condition — fall back to the probability-swing rooting list
      const others = matches.filter((m) => m.homeCode !== code && m.awayCode !== code && m.qual[code])
        .map((m) => ({ m, s: RG_SWING(m.qual[code]) })).filter((x) => x.s >= 0.02).sort((a, b) => b.s - a.s).slice(0, 6);
      if (!others.length) body.appendChild(el('div', { class: 'td-empty-note' }, 'Still alive — results elsewhere need to break their way.'));
      else for (const { m } of others) body.appendChild(rootRow(m, code));
    }
  } else if (status === 'eliminated') {
    body.appendChild(el('div', { class: 'tr-sub' }, 'Status'));
    body.appendChild(el('div', { class: 'td-empty-note' }, `${team.name} can no longer reach the Round of 32 under any combination of remaining results.`));
  } else {
    body.appendChild(el('div', { class: 'tr-sub' }, 'Through to the knockouts'));
    body.appendChild(el('div', { class: 'td-empty-note' }, `${team.name} are in. (Which results give them an easier knockout path is coming soon.)`));
  }
}

// Probability-swing rooting row — shows the team's qualify% across the game's
// outcomes as "lo% → hi%" (clearer than a bare "±N pt" swing).
function rootRow(m, code) {
  const q3 = m.qual[code], vals = [q3.H, q3.D, q3.A];
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const best = [['H', q3.H], ['D', q3.D], ['A', q3.A]].sort((a, b) => b[1] - a[1])[0][0];
  const want = best === 'D' ? 'a draw' : best === 'H' ? m.homeCode : m.awayCode;
  const pc = (v) => v >= 0.9995 ? '✓' : v <= 0.0005 ? '0%' : Math.min(99, Math.max(1, Math.round(v * 100))) + '%';
  return el('div', { class: 'tr-game' },
    el('div', { class: 'gm' }, el('span', {}, m.homeCode), el('span', { class: 'x' }, 'v'), el('span', {}, m.awayCode),
      m.status === 'live' ? el('span', { class: 'gm-live' }, 'LIVE') : null),
    el('div', { class: 'want ' + (best === 'D' ? 'draw' : 'win') }, 'wants ', el('b', {}, want)),
    el('div', { class: 'sw' }, pc(lo) + ' → ' + pc(hi)));
}

// Stat-tile cell for the record strip. `tone` maps to a semantic colour class
// (win/draw/loss/pts); `accent` tints the whole tile (the highlighted POINTS cell).
function cell(v, lbl, tone, accent) {
  return el('div', { class: 'cell' + (accent ? ' accent' : '') },
    el('div', { class: 'v' + (tone ? ' ' + tone : '') }, String(v)),
    el('div', { class: 'lbl' }, lbl),
  );
}

// Section heading: an Lucide icon + title (+ optional right-aligned note node).
function sectionHead(title, iconName, note) {
  const h = el('h3', {});
  if (iconName) h.appendChild(el('span', { class: 'hi', html: icon(iconName, { size: 14 }) }));
  h.appendChild(el('span', {}, title));
  if (note != null) h.appendChild(note instanceof Node ? note : el('span', { class: 'note' }, String(note)));
  return h;
}

function pickGroupStandings(groups, letter) {
  if (!groups || !letter) return null;
  const arr = Array.isArray(groups) ? groups : (groups.data || groups.groups || []);
  if (!Array.isArray(arr)) return null;
  const g = arr.find(x => (x.group_name || x.group) === letter || x.letter === letter);
  return g ? (g.standings || g.table || []) : null;
}

function teamSquad(team, playersSample, squads2026) {
  const sampleList = data.squadFor(playersSample, team);
  if (sampleList && sampleList.length) {
    return sampleList.map(p => ({
      name: p.name, tmId: p.tmId, shirt: p.shirtNumber || null,
      position: normPos(p), positionDetail: p.positionDetail || p.position,
      club: p.currentClub, clubCountry: p.currentClubCountry || null,
      age: p.age, caps: p.internationalCaps, value: p.marketValueEur,
      peak: p.marketValuePeak || null, photo: p.tmPhotoUrl || null,
      foot: p.preferredFoot || null, height: p.height || null,
      contractUntil: p.contractUntil || null,
    }));
  }
  const enrich = squads2026 && (squads2026[team.fifa_code] || squads2026[team.name]);
  if (enrich && Array.isArray(enrich)) {
    return enrich.map(p => ({
      name: p.name || p.player, shirt: p.shirt_number || p.no || null,
      position: p.position || 'MID', club: p.club || '', clubCountry: null,
      age: p.age || null, caps: null, value: null, photo: null,
    }));
  }
  return [];
}
// Transfermarkt positionGroup (GK/DF/MF/FW) → our 4-bucket code. This is the
// reliable signal; the free-text `position` field is inconsistent ("DF" vs
// "Goalkeeper") and must not be fed to the substring matcher below.
const POSGROUP = { GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'FWD' };
function normPos(p) {
  return POSGROUP[p.positionGroup] || shortPos(p.positionDetail || p.position);
}
function shortPos(p) {
  if (!p) return 'MID';
  const s = String(p).toLowerCase();
  if (s === 'gk' || s.includes('keeper')) return 'GK';
  if (s === 'df' || s.includes('back') || s.includes('defender') || s.includes('def')) return 'DEF';
  if (s === 'fw' || s.includes('forward') || s.includes('striker') || s.includes('winger') || s.includes('fwd')) return 'FWD';
  return 'MID';
}

function buildSquadValue(team, playersSample) {
  const squad = teamSquad(team, playersSample, null);
  const sec = el('div', { class: 'td-section td-sv' });
  sec.appendChild(sectionHead('Squad value', 'trending-up'));
  if (!squad.length) {
    sec.appendChild(el('div', { class: 'td-empty-note' }, 'Player-level Transfermarkt data not yet wired for this team.'));
    return sec;
  }
  const withValue = squad.filter(p => p.value);
  const total = withValue.reduce((a, p) => a + p.value, 0);
  const avg = withValue.length ? Math.round(total / withValue.length) : 0;
  const mvp = withValue.slice().sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  sec.appendChild(el('div', { class: 'num' }, eur(total)));
  sec.appendChild(el('div', { class: 'lbl' }, `${squad.length} players · avg ${eur(avg)}`));
  if (mvp) {
    // Always render the initials monogram; the photo only covers it once it
    // actually loads, so a dead Transfermarkt/SportsDB URL falls back cleanly.
    const face = el('div', { class: 'face' });
    face.appendChild(document.createTextNode(initials(mvp.name)));
    if (mvp.photo) setBgWhenLoaded(face, mvp.photo);
    sec.appendChild(el('a', { class: 'mvp', href: `/wc/player/${encodeURIComponent(mvp.tmId || 'name:' + mvp.name)}`, style: 'text-decoration:none' },
      face,
      el('div', { class: 'info' },
        el('div', { class: 'name' }, mvp.name),
        el('div', { class: 'sub' }, 'Most valuable player'),
      ),
      el('div', { class: 'val' }, eur(mvp.value)),
    ));
  }
  // Value concentrated by position line.
  if (withValue.length) {
    const byPos = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const p of withValue) byPos[p.position] = (byPos[p.position] || 0) + p.value;
    const maxPos = Math.max(...Object.values(byPos), 1);
    const POSLBL = { GK: 'Goal', DEF: 'Defence', MID: 'Midfield', FWD: 'Attack' };
    const box = el('div', { class: 'td-svpos' });
    for (const k of ['GK', 'DEF', 'MID', 'FWD']) {
      if (!byPos[k]) continue;
      box.appendChild(el('div', { class: 'row' },
        el('span', { class: 'lbl' }, POSLBL[k]),
        el('div', { class: 'track' }, el('div', { class: 'fill', style: `width:${(byPos[k] / maxPos * 100).toFixed(1)}%` })),
        el('span', { class: 'v' }, eur(byPos[k])),
      ));
    }
    sec.appendChild(box);
  }
  return sec;
}

function buildDemographics(team, playersSample, squads2026) {
  const squad = teamSquad(team, playersSample, squads2026);
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(sectionHead('Squad profile', 'users'));
  if (!squad.length) {
    sec.appendChild(el('div', { class: 'td-empty-note' }, 'Roster not yet wired.'));
    return sec;
  }
  const ages = squad.filter(p => p.age).map(p => p.age);
  const avgAge = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : '—';
  sec.appendChild(el('div', { class: 'td-demo' },
    el('div', { class: 'cell' }, el('div', { class: 'v' }, String(squad.length)), el('div', { class: 'lbl' }, 'PLAYERS')),
    el('div', { class: 'cell' }, el('div', { class: 'v' }, avgAge), el('div', { class: 'lbl' }, 'AVG AGE')),
  ));

  // Richer profile chips when we have full player data (clubs, foreign-based,
  // age range, average height) — degrade silently for fallback rosters.
  const clubs = new Set(squad.map(p => p.club).filter(Boolean));
  const homeCC = team.fifa_code;
  const based = squad.filter(p => p.clubCountry);
  const foreign = based.filter(p => p.clubCountry !== homeCC).length;
  const heights = squad.filter(p => p.height).map(p => p.height);
  const avgH = heights.length ? Math.round(heights.reduce((a, b) => a + b, 0) / heights.length) : null;
  if (ages.length || clubs.size) {
    const minA = ages.length ? Math.min(...ages) : null;
    const maxA = ages.length ? Math.max(...ages) : null;
    const cells = [];
    if (clubs.size) cells.push(['v', String(clubs.size), 'CLUBS']);
    if (based.length) cells.push(['v accent', `${Math.round(foreign / based.length * 100)}%`, 'PLAY ABROAD']);
    if (minA && maxA) cells.push(['v', `${minA}–${maxA}`, 'AGE RANGE']);
    if (avgH) cells.push(['v', `${avgH}cm`, 'AVG HEIGHT']);
    if (cells.length) {
      const grid2 = el('div', { class: 'td-demo2' });
      for (const [cls, v, lbl] of cells) {
        grid2.appendChild(el('div', { class: 'cell' },
          el('div', { class: 'td-demo2-v ' + cls.replace('v', 'v') }, v),
          el('div', { class: 'lbl' }, lbl)));
      }
      // Fix class names (the helper above kept 'v'/'v accent').
      [...grid2.querySelectorAll('.td-demo2-v')].forEach((e, i) => { e.className = cells[i][0]; });
      sec.appendChild(grid2);
    }
  }

  const POSLABEL = { GK:'Goalkeepers', DEF:'Defenders', MID:'Midfielders', FWD:'Forwards' };
  const counts = { GK:0, DEF:0, MID:0, FWD:0 };
  for (const p of squad) counts[p.position] = (counts[p.position] || 0) + 1;
  const max = Math.max(...Object.values(counts), 1);
  const dist = el('div', { class: 'td-pos-dist', style: 'margin-top:14px' });
  for (const k of ['GK','DEF','MID','FWD']) {
    const pct = Math.round((counts[k] / max) * 100);
    dist.appendChild(el('div', { class: 'td-pos-row' },
      el('span', { class: 'lbl' }, POSLABEL[k]),
      el('div', { class: 'bar' }, el('div', { class: 'fill', style: `width:${pct}%` })),
      el('div', { class: 'n' }, String(counts[k])),
    ));
  }
  sec.appendChild(dist);

  // Preferred-foot split (full data only).
  const feet = squad.filter(p => p.foot);
  if (feet.length) {
    const r = feet.filter(p => /right/i.test(p.foot)).length;
    const l = feet.filter(p => /left/i.test(p.foot)).length;
    const b = feet.length - r - l;
    const foot = el('div', { class: 'td-foot' });
    const seg = (n, dotCls, lbl) => n ? el('div', { class: 'seg' },
      el('span', { class: 'dot ' + dotCls }), `${lbl} ${n}`) : null;
    for (const node of [seg(r, 'right', 'Right'), seg(l, 'left', 'Left'), seg(b, 'both', 'Both')]) {
      if (node) foot.appendChild(node);
    }
    sec.appendChild(foot);
  }
  return sec;
}

// "Where they play" — clubs & leagues that supply this squad. Full data only.
function buildWhereTheyPlay(team, playersSample) {
  const squad = teamSquad(team, playersSample, null);
  const based = squad.filter(p => p.club);
  if (based.length < 3) return null;
  const clubCount = new Map();
  const ccCount = new Map();
  for (const p of based) {
    clubCount.set(p.club, (clubCount.get(p.club) || 0) + 1);
    if (p.clubCountry) ccCount.set(p.clubCountry, (ccCount.get(p.clubCountry) || 0) + 1);
  }
  const topClubs = [...clubCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topCC = [...ccCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (topClubs.length < 2 && topCC.length < 2) return null;
  const maxClub = Math.max(...topClubs.map(c => c[1]), 1);
  const maxCC = Math.max(...topCC.map(c => c[1]), 1);

  const sec = el('div', { class: 'td-section' });
  sec.appendChild(sectionHead('Where they play', 'globe', `${new Set(based.map(p => p.club)).size} clubs`));
  const grid = el('div', { class: 'td-wtp-grid' });

  const clubsBox = el('div', { class: 'td-wtp' });
  clubsBox.appendChild(el('h4', {}, 'Clubs'));
  for (const [club, n] of topClubs) {
    clubsBox.appendChild(el('div', { class: 'td-wtp-row' },
      el('div', { class: 'lab' }, el('span', {}, club)),
      el('div', { class: 'track' }, el('div', { class: 'fill', style: `width:${(n / maxClub * 100).toFixed(1)}%` })),
      el('div', { class: 'n' }, String(n))));
  }
  grid.appendChild(clubsBox);

  if (topCC.length >= 2) {
    const ccBox = el('div', { class: 'td-wtp' });
    ccBox.appendChild(el('h4', {}, 'Leagues'));
    for (const [cc, n] of topCC) {
      const fl = flagSrc(cc);
      ccBox.appendChild(el('div', { class: 'td-wtp-row' },
        el('div', { class: 'lab' },
          fl ? el('div', { class: 'fl', style: `background-image:url(${fl})` }) : null,
          el('span', {}, cc)),
        el('div', { class: 'track' }, el('div', { class: 'fill', style: `width:${(n / maxCC * 100).toFixed(1)}%` })),
        el('div', { class: 'n' }, String(n))));
    }
    grid.appendChild(ccBox);
  }
  sec.appendChild(grid);
  return sec;
}

function buildRankings(team, elo, fifa) {
  if (!elo && !fifa) return null;
  const eloEntry = elo && elo[team.fifa_code];
  const fifaEntry = fifa && fifa[team.fifa_code];
  if (!eloEntry && !fifaEntry) return null;
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(sectionHead('Strength · predictive vs official', 'chart-line'));
  const grid = el('div', { class: 'td-rank-grid' });
  if (eloEntry) {
    const rank = eloEntry.current_rank ?? '—';
    const rating = eloEntry.current_rating;
    const peak = eloEntry.peak_rating;
    const peakYear = eloEntry.peak_rating_year;
    const bestRank = eloEntry.best_rank;
    grid.appendChild(el('div', { class: 'td-rank-card' },
      el('div', { class: 'src' }, el('span', { class: 'hi', html: icon('scan-search', { size: 12 }) }), 'Elo · predictive'),
      el('div', { class: 'num' }, '#' + rank),
      rating ? el('div', { class: 'peak' }, `Rating ${Math.round(rating)}`) : null,
      peak ? el('div', { class: 'peak' }, `Peak ${Math.round(peak)}${peakYear ? ' · ' + peakYear : ''}`) : null,
      bestRank ? el('div', { class: 'peak' }, `Best rank #${bestRank}`) : null,
    ));
  }
  if (fifaEntry) {
    const liveRank = fifaEntry.live_rank;
    const officialRank = fifaEntry.official_rank;
    const movement = fifaEntry.ranking_movement || 0;
    const livePts = fifaEntry.live_points;
    const primary = liveRank ?? officialRank ?? '—';
    grid.appendChild(el('div', { class: 'td-rank-card' },
      el('div', { class: 'src' }, el('span', { class: 'hi', html: icon('shield', { size: 12 }) }), 'FIFA · official'),
      el('div', { class: 'num' }, '#' + primary),
      livePts ? el('div', { class: 'peak' }, `${Math.round(livePts)} pts live`) : null,
      officialRank && liveRank && officialRank !== liveRank
        ? el('div', { class: 'peak ' + (movement > 0 ? 'up' : (movement < 0 ? 'down' : '')), html: icon(movement > 0 ? 'arrow-up' : 'arrow-down', { size: 11 }) + ` from #${officialRank}` })
        : (officialRank ? el('div', { class: 'peak' }, `Official #${officialRank}`) : null),
    ));
  }
  sec.appendChild(grid);
  return sec;
}

function buildCountryPanel(country) {
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(sectionHead('Country profile', 'flag'));
  const grid = el('div', { class: 'td-country-grid' });
  if (country.capital) grid.appendChild(field('Capital', Array.isArray(country.capital) ? country.capital[0] : country.capital));
  if (country.population) grid.appendChild(field('Population', formatPop(country.population), true));
  const langs = country.languages;
  if (langs) {
    const text = Array.isArray(langs) ? langs.join(', ') : (typeof langs === 'object' ? Object.values(langs).join(', ') : String(langs));
    grid.appendChild(field('Languages', text));
  }
  const currencies = country.currencies;
  if (currencies) {
    const text = Array.isArray(currencies)
      ? currencies.map(c => typeof c === 'object' ? (c.name || c.code) : c).join(', ')
      : (typeof currencies === 'object' ? Object.entries(currencies).map(([k, v]) => v.name ? `${v.name} (${k})` : k).join(', ') : String(currencies));
    grid.appendChild(field('Currency', text));
  }
  if (country.region) grid.appendChild(field('Region', country.region + (country.subregion ? ' · ' + country.subregion : '')));
  if (country.area_km2) grid.appendChild(field('Area', Math.round(country.area_km2).toLocaleString() + ' km²'));
  if (country.timezone_capital || country.capital_coords) grid.appendChild(field('Capital tz', country.timezone_capital || (country.capital_coords && country.capital_coords.tz)));
  sec.appendChild(grid);
  return sec;
}
function field(k, v, big) {
  return el('div', { class: 'td-country-cell' },
    el('div', { class: 'k' }, k),
    el('div', { class: 'v' + (big ? ' big' : '') }, v),
  );
}
function formatPop(n) {
  if (!n) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k';
  return String(n);
}

function buildSportsdbCard(t) {
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(sectionHead('Federation', 'shield'));
  const wrap = el('div', { class: 'td-fed' });
  if (t.badge) {
    wrap.appendChild(imgEl({ class: 'badge', src: t.badge, alt: '', loading: 'lazy' }));
  }
  const info = el('div', { class: 'info' });
  if (t.stadium) info.appendChild(el('div', { class: 'home' },
    el('span', { class: 'hi', html: icon('map-pin', { size: 14 }) }),
    el('span', {}, t.stadium + (t.location ? ` · ${t.location}` : ''))));
  const socials = el('div', { class: 'socials' });
  const links = [
    ['Website', t.website],
    ['Twitter', t.twitter && `https://twitter.com/${t.twitter}`],
    ['Instagram', t.instagram && `https://instagram.com/${t.instagram}`],
    ['Facebook', t.facebook && `https://facebook.com/${t.facebook}`],
    ['YouTube', t.youtube],
    ['News (RSS)', t.rss],
  ].filter(([, u]) => u);
  for (const [label, url] of links) {
    const ext = url.startsWith('http') ? url : `https://${url}`;
    socials.appendChild(el('a', { href: ext, target: '_blank', rel: 'noopener' },
      label, el('span', { class: 'hi', html: icon('external-link', { size: 12 }) })));
  }
  if (socials.children.length) info.appendChild(socials);
  wrap.appendChild(info);
  sec.appendChild(wrap);
  if (t.stadium_thumb) {
    sec.appendChild(imgEl({ class: 'td-fed-stadium', src: t.stadium_thumb, alt: '', loading: 'lazy' }));
  }
  return sec;
}

function buildStandings(rows, team, letter) {
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(sectionHead(`Group ${letter} standings`, 'list-ordered'));
  sec.appendChild(el('div', { class: 'td-stand-head' },
    el('span', {}, '#'), el('span', {}, 'Team'),
    el('span', { style:'text-align:center' }, 'P'),
    el('span', { style:'text-align:center' }, 'GD'),
    el('span', { style:'text-align:right' }, 'PTS'),
  ));
  rows.forEach((r, i) => {
    const teamName = r.team || r.name;
    const isMe = (r.code && r.code === team.fifa_code) || teamName === team.name || teamName === team.name_normalised;
    const qual = i < 2;
    const t = (r.code && data.teamSync && data.teamSync(r.code)) || (data.teamSync && data.teamSync(teamName));
    const href = t ? `/wc/team/${t.fifa_code}` : '#';
    const row = el('a', { class: `td-stand-row${isMe ? ' me' : ''}${qual && !isMe ? ' q' : ''}`, href, 'data-team-code': t ? t.fifa_code : '' });
    row.appendChild(el('span', { class: 'pos' }, String(i + 1)));
    const nm = el('div', { class: 'nm' });
    const fl = el('span', { class: 'flag' });
    if (t && flagSrc(t.fifa_code)) fl.style.backgroundImage = `url(${flagSrc(t.fifa_code)})`;
    nm.appendChild(fl);
    nm.appendChild(el('span', {}, teamName));
    row.appendChild(nm);
    row.appendChild(el('span', { class: 'c' }, String(r.played ?? 0)));
    const gd = (r.gd != null) ? r.gd : ((r.gf ?? 0) - (r.ga ?? 0));
    row.appendChild(el('span', { class: 'c' + (gd > 0 ? ' gd-pos' : (gd < 0 ? ' gd-neg' : '')) }, gd > 0 ? `+${gd}` : String(gd)));
    row.appendChild(el('span', { class: 'p' }, String(r.points ?? 0)));
    sec.appendChild(row);
  });
  sec.appendChild(el('div', { class: 'td-stand-key' },
    el('span', { class: 's' }),
    el('span', {}, 'Qualifies (top 2)'),
  ));
  return sec;
}

function buildFixtures(team, matches) {
  if (!matches) return null;
  const arr = Array.isArray(matches) ? matches : (matches.data || []);
  if (!Array.isArray(arr) || !arr.length) return null;
  arr.sort((a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc));
  const sec = el('div', { class: 'td-section' });
  const completed = arr.filter(x => x.status === 'finished');
  const formCol = el('div', { class: 'td-form-chips' });
  for (const m of completed.slice(-5)) {
    const homeIsUs = (m.home_team === team.name || m.home_team === team.name_normalised);
    const us = homeIsUs ? m.home_score : m.away_score;
    const them = homeIsUs ? m.away_score : m.home_score;
    const r = us > them ? 'W' : (us < them ? 'L' : 'D');
    formCol.appendChild(el('span', { class: 'td-form-chip td-form-' + r }, r));
  }
  if (!completed.length) formCol.appendChild(el('span', { class: 'td-form-chip td-form-N' }, '—'));
  const fixHead = sectionHead('Fixtures', 'calendar-days');
  fixHead.style.margin = '0';
  const head = el('div', { class: 'td-fix-head' }, fixHead, formCol);
  sec.appendChild(head);
  for (const m of arr) {
    const homeIsUs = (m.home_team === team.name || m.home_team === team.name_normalised);
    const oppName = homeIsUs ? m.away_team : m.home_team;
    const oppT = data.teamSync && data.teamSync(oppName);
    const kickoff = new Date(m.kickoff_utc);
    const row = el('a', { class: 'td-fix-row', href: `/wc/game/${m.id}`, 'data-game-id': m.id });
    row.appendChild(el('div', { class: 'when' },
      el('div', { class: 'd' }, dayLabel(kickoff).replace(/^\w+, /, '')),
      el('div', { class: 't' }, timeLabel(kickoff) + ' ET'),
    ));
    row.appendChild(el('span', { class: 'vs' }, 'vs'));
    const fl = el('div', { class: 'opp-flag' });
    if (oppT && flagSrc(oppT.fifa_code)) fl.style.backgroundImage = `url(${flagSrc(oppT.fifa_code)})`;
    row.appendChild(fl);
    const nameNode = el('div', { class: 'opp-name' }, oppName || (homeIsUs ? m.away_team_source : m.home_team_source) || 'TBD');
    if (m.status === 'finished') {
      const us = homeIsUs ? m.home_score : m.away_score;
      const them = homeIsUs ? m.away_score : m.home_score;
      const cls = us > them ? '' : (us < them ? 'loss' : 'draw');
      nameNode.appendChild(el('span', { class: 'res ' + cls }, `${us}–${them}`));
    } else if (m.status === 'live') {
      const us = homeIsUs ? m.home_score : m.away_score;
      const them = homeIsUs ? m.away_score : m.home_score;
      nameNode.appendChild(el('span', { class: 'res live' }, `${us ?? 0}–${them ?? 0} LIVE`));
    }
    row.appendChild(nameNode);
    row.appendChild(el('span', { class: 'ven' },
      m.stadium ? el('span', { class: 'hi', html: icon('map-pin', { size: 11 }) }) : null,
      m.stadium || ''));
    sec.appendChild(row);
  }
  return sec;
}

function buildScorers(team, scorers, goalsFallback) {
  const sec = el('div', { class: 'td-section' });
  const list = scorers && scorers.by_team ? (scorers.by_team[team.fifa_code] || []) : null;
  const totalGoals = list ? list.reduce((s, r) => s + (r.goals || 0), 0) : goalsFallback;
  sec.appendChild(sectionHead('Tournament scorers', 'trophy', `${totalGoals} goal${totalGoals === 1 ? '' : 's'} scored`));

  if (list && list.length) {
    // One wrapper holding all rows (the wrap was previously re-appended every
    // loop iteration — harmless but a DOM bug; build it once here).
    const wrap = el('div', { class: 'td-scorers' });
    list.slice(0, 12).forEach((r) => {
      const row = el('div', { class: 'row' });
      row.appendChild(el('span', { class: 'g' }, String(r.goals)));
      const meta = el('div', { class: 'meta' });
      meta.appendChild(el('div', { class: 'td-sc-name name' }, playerLink(r.player, r.tmId)));
      const sub = r.penalties ? `${r.goals} goal${r.goals === 1 ? '' : 's'} · ${r.penalties} pen` : `${r.matches ? r.matches.length : r.goals} appearance${(r.matches ? r.matches.length : r.goals) === 1 ? '' : 's'}`;
      meta.appendChild(el('div', { class: 'sub' }, sub));
      row.appendChild(meta);
      wrap.appendChild(row);
    });
    sec.appendChild(wrap);
    return sec;
  }

  sec.appendChild(el('div', { class: 'td-empty-note' },
    totalGoals ? `${totalGoals} goals scored so far — individual breakdown updates as match events are recorded.`
               : 'Goalscorer breakdown populates from live match events as the tournament progresses.'));
  return sec;
}

function buildAllTimeRecord(r) {
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(sectionHead('All-time international record', 'star'));
  const totals = el('div', { class: 'td-record', style: 'margin-bottom:12px' });
  totals.appendChild(cell(r.played ?? '—', 'PLAYED'));
  totals.appendChild(cell(r.wins ?? '—', 'WON', 'win'));
  totals.appendChild(cell(r.draws ?? '—', 'DREW', 'draw'));
  totals.appendChild(cell(r.losses ?? '—', 'LOST', 'loss'));
  totals.appendChild(cell((r.win_pct != null ? r.win_pct.toFixed(1) + '%' : '—'), 'WIN %', 'pts', true));
  sec.appendChild(totals);
  const meta = el('div', { class: 'td-atr-meta' });
  if (r.gf != null && r.ga != null) meta.appendChild(el('span', {}, `Goals: ${r.gf}–${r.ga} (GD ${r.gd >= 0 ? '+' : ''}${r.gd})`));
  if (r.first) meta.appendChild(el('span', {}, `First international: ${r.first}`));
  if (r.last) meta.appendChild(el('span', {}, `Last match: ${r.last}`));
  if (meta.children.length) sec.appendChild(meta);
  return sec;
}

function buildWcHistory(team, history) {
  if (!history || !Array.isArray(history)) return null;
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(sectionHead('World Cup pedigree', 'trophy'));
  const grid = el('div', { class: 'td-wc-hist-grid' });
  for (const yearData of history) {
    if (!yearData) continue;
    const year = yearData.year || yearData.season || (yearData.name && yearData.name.match(/\d{4}/)?.[0]);
    if (!year) continue;
    const outcome = extractTeamOutcome(yearData, team);
    if (!outcome) continue;
    // Mark a trophy/podium glyph on the strongest finishes.
    const lo = outcome.label.toLowerCase();
    const glyph = lo === 'champions' ? 'trophy' : ((lo === 'runners-up' || lo === 'third place') ? 'star' : null);
    const out = el('div', { class: 'out' });
    if (glyph) out.appendChild(el('span', { class: 'hi', html: icon(glyph, { size: 12 }) }));
    out.appendChild(el('span', {}, outcome.label));
    grid.appendChild(el('div', { class: 'td-wc-hist-card' },
      el('div', { class: 'year' }, String(year)),
      out,
      outcome.played != null ? el('div', { class: 'pld' }, `${outcome.played} played · ${outcome.gf}-${outcome.ga}`) : null,
    ));
  }
  if (!grid.children.length) {
    sec.appendChild(el('div', { class: 'td-empty-note' }, 'No World Cup appearances in 2010–2022.'));
    return sec;
  }
  sec.appendChild(grid);
  return sec;
}

function extractTeamOutcome(yearData, team) {
  const matches = yearData.matches || yearData.fixtures || [];
  if (!Array.isArray(matches)) return null;
  const ours = matches.filter(m =>
    (m.team1 === team.name || m.team2 === team.name || m.home === team.name || m.away === team.name ||
     m.team1 === team.name_normalised || m.team2 === team.name_normalised ||
     m.home_team === team.name || m.away_team === team.name)
  );
  if (!ours.length) return null;
  let w = 0, d = 0, l = 0, gf = 0, ga = 0, furthestRound = null;
  for (const m of ours) {
    const isHome = (m.team1 === team.name || m.team1 === team.name_normalised || m.home === team.name || m.home_team === team.name);
    const us = (m.score && (isHome ? m.score.ft?.[0] : m.score.ft?.[1])) ?? (isHome ? m.home_score : m.away_score);
    const them = (m.score && (isHome ? m.score.ft?.[1] : m.score.ft?.[0])) ?? (isHome ? m.away_score : m.home_score);
    if (us != null && them != null) {
      if (us > them) w++;
      else if (us < them) l++;
      else d++;
      gf += us; ga += them;
    }
    if (m.round) furthestRound = m.round;
  }
  const total = w + d + l;
  return {
    label: furthestRound ? labelForRound(furthestRound, w, d, l) : `${w}-${d}-${l} group`,
    played: total, gf, ga,
  };
}
function labelForRound(r, w, d, l) {
  const lr = String(r).toLowerCase();
  if (lr.includes('final') && !lr.includes('quarter') && !lr.includes('semi')) return w > 0 ? 'Champions' : 'Runners-up';
  if (lr.includes('third')) return 'Third place';
  if (lr.includes('semi')) return 'Semifinal';
  if (lr.includes('quarter')) return 'Quarterfinal';
  if (lr.includes('round of 16') || lr.includes('r16')) return 'Round of 16';
  if (lr.includes('round of 32') || lr.includes('r32')) return 'Round of 32';
  return `Group · ${w}-${d}-${l}`;
}

function buildSquad(team, playersSample, squads2026, ctx) {
  const squad = teamSquad(team, playersSample, squads2026);
  const sec = el('div', { class: 'td-section' });
  sec.appendChild(sectionHead('Full squad', 'users', `${squad.length} players`));
  if (!squad.length) {
    sec.appendChild(el('div', { class: 'td-empty-note' },
      'Roster will populate from the live wc2026api.com /teams response or the 2026 enrichment squads.'));
    return sec;
  }
  const SORTS = [{id:'value',label:'Value'},{id:'age',label:'Age'},{id:'no',label:'Number'}];
  const cmps = {
    value: (a, b) => (b.value || 0) - (a.value || 0),
    age: (a, b) => (b.age || 0) - (a.age || 0),
    no: (a, b) => (a.shirt || 99) - (b.shirt || 99),
  };
  const pill = el('div', { class: 'td-sort-pill' });
  for (const s of SORTS) {
    // Sort in place (no full page re-render → keeps scroll position & avoids
    // refetching). Reorder each position grid and toggle the active pill.
    const b = el('button', { class: ctx.sort === s.id ? 'on' : '', 'data-sort': s.id,
      onclick: (ev) => {
        ctx.sort = s.id;
        pill.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === ev.currentTarget));
        resortSquad(sec, s.id);
      } }, s.label);
    pill.appendChild(b);
  }
  sec.appendChild(el('div', { class: 'td-squad-controls' },
    el('span', { class: 'ctl-lbl' }, 'Sort'),
    pill,
  ));
  const POSLABEL = { GK:'Goalkeepers', DEF:'Defenders', MID:'Midfielders', FWD:'Forwards' };
  const byPos = { GK:[], DEF:[], MID:[], FWD:[] };
  for (const p of squad) (byPos[p.position] || byPos.MID).push(p);
  const cmp = cmps[ctx.sort] || cmps.value;
  const mvpValue = Math.max(0, ...squad.map(p => p.value || 0));
  for (const k of ['GK','DEF','MID','FWD']) {
    if (!byPos[k].length) continue;
    const section = el('div', { class: 'td-squad-section' });
    section.appendChild(el('div', { class: 'ttl' },
      el('span', {}, POSLABEL[k]),
      el('hr'),
      el('div', { class: 'n' }, String(byPos[k].length)),
    ));
    const grid = el('div', { class: 'td-squad-grid' });
    for (const p of byPos[k].slice().sort(cmp)) {
      // Use tmId when available, else fall back to URL-encoded name so the
      // popup/page can still surface what little we know from 2026.squads.json.
      const playerId = p.tmId || `name:${p.name}`;
      const card = el('a', {
        class: 'td-squad-card' + (p.value === mvpValue && mvpValue > 0 ? ' mvp' : ''),
        href: `/wc/player/${encodeURIComponent(playerId)}`,
        // Sort keys for in-place re-sorting without a re-render.
        'data-value': String(p.value || 0),
        'data-age': String(p.age || 0),
        'data-no': String(p.shirt != null ? p.shirt : 99),
      });
      card.appendChild(el('div', { class: 'no' }, p.shirt != null ? String(p.shirt) : '—'));
      // Initials monogram always present; the portrait only covers it on a
      // successful load (a 404'd face shows initials, not an empty circle).
      const face = el('div', { class: 'face' });
      face.appendChild(el('span', { class: 'ini' }, initials(p.name)));
      if (p.photo) setBgWhenLoaded(face, p.photo);
      card.appendChild(face);
      // Flag contracts expiring within the next year (free-agent watch).
      const expiringSoon = p.contractUntil && (new Date(p.contractUntil) - Date.now()) < 365 * 864e5 && new Date(p.contractUntil) > Date.now();
      const sub = el('div', { class: 'sub' });
      sub.appendChild(document.createTextNode([p.club, p.age && `${p.age}y`, p.caps != null && `${p.caps} caps`].filter(Boolean).join(' · ')));
      if (expiringSoon) sub.appendChild(el('span', { class: 'exp' }, ` · exp ${String(p.contractUntil).slice(0, 4)}`));
      card.appendChild(el('div', { class: 'info' },
        el('div', { class: 'name' }, p.name),
        sub,
      ));
      card.appendChild(el('div', { class: 'val' }, eur(p.value)));
      grid.appendChild(card);
    }
    section.appendChild(grid);
    sec.appendChild(section);
  }
  return sec;
}

// Reorder the squad cards within each position grid in place (no re-render),
// reading the data-* sort keys set on each card.
function resortSquad(sec, sortId) {
  const cmp = {
    value: (a, b) => (+b.dataset.value || 0) - (+a.dataset.value || 0),
    age: (a, b) => (+b.dataset.age || 0) - (+a.dataset.age || 0),
    no: (a, b) => (+a.dataset.no || 99) - (+b.dataset.no || 99),
  }[sortId] || ((a, b) => (+b.dataset.value || 0) - (+a.dataset.value || 0));
  sec.querySelectorAll('.td-squad-grid').forEach(grid => {
    [...grid.children].sort(cmp).forEach(card => grid.appendChild(card));
  });
}
