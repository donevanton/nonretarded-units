// nonretarded-units — toolbar popup.
(async () => {
  "use strict";
  const S = globalThis.NruSettings;
  const $ = (id) => document.getElementById(id);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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
    chrome.runtime.openOptionsPage();
    window.close();
  });

  // the badge holds the per-tab count reported by the content script
  async function showCount() {
    const text = await chrome.action.getBadgeText({ tabId: tab.id });
    $("count").innerHTML = text
      ? `<b>${text}</b> value${text === "1" ? "" : "s"} converted on this page.`
      : host ? "Nothing to convert on this page." : "";
  }
  showCount();
  chrome.storage.onChanged.addListener(() => setTimeout(showCount, 400));
})();
