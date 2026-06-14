import { TARGET, TARGET_LABEL } from "./config.js";

const els = {
  daysGroup: document.querySelector('[data-group="days"]'),
  days: document.querySelector('[data-val="days"]'),
  hours: document.querySelector('[data-val="hours"]'),
  minutes: document.querySelector('[data-val="minutes"]'),
  seconds: document.querySelector('[data-val="seconds"]'),
  sub: document.querySelector('[data-role="targetLine"]'),
};

if (els.sub) els.sub.textContent = TARGET_LABEL;

const pad = (n, w) => String(Math.max(0, Math.floor(n))).padStart(w, "0");

function setDigit(el, str) {
  if (!el) return;
  if (el.textContent !== str) el.textContent = str;
}

function frameRemaining() {
  return TARGET.getTime() - Date.now();
}

let finaleFired = false;
const finaleCallbacks = [];
export function onFinale(cb) {
  finaleCallbacks.push(cb);
  if (finaleFired) cb();
}

function fireFinale() {
  if (finaleFired) return;
  finaleFired = true;
  document.body.classList.add("is-finale");
  for (const cb of finaleCallbacks) {
    try { cb(); } catch (e) { console.error(e); }
  }
}

function render() {
  const remainingMs = frameRemaining();

  if (remainingMs <= 0) {
    setDigit(els.days, "00");
    setDigit(els.hours, "00");
    setDigit(els.minutes, "00");
    setDigit(els.seconds, "00");
    if (els.daysGroup) els.daysGroup.classList.add("is-hidden");
    fireFinale();
    return;
  }

  const totalSec = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const showDays = days > 0;
  if (els.daysGroup) els.daysGroup.classList.toggle("is-hidden", !showDays);

  if (showDays) setDigit(els.days, pad(days, 2));
  setDigit(els.hours, pad(hours, 2));
  setDigit(els.minutes, pad(minutes, 2));
  setDigit(els.seconds, pad(seconds, 2));
}

// rAF-aligned ticker. Pauses when tab is hidden. Renders ~once per second
// using the absolute clock so digits never drift.
let lastSecond = -1;
let rafId = null;
function tick() {
  rafId = null;
  const now = Date.now();
  const remaining = TARGET.getTime() - now;
  const sec = Math.floor(remaining / 1000);
  if (sec !== lastSecond) {
    lastSecond = sec;
    render();
  }
  if (!finaleFired && !document.hidden) {
    rafId = requestAnimationFrame(tick);
  }
}

function start() {
  if (rafId != null) return;
  tick();
}
function stop() {
  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stop();
  } else {
    render();
    start();
  }
});

render();
start();
