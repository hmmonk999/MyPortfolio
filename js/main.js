/* Site-wide interactivity. Runs once the header/footer partials have
   been injected by include.js. */
document.addEventListener("includes:loaded", () => {
  setActiveNavLink();
  setupScrollSpy();
  setupNavToggle();
  setupThemeToggle();
  setupBackLinks();
  setFooterYear();
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

  // First load: apply the stored state immediately, no fade — the
  // crossfade below is only for the user-triggered toggle. Case
  // studies always start collapsed regardless of the stored preference.
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
    const collapsed = document.documentElement.classList.contains("nav-collapsed");
    const theme = collapsed
      ? currentTheme() === "dark" ? "light" : "dark"
      : event.target.closest("[data-theme-option]")?.getAttribute("data-theme-option");

    if (!theme) return;

    localStorage.setItem(STORAGE_KEY, theme);
    apply(theme);
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
