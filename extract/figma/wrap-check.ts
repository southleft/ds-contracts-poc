/**
 * Receipts for WRAPPING auto-layout (dump v1.12) —
 * `npm run extract:figma:wrap:check`.
 *
 * THE HOLE THIS CLOSES. `core/emit-figma-script.ts` has written
 * `node.layoutWrap = 'WRAP'` from a contract's `layout.wrap` since v15. The
 * dump never read the field back. So the code→design leg carried wrapping
 * correctly and the design→code leg silently deleted it: a wrapping chip row
 * returned as one overflowing line, with no degradation, no note, and nothing
 * in any gate that could see it. The closure gate structurally cannot reach it
 * either — `layoutWrap` is a pure layout fact and lives in no channel registry.
 *
 * It survived because it is RARE, not absent — exactly ONE of 804 committed
 * contracts carries `layout.wrap`: ds.composite-modal's tags row, the very
 * archetype. So it was reproducible against a committed artifact the whole
 * time, and an earlier draft of this header claiming ZERO was a bad walker of
 * mine (it never descended a MULTI-ROOT anatomy), not a fact. The repo had also
 * already written the gap down twice by name — docs/FIGMA-CAPABILITY-MATRIX.md
 * ranked want #8, and channel-closure-check.ts names `layoutWrap` as a
 * structural blind spot. What was missing was a GATE, not an awareness.
 *
 * Pinned here on synthetic dumps — the capture half is pinned separately in
 * scripts/plugin-engine-check.mjs against the REAL dump source:
 *
 *   1. UNIFORM wrap (every variant) → layout.wrap: true, CSS emits
 *      `flex-wrap: wrap`, and the figma script writes layoutWrap 'WRAP' —
 *      the round trip closes on the fact that used to die.
 *   2. A DISTINCT row gap has no schema spelling (one `gap` covers both axes,
 *      exactly as Figma's null counterAxisSpacing does) — carried as wrap plus
 *      a NAMED note, never a silently-dropped second gap.
 *   3. MIXED wrap (some variants only) → wrap is a per-part invariant with no
 *      per-variant form (layoutByProp's tuple is direction/justify/align), so
 *      nothing is guessed: NOT carried, and the limit is NAMED.
 *
 * Node shell over pure core functions — the same split as every receipt in
 * extract/figma/. Reads the repo; writes nothing.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { DumpNode, DumpSet } from "./types.js";
import { generateCss } from "../../core/emit-react.js";
import { emitFigmaScript } from "../../core/emit-figma-script.js";
import { proposeFromDump } from "../../core/propose-figma.js";
import { tokenInventoryFromJson } from "../../core/tokens.js";
import { loadTokenCorpus } from "./tokens.js";

const ROOT = process.cwd();
const read = (p: string) =>
  JSON.parse(readFileSync(path.join(ROOT, p), "utf8")) as Record<
    string,
    unknown
  >;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? "✔" : "✖"} ${label}`);
};

/** A tag-row shaped variant: a HORIZONTAL stack of chips that may wrap. */
function variant(
  tone: "Neutral" | "Accent",
  wrap: boolean,
  rowSpacing?: number,
): DumpNode {
  return {
    name: `Tone=${tone}`,
    type: "COMPONENT",
    layout: {
      mode: "HORIZONTAL",
      primary: "MIN",
      counter: "CENTER",
      spacing: 8,
      padding: [4, 4, 4, 4],
      primarySizing: "FIXED",
      counterSizing: "AUTO",
      ...(wrap ? { wrap: true as const } : {}),
      ...(rowSpacing !== undefined ? { rowSpacing } : {}),
    },
    fill: { hex: tone === "Neutral" ? "eeeeee" : "112233" },
    children: [
      {
        name: "ChipA",
        type: "FRAME",
        fill: { hex: "333333" },
        cornerRadius: 4,
      },
      {
        name: "ChipB",
        type: "FRAME",
        fill: { hex: "333333" },
        cornerRadius: 4,
      },
    ],
  };
}

const setOf = (variants: DumpNode[]): DumpSet => ({
  setName: "TagRow",
  type: "COMPONENT_SET",
  variants,
});

const corpus = loadTokenCorpus(ROOT);
const opts = {
  projectionMode: "reviewable-inversion" as const,
  corpus,
  contractIdByName: new Map<string, string>(),
  fileKey: null,
  mintUnbound: true,
};
const rootLayoutOf = (r: ReturnType<typeof proposeFromDump>) =>
  ((r.contract.anatomy as Record<string, any>).root as any).layout as
    Record<string, unknown> | undefined;

// ---------------------------------------------------------------------------
// 1. UNIFORM wrap — carried, and the round trip closes
// ---------------------------------------------------------------------------

console.log("\nUniform wrap (every variant)");
const uniform = proposeFromDump(
  setOf([variant("Neutral", true), variant("Accent", true)]),
  opts,
);
const uniformLayout = rootLayoutOf(uniform);
check(
  "root proposes layout.wrap: true (the fact the return leg used to delete)",
  uniformLayout?.wrap === true,
);

const inventory = tokenInventoryFromJson([
  read("tokens/primitives.tokens.json"),
  read("tokens/semantic.tokens.json"),
  uniform.mintedTokens?.tree ?? {},
]);
const cssErrors: string[] = [];
const css = generateCss(uniform.contract as never, inventory, cssErrors);
check("the proposal emits CSS with no errors", cssErrors.length === 0);
check("CSS emits `flex-wrap: wrap` on the root", /flex-wrap:\s*wrap/.test(css));

