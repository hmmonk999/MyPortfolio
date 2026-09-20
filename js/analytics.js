/*
  Third-party analytics: Google Analytics 4 and Hotjar.

  The <head> is duplicated across every page in this site (only the
  header/footer are partials), so both tags live here instead — one
  file to edit if either property changes, and one <script> line per
  page instead of two.

  Loaded with <script defer src="js/analytics.js"></script> from each
  page's <head>. Both vendors are blocked outright by most ad
  blockers, so missing data usually means an extension, not a bug.

  To keep your own visits out of the reports, load any page once with
  ?tracking=off — phone, laptop, work machine. That sticks in
  localStorage, so it survives IP changes (cellular, work wifi) in a
  way GA's own internal-traffic filter can't. ?tracking=on undoes it.
  Either way the console says which state the browser is now in, so
  you can check a device without having to guess.

  Per browser profile, not per device: Safari and Chrome on the same
  phone each need their own visit, and private windows are never
  opted out because nothing persists there.
*/
(function () {
  const GA_MEASUREMENT_ID = "G-RBGMEWYCLH";
  const HOTJAR_SITE_ID = 1851686;
  const HOTJAR_VERSION = 6;
  const OPT_OUT_KEY = "analytics-opt-out";

  // localStorage throws rather than returning null in a few cases
  // (Safari private mode, third-party cookies blocked in an iframe),
  // and an uncaught throw here would take the page's other scripts
  // with it. Analytics is never worth that, so both sides degrade to
  // "just track normally".
  function readOptOut() {
    try {
      return localStorage.getItem(OPT_OUT_KEY) === "true";
    } catch (err) {
      return false;
    }
  }

  function writeOptOut(optedOut) {
    try {
      if (optedOut) localStorage.setItem(OPT_OUT_KEY, "true");
      else localStorage.removeItem(OPT_OUT_KEY);
      return true;
    } catch (err) {
      return false;
    }
  }

  // Read the switch before the localhost check below, so the flag can
  // also be set from a local preview rather than only in production.
  const param = new URLSearchParams(window.location.search).get("tracking");
  if (param === "off" || param === "on") {
    const stored = writeOptOut(param === "off");
    if (!stored) {
      console.warn(
        "[analytics] Couldn't save the setting — localStorage is unavailable " +
          "in this browser (private window?). This visit is still tracked."
      );
    } else if (param === "off") {
      console.info(
        "[analytics] This browser is now excluded. GA and Hotjar will not " +
          "load here again. Undo with ?tracking=on"
      );
    } else {
      console.info(
        "[analytics] This browser is no longer excluded — tracking normally. " +
          "Exclude it again with ?tracking=off"
      );
    }
  }

  if (readOptOut()) {
    console.info(
      "[analytics] Skipped: this browser is excluded. Undo with ?tracking=on"
    );
    return;
  }

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
