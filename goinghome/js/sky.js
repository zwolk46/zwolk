// Vanta CLOUDS sky, recolored to golden-hour dusk. Lazy-loaded after first
// paint so three.js (300+KB) doesn't block first render.
//
// Performance tuning notes:
//  - scale: 0.5 → Vanta renders at half resolution, then the canvas is CSS-
//    upscaled. Massive GPU win and the cloud noise still reads soft.
//  - speed: 0.4 → slower motion = fewer dirty rectangles → less backdrop-
//    filter recomputation on the glass card.
//  - mouseEase: false to keep the WebGL render passes off the mouse hot path.

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error("script load failed: " + src));
    document.head.appendChild(s);
  });
}

export async function mountSky() {
  const el = document.getElementById("sky");
  if (!el) return;

  // Defer until the browser is idle so first paint / fonts / lcp aren't
  // blocked by 300+KB of three.js. Idle callback ⇒ Vanta loads in the
  // background while the static gradient is already painted.
  const idle = (cb) =>
    "requestIdleCallback" in window
      ? requestIdleCallback(cb, { timeout: 1500 })
      : setTimeout(cb, 250);

  idle(async () => {
    try {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.clouds.min.js");
    } catch (e) {
      console.warn("Vanta libs failed to load — staying on static gradient.", e);
      return;
    }
    if (!window.VANTA || !window.THREE) return;

    let instance;
    try {
      instance = window.VANTA.CLOUDS({
        el,
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        backgroundColor: 0x0b1026,
        skyColor:        0x2a2350,
        cloudColor:      0x6b5e8a,
        cloudShadowColor:0x1a1a3a,
        sunColor:        0xffd9a0,
        sunGlareColor:   0xff9a4d,
        sunlightColor:   0xffb070,
        speed: 0.4,
        scale: 0.5,        // half-resolution canvas, upscaled by CSS
        scaleMobile: 0.5,
        mouseEase: false,
      });
    } catch (e) {
      console.warn("Vanta CLOUDS init failed", e);
      return;
    }

    // Cap DPR hard — Vanta defaults to devicePixelRatio (up to 3 on retina).
    try {
      if (instance.renderer?.setPixelRatio) instance.renderer.setPixelRatio(1);
    } catch (_) {}

    document.body.classList.add("vanta-ready");

    document.addEventListener("visibilitychange", () => {
      if (!instance) return;
      if (document.hidden && instance.pause) instance.pause();
      else if (!document.hidden && instance.play) instance.play();
    });
  });
}
