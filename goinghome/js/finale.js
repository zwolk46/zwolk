// Zero-hour finale: city lights surge, torch flares (handled by CSS via
// body.is-finale), plane completes its arc and parks at NY, confetti bursts.

import { onFinale } from "./countdown.js";

export function mountFinale() {
  onFinale(() => {
    runConfetti();
    parkPlane();
  });
}

function runConfetti() {
  const confetti = window.confetti;
  if (!confetti) return;

  const golds = ["#FFD9A0", "#F5C66B", "#FFE7B8", "#E8884A", "#FFB070", "#F7F4EF"];

  // Two staggered bursts originating left + right of the skyline center.
  const fire = (x, opts = {}) =>
    confetti({
      particleCount: 110,
      spread: 78,
      startVelocity: 55,
      ticks: 240,
      origin: { x, y: 0.72 },
      colors: golds,
      gravity: 0.95,
      decay: 0.92,
      scalar: 1.05,
      ...opts,
    });

  fire(0.35);
  setTimeout(() => fire(0.65), 220);
  setTimeout(() =>
    confetti({
      particleCount: 60,
      spread: 110,
      startVelocity: 42,
      origin: { x: 0.5, y: 0.62 },
      colors: golds,
      gravity: 0.7,
      ticks: 320,
      scalar: 0.85,
    }), 700);

  // Gentle trickle that lingers.
  let trickle = 0;
  const id = setInterval(() => {
    confetti({
      particleCount: 6,
      angle: 90 + (Math.random() - 0.5) * 40,
      spread: 60,
      startVelocity: 25,
      origin: { x: Math.random(), y: 0.68 },
      colors: golds,
      ticks: 220,
      gravity: 0.6,
      scalar: 0.7,
    });
    if (++trickle > 12) clearInterval(id);
  }, 380);
}

function parkPlane() {
  const gsap = window.gsap;
  const plane = document.getElementById("plane-rider");
  if (!gsap || !plane) return;
  // Send the plane to the NY end-point and fade gracefully.
  gsap.killTweensOf(plane);
  gsap.to(plane, { autoAlpha: 0, duration: 1.2, ease: "power2.out" });
}
