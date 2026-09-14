import assert from "node:assert/strict";
import test from "node:test";
import { assertF1Score } from "./f1-row-policy.js";

const failed = { label: "held-out/example", status: "fail" as const, pctAAMasked: 7 };
test("F1 accepts scored passes and font residuals only with green masked geometry", () => {
  assert.doesNotThrow(() => assertF1Score({ ...failed, status: "pass", pctAAMasked: 0 }));
  for (const cause of ["font-substrate", "font-metrics"]) {
    assert.doesNotThrow(() => assertF1Score({ ...failed, glyphMasked: 0 }, { class: cause }));
    assert.doesNotThrow(() => assertF1Score({ ...failed, glyphMasked: 5 }, { class: cause }));
    for (const glyphMasked of [undefined, null, NaN, 5.01]) {
      assert.throws(() => assertF1Score({ ...failed, glyphMasked }, { class: cause }), /glyph-masked pass is not green/, `${cause}: ${glyphMasked} must not be excused`);
    }
  }
});
test("F1 refuses unnamed and non-font failures instead of treating them as passes", () => {
  assert.throws(() => assertF1Score(failed), /not named/);
  assert.throws(() => assertF1Score({ ...failed, glyphMasked: 0 }, { class: "layout" }), /non-font cause/);
});
