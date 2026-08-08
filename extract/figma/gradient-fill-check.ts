/**
 * Receipts for GRADIENT_LINEAR fills, textCase, and the U+2024 name fold
 * (dump v1.16) — `npm run extract:figma:gradient:check`.
 *
 * THE HOLE THIS CLOSES (Eventz #21). Dump ≤ v1.15 carried SOLID paints only:
 * a GRADIENT_LINEAR fill died at capture with a `paint-unsupported` receipt,
 * so the Badge accent/info/warning/featured grounds (and the Alert grounds)
 * rendered NOTHING — badge scored 23.5 while the contract→canvas leg
 * (core/emit-figma-script.ts, v15) had parsed CSS linear-gradients into
 * native GRADIENT_LINEAR paints all along. The same capture dropped textCase
 * UPPER ("Label" for "LABEL") and refused every binding of a variable whose
 * name carries U+2024 ONE DOT LEADER ("spacing/1․5", 16 refusals).
 *
 * Pinned here on synthetic dumps (the Eventz proof lives in
 * examples/eventz-vars — pipeline byte-verify + fidelity table):
 *
 *   1. AXIS-ALIGNED CARRIAGE, EXACT AND NORMALIZED. A horizontal two-stop
 *      ramp whose handles overshoot the box carries as background-image
 *      minted `gradient` leaves NORMALIZED TO THE VISIBLE SEGMENT — the box
 *      edges become the 0%/100% stops with colors interpolated ON the ramp
 *      (pixel-identical inside the box; every stop stays inside the grammar
 *      parseCssGradient speaks). Interior stops remap; gradient-less
 *      variants mint 'none' (their ground rides background-color).
 *   2. ROUND TRIP: the proposed contract compiles to a native
 *      GRADIENT_LINEAR spec (angle + stops, no gradientMiss) through the
 *      SAME engine the plugin runs — the leg that draws the canvas.
 *   3. OBLIQUE REFUSED BY NAME: a CSS gradient angle lives in pixel space,
 *      the handles in normalized object space — the exact angle is a
 *      function of the box's aspect ratio, so no size-independent carriage
 *      exists. One oblique occurrence refuses the WHOLE channel (minting
 *      'none' beside it would assert an absence the canvas contradicts).
 *   4. textCase UPPER → declared `text-transform: uppercase` when uniform;
 *      a mixed axis is NAMED, never sampled.
 *   5. U+2024 fold: "spacing/1․5" binds as {spacing.1-5} (a NAMED rename,
 *      one receipt per variable per set) and registers under the same fold
 *      in the captured-token layer; a fold target another variable already
 *      owns refuses registration BY NAME.
 *
 * Node shell over pure core functions — reads the repo, writes nothing.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { DumpGradient, DumpNode, DumpSet } from "./types.js";
import { generateCss } from "../../core/emit-react.js";
import { createFigmaEngine } from "../../core/emit-figma-script.js";
import { proposeFromDump } from "../../core/propose-figma.js";
import { capturedTokensFromDump } from "../../core/captured-tokens.js";
import { tokenInventoryFromJson } from "../../core/tokens.js";
import { ContractSchema } from "../../scripts/contract-schema.js";
import { loadTokenCorpus } from "./tokens.js";

const ROOT = process.cwd();
const read = (p: string) =>
  JSON.parse(readFileSync(path.join(ROOT, p), "utf8")) as Record<string, unknown>;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? "✔" : "✖"} ${label}`);
};

/** The Eventz Badge shape in miniature: a variant axis where some values
 *  draw a gradient ground and one draws a solid. */
function variant(tone: string, gradient?: DumpGradient, textCase?: "UPPER"): DumpNode {
  return {
    name: `Tone=${tone}`,
    type: "COMPONENT",
    layout: {
      mode: "HORIZONTAL",
      primary: "CENTER",
      counter: "CENTER",
      spacing: 4,
      padding: [2, 6, 2, 6],
      primarySizing: "AUTO",
      counterSizing: "AUTO",
    },
    cornerRadius: 4,
    ...(gradient ? { gradient } : { fill: { hex: "112233" } }),
    children: [
      {
        name: "Label",
        type: "TEXT",
        text: {
          characters: "Label",
          fontSize: 12,
          fontStyle: "Bold",
          ...(textCase ? { textCase } : {}),
        },
      },
    ],
  };
}

