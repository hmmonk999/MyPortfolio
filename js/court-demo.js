/* ---- Interactive volleyball court ----
   Loaded only by case-study-volleyball-consolidation.html. The court,
   net and plinth are static markup on that page, so the illustration
   still renders with JS off; this file adds the parts that move — the
   ball, the trail behind it, and the heat map that builds up under it.

   Every click is a pass from wherever the ball currently is to wherever
   you clicked. Passes that cross the centre line get a taller arc that
   peaks exactly over the net, so the ball visibly clears it. */
(() => {
  const root = document.querySelector("[data-court-demo]");
  if (!root) return;

  const svg = root.querySelector(".court-demo__svg");
  const hit = root.querySelector("[data-court-hit]");
  const heatLayer = root.querySelector("[data-court-heat]");
  const trailLayer = root.querySelector("[data-court-trails]");
  const ball = root.querySelector("[data-court-ball]");
  const shadow = root.querySelector("[data-court-shadow]");
  if (!svg || !hit || !heatLayer || !trailLayer || !ball || !shadow) return;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---- The floor plane ----
     The court is drawn in one-point perspective: a trapezoid W_TOP wide
     at the far baseline (y = Y_TOP) opening to W_BOT at the near one
     (y = Y_BOT). These five numbers must match the polygon points in
     the page's markup — they're the same shape described twice, once
     for the browser to paint and once for the maths below.

     Positions on that floor are held as (u, t): u runs 0→1 left to
     right, t runs 0→1 far to near, and BOTH ARE LINEAR IN REAL SPACE.
     That's the whole point of keeping a second coordinate system — the
     ball can travel at a constant speed in (u, t) and come out
     correctly foreshortened on screen, slow while it's deep in the far
     court and quick as it arrives at the near one. */
  const CX = 500;
  const W_TOP = 556;
  const W_BOT = 838;
  const Y_TOP = 60;
  const Y_BOT = 560;

  /* How much wider the near edge is than the far one. Everything about
     the perspective falls out of this one ratio. */
  const R = W_BOT / W_TOP;

  const T_NET = 0.51; /* centre line, midway between the two baselines */

  /* Screen distances quoted at the near edge of the floor, scaled down
     by the local perspective factor wherever they're actually used.
     NET_H is the net's height above the court; at the net's own depth
     it works out to ~88 units, which is the rectangle in the markup. */
  const NET_H = 110;
  /* Ball radius in court units. The artwork in the markup is drawn at
     ART_R so its seam geometry could be computed once at a convenient
     size; everything on screen is scaled from BALL_R, so this is the
     one number to change to resize the ball. It's several times life
     size against the court — a true-scale ball would be about r=5 here
     and far too small to read as a volleyball at all. */
  const BALL_R = 20;
  const ART_R = 50;
  const BALL_K = BALL_R / ART_R;
  const HEAT_MAX = 48;
  const TRAIL_FADE_MS = 700; /* keep in step with the .court-demo__trail transition */
  /* With motion reduced there's no flight to watch, so the arc is drawn
     whole and held for about as long as flying it would have taken —
     otherwise it's added and retired in the same tick and never seen. */
  const STILL_HOLD_MS = 450;

  /* Screen depth (0→1 down the trapezoid) for a real depth t. Derived
     from w ∝ 1/distance: the trapezoid's edges are straight on screen,
     so screen width is linear in s, and this is the substitution that
     makes real depth line up with it. */
  const depthToScreen = (t) => t / (R - t * (R - 1));
  const screenToDepth = (s) => (s * R) / (1 + s * (R - 1));
  const widthAt = (s) => W_TOP + (W_BOT - W_TOP) * s;
  const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

  function project(u, t) {
    const s = depthToScreen(t);
    const w = widthAt(s);
    return {
      x: CX + (u - 0.5) * w,
      y: Y_TOP + (Y_BOT - Y_TOP) * s,
      /* 1 at the near edge, ~0.66 at the far one. Multiplies anything
         that should shrink with distance: the ball, its shadow, how
         high it appears to rise, how wide a heat blob spreads. */
      scale: w / W_BOT,
    };
  }

  function unproject(x, y) {
    const s = (y - Y_TOP) / (Y_BOT - Y_TOP);
    return { u: 0.5 + (x - CX) / widthAt(s), t: screenToDepth(s) };
  }

  /* Where the ball is resting between passes. Starts on the near side
     so it's visible and obviously the thing being played with. */
  let pos = { u: 0.5, t: 0.76 };
  let flight = null;
  let raf = 0;

  /* ---- Flight ---- */

  function startPass(target) {
    /* A click during a pass takes over: the ball carries on from
       wherever it is in the air rather than teleporting back. The
       interrupted pass still leaves its mark, because the heat map is a
       record of where you clicked. */
    if (flight) land(flight);

    const from = { u: pos.u, t: pos.t };
    const to = { u: clamp(target.u, 0.03, 0.97), t: clamp(target.t, 0.03, 0.97) };

    /* u is squeezed slightly because the floor is wider than it is
       deep; this just keeps "long pass" meaning the same thing in both
       directions when it feeds duration and arc height below. */
    const reach = Math.hypot((to.u - from.u) * 0.85, to.t - from.t);
    const crosses = (from.t - T_NET) * (to.t - T_NET) < 0;

    flight = {
      from,
      to,
      crosses,
      /* Progress at which the ball passes over the centre line. The arc
         peaks here rather than at the halfway point, which is what
         guarantees the ball is at its highest exactly over the net. */
      cross: crosses ? clamp((T_NET - from.t) / (to.t - from.t), 0.12, 0.88) : 0.5,
      /* Over the net it's a clear 35% above the tape; on the same side
         it's a flatter pass that only grows with distance. */
      peak: crosses ? NET_H * 1.35 : NET_H * (0.28 + 0.4 * reach),
      duration: reduceMotion.matches ? 0 : clamp(360 + reach * 560, 360, 940),
      start: performance.now(),
      trail: makeTrail(),
      points: [],
    };

    if (flight.duration === 0) {
      /* Reduced motion: no flight, but the arc is still the clearest
         way to show what just happened, so it's drawn whole and then
         retired on the same timer as an animated one. */
      for (let i = 0; i <= 24; i += 1) sample(flight, i / 24);
      drawTrail(flight);
      step(performance.now());
      return;
    }

    if (!raf) raf = requestAnimationFrame(step);
  }

  /* Height above the court at progress p. Two half-sines meeting at the
     apex, so an arc whose peak is off-centre still leaves and lands
     smoothly instead of kinking. */
  function liftAt(f, p) {
    if (!f.crosses) return f.peak * Math.sin(Math.PI * p);
    return p < f.cross
      ? f.peak * Math.sin((Math.PI / 2) * (p / f.cross))
      : f.peak * Math.sin((Math.PI / 2) * ((1 - p) / (1 - f.cross)));
  }

  function pointAt(f, p) {
    const u = f.from.u + (f.to.u - f.from.u) * p;
    const t = f.from.t + (f.to.t - f.from.t) * p;
    return { u, t, lift: liftAt(f, p) };
  }

  function step(now) {
    raf = 0;
    if (!flight) return;

    const p = flight.duration
      ? Math.min((now - flight.start) / flight.duration, 1)
      : 1;
    const at = pointAt(flight, p);

    pos = { u: at.u, t: at.t };
    renderBall(at.u, at.t, at.lift);

    if (flight.duration) {
      sample(flight, p);
      drawTrail(flight);
    }

    if (p < 1) {
      raf = requestAnimationFrame(step);
      return;
    }

    const done = flight;
    flight = null;
    land(done);
  }

  /* Deposit the mark and retire the trail. Called both when a pass
     finishes and when one is cut short by the next click. */
  function land(f) {
    pos = { u: f.to.u, t: f.to.t };
    addHeat(f.to.u, f.to.t);
    retireTrail(f.trail, f.duration ? 0 : STILL_HOLD_MS);
  }

  /* ---- Drawing ---- */

  function renderBall(u, t, lift) {
    const p = project(u, t);
    const rise = lift * p.scale;

    ball.setAttribute(
      "transform",
      `translate(${p.x.toFixed(2)} ${(p.y - rise).toFixed(2)}) scale(${(p.scale * BALL_K).toFixed(4)})`
    );

    /* The shadow stays on the floor, spreading and thinning as the ball
       climbs away from it — the main cue for how high the ball is, since
       nothing else in a flat drawing says so. */
    const height = clamp(rise / 120, 0, 1);
    shadow.setAttribute(
      "transform",
      `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) scale(${(p.scale * BALL_K * (1 + height * 0.5)).toFixed(4)})`
    );
    shadow.setAttribute("opacity", (0.3 * (1 - height * 0.72)).toFixed(3));
  }

  function makeTrail() {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "court-demo__trail");
    trailLayer.appendChild(path);
    return path;
  }

  function sample(f, p) {
    const at = pointAt(f, p);
    const point = project(at.u, at.t);
    f.points.push([point.x, point.y - at.lift * point.scale]);
  }

  function drawTrail(f) {
    if (f.points.length < 2) return;
    const d = f.points
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join("");
    f.trail.setAttribute("d", d);
  }

  function retireTrail(path, hold) {
    window.setTimeout(() => {
      path.classList.add("is-spent");
      window.setTimeout(() => path.remove(), TRAIL_FADE_MS);
    }, hold);
  }

  function addHeat(u, t) {
    const p = project(u, t);
    const blob = document.createElementNS(SVG_NS, "ellipse");
    blob.setAttribute("class", "court-demo__blob");
    blob.setAttribute("cx", p.x.toFixed(1));
    blob.setAttribute("cy", p.y.toFixed(1));
    /* Squashed vertically by the same amount a circle painted flat on
       the floor would be, so the blob lies on the court instead of
       standing up off it. */
    blob.setAttribute("rx", (54 * p.scale).toFixed(1));
    blob.setAttribute("ry", (54 * p.scale * 0.5).toFixed(1));
    blob.setAttribute("fill", "url(#court-heat-grad)");
    heatLayer.appendChild(blob);

    /* Oldest marks drop off the back rather than the map saturating to
       a single flat wash after a minute of clicking. */
    while (heatLayer.childElementCount > HEAT_MAX) {
      heatLayer.firstElementChild.remove();
    }
  }

  /* ---- Input ----
     getScreenCTM rather than measuring the bounding box: the SVG is
     letterboxed inside its slot whenever the panel's aspect ratio
     differs from the viewBox, and the matrix accounts for that. */
  function toFloor(event) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(ctm.inverse());
    return unproject(local.x, local.y);
  }

  hit.addEventListener("pointerdown", (event) => {
    const target = toFloor(event);
    if (target) startPass(target);
  });

  /* Pointer only, by design. The court carries no tabindex (see the
     comment on the hit polygon in the markup), so there's no focus to
     ring and no keyboard path to provide — it's a decorative toy, and
     none of the case study's content lives inside it. */

  renderBall(pos.u, pos.t, 0);
})();
