/* Site-wide interactivity. Runs once the header/footer partials have
   been injected by include.js. */
function initSite() {
  setActiveNavLink();
  setupScrollSpy();
  setupNavToggle();
  setupThemeToggle();
  setupBackLinks();
  setFooterYear();
  setupCopyEmail();
  setupContactMenu();
  setupHoverVideos();
  setupBallTracks();
  setupJumpNav();
  setupReportSizes();
  setupMatchTiles();
  setupReportTabs();
  setupMatchSelects();
  setupReportPanels();
  setupSidePanels();
}

/* include.js fetches the header/footer partials asynchronously and
   fires includes:loaded when they land. That fetch can resolve on
   either side of this script executing: if main.js is still downloading
   when the (often cached) partials arrive, the event fires before this
   listener would exist and every setup above is silently skipped —
   which breaks the nav, theme toggle, footer year, and card videos all
   at once. include.js sets window.__includesLoaded right before it
   dispatches, so run immediately when it's already done and only wait
   on the event otherwise. (No double-init: the flag is set synchronously
   with the dispatch, so exactly one branch ever runs.) */
if (window.__includesLoaded) {
  initSite();
} else {
  document.addEventListener("includes:loaded", initSite);
}

function getCurrentPage() {
  return (
    document.location.pathname.split("/").pop().replace(".html", "") ||
    "index"
  );
}

/* Case studies live at their own URLs (case-study-*.html) but aren't
   "All Projects" itself, so leave the nav unmarked rather than
   highlighting a section the visitor isn't actually on. */
function navSectionForPage(page) {
  if (page.startsWith("case-study")) return null;
  return page;
}

function setActiveNavLink() {
  const section = navSectionForPage(getCurrentPage());

  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.getAttribute("data-nav") === section) {
      link.setAttribute("aria-current", "page");
      /* This is a real URL match (projects.html/about.html themselves),
         not the index page's scroll-spy guess at which section is in
         view — styled in the dark terracotta so it reads as more
         certain than the scroll spy's light terracotta below. */
      link.classList.add("is-page-match");
    }
  });
}

/* Projects and About Me both point at sections of index.html, so the
   filename match above can't highlight them while on the home page.
   This highlights whichever section is scrolled into the middle of the
   viewport. */
function setupScrollSpy() {
  if (getCurrentPage() !== "index") return;

  const sections = [
    { id: "projects", link: document.querySelector('[data-nav="projects"]') },
    { id: "about-me", link: document.querySelector('[data-nav="about"]') },
  ];

  sections.forEach(({ id, link }) => {
    const section = document.getElementById(id);
    if (!section || !link) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        /* observe() fires this callback immediately with whatever the
           current intersection state is. On a short hero that state can
           already have "projects" sitting in the middle band before the
           visitor has scrolled at all, highlighting the nav on load —
           so ignore any intersection reported before scrollY moves. */
        if (window.scrollY < 24) return;
        document
          .querySelectorAll(".site-nav__link[aria-current]")
          .forEach((l) => l.removeAttribute("aria-current"));
        link.setAttribute("aria-current", "page");
      },
      { rootMargin: "-40% 0px -40% 0px" }
    );

    observer.observe(section);
  });
}

/* Expand/collapse the desktop side rail. State is persisted so the
   choice sticks across pages and reloads. The `nav-collapsed` class
   lives on <html> so both the nav and the body offset can respond.

   Case studies are the exception: they default to collapsed every
   visit so the nav doesn't compete with the case study content, but
   the toggle still works — that override just isn't written back to
   the shared preference, so it doesn't leak into other pages. */
function setupNavToggle() {
  const toggle = document.querySelector(".site-nav__toggle");
  if (!toggle) return;

  const list = document.querySelector(".site-nav__list");
  const STORAGE_KEY = "nav-collapsed";
  const FADE_MS = 140;
  const isCaseStudy = getCurrentPage().startsWith("case-study");

  const setCollapsed = (collapsed) => {
    document.documentElement.classList.toggle("nav-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute(
      "aria-label",
      collapsed ? "Expand navigation" : "Collapse navigation"
    );
  };

  // First load: no fade — the crossfade below is only for the
  // user-triggered toggle. The `nav-collapsed` class is in fact already
  // on <html> by now, applied before first paint by the inline script
  // in each page's <head>; doing it here for the first time would mean
  // the rail paints expanded and then animates shut on every load. This
  // call re-asserts the same state to sync the toggle button's ARIA,
  // which the head script can't do because the button doesn't exist
  // yet. It reads the same two inputs in the same order so the two
  // stay in agreement — keep them that way if either changes.
  setCollapsed(isCaseStudy || localStorage.getItem(STORAGE_KEY) === "true");

  toggle.addEventListener("click", () => {
    const collapsed =
      !document.documentElement.classList.contains("nav-collapsed");
    if (!isCaseStudy) localStorage.setItem(STORAGE_KEY, String(collapsed));

    if (!list) {
      setCollapsed(collapsed);
      return;
    }

    // The nav labels rotate 90° between states and their layout box
    // resizes at the same instant (see .nav-collapsed rules in
    // layout.css), which reads as an abrupt snap if animated in
    // place. Fading the labels out, swapping the collapsed state
    // while they're invisible, then fading back in hides that snap
    // behind a soft crossfade instead.
    list.classList.add("is-toggling-nav");
    window.setTimeout(() => {
      setCollapsed(collapsed);
      window.setTimeout(() => {
        list.classList.remove("is-toggling-nav");
      }, FADE_MS);
    }, FADE_MS);
  });
}

/* Light/dark theme switcher, lives in the side nav's bottom section.
   Expanded: clicking an option selects that mode. Collapsed: only the
   active mode's icon is visible (see .nav-collapsed rules in
   layout.css), so the single visible button just flips to the other
   mode instead of re-selecting itself.
   A blocking inline script in each page's <head> applies the stored
   theme before first paint to avoid a flash of the wrong theme; this
   just keeps the toggle's UI and localStorage in sync afterward. */
