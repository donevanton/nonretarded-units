// nonretarded-units — hover bubble.
// Shows the original value, the conversion rate and an icon that opens the
// extension page, above any highlighted value (or below if there's no room).
// Lives in a shadow root so page CSS can't break it and it can't break the page.
(() => {
  "use strict";
  if (globalThis.__nruBubbleLoaded) return;
  globalThis.__nruBubbleLoaded = true;

  const SELECTOR = ".nru-conv";
  const GAP = 8;      // px between value and bubble
  const MARGIN = 8;   // px from viewport edges
  const HIDE_DELAY = 250;

  // portrait from src/face-icon.js; fall back to a ruler glyph if it's missing
  const ICON = globalThis.__nruFaceIcon
    ? `<img src="${globalThis.__nruFaceIcon}" width="22" height="22" alt="">`
    : `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <rect x="2.5" y="7" width="19" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>
        <path d="M6.5 7v4M10 7v2.5M13.5 7v4M17 7v2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`;

  const STYLE = `
    :host { all: initial; }
    .b {
      position: relative;
      display: flex; align-items: center; gap: 10px;
      max-width: 320px;
      padding: 7px 8px 7px 11px;
      background: #1f2328; color: #f0f3f6;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06);
      font: 13px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      animation: in .12s ease-out;
    }
    @keyframes in { from { opacity: 0; transform: translateY(3px); } }
    .below { animation-name: in-below; }
    @keyframes in-below { from { opacity: 0; transform: translateY(-3px); } }
    .txt { min-width: 0; }
    .orig { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rate { color: #9da7b3; font-size: 11.5px; }
    button {
      all: unset; cursor: pointer;
      display: grid; place-items: center;
      width: 26px; height: 26px; flex: none;
      border-radius: 6px;
      color: #ffc400;
      border-left: 1px solid rgba(255,255,255,.12);
      border-radius: 0 6px 6px 0;
    }
    button:hover { background: rgba(255,196,0,.15); }
    button img {
      display: block; width: 22px; height: 22px;
      border-radius: 50%;
      box-shadow: 0 0 0 1.5px #ffc400;
      transition: transform .12s ease;
    }
    button:hover img { transform: scale(1.12); }
    button:focus-visible { outline: 2px solid #ffc400; outline-offset: 1px; }
    .arrow {
      position: absolute; width: 10px; height: 10px;
      background: #1f2328; transform: rotate(45deg);
      bottom: -5px;
    }
    .below .arrow { bottom: auto; top: -5px; }
  `;

  // ---- build (once, lazily)
  let host, box, origEl, rateEl, arrowEl, current = null, hideTimer = null;

  function build() {
    host = document.createElement("nru-bubble");
    host.style.cssText = "all:initial;position:fixed;top:0;left:0;z-index:2147483647;display:none;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${STYLE}</style>
      <div class="b" role="tooltip">
        <div class="txt"><div class="orig"></div><div class="rate"></div></div>
        <button type="button" title="nonretarded-units settings" aria-label="Open nonretarded-units settings">${ICON}</button>
        <div class="arrow"></div>
      </div>`;
    box = root.querySelector(".b");
    origEl = root.querySelector(".orig");
    rateEl = root.querySelector(".rate");
    arrowEl = root.querySelector(".arrow");

    root.querySelector("button").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openOptions();
      hide();
    });
    host.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    host.addEventListener("mouseleave", scheduleHide);
    document.documentElement.append(host);
  }

  function openOptions() {
    try {
      if (globalThis.chrome && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({ type: "nru-open-options" });
        return;
      }
    } catch (_) { /* extension was reloaded; this page has a stale script */ }
    console.log("[nonretarded-units] settings page is only available when running as the extension");
  }

  // ---- show / hide
  function show(span) {
    if (!host || !host.isConnected) build();
    clearTimeout(hideTimer);
    current = span;
    origEl.textContent = span.dataset.nruOriginal;
    rateEl.textContent = span.dataset.nruRate;

    // render invisibly first so we can measure it
    host.style.visibility = "hidden";
    host.style.display = "block";
    box.classList.remove("below");
    box.style.animation = "none";

    const r = span.getBoundingClientRect();
    const w = host.offsetWidth, h = host.offsetHeight;
    const vw = document.documentElement.clientWidth;

    const centerX = r.left + r.width / 2;
    const left = Math.max(MARGIN, Math.min(centerX - w / 2, vw - w - MARGIN));
    let top = r.top - h - GAP;
    const below = top < MARGIN;
    if (below) top = r.bottom + GAP;

    host.style.left = `${Math.round(left)}px`;
    host.style.top = `${Math.round(top)}px`;
    box.classList.toggle("below", below);
    arrowEl.style.left = `${Math.round(Math.max(10, Math.min(centerX - left, w - 10)) - 5)}px`;

    void box.offsetWidth; // restart the fade-in animation
    box.style.animation = "";
    host.style.visibility = "visible";
  }

  function hide() {
    clearTimeout(hideTimer);
    current = null;
    if (host) host.style.display = "none";
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, HIDE_DELAY);
  }

  // ---- events (delegated, so they cover values converted later too)
  const spanOf = (t) => (t instanceof Element ? t.closest(SELECTOR) : null);

  document.addEventListener("mouseover", (e) => {
    const span = spanOf(e.target);
    if (!span) return;
    clearTimeout(hideTimer);
    if (span !== current) show(span);
  });
  document.addEventListener("mouseout", (e) => {
    const span = spanOf(e.target);
    if (span && !span.contains(e.relatedTarget)) scheduleHide();
  });
  // a fixed-position bubble would drift away from its value while scrolling
  window.addEventListener("scroll", () => current && hide(), { capture: true, passive: true });
  window.addEventListener("resize", () => current && hide());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });

  globalThis.__nruBubble = { show, hide }; // for tests
})();
