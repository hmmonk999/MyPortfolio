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
    // single-media card has no panel, so it falls back to the whole
    // card as the trigger (hovering anywhere, e.g. toward the title,
    // wakes it).
    const trigger =
      video.closest(".card__panel") || video.closest(".card") || video.parentElement;

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
