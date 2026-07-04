/* Site-wide interactivity. Runs once the header/footer partials have
   been injected by include.js. */
document.addEventListener("includes:loaded", () => {
  setActiveNavLink();
  setupScrollSpy();
  setFooterYear();
});

function getCurrentPage() {
  return (
    document.location.pathname.split("/").pop().replace(".html", "") ||
    "index"
  );
}

function setActiveNavLink() {
  const page = getCurrentPage();

  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.getAttribute("data-nav") === page) {
      link.setAttribute("aria-current", "page");
    }
  });
}

/* Home and About Me are both sections of index.html, so the filename
   match above can only ever highlight Home. This swaps the active nav
   item to About Me once that section is scrolled into the middle of
   the viewport, and back to Home when it scrolls back out. */
function setupScrollSpy() {
  if (getCurrentPage() !== "index") return;

  const aboutSection = document.getElementById("about-me");
  const homeLink = document.querySelector('[data-nav="index"]');
  const aboutLink = document.querySelector('[data-nav="about"]');
  if (!aboutSection || !homeLink || !aboutLink) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        homeLink.removeAttribute("aria-current");
        aboutLink.setAttribute("aria-current", "page");
      } else {
        aboutLink.removeAttribute("aria-current");
        homeLink.setAttribute("aria-current", "page");
      }
    },
    { rootMargin: "-40% 0px -40% 0px" }
  );

  observer.observe(aboutSection);
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
