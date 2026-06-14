// Vanta CLOUDS sky, recolored to golden-hour dusk.
// Pauses when the tab is hidden. Caps DPR via three.js renderer settings.

export function mountSky() {
  const el = document.getElementById("sky");
  if (!el) return;
  if (typeof window.VANTA === "undefined" || typeof window.THREE === "undefined") return;

  let instance;
  try {
    instance = window.VANTA.CLOUDS({
      el,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      // All seven color params recolored for dusk → night sky.
      backgroundColor: 0x0b1026,     // deep indigo
      skyColor:        0x2a2350,     // twilight upper sky
      cloudColor:      0x6b5e8a,     // cool purple cloud body
      cloudShadowColor:0x1a1a3a,     // shadow depths
      sunColor:        0xffd9a0,     // warm amber sun
      sunGlareColor:   0xff9a4d,     // golden flare
      sunlightColor:   0xffb070,     // warm rim lighting
      speed: 0.65,                   // slow & dreamy
      scale: 1.0,
      scaleMobile: 1.0,
      mouseEase: true,
    });
  } catch (e) {
    console.warn("Vanta CLOUDS failed to mount", e);
    return;
  }

  // Cap DPR — Vanta defaults to devicePixelRatio which can be 3 on retina.
  try {
    if (instance.renderer?.setPixelRatio) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      instance.renderer.setPixelRatio(dpr);
    }
  } catch (_) {}

  document.body.classList.add("vanta-ready");

  // Pause on tab hide.
  const onVis = () => {
    if (!instance) return;
    if (document.hidden && instance.pause) instance.pause();
    else if (!document.hidden && instance.play) instance.play();
  };
  document.addEventListener("visibilitychange", onVis);

  // Resize is handled internally by Vanta; nothing to do.
}
