// Sparse twinkling stars in the upper sky. Parallaxes gently with cursor.
// Cheap canvas — runs only when tab is visible, throttled to ~30 fps.

export function mountSparkle({ reducedMotion } = {}) {
  if (reducedMotion) return;
  const canvas = document.getElementById("sparkle");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let stars = [];
  let mouseX = 0, mouseY = 0;
  let raf = 0, lastFrame = 0;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildStars();
  }

  function rebuildStars() {
    // Subtle density: ~0.00008 per pixel, biased to the top half.
    const count = Math.max(40, Math.min(140, Math.floor(W * H * 0.00009)));
    stars = new Array(count).fill(0).map(() => {
      const y = Math.pow(Math.random(), 1.4) * H * 0.55; // bias to top
      return {
        x: Math.random() * W,
        y,
        r: Math.random() * 0.9 + 0.25,
        baseA: Math.random() * 0.45 + 0.15,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.6 + 0.25,
        depth: Math.random() * 0.7 + 0.3,
      };
    });
  }

  function draw(t) {
    raf = 0;
    if (document.hidden) return;
    // Throttle to ~30 fps.
    if (t - lastFrame < 33) {
      raf = requestAnimationFrame(draw);
      return;
    }
    lastFrame = t;
    ctx.clearRect(0, 0, W, H);

    const px = (mouseX / W - 0.5) * 14;
    const py = (mouseY / H - 0.5) * 8;

    for (const s of stars) {
      const a = s.baseA + Math.sin(t * 0.001 * s.speed + s.phase) * 0.35;
      const opacity = Math.max(0, Math.min(1, a));
      ctx.beginPath();
      const ox = s.x + px * s.depth;
      const oy = s.y + py * s.depth;
      ctx.arc(ox, oy, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 232, 198, ${opacity})`;
      ctx.fill();
      // Soft halo on the brightest few
      if (s.r > 0.85 && opacity > 0.4) {
        ctx.beginPath();
        ctx.arc(ox, oy, s.r * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 218, 158, ${opacity * 0.18})`;
        ctx.fill();
      }
    }

    raf = requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !raf) raf = requestAnimationFrame(draw);
  });
  window.addEventListener("pointermove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  resize();
  raf = requestAnimationFrame(draw);
}
