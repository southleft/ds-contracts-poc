/**
 * Receipts for FIGMA CONSTRAINTS (dump v1.13) —
 * `npm run extract:figma:constraints:check`.
 *
 * THE HOLE THIS CLOSES, and it is not a lost fact — it is a SUBSTITUTED one.
 * Figma's ConstraintType is MIN | CENTER | MAX | STRETCH | SCALE. Both capture
 * sites in extract/figma/dump.plugin.js mapped only the first three:
 *
 *     const H = { MIN: 'LEFT', MAX: 'RIGHT', CENTER: 'CENTER' };
 *     if (h && v) abs.constraints = { horizontal: h, vertical: v };
 *
 * so a STRETCH or SCALE node fell through the guard and the WHOLE FIELD was
 * omitted. core/propose-figma.ts then reads an absent field as `?? 'LEFT'` /
 * `?? 'TOP'` and bakes confident pinned-top-left geometry. Untitled UI's
 * `Progress circle/Ring` is the candidate that surfaced it: 6 of its 16
 * occurrences are drawn with EQUAL insets on all four sides (12/12/12/12 in
 * two). That is CONSISTENT with a stretched box, not proof of one — STRETCH
 * permits any fixed insets, and the ring's other occurrences are unequal or
 * carry negative bottoms. What is MEASURED: of 811 absBoxOf-visible boxes
 * across the committed dumps, 352 carry NO constraints field (354 including
 * GROUP, which has no such property at all), so a STRETCH or SCALE node is
 * INDISTINGUISHABLE there from a genuine top-left pin.
 *
 * WHY IT SURVIVED. propose-figma.ts has always carried a refusal for exactly
 * this case, and a plugin dump could never trigger it: the only fixture that
 * does is a HAND-AUTHORED conformance case (placement-constraints-scale.dump
 * .json) written to contain a value the real capture cannot emit. The gate was
 * green over a dead path — the same shape as the POLYGON incident, where the
 * mock returned REST's spelling and the test agreed with the bug for six dump
 * versions.
 *
 * WHAT IS PINNED HERE:
 *   1. STRETCH is CARRIED, not refused. A Figma STRETCH pins BOTH edges on its
 *      axis, which is exactly CSS `left + right` (or `top + bottom`) with NO
 *      size — the box tracks its parent. A baked width would freeze the very
 *      resize the constraint expresses.
 *   2. SCALE is REFUSED BY NAME. It resizes the box PROPORTIONALLY with its
 *      parent and CSS has no equivalent on a positioned element.
 *   3. An ABSENT field still reads as LEFT×TOP — unchanged geometry, so no
 *      corpus moves — but the ASSUMPTION IS NOW NAMED instead of silent.
 *
 * THE LIMIT THIS CANNOT FIX, stated so it is not mistaken for coverage: a dump
 * ALREADY TAKEN cannot be repaired. The field was destroyed at capture time, so
 * every pre-v1.13 dump needs a RE-CAPTURE from the live file before its
 * STRETCH boxes can be told apart from genuine top-left pins.
 *
 * Node shell over pure core functions. Reads the repo; writes nothing.
 */
import { proposeFromDump } from "../../core/propose-figma.js";
import { loadTokenCorpus } from "./tokens.js";

