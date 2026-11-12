# Chrome Web Store listing: nonretarded-units

Copy each block into the matching field in the developer console
(https://chrome.google.com/webstore/devconsole).

---

## Package tab

Upload `dist/nonretarded-units-<version>.zip`. Build it with:

```
powershell -ExecutionPolicy Bypass -File tools\package.ps1
```

Bump `version` in `manifest.json` before every new upload; the store rejects a version it has already seen.

---

## Store listing tab

**Name** (taken from manifest.json)

```
nonretarded-units
```

**Summary** (max 132 characters; this one is 117)

```
Converts imperial units on any web page to metric at the same precision. Hover a converted value to see the original.
```

**Category:** Tools
**Language:** English

**Description**

```
Reading a recipe, a spec sheet or a weather report written in feet, ounces and Fahrenheit? nonretarded-units quietly rewrites them in metric as you browse.

WHAT IT DOES
• Finds imperial values on any page and replaces them with metric: 5 ft → 1.524 m, 12 oz → 340 g, 72°F → 22 °C, 65 mph → 105 km/h
• Highlights every converted value so you know what changed
• Hover a value to see the original text, the conversion rate, and a shortcut to the settings
• Works on pages that load content as you scroll

SAME PRECISION, NOT FAKE PRECISION
• Exact when the result is short: 4 in → 10.16 cm
• Otherwise keeps the original's significant figures: 3 miles → 4.8 km, not 4.828032 km
• Temperatures keep their decimal places: 98.6°F → 37.0 °C
• Leaves values alone when the page already shows metric, like "5 ft (1.5 m)"

UNDERSTANDS REAL-WORLD WRITING
• Heights: 5'11", 5 ft 11 in, 6 feet 2 inches
• Weights: 7 lb 4 oz
• Ranges and dimensions: 5–10 miles, 10 x 12 ft, 9 x 13 in pan
• Fractions: 1 ½ cups, ¾ cup
• Hyphenated adjectives: a 10-foot ladder
• Horse heights: 15.2 hands → 157 cm
• Dozens: a dozen eggs → 12 eggs

UNITS
Length (in, ft, yd, mi, hands) · Weight (oz, lb) · Volume (fl oz, cups, pints, quarts, gallons; US or UK) · Temperature (°F) · Speed (mph) · Area (sq in, sq ft, sq yd, sq mi, acres)

YOUR CONTROL
• Turn it off on any site from the toolbar button
• Choose which unit types to convert
• Switch between US and UK pints and gallons
• Turn the highlight off if you just want the numbers

PRIVATE BY DESIGN
Everything happens on your device. No data is collected, nothing is sent anywhere, no analytics, no ads. Settings sync only through your own Chrome account.

Open source: https://github.com/donevanton/nonretarded-units
```

**Graphics**

| Asset | Size | File |
|---|---|---|
| Store icon | 128×128 | `icons/icon128.png` |
| Small promo tile (required) | 440×280 | `store/promo-440x280.png` |
| Screenshots (1 required, up to 5) | 1280×800 or 640×400 | Take on `tests/demo.html` with the extension loaded and a value hovered |

---

## Privacy tab

**Single purpose description**

```
Converts imperial measurements (feet, pounds, Fahrenheit, miles, etc.) shown on web pages into metric units, highlighting each converted value and showing the original on hover.
```

**Permission justification: storage**

```
Saves the user's settings: on/off, sites where the extension is turned off, US or UK volume units, which unit types to convert, and whether to highlight converted values. Settings are stored with chrome.storage.sync and never leave the user's Chrome account.
```

**Permission justification: activeTab**

```
Lets the toolbar popup read the hostname of the current tab when the user clicks the extension button, so the user can turn the extension off for that specific site. It is used only when the user opens the popup.
```

**Permission justification: host permissions (content script on all URLs)**

```
Imperial measurements can appear on any website (recipes, news, shops, forums, Wikipedia), so the content script must run on all pages to find and convert them. It only reads and rewrites visible text inside the page. It never sends page content anywhere, makes no network requests, and does not run on pages the user has turned it off for.
```

**Remote code:** No, I am not using remote code.
(All JavaScript ships in the package; there is no eval, no remote scripts, no CDN.)

**Data usage:** tick **none** of the data categories. The extension collects no user data.

Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** not required when no user data is collected. If the form insists, use:
`https://github.com/donevanton/nonretarded-units#privacy`

---

## Distribution tab

- **Visibility:** Public (or Unlisted to test with a link first)
- **Regions:** All regions
- **Pricing:** Free
