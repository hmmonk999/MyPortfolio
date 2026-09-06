/* ---- Hero atmosphere ----
   Loaded only by index.html. The liquid filter is static markup on that
   page and the headline reads fine without it, so the hero is complete
   with JS off; this file switches the filter on (.hero.is-liquid — the
   letters round off at the corners, and that's all that changes without
   a pointer) and then adds the parts that respond to one, all of which
   only exist while it's inside the hero:

     - the cursor: an arrow in the headline's ink, the shape of the
       system pointer it replaces, with two round drops trailing it, each
       on its own spring (see "The trail" below). Neither drop is ever
       anything but a circle; the shape is what the pair does through the
       filter. It hands off to the system pointer at the hero's edge in
       both directions, and the same way over anything clickable inside
       the hero, or over the button cluster as a whole — the buttons
       (and the gap between them) get the normal pointer, not an ink
       arrow pretending to be one,
     - a twin of each part inside the headline's liquid wrapper, under
       the same filter as the type. Blurred, so through the filter they
       stretch into any letter or decoration they come within reach of
       and read as one substance with it. While a part is inside the
       filter's region the fixed copy of it fades out and the twin is the
       cursor,
     - the ink blend: each part's colour is a blend of the inks of the
       shapes near it, weighted by closeness — the wordmark's ink, the
       pretitle's muted one, the underline's clay — so it is a shape's
       colour by the time it touches that shape and the two merge as one
       substance, and between two shapes it runs from one colour to the
       other rather than switching. Both copies of a part are recoloured
       together so the hand-off stays invisible.

   Nothing else moves: the letters and decorations stay exactly where
   they are and exactly what they are, and only the ink bridges to them.

   All of it rides one pointermove listener and one rAF loop that stops
   itself once the trail has caught up and has no ink left to melt into.

   Not in main.js and not called from initSite(): initSite() waits on
   include.js fetching the header partial, which would hold this behind a
   network round-trip and pop the cursor in mid-entrance. Same reasoning
   as js/court-demo.js. */