function setupThemeToggle() {
  const toggle = document.querySelector("[data-theme-toggle]");
  if (!toggle) return;

  const STORAGE_KEY = "theme";
  const options = toggle.querySelectorAll("[data-theme-option]");

  const currentTheme = () =>
    document.documentElement.classList.contains("theme-dark") ? "dark" : "light";

  const apply = (theme) => {
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    options.forEach((option) => {
      const isActive = option.getAttribute("data-theme-option") === theme;
      option.setAttribute("aria-pressed", String(isActive));
    });
  };

  apply(localStorage.getItem(STORAGE_KEY) || currentTheme());

  toggle.addEventListener("click", (event) => {
    // Only one mode's button is visible/tappable here — on the collapsed
    // desktop rail, or on the mobile tab bar where the toggle is a
    // single tab rather than a two-option control — so a tap just flips
    // to the other mode instead of re-selecting the one shown.
    const singleOption =
      document.documentElement.classList.contains("nav-collapsed") ||
      window.matchMedia("(max-width: 699px)").matches;
    const theme = singleOption
      ? currentTheme() === "dark" ? "light" : "dark"
      : event.target.closest("[data-theme-option]")?.getAttribute("data-theme-option");

    if (!theme) return;

    localStorage.setItem(STORAGE_KEY, theme);
    apply(theme);
  });
}

/* Email item (desktop rail + mobile contact menu): copies the address
   instead of navigating, so it's a <button data-copy-email="…">
   rather than a mailto: link. One handler covers both copies via
   event delegation on the document, since the two live in different
   parts of the header markup and either (or neither) may be present
   depending on viewport. */
function setupCopyEmail() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-copy-email]");
    if (!trigger) return;

    const email = trigger.getAttribute("data-copy-email");
    copyText(email).then((copied) => {
      showToast(copied ? "Email copied" : email);
    });
  });
}

/* navigator.clipboard requires a secure context (https, or localhost);
   document.execCommand('copy') is deprecated but still works as a
   fallback everywhere else. If both fail, the toast falls back to
   just displaying the address so the visitor can copy it by hand. */
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // falls through to the legacy path below
    }
  }

  const scratch = document.createElement("textarea");
  scratch.value = text;
  scratch.setAttribute("readonly", "");
  scratch.style.position = "fixed";
  scratch.style.opacity = "0";
  document.body.appendChild(scratch);
  scratch.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (err) {
    copied = false;
  }
  scratch.remove();
  return copied;
}

/* Single shared toast element (see partials/header.html), reused for
   every message. The timeout is tracked on the element itself so a
   second call — e.g. clicking Email again before the first toast has
   finished — restarts the hide timer instead of the two racing. */
function showToast(message) {
  const toast = document.querySelector("[data-toast]");
  if (!toast) return;

  window.clearTimeout(toast._hideTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toast._hideTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

/* Mobile contact menu: the tab bar's trigger button opens a small menu
   with the same Email/LinkedIn/GitHub items the desktop rail shows
   inline. Only relevant below the 700px breakpoint, but the elements
   are simply hidden (not removed) above it by CSS, so this doesn't
   need to care which viewport it's running in. */
function setupContactMenu() {
  const wrapper = document.querySelector(".site-nav__contact");
  const trigger = document.querySelector("[data-contact-trigger]");
  const menu = document.querySelector("[data-contact-menu]");
  if (!wrapper || !trigger || !menu) return;

  const setOpen = (open) => {
    trigger.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
  };

  trigger.addEventListener("click", () => {
    setOpen(menu.hidden);
  });

  // Selecting a link item closes the menu too — the link's own
  // target="_blank" handles the navigation, this just tidies up.
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a, [data-copy-email]")) setOpen(false);
  });

  document.addEventListener("click", (event) => {
    if (!menu.hidden && !wrapper.contains(event.target)) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      setOpen(false);
      trigger.focus();
    }
  });
}

/* A case study can be reached from two places — the Selected work
   section on the home page, or the full All Projects page — so a fixed
   "back" target strands half the visitors somewhere they weren't.
   Points any [data-back-link] at wherever the visitor actually came
   from, falling back to All Projects for direct visits (bookmark,
   shared link, new tab), which is the more complete listing of the two.
   Deliberately reads document.referrer rather than calling
   history.back(): the label has to state the destination up front, and
   history.back() can't promise where it lands. */
function setupBackLinks() {
  const links = document.querySelectorAll("[data-back-link]");
  if (!links.length) return;

  if (referrerPage() !== "index") return;

  links.forEach((link) => {
    link.setAttribute("href", "index.html#projects");
    const label = link.querySelector("[data-back-link-label]");
    if (label) label.textContent = "Back to selected work";
  });
}

/* Filename of the previous page, or null when there's no usable
   referrer — absent (direct visit), or off-site, in which case sending
   someone "back" to it isn't ours to offer. */
function referrerPage() {
  if (!document.referrer) return null;

  try {
    const url = new URL(document.referrer);
    if (url.origin !== window.location.origin) return null;
    return url.pathname.split("/").pop().replace(".html", "") || "index";
  } catch (err) {
    return null;
  }
}

/* Motion thumbnails on the project cards. Each [data-hover-video] is a
   muted, looping mp4 that sits behind its poster frame until the
   visitor engages with the card, then plays; it pauses and rewinds to
   frame 0 (identical to the poster) when they leave, so at rest it
   reads as a still image. The clip is only fetched on first play
   because the markup carries preload="none".

   Playback is gated to pointer devices that can hover — touch visitors
   just see the poster, which is why every card needs a real poster
   frame. It deliberately plays even under prefers-reduced-motion: the
   clip only runs on a deliberate hover and pauses the instant the
   visitor leaves, so it's user-initiated rather than the ambient,
   unstoppable motion that setting is meant to suppress; at rest it's
   always the still poster. The trigger is the closest panel for a
   triptych (so only the hovered clip plays) or the whole card for a
   single-media card; keyboard users get the same via focusin/focusout
   on the card's link. */
function setupHoverVideos() {
  const videos = document.querySelectorAll("[data-hover-video]");
  if (!videos.length) return;

  const canHover = window.matchMedia("(hover: hover)");

  videos.forEach((video) => {
    // Each triptych panel triggers on its own hover, so only the clip
    // under the cursor plays — three at once was too much motion. A
    // single-media card (or a chapter tile on the consolidation
    // overview) has no panel, so it falls back to the whole card as the
    // trigger (hovering anywhere, e.g. toward the title, wakes it).
    const trigger =
      video.closest(".card__panel") || video.closest(".card, .chapter") || video.parentElement;

    const play = () => {
      if (!canHover.matches) return;
      video.classList.add("is-playing");
      // play() rejects if the visitor leaves before the fetch resolves
      // (we pause it below); that's expected, so swallow it.
      const started = video.play();
      if (started) started.catch(() => {});
    };

    const stop = () => {
      video.classList.remove("is-playing");
      video.pause();
      video.currentTime = 0;
    };

    trigger.addEventListener("mouseenter", play);
    trigger.addEventListener("mouseleave", stop);
    trigger.addEventListener("focusin", play);
    trigger.addEventListener("focusout", stop);
  });
}

