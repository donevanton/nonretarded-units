// nonretarded-units — settings shared by the content script, popup and options page.
// Stored in chrome.storage.sync so they follow the user across devices.
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

  const hasStorage = () => !!(root.chrome && chrome.storage && chrome.storage.sync);

  function merge(stored) {
    return { ...DEFAULTS, ...stored, dims: { ...DEFAULTS.dims, ...(stored && stored.dims) } };
  }

  async function load() {
    if (!hasStorage()) return merge({});
    try { return merge(await chrome.storage.sync.get(null)); }
    catch (_) { return merge({}); } // extension reloaded under a stale content script
  }

  async function save(patch) {
    if (hasStorage()) await chrome.storage.sync.set(patch);
  }

  function onChange(cb) {
    if (!hasStorage()) return;
    chrome.storage.onChanged.addListener((_, area) => { if (area === "sync") load().then(cb); });
  }

  const normalizeHost = (h) => (h || "").replace(/^www\./, "").toLowerCase();

  function siteEnabled(s, host) {
    return s.enabled && !s.disabledSites.includes(normalizeHost(host));
  }

  root.NruSettings = { DIMS, DEFAULTS, load, save, onChange, siteEnabled, normalizeHost };
})(globalThis);
