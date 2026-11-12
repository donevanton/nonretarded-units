// Run with:  node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const { convertText, findConversions, sigFigs } = require("../src/converter.js");

const cases = [
  // significant figures
  // exact when the exact value fits in 4 significant digits
  ["4 in", "10.16 cm"],
  ["5 ft", "1.524 m"],
  ["5.0 ft", "1.524 m"],
  ["5.00 ft", "1.524 m"],
  ["9.5 ft", "2.90 m"],
  ["12 oz", "340 g"],
  ["250 lb", "113 kg"],
  ["100 ft", "30.48 m"],

  // otherwise same significant figures as the input
  ["6 ft", "1.8 m"],
  ["1 lb", "450 g"],
  ["0.5 mi", "0.80 km"],
  ["26.2 miles", "42.2 km"],

  // unit auto-scaling
  ["1 ft", "30.48 cm"],
  ["0.25 in", "6.35 mm"],
  ["0.3 in", "7.62 mm"],
  ["3 oz", "85 g"],
  ["27 inches", "68.58 cm"],
  ["10,000 ft", "3.048 km"],
  ["4,921 ft", "1.4999 km"],
  ["5,000 lb", "2,270 kg"],
  ["8 fl oz", "240 mL"],
  ["2 gallons", "7.6 L"],
  ["2,000 sq ft", "186 m²"],
  ["5 acres", "2.0 ha"],

  // temperature keeps decimal places
  ["72°F", "22 °C"],
  ["98.6 °F", "37.0 °C"],
  ["-40°F", "-40 °C"],
  ["32 degrees Fahrenheit", "0 °C"],

  // speed
  ["65 mph", "105 km/h"],     // +1 digit: 100 would lose precision
  ["30 miles per hour", "48 km/h"],

  // fractions
  ["1 1/2 cups", "355 mL"],
  ["½ cup", "118 mL"],

  // compounds
  [`5'11"`, "1.80 m"],
  ["5’11”", "1.80 m"],
  ["5 ft 11 in", "1.80 m"],
  ["6 feet 2 inches", "1.88 m"],
  ["7 lb 4 oz", "3.29 kg"],

  // ranges and dimensions
  ["5-10 ft", "1.524-3.048 m"],
  ["5 to 10 miles", "8.0 to 16 km"],
  ["10 x 12 ft", "3.0 x 3.7 m"],     // not all exact -> all rounded
  ["a 10-foot pole", "a 3.048 m pole"],
  ["a 9 x 13 in pan", "a 22.86 x 33.02 cm pan"],
  ["0 to 60 mph", "0 to 97 km/h"],

  // dozens
  ["a dozen eggs", "12 eggs"],
  ["A dozen roses", "12 roses"],
  ["half a dozen bagels", "6 bagels"],
  ["a half-dozen", "6"],
  ["two dozen cookies", "24 cookies"],
  ["3 dozen", "36"],
  ["1.5 dozen", "18"],
  ["a baker's dozen", "13"],
  ["a dozen miles", "19 km"],
  ["half a dozen inches", "15.24 cm"],

  // horse heights (1 hand = 4 in)
  ["a 15.2 hands mare", "a 157 cm mare"],
  ["16 hh", "163 cm"],
  ["14.3 hh", "150 cm"],
  ["16 hands high", "163 cm"],

  // inch symbol
  [`a 27" monitor`, "a 68.58 cm monitor"],

  // in context
  ["The trail is 3 miles long and climbs 1,200 ft.", "The trail is 4.8 km long and climbs 366 m."],
];

for (const [input, expected] of cases) {
  test(`converts: ${input}`, () => assert.equal(convertText(input), expected));
}

const untouched = [
  "I was born in 1990 in Ohio",
  "There are 5 in the box",
  "COVID-19 feet",                  // hyphenated after a word
  "5 ft (1.5 m)",                   // already has metric
  "1.5 m (5 ft)",
  "(1,500 m) 4,921 ft",
  `He said "I scored 27".`,
  "Rated 5 pt font",
  "a 10 cm board",
  "The Dirty Dozen",
  "dozens of people",
  "I have 2 hands",
  "a 16 hands team",
];
for (const input of untouched) {
  test(`leaves alone: ${input}`, () => assert.equal(convertText(input), input));
}

test("returns positions, original text and rate", () => {
  assert.deepEqual(findConversions("about 6 ft tall"), [
    { start: 6, end: 10, original: "6 ft", converted: "1.8 m", rate: "1 ft = 0.3048 m", dim: "length" },
  ]);
});

test("sigFigs", () => {
  assert.equal(sigFigs("5"), 2);
  assert.equal(sigFigs("5.0"), 2);
  assert.equal(sigFigs("1.234"), 4);
  assert.equal(sigFigs("0.05"), 2);
  assert.equal(sigFigs("250"), 3);
  assert.equal(sigFigs("12,000"), 3);
  assert.equal(sigFigs("12,345"), 5);
});

test("uses neighbouring text from other DOM nodes", () => {
  // Wikipedia: "4&nbsp;in" and "(101.6&nbsp;mm)" are separate nodes
  assert.deepEqual(findConversions("exactly 4 in", { after: " (101.6 mm)" }), []);
  assert.deepEqual(findConversions("5 ft", { before: "1.5 m (" }), []);
  // bare "in" at the end of a node is no longer accepted when a word follows elsewhere
  assert.deepEqual(findConversions("put 4 in", { after: " the box" }), []);
  // but a real value next to unrelated text still converts, with positions relative to the node
  const [c] = findConversions("is 6 ft", { before: "The pole ", after: " tall." });
  assert.equal(c.start, 3);
  assert.equal(c.converted, "1.8 m");
});