/* The ball trace on the volleyball playback card.

   The panel is real footage of a rally with the product's trajectory
   overlay redrawn on top of it, rather than burnt into the pixels — which
   is what lets the trace survive being cropped to a panel a third as wide.
   Each SVG carries data-ball-track: the ball's measured position at every
   frame of the clip, as [startFrame, [x, y], [x, y], ...] per flight, in
   the video's own coordinate space.

   Everything here is read off video.currentTime rather than run on a timer,
   so the trace cannot drift against the rally: the end of the line is the
   ball's position at the frame currently on screen, interpolated between
   the two samples either side of it. The scrubber and the clock come from
   the same clock, so the whole panel agrees with itself.

   At rest the video sits on its poster at t=0, which is a frame from before
   the rally starts — so an empty trace and an empty scrubber are the
   correct still, and no reset logic is needed beyond redrawing on seek. */
function setupBallTracks() {
  const svgs = document.querySelectorAll("[data-ball-track]");
  if (!svgs.length) return;

  const FPS = 30;

  const clock = (t) => {
    const s = Math.max(0, Math.floor(t));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };

  svgs.forEach((svg) => {
    const stage = svg.closest(".vbd");
    const video = stage && stage.querySelector("video");
    if (!video) return;

    let flights;
    try {
      flights = JSON.parse(svg.dataset.ballTrack);
    } catch (err) {
      return;
    }

    const paths = svg.querySelectorAll(".vbd__arc");
    const fill = stage.querySelector(".vbd__scrub-fill");
    const now = stage.querySelector("[data-clock-now]");
    const total = stage.querySelector("[data-clock-total]");
    let raf = 0;

    const draw = () => {
      const frame = video.currentTime * FPS;

      flights.forEach((flight, i) => {
        const path = paths[i];
        if (!path) return;
        const pts = flight.slice(1);
        const travelled = frame - flight[0];
        if (travelled < 0) {
          path.removeAttribute("d");
          return;
        }
        const last = Math.min(pts.length - 1, Math.floor(travelled));
        let d = "M" + pts[0][0] + " " + pts[0][1];
        for (let k = 1; k <= last; k++) d += "L" + pts[k][0] + " " + pts[k][1];
        // Carry the tip the rest of the way to the current sub-frame
        // position, so the line ends on the ball and not on the last
        // whole frame behind it.
        if (last < pts.length - 1) {
          const t = travelled - last;
          const a = pts[last];
          const b = pts[last + 1];
          d += "L" + (a[0] + (b[0] - a[0]) * t).toFixed(1) +
               " " + (a[1] + (b[1] - a[1]) * t).toFixed(1);
        }
        path.setAttribute("d", d);
      });

      const length = video.duration;
      if (fill && length) {
        fill.style.setProperty("--vbd-played", (video.currentTime / length).toFixed(4));
      }
      if (now) now.textContent = clock(video.currentTime);
      if (total && length) total.textContent = clock(length);
    };

    const tick = () => {
      draw();
      raf = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (!raf) raf = window.requestAnimationFrame(tick);
    };

    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      draw();
    };

    video.addEventListener("play", start);
    video.addEventListener("pause", stop);
    // setupHoverVideos rewinds to 0 on leave; redraw so the trace clears.
    video.addEventListener("seeked", draw);
    video.addEventListener("loadedmetadata", draw);
    draw();
  });
}

/* The sticky .jump-nav bar (case studies only) minimizes itself once it
   is actually stuck to the viewport top, rather than staying full size
   for the whole scroll. [data-jump-nav-sentinel] is a zero-height
   marker sitting immediately before the bar: the bar is stuck exactly
   when that marker has passed above the line the bar parks on, which is
   the bar's own `top` offset. Watching the marker rather than the bar
   is what makes "stuck" detectable at all — a sticky element never
   leaves the viewport on its own, so its own position tells you nothing.

   Deliberately a scroll listener and not an IntersectionObserver, which
   this used to be: an observer only reports when intersection *changes*,
   and the marker is zero-height, so any jump that clears it in a single
   frame — End key, dragging the scrollbar, landing on the page at a
   #hash — takes it from "below the viewport, not intersecting" straight
   to "above the viewport, not intersecting" without ever firing. The
   bar would then sit at the top of the screen still full size. Reading
   the position outright can't miss a transition it never saw. */
function setupJumpNav() {
  const nav = document.querySelector("[data-jump-nav]");
  const sentinel = document.querySelector("[data-jump-nav-sentinel]");
  if (!nav || !sentinel) return;

  let stickTop = 0;
  let queued = false;

  const update = () => {
    queued = false;
    nav.classList.toggle(
      "is-stuck",
      sentinel.getBoundingClientRect().top < stickTop
    );
  };

  // Coalesced to one read per frame: scroll fires far more often than
  // the page can paint, and this measures layout.
  const queue = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  };

  // The offset is a CSS value (var(--space-sm)), so it's read from the
  // element rather than repeated here, and re-read on resize in case a
  // breakpoint changes it.
  const measure = () => {
    stickTop = parseFloat(window.getComputedStyle(nav).top) || 0;
    queue();
  };

  measure();
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
}

/* Width switcher over the rebuilt report (case-study-volleyball-reports).
   The report is a size container: every layout rule in it answers to the
   width of its own window rather than the viewport's, so setting that
   width is the whole of it — the bar collapses, the canvas changes shape,
   and nobody has to pick up a phone to see the phone layout. */
function setupReportSizes() {
  const toggle = document.querySelector("[data-rdemo-sizes]");
  const demo = document.querySelector("[data-report-demo]");
  if (!toggle || !demo) return;

  const options = toggle.querySelectorAll("[data-rdemo-size]");

  toggle.addEventListener("click", (event) => {
    const size = event.target
      .closest("[data-rdemo-size]")
      ?.getAttribute("data-rdemo-size");

    if (!size) return;

    demo.setAttribute("data-size", size);
    options.forEach((option) => {
      const isActive = option.getAttribute("data-rdemo-size") === size;
      option.setAttribute("aria-pressed", String(isActive));
    });
  });
}

