// Compose the horizon (skyline + Statue of Liberty + window lights) and
// mount the NY-state emblem inside the glass card.

import { SVG_LIBERTY, SVG_EMPIRE, SVG_CHRYSLER, SVG_FREEDOM, SVG_NY_STATE }
  from "./assets.js";

// ---------- NY state emblem (refracts inside the glass) ----------
export function mountEmblem() {
  const slot = document.querySelector('[data-role="ny-emblem"]');
  if (!slot || !SVG_NY_STATE) return;
  slot.innerHTML = SVG_NY_STATE;
  const svg = slot.querySelector("svg");
  if (!svg) return;
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
}

// Skyline canvas: viewBox 0 0 1800 600. All buildings share a common baseline
// at y = 580. Buildings are placed by (x = center, height) and scaled from
// their original viewBox to occupy that height in skyline units.
//
// Reads viewBox from the cleaned source so positions don't drift if the
// upstream files are re-cleaned.
function placeSilhouette(svgStr, { x, height, klass = "silhouette", id = "" }) {
  if (!svgStr) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = svgStr;
  const src = tmp.querySelector("svg");
  if (!src) return "";
  const vb = (src.getAttribute("viewBox") || "0 0 100 100").split(/\s+/).map(Number);
  const [vx, vy, vw, vh] = vb;
  const scale = height / vh;
  const w = vw * scale;
  const tx = x - w / 2 - vx * scale;
  const ty = 580 - vh * scale - vy * scale;
  const inner = src.innerHTML;
  return `
    <g${id ? ` id="${id}"` : ""} class="${klass}" transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})">
      ${inner}
    </g>`;
}

// Generate a deterministic-ish set of twinkling window lights placed across
// the skyline strip. Density is weighted toward the midtown cluster.
function generateWindowLights() {
  const rand = (function (seed) {
    return function () {
      let x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
  })(99);

  const bands = [
    // Wide-spread low/mid windows across the city
    { x0: 600, x1: 1480, y0: 340, y1: 555, count: 38 },
    // Denser middle-band
    { x0: 920, x1: 1430, y0: 240, y1: 380, count: 22 },
    // A handful of high lights on the tallest tower
    { x0: 880, x1: 950,  y0: 230, y1: 360, count: 5 },
  ];

  const out = [];
  for (const b of bands) {
    for (let i = 0; i < b.count; i++) {
      const x = b.x0 + rand() * (b.x1 - b.x0);
      const y = b.y0 + rand() * (b.y1 - b.y0);
      const r = 0.9 + rand() * 1.3;
      const dur = (3 + rand() * 5).toFixed(1);
      const delay = (rand() * 4).toFixed(1);
      out.push(`<circle class="window-light" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" style="--twinkle-dur:${dur}s;--twinkle-delay:${delay}s" />`);
    }
  }
  return out.join("");
}

// A torch glow sits roughly at the top of Liberty.
// Liberty's source viewBox is 30.525 17.111 456.359 846.917 — the torch is at
// approximately path-x ≈ 290, path-y ≈ 40 (a hand raised up-and-right of
// the figure's centerline). We approximate by placing the glow at the
// torch's known relative position within the Liberty <g> transform.
function libertyTorchGlow({ x, height }) {
  // Match the placement math in placeSilhouette() so the glow tracks Liberty.
  const vbX = 30.525, vbY = 17.111, vbW = 456.359, vbH = 846.917;
  const scale = height / vbH;
  const w = vbW * scale;
  const tx = x - w / 2 - vbX * scale;
  const ty = 580 - vbH * scale - vbY * scale;
  // Torch coordinate inside the path (calibrated from previewing the cleaned svg).
  const torchPx = 290;
  const torchPy = 50;
  const gx = tx + torchPx * scale;
  const gy = ty + torchPy * scale;
  return `<circle id="liberty-torch" class="liberty-torch" cx="${gx.toFixed(2)}" cy="${gy.toFixed(2)}" r="${(3 + height * 0.018).toFixed(2)}" />`;
}

// ---------- Mount the horizon ----------
export function mountHorizon() {
  const slot = document.querySelector('[data-role="skyline"]');
  if (!slot) return;

  // Composition: Liberty as a separated landmark on the left, then the
  // tightly-spaced Manhattan cluster. Tuned so mobile-slice crop still keeps
  // the cluster visible.
  const liberty   = placeSilhouette(SVG_LIBERTY,  { x: 600,  height: 360, klass: "silhouette silhouette--liberty" });
  const freedom   = placeSilhouette(SVG_FREEDOM,  { x: 920,  height: 470 });
  const empire    = placeSilhouette(SVG_EMPIRE,   { x: 1130, height: 420 });
  const chrysler  = placeSilhouette(SVG_CHRYSLER, { x: 1310, height: 395 });
  const torchGlow = libertyTorchGlow({ x: 600, height: 360 });

  const lights = generateWindowLights();

  slot.innerHTML = `
    <svg class="skyline-svg" viewBox="0 0 1800 600" preserveAspectRatio="xMidYMax slice">
      <!-- Buildings + Liberty -->
      <g class="skyline-svg__silhouettes">
        ${liberty}
        ${freedom}
        ${empire}
        ${chrysler}
      </g>
      <!-- Window lights overlay above silhouettes -->
      <g class="skyline-svg__lights">${lights}</g>
      <!-- Torch glow rides above everything -->
      ${torchGlow}
    </svg>
  `;
}
