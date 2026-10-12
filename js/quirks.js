/*
  Hidden quirks. Small surprises sprinkled around the site.

  1. The dot next to the name in the header is a basketball (spins on hover, see css).
  2. Type "swish" anywhere and a basketball drops in and bounces across the page.
  3. A note for anyone who opens the browser console.
*/

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- 2. type "swish" ---
  let typed = "";
  document.addEventListener("keydown", (e) => {
    if (e.target.closest?.("input, textarea, [contenteditable]")) return;
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-5);
    if (typed === "swish") {
      typed = "";
      dropBall();
    }
  });

  function dropBall() {
    if (reduceMotion) return;
    const ball = document.createElement("div");
    ball.className = "quirk-ball";
    ball.innerHTML = BALL_SVG;
    document.body.appendChild(ball);

    const W = window.innerWidth;
    const floor = window.innerHeight - 56;
    // [x as fraction of width, y as fraction of floor, easing into next frame]
    const path = [
      [0.05, -0.15, "ease-in"],
      [0.25, 1, "ease-out"],
      [0.38, 0.45, "ease-in"],
      [0.5, 1, "ease-out"],
      [0.6, 0.72, "ease-in"],
      [0.7, 1, "ease-out"],
      [0.77, 0.88, "ease-in"],
      [0.84, 1, "linear"],
      [1.1, 1, "linear"],
    ];
    const frames = path.map(([x, y, easing], i) => ({
      transform: `translate(${x * W}px, ${y * floor}px) rotate(${i * 90}deg)`,
      offset: i / (path.length - 1),
      easing,
    }));
    ball.animate(frames, { duration: 2800 }).onfinish = () => ball.remove();
  }

  // --- 3. console note ---
  console.log(
    "%c🏀 You found the locker room. Try typing “swish”.",
    "font: 600 14px Georgia, serif; color: #d9543c;"
  );
})();