/* The report's two side panels — filters on the left, clips on the
   right — and the controls that open and shut them.

   Which is open lives on the window as data-left / data-right, so the
   stylesheet owns the whole of what open LOOKS like — a column beside
   the report on the desktop, a bottom sheet over it on touch — and this
   owns only the state. The one thing the shape changes here is how many
   can be open at once; see sheetMode below. The bar's funnel button is
   the left panel's trigger because in the product that is what the
   funnel does. The right panel has no button of its own: it is opened
   by a count in the report (report-demo.js), the way a clip list is in
   the product, and asks for that through rdemo:side-request.

   Content is not built here. A panel opening fires rdemo:side-open on
   the window with the side in its detail, and closing fires
   rdemo:side-close — the hooks for loading something into
   [data-rdemo-side-body] and for putting the report back when it goes.
   The same "mount it when it is visible, not before" shape the report
   panels and their charts use, and for the same reason: whatever lands
   in there can measure itself once the panel actually has a width. */
function setupSidePanels() {
  const demo = document.querySelector("[data-report-demo]");
  if (!demo) return;

  const panels = [...demo.querySelectorAll("[data-rdemo-side]")];
  if (!panels.length) return;

  const toggles = [...demo.querySelectorAll("[data-rdemo-side-toggle]")];
  const stateAttribute = (side) => `data-${side}`;
  const isOpen = (side) => demo.getAttribute(stateAttribute(side)) === "open";
  const sides = ["left", "right"];

  const setSide = (side, open) => {
    const was = isOpen(side);
    demo.setAttribute(stateAttribute(side), open ? "open" : "closed");

    toggles
      .filter((toggle) => toggle.getAttribute("data-rdemo-side-toggle") === side)
      .forEach((toggle) => toggle.setAttribute("aria-expanded", String(open)));

    // Only on a change of state: the closing calls at the bottom of this
    // function, which exist to write the attributes, would otherwise
    // announce two panels shutting that were never open.
    if (open && !was) {
      demo.dispatchEvent(new CustomEvent("rdemo:side-open", { detail: { side } }));
    } else if (!open && was) {
      demo.dispatchEvent(new CustomEvent("rdemo:side-close", { detail: { side } }));
    }
  };

  // On a phone or a tablet these are bottom sheets rather than columns,
  // and two sheets stacked over the same report is nonsense — the second
  // would simply hide the first. Opening one there closes the other. On
  // the desktop they are columns on opposite sides of the canvas and
  // both can be open at once, which is the point of having two.
  const sheetMode = () => demo.getAttribute("data-size") !== "web";

  const openSide = (side, open) => {
    if (open && sheetMode()) {
      sides.filter((other) => other !== side).forEach((other) => setSide(other, false));
    }
    setSide(side, open);
  };

  toggles.forEach((toggle) => {
    const side = toggle.getAttribute("data-rdemo-side-toggle");
    toggle.addEventListener("click", () => openSide(side, !isOpen(side)));
  });

  // The report asking for a panel, which is how the clip list arrives:
  // a count is clicked over in report-demo.js and the panel it wants
  // opens through the same rule the buttons use, so a sheet still
  // closes the other sheet.
  demo.addEventListener("rdemo:side-request", (event) => {
    const { side, open } = event.detail || {};
    if (sides.includes(side)) openSide(side, Boolean(open));
  });

  const closeAll = () => sides.forEach((side) => setSide(side, false));

  const scrim = demo.querySelector("[data-rdemo-scrim]");
  if (scrim) scrim.addEventListener("click", closeAll);

  const leftPanel = panels.find((panel) => panel.getAttribute("data-rdemo-side") === "left");
  const leftTrigger = toggles.find(
    (toggle) => toggle.getAttribute("data-rdemo-side-toggle") === "left"
  );

  // Escape, because a sheet covers what is behind it and every other
  // overlay on the web closes this way. Focus only moves if it was
  // about to be stranded inside the filters: the clip panel's close is
  // answered by the report itself (rdemo:side-close), which puts focus
  // back on the count that opened it.
  demo.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !sides.some(isOpen)) return;
    const active = document.activeElement;
    closeAll();
    if (leftPanel && leftPanel.contains(active)) {
      if (leftTrigger) leftTrigger.focus();
    } else if (
      document.activeElement === active &&
      panels.some((panel) => panel.contains(active))
    ) {
      // Still inside a panel that has just shut and nobody claimed it.
      const tab = demo.querySelector('[role="tab"][aria-selected="true"]');
      if (tab) tab.focus();
    }
  });

  demo.querySelectorAll("[data-rdemo-side-close]").forEach((close) => {
    const side = close.getAttribute("data-rdemo-side-close");
    close.addEventListener("click", () => {
      setSide(side, false);
      // Focus would otherwise be left on a button that has just become
      // invisible, which strands a keyboard user mid-window. It goes back
      // to whatever opened the panel — the bar's button for the filters;
      // the clip panel has none, and the report puts focus back on the
      // count itself when it hears the panel close.
      const trigger = toggles.find(
        (toggle) => toggle.getAttribute("data-rdemo-side-toggle") === side
      );
      if (trigger) trigger.focus();
    });
  });

  // Both shut to begin with, written from here rather than left to the
  // markup so the attributes the stylesheet keys off always exist.
  setSide("left", false);
  setSide("right", false);
}

/* ---------- Report charts ----------
   The trends card's chart is Recharts, which means React — neither of
   which this site otherwise uses. That is a deliberate trade: the
   product's charts ARE Recharts, and a case study claiming to rebuild
   the report rather than picture it should draw them the way the report
   draws them, tooltips and axis behaviour included.

   The cost is paid as late as possible. Four scripts, ~165KB gzipped,
   fetched only when someone opens the Trends tab — so every other page
   on this site, and this page for anyone who never opens that tab, loads
   none of it.

   prop-types is the one that looks wrong and isn't: Recharts' UMD build
   lists react AND prop-types as externals, so without it the bundle
   evaluates to an empty object and every chart silently renders
   nothing. */
const CHART_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js",
  "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://cdn.jsdelivr.net/npm/prop-types@15.8.1/prop-types.min.js",
  "https://cdn.jsdelivr.net/npm/recharts@2.15.4/umd/Recharts.min.js",
];

let chartLibrary;

