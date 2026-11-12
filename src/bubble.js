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

    // built with DOM calls rather than innerHTML (store reviewers flag innerHTML)
    const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
    const style = el("style");
    style.textContent = STYLE;
    box = el("div", "b");
    box.setAttribute("role", "tooltip");
    const txt = el("div", "txt");
    origEl = el("div", "orig");
    rateEl = el("div", "rate");
    txt.append(origEl, rateEl);

    const button = el("button");
    button.type = "button";
    button.title = "nonretarded-units settings";
    button.setAttribute("aria-label", "Open nonretarded-units settings");
    if (globalThis.__nruFaceIcon) {      // portrait from src/face-icon.js
      const img = el("img");
      img.src = globalThis.__nruFaceIcon;
      img.width = img.height = 22;
      img.alt = "";
      button.append(img);
    } else {
      button.textContent = "⚙";
    }

    arrowEl = el("div", "arrow");
    box.append(txt, button, arrowEl);
    root.append(style, box);

    button.addEventListener("click", (e) => {
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
    const Ext = globalThis.NruExt;
    if (Ext && Ext.api) { Ext.send({ type: "nru-open-options" }); return; }
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
