// nonretarded-units — options page. Every change saves immediately.
(async () => {
  "use strict";
  const S = globalThis.NruSettings;
  const $ = (id) => document.getElementById(id);
  let s = await S.load();

  // build unit-type checkboxes
  for (const [dim, label] of Object.entries(S.DIMS)) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<label class="opt"><input type="checkbox" class="box"><span></span></label>`;
    row.querySelector("span").textContent = label;
    row.querySelector("input").dataset.dim = dim;
    $("dims").append(row);
  }

  let toastTimer;
  function toast(msg = "Saved") {
    $("toast").textContent = msg;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 1200);
  }

  async function save(patch) {
    Object.assign(s, patch);
    await S.save(patch);
    toast();
  }

  function render() {
    $("enabled").checked = s.enabled;
    $("highlight").checked = s.highlight;
    for (const r of document.querySelectorAll("input[name=volume]")) r.checked = r.value === s.volume;
    for (const c of document.querySelectorAll("#dims input")) c.checked = s.dims[c.dataset.dim] !== false;

    const list = $("sites");
    list.textContent = "";
    for (const host of s.disabledSites) {
      const row = document.createElement("div");
      row.className = "site";
      const name = document.createElement("span");
      name.textContent = host;
      const btn = document.createElement("button");
      btn.textContent = "Remove";
      btn.addEventListener("click", () => save({ disabledSites: s.disabledSites.filter((h) => h !== host) }).then(render));
      row.append(name, btn);
      list.append(row);
    }
  }
  render();

  $("enabled").addEventListener("change", (e) => save({ enabled: e.target.checked }));
  $("highlight").addEventListener("change", (e) => save({ highlight: e.target.checked }));
  for (const r of document.querySelectorAll("input[name=volume]")) {
    r.addEventListener("change", (e) => save({ volume: e.target.value }));
  }
  $("dims").addEventListener("change", (e) => {
    const dim = e.target.dataset.dim;
    if (dim) save({ dims: { ...s.dims, [dim]: e.target.checked } });
  });

  $("add").addEventListener("submit", (e) => {
    e.preventDefault();
    let v = $("newSite").value.trim();
    if (!v) return;
    try { v = new URL(v.includes("://") ? v : `https://${v}`).hostname; } catch (_) { toast("Not a valid site"); return; }
    const host = S.normalizeHost(v);
    $("newSite").value = "";
    if (s.disabledSites.includes(host)) return;
    save({ disabledSites: [...s.disabledSites, host].sort() }).then(render);
  });

  // stay in sync with changes made from the toolbar popup
  S.onChange((next) => { s = next; render(); });
})();
