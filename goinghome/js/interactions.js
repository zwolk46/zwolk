// Cursor-driven 3D tilt on the glass card + specular highlight follow.
// Subtle and premium — gentle springy easing, never twitchy.

export function mountInteractions({ reducedMotion } = {}) {
  if (reducedMotion) return;

  const card = document.querySelector('[data-role="hero-glass"]');
  if (!card) return;

  // Targets in degrees / percentages.
  let tx = 0, ty = 0;   // current tilt
  let dx = 0, dy = 0;   // desired tilt
  let sx = 50, sy = 30; // current specular pos %
  let dsx = 50, dsy = 30;
  let raf = 0;

  const MAX_TILT = 7; // degrees

  function onMove(e) {
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Distance from center, normalized roughly to ±1 across the viewport.
    const nx = (e.clientX - cx) / (window.innerWidth / 2);
    const ny = (e.clientY - cy) / (window.innerHeight / 2);
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    dx = clamp(nx) * -MAX_TILT * 0.3 + clamp(nx) * -MAX_TILT * 0.7; // smooth
    dy = clamp(ny) *  MAX_TILT * 0.3 + clamp(ny) *  MAX_TILT * 0.7;

    // Specular follows cursor relative to the card.
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    dsx = Math.max(0, Math.min(100, rx * 100));
    dsy = Math.max(0, Math.min(100, ry * 100));

    if (!raf) raf = requestAnimationFrame(loop);
  }

  function onLeave() {
    dx = 0; dy = 0; dsx = 50; dsy = 30;
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function loop() {
    raf = 0;
    // Spring-ish lerp
    tx += (dx - tx) * 0.085;
    ty += (dy - ty) * 0.085;
    sx += (dsx - sx) * 0.12;
    sy += (dsy - sy) * 0.12;

    card.style.setProperty("--tilt-y", `${tx.toFixed(2)}deg`);
    card.style.setProperty("--tilt-x", `${(-ty).toFixed(2)}deg`);
    card.style.setProperty("--spec-x", `${sx.toFixed(1)}%`);
    card.style.setProperty("--spec-y", `${sy.toFixed(1)}%`);

    const settled =
      Math.abs(dx - tx) < 0.05 &&
      Math.abs(dy - ty) < 0.05 &&
      Math.abs(dsx - sx) < 0.2 &&
      Math.abs(dsy - sy) < 0.2;
    if (!settled) raf = requestAnimationFrame(loop);
  }

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerleave", onLeave, { passive: true });
  window.addEventListener("blur", onLeave);
}
