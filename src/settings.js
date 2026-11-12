// nonretarded-units — settings shared by the content script, popup and options page.
// Stored in storage.sync so they follow the user across devices.
// Also holds the small Chrome/Firefox compatibility helper (NruExt).
(function (root) {
  "use strict";

  const DIMS = {
    length: "Length (in, ft, yd, mi, hands)",
    mass: "Weight (oz, lb)",
    volume: "Volume (fl oz, cups, pints, quarts, gallons)",
    temp: "Temperature (°F)",
    speed: "Speed (mph)",
    area: "Area (sq in/ft/yd/mi, acres)",
    count: "Dozens (a dozen → 12)",
  };

  const DEFAULTS = {
    enabled: true,          // master switch
    disabledSites: [],      // hostnames where it's off
    volume: "us",           // "us" | "uk" pints, quarts, gallons, fl oz
    highlight: true,        // show the amber highlight
    dims: Object.fromEntries(Object.keys(DIMS).map((d) => [d, true])),
  };

  // Firefox provides promise-based `browser.*`; Chrome provides `chrome.*`
  // (promise-based in MV3). Use whichever exists. Neither exists when the
  // scripts run standalone in tests/demo.html — then defaults are used.
  const ext = root.browser || root.chrome || null;
  const alive = () => { try { return !!(ext && ext.runtime && ext.runtime.id); } catch (_) { return false; } };

  // fire-and-forget message to the background script
  function send(msg) {
    if (!alive()) return; // standalone, or extension reloaded under a stale content script
    try {
      const p = ext.runtime.sendMessage(msg);
      if (p && p.catch) p.catch(() => {});
    } catch (_) { /* ignore */ }
  }

  const hasStorage = () => !!(ext && ext.storage && ext.storage.sync);

  function merge(stored) {
    return { ...DEFAULTS, ...stored, dims: { ...DEFAULTS.dims, ...(stored && stored.dims) } };
  }

  async function load() {
    if (!hasStorage()) return merge({});
    try { return merge(await ext.storage.sync.get(null)); }
    catch (_) { return merge({}); } // extension reloaded under a stale content script
  }

  async function save(patch) {
    if (hasStorage()) await ext.storage.sync.set(patch);
  }

  function onChange(cb) {
    if (!hasStorage()) return;
    ext.storage.onChanged.addListener((_, area) => { if (area === "sync") load().then(cb); });
  }

  const normalizeHost = (h) => (h || "").replace(/^www\./, "").toLowerCase();

  function siteEnabled(s, host) {
    return s.enabled && !s.disabledSites.includes(normalizeHost(host));
  }

  root.NruSettings = { DIMS, DEFAULTS, load, save, onChange, siteEnabled, normalizeHost };
  root.NruExt = { api: ext, send };
})(globalThis);
