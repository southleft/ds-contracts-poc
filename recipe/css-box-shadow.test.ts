import assert from "node:assert/strict";
import test from "node:test";

import { CssBoxShadowError, cssColorToHex8, parseCssBoxShadow } from "./css-box-shadow.js";

test("none and empty are no effects, not an error", () => {
  assert.deepEqual(parseCssBoxShadow("none"), []);
  assert.deepEqual(parseCssBoxShadow("  "), []);
});

test("MUI's elevation-1 thumb shadow parses to three drop shadows in paint order", () => {
  // Verbatim from extract/computed/out/mui/switch/captured-truth.json,
  // .MuiSwitch-thumb box-shadow.
  const layers = parseCssBoxShadow(
    "rgba(0, 0, 0, 0.2) 0px 2px 1px -1px, rgba(0, 0, 0, 0.14) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) 0px 1px 3px 0px",
  );
  assert.equal(layers.length, 3);
  assert.deepEqual(layers[0], {
    kind: "drop-shadow", offsetX: 0, offsetY: 2, blur: 1, spread: -1, color: "#00000033",
  });
  assert.deepEqual(layers[1], {
    kind: "drop-shadow", offsetX: 0, offsetY: 1, blur: 1, spread: 0, color: "#00000024",
  });
  assert.deepEqual(layers[2], {
    kind: "drop-shadow", offsetX: 0, offsetY: 1, blur: 3, spread: 0, color: "#0000001f",
  });
});

test("the colour may sit before or after the lengths", () => {
  const a = parseCssBoxShadow("0px 2px 4px rgba(0,0,0,0.5)")[0]!;
  const b = parseCssBoxShadow("rgba(0,0,0,0.5) 0px 2px 4px")[0]!;
  assert.deepEqual(a, b);
});

test("inset becomes an inner shadow", () => {
  assert.equal(parseCssBoxShadow("inset 0px 1px 2px #000")[0]!.kind, "inner-shadow");
  assert.equal(parseCssBoxShadow("0px 1px 2px #000")[0]!.kind, "drop-shadow");
});

test("commas inside rgba() do not split layers", () => {
  assert.equal(parseCssBoxShadow("rgba(1, 2, 3, 0.5) 0px 1px, rgba(4,5,6,1) 0px 2px").length, 2);
});

test("colour spellings resolve to #rrggbbaa", () => {
  assert.equal(cssColorToHex8("rgb(255, 0, 0)"), "#ff0000ff");
  assert.equal(cssColorToHex8("rgba(0, 0, 0, 0.2)"), "#00000033");
  assert.equal(cssColorToHex8("#abc"), "#aabbccff");
  assert.equal(cssColorToHex8("#11223344"), "#11223344");
});

test("what cannot be resolved is refused by name, not guessed", () => {
  assert.throws(() => parseCssBoxShadow("currentColor 0px 1px 2px"), CssBoxShadowError);
  assert.throws(() => parseCssBoxShadow("0px 1px 2px"), CssBoxShadowError);       // no colour
  assert.throws(() => parseCssBoxShadow("0 1px 2px #000"), CssBoxShadowError);     // unitless
  assert.throws(() => parseCssBoxShadow("0rem 1rem #000"), CssBoxShadowError);     // non-px
  assert.throws(() => cssColorToHex8("hsl(200 50% 50%)"), CssBoxShadowError);
});