const setOf = (variants: DumpNode[]): DumpSet => ({
  setName: "GradBadge",
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

const rootOf = (r: ReturnType<typeof proposeFromDump>) =>
  (r.contract.anatomy as Record<string, any>).root as Record<string, any>;

// ---------------------------------------------------------------------------
// 1. Axis-aligned carriage — exact, normalized to the visible segment
// ---------------------------------------------------------------------------

console.log("\nAxis-aligned GRADIENT_LINEAR (the Eventz Badge shape: handles overshoot the box)");
// Handles x=2 → x=0 (the ramp's 0-position lies a full box-width PAST the
// right edge): the box shows the 50%–100% slice of the ramp. Black→white
// therefore renders #808080 at the right edge — the naive full-ramp spelling
// would paint half the ground with colors the canvas never draws.
const overshoot: DumpGradient = {
  start: { x: 2, y: 0.5 },
  end: { x: 0, y: 0.5 },
  stops: [
    { position: 0, hex: "000000" },
    { position: 1, hex: "ffffff" },
  ],
};
const carried = proposeFromDump(
  setOf([variant("Grad", overshoot, "UPPER"), variant("Plain", undefined, "UPPER")]),
  opts,
);
const carriedRoot = rootOf(carried);
check(
  "root tokens carry background-image as a substituted per-variant ref",
  /^\{imported\..*background-image\.\{tone\}\}$/.test(String(carriedRoot.tokens?.["background-image"])),
);
const mintedTree = (carried.mintedTokens?.tree ?? {}) as Record<string, any>;
const bgLeaves = mintedTree.imported?.["grad-badge"]?.root?.["background-image"];
check(
  "the Grad leaf is the VISIBLE-SEGMENT spelling — edge colors interpolated on the ramp (#808080 at 0%), stops inside the grammar",
  bgLeaves?.grad?.$value === "linear-gradient(270deg, #808080 0%, #ffffff 100%)",
);
check("the Plain leaf mints 'none' (its ground rides background-color)", bgLeaves?.plain?.$value === "none");
check(
  "the carriage is NAMED (visible-segment normalization note)",
  carried.notes.some((n) => n.includes("carried as background-image") && n.includes("visible segment")),
);
// An interior stop remaps into the visible segment.
const threeStop: DumpGradient = {
  start: { x: 2, y: 0.5 },
  end: { x: 0, y: 0.5 },
  stops: [
    { position: 0, hex: "000000" },
    { position: 0.75, hex: "ff0000" },
    { position: 1, hex: "ffffff" },
  ],
};
const multi = proposeFromDump(setOf([variant("Grad", threeStop), variant("Plain")]), opts);
const multiLeaf = ((multi.mintedTokens?.tree ?? {}) as Record<string, any>).imported?.["grad-badge"]?.root?.[
  "background-image"
]?.grad?.$value;
check(
  "a 3-stop ramp remaps its interior stop into the segment (0.75 → 50%)",
  multiLeaf === "linear-gradient(270deg, #aa0000 0%, #ff0000 50%, #ffffff 100%)",
);

const inventory = tokenInventoryFromJson([
  read("tokens/primitives.tokens.json"),
  read("tokens/semantic.tokens.json"),
  carried.mintedTokens?.tree ?? {},
]);
const cssErrors: string[] = [];
const css = generateCss(carried.contract as never, inventory, cssErrors);
check("the proposal emits CSS with no errors", cssErrors.length === 0);
check(
  "CSS emits per-variant background-image vars",
  /background-image:\s*var\(--imported-grad-badge-root-background-image-grad\)/i.test(css),
);
check("CSS emits text-transform: uppercase on the Label", /text-transform:\s*uppercase/.test(css));

// ---------------------------------------------------------------------------
// 2. Round trip — the proposed contract compiles to a native GRADIENT_LINEAR
// ---------------------------------------------------------------------------

console.log("\nRound trip through the canvas engine (contract → GRADIENT_LINEAR spec)");
const parsed = ContractSchema.parse(carried.contract);
const engine = createFigmaEngine({
  tokens: {
    primitives: read("tokens/primitives.tokens.json"),
    semantic: { ...read("tokens/semantic.tokens.json"), ...(carried.mintedTokens?.tree ?? {}) },
    light: read("tokens/modes/semantic.light.tokens.json"),
    dark: read("tokens/modes/semantic.dark.tokens.json"),
    brands: { default: read("tokens/modes/brand.default.tokens.json") },
  } as never,
  icons: new Map<string, string>(),
});
const data = engine.compileComponentData(parsed as never, new Map([[parsed.id, parsed as never]]));
const gradVariant = data.variants.find((v: any) => v.name.includes("Tone=Grad") || v.name.includes("tone=grad"));
const plainVariant = data.variants.find((v: any) => v.name.includes("Tone=Plain") || v.name.includes("tone=plain"));
check(
  "the Grad variant compiles a native GRADIENT_LINEAR paint (angle 270, 2 stops, no gradientMiss)",
  gradVariant?.spec?.gradient?.angle === 270 &&
    gradVariant?.spec?.gradient?.stops?.length === 2 &&
    gradVariant?.spec?.gradientMiss === undefined,
);
check(
  "the Plain variant compiles NO gradient layer ('none' round-trips clean, no gradientMiss)",
  plainVariant?.spec?.gradient === undefined && plainVariant?.spec?.gradientMiss === undefined,
);
const labelSpec = (function find(s: any, name: string): any {
  if (!s) return undefined;
  return s.name === name ? s : (s.children ?? []).map((c: any) => find(c, name)).find(Boolean);
})(gradVariant?.spec, "Label");
check("the Label spec carries textCase UPPER (declared text-transform round-trips)", labelSpec?.textCase === "UPPER");

// ---------------------------------------------------------------------------
// 3. Oblique — refused BY NAME, whole channel
// ---------------------------------------------------------------------------

console.log("\nOblique ramp (the Eventz Alert shape)");
const oblique: DumpGradient = {
  start: { x: -3.39, y: -4.59 },
  end: { x: 1.55, y: 2.13 },
  stops: [
    { position: 0, hex: "000000" },
    { position: 1, hex: "ffffff" },
  ],
};
const refused = proposeFromDump(setOf([variant("Grad", oblique), variant("Plain")]), opts);
check(
  "background-image is NOT proposed (no ref, no minted leaf)",
  rootOf(refused).tokens?.["background-image"] === undefined &&
    ((refused.mintedTokens?.tree ?? {}) as Record<string, any>).imported?.["grad-badge"]?.root?.["background-image"] ===
      undefined,
);
check(
  "the refusal is NAMED with the raw handles (box-aspect-dependent angle)",
  refused.notes.some((n) => n.includes("OBLIQUE GRADIENT_LINEAR") && n.includes("aspect ratio")),
);

// ---------------------------------------------------------------------------
// 4. textCase — uniform carries, mixed is NAMED
// ---------------------------------------------------------------------------

console.log("\ntextCase (dump v1.16)");
const uniformCase = rootOf(carried).parts?.Label;
check(
  "uniform textCase UPPER → declared text-transform: uppercase on the Label part",
  uniformCase?.declared?.["text-transform"] === "uppercase",
);
check(
  "the carriage is NAMED (declared text-transform note)",
  carried.notes.some((n) => n.includes("carried as declared text-transform: uppercase")),
);
const mixedCase = proposeFromDump(
  setOf([variant("Grad", undefined, "UPPER"), variant("Plain", undefined, undefined)]),
  opts,
);
check(
  "a MIXED case axis proposes nothing and is NAMED (never sampled)",
  rootOf(mixedCase).parts?.Label?.declared?.["text-transform"] === undefined &&
    mixedCase.notes.some((n) => n.includes("textCase differs across variants")),
);

// ---------------------------------------------------------------------------
// 5. U+2024 fold — a NAMED rename, collision refused
// ---------------------------------------------------------------------------

console.log("\nU+2024 ONE DOT LEADER fold");
const foldedVariant = (tone: string): DumpNode => ({
  ...variant(tone),
  bound: { itemSpacing: "spacing/1․5" },
});
const folded = proposeFromDump(setOf([foldedVariant("Grad"), foldedVariant("Plain")]), opts);
check(
  "the binding CARRIES as {spacing.1-5} (was: 'outside the token-ref grammar', binding not proposed)",
  rootOf(folded).tokens?.gap === "{spacing.1-5}",
);
check(
  "the fold is a NAMED RENAME, one receipt per variable per set",
  folded.notes.filter((n) => n.includes("U+2024 ONE DOT LEADER — folded")).length === 1,
);
const layer = capturedTokensFromDump({
  _variables: { "spacing/1․5": { type: "FLOAT", value: 6 } },
  Set: setOf([foldedVariant("Grad")]),
} as never);
check(
  "the captured-token layer registers the SAME fold (refs resolve end to end), original name kept on the entry",
  layer?.entries.some((e) => e.path === "spacing.1-5" && e.name === "spacing/1․5") === true,
);
const collided = capturedTokensFromDump({
  _variables: {
    "spacing/1-5": { type: "FLOAT", value: 5 },
    "spacing/1․5": { type: "FLOAT", value: 6 },
  },
  Set: setOf([foldedVariant("Grad")]),
} as never);
check(
  "a fold target another variable owns REFUSES registration by name (the occupant keeps the path)",
  collided?.entries.some((e) => e.path === "spacing.1-5" && e.value === "5px") === true &&
    collided?.skipped.some((s) => s.name === "spacing/1․5" && s.reason.includes("collides")) === true,
);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\n✔ gradient/textCase/U+2024 receipts all hold");
