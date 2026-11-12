// nonretarded-units — background script.
// A service worker in Chrome, an event page in Firefox (see tools/package.ps1).
const ext = globalThis.browser || globalThis.chrome;

// Some calls don't exist everywhere (e.g. badges on Firefox for Android):
// skip missing ones and swallow rejections.
function tryCall(obj, fn, ...args) {
  try {
    if (obj && typeof obj[fn] === "function") {
      const p = obj[fn](...args);
      if (p && p.catch) p.catch(() => {});
    }
  } catch (_) { /* unsupported on this platform */ }
}

// badge colours (set every time the script starts; cheap and always correct)
tryCall(ext.action, "setBadgeBackgroundColor", { color: "#ffc400" });
tryCall(ext.action, "setBadgeTextColor", { color: "#1f2328" });

ext.runtime.onMessage.addListener((msg, sender) => {
  if (!msg) return;
  // the bubble's portrait icon: content scripts can't open the options page themselves
  if (msg.type === "nru-open-options") tryCall(ext.runtime, "openOptionsPage");
  // number of converted values on a tab -> toolbar badge
  if (msg.type === "nru-count" && sender.tab) {
    const n = msg.count;
    tryCall(ext.action, "setBadgeText", { tabId: sender.tab.id, text: n ? (n > 999 ? "999+" : String(n)) : "" });
  }
});
