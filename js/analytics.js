/*
  Third-party analytics: Google Analytics 4 and Hotjar.

  The <head> is duplicated across every page in this site (only the
  header/footer are partials), so both tags live here instead — one
  file to edit if either property changes, and one <script> line per
  page instead of two.

  Loaded with <script defer src="js/analytics.js"></script> from each
  page's <head>. Both vendors are blocked outright by most ad
  blockers, so missing data usually means an extension, not a bug.
*/
(function () {
  const GA_MEASUREMENT_ID = "G-RBGMEWYCLH";
  const HOTJAR_SITE_ID = 1851686;
  const HOTJAR_VERSION = 6;

  // Skip local previews so dev traffic doesn't land in the reports —
  // and, for Hotjar, so it doesn't spend the monthly session quota
  // recording us reloading the same page.
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "") return;

  function loadScript(src) {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  }

  // --- Google Analytics 4 ---------------------------------------
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`);

  window.dataLayer = window.dataLayer || [];
  // gtag() has to forward `arguments` verbatim, so it can't be an
  // arrow function or take named parameters — this is Google's shape.
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID);

  // --- Hotjar ---------------------------------------------------
  // Same deal as gtag: hj() queues raw `arguments` until the real
  // script loads and drains hj.q, so the signature stays untyped.
  window.hj =
    window.hj ||
    function () {
      (window.hj.q = window.hj.q || []).push(arguments);
    };
  window._hjSettings = { hjid: HOTJAR_SITE_ID, hjsv: HOTJAR_VERSION };

  loadScript(
    `https://static.hotjar.com/c/hotjar-${HOTJAR_SITE_ID}.js?sv=${HOTJAR_VERSION}`
  );
})();
