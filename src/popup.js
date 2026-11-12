// nonretarded-units — toolbar popup.
(async () => {
  "use strict";
  const S = globalThis.NruSettings;
  const ext = globalThis.NruExt.api;
  const $ = (id) => document.getElementById(id);

  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  let host = null;
  try {
    const url = new URL(tab.url);
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "file:") {
      host = S.normalizeHost(url.hostname) || "local files";
    }
  } catch (_) { /* no URL (e.g. chrome:// page without access) */ }

  let s = await S.load();

  function render() {
    $("global").checked = s.enabled;
    $("host").textContent = host || "Not available on this page";
    $("site").disabled = !host || !s.enabled;
    $("site").checked = !!host && !s.disabledSites.includes(host);
  }
  render();

  $("global").addEventListener("change", async (e) => {
    s.enabled = e.target.checked;
    await S.save({ enabled: s.enabled });
    render();
  });

  $("site").addEventListener("change", async (e) => {
    const set = new Set(s.disabledSites);
    if (e.target.checked) set.delete(host); else set.add(host);
    s.disabledSites = [...set].sort();
    await S.save({ disabledSites: s.disabledSites });
    render();
  });

  $("options").addEventListener("click", () => {
    ext.runtime.openOptionsPage();
    window.close();
  });

  // the badge holds the per-tab count reported by the content script
  async function showCount() {
    let text = "";
    try { text = await ext.action.getBadgeText({ tabId: tab.id }); }
    catch (_) { $("count").textContent = ""; return; } // no badges (Firefox for Android)
    const p = $("count");
    p.textContent = "";
    if (text) {
      const b = document.createElement("b");
      b.textContent = text;
      p.append(b, ` value${text === "1" ? "" : "s"} converted on this page.`);
    } else if (host) {
      p.textContent = "Nothing to convert on this page.";
    }
  }
  showCount();
  ext.storage.onChanged.addListener(() => setTimeout(showCount, 400));
})();
