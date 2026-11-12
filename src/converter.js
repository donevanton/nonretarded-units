// nonretarded-units — conversion engine.
// Pure text in, conversions out. No DOM access, so it can be unit-tested in Node.
//
//   findConversions("a 5 ft pole") ->
//     [{ start: 2, end: 6, original: "5 ft", converted: "1.5 m", rate: "1 ft = 0.3048 m", dim: "length" }]
//
// Precision rule: "exact when short". If the exact metric value fits in 4
// significant digits it is shown in full (4 in -> 10.16 cm, 5 ft -> 1.524 m).
// Otherwise the output keeps the same number of significant figures as the
// input (minimum 2). Integers with trailing zeros ("250", "100") are ambiguous, so
// they get up to 3 significant figures. Fractions ("1 1/2", "½") count as 3.
// One extra digit is added when the conversion crosses a power of ten and the
// result would otherwise be much coarser (65 mph -> 105 km/h, not 100 km/h).
// Temperature is the exception: because °F -> °C has an offset, it keeps the
// input's number of decimal places instead (72 °F -> 22 °C, 98.6 °F -> 37.0 °C).

(function (root) {
  "use strict";

  // ---------------------------------------------------------------- units

  // Target ladders: [symbol, size in base unit], largest first.
  // The first rung where |value| >= 1 is used.
  const LADDERS = {
    length: [["km", 1000], ["m", 1], ["cm", 0.01], ["mm", 0.001]],
    mass: [["kg", 1], ["g", 0.001]],
    volume: [["L", 1], ["mL", 0.001]],
    area: [["km²", 1e6], ["ha", 1e4], ["m²", 1], ["cm²", 1e-4]],
    speed: [["km/h", 1]],
  };

  // Order matters: longer / more specific patterns first (area before length,
  // "fl oz" before "oz", "miles per hour" before "miles").
  // toBase: how many base units (m, kg, L, m², km/h) one of this unit is.
  // fixed: always use this target symbol instead of auto-picking from the ladder.
  const UNITS = [
    // area
    { id: "sqin", dim: "area", toBase: 0.00064516, rate: "1 sq in = 6.452 cm²",
      re: "sq\\.?\\s*in(?:ch(?:es)?)?\\.?|square\\s+inch(?:es)?|in²|in\\^2" },
    { id: "sqft", dim: "area", toBase: 0.09290304, rate: "1 sq ft = 0.0929 m²",
      re: "sq\\.?\\s*f(?:ee)?t\\.?|square\\s+f(?:oo|ee)t|ft²|ft\\^2" },
    { id: "sqyd", dim: "area", toBase: 0.83612736, rate: "1 sq yd = 0.8361 m²",
      re: "sq\\.?\\s*y(?:ar)?ds?\\.?|square\\s+yards?|yd²" },
    { id: "sqmi", dim: "area", toBase: 2589988.110336, rate: "1 sq mi = 2.590 km²", fixed: "km²",
      re: "sq\\.?\\s*mi(?:les?)?\\.?|square\\s+miles?|mi²" },
    { id: "acre", dim: "area", toBase: 4046.8564224, rate: "1 acre = 0.4047 ha", fixed: "ha",
      re: "acres?" },

    // speed
    { id: "mph", dim: "speed", toBase: 1.609344, rate: "1 mph = 1.609 km/h", fixed: "km/h",
      re: "mph|miles?\\s+(?:per|an)\\s+hour|mi\\/h" },

    // temperature
    { id: "degF", dim: "temp", rate: "°C = (°F − 32) × 5/9",
      re: "°\\s?F|º\\s?F|℉|degrees?\\s+(?:fahrenheit|F)|deg\\.?\\s?F" },

    // volume (US customary)
    { id: "floz", dim: "volume", toBase: 0.0295735295625, rate: "1 fl oz = 29.57 mL",
      uk: { toBase: 0.0284130625, rate: "1 UK fl oz = 28.41 mL" },
      re: "fl\\.?\\s*oz\\.?|fluid\\s+ounces?" },
    { id: "cup", dim: "volume", toBase: 0.2365882365, rate: "1 cup = 236.6 mL",
      re: "cups?" },
    { id: "pint", dim: "volume", toBase: 0.473176473, rate: "1 pint = 473.2 mL",
      uk: { toBase: 0.56826125, rate: "1 UK pint = 568.3 mL" },
      re: "pints?" },
    { id: "quart", dim: "volume", toBase: 0.946352946, rate: "1 qt = 946.4 mL",
      uk: { toBase: 1.1365225, rate: "1 UK qt = 1.137 L" },
      re: "quarts?|qts?\\.?" },
    { id: "gal", dim: "volume", toBase: 3.785411784, rate: "1 gal = 3.785 L",
      uk: { toBase: 4.54609, rate: "1 UK gal = 4.546 L" },
      re: "gallons?|gal\\.?" },

    // mass
    { id: "oz", dim: "mass", toBase: 0.028349523125, rate: "1 oz = 28.35 g",
      re: "ounces?|oz\\.?" },
    { id: "lb", dim: "mass", toBase: 0.45359237, rate: "1 lb = 0.4536 kg",
      re: "pounds?|lbs?\\.?" },

    // length
    { id: "in", dim: "length", toBase: 0.0254, rate: "1 in = 2.54 cm",
      // bare "in" is a common word, so only accept it when followed by
      // punctuation, end of text, or a dimension "x".
      re: "inch(?:es)?|in\\.|in(?=\\s*(?:$|[,;:)\\]]|[x×]))|″|”" },
    { id: "ft", dim: "length", toBase: 0.3048, rate: "1 ft = 0.3048 m",
      re: "feet|foot|ft\\.?|′" },
    { id: "yd", dim: "length", toBase: 0.9144, rate: "1 yd = 0.9144 m",
      re: "yards?|yds?\\.?" },
    { id: "mi", dim: "length", toBase: 1609.344, rate: "1 mi = 1.609 km", fixed: "km",
      re: "miles?|mi\\.?" },
  ];
  const UNIT_BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u]));

  // ---------------------------------------------------------------- options

  // volume: "us" | "uk" (imperial pints, quarts, gallons, fl oz)
  // dims: { length: true, mass: false, ... } — unit types to convert
  let OPTS = { volume: "us", dims: null };
  function setOptions(o) { OPTS = { ...OPTS, ...o }; }

  const variant = (u) => (OPTS.volume === "uk" && u.uk) || u;
  const toBaseOf = (u) => variant(u).toBase;
  const rateOf = (u) => variant(u).rate;
  for (const u of UNITS) u.anchored = new RegExp(`^(?:${u.re})$`, "i");

  // ---------------------------------------------------------------- numbers

  const FRACTION_CHARS = { "½": 1 / 2, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 1 / 4, "¾": 3 / 4,
    "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8 };
  const FR = "[½⅓⅔¼¾⅛⅜⅝⅞]";
  const SIGN = "[-−]?";
  const NUM =
    "(?:\\d+\\s+\\d+\\/\\d+" +                     // 1 1/2
    "|\\d+\\/\\d+" +                                // 3/4
    "|\\d*" + FR +                                  // 1½, ½
    "|(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?" +  // 1,234.5 / 12 / 12.5
    "|\\.\\d+)";                                    // .5
  const SNUM = SIGN + NUM;
  // range / dimension separator: 5-10, 5–10, 5 to 10, 10 x 12, 10 by 12
  const SEP = "(?:\\s*[-–—x×]\\s*|\\s+(?:to|by)\\s+)";
  // a number must not be glued to a preceding word, number, or decimal point
  const LEAD = "(?<![\\w.,/\\-−])";

  function parseNumber(raw) {
    let s = raw.trim().replace(/−/g, "-").replace(/,/g, "");
    let sign = 1;
    if (s.startsWith("-")) { sign = -1; s = s.slice(1); }
    let m;
    if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return sign * (+m[1] + m[2] / m[3]);
    if ((m = s.match(/^(\d+)\/(\d+)$/))) return sign * (m[1] / m[2]);
    if ((m = s.match(new RegExp(`^(\\d*)(${FR})$`)))) return sign * ((+m[1] || 0) + FRACTION_CHARS[m[2]]);
    return sign * parseFloat(s);
  }

  function isFraction(raw) {
    return /\/|[½⅓⅔¼¾⅛⅜⅝⅞]/.test(raw);
  }

  // Significant figures actually written in the input (at least 1).
  function rawSigFigs(raw) {
    if (isFraction(raw)) return 2;
    const s = raw.replace(/[,\s\-−]/g, "");
    let sf;
    if (s.includes(".")) {
      sf = s.replace(".", "").replace(/^0+/, "").length;
    } else {
      const d = s.replace(/^0+/, "");
      const trailing = (d.match(/0+$/) || [""])[0].length;
      sf = d.length - trailing;
      if (trailing > 0) sf = Math.max(sf, Math.min(d.length, 3));
    }
    return Math.max(1, sf);
  }

  function sigFigs(raw) {
    if (isFraction(raw)) return 3;
    return Math.max(2, rawSigFigs(raw));
  }

  // Relative size of the last significant digit, e.g. 65 (2 sf) -> 1/65.
  function relStep(x, sf) {
    if (x === 0) return Infinity;
    const mag = Math.floor(Math.log10(Math.abs(x)));
    return Math.pow(10, mag - sf + 1) / Math.abs(x);
  }

  // Same significant figures as the input, plus one when the conversion crosses
  // a power of ten and would otherwise be much coarser than the original
  // (65 mph -> 105 km/h, not 100 km/h).
  function outputSigFigs(raw, inValue, outValue) {
    const sf = sigFigs(raw);
    const tooCoarse = relStep(outValue, sf) > 3 * relStep(inValue, rawSigFigs(raw));
    return tooCoarse ? sf + 1 : sf;
  }

  function decimalPlaces(raw) {
    if (isFraction(raw)) return 1;
    const i = raw.indexOf(".");
    return i < 0 ? 0 : raw.length - i - 1;
  }

  function groupThousands(str) {
    const [int, frac] = str.split(".");
    const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return frac === undefined ? g : `${g}.${frac}`;
  }

  function formatSig(x, sf) {
    if (x === 0) return "0";
    // nudge away from zero so binary halves (6.35 -> 6.3499999) round up
    const r = Number((x * (1 + 1e-12)).toPrecision(sf));
    const mag = r === 0 ? 0 : Math.floor(Math.log10(Math.abs(r)));
    const dec = Math.min(20, Math.max(0, sf - 1 - mag));
    return groupThousands(r.toFixed(dec));
  }

  // If x is exactly representable with at most 4 significant digits
  // (4 in = 10.16 cm, 5 ft = 1.524 m), return it in full; otherwise null.
  const EXACT_MAX_SF = 4;
  function formatExact(x) {
    if (x === 0) return "0";
    const r = Number(x.toPrecision(EXACT_MAX_SF));
    if (Math.abs(r - x) > 1e-9 * Math.abs(x)) return null;
    let dec = 0;
    while (dec < 10 && Math.abs(Number(r.toFixed(dec)) - r) > 1e-9 * Math.abs(r)) dec++;
    return groupThousands(r.toFixed(dec));
  }

  // Precision rule: exact when short, otherwise significant figures.
  function formatValue(x, sf) {
    return formatExact(x) ?? formatSig(x, sf);
  }

  function formatFixed(x, dec) {
    let s = x.toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1); // no "-0"
    return groupThousands(s);
  }

  // ---------------------------------------------------------------- conversion

  function pickTarget(unit, maxAbsBase) {
    const ladder = LADDERS[unit.dim];
    if (unit.fixed) return ladder.find(([sym]) => sym === unit.fixed);
    return ladder.find(([, size]) => maxAbsBase / size >= 1) || ladder[ladder.length - 1];
  }

  function fToC(f) { return (f - 32) * 5 / 9; }

  // nums: raw number strings (1 for a single value, 2 for a range/dimension)
  function convertValues(unit, nums, sep) {
    if (unit.dim === "temp") {
      const parts = nums.map((n) => formatFixed(fToC(parseNumber(n)), decimalPlaces(n)));
      return `${parts.join(sep || "")} °C`;
    }
    const bases = nums.map((n) => parseNumber(n) * toBaseOf(unit));
    const [sym, size] = pickTarget(unit, Math.max(...bases.map(Math.abs)));
    const outs = bases.map((b) => b / size);
    // in ranges/dimensions, only show exact values if *all* of them are exact,
    // so "10 x 12 ft" doesn't become "3.048 x 3.7 m"
    const exact = outs.map(formatExact);
    if (exact.every((e) => e !== null)) return `${exact.join(sep || "")} ${sym}`;
    const parts = nums.map((n, i) => formatSig(outs[i], outputSigFigs(n, parseNumber(n), outs[i])));
    return `${parts.join(sep || "")} ${sym}`;
  }

  // Compound like 5 ft 11 in / 5'11" / 6 lb 3 oz
  function convertCompound(big, small, bigRaw, smallRaw) {
    const base = parseNumber(bigRaw) * big.toBase + parseNumber(smallRaw) * small.toBase;
    const [sym, size] = pickTarget(big, Math.abs(base));
    const sf = decimalPlaces(smallRaw) > 0 ? 4 : 3;
    return `${formatValue(base / size, sf)} ${sym}`;
  }

  function unitFromText(text) {
    const t = text.trim();
    return UNITS.find((u) => u.anchored.test(t));
  }

  // ---------------------------------------------------------------- matchers

  const UNIT_ALT = UNITS.map((u) => u.re).join("|");

  // "a dozen", "half a dozen", "two dozen", "3 dozen", "a baker's dozen",
  // optionally followed by an imperial unit ("a dozen miles").
  // A quantifier is required so titles like "The Dirty Dozen" stay untouched.
  const DOZEN_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  const DOZEN_QTY = "a\\s+half|half\\s+a|half|" + Object.keys(DOZEN_WORDS).join("|") + "|\\d+(?:\\.\\d+)?";

  function dozenCount(qty, bakers) {
    const q = qty.toLowerCase().replace(/\s+/g, " ");
    const n = q.includes("half") ? 0.5 : (DOZEN_WORDS[q] ?? parseFloat(q));
    return n * (bakers ? 13 : 12);
  }

  const MATCHERS = [
    {
      re: new RegExp(`(?<![\\w.,])(${DOZEN_QTY})[\\s-]+(baker['’]?s\\s+)?dozen(?:\\s+(?:of\\s+)?(${UNIT_ALT}))?(?![\\w])`, "gi"),
      convert: (m) => {
        const count = dozenCount(m[1], m[2]);
        const dozenRate = m[2] ? "1 baker's dozen = 13" : "1 dozen = 12";
        const unit = m[3] && unitFromText(m[3]);
        if (!unit) return { converted: String(count), rate: dozenRate, dim: "count" };
        return { converted: convertValues(unit, [String(count)]), rate: `${dozenRate} · ${rateOf(unit)}`, dim: unit.dim };
      },
    },
    // Horse heights: 15.2 hands = 15 hands + 2 in (the digit after the point is
    // inches, 0–3). Bare "16 hands" is too ambiguous ("2 hands"), so integers
    // need "hh" or "hands high".   1 hand = 4 in = 10.16 cm exactly.
    {
      re: new RegExp(`${LEAD}(\\d{1,2})(?:\\.([0-3]))?\\s*(?:hh|h\\.h\\.|hands?\\s+(?:high|tall))(?![\\w])` +
                     `|${LEAD}(\\d{1,2})\\.([0-3])\\s*hands?(?![\\w])`, "gi"),
      convert: (m) => {
        const inches = (+(m[1] || m[3])) * 4 + (+(m[2] || m[4] || 0));
        return { converted: `${formatValue(inches * 2.54, 3)} cm`, rate: "1 hand = 4 in = 10.16 cm", dim: "length" };
      },
    },
    // 5 ft 11 in, 5 feet, 11 inches, 5-foot-11-inch
    {
      re: new RegExp(`${LEAD}(${SNUM})(?:\\s*|-)(?:feet|foot|ft\\.?)[\\s,-]*(?:and\\s+)?(${NUM})(?:\\s*|-)(?:inch(?:es)?|in\\.?|["″”])(?![\\w])`, "gi"),
      convert: (m) => ({
        converted: convertCompound(UNIT_BY_ID.ft, UNIT_BY_ID.in, m[1], m[2]),
        rate: "1 ft = 0.3048 m · 1 in = 2.54 cm", dim: "length" }),
    },
    // 5'11"  5′11″  5’11”  5'11''
    {
      re: new RegExp(`${LEAD}(\\d+)\\s*['′’]\\s*(${NUM})\\s*(?:"|″|”|''|’’)(?![\\w])`, "g"),
      convert: (m) => ({
        converted: convertCompound(UNIT_BY_ID.ft, UNIT_BY_ID.in, m[1], m[2]),
        rate: "1 ft = 0.3048 m · 1 in = 2.54 cm", dim: "length" }),
    },
    // 6 lb 3 oz
    {
      re: new RegExp(`${LEAD}(${SNUM})\\s*(?:pounds?|lbs?\\.?)[\\s,]*(?:and\\s+)?(${NUM})\\s*(?:ounces?|oz\\.?)(?![\\w])`, "gi"),
      convert: (m) => ({
        converted: convertCompound(UNIT_BY_ID.lb, UNIT_BY_ID.oz, m[1], m[2]),
        rate: "1 lb = 0.4536 kg · 1 oz = 28.35 g", dim: "mass" }),
    },
    // single values and ranges: 5 ft, 5-10 miles, 10 x 12 ft, 72°F, 10-foot
    {
      re: new RegExp(`${LEAD}(${SNUM})(?:(${SEP})(${SNUM}))?(?:\\s*|-)(${UNIT_ALT})(?![\\w])`, "gi"),
      convert: (m) => {
        const unit = unitFromText(m[4]);
        if (!unit) return null;
        const nums = m[3] ? [m[1], m[3]] : [m[1]];
        return { converted: convertValues(unit, nums, m[2]), rate: rateOf(unit), dim: unit.dim };
      },
    },
    // 9 x 13 in pan — after a range/dimension, bare "in" is unambiguous
    {
      re: new RegExp(`${LEAD}(${SNUM})(${SEP})(${SNUM})\\s*in(?![\\w])`, "gi"),
      convert: (m) => ({
        converted: convertValues(UNIT_BY_ID.in, [m[1], m[3]], m[2]),
        rate: UNIT_BY_ID.in.rate, dim: "length" }),
    },
    // 27" monitor, 55" TV — straight double quote is ambiguous, so require
    // a following word or dimension "x" to treat it as inches
    {
      re: new RegExp(`${LEAD}(${NUM})(?:(${SEP})(${NUM}))?\\s?"(?=\\s*(?:[A-Za-z]|[x×]\\s*\\d))`, "g"),
      convert: (m) => {
        const nums = m[3] ? [m[1], m[3]] : [m[1]];
        return { converted: convertValues(UNIT_BY_ID.in, nums, m[2]), rate: UNIT_BY_ID.in.rate, dim: "length" };
      },
    },
  ];

  // Already has a metric value next to it: "5 ft (1.5 m)" or "1.5 m (5 ft)"
  const METRIC_UNIT = "(?:mm|cm|m|km|g|kg|t|ml|mL|cl|dl|l|L|°\\s?C|ºC|℃|km\\/h|kph|ha|m²|m2|cm²|km²)";
  const METRIC_AFTER = new RegExp(`^\\s*[(\\[/]\\s*(?:~|≈|about|approx\\.?|ca\\.?)?\\s*[-−]?[\\d.,]+\\s*${METRIC_UNIT}(?![\\w])`, "i");
  // "1.5 m (5 ft)", "1.5 m / 5 ft", "(1,500 m) 4,921 ft"
  const METRIC_BEFORE = new RegExp(`\\d\\s*${METRIC_UNIT}\\.?\\s*(?:[(\\[/]|[)\\]])\\s*$`, "i");

  // ---------------------------------------------------------------- public API

  // ctx.before / ctx.after: text that surrounds `text` on the page but lives in
  // other DOM nodes, e.g. Wikipedia's  "4 in" + "(101.6 mm)". It is only used to
  // decide whether something matches; returned positions are relative to `text`.
  function findConversions(text, ctx = {}) {
    const before = ctx.before || "";
    const after = ctx.after || "";
    const full = before + text + after;
    const lo = before.length, hi = before.length + text.length;

    const found = [];
    for (const matcher of MATCHERS) {
      matcher.re.lastIndex = 0;
      let m;
      while ((m = matcher.re.exec(full))) {
        if (m.index < lo || m.index >= hi) continue;
        const res = matcher.convert(m);
        if (!res) continue;
        let original = m[0];
        // "climbs 1,200 ft. Then…" — the period ends the sentence, keep it in the text
        if (original.endsWith(".") && /^(?:\s*$|\s+[A-Z])/.test(full.slice(m.index + original.length))) {
          original = original.slice(0, -1);
        }
        if (m.index + original.length > hi) continue; // spans into another node
        found.push({ start: m.index, end: m.index + original.length, original, ...res });
      }
    }
    // earliest first, longest first; drop anything overlapping an accepted match
    found.sort((a, b) => a.start - b.start || b.end - a.end);
    const out = [];
    let lastEnd = -1;
    for (const f of found) {
      if (OPTS.dims && OPTS.dims[f.dim] === false) continue;
      if (f.start < lastEnd) continue;
      if (METRIC_AFTER.test(full.slice(f.end)) || METRIC_BEFORE.test(full.slice(0, f.start))) continue;
      out.push({ ...f, start: f.start - lo, end: f.end - lo });
      lastEnd = f.end;
    }
    return out;
  }

  // Convenience: return text with all conversions applied.
  function convertText(text) {
    let result = "";
    let pos = 0;
    for (const c of findConversions(text)) {
      result += text.slice(pos, c.start) + c.converted;
      pos = c.end;
    }
    return result + text.slice(pos);
  }

  const api = { findConversions, convertText, setOptions, sigFigs, formatSig };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NonretardedUnits = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
