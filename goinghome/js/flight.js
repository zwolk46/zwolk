// Draw-in the flight-path arc, then loop the plane along it.

export function mountFlight({ reducedMotion } = {}) {
  const svg = document.getElementById("flight");
  if (!svg) return;
  const path = svg.querySelector("#flight-path");
  const pathGlow = svg.querySelector("#flight-path-glow");
  const plane = svg.querySelector("#plane-rider");
  if (!path || !plane) return;

  // Register GSAP plugins.
  const gsap = window.gsap;
  if (!gsap) return;
  if (window.MotionPathPlugin) gsap.registerPlugin(window.MotionPathPlugin);
  if (window.DrawSVGPlugin) gsap.registerPlugin(window.DrawSVGPlugin);

  // Reveal the arc with DrawSVG (if available) or stroke-dashoffset trick.
  if (window.DrawSVGPlugin) {
    gsap.fromTo([pathGlow, path], { drawSVG: "0%" },
      { drawSVG: "100%", duration: 2.4, ease: "power2.inOut", stagger: 0.15, delay: 0.4 });
  } else {
    [pathGlow, path].forEach((p) => {
      if (!p) return;
      const len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      gsap.to(p, { strokeDashoffset: 0, duration: 2.4, ease: "power2.inOut", delay: 0.4 });
    });
  }

  // Animated dashed-flow on the inner path (subtle drift to suggest motion).
  // We do this by animating strokeDashoffset on the dashed inner stroke.
  const innerLen = path.getTotalLength();
  // Override existing dasharray with a small repeating pattern so the
  // dashes look like running lights along the route.
  path.style.strokeDasharray = "3 11";
  gsap.to(path, {
    strokeDashoffset: -innerLen,
    duration: 22,
    repeat: -1,
    ease: "none",
  });

  if (reducedMotion) return; // skip plane loop

  // Plane orbit along the path on a slow eased loop.
  const tl = gsap.timeline({ repeat: -1, defaults: { ease: "power2.inOut" } });
  tl.set(plane, { autoAlpha: 0 })
    .fromTo(plane, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2 }, 1.6)
    .to(plane, {
      duration: 16,
      motionPath: {
        path: "#flight-path",
        align: "#flight-path",
        alignOrigin: [0.5, 0.5],
        autoRotate: true,
        start: 0,
        end: 1,
      },
      ease: "power1.inOut",
    }, 1.6)
    .to(plane, { autoAlpha: 0, duration: 1.0 }, "-=1.2")
    .to({}, { duration: 4 }); // small breather before looping

  // Pause when tab is hidden.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) tl.pause();
    else tl.resume();
  });

  return tl;
}
