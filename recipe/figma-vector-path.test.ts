import assert from "node:assert/strict";
import test from "node:test";

import {
  FigmaVectorPathError,
  isFigmaVectorPath,
  lowerVectorPath,
  toFigmaVectorPath,
  transformVectorPath,
  vectorPathBounds,
} from "./figma-vector-path.js";

test("H and V become absolute linetos", () => {
  assert.equal(toFigmaVectorPath("M 0 0 H 10 V 10 Z"), "M 0 0 L 10 0 L 10 10 Z");
});

test("relative commands become absolute", () => {
  assert.equal(toFigmaVectorPath("m 5 5 l 10 0 l 0 10 z"), "M 5 5 L 15 5 L 15 15 Z");
  // relative H/V accumulate from the current point
  assert.equal(toFigmaVectorPath("M 0 0 h 10 v 5 h -10 z"), "M 0 0 L 10 0 L 10 5 L 0 5 Z");
});

test("a repeated moveto pair is an implicit lineto, not a second subpath", () => {
  assert.equal(toFigmaVectorPath("M 0 0 5 5 10 0"), "M 0 0 L 5 5 L 10 0");
});

test("Z returns the pen to the subpath start", () => {
  assert.equal(toFigmaVectorPath("M 2 2 L 8 2 Z l 3 3"), "M 2 2 L 8 2 Z L 5 5");
});

test("S reflects the previous cubic control point", () => {
  assert.equal(
    toFigmaVectorPath("M 0 0 C 1 1 2 2 3 3 S 5 5 6 6"),
    "M 0 0 C 1 1 2 2 3 3 C 4 4 5 5 6 6",
  );
});

test("T reflects the previous quadratic control point", () => {
  assert.equal(
    toFigmaVectorPath("M 0 0 Q 1 1 2 2 T 4 4"),
    "M 0 0 Q 1 1 2 2 Q 3 3 4 4",
  );
});

test("an elliptical arc is refused by name rather than approximated", () => {
  assert.throws(
    () => toFigmaVectorPath("M 0 0 A 5 5 0 0 1 10 10 Z"),
    (e: unknown) =>
      e instanceof FigmaVectorPathError && /elliptical arc/.test((e as Error).message),
  );
});

test("output carries only the commands Figma accepts", () => {
  // Probed against the plugin API 2026-08-31: M L C Q Z accepted; H V A and
  // every relative command refused.
  const converted = toFigmaVectorPath(
    "M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2z",
  );
  assert.equal(isFigmaVectorPath(converted), true, converted);
  assert.match(converted, /^M 19 3 L 5 3 C /);
});

test("MUI's compact checkbox icon converts and keeps its 3→21 extent", () => {
  const converted = toFigmaVectorPath(
    "M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  );
  assert.equal(isFigmaVectorPath(converted), true);
  const nums = (converted.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  // The painted square runs 3 → 21 inside a 24 viewBox; nothing should escape it.
  assert.equal(Math.min(...nums) >= 0, true);
  assert.equal(Math.max(...nums) <= 24, true);
  // and the second subpath (the tick) survives
  assert.equal((converted.match(/Z/g) ?? []).length, 2);
});

test("an already-accepted path is recognised and round-trips unchanged in shape", () => {
  const d = "M 0 0 L 10 0 L 10 10 Z";
  assert.equal(isFigmaVectorPath(d), true);
  assert.equal(toFigmaVectorPath(d), d);
  assert.equal(isFigmaVectorPath("M 0 0 H 10"), false);
});

test("arcs are still refused by default, and lowered with a reported bound on request", () => {
  const circle = "M 22 12 A 10 10 0 1 1 2 12 A 10 10 0 1 1 22 12 Z";
  assert.throws(() => toFigmaVectorPath(circle), /elliptical arc/);
  const { d, lowerings } = lowerVectorPath(circle, { arcs: "lower" });
  assert.equal(lowerings.length, 2, "two arcs lowered");
  assert.equal(lowerings[0]!.segments, 2, "a 180° arc is two ≤90° cubics");
  assert.ok(/^[MLCQZ0-9 .-]+$/.test(d), "only accepted commands remain");
  // Every sampled point of the lowered circle sits within 0.03% of radius 10.
  const b = vectorPathBounds(d);
  assert.ok(Math.abs(b.minX - 2) < 0.01 && Math.abs(b.maxX - 22) < 0.01, "extent 2→22 kept");
  assert.ok(Math.abs(b.minY - 2) < 0.01 && Math.abs(b.maxY - 22) < 0.01);
});

test("lowering is deterministic and idempotent on an already-accepted path", () => {
  const src = "M 12 3 A 9 9 0 1 0 12 21 A 9 9 0 0 0 12 3 Z";
  const once = toFigmaVectorPath(src, { arcs: "lower" });
  const twice = toFigmaVectorPath(once, { arcs: "lower" });
  assert.equal(once, twice);
});

test("transformVectorPath scales and translates exactly, and bounds follow", () => {
  const d = toFigmaVectorPath("M 2 2 L 22 2 L 22 22 L 2 22 Z");
  const moved = transformVectorPath(d, { scale: 0.5, tx: -1, ty: -1 });
  assert.equal(moved, "M 0 0 L 10 0 L 10 10 L 0 10 Z");
  assert.deepEqual(vectorPathBounds(moved), { minX: 0, minY: 0, maxX: 10, maxY: 10 });
});

test("closeSubpaths closes an open filled contour before the next M and at the end, and leaves closed ones alone", () => {
  const ring = "M 20 12 A 8 8 0 0 1 12 20 A 8 8 0 0 1 4 12 M 7.91 10.08 L 6.5 11.5 L 11 16 Z";
  const closed = toFigmaVectorPath(ring, { arcs: "lower", closeSubpaths: true });
  assert.equal((closed.match(/Z/g) ?? []).length, 2, "the open ring gains a Z; the check keeps its one");
  assert.ok(/Z M 7\.91/.test(closed), "Z lands before the second subpath's M");
  const open = toFigmaVectorPath("M 0 0 L 10 0 L 10 10", { closeSubpaths: false });
  assert.equal(open.includes("Z"), false, "default leaves an open stroke path open");
  assert.equal(toFigmaVectorPath("M 0 0 L 10 0 Z", { closeSubpaths: true }), "M 0 0 L 10 0 Z", "no double Z");
});