function loadChartLibrary() {
  // Serial rather than parallel: Recharts' UMD wrapper reads window.React
  // and window.PropTypes as it evaluates, so it cannot be racing them.
  chartLibrary =
    chartLibrary ||
    CHART_SCRIPTS.reduce(
      (chain, src) =>
        chain.then(
          () =>
            new Promise((resolve, reject) => {
              const script = document.createElement("script");
              script.src = src;
              script.onload = resolve;
              script.onerror = () => reject(new Error("could not load " + src));
              document.head.appendChild(script);
            })
        ),
      Promise.resolve()
    );

  return chartLibrary;
}

/* Colours come out of the stylesheet rather than being repeated here, so
   the product's palette stays in tokens.css where the rest of it lives.
   Recharts wants plain strings, not var() references. */
function chartPalette(host) {
  const styles = window.getComputedStyle(host);
  const token = (name) => styles.getPropertyValue(name).trim();
  return {
    line: token("--vbd-trend"),
    grid: token("--vbd-line"),
    text: token("--vbd-text-dim"),
    surface: token("--vbd-bezel"),
    strong: token("--vbd-text"),
  };
}

/* The season the chart plots.

   report-demo.js owns the report's data, so when it is on the page the
   chart asks it: side-out per match, computed from the same (set,
   rotation) cells the tables downstairs just counted. That is what lets
   a filter in the funnel move this line too — filter to set 5 and the
   trend becomes the team's fifth sets, three-set matches dropping out of
   it entirely, rather than the same seventeen points it always was.

   The fallback below is the tiles' own data-sideout, which is where those
   numbers are authored. It keeps the chart working on its own and it is
   the shape report-demo.js returns, so neither side has to know which
   one drew the line.

   `picked` is the same number again, or null where the match isn't in
   the current selection. Two keys over one set of points is what lets
   the chart draw the whole season faintly and the selected matches
   brightly on top of it. */
function seasonPoints(demo) {
  const model = window.ReportDemo;
  return model ? model.seasonPoints() : seasonFromTiles(demo);
}

/* The tiles are laid out most recent first and a trend reads oldest to
   newest, so this reverses them. */
function seasonFromTiles(demo) {
  return [...demo.querySelectorAll("[data-rdemo-match]")]
    .map((tile) => {
      const sideout = Number(tile.getAttribute("data-sideout"));
      const picked = tile.getAttribute("aria-pressed") === "true";
      return {
        match: tile.querySelector(".rdemo__tileopp")?.textContent.trim(),
        date: tile.querySelector(".rdemo__tiledate")?.textContent.trim(),
        sideout,
        picked: picked ? sideout : null,
      };
    })
    .filter((point) => Number.isFinite(point.sideout))
    .reverse();
}

/* The trends chart, as a function of the current selection.

   Plotting only the selected matches was the obvious reading of "the
   report counts what you picked", and it is wrong here: the default
   selection is one match, and a trend across one match is a dot. So the
   season is always drawn, faintly, and the selection is drawn brightly
   over it. One match reads as a point against a season; Last 5 as a
   bright tail; All Season as the whole line lit. The picker is visibly
   doing something at every setting, which a filtered series could only
   manage at some of them.

   The dashed line stays the season average either way — it is what
   "better or worse" is measured against, so it can't move when the
   selection does.

   Neither series animates. Recharts re-runs its entry animation on every
   data change and withholds the dots until it finishes, so a chart wired
   to the match picker spent a second and a half redrawing itself after
   each click — and in the default one-match state, where the dot IS the
   mark, showed nothing at all while animating a line it had no room to
   draw. A trend is read, not watched. */
function buildTrendsChart(host, demo) {
  const R = window.Recharts;
  const {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
  } = R || {};
  if (!ResponsiveContainer) throw new Error("Recharts did not initialise");

  const data = seasonPoints(demo);
  const colors = chartPalette(host);
  // A filter can empty the report — every match in the season can end up
  // with no sets left in it — and a chart of nothing is worse than a
  // sentence saying so.
  if (!data.length) {
    return React.createElement(
      "p",
      { className: "rdemo__chartnote" },
      "No matches left in the report."
    );
  }
  const average = data.reduce((sum, point) => sum + point.sideout, 0) / data.length;
  const picked = data.filter((point) => point.picked !== null).length;
  // With one match selected there is no line to draw — the path Recharts
  // emits is a single point — so the dot is the entire mark and a 2.5px
  // speck won't do. It grows to carry that on its own.
  const dotRadius = picked === 1 ? 5 : 2.5;
  const axis = { stroke: colors.grid, tick: { fill: colors.text, fontSize: 11 } };

  const chart = React.createElement(
    ResponsiveContainer,
    { width: "100%", height: "100%" },
    React.createElement(
      LineChart,
      { data, margin: { top: 8, right: 12, bottom: 0, left: -12 } },
      React.createElement(CartesianGrid, { stroke: colors.grid, vertical: false }),
      // Labels get dropped rather than overlapped: the same chart holds 17
      // matches on a desktop card and on a phone's.
      React.createElement(XAxis, Object.assign({ dataKey: "date", minTickGap: 14 }, axis)),
      React.createElement(
        YAxis,
        Object.assign(
          {
            domain: [30, 60],
            ticks: [30, 40, 50, 60],
            tickFormatter: (value) => value + "%",
          },
          axis
        )
      ),
      React.createElement(Tooltip, {
        contentStyle: {
          background: colors.surface,
          border: "1px solid " + colors.grid,
          borderRadius: 8,
          fontSize: 12,
        },
        labelStyle: { color: colors.strong },
        itemStyle: { color: colors.line },
        formatter: (value) => [value + "%", "Side out"],
      }),
      // What "better or worse" is measured against — the question the
      // trends report exists to answer.
      React.createElement(ReferenceLine, {
        y: average,
        stroke: colors.text,
        strokeDasharray: "4 4",
        label: {
          value: "Season " + average.toFixed(1) + "%",
          position: "insideTopLeft",
          fill: colors.text,
          fontSize: 11,
        },
      }),
      React.createElement(Legend, {
        verticalAlign: "top",
        align: "right",
        height: 22,
        iconType: "plainline",
        iconSize: 14,
        wrapperStyle: { fontSize: 11, color: colors.text },
      }),
      // The season, underneath and quiet. It owns the tooltip — every
      // match has a number whether or not it is selected, and one row on
      // hover beats two rows saying the same thing.
      React.createElement(Line, {
        type: "monotone",
        dataKey: "sideout",
        name: "All matches",
        stroke: colors.text,
        strokeOpacity: 0.4,
        strokeWidth: 1.5,
        dot: false,
        activeDot: { r: 3, fill: colors.text },
        isAnimationActive: false,
      }),
      // The selection, on top. connectNulls stays off on purpose: a gap
      // in the bright line is a match the coach left out, and bridging it
      // would draw a trend through data that isn't in the report.
      React.createElement(Line, {
        type: "monotone",
        dataKey: "picked",
        name: "Selected",
        stroke: colors.line,
        strokeWidth: 2,
        connectNulls: false,
        dot: { r: dotRadius, fill: colors.line, strokeWidth: 0 },
        activeDot: { r: 4 },
        tooltipType: "none",
        isAnimationActive: false,
      })
    )
  );

  return chart;
}

