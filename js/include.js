/*
  Loads shared header/footer partials into any page that has
  <div data-include="partials/header.html"></div>.
  This is the only place that needs to change if you rename the nav.

  Note: this uses fetch(), which requires the page to be served over
  http(s) — it won't work if you double-click index.html and open it
  as a file:// URL. Run a local server while previewing (see README).
*/
(function () {
  async function loadIncludes() {
    const slots = document.querySelectorAll("[data-include]");
    await Promise.all(
      Array.from(slots).map(async (slot) => {
        const url = slot.getAttribute("data-include");
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to load ${url}`);
          slot.outerHTML = await response.text();
        } catch (err) {
          console.error(err);
          slot.innerHTML = "";
        }
      })
    );
    document.dispatchEvent(new CustomEvent("includes:loaded"));
  }

  loadIncludes();
})();
