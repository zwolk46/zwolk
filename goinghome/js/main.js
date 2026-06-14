import "./countdown.js";
import { mountSky } from "./sky.js";
import { mountHorizon, mountEmblem } from "./scene.js";
import { mountFlight } from "./flight.js";
import { mountInteractions } from "./interactions.js";
import { mountSparkle } from "./sparkle.js";
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

// Mount layers in order. Each module is responsible for failing gracefully —
// if WebGL is missing, the sky stays as a static gradient and we keep going.
mountEmblem();
mountHorizon();
mountFlight({ reducedMotion });
mountSparkle({ reducedMotion });
mountInteractions({ reducedMotion });
mountFinale();
if (!reducedMotion) mountSky();

// Pause/resume hint for the whole document on tab visibility.
document.addEventListener("visibilitychange", () => {
  document.documentElement.classList.toggle("is-hidden-tab", document.hidden);
});