/* Charts mount on first view, never on load: Recharts measures the box it
   is given, and a panel that is still `hidden` measures zero — so a chart
   built up front comes out an invisible nothing that only fixes itself on
   the next resize. setupReportTabs calls this as it shows a panel, and it
   runs once for whichever panel starts selected. */
function mountReportPanel(panel) {
  const host = panel && panel.querySelector("[data-rdemo-chart]");
  if (!host || host.dataset.mounted) return;

  const demo = panel.closest("[data-report-demo]");
  host.dataset.mounted = "true";

  loadChartLibrary()
    .then(() => {
      const root = ReactDOM.createRoot(host);
      const draw = () => root.render(buildTrendsChart(host, demo));

      draw();
      // Redrawn from the markup on every change to the selection, rather
      // than handed a copy of it: the tiles' aria-pressed is the state,
      // and reading it back each time means the chart can't hold a stale
      // idea of what the report contains. (See setupMatchSelects, which
      // fires this.)
      demo.addEventListener("rdemo:selection", draw);
    })
    .catch(() => {
      host.dataset.mounted = "";
      host.innerHTML =
        '<p class="rdemo__chartnote">Trend chart couldn’t load.</p>';
    });
}

function setupReportPanels() {
  const selected = document.querySelector(
    '[data-report-demo] [role="tab"][aria-selected="true"]'
  );
  const panel = selected && document.getElementById(selected.getAttribute("aria-controls"));
  if (panel) mountReportPanel(panel);
}

/* The rebuilt report's match selection: the quick selects, the tiles
   they pick, and the count that says how many are in the report.

   This is the interaction the whole reports project turned on. A coach
   doesn't read one match, they ask a question of a set of them — the
   last five, everything at home, every loss — and the shortcut row is
   how they say which set without picking matches off a timeline one at
   a time. So the shortcuts here actually select: each one is a rule
   over the tiles, and choosing it presses exactly the tiles it matches.

   The rules read recency from document order (the tiles are laid out
   most recent first) and everything else off each tile's own data
   attributes, so adding a match to the markup needs nothing here. */
const MATCH_RULES = {
  recent: (match) => match.index === 0,
  last5: (match) => match.index < 5,
  season: () => true,
  tournaments: (match) => match.tournament,
  home: (match) => match.venue === "home",
  away: (match) => match.venue === "away",
  wins: (match) => match.result === "w",
  losses: (match) => match.result === "l",
};

function setupMatchSelects() {
  const demo = document.querySelector("[data-report-demo]");
  if (!demo) return;

  const chips = [...demo.querySelectorAll("[data-rdemo-quick]")];
  const tiles = [...demo.querySelectorAll("[data-rdemo-match]")];
  const count = demo.querySelector("[data-rdemo-count]");
  if (!chips.length || !tiles.length) return;

  const matches = tiles.map((tile, index) => ({
    tile,
    index,
    venue: tile.getAttribute("data-venue"),
    result: tile.getAttribute("data-result"),
    tournament: tile.hasAttribute("data-tournament"),
  }));

  const selectedCount = () =>
    tiles.filter((tile) => tile.getAttribute("aria-pressed") === "true").length;

  const tally = () => {
    if (count) count.textContent = `${selectedCount()} Selected`;
    // Anything drawn from the selection listens for this rather than
    // being called directly, so the picker doesn't have to know which
    // report is open or what it does with a match list.
    demo.dispatchEvent(new CustomEvent("rdemo:selection"));
  };

  const apply = (key) => {
    const rule = MATCH_RULES[key];
    if (!rule) return;

    matches.forEach((match) => {
      match.tile.setAttribute("aria-pressed", String(Boolean(rule(match))));
    });

    chips.forEach((chip) => {
      const isActive = chip.getAttribute("data-rdemo-quick") === key;
      chip.setAttribute("aria-pressed", String(isActive));
    });

    tally();
  };

  chips.forEach((chip) => {
    chip.addEventListener("click", () => apply(chip.getAttribute("data-rdemo-quick")));
  });

  // Picking matches by hand is the other half of the row: the tiles are
  // where a coach lands when no shortcut describes what they want. Once
  // they touch one, no shortcut describes the set any more, so the
  // pressed chip is released rather than left claiming a selection it
  // no longer matches.
  tiles.forEach((tile) => {
    tile.addEventListener("click", () => {
      const wasOn = tile.getAttribute("aria-pressed") === "true";
      tile.setAttribute("aria-pressed", String(!wasOn));
      chips.forEach((chip) => chip.setAttribute("aria-pressed", "false"));
      tally();
    });
  });

  // The markup ships with Most Recent pressed and its one tile selected,
  // so there is nothing to correct on load — only to count, in case a
  // future edit to the tiles leaves the two out of step.
  tally();
}

/* The rebuilt report's tab row. Five report types, one panel each, and
   the panels are where each report's content will live — so this is the
   switch the rest of that work hangs off.

   Written to the ARIA tab pattern rather than as five buttons that swap
   a class: the row IS a tablist, and the pattern's keyboard behaviour is
   the part people notice when it's missing. Arrow keys move along the
   row (wrapping at both ends), Home and End jump to either extreme, and
   only the selected tab is in the page's tab order — one Tab press
   reaches the row, then the arrows work it, which is what a tablist is
   supposed to feel like.

   Which tab starts selected is the markup's business, not this
   function's: whichever tab carries aria-selected="true" is the one
   whose panel is showing (Athlete Stats today), so the page renders
   correct before the script runs and this only has to keep it that way. */
