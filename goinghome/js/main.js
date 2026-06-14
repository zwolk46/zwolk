import "./countdown.js";
import { mountHorizon, mountEmblem } from "./scene.js";
import { mountFlight } from "./flight.js";
import { mountInteractions } from "./interactions.js";
import { mountFinale } from "./finale.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Feature-detect SVG-filter backdrop support. Firefox can't do url(#…),
// only blur/saturate. We tag <html> so CSS can swap to the frosted fallback.
(function detectBackdrop() {
  const test = document.createElement("div");
  test.style.cssText = "backdrop-filter: url(#x)";
  const ok =
    test.style.backdropFilter === "url(#x)" ||
    test.style.backdropFilter === 'url("#x")';
  if (!ok) document.documentElement.classList.add("no-svg-bdfilter");
})();

// Render-critical mounts (synchronous): emblem + horizon + finale wiring.
mountEmblem();
mountHorizon();
mountFinale();

// Defer non-critical animation mounts until libraries have loaded + the
// browser has had a chance to paint. Flight + tilt depend on GSAP which is a
// `defer`-loaded library tag.
function whenReady(cb) {
  if (window.gsap) return cb();
  let tries = 0;
  const id = setInterval(() => {
    if (window.gsap || ++tries > 40) {
      clearInterval(id);
      cb();
    }
  }, 60);
}

whenReady(() => {
  mountFlight({ reducedMotion });
  mountInteractions({ reducedMotion });
});
