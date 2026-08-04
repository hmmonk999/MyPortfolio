/* Site-wide interactivity. Runs once the header/footer partials have
   been injected by include.js. */
document.addEventListener("includes:loaded", () => {
  setActiveNavLink();
  setupScrollSpy();
  setupNavToggle();
  setupThemeToggle();
  setupBackLinks();
  setFooterYear();
  setupCopyEmail();
  setupContactMenu();
});

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
