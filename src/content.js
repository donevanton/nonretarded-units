// nonretarded-units — content script.
// Walks the page's text nodes, finds imperial values with the converter, and
// replaces each one with a highlighted <span> holding the metric value. The
// original text and conversion rate are stored on the span (data-nru-original,
// data-nru-rate) for the hover bubble.
(() => {
  "use strict";

  const NRU = globalThis.NonretardedUnits;
  if (!NRU || globalThis.__nruLoaded) return;
  globalThis.__nruLoaded = true;

  const CLS = "nru-conv";
  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA", "INPUT", "SELECT", "OPTION",
    "CODE", "PRE", "KBD", "SAMP", "VAR", "SVG", "MATH", "CANVAS", "IFRAME", "TITLE",
  ]);
  // cheap pre-filter: a text node without digits, fraction chars or "dozen" can't match
  const MAYBE = /[\d½⅓⅔¼¾⅛⅜⅝⅞]|dozen/i;

  function insideSkipped(el) {
    if (el.isContentEditable) return true;
    for (let n = el; n; n = n.parentElement) {
      if (SKIP_TAGS.has(n.nodeName.toUpperCase()) || n.classList.contains(CLS)) return true;
    }
    return false;
  }

  // ---- neighbouring text
  // Pages often split one phrase across elements, e.g. Wikipedia's
  //   4&nbsp;in <span>(101.6&nbsp;mm)</span>
  // The converter needs that neighbouring text to see the metric value is
  // already there. We look at siblings, climbing out of inline wrappers only.
  const INLINE = new Set(["A", "SPAN", "B", "I", "EM", "STRONG", "SMALL", "SUB", "SUP", "ABBR",
    "CITE", "MARK", "U", "S", "Q", "TIME", "DATA", "LABEL", "FONT", "BDI", "BDO", "DFN"]);
  const CONTEXT_CHARS = 40;

  // text as it originally was, so already-converted values don't look metric
  function originalText(n) {
    if (n.nodeType === Node.TEXT_NODE) return n.nodeValue;
    if (n.nodeType !== Node.ELEMENT_NODE) return "";
    if (n.classList.contains(CLS)) return n.dataset.nruOriginal || "";
    if (SKIP_TAGS.has(n.nodeName.toUpperCase())) return "";
    let s = "";
    for (const c of n.childNodes) s += originalText(c);
    return s;
  }

  function neighbourText(node, forward) {
    let n = node, s = "";
    while (s.length < CONTEXT_CHARS) {
      let sib = forward ? n.nextSibling : n.previousSibling;
      while (!sib) {
        n = n.parentElement;
        if (!n || !INLINE.has(n.nodeName.toUpperCase())) return s;
        sib = forward ? n.nextSibling : n.previousSibling;
      }
      const t = originalText(sib);
      s = forward ? s + t : t + s;
      n = sib;
    }
    return forward ? s.slice(0, CONTEXT_CHARS) : s.slice(-CONTEXT_CHARS);
  }

  function convertTextNode(node) {
    const text = node.nodeValue;
    if (!text || !MAYBE.test(text)) return 0;
    const parent = node.parentElement;
    if (!parent || insideSkipped(parent)) return 0;

    const conversions = NRU.findConversions(text, {
      before: neighbourText(node, false),
      after: neighbourText(node, true),
    });
    if (!conversions.length) return 0;

    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const c of conversions) {
      if (c.start > pos) frag.append(text.slice(pos, c.start));
      const span = document.createElement("span");
      span.className = CLS;
      span.textContent = c.converted;
      span.dataset.nruOriginal = c.original;
      span.dataset.nruRate = c.rate;
      frag.append(span);
      pos = c.end;
    }
    if (pos < text.length) frag.append(text.slice(pos));
    node.replaceWith(frag);
    return conversions.length;
  }

  function scan(root) {
    if (root.nodeType === Node.TEXT_NODE) return convertTextNode(root);
    if (root.nodeType !== Node.ELEMENT_NODE || insideSkipped(root)) return 0;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (MAYBE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let count = 0;
    for (const n of nodes) count += convertTextNode(n);
    return count;
  }

  // ---- undo: put the original text back (used when settings change)
  function revertAll() {
    const parents = new Set();
    for (const span of document.querySelectorAll("." + CLS)) {
      parents.add(span.parentNode);
      span.replaceWith(document.createTextNode(span.dataset.nruOriginal || span.textContent));
    }
    for (const p of parents) if (p) p.normalize(); // re-join the split text nodes
    observer.takeRecords();
  }

  // ---- toolbar badge with the number of converted values
  let lastReported = -1;
  function reportCount() {
    const n = active ? document.querySelectorAll("." + CLS).length : 0;
    if (n === lastReported) return;
    lastReported = n;
    try {
      if (globalThis.chrome && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({ type: "nru-count", count: n });
      }
    } catch (_) { /* extension was reloaded */ }
  }

  // ---- dynamic content (infinite scroll, SPAs, lazy-loaded comments, …)
  const pending = new Set();
  let timer = null;

  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") pending.add(r.target);
      else for (const n of r.addedNodes) pending.add(n);
    }
    if (!timer) timer = setTimeout(flush, 250);
  });

  function flush() {
    timer = null;
    const nodes = [...pending];
    pending.clear();
    if (!active) return;
    for (const n of nodes) if (n.isConnected) scan(n);
    observer.takeRecords(); // ignore the mutations we just caused ourselves
    reportCount();
  }

  // ---- settings
  const Settings = globalThis.NruSettings;
  let active = false;
  let lastKey = null;

  function apply(s) {
    const on = Settings.siteEnabled(s, location.hostname);
    document.documentElement.classList.toggle("nru-plain", !s.highlight);
    // only the conversion-affecting settings require a re-scan
    const key = JSON.stringify([on, s.volume, s.dims]);
    if (key === lastKey) return;
    lastKey = key;

    NRU.setOptions({ volume: s.volume, dims: s.dims });
    if (active) revertAll();
    active = on;
    if (on) {
      const n = scan(document.body);
      observer.takeRecords();
      console.log(`[nonretarded-units] converted ${n} value(s) on ${location.href}`);
    }
    if (!on && globalThis.__nruBubble) globalThis.__nruBubble.hide();
    reportCount();
  }

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  Settings.load().then(apply);
  Settings.onChange(apply);
})();