function setupReportTabs() {
  const list = document.querySelector('[data-report-demo] [role="tablist"]');
  if (!list) return;

  const tabs = [...list.querySelectorAll('[role="tab"]')];
  if (!tabs.length) return;

  // The row scrolls on a narrow window, so a tab reached by keyboard can
  // be off-screen. Scrolled by hand rather than with scrollIntoView,
  // which would also scroll the page to bring the whole window into view.
  const keepInView = (tab) => {
    const overflowLeft = tab.offsetLeft - list.scrollLeft;
    const overflowRight = overflowLeft + tab.offsetWidth - list.clientWidth;
    if (overflowLeft < 0) list.scrollLeft += overflowLeft;
    else if (overflowRight > 0) list.scrollLeft += overflowRight;
  };

  const select = (tab, { focus = false } = {}) => {
    const was = tabs.find((other) => other.getAttribute("aria-selected") === "true");
    // Moving to another report is leaving this one: whatever was
    // narrowed or opened here goes with it (report-demo.js listens).
    if (was && was !== tab) {
      list.closest("[data-report-demo]").dispatchEvent(new CustomEvent("rdemo:report-change"));
    }
    tabs.forEach((other) => {
      const isActive = other === tab;
      other.setAttribute("aria-selected", String(isActive));
      // Roving tabindex: the selected tab is the row's one tab stop.
      other.setAttribute("tabindex", isActive ? "0" : "-1");
      const panel = document.getElementById(other.getAttribute("aria-controls"));
      if (panel) {
        panel.hidden = !isActive;
        // Now that it has a size, anything in it that needs measuring can
        // be built — see mountReportPanel.
        if (isActive) mountReportPanel(panel);
      }
    });

    if (focus) tab.focus();
    keepInView(tab);
  };

  list.addEventListener("click", (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) select(tab);
  });

  list.addEventListener("keydown", (event) => {
    const current = tabs.indexOf(event.target.closest('[role="tab"]'));
    if (current < 0) return;

    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const next = step
      ? (current + step + tabs.length) % tabs.length
      : event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : -1;

    if (next < 0) return;

    event.preventDefault();
    select(tabs[next], { focus: true });
  });
}

/* The match tiles' show/hide in the rebuilt report's header — the
   product's own control, and so far the one piece of the report that
   actually does something. The button's aria-expanded is the state:
   the label swap keys off it directly, and data-tiles on the window is
   what the tiles themselves read (both in components.css). */
function setupMatchTiles() {
  const toggle = document.querySelector("[data-rdemo-tiles]");
  const demo = toggle?.closest("[data-report-demo]");
  if (!toggle || !demo) return;

  toggle.addEventListener("click", () => {
    const shown = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!shown));
    demo.setAttribute("data-tiles", shown ? "hidden" : "shown");
  });
}

function setFooterYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* ---- Project tag filter (only runs on projects.html) ----
   Runs immediately rather than waiting on DOMContentLoaded: this script
   tag sits at the end of the body, so the DOM is already parsed and
   that event has already fired by the time this file executes. */
(() => {
  const filterBar = document.querySelector("[data-filter-bar]");
  const cards = document.querySelectorAll("[data-project-card]");
  if (!filterBar || !cards.length) return;

  filterBar.addEventListener("click", (event) => {
    const chip = event.target.closest(".filter-chip");
    if (!chip) return;

    filterBar
      .querySelectorAll(".filter-chip")
      .forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");

    const filter = chip.getAttribute("data-filter");
    cards.forEach((card) => {
      const tags = card.getAttribute("data-tags") || "";
      const match = filter === "all" || tags.includes(filter);
      card.style.display = match ? "" : "none";
    });
  });
})();

