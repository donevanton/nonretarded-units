// nonretarded-units — background service worker.
// badge colours (set every time the worker starts; cheap and always correct)
chrome.action.setBadgeBackgroundColor({ color: "#ffc400" });
if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: "#1f2328" });

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg) return;
  // the bubble's portrait icon: content scripts can't open the options page themselves
  if (msg.type === "nru-open-options") chrome.runtime.openOptionsPage();
  // number of converted values on a tab -> toolbar badge
  if (msg.type === "nru-count" && sender.tab) {
    const n = msg.count;
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: n ? (n > 999 ? "999+" : String(n)) : "" });
  }
});