(() => {
  const hero = document.querySelector(".hero");
  const liquid = hero && hero.querySelector(".hero__liquid");
  if (!hero || !liquid) return;

  /* The filter itself costs one rasterisation and nothing after, so
     every device gets the liquid letters. */
  hero.classList.add("is-liquid");

  /* Everything below this point is pointer response. Without a real
     pointer there is nothing to respond to, and under reduced motion the
     honest answer is the resting composition the CSS already describes —
     the headline and the system cursor. Both are read once at load, like
     js/court-demo.js does. */
  if (
    !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  /* The trail's springs, per second. Soft: the drops are meant to be
     left behind on any real move and to take most of a second to catch
     up, settling with a small overshoot rather than sliding in on a
     curve — a drop of something viscous, not a tween.

     The wake is the second body, and it is the same spring only slacker.
     That difference is the whole trick: at a steady speed a spring rides
     DAMPING / STIFFNESS seconds behind whatever it chases, so the two
     bodies separate by the gap between those two ratios times the speed.
     Nothing at a standstill, about a body's width at an ordinary move —
     which the goo bridges into a neck — and far enough on a flick to
     break the neck and send them travelling apart. */
  const STIFFNESS = 60;
  const DAMPING = 12;
  const WAKE_STIFFNESS = 36;
  const WAKE_DAMPING = 11;
  /* Below this distance and speed the trail is on the pointer and the
     loop can stop. */
  const SETTLED_PX = 0.3;
  const SETTLED_SPEED = 4;

  /* The ink blend. Each shape within REACH px pulls a part's colour
     toward its own ink with a weight of 1 / (distance + SOFT)²; the
     resting ink pulls with the weight a shape at REACH would have, so
     it takes over smoothly as everything else falls away. The square
     makes the blend decisive: on a shape (distance zero) that shape has
     over ninety percent of the colour against a neighbour ten pixels
     off — the underline runs about that far under the wordmark's
     letters — and the crossover between the two happens in the gap,
     not on either of them. SOFT keeps the weight finite at contact and
     sets how wide that crossover is. */
  const REACH = 140;
  const SOFT = 4;

  /* ---- The trail ----
     Two drops, not one, and neither of them ever stops being a circle.

     What was here before was a single drop that deformed: an outline
     kneaded on slow sines, a stretch toward whatever ink it was closing
     on, another along its direction of travel. It doesn't work, for two
     reasons that pull the same way. Through the filter you barely see
     it — a Gaussian blur is radially symmetric, so most of an outline is
     lost on the way through, and the harder the deformation is pushed to
     win any of it back, the more the drop reads as a thing being pulled
     out of shape rather than as a liquid. Outside the filter, on the
     fixed copy, you see all of it, and a hard swing doesn't read as an
     organic silhouette at all — it reads as a wonky rounded rectangle.

     So nothing here deforms. The shape is emergent instead: two round
     bodies, a small sharp one and a larger softer one, each chasing the
     pointer on its own spring, the second slower than the first. Parked,
     they sit concentric and the trail is a round bead — which is what it
     should be when there is nothing to merge with. Moving, the slower
     one falls behind and the filter's threshold bridges the gap: a neck
     between them that thins as they separate, a teardrop along the
     direction of travel without a single stretch anywhere in the code.
     Flick hard enough and the neck breaks and the two travel apart,
     which is the goo doing what goo does. It is the construction the
     hero's reference uses, and it is why that one never looks strained:
     nothing is deformed, so nothing can be deformed too far.

     Two things still answer to nearby ink, and both are size, not shape:

       - the swell: both bodies grow a little with the melt, on both
         axes. Partly because that is what a drop does as it gives up its
         surface, and partly because it has to: the melt widens their
         blur, and past about a third of a body's diameter the wrapper's
         threshold starts eating it from the edge inward (see
         --liquid-blur-trail in tokens.css). Without the swell they thin
         out at exactly the moment they should be merging,
       - the blur ramp, which lives in the CSS: --melt runs each twin's
         blur up as it closes on ink, so its edge reaches furthest
         exactly when there is a letter in reach and it loses its own
         edge into the letter rather than docking against it (see
         .hero__blob--trail in layout.css).

     Distances here are to the same shapes the ink blend uses, so a drop
     swells toward the same thing whose colour it is already taking on. */
  const MELT_REACH = 96;
  const MELT_SWELL = 0.28;

  /* How long after the pointer leaves the hero the drop is still
     shrinking — the length of --cursor-exit — and so how long the
     spring keeps running so it shrinks in the pointer's wake rather
     than where it was left. */
  const EXIT_MS =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cursor-exit")) ||
    420;

  /* The arrow. Tip at the origin; drawn to fill a 20-unit box. Shared by
     the fixed cursor and its twin so they're the one shape. */
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ARROW_VIEWBOX = "0 0 20 20";
  const ARROW_PATH = "M0 0v17.6l4.8-4.2 3.1 6.6 3-1.4-3-6.5 6.4-.9z";

  /* Over any of these the custom cursor stands down and the system
     pointer takes over, exactly as at the hero's edge. The button
     cluster is included as a whole (not just the buttons themselves) so
     the hand-off covers the gap between the two buttons too — crossing
     from one to the other doesn't flash the ink cursor back on mid-gap. */
  const TARGET_SELECTOR =
    'a, button, input, textarea, select, summary, [role="button"], .hero__aside .cluster';

  let pointerX = 0;
  let pointerY = 0;
  let trailX = 0;
  let trailY = 0;
  let trailVX = 0;
  let trailVY = 0;
  let wakeX = 0;
  let wakeY = 0;
  let wakeVX = 0;
  let wakeVY = 0;
  /* Whether the custom cursor is in charge: pointer in the hero and not
     over a button. */
  let insideHero = false;
  /* When it last stood down, while the drop is still shrinking; 0
     otherwise. */
  let leaving = 0;
  let heroVisible = true;
  let raf = 0;
  let lastFrame = 0;
  function makeArrow(className) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("viewBox", ARROW_VIEWBOX);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", ARROW_PATH);
    svg.append(path);
    return svg;
  }

  function makeDrop(className) {
    const drop = document.createElement("span");
    drop.className = className;
    drop.setAttribute("aria-hidden", "true");
    return drop;
  }

  /* ---- The twins ----
     Trail before the arrow so the arrow paints over it where they
     overlap (through the filter they're one shape anyway, but the order
     decides whose colour wins in the overlap). Appended after the h1, so
     they're not inside the heading's own text. */
  const lead = makeArrow("hero__blob hero__blob--lead");
  const trail = makeDrop("hero__blob hero__blob--trail");
  const wake = makeDrop("hero__blob hero__blob--wake");
  liquid.append(wake, trail, lead);

  /* The filter's region as fractions of the wrapper's box, read off the
     markup so the hand-off can't drift from it. */
  const filter = document.getElementById("hero-liquid");
  const fx = filter ? parseFloat(filter.getAttribute("x")) / 100 : 0;
  const fy = filter ? parseFloat(filter.getAttribute("y")) / 100 : 0;
  const fw = filter ? parseFloat(filter.getAttribute("width")) / 100 : 1;
  const fh = filter ? parseFloat(filter.getAttribute("height")) / 100 : 1;

  /* The parts' own boxes for the hand-off, read once from the tokens. */
  const heroStyle = getComputedStyle(hero);
  const cursorSize = parseFloat(heroStyle.getPropertyValue("--cursor-size")) || 24;
  const trailRadius =
    (parseFloat(heroStyle.getPropertyValue("--cursor-trail-size")) || 26) / 2;
  const wakeRadius =
    (parseFloat(heroStyle.getPropertyValue("--cursor-wake-size")) || 32) / 2;

  /* ---- The cursor ----
     Built here rather than in the markup so it can't exist without the
     script that positions it, and appended to <body> rather than into
     #main so it stays outside the skip link's target region. */
  const cursor = document.createElement("div");
  cursor.className = "cursor";
  cursor.setAttribute("aria-hidden", "true");
  const cursorTrail = makeDrop("cursor__trail");
  const cursorWake = makeDrop("cursor__wake");
  const cursorBlob = makeArrow("cursor__blob");
  cursor.append(cursorWake, cursorTrail, cursorBlob);
  document.body.append(cursor);

  /* ---- Measurement ----
     Read once and held until something moves: where the hero, the
     wrapper and the filter region fall on screen, and the shapes a part
     of the cursor can take its ink from — each run of type as the boxes
     of its lines (a Range over each text node gives one per line), each
     decoration as its box, each with its computed colour. Colours are
     read here too rather than cached for good, so a theme switch just
     re-measures.

     Both runs are rotated, and the screen box of a rotated line is far
     taller than the line — a couple of degrees over the wordmark's
     width adds twenty-odd pixels top and bottom — which is enough to
     swallow the underline sitting just under the letters, so that the
     pointer on the line still measured as "on the letters". So each
     run's shapes are read with its rotation switched off for a moment,
     in the run's own unrotated frame, and pointer positions are mapped
     into that frame (see toLocal) before they're compared. The rotation
     is about the box's centre, which it leaves in place, so the centre
     of the rotated box is the origin to map about. */
  let measured = false;
  let heroBox = null;
  let liquidBox = null;
  let region = null;
  let inks = [];
  let restingInk = [0, 0, 0];

  /* Computed colours arrive as "rgb(r, g, b)" (or rgba(); the alpha is
     ignored — every ink here is solid). */
  function parseRgb(text) {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(text);
    return m ? [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])] : [0, 0, 0];
  }

  function readFrame(run) {
    const m = new DOMMatrixReadOnly(getComputedStyle(run).transform);
    const box = run.getBoundingClientRect();
    const det = m.a * m.d - m.b * m.c || 1;
    return {
      ox: box.left + box.width / 2,
      oy: box.top + box.height / 2,
      ia: m.d / det,
      ib: -m.b / det,
      ic: -m.c / det,
      id: m.a / det,
      /* The forward half, for sending a direction found in the run's own
         frame (the vector from the drop to the nearest ink) back out to
         screen space, where the drop is stretched. */
      a: m.a,
      b: m.b,
      c: m.c,
      d: m.d,
    };
  }

  function toLocal(frame, x, y) {
    const dx = x - frame.ox;
    const dy = y - frame.oy;
    return {
      x: frame.ox + frame.ia * dx + frame.ic * dy,
      y: frame.oy + frame.ib * dx + frame.id * dy,
    };
  }

  function measure() {
    heroBox = hero.getBoundingClientRect();
    liquidBox = liquid.getBoundingClientRect();
    region = {
      left: liquidBox.left + liquidBox.width * fx,
      top: liquidBox.top + liquidBox.height * fy,
      right: liquidBox.left + liquidBox.width * (fx + fw),
      bottom: liquidBox.top + liquidBox.height * (fy + fh),
    };

    /* The resting ink token is a hex colour; reading it back through an
       element's computed colour normalises it to rgb(). */
    lead.style.color = heroStyle.getPropertyValue("--goo-cursor").trim();
    restingInk = parseRgb(getComputedStyle(lead).color);
    lead.style.color = "";
    inks = [];

    const range = document.createRange();
    hero.querySelectorAll(".hero__pretitle, .hero__title-main").forEach((run) => {
      const frame = readFrame(run);
      run.style.transform = "none";

      const rects = [];
      const walker = document.createTreeWalker(run, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.nodeValue.trim()) continue;
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width && rect.height) rects.push(rect);
        }
      }
      /* A line's box is the font's whole em box, and the underline sits
         inside the wordmark's — level with its descenders — so a pointer
         on the line is at distance zero from both and the blend would
         split evenly. The underline's box is trimmed off the type's
         below, so the type's reach stops where the line starts. */
      run.querySelectorAll(".hero__deco").forEach((deco) => {
        const rect = deco.getBoundingClientRect();
        if (rect.width && rect.height) {
          inks.push({ frame: frame, rects: [rect], color: parseRgb(getComputedStyle(deco).color) });
        }
      });

      if (rects.length) {
        const underline = run.querySelector(".hero__deco--underline");
        if (underline) {
          const top = underline.getBoundingClientRect().top;
          rects.forEach((rect, i) => {
            if (rect.bottom > top && rect.top < top) {
              rects[i] = { left: rect.left, top: rect.top, right: rect.right, bottom: top };
            }
          });
        }
        inks.push({ frame: frame, rects: rects, color: parseRgb(getComputedStyle(run).color) });
      }

      run.style.transform = "";
    });

    measured = true;
    placeLead();
    placeTrails();
  }

  function invalidate() {
    measured = false;
  }

  window.addEventListener("resize", invalidate, { passive: true });
  window.addEventListener("scroll", invalidate, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(invalidate);
  /* The theme toggle swaps a class on <html>; the inks follow it. */
  new MutationObserver(invalidate).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  function within(rect, x, y) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  /* The hand-off: a part gives way to its twin once its whole box — not
     just its anchor point — is inside the filter region, so it never
     swaps to a twin the region would clip. */
  function inInk(left, top, right, bottom) {
    return (
      region &&
      left >= region.left &&
      right <= region.right &&
      top >= region.top &&
      bottom <= region.bottom
    );
  }

  /* ---- The ink blend ---- */
  function distanceTo(rect, x, y) {
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    return Math.hypot(dx, dy);
  }

  function inkDistance(ink, x, y) {
    const p = toLocal(ink.frame, x, y);
    let d = Infinity;
    ink.rects.forEach((rect) => {
      d = Math.min(d, distanceTo(rect, p.x, p.y));
    });
    return d;
  }

  function weightAt(d) {
    return 1 / ((d + SOFT) * (d + SOFT));
  }

  /* Both copies of a part are recoloured together. */
  function paintInk(twin, fixed, x, y) {
    let r = 0;
    let g = 0;
    let b = 0;
    let sum = 0;
    inks.forEach((ink) => {
      const d = inkDistance(ink, x, y);
      if (d > REACH) return;
      const w = weightAt(d);
      r += ink.color[0] * w;
      g += ink.color[1] * w;
      b += ink.color[2] * w;
      sum += w;
    });
    const wRest = weightAt(REACH);
    r += restingInk[0] * wRest;
    g += restingInk[1] * wRest;
    b += restingInk[2] * wRest;
    sum += wRest;
    const color =
      "rgb(" + Math.round(r / sum) + "," + Math.round(g / sum) + "," + Math.round(b / sum) + ")";
    twin.style.setProperty("--ink", color);
    fixed.style.setProperty("--ink", color);
  }

  /* ---- The swell ----
     How far the nearest ink is from a point, measured in each run's own
     unrotated frame like the blend's. Only the distance matters now —
     nothing here points at anything any more. */
  function nearestInk(x, y) {
    let best = Infinity;
    inks.forEach((ink) => {
      const p = toLocal(ink.frame, x, y);
      ink.rects.forEach((rect) => {
        const cx = Math.min(Math.max(p.x, rect.left), rect.right);
        const cy = Math.min(Math.max(p.y, rect.top), rect.bottom);
        best = Math.min(best, Math.hypot(cx - p.x, cy - p.y));
      });
    });
    return best;
  }

  /* Size both copies of a drop for this frame, and report how close it
     got to ink. Written to the transform property rather than scale or
     translate, which are the enter/exit and the position: all three
     multiply out, so each can be written without reading the others. */
  function swellDrop(twin, fixed, x, y) {
    const near = nearestInk(x, y);

    /* Smoothstep so a drop doesn't visibly start growing at exactly
       MELT_REACH — it eases into it. */
    let melt = 0;
    if (near < MELT_REACH) {
      const t = 1 - near / MELT_REACH;
      melt = t * t * (3 - 2 * t);
    }

    const transform = "scale(" + (1 + melt * MELT_SWELL).toFixed(3) + ")";
    twin.style.transform = transform;
    fixed.style.transform = transform;
    /* The blur ramp, twin only — see .hero__blob--trail in layout.css. */
    twin.style.setProperty("--melt", melt.toFixed(3));
    return melt;
  }

  /* ---- Placement ----
     The twins live in the wrapper's own coordinate space, which is not
     transformed (only the wordmark inside it is), so a pointer position
     maps straight to an offset from the wrapper's corner. */
  function place(blob, x, y) {
    blob.style.translate =
      (x - liquidBox.left).toFixed(1) + "px " + (y - liquidBox.top).toFixed(1) + "px";
  }

  /* The arrow's tip is its top-left corner, so its box runs right and
     down from the pointer; the drop is centred. */
  function placeLead() {
    place(lead, pointerX, pointerY);
    paintInk(lead, cursorBlob, pointerX, pointerY);
    cursor.classList.toggle(
      "is-in-ink",
      inInk(pointerX, pointerY, pointerX + cursorSize, pointerY + cursorSize)
    );
  }

  /* The fixed parts are positioned with the translate property, not
     transform, on purpose: the scale property that grows and shrinks
     them is applied *before* transform in the transform chain and
     *after* translate, so a translate3d() in transform gets scaled along
     with the shape — at scale zero the part would sit at the viewport's
     origin, and growing or shrinking it would send it flying between the
     pointer and the top-left corner. */
  function placeTrails() {
    cursorTrail.style.translate = trailX.toFixed(1) + "px " + trailY.toFixed(1) + "px";
    place(trail, trailX, trailY);
    paintInk(trail, cursorTrail, trailX, trailY);
    swellDrop(trail, cursorTrail, trailX, trailY);
    cursor.classList.toggle(
      "is-trail-in-ink",
      inInk(trailX - trailRadius, trailY - trailRadius, trailX + trailRadius, trailY + trailRadius)
    );

    /* The wake is its own body all the way down: its own spring, its own
       distance to ink for the swell and the blur ramp, its own ink, its
       own hand-off. It has to be — it is regularly a long way from the
       drop ahead of it, over different ink or over none. */
    cursorWake.style.translate = wakeX.toFixed(1) + "px " + wakeY.toFixed(1) + "px";
    place(wake, wakeX, wakeY);
    paintInk(wake, cursorWake, wakeX, wakeY);
    swellDrop(wake, cursorWake, wakeX, wakeY);
    cursor.classList.toggle(
      "is-wake-in-ink",
      inInk(wakeX - wakeRadius, wakeY - wakeRadius, wakeX + wakeRadius, wakeY + wakeRadius)
    );
  }

  let torn = false;

  function setInside(next) {
    if (next === insideHero) return;
    insideHero = next;
    hero.classList.toggle("is-pointer-inside", next);
    cursor.classList.toggle("is-visible", next);
    if (next) {
      leaving = 0;
      /* Coming in, the trail starts on the pointer rather than streaking
         across from wherever it was left — unless it's still on its way
         out from a moment ago, in which case it just turns around. */
      if (!(trailX || trailY) || Math.hypot(pointerX - trailX, pointerY - trailY) > 200) {
        trailX = pointerX;
        trailY = pointerY;
        trailVX = 0;
        trailVY = 0;
        wakeX = pointerX;
        wakeY = pointerY;
        wakeVX = 0;
        wakeVY = 0;
      }
      placeTrails();
    } else {
      cursor.classList.remove(
        "is-pressed",
        "is-in-ink",
        "is-trail-in-ink",
        "is-wake-in-ink"
      );
      hero.classList.remove("is-pressed");
      /* Going out, the loop stays up for the length of the exit so the
         drop shrinks while still chasing the pointer. */
      leaving = performance.now();
      start();
    }
  }

  /* A touchscreen laptop matches (hover: hover) and (pointer: fine), so
     the query above will hand a custom cursor to someone who then taps the
     screen — stranding a fake pointer mid-page with nothing driving it.
     First non-mouse press, the whole thing goes away for the rest of the
     session: system cursor back, twins gone. The letters stay liquid;
     that part never needed a pointer. */
  function teardown() {
    torn = true;
    setInside(false);
    stop();
    cursor.remove();
    lead.remove();
    trail.remove();
  }

  window.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") {
        teardown();
        return;
      }
      if (insideHero) {
        cursor.classList.add("is-pressed");
        hero.classList.add("is-pressed");
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerup",
    () => {
      cursor.classList.remove("is-pressed");
      hero.classList.remove("is-pressed");
    },
    { passive: true }
  );

  /* pointerout with no relatedTarget is the pointer leaving the window
     altogether, as opposed to crossing between elements inside it. */
  document.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) setInside(false);
  });

  window.addEventListener("blur", () => setInside(false));

  /* ---- Pointer ---- */
  window.addEventListener(
    "pointermove",
    (event) => {
      if (torn) return;
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;

      pointerX = event.clientX;
      pointerY = event.clientY;
      /* Layout can move under the hero without a resize or a scroll —
         the header partial arriving, the nav rail collapsing, a web
         font landing — and every twin is placed relative to the
         wrapper's box, so a stale one puts the twins a constant hundred
         pixels off the pointer. The box itself is cheap to read; the
         full measure only reruns when it has actually moved. */
      if (measured) {
        const box = liquid.getBoundingClientRect();
        if (
          box.left !== liquidBox.left ||
          box.top !== liquidBox.top ||
          box.width !== liquidBox.width ||
          box.height !== liquidBox.height
        ) {
          measured = false;
        }
      }
      if (!measured) measure();

      /* In charge inside the hero, except over a button, where the
         system pointer (the hand) is the right cursor and this one
         stands down the same way it does at the hero's edge. */
      const overTarget = Boolean(
        event.target.closest && event.target.closest(TARGET_SELECTOR)
      );
      setInside(within(heroBox, pointerX, pointerY) && !overTarget);
      if (!insideHero && !leaving) return;

      /* Written here rather than in the loop, and with no easing: this is
         the actual pointer indicator, and anything standing in for the
         system cursor has to be exactly where the pointer is. The twin
         follows it the same way, so it stays exactly under the fixed one
         for the hand-off. */
      cursorBlob.style.translate = pointerX + "px " + pointerY + "px";

      if (!insideHero) {
        /* On the way out the arrow is fading over the system pointer and
           has to stay on it — and so does its twin, which is shrinking,
           and may be the copy that was showing when the pointer crossed
           out. Nothing else (the hand-off) is in play. */
        place(lead, pointerX, pointerY);
        paintInk(lead, cursorBlob, pointerX, pointerY);
        return;
      }

      placeLead();

      start();
    },
    { passive: true }
  );

  /* ---- The loop ----
     Only the trail is animated. Same shape as setupBallTracks in main.js:
     it exists while there's something left to settle, and stops itself
     once the trail has caught the pointer and gone still — which, near
     ink, it doesn't: the melt keeps the drop changing shape under a
     parked pointer, so that's the one case the loop keeps running for.
     Parked anywhere else it costs nothing. */
  function step(now) {
    const dt = (lastFrame ? Math.min(now - lastFrame, 50) : 16.7) / 1000;
    lastFrame = now;

    const dx = pointerX - trailX;
    const dy = pointerY - trailY;
    trailVX += (dx * STIFFNESS - trailVX * DAMPING) * dt;
    trailVY += (dy * STIFFNESS - trailVY * DAMPING) * dt;
    trailX += trailVX * dt;
    trailY += trailVY * dt;

    /* The wake chases the pointer too, not the drop ahead of it: chained
       to that one it would inherit its overshoot and swing about after
       it, and the pair has to come to rest concentric. */
    const wx = pointerX - wakeX;
    const wy = pointerY - wakeY;
    wakeVX += (wx * WAKE_STIFFNESS - wakeVX * WAKE_DAMPING) * dt;
    wakeVY += (wy * WAKE_STIFFNESS - wakeVY * WAKE_DAMPING) * dt;
    wakeX += wakeVX * dt;
    wakeY += wakeVY * dt;

    let settled =
      Math.hypot(pointerX - trailX, pointerY - trailY) < SETTLED_PX &&
      Math.hypot(trailVX, trailVY) < SETTLED_SPEED;
    if (settled) {
      trailX = pointerX;
      trailY = pointerY;
      trailVX = 0;
      trailVY = 0;
    }
    if (
      Math.hypot(pointerX - wakeX, pointerY - wakeY) < SETTLED_PX &&
      Math.hypot(wakeVX, wakeVY) < SETTLED_SPEED
    ) {
      wakeX = pointerX;
      wakeY = pointerY;
      wakeVX = 0;
      wakeVY = 0;
    } else {
      settled = false;
    }

    placeTrails();

    /* Nothing changes shape on its own any more — a drop's size follows
       only from where it is — so once both bodies are on the pointer
       there is nothing left to draw and the loop stops.

       On the way out it runs for the exit's length regardless: the drops
       are shrinking the whole time and should be moving the whole time,
       and then it stops for good. */
    let done = settled;
    if (leaving) {
      done = now - leaving > EXIT_MS;
      if (done) leaving = 0;
    }
    raf = done ? 0 : requestAnimationFrame(step);
  }

  function start() {
    if (raf || torn || !heroVisible || !(insideHero || leaving)) return;
    lastFrame = 0;
    raf = requestAnimationFrame(step);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ---- Idling ----
     The filter has no compositor path — every frame a twin moves inside
     the wrapper re-rasterizes it on the main thread — so once the hero
     scrolls away the loop stops until it comes back. This also force-exits
     the hero state, which pointerleave can't be trusted to do: the hero
     regularly scrolls out from under a pointer that never moved. */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        heroVisible = entries[0].isIntersecting;
        if (heroVisible) {
          start();
        } else {
          stop();
          setInside(false);
        }
      },
      { rootMargin: "60px" }
    ).observe(hero);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
})();