const script = emitFigmaScript(
  uniform.contract as never,
  {
    tokens: {
      primitives: read("tokens/primitives.tokens.json"),
      semantic: {
        ...read("tokens/semantic.tokens.json"),
        ...(uniform.mintedTokens?.tree ?? {}),
      },
      light: read("tokens/modes/semantic.light.tokens.json"),
      dark: read("tokens/modes/semantic.dark.tokens.json"),
      brands: { default: read("tokens/modes/brand.default.tokens.json") },
    } as never,
    icons: new Map<string, string>(),
    contracts: new Map([[uniform.contract.id, uniform.contract as never]]),
  } as never,
);
check(
  "the figma script writes layoutWrap 'WRAP' (code→design still carries it)",
  /layoutWrap\s*=\s*'WRAP'/.test(script),
);

// ---------------------------------------------------------------------------
// 2. A DISTINCT row gap has no schema spelling — carried as wrap + NAMED
// ---------------------------------------------------------------------------

console.log("\nDistinct row gap (counterAxisSpacing ≠ itemSpacing)");
const distinctRow = proposeFromDump(
  setOf([variant("Neutral", true, 20), variant("Accent", true, 20)]),
  opts,
);
check("wrap is still carried", rootLayoutOf(distinctRow)?.wrap === true);
check(
  "the un-carriable ROW gap is a NAMED note (one `gap` covers both axes, as it does in Figma)",
  distinctRow.notes.some(
    (n) => n.includes("ROW gap") && n.includes("not carried"),
  ),
);

// ---------------------------------------------------------------------------
// 3. MIXED wrap — never guessed, and NAMED
// ---------------------------------------------------------------------------

console.log("\nMixed wrap (a per-part invariant, like overlap)");
const mixed = proposeFromDump(
  setOf([variant("Neutral", true), variant("Accent", false)]),
  opts,
);
check(
  "layout.wrap is NOT set (wrap holds in only half the variants — never guessed)",
  rootLayoutOf(mixed)?.wrap === undefined,
);
check(
  "the mixed-wrap limit is a NAMED note",
  mixed.notes.some((n) => n.includes("WRAPS in 1 of 2 auto-layout variant(s)")),
);

// ---------------------------------------------------------------------------
// 4. The control: no wrap anywhere invents nothing
// ---------------------------------------------------------------------------

console.log("\nControl (nothing wraps)");
const none = proposeFromDump(
  setOf([variant("Neutral", false), variant("Accent", false)]),
  opts,
);
check(
  "no wrap key on a non-wrapping stack",
  rootLayoutOf(none)?.wrap === undefined,
);
check(
  "and no wrap note is emitted",
  !none.notes.some((n) => n.includes("WRAPS in")),
);

// ---------------------------------------------------------------------------
// 5. THE CENTERED ROOT — the case the first cut silently dropped
// ---------------------------------------------------------------------------
//
// `invertLayout` returns EARLY for a root drawn at the generator's default
// (row / center / center), and the first cut of this fix appended the wrap
// carry BELOW that return — so a centered wrapping root produced NO layout, NO
// note and NO degradation: the exact silence this whole change exists to
// remove, reintroduced by the change itself. The guard already excluded
// `overlap` for precisely this reason; `wrap` had to join it.
//
// This is not a corner. layoutWrap is HORIZONTAL-only in Figma, so EVERY
// wrapping root is `row` by construction — a centered tag cloud satisfies the
// rest on its own.

console.log("\nCentered root (row/center/center — the early-return trap)");
const centered = (wrap: boolean): DumpNode => {
  const v = variant("Neutral", wrap);
  v.layout = { ...v.layout!, primary: "CENTER", counter: "CENTER" };
  return v;
};
const centeredWrap = proposeFromDump(
  setOf([centered(true), centered(true)]),
  opts,
);
check(
  "a CENTERED wrapping root still carries layout.wrap (the early return no longer swallows it)",
  rootLayoutOf(centeredWrap)?.wrap === true,
);
const centeredPlain = proposeFromDump(
  setOf([centered(false), centered(false)]),
  opts,
);
check(
  "and a CENTERED non-wrapping root still proposes NO layout block (the early return is intact)",
  rootLayoutOf(centeredPlain) === undefined,
);

// ---------------------------------------------------------------------------
// 6. NESTED wrap — carried too, not just the root
// ---------------------------------------------------------------------------

console.log("\nNested wrap");
const nestedVariant = (tone: "Neutral" | "Accent"): DumpNode => {
  const inner = variant(tone, true);
  inner.name = "TagList";
  inner.type = "FRAME";
  return { ...variant(tone, false), children: [inner] };
};
const nested = proposeFromDump(
  setOf([nestedVariant("Neutral"), nestedVariant("Accent")]),
  opts,
);
const nestedLayout = (
  ((nested.contract.anatomy as Record<string, any>).root as any).parts
    ?.TagList as any
)?.layout;
check(
  "a NESTED wrapping part carries layout.wrap",
  nestedLayout?.wrap === true,
);

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} wrap invariant(s) failed`);
  process.exit(1);
}
console.log(
  "\n✔ wrapping survives the round trip (dump v1.12 reads layoutWrap; uniform carries, mixed is named, row gap is named)",
);
