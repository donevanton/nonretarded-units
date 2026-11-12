<img src="icons/icon128.png" width="96" align="right" alt="">

The Mars Climate Orbiter was a robotic space probe launched by NASA on December 11, 1998, to study the Martian climate, atmosphere, and surface changes, and to serve as a communications relay for the Mars Polar Lander.

Mission Failure

• Date of loss: September 23, 1999
• Cost: $125 million
• Root cause: A critical unit conversion error where spacecraft builder Lockheed Martin supplied thruster force data in US customary (imperial) units (pound-force seconds), while NASA's Jet Propulsion Laboratory navigation software expected metric units (Newton-seconds).
• Result: Because the calculations were off by a factor of 4.45, the probe entered the Martian atmosphere at an altitude of about 57 km instead of the planned 140–150 km, causing it to burn up or break apart in the atmosphere.

# nonretarded-units

A Chrome extension that finds imperial units on web pages and replaces them with metric, at the same precision. Converted values are highlighted; hover one to see the original, the conversion rate, and a link to the settings.

| On the page | Becomes |
|---|---|
| `4 in` | 10.16 cm |
| `5'11"` | 1.80 m |
| `12 oz` | 340 g |
| `65 mph` | 105 km/h |
| `98.6°F` | 37.0 °C |
| `10 x 12 ft` | 3.0 x 3.7 m |
| `1 1/2 cups` | 355 mL |
| `15.2 hands` | 157 cm |
| `a dozen eggs` | 12 eggs |

## Install (developer mode)

1. Clone or download this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the repo folder.

## Precision

- **Exact when short:** if the exact metric value fits in 4 significant digits, it's shown in full (`5 ft` → 1.524 m).
- **Otherwise:** the input's significant figures are kept (`3 miles` → 4.8 km), with one extra digit when a conversion crosses a power of ten (`65 mph` → 105 km/h, not 100).
- **Temperature** keeps the input's decimal places (`72°F` → 22 °C).
- Values that already have metric next to them (`5 ft (1.5 m)`) are left alone.

## Supported units

Length (in, ft, yd, mi, hands), weight (oz, lb), volume (fl oz, cups, pints, quarts, gallons; US or UK), temperature (°F), speed (mph), area (sq in/ft/yd/mi, acres), and dozens. Each type can be turned off in the settings, as can individual sites.

## Development

```
node --test tests/        # converter unit tests
```

Open `tests/demo.html` in a browser to try the content script without installing the extension.

| File | Purpose |
|---|---|
| `src/converter.js` | Finds and converts values in plain text (no DOM) |
| `src/content.js` | Scans the page, replaces values, watches for new content |
| `src/bubble.js` | Hover bubble |
| `src/settings.js` | Settings shared by all parts |
| `src/popup.*`, `src/options.*` | Toolbar popup and settings page |
| `src/background.js` | Opens the settings page, sets the toolbar badge |

## Privacy

nonretarded-units collects no data. All conversion happens locally in your browser; the extension makes no network requests. Your settings are stored with `chrome.storage.sync`, which only syncs through your own Chrome account.

## Publishing

```
powershell -ExecutionPolicy Bypass -File tools\package.ps1      # -> dist/nonretarded-units-<version>.zip
powershell -ExecutionPolicy Bypass -File tools\promo-tile.ps1   # -> store/promo-440x280.png
```

Copy-paste text for every Web Store field is in [store/listing.md](store/listing.md).

## License

[CC0 1.0](LICENSE): public domain.
