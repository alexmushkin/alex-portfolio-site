/*
  Home page animation:
  a typewriter types the site's sections ("Creative Writing", "Sports",
  "Projects") and a pair of scissors snips the sheet into strips, zigzagging
  down one cut at a time. Each strip floats up and
  reshapes into its (empty) button in the header menu. A stick figure runs in
  and starts dribbling the typewriter, which shrinks and rounds off with each
  bounce until it's a basketball. Then he hops down into the bottom-left of
  the footer, where he keeps dribbling. The ground stays behind and fades as
  the bio (#after-shot in index.html) fades in where the scene was.

  It plays once per visit (sessionStorage); after that the home page opens
  on the end state.

  Everything in the scene is drawn from a single clock: render(t) sets the
  whole scene for time t (in seconds), so each beat below can be tuned
  independently. Click (or press Space/Enter on) the animation to pause it.

  The drawing keeps a fixed size (1000 units = the page's content width) but
  the SVG spans the whole window, so the ground runs edge to edge and things
  enter from the real edges of the screen.
*/

(() => {
  const stage = document.getElementById("stage");
  if (!stage) return;

  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";

  // ---------- helpers ----------
  const clamp01 = (u) => Math.max(0, Math.min(1, u));
  const prog = (t, a, b) => clamp01((t - a) / (b - a));
  const lerp = (a, b, u) => a + (b - a) * u;
  const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixColor = (a, b, u) => {
    const A = hexToRgb(a), B = hexToRgb(b);
    return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], u))).join(",")})`;
  };
  const svgEl = (tag, attrs = {}) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  };

  // Two-segment limb (shoulder→elbow→hand) with a fixed bone length.
  function limb(sx, sy, hx, hy, L, bend) {
    let dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy) || 0.001;
    const max = 2 * L * 0.999;
    if (d > max) {
      hx = sx + (dx / d) * max; hy = sy + (dy / d) * max;
      dx = hx - sx; dy = hy - sy; d = max;
    }
    const h = Math.sqrt(Math.max(0, L * L - (d / 2) ** 2));
    const ex = (sx + hx) / 2 + (-dy / d) * h * bend;
    const ey = (sy + hy) / 2 + (dx / d) * h * bend;
    return `${sx},${sy} ${ex},${ey} ${hx},${hy}`;
  }

  // ---------- scene constants ----------
  const GROUND = 360;
  const ANKLE = GROUND - 7;    // legs end here; the sneaker soles sit on the ground
  const BALL_R = 25;
  const BALL_REST = GROUND - BALL_R;
  // typed lines, and the header menu button each one floats up to
  const LINES = ["Creative Writing", "Sports", "Projects"];
  const NAV_TARGETS = ["writing", "sports", "projects"].map((s) => `[data-section="${s}"] .nav-toggle`);
  // paper coordinates: sheet spans x 390..610; the scissors cut at these heights
  const PAPER = { left: 390, right: 610, bottom: 230 };
  const CUTS = [152, 178, 204]; // strip 1 = 152..178, strip 2 = 178..204, strip 3 = 204..bottom
  const CUT_S = 0.4;            // scissors' time along one cut
  const DROP_S = 0.1;           // and down to the next one
  const CHAR_W = 12;           // Courier Prime at 20px
  const CARRIAGE_HOME = 100;   // carriage offset before each line starts
  const LINE_FEED = 26;
  const TW_BODY = { cx: 500, w: 290, h: 130, rx: 18 }; // typewriter body, bottom on the ground
  const FX = 330;              // where he stops, just left of the typewriter
  const TICK_GAP = 40;         // spacing of the ground hatch marks
  const DRIB_HEIGHT = 45;
  const DRIB_HZ = 2;
  // area around him (drawing units) that becomes the little footer view
  const MINI_CROP = { x: FX - 40, y: 200, w: 100, h: 172 };
  const HOP_MS = 850;

  // ---------- fit the stage to the window ----------
  // Content (x 0..1000) keeps the page's content width; the viewBox widens
  // to fill the rest of the window on both sides.
  const view = { left: 0, right: 1000 };
  function fitStage() {
    if (stage.classList.contains("is-mini")) return;
    const vw = document.documentElement.clientWidth;
    const k = (Math.min(vw, 1080) - 40) / 1000; // same width as .wrap content
    const w = vw / k;
    view.left = 500 - w / 2;
    view.right = 500 + w / 2;
    stage.setAttribute("viewBox", `${view.left} 0 ${w} 420`);
    stage.style.height = `${420 * k}px`;
  }
  fitStage();
  window.addEventListener("resize", fitStage);

  // ---------- timeline (seconds) ----------
  const T = {};
  T.typeStart = 0.3;
  T.perChar = 0.08;
  // each line, then a carriage return before the next
  T.lineStart = [];
  T.returnStart = [];
  T.returnEnd = [];
  LINES.reduce((start, line, i) => {
    T.lineStart.push(start);
    const end = start + line.length * T.perChar;
    if (i === LINES.length - 1) { T.typeEnd = end; return end; }
    T.returnStart.push(end + 0.1);
    T.returnEnd.push(end + 0.5);
    return end + 0.58;
  }, T.typeStart);
  T.cutStart = T.typeEnd + 0.15;      // scissors reach the paper
  // the last cut runs on off the sheet (90 units past its usual end)
  T.lastCut = CUT_S * (1 + 90 / (PAPER.right - PAPER.left + 100));
  T.cutEnd = T.cutStart + (CUTS.length - 1) * (CUT_S + DROP_S) + T.lastCut;
  T.handoff = T.cutEnd - 0.1;         // strips leave for the menu
  T.walkStart = T.handoff;            // he runs in
  T.walkEnd = T.walkStart + 1.1;
  T.reachEnd = T.walkEnd + 0.15;      // hand on top of the typewriter
  T.dribStart = T.reachEnd;
  T.morphEnd = T.dribStart + 1.8;     // typewriter has become the ball
  T.hop = T.morphEnd + 0.15;          // hops down into the footer, still dribbling

  // ---------- build typewriter keys ----------
  const keysG = $("tw-keys");
  const keys = [];
  [[10, 383, 262], [9, 396, 290]].forEach(([n, x0, y]) => {
    for (let i = 0; i < n; i++) {
      const c = svgEl("circle", { class: "key", cx: x0 + i * 26, cy: y, r: 9 });
      keysG.appendChild(c);
      keys.push(c);
    }
  });
  const spaceBar = svgEl("rect", { class: "key", x: 430, y: 316, width: 140, height: 16, rx: 8 });
  keysG.appendChild(spaceBar);

  // ---------- ground hatch marks ----------
  const ticksG = $("ground-ticks");
  for (let x = -2000; x <= 3000 + TICK_GAP; x += TICK_GAP) {
    ticksG.appendChild(svgEl("line", { class: "tick", x1: x, y1: GROUND + 6, x2: x - 8, y2: GROUND + 16 }));
  }

  // ---------- scissors + cut lines (drawn on the paper, in paper coords) ----------
  const paperG = $("tw-paper");
  const cutLines = CUTS.map((y) => {
    const l = svgEl("line", { class: "cut", y1: y, y2: y });
    paperG.appendChild(l);
    return l;
  });
  const scissors = svgEl("g", { class: "scissors" });
  const blade = (dir) => {
    const g = svgEl("g");
    g.append(
      svgEl("path", { class: "blade", d: `M0,0 L-48,${-2 * dir} Q-52,0 -48,${2 * dir} L0,${6 * dir} Z` }),
      svgEl("line", { class: "shank", x1: 0, y1: 0, x2: 8, y2: 7 * dir }),
      svgEl("ellipse", { class: "handle", cx: 16, cy: 11 * dir, rx: 9, ry: 7 })
    );
    return g;
  };
  const bladeTop = blade(-1), bladeBot = blade(1);
  scissors.append(bladeBot, bladeTop, svgEl("circle", { class: "pivot", r: 2.5 }));
  paperG.appendChild(scissors);

  // ---------- chunky sneakers (origin = ankle, toe points +x) ----------
  const figureG = $("figure");
  const sneaker = () => {
    const g = svgEl("g", { class: "sneaker" });
    g.append(
      svgEl("path", { class: "shoe-upper", d: "M-10,7 C-12,-4 -6,-10 2,-9 C8,-8 11,-4 17,-2 C25,0 26,7 22,7 Z" }),
      svgEl("path", { class: "shoe-stripe", d: "M1,-3 Q8,2 16,0" }),
      svgEl("path", { class: "shoe-sole", d: "M-12,7 H24 Q27,7 26,10 Q25,13 21,13 H-9 Q-13,13 -13,10 Q-13,7 -12,7 Z" })
    );
    figureG.appendChild(g);
    return g;
  };
  const shoes = [sneaker(), sneaker()]; // [front, back]

  const el = {
    roller: $("tw-roller"),
    lines: LINES.map((_, i) => $(`tw-line${i + 1}`)),
    body: $("tw-body"),
    figure: figureG,
    head: $("head"),
    eyes: [$("eye-l"), $("eye-r")],
    torso: $("torso"),
    armF: $("arm-front"),
    armB: $("arm-back"),
    legF: $("leg-front"),
    legB: $("leg-back"),
    ball: $("ball"),
    shadow: $("ball-shadow"),
  };

  const show = (node, on) => node.setAttribute("opacity", on ? 1 : 0);

  // ---------- typewriter ----------
  // Where one line is at: letters typed, carriage offset, key being pressed.
  function lineState(t, start, text) {
    const f = (t - start) / T.perChar;
    const count = f < 0 ? 0 : Math.min(text.length, Math.floor(f) + 1);
    const p = Math.max(0, Math.min(f, text.length));
    const k = Math.floor(p);
    const step = k < text.length ? easeOut(clamp01((p - k) * 3)) : 0;
    const shift = CARRIAGE_HOME - CHAR_W * (k + step);
    const key = f >= 0 && f < text.length && f - k < 0.35 ? (text[k] === " " ? "space" : k) : null;
    return { count, shift, key };
  }

  function typewriterState(t) {
    const lines = LINES.map((text, i) => lineState(t, T.lineStart[i], text));
    // the line being typed (or just finished)
    const line = Math.max(0, T.lineStart.filter((s) => t >= s).length - 1);
    const returning = line < LINES.length - 1 && t >= T.returnStart[line];
    const r = returning ? easeInOut(prog(t, T.returnStart[line], T.returnEnd[line])) : 0;
    let shift = lerp(lines[line].shift, CARRIAGE_HOME, r);
    // once the paper is gone, the carriage slides back home (out of his way)
    shift = lerp(shift, CARRIAGE_HOME, easeInOut(prog(t, T.handoff + 0.3, T.handoff + 0.8)));
    const keyIndex = returning ? null : lines[line].key;
    return { counts: lines.map((l) => l.count), shift, feed: LINE_FEED * (line + r), keyIndex, line };
  }

  // Scissors: slide in from the right along the top cut, then zigzag: across
  // a cut, drop to the next, back across it, and off the sheet after the last
  // one. Even cuts run right→left (face 1), odd ones left→right (face -1).
  // Returns position, facing and how far along each cut is.
  function scissorsState(t) {
    const c = T.cutStart;
    const far = PAPER.right + 80, near = PAPER.left - 20;
    const faceOf = (i) => (i % 2 ? -1 : 1);
    const ends = (i) => (i % 2 ? [near, far] : [far, near]);
    const visible = t > c - 0.2 && t < T.cutEnd;
    const snip = 16 * Math.abs(Math.sin((t - c) * 26));
    const cuts = CUTS.map(() => 0);
    if (t < c) {
      return { x: lerp(far + 90, far, prog(t, c - 0.2, c)), y: CUTS[0], face: 1, visible, snip, cuts };
    }
    const i = Math.min(CUTS.length - 1, Math.floor((t - c) / (CUT_S + DROP_S)));
    const u = t - c - i * (CUT_S + DROP_S);
    let [from, to] = ends(i);
    let face = faceOf(i), y = CUTS[i], x;
    if (i === CUTS.length - 1) {
      to -= 90 * face; // runs on off the sheet
      x = lerp(from, to, clamp01(u / T.lastCut));
    } else if (u < CUT_S) {
      x = lerp(from, to, u / CUT_S);
    } else {
      x = to;
      y = lerp(CUTS[i], CUTS[i + 1], easeInOut((u - CUT_S) / DROP_S));
      face = faceOf(i + 1);
    }
    // the cut runs behind the blades (they meet ~20 units ahead of the pivot)
    const W = PAPER.right - PAPER.left;
    const along = faceOf(i) === 1 ? (PAPER.right - (x - 20)) / W : (x + 20 - PAPER.left) / W;
    CUTS.forEach((_, k) => (cuts[k] = k < i ? 1 : k > i ? 0 : clamp01(along)));
    return { x, y, face, visible, snip, cuts };
  }

  // ---------- figure ----------
  const figureX = (t) => lerp(view.left - 40, FX, 1 - Math.pow(1 - prog(t, T.walkStart, T.walkEnd), 2));
  const running = (t) => t > T.walkStart && t < T.walkEnd;

  // dribble bounce: how far the bottom of the ball (or typewriter) is off the ground
  function dribbleLift(t) {
    const s = ((t - T.dribStart) * DRIB_HZ) % 1;
    return { lift: DRIB_HEIGHT * 4 * s * (1 - s), squash: s < 0.05 || s > 0.95 };
  }

  // The typewriter while he dribbles it: shrinks and rounds off into the ball.
  // Its left edge stays a little clear of him until it's ball-sized in his hand.
  function typewriterBody(t) {
    const m = t < T.dribStart ? 0 : easeOut(prog(t, T.dribStart, T.morphEnd));
    const w = lerp(TW_BODY.w, 2 * BALL_R, m);
    const h = lerp(TW_BODY.h, 2 * BALL_R, m);
    const rx = lerp(TW_BODY.rx, BALL_R, m);
    const grow = (w - 2 * BALL_R) / (TW_BODY.w - 2 * BALL_R); // 1 = full typewriter, 0 = ball
    const settled = FX + 26 + (w / 2 - BALL_R) + 13 * grow;
    const cx = t < T.dribStart ? TW_BODY.cx : lerp(TW_BODY.cx, settled, easeOut(prog(t, T.dribStart, T.dribStart + 0.3)));
    const { lift, squash } = t < T.dribStart ? { lift: 0, squash: false } : dribbleLift(t);
    return { cx, bottom: GROUND - lift, w, h, rx, m, squash };
  }

  // ---------- cut strips float up and become the menu buttons ----------
  // Each strip is lifted off the stage as a page element that floats up and
  // reshapes into its button (size, rounded ends, border, shadow), then fades
  // as the button's own label appears under it. Until then the buttons are
  // empty outlines (still clickable).
  const STRIP_MS = 1100;
  const STRIP_STAGGER_MS = 180;
  let stripsFlew = false;
  let flights = [];

  function track(anim) {
    flights.push(anim);
    if (paused) anim.pause();
    const done = () => (flights = flights.filter((a) => a !== anim));
    anim.finished.then(done, done);
    return anim.finished;
  }

  function landButton(target) {
    target.classList.remove("is-waiting", "is-landed");
    void target.offsetWidth; // restart the landing bounce
    target.classList.add("is-landed");
  }

  function floatStrips() {
    stripsFlew = true;
    const m = paperG.querySelector("rect").getScreenCTM(); // paper coords → window
    const at = (x, y) => ({ x: m.e + m.a * x, y: m.f + m.d * y });
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();

    LINES.forEach(async (label, i) => {
      const target = document.querySelector(NAV_TARGETS[i]);
      if (!target) return;

      const tl = at(PAPER.left, CUTS[i]);
      const br = at(PAPER.right, CUTS[i + 1] ?? PAPER.bottom);
      const src = { left: tl.x, top: tl.y, width: br.x - tl.x, height: br.y - tl.y };
      const fontStart = 20 * m.a, padStart = 10 * m.a;

      const strip = document.createElement("div");
      strip.className = "paper-strip";
      strip.setAttribute("aria-hidden", "true");
      const text = document.createElement("span");
      text.textContent = label;
      strip.append(text);
      Object.assign(strip.style, {
        left: `${src.left}px`, top: `${src.top}px`, width: `${src.width}px`, height: `${src.height}px`,
      });
      Object.assign(text.style, { fontSize: `${fontStart}px`, left: `${padStart}px` });
      document.body.appendChild(strip);

      // end state: exactly the button
      const dst = target.getBoundingClientRect();
      const cs = getComputedStyle(target);
      const fontEnd = parseFloat(cs.fontSize);
      const border = parseFloat(cs.borderTopWidth);
      const textEnd = text.getBoundingClientRect().width * (fontEnd / fontStart);
      const opts = { duration: STRIP_MS, delay: i * STRIP_STAGGER_MS, easing: "cubic-bezier(.3,.6,.25,1)", fill: "both" };

      try {
        const box = strip.animate(
          [
            {
              left: `${src.left}px`, top: `${src.top}px`, width: `${src.width}px`, height: `${src.height}px`,
              borderRadius: "2px", borderWidth: "2px", boxShadow: `${ink} 0px 0px 0px`, transform: "rotate(0deg)",
            },
            { transform: `rotate(${i % 2 ? 4 : -4}deg)`, offset: 0.45 },
            {
              left: `${dst.left}px`, top: `${dst.top}px`, width: `${dst.width}px`, height: `${dst.height}px`,
              borderRadius: `${dst.height / 2}px`, borderWidth: `${border}px`, boxShadow: cs.boxShadow, transform: "rotate(0deg)",
            },
          ],
          opts
        );
        const words = text.animate(
          [
            { fontSize: `${fontStart}px`, left: `${padStart}px` },
            { fontSize: `${fontEnd}px`, left: `${(dst.width - textEnd) / 2 - border}px` },
          ],
          opts
        );
        await Promise.all([track(box), track(words)]);
        landButton(target);
        await track(strip.animate({ opacity: [1, 0] }, { duration: 250, fill: "forwards" }));
      } catch {
        landButton(target); // animation cancelled
      }
      strip.remove();
    });
  }

  // the stage as a little box in the footer, cropped around him
  function fitMini(footer) {
    stage.classList.add("is-mini");
    stage.setAttribute("viewBox", `${MINI_CROP.x} ${MINI_CROP.y} ${MINI_CROP.w} ${MINI_CROP.h}`);
    stage.setAttribute("aria-label", "A little stick figure dribbling a basketball. Click to pause.");
    const h = Math.max(40, footer.clientHeight - 12); // head just under the footer's top line
    stage.style.height = `${h}px`;
    stage.style.width = `${(h * MINI_CROP.w) / MINI_CROP.h}px`;
  }

  // ---------- he hops down into the footer ----------
  // The stage itself becomes a small box in the footer's bottom-left, cropped
  // around him (he's the only thing left by then), sized so his head sits just
  // under the footer's top line. A copy of the ground stays behind and fades
  // as the bio fades in. `instant` skips straight to the end (no hop, no fades).
  let hopped = false;

  function hopToFooter(instant = false) {
    hopped = true;
    const footer = document.querySelector(".site-footer");
    if (!footer) return;
    const area = stage.parentElement;
    area.style.minHeight = `${area.offsetHeight}px`; // page doesn't jump when he leaves

    if (instant) {
      footer.appendChild(stage);
      fitMini(footer);
      if (afterShot) afterShot.style.transition = "none";
      afterShot?.classList.add("is-shown");
      return;
    }

    // the ground stays where it is
    const ground = stage.cloneNode(true);
    ground.removeAttribute("id");
    ground.removeAttribute("tabindex");
    ground.setAttribute("aria-hidden", "true");
    ground.classList.add("ground-left");
    const keep = ["scene", "ground", "ground-ticks"];
    ground.querySelectorAll("[id]").forEach((n) => {
      if (!keep.includes(n.id)) n.remove();
    });
    ground.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    area.prepend(ground);
    ground.animate({ opacity: [1, 0] }, { duration: 700, delay: 300, fill: "forwards" }).finished.then(() => ground.remove());

    // where he is now, on screen
    const m = stage.getScreenCTM();
    const src = { left: m.e + m.a * MINI_CROP.x, top: m.f + m.d * MINI_CROP.y, width: m.a * MINI_CROP.w };

    // move the stage into the footer, cropped to him
    footer.appendChild(stage);
    fitMini(footer);
    const dst = stage.getBoundingClientRect();

    // hop: arc up and over, shrinking down into place
    const s = src.width / dst.width;
    const dx = src.left - dst.left, dy = src.top - dst.top;
    track(stage.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
        { transform: `translate(${dx * 0.45}px, ${Math.min(dy * 0.4, dy) - 90}px) scale(${lerp(s, 1, 0.55)})`, offset: 0.45 },
        { transform: "none" },
      ],
      { duration: HOP_MS, easing: "cubic-bezier(.4,0,.3,1)" }
    ));
    afterShot?.classList.add("is-shown");
  }

  // ---------- draw one frame ----------
  function render(t) {
    // typing
    const tw = typewriterState(t);
    el.lines.forEach((node, i) => (node.textContent = LINES[i].slice(0, tw.counts[i])));

    keys.forEach((kEl) => kEl.classList.remove("is-down"));
    spaceBar.classList.remove("is-down");
    if (tw.keyIndex === "space") spaceBar.classList.add("is-down");
    else if (tw.keyIndex !== null) keys[(tw.keyIndex * 5 + 3 + tw.line * 7) % keys.length].classList.add("is-down");

    // scissors + cuts
    const sc = scissorsState(t);
    scissors.setAttribute("opacity", sc.visible ? 1 : 0);
    scissors.setAttribute("transform", `translate(${sc.x} ${sc.y}) scale(${1.5 * sc.face} 1.5)`);
    bladeTop.setAttribute("transform", `rotate(${-sc.snip / 2})`);
    bladeBot.setAttribute("transform", `rotate(${sc.snip / 2})`);
    cutLines.forEach((line, i) => {
      const [from, to] = i % 2 ? [PAPER.left, PAPER.right] : [PAPER.right, PAPER.left];
      line.setAttribute("x1", from);
      line.setAttribute("x2", lerp(from, to, sc.cuts[i]));
    });

    // after the handoff the strips are page elements; the leftover top of the
    // sheet drifts up and fades
    const gone = prog(t, T.handoff, T.handoff + 0.35);
    paperG.setAttribute("opacity", t < T.handoff ? 1 : 1 - gone);
    el.lines.forEach((n) => n.setAttribute("opacity", t < T.handoff ? 1 : 0));
    paperG.setAttribute("transform", `translate(${tw.shift} ${-tw.feed - 20 * gone})`);

    // typewriter body: bounces and morphs while he dribbles it
    const tb = typewriterBody(t);
    const sy = tb.squash ? 0.88 : 1, sx = tb.squash ? 1.08 : 1;
    const bw = tb.w * sx, bh = tb.h * sy;
    el.body.setAttribute("x", tb.cx - bw / 2);
    el.body.setAttribute("y", tb.bottom - bh);
    el.body.setAttribute("width", bw);
    el.body.setAttribute("height", bh);
    el.body.setAttribute("rx", Math.min(tb.rx, bw / 2, bh / 2));
    el.body.style.fill = mixColor("#d9543c", "#e8772e", tb.m);
    show(el.body, t < T.morphEnd);

    // keys + roller ride along with the body (squished to fit) and fade away
    const partsFade = 1 - prog(t, T.dribStart, T.dribStart + 0.6);
    const fit = `translate(${tb.cx} ${tb.bottom}) scale(${bw / TW_BODY.w} ${bh / TW_BODY.h}) translate(${-TW_BODY.cx} ${-GROUND})`;
    keysG.setAttribute("opacity", partsFade);
    keysG.setAttribute("transform", fit);
    el.roller.setAttribute("opacity", partsFade);
    el.roller.setAttribute("transform", `${fit} translate(${tw.shift} 0)`);

    // figure (side-on the whole way)
    const fx = figureX(t);
    const run = running(t);
    const lean = run ? 6 : 0;
    const stride = fx * 0.075;
    show(el.figure, t >= T.walkStart);

    const shoulder = { x: fx + lean, y: 247 };
    const hip = { x: fx, y: 298 };
    const head = { x: fx + lean * 1.3, y: 222 };
    el.head.setAttribute("cx", head.x);
    el.head.setAttribute("cy", head.y);
    el.eyes.forEach((eye, i) => {
      eye.setAttribute("cx", head.x + [4, 9][i]);
      eye.setAttribute("cy", head.y - 2);
    });
    el.torso.setAttribute("x1", fx + lean * 1.1); el.torso.setAttribute("y1", 235);
    el.torso.setAttribute("x2", fx); el.torso.setAttribute("y2", hip.y);

    // legs + sneakers
    let footF = { x: fx + 9, y: ANKLE }, footB = { x: fx - 9, y: ANKLE };
    if (run) {
      footF = { x: fx + 22 * Math.sin(stride), y: ANKLE - 10 * Math.max(0, Math.cos(stride)) };
      footB = { x: fx - 22 * Math.sin(stride), y: ANKLE - 10 * Math.max(0, -Math.cos(stride)) };
    }
    el.legF.setAttribute("points", limb(hip.x, hip.y, footF.x, footF.y, 33, -1));
    el.legB.setAttribute("points", limb(hip.x, hip.y, footB.x, footB.y, 33, -1));
    shoes[0].setAttribute("transform", `translate(${footF.x} ${footF.y})`);
    shoes[1].setAttribute("transform", `translate(${footB.x} ${footB.y})`);

    // ball (once the typewriter has become it)
    const { lift, squash } = dribbleLift(t);
    const ball = { x: fx + 26, y: BALL_REST - lift };
    const sq = squash ? "scale(1.1 0.86)" : "";
    el.ball.setAttribute("transform", `translate(${ball.x} ${ball.y + BALL_R}) ${sq} translate(0 ${-BALL_R})`);
    show(el.ball, t >= T.morphEnd);
    const shadowX = t < T.morphEnd ? tb.cx : ball.x;
    const shadowY = t < T.morphEnd ? tb.bottom - BALL_R : ball.y;
    const air = clamp01((BALL_REST - shadowY) / 300);
    el.shadow.setAttribute("cx", shadowX);
    el.shadow.setAttribute("rx", (t < T.morphEnd ? tb.w / 2 - 3 : 22) * (1 - air * 0.5));
    el.shadow.setAttribute("opacity", t >= T.dribStart ? 0.15 * (1 - air) : 0);

    // arms
    const swing = run ? 18 * Math.sin(stride) : 0;
    let handF = { x: fx + 10 - swing, y: 305 };
    const handB = { x: fx - 8 + swing, y: 300 };
    if (t >= T.walkEnd && t < T.dribStart) {
      // reach for the top of the typewriter
      const r = easeInOut(prog(t, T.walkEnd, T.reachEnd));
      handF = { x: lerp(handF.x, fx + 26, r), y: lerp(handF.y, GROUND - TW_BODY.h, r) };
    } else if (t >= T.dribStart && t < T.morphEnd) {
      handF = { x: fx + 26, y: Math.min(tb.bottom - bh, 300) };
    } else if (t >= T.morphEnd) {
      handF = { x: ball.x, y: Math.min(ball.y - BALL_R, 300) };
    }
    el.armF.setAttribute("points", limb(shoulder.x, shoulder.y, handF.x, handF.y, 33, 1));
    el.armB.setAttribute("points", limb(shoulder.x, shoulder.y, handB.x, handB.y, 33, 1));
  }

  // ---------- run ----------
  let t = 0;
  let paused = false;
  const afterShot = document.getElementById("after-shot");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    stage.classList.add("is-done");
    stage.removeAttribute("tabindex");
    afterShot?.classList.add("is-shown");
    return;
  }

  // The intro plays once per visit: coming back to the home page (or
  // reloading it) skips to the end, with him already dribbling in the footer.
  let seen = false;
  try {
    seen = sessionStorage.getItem("introPlayed") === "1";
    sessionStorage.setItem("introPlayed", "1");
  } catch {
    /* storage unavailable: just play it */
  }

  if (seen) {
    t = T.hop;
    stripsFlew = true;
    render(t);
    hopToFooter(true);
  } else {
    NAV_TARGETS.forEach((sel) => document.querySelector(sel)?.classList.add("is-waiting"));
  }

  let last = performance.now();
  function frame(now) {
    if (!paused) {
      t += Math.min(0.05, (now - last) / 1000);
      if (!stripsFlew && t >= T.handoff) floatStrips();
      if (!hopped && t >= T.hop) hopToFooter();
      render(t);
    }
    last = now;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // click / Space / Enter to pause and resume
  const toggle = () => {
    paused = !paused;
    flights.forEach((a) => (paused ? a.pause() : a.play()));
  };
  stage.addEventListener("click", toggle);
  stage.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); }
  });

  // for tuning in the console: heroAnimation.seek(12)
  window.heroAnimation = {
    T,
    seek(s) { paused = true; t = s; render(s); },
    play() { paused = false; },
    floatStrips,
    hopToFooter,
  };
})();
