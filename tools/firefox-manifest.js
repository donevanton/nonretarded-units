// Prints the Firefox manifest, derived from the Chrome manifest.json.
// Used by tools/package.ps1:  node tools/firefox-manifest.js > dist/firefox/manifest.json
const fs = require("fs");
const path = require("path");

const m = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));

// Firefox runs MV3 background scripts as an event page, not a service worker
m.background = { scripts: ["src/background.js"] };

// In Firefox MV3, content-script matches don't grant host access by themselves
m.host_permissions = ["<all_urls>"];

m.browser_specific_settings = {
  gecko: {
    id: "nonretarded-units@donevanton",
    strict_min_version: "140.0",
    // required for new add-ons on addons.mozilla.org: we collect nothing
    data_collection_permissions: { required: ["none"] },
  },
  gecko_android: { strict_min_version: "142.0" },
};

process.stdout.write(JSON.stringify(m, null, 2) + "\n");