/* ---- Testimonial quote switcher (only runs on index.html) ---- */
(() => {
  const tabs = document.querySelectorAll("[data-testimonial-tab]");
  if (!tabs.length) return;

  const segments = document.querySelectorAll("[data-testimonial-segment]");
  const panels = document.querySelectorAll("[data-testimonial-panel]");

  const activate = (index) => {
    tabs.forEach((tab) => {
      const active = tab.getAttribute("data-testimonial-tab") === index;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    segments.forEach((segment) => {
      segment.classList.toggle(
        "is-active",
        segment.getAttribute("data-testimonial-segment") === index
      );
    });
    panels.forEach((panel) => {
      panel.toggleAttribute(
        "hidden",
        panel.getAttribute("data-testimonial-panel") !== index
      );
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activate(tab.getAttribute("data-testimonial-tab"));
    });
  });

  segments.forEach((segment) => {
    segment.addEventListener("click", () => {
      activate(segment.getAttribute("data-testimonial-segment"));
    });
  });
})();

/* ---- Figure lightbox (case-study pages) ----
   Every screenshot and diagram in a case study opens full size over the
   page when it's clicked. They're laid out at half measure or smaller in
   the body, which is right for reading past them and too small for
   reading what's in them.

   The images are made clickable here rather than in the markup: there
   are around thirty of them across the case studies and nothing about
   any one of them needs saying, so marking each one up by hand is thirty
   chances to miss one. The role goes on the <img> itself rather than on
   a <button> wrapped around it because a wrapper element would land in
   the middle of the grid and flex rules those figures are laid out by
   (.figure-row's columns, --align-bottom's auto margin) and quietly
   break them. */
(() => {
  // Case studies only. Everywhere else an image is a card or a thumbnail.
  if (!getCurrentPage().startsWith("case-study")) return;

  /* Every image in the body counts, rather than a list of the container
     classes figures use: half of them are framed by a .figure-row or a
     .figure-solo and half are loose in the prose with nothing but a
     margin class, and a new one is as likely to be either. So the rule
     is what an image ISN'T, below.

     The hero image is in: the page crops it to 16:10, and it's worth
     seeing whole. */
  const NOT_A_FIGURE = [
    /* Anything inside a working mockup — the footage under the command
       bar, the panels of the report demo. Pulling one piece of a mockup's
       chrome out of the mockup it's a piece of shows nothing. */
    ".cmdbar",
    "[data-report-demo]",
    "[data-court-demo]",
    // Cards and pager thumbnails are navigation wearing a picture.
    ".card",
    ".pager",
    "a",
    // The escape hatch for anything else that turns up.
    "[data-no-zoom]",
  ].join(", ");

  const figures = [...document.querySelectorAll("#main img")].filter(
    (img) => !img.closest(NOT_A_FIGURE)
  );
  if (!figures.length) return;

  const ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';

  let overlay = null;
  let dialogImage = null;
  let dialogCaption = null;
  let closeButton = null;
  let navButtons = [];
  let index = -1;
  let opener = null;

  const isOpen = () => overlay !== null && overlay.classList.contains("is-open");

  /* The caption the figure carries in the page, and only that. Falling
     back to the alt text would put writing meant for a screen reader on
     screen — half of these read "Placeholder: ..." or describe the image
     to someone who can't see it, neither of which is a caption. */
  const captionFor = (img) => {
    const figure = img.closest("figure");
    const caption = figure && figure.querySelector("figcaption");
    return caption ? caption.textContent.trim() : "";
  };

  const show = (next) => {
    index = (next + figures.length) % figures.length;
    const img = figures[index];
    /* currentSrc rather than src: whatever the browser actually picked
       is the file already in cache, so the overlay paints immediately
       instead of fetching a second copy. */
    dialogImage.src = img.currentSrc || img.src;
    dialogImage.alt = img.alt || "";
    dialogCaption.textContent = captionFor(img);
    // What the dialog announces itself as when it takes focus.
    overlay.setAttribute("aria-label", img.alt || "Expanded image");

    /* What the CSS above sizes the image against. Read off the page's
       own copy, which is decoded by the time anything is clicked, so the
       overlay opens at the right size in the first frame rather than
       resizing once the file lands. */
    setBounds(img.naturalWidth, img.naturalHeight);
  };

  const setBounds = (width, height) => {
    if (!width || !height) return;
    overlay.style.setProperty("--lightbox-max-w", `${width * 2}px`);
    overlay.style.setProperty("--lightbox-aspect", `${width / height}`);
  };

  /* Freeze the page behind the scrim, holding open the width the
     scrollbar was taking so the page doesn't slide sideways as it goes
     (nothing to hold where the OS overlays its scrollbars: 0). */
  const lockPage = (locked) => {
    const root = document.documentElement;
    if (locked) {
      const gutter = window.innerWidth - root.clientWidth;
      root.style.setProperty("--lightbox-gutter", `${gutter}px`);
    }
    root.classList.toggle("lightbox-open", locked);
  };

  const step = (delta) => show(index + delta);

  const close = () => {
    if (!isOpen()) return;

    overlay.classList.remove("is-open");
    lockPage(false);
    document.removeEventListener("keydown", onKeydown);

    if (opener) opener.focus();
    opener = null;
  };

  /* A modal that Tab can walk out of leaves the keyboard somewhere the
     screen isn't, so focus cycles between the overlay's own buttons for
     as long as it's open. */
  const onKeydown = (event) => {
    if (event.key === "Escape") {
      close();
      return;
    }

    if (event.key === "ArrowLeft" && figures.length > 1) {
      step(-1);
      return;
    }

    if (event.key === "ArrowRight" && figures.length > 1) {
      step(1);
      return;
    }

    if (event.key !== "Tab") return;

    const stops = [closeButton, ...navButtons.filter((button) => !button.hidden)];
    const at = stops.indexOf(document.activeElement);
    const next = event.shiftKey ? at - 1 : at + 1;
    event.preventDefault();
    stops[(next + stops.length) % stops.length].focus();
  };

  const build = () => {
    overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Expanded image");
    overlay.innerHTML = [
      '<button class="lightbox__close" type="button" aria-label="Close image">',
      ICON,
      '<path d="M6 6l12 12M18 6L6 18" /></svg></button>',
      '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Previous image">',
      ICON,
      '<path d="M15 5l-7 7 7 7" /></svg></button>',
      '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Next image">',
      ICON,
      '<path d="M9 5l7 7-7 7" /></svg></button>',
      '<figure class="lightbox__figure">',
      '<img class="lightbox__img" alt="" />',
      '<figcaption class="lightbox__caption"></figcaption>',
      "</figure>",
    ].join("");

    dialogImage = overlay.querySelector(".lightbox__img");
    /* loading="lazy" further down a case study can still be undecoded
       when it's clicked, in which case naturalWidth was 0 above and the
       bounds come from the overlay's own copy as it lands. */
    dialogImage.addEventListener("load", () =>
      setBounds(dialogImage.naturalWidth, dialogImage.naturalHeight)
    );
    dialogCaption = overlay.querySelector(".lightbox__caption");
    closeButton = overlay.querySelector(".lightbox__close");
    navButtons = [...overlay.querySelectorAll(".lightbox__nav")];

    closeButton.addEventListener("click", close);
    overlay
      .querySelector(".lightbox__nav--prev")
      .addEventListener("click", () => step(-1));
    overlay
      .querySelector(".lightbox__nav--next")
      .addEventListener("click", () => step(1));

    /* Anywhere off the figure closes — the scrim, and the padding around
       the image, which is the same gesture as far as the pointer is
       concerned. The buttons sit outside the figure, so they're named
       here to keep a press on one from closing the thing it acts on. */
    overlay.addEventListener("click", (event) => {
      const onChrome = event.target.closest(
        ".lightbox__figure, .lightbox__close, .lightbox__nav"
      );
      if (!onChrome) close();
    });

    // One figure on the page means there's nothing to step to.
    navButtons.forEach((button) => {
      button.hidden = figures.length < 2;
    });

    document.body.appendChild(overlay);
  };

  const open = (img) => {
    if (!overlay) build();

    opener = img;
    show(figures.indexOf(img));

    overlay.classList.add("is-open");
    lockPage(true);
    closeButton.focus();
    document.addEventListener("keydown", onKeydown);
  };

  figures.forEach((img) => {
    img.classList.add("is-zoomable");
    /* role=button replaces the image's own role, which makes the alt
       text the button's name — announced as the figure it looks like
       rather than as an unlabelled control. The few figures marked
       decorative (alt="") have no name to inherit, so they say what the
       control does instead of arriving as a silent tab stop. */
    img.setAttribute("role", "button");
    img.setAttribute("tabindex", "0");
    img.setAttribute("aria-haspopup", "dialog");
    if (!img.alt) img.setAttribute("aria-label", "Expand image");

    img.addEventListener("click", () => open(img));
    img.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        // Space scrolls the page otherwise, which isn't what a press does.
        event.preventDefault();
        open(img);
      }
    });
  });
})();