const ROOT = process.cwd();
const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? "✔" : "✖"} ${label}`);
};

const corpus = loadTokenCorpus(ROOT);
const opts = {
  projectionMode: "reviewable-inversion" as const,
  corpus,
  contractIdByName: new Map<string, string>(),
  fileKey: null,
  mintUnbound: true,
};

/** A ring inset equally on all four sides of a 240px box — the Progress-circle
 *  shape, and the drawing STRETCH × STRETCH produces. */
const variant = (tone: string, c?: { horizontal: string; vertical: string }) =>
  ({
    name: `Tone=${tone}`,
    type: "COMPONENT",
    bbox: { width: 240, height: 240 },
    children: [
      {
        name: "Ring",
        type: "FRAME",
        fill: { hex: "7f56d9" },
        abs: {
          x: 12,
          y: 12,
          right: 12,
          bottom: 12,
          width: 216,
          height: 216,
          ...(c ? { constraints: c } : {}),
        },
      },
    ],
  }) as never;

const setOf = (variants: unknown[]) =>
  ({ setName: "Circle", type: "COMPONENT_SET", variants }) as never;
const ring = (r: ReturnType<typeof proposeFromDump>) =>
  (r.contract.anatomy as Record<string, any>).root.parts.Ring as Record<
    string,
    any
  >;

// ---------------------------------------------------------------------------
// 1. STRETCH — carried as BOTH edges, with NO baked size
// ---------------------------------------------------------------------------

console.log("\nSTRETCH × STRETCH (the Progress-circle ring)");
const S = { horizontal: "STRETCH", vertical: "STRETCH" };
const stretched = proposeFromDump(
  setOf([variant("A", S), variant("B", S)]),
  opts,
);
const rs = ring(stretched);
check(
  "STRETCH pins BOTH edges on both axes (left+right / top+bottom)",
  ["left", "right", "top", "bottom"].every((k) => rs.tokens?.[k] !== undefined),
);
check(
  "a STRETCHED axis bakes NO width/height (a size would freeze the resize the constraint expresses)",
  rs.tokens?.width === undefined && rs.tokens?.height === undefined,
);
check(
  "the STRETCH carry is a NAMED note",
  stretched.notes.some((n) => n.includes("is STRETCH, carried as BOTH edges")),
);

// ---------------------------------------------------------------------------
// 2. SCALE — refused BY NAME (CSS has no proportional resize on a positioned box)
// ---------------------------------------------------------------------------

console.log("\nSCALE × SCALE");
const SC = { horizontal: "SCALE", vertical: "SCALE" };
const scaled = proposeFromDump(
  setOf([variant("A", SC), variant("B", SC)]),
  opts,
);
check(
  "SCALE is REFUSED BY NAME, and the reason says why CSS cannot spell it",
  scaled.notes.some((n) => n.includes("SCALE resizes the box PROPORTIONALLY")),
);
check(
  "a refused SCALE part renders IN FLOW (no half-carried absolute box)",
  ring(scaled).tokens?.left === undefined &&
    ring(scaled).tokens?.right === undefined,
);

// ---------------------------------------------------------------------------
// 3. ABSENT — geometry unchanged, assumption NAMED
// ---------------------------------------------------------------------------

console.log("\nAbsent constraints (every pre-v1.13 dump)");
const absent = proposeFromDump(setOf([variant("A"), variant("B")]), opts);
const ra = ring(absent);
check(
  "the LEFT×TOP assumption is NAMED (it used to be silent)",
  absent.notes.some((n) => n.includes("carry NO constraints field")),
);
check(
  "and the note says a RE-CAPTURE is what distinguishes STRETCH from a real top-left pin",
  absent.notes.some((n) => n.includes("re-capture with dump v1.13+")),
);
check(
  "geometry is UNCHANGED (top-left + baked size) — naming the assumption moves no corpus",
  ra.tokens?.left !== undefined &&
    ra.tokens?.top !== undefined &&
    ra.tokens?.width !== undefined,
);

// ---------------------------------------------------------------------------
// 4. The control: an explicit MIN×MIN is an OBSERVATION, not an assumption
// ---------------------------------------------------------------------------

console.log("\nControl (explicit LEFT×TOP)");
const explicit = proposeFromDump(
  setOf([
    variant("A", { horizontal: "LEFT", vertical: "TOP" }),
    variant("B", { horizontal: "LEFT", vertical: "TOP" }),
  ]),
  opts,
);
check(
  "an EXPLICIT LEFT×TOP emits no assumption note (the note tracks the missing field, not the value)",
  !explicit.notes.some((n) => n.includes("carry NO constraints field")),
);
check(
  "and it still carries the top-left box",
  ring(explicit).tokens?.left !== undefined &&
    ring(explicit).tokens?.top !== undefined,
);

// ---------------------------------------------------------------------------
// 5. STRETCH vs AN ALREADY-BOUND SIZE — the contradiction, resolved and NAMED
// ---------------------------------------------------------------------------
//
// The first cut skipped only the size MINT, so a width already bound from a
// design VARIABLE survived alongside left+right. CSS resolves an over-
// constrained box by DROPPING an edge — the box freezes at its drawn size, and
// WHICH edge dies flips under `direction: rtl`. Worse, the note still claimed
// "NO size on that axis … so the box tracks its parent", and the canvas leg
// resizes to parent-minus-offsets while the code leg holds the bound width, so
// the two surfaces disagree. The design's own binding is an OBSERVATION and
// wins; the stretch is not carried on that axis and the conflict is named.

console.log("\nSTRETCH with an already-BOUND size on the same axis");
const boundWidth = (tone: string) => {
  const v = variant(tone, S) as Record<string, any>;
  v.children[0].bound = { width: "spacing/xl" };
  return v as never;
};
const conflict = proposeFromDump(
  setOf([boundWidth("A"), boundWidth("B")]),
  opts,
);
const rc = ring(conflict);
check(
  "a bound width WINS over the horizontal stretch (the design said this exact size)",
  rc.tokens?.width !== undefined,
);
check(
  "and the box does NOT ship left+right+width together (CSS would silently drop an edge)",
  !(
    rc.tokens?.left !== undefined &&
    rc.tokens?.right !== undefined &&
    rc.tokens?.width !== undefined
  ),
);
check(
  "the contradiction is NAMED",
  conflict.notes.some((n) =>
    n.includes("STRETCHes an axis whose size is ALREADY BOUND"),
  ),
);
check(
  "the VERTICAL axis (unbound) still stretches — the refusal is per-axis, not whole-part",
  rc.tokens?.top !== undefined &&
    rc.tokens?.bottom !== undefined &&
    rc.tokens?.height === undefined,
);

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} constraint invariant(s) failed`);
  process.exit(1);
}
console.log(
  "\n✔ constraints reach the decision (dump v1.13: STRETCH carried as both edges, SCALE named, an absent field named as an assumption)",
);
