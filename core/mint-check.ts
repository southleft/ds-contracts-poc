/**
 * Receipts for provisional token minting — `npm run mint:check`.
 *
 * A synthetic dump (a set no real canvas produced, so every styled fact is a
 * resolved literal — the exact shape of a variables-endpoint-degraded REST
 * import) exercises the two minting rules the Badge receipt can't:
 *
 *   1. DEDUPE     the same literal at ≥3 usage sites collapses into ONE
 *                 `imported.shared.*` leaf, and every site binds it.
 *   2. VARIANTS   per-axis values mint per-variant leaves + the substituted
 *                 ref; values that do NOT correlate with any axis mint
 *                 NOTHING (the drift stays a named review item).
 *
 * Plus the invariants every mint must hold: default-off back-compat, zero
 * names outside the `imported.` namespace, deterministic output, and the
 * proposal generating green through emitReact AND emitHtml with an inventory
 * built from the repo trees + the minted tree.
 *
 * Node script over pure functions (core/mint-tokens.ts, core/propose-figma.ts)
 * — the same shell/core split as every other check in the repo.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { ContractSchema, resolveLiterals, type Contract } from "../scripts/contract-schema.js";
import type { DumpNode, DumpSet } from "../extract/figma/types.js";
import { loadTokenCorpus } from "../extract/figma/tokens.js";
import { proposeFromDump } from "./propose-figma.js";
import { MINT_NAMESPACE, mintTokens, mintedTokenCss } from "./mint-tokens.js";
import { emitReact } from "./emit-react.js";
import { emitHtml } from "./emit-html.js";
import { tokenInventoryFromJson } from "./tokens.js";

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

// ---------------------------------------------------------------------------
// Synthetic degraded dump: Tone×Size axes, every styled fact a raw literal
// ---------------------------------------------------------------------------

/** One variant's tree. Root fill varies by Tone (axis-correlated); part `d`'s
 *  fill varies by BOTH axes (uncorrelated); a/b/c repeat #333333 and radius 4
 *  (dedupe); the label's 13px has no derived-style match (font-size mint). */
function variant(tone: "Neutral" | "Accent", size: "Sm" | "Md"): DumpNode {
  const rootFill = tone === "Neutral" ? "eeeeee" : "112233";
  const dFill = {
    "Neutral Sm": "010101",
    "Neutral Md": "020202",
    "Accent Sm": "030303",
    "Accent Md": "040404",
  }[`${tone} ${size}`]!;
  const box = (name: string): DumpNode => ({
    name,
    type: "FRAME",
    fill: { hex: "333333" },
    cornerRadius: 4,
  });
  return {
    name: `Tone=${tone}, Size=${size}`,
    type: "COMPONENT",
    layout: {
      mode: "HORIZONTAL",
      primary: "CENTER",
      counter: "CENTER",
      spacing: 8,
      padding: [4, 12, 4, 12],
      primarySizing: "AUTO",
      counterSizing: "AUTO",
    },
    cornerRadius: 4,
    fill: { hex: rootFill },
    children: [
      box("a"),
      box("b"),
      box("c"),
      { name: "d", type: "FRAME", fill: { hex: dFill } },
      {
        name: "label",
        type: "TEXT",
        fill: { hex: "101010" },
        text: { characters: "Sample", fontSize: 13, fontStyle: "Medium" },
      },
    ],
  };
}

const set: DumpSet = {
  setName: "Sample",
  type: "COMPONENT_SET",
  variants: [
    variant("Neutral", "Sm"),
    variant("Neutral", "Md"),
    variant("Accent", "Sm"),
    variant("Accent", "Md"),
  ],
};

const corpus = loadTokenCorpus(ROOT);
const opts = {
  corpus,
  contractIdByName: new Map<string, string>(),
  fileKey: null,
  projectionMode: "reviewable-inversion" as const,
};

// ---------------------------------------------------------------------------
// Back-compat: minting is opt-in
// ---------------------------------------------------------------------------

console.log("\nBack-compat (mintUnbound off)");
const plain = proposeFromDump(set, opts);
check("no mintedTokens on the result", plain.mintedTokens === undefined);
check("unbound literals stay report entries", plain.unbound.length >= 9);
check(
  "no imported.* ref anywhere",
  !JSON.stringify(plain.contract).includes(`{${MINT_NAMESPACE}.`),
);

// ---------------------------------------------------------------------------
// Minted proposal
// ---------------------------------------------------------------------------

console.log("\nMinting (mintUnbound on)");
const minted = proposeFromDump(set, { ...opts, mintUnbound: true });
const m = minted.mintedTokens;
check("mintedTokens returned", m !== undefined);
const entries = m?.entries ?? [];
const byRef = new Map(entries.map((e) => [e.ref, e]));

// 1. Dedupe: #333333 at three sites → ONE shared color leaf, bound at all three.
const sharedColor = byRef.get("{imported.shared.color-333333}");
check(
  "dedupe: #333333 ×3 sites → imported.shared.color-333333",
  sharedColor?.value === "#333333",
);
check(
  "dedupe: the shared color leaf lists all 3 usage sites",
  (sharedColor?.usageSites.length ?? 0) === 3,
);
const parts = ((minted.contract.anatomy as Record<string, any>).root as any)
  .parts as Record<string, any>;
check(
  "dedupe: a, b, c all bind the shared color leaf",
  ["a", "b", "c"].every(
    (n) =>
      parts[n]?.tokens?.["background-color"] ===
      "{imported.shared.color-333333}",
  ),
);
// Radius 4 rides root+a+b+c and padding-block 4 — five sites, one shared leaf.
const sharedSize = byRef.get("{imported.shared.size-4}");
check(
  "dedupe: 4px ×5 sites (radii + padding-block) → imported.shared.size-4",
  sharedSize?.value === "4px",
);
check(
  "dedupe: the shared size leaf lists 5 usage sites",
  (sharedSize?.usageSites.length ?? 0) === 5,
);

// 2. Per-variant: root fill correlates with Tone → substituted ref + a leaf
//    per axis value; part d's fill correlates with NOTHING → no mint, named.
const rootTokens = (
  (minted.contract.anatomy as Record<string, any>).root as any
).tokens as Record<string, string>;
check(
  "variants: root background-color is the substituted ref {imported.sample.root.background-color.{tone}}",
  rootTokens["background-color"] ===
    "{imported.sample.root.background-color.{tone}}",
);
check(
  "variants: a leaf per axis value with the right literals",
  byRef.get("{imported.sample.root.background-color.neutral}")?.value ===
    "#eeeeee" &&
    byRef.get("{imported.sample.root.background-color.accent}")?.value ===
      "#112233",
);
// GAP-CLOSING ROUND 10 — these three pins used to require the opposite: that
// part `d`'s drifting fill mint NOTHING and survive as an UNBOUND entry. That
// was right when a nested part had no two-axis vocabulary, so the only
// alternative was a WRONG single-axis fit. It is wrong now. `d` is drawn with
// four MEASURED fills; refusing them renders the part unpainted against a
// canvas that paints it, which is the same lose-a-measured-fact class as
// border-color -> currentColor. The same refusal, applied to ButtonBase's
// Size(4) x Icon(5) padding, produced a 22px-tall button where the canvas
// draws 40. So the doctrine is now CARRY AND NAME, and these pins are
// STRENGTHENED accordingly: the values must be reproduced exactly, AND the
// unwitnessed correlation must be named. Silence would now fail two pins,
// where before it only had to fail one.
check(
  "variants: uncorrelated d fill is CARRIED as a two-axis ref (every value measured)",
  typeof (parts.d?.tokens as Record<string, string> | undefined)?.[
    "background-color"
  ] === "string" &&
    /\{imported\.sample\.d\.background-color\.\{\w+\}\.\{\w+\}\}/.test(
      (parts.d!.tokens as Record<string, string>)["background-color"],
    ),
);
check(
  "variants: all four drifting literals survive as leaves",
  ["#010101", "#020202", "#030303", "#040404"].every((v) =>
    entries.some((e) => e.value === v),
  ),
);
check(
  "variants: the unwitnessed pair is a NAMED review item, not a silent claim",
  minted.notes.some(
    (n) =>
      n.includes("Sample:root/d") &&
      n.includes("SATURATED") &&
      n.includes("the CORRELATION is unwitnessed"),
  ),
);
// The DISCRIMINATOR. `d`'s four fills are 010101/020202/030303/040404 — four
// distinct values over four cells, one per cell, which is the histogram of an
// arbitrary assignment. Every saturated pair the Untitled UI kit actually
// produced is the opposite (4-32 distinct over 20-55 cells: heavy repetition
// no arbitrary assignment would show), which is why refusing them all was
// wrong. This pin holds the drift end of that contrast, so the hint stays a
// real signal instead of a sentence that prints on everything.
check(
  "variants: the drift fixture reports ONE distinct value per cell (the arbitrary-assignment histogram)",
  minted.notes.some(
    (n) =>
      n.includes("Sample:root/d") && n.includes("one distinct value per cell"),
  ),
);
check(
  "variants: nothing remains UNBOUND once the drift is carried",
  minted.unbound.length === 0,
);

// 3. Units + the remaining site-named leaves.
check(
  "gap minted with px units",
  byRef.get("{imported.sample.root.gap}")?.value === "8px",
);
check(
  "padding-inline minted with px units",
  byRef.get("{imported.sample.root.padding-inline}")?.value === "12px",
);
check(
  "text color minted by usage site",
  byRef.get("{imported.sample.label.color}")?.value === "#101010",
);
check(
  "font-size minted when no derived style matches",
  byRef.get("{imported.sample.label.font-size}")?.value === "13px",
);

// 4. Naming discipline: mechanical, provisional, never semantic.
check(
  "every minted ref lives under the imported. namespace",
  entries.every((e) => e.ref.startsWith(`{${MINT_NAMESPACE}.`)),
);
check(
  "every minted ref lands in notes as provisional",
  entries.every((e) =>
    minted.notes.some(
      (n) =>
        n.includes(e.ref) &&
        n.includes("rename against your real tokens (provisional)"),
    ),
  ),
);

// 5. Determinism: same dump, same tree, byte for byte.
const again = proposeFromDump(set, { ...opts, mintUnbound: true });
check(
  "minting is deterministic",
  JSON.stringify(again.mintedTokens) === JSON.stringify(m),
);

// 6. The proposal validates and GENERATES: emitReact + emitHtml run green with
//    an inventory of repo trees + the minted tree (multiple-tree inventory).
const contract: Contract = ContractSchema.parse(minted.contract);
const inventory = tokenInventoryFromJson([
  read("tokens/primitives.tokens.json"),
  read("tokens/semantic.tokens.json"),
  read("tokens/modes/semantic.light.tokens.json"),
  read("tokens/modes/semantic.dark.tokens.json"),
  m?.tree ?? {},
]);
const emitCtx = {
  tokens: inventory,
  icons: new Map<string, string>(),
  contracts: new Map([[contract.id, contract]]),
};
let reactOk = true;
let htmlCss = "";
try {
  emitReact(contract, emitCtx);
  htmlCss = emitHtml(contract, emitCtx).css;
} catch (e) {
  reactOk = false;
  console.error(String(e));
}
check("emitReact + emitHtml run green with repo + minted trees", reactOk);
check(
  "emitted css references the minted custom properties",
  htmlCss.includes("var(--imported-shared-color-333333)") &&
    htmlCss.includes("var(--imported-sample-root-background-color-neutral)"),
);
const cssVars = mintedTokenCss(m?.tree ?? {});
check(
  "mintedTokenCss carries every literal the bindings resolve to",
  entries.every((e) =>
    cssVars.includes(
      `--${e.ref.slice(1, -1).split(".").join("-")}: ${e.value};`,
    ),
  ),
);

// ---------------------------------------------------------------------------
// THE RAGGED MATRIX (mintTokens `realizedCombos`)
// ---------------------------------------------------------------------------
//
// A Figma variant set is often NOT a rectangle. Untitled UI's Slider is a RANGE
// control, so only `rightControl > leftControl` is drawn — 10 of 16 cells — and
// the two-axis fit used to require the full cartesian, so the channel collapsed
// to a ONE-axis projection that drew 320px where the canvas draws 80px in 24 of
// 40 variants (248px of ink outside a 320px track). This pins the three things
// that make the relaxation safe rather than merely permissive.
{
  const axes = [
    { propName: "left", values: ["0", "25", "50"] },
    { propName: "right", values: ["25", "50", "75"] },
  ];
  // A triangular matrix: right > left. (0,25) (0,50) (0,75) (25,50) (25,75)
  // (50,75) are drawn; the other three cells cannot exist.
  const drawn: Array<[string, string, number]> = [
    ["0", "25", 25],
    ["0", "50", 50],
    ["0", "75", 75],
    ["25", "50", 25],
    ["25", "75", 50],
    ["50", "75", 25],
  ];
  const obs = {
    nodePath: "root/Fill",
    part: "Fill",
    cssProperty: "width",
    kind: "px" as const,
    occurrences: drawn.map(([l, r, v]) => ({
      variant: `${l}/${r}`,
      axisValues: { left: l, right: r },
      value: v,
    })),
    target: {} as Record<string, string>,
  };
  const realizedCombos = drawn.map(([left, right]) => ({ left, right }));
  const strict = mintTokens("s", [obs], axes, { nestedPairs: true });
  const ragged = mintTokens("s", [obs], axes, {
    nestedPairs: true,
    realizedCombos,
  });
  check(
    "WITHOUT realizedCombos a ragged pair is still REFUSED (the relaxation is opt-in, so every existing caller is unchanged)",
    strict.bindings[0].ref === null,
  );
  check(
    "WITH realizedCombos the ragged pair CARRIES as a two-axis ref",
    ragged.bindings[0].ref === "{imported.s.fill.width.{left}.{right}}",
  );
  const leaf = (l: string, r: string) =>
    ragged.entries.find(
      (e) => e.ref === `{${MINT_NAMESPACE}.s.fill.width.${l}.${r}}`,
    );
  check(
    "every DRAWN cell carries its own measured value (not one axis projected over the other)",
    drawn.every(([l, r, v]) => leaf(l, r)?.value === `${v}px`),
  );
  check(
    "every SUPPLIED cell is named as NOT DRAWN on the leaf itself",
    ["25.25", "50.25", "50.50"].every((k) => {
      const [l, r] = k.split(".");
      return (
        leaf(l, r)?.usageSites.some((s) => s.includes("NOT DRAWN")) === true
      );
    }),
  );
  check(
    "the binding NAMES the fill (ragged caveat), and says the values are supplied rather than measured",
    (ragged.bindings[0].caveat ?? "").includes("RAGGED") &&
      (ragged.bindings[0].caveat ?? "").includes("SUPPLIED, not measured"),
  );
  // THE FALSIFICATION, and the reason this is a gate and not a demo. A hole the
  // variant set DOES realize is a genuinely incomplete observation — exactly
  // the dangling-ref hazard full coverage protects against — so it must keep
  // refusing. Same observation, same axes; only the claim about what exists
  // changes.
  const claimsAllSixteen = [] as Array<Record<string, string>>;
  for (const left of axes[0].values)
    for (const right of axes[1].values) claimsAllSixteen.push({ left, right });
  check(
    "a hole the variant set DOES realize still REFUSES (an incomplete observation is not a ragged matrix)",
    mintTokens("s", [obs], axes, {
      nestedPairs: true,
      realizedCombos: claimsAllSixteen,
    }).bindings[0].ref === null,
  );
  // A combination that cannot be judged (missing an axis value) must not be
  // guessed — it abandons the pair rather than assuming the cell is undrawn.
  check(
    "an unjudgeable realized combination (missing an axis) REFUSES rather than guessing the matrix",
    mintTokens("s", [obs], axes, {
      nestedPairs: true,
      realizedCombos: [
        ...realizedCombos,
        { left: "0" } as Record<string, string>,
      ],
    }).bindings[0].ref === null,
  );
  // ORDERING. An adversarial fuzz found that relaxing coverage INSIDE the pair
  // loop lets an earlier-sorting pair needing a FABRICATED cell pre-empt a
  // later pair whose every cell is MEASURED — a loss decided by axis order
  // alone. The relaxation therefore runs as a SECOND pass.
  const axes3 = [
    { propName: "a", values: ["a1", "a2"] },
    { propName: "b", values: ["b1", "b2"] },
    { propName: "c", values: ["c1", "c2", "c3"] },
  ];
  const rows: Array<[string, string, string, number]> = [
    ["a1", "b1", "c1", 10],
    ["a1", "b1", "c2", 20],
    ["a1", "b2", "c2", 20],
    ["a1", "b2", "c3", 30],
    ["a2", "b1", "c3", 20],
    ["a2", "b2", "c1", 10],
  ];
  const obs3 = {
    nodePath: "root",
    part: "",
    cssProperty: "gap",
    kind: "px" as const,
    occurrences: rows.map(([a, b, c, v]) => ({
      variant: `${a}${b}${c}`,
      axisValues: { a, b, c },
      value: v,
    })),
    target: {} as Record<string, string>,
  };
  const combos3 = rows.map(([a, b, c]) => ({ a, b, c }));
  check(
    "a FULLY MEASURED pair still wins over a ragged one that sorts earlier (the relaxation is a second pass)",
    mintTokens("x", [obs3], axes3, {
      nestedPairs: true,
      realizedCombos: combos3,
    }).bindings[0].ref ===
      mintTokens("x", [obs3], axes3, { nestedPairs: true }).bindings[0].ref,
  );
  // The supplied value must be a function of the CONTRACT's declared value
  // order, never of the order the dump happened to list variants in — probed
  // on the real Slider, reversing the dump moved the supplied width from 80px
  // to 320px, which is the overrun this whole change exists to remove.
  const reversed = { ...obs, occurrences: [...obs.occurrences].reverse() };
  check(
    "the SUPPLIED value is independent of dump variant ORDER (declared-axis order decides, not occurrences[0])",
    JSON.stringify(
      mintTokens("s", [reversed], axes, { nestedPairs: true, realizedCombos })
        .tree,
    ) === JSON.stringify(ragged.tree),
  );
}

// ---------------------------------------------------------------------------
// CARRY, DON'T DROP — the literal fallback (MintOptions.literalFallback)
// ---------------------------------------------------------------------------
//
// The beta scoreboard's Radix Button draws its content-container fill as
// f(variant, color, highContrast, state). A nested part mints at most a pair,
// so the fill was REFUSED and dropped: React drew bare text in all 576
// variants. The fallback returns the MEASURED values as a table keyed by the
// smallest axis subset they are a function of; the proposer places it on the
// part as literalsByCombination.
console.log("\nCarry, don't drop (literal fallback)");
{
  const axes4 = [
    { propName: "a", values: ["a1", "a2"] },
    { propName: "b", values: ["b1", "b2"] },
    { propName: "c", values: ["c1", "c2"] },
    { propName: "d", values: ["d1", "d2"] },
  ];
  // value = f(a, b, c), irreducible to any pair (a parity pattern); d is inert.
  const occurrences: Array<{ variant: string; axisValues: Record<string, string>; value: string }> = [];
  for (const a of axes4[0].values)
    for (const b of axes4[1].values)
      for (const c of axes4[2].values)
        for (const d of axes4[3].values) {
          const parity = [a, b, c].filter((v) => v.endsWith("2")).length % 2;
          const hex = `${parity}${a.slice(1)}${b.slice(1)}${c.slice(1)}aa`.padEnd(6, "0");
          occurrences.push({ variant: `${a}${b}${c}${d}`, axisValues: { a, b, c, d }, value: hex });
        }
  const nested = {
    nodePath: "Set:root/box",
    part: "box",
    cssProperty: "background-color",
    kind: "color" as const,
    occurrences,
  };
  const off = mintTokens("s", [nested], axes4, { nestedPairs: true });
  const on = mintTokens("s", [nested], axes4, { nestedPairs: true, literalFallback: true });
  check(
    "a nested three-axis value is still REFUSED as a token (no ref, the named reason is unchanged)",
    on.bindings[0].ref === null && on.bindings[0].reason === off.bindings[0].reason && off.bindings[0].reason !== undefined,
  );
  check(
    "default OFF: the binding carries no literal table (every existing caller is byte-identical)",
    !("literal" in off.bindings[0]),
  );
  const table = on.bindings[0].literal;
  check(
    "ON: the table is keyed by the SMALLEST axis subset (a × b × c — the inert d never multiplies the rows)",
    JSON.stringify(table?.props) === JSON.stringify(["a", "b", "c"]) && table?.rows.length === 8,
  );
  check(
    "ON: every row is the measured value of its combination, spelled as the mint spells it (#rrggbb)",
    occurrences.every((o) =>
      table?.rows.some((r) => r.values.join() === [o.axisValues.a, o.axisValues.b, o.axisValues.c].join() && r.value === `#${o.value}`),
    ),
  );
  check(
    "ON: rows follow DECLARED axis value order, whatever order the dump listed variants in",
    JSON.stringify(
      mintTokens("s", [{ ...nested, occurrences: [...occurrences].reverse() }], axes4, { nestedPairs: true, literalFallback: true })
        .bindings[0].literal,
    ) === JSON.stringify(table) && table?.rows[0].values.join() === "a1,b1,c1",
  );
  check(
    "ON: nothing is minted for the refused channel (no leaf, the table is not a token)",
    on.count === 0 && on.entries.length === 0,
  );
  check(
    "ON: a channel that DOES correlate still mints its token and carries no table",
    (() => {
      const byA = { ...nested, occurrences: occurrences.map((o) => ({ ...o, value: o.axisValues.a === "a1" ? "111111" : "222222" })) };
      const b = mintTokens("s", [byA], axes4, { nestedPairs: true, literalFallback: true }).bindings[0];
      return b.ref === "{imported.s.box.background-color.{a}}" && b.literal === undefined;
    })(),
  );
  check(
    "ON: two occurrences with the SAME full tuple and different values carry no table (nothing can key them)",
    mintTokens("s", [{ ...nested, occurrences: [...occurrences, { ...occurrences[0], variant: "dup", value: "999999" }] }], axes4,
      { nestedPairs: true, literalFallback: true }).bindings[0].literal === undefined,
  );
  check(
    "ON: px values keep the mint's px spelling",
    mintTokens("s", [{ ...nested, cssProperty: "height", kind: "px" as const,
      occurrences: occurrences.map((o, i) => ({ ...o, value: 10 + (i >> 1) })) }], axes4,
      { nestedPairs: true, literalFallback: true }).bindings[0].literal?.rows[0].value === "10px",
  );
}
{
  // Proposal level: the same refusal on a real (synthetic) dump. A nested
  // part's fill = f(tone, size, shape) and its height is FIXED on an
  // auto-layout child that alone fills a hugging root — both used to drop.
  const fills: Record<string, string> = {};
  const tones = ["Neutral", "Accent"], sizes = ["Sm", "Md"], shapes = ["Round", "Square"];
  let n = 0;
  for (const t of tones) for (const s of sizes) for (const sh of shapes) {
    const parity = [t === "Accent", s === "Md", sh === "Square"].filter(Boolean).length % 2;
    fills[`${t}/${s}/${sh}`] = parity ? `a0${String(n++).padStart(2, "0")}ff` : `0${String(n++).padStart(2, "0")}0aa`;
  }
  const v3 = (t: string, s: string, sh: string): DumpNode => ({
    name: `Tone=${t}, Size=${s}, Shape=${sh}`,
    type: "COMPONENT",
    bbox: { width: 80, height: s === "Sm" ? 28 : 36 },
    layout: { mode: "VERTICAL", primary: "MIN", counter: "MIN", spacing: 0, padding: [2, 0, 2, 0], primarySizing: "AUTO", counterSizing: "AUTO" },
    children: [{
      name: "box",
      type: "FRAME",
      fill: { hex: fills[`${t}/${s}/${sh}`] },
      layout: { mode: "HORIZONTAL", primary: "CENTER", counter: "CENTER", spacing: 4, padding: [0, 8, 0, 8], primarySizing: "AUTO", counterSizing: "FIXED" },
      children: [{ name: "label", type: "TEXT", fill: { hex: "101010" }, text: { characters: "Go", fontSize: 13, fontStyle: "Medium" } }],
    }],
  });
  const set3: DumpSet = {
    setName: "Carry",
    type: "COMPONENT_SET",
    variants: tones.flatMap((t) => sizes.flatMap((s) => shapes.map((sh) => v3(t, s, sh)))),
  };
  const p = proposeFromDump(set3, { ...opts, mintUnbound: true });
  const box = ((p.contract.anatomy as Record<string, any>).root.parts as Record<string, any>).box;
  const table = box?.literalsByCombination?.[0];
  check(
    "proposal: the refused nested fill is CARRIED as literalsByCombination (tone × size × shape, 8 rows)",
    JSON.stringify(table?.props) === JSON.stringify(["tone", "size", "shape"]) && table?.rows.length === 8 &&
      table.rows.every((r: { literals: Record<string, string> }) => /^#[0-9a-f]{6}$/.test(r.literals["background-color"])) &&
      new Set(table.rows.map((r: { literals: Record<string, string> }) => r.literals["background-color"])).size === 8,
  );
  check(
    "proposal: the carriage is NAMED as an untokenized literal, never as a minted token",
    p.notes.some((x) => x.includes("Carry:root/box background-color: CARRIED AS AN UNTOKENIZED LITERAL")) &&
      !p.notes.some((x) => x.includes("Carry:root/box background-color:") && x.includes("nothing minted")),
  );
  check(
    "proposal: the FIXED child height (root box − padding: 24/32px) rides the mint as a per-size token",
    box?.tokens?.height === "{imported.carry.box.height.{size}}" &&
      p.mintedTokens?.entries.some((e) => e.ref === "{imported.carry.box.height.sm}" && e.value === "24px") === true &&
      p.mintedTokens?.entries.some((e) => e.ref === "{imported.carry.box.height.md}" && e.value === "32px") === true,
  );
  check(
    "proposal: the height is receipted as CARRIED, no longer FC-GEOMETRY-EXCLUDED",
    p.notes.some((x) => x.includes("Carry:root/box") && x.includes("CARRIED (fidelity first)")) &&
      !p.notes.some((x) => x.includes("Carry:root/box") && x.includes("FC-GEOMETRY-EXCLUDED (Option B)")),
  );
  const c3: Contract = ContractSchema.parse(p.contract);
  const ctx3 = {
    tokens: tokenInventoryFromJson([
      read("tokens/primitives.tokens.json"),
      read("tokens/semantic.tokens.json"),
      read("tokens/modes/semantic.light.tokens.json"),
      read("tokens/modes/semantic.dark.tokens.json"),
      p.mintedTokens?.tree ?? {},
    ]),
    icons: new Map<string, string>(),
    contracts: new Map([[c3.id, c3]]),
  };
  let css3 = "";
  try {
    css3 = emitReact(c3, ctx3).css;
  } catch (e) {
    console.error(String(e));
  }
  const accentMdSquare = table?.rows.find((r: { values: string[] }) => r.values.join() === "accent,md,square");
  check(
    "generation: the CSS carries one compound rule per drawn combination with its measured fill",
    accentMdSquare !== undefined &&
      css3.includes(`.tone-accent.size-md.shape-square .box {\n  background-color: ${accentMdSquare.literals["background-color"]};\n}`),
  );
  check(
    "generation: resolveLiterals (canvas + per-variant surfaces) picks the same row, and an omitted prop matches none",
    resolveLiterals(c3.anatomy.root.parts!.box, { tone: "accent", size: "md", shape: "square" })["background-color"] ===
      accentMdSquare?.literals["background-color"] &&
      resolveLiterals(c3.anatomy.root.parts!.box, { tone: "accent", size: "md" })["background-color"] === undefined,
  );
  check(
    "proposal: deterministic (same dump, same contract bytes)",
    JSON.stringify(proposeFromDump(set3, { ...opts, mintUnbound: true }).contract) === JSON.stringify(p.contract),
  );
}

console.log("\nNamed text-style identity");
{
  const styled = mintTokens(
    "styled",
    [
      {
        nodePath: "Styled:label",
        part: "label",
        cssProperty: "font-size",
        kind: "px",
        styleName: "Text sm/Semibold",
        styleKey: "published-style-key",
        occurrences: [
          {
            variant: "Size=sm",
            axisValues: {},
            value: 14,
          },
        ],
      },
    ],
    [],
  );
  const leaf = (
    (
      (
        (styled.tree.imported as Record<string, unknown>).text as Record<
          string,
          unknown
        >
      )["text-sm-semibold"] as Record<string, unknown>
    )["font-size"] as Record<string, unknown>
  );
  check(
    "minted typography retains exact text-style name and published key in DTCG extensions",
    JSON.stringify(leaf.$extensions) ===
      JSON.stringify({
        dsContracts: {
          textStyle: {
            name: "Text sm/Semibold",
            key: "published-style-key",
          },
        },
      }),
  );
}

console.log("\nPer-variant text-style identity (no silent sanitization)");
{
  // Avatar-shaped: size axis carries a DIFFERENT named text style per value.
  // Identity must ride each leaf — collapsing to a sanitized machine path
  // without metadata is the R3 silent-loss class.
  const varying = mintTokens(
    "avatar",
    [
      {
        nodePath: "Avatar:text",
        part: "text",
        cssProperty: "font-size",
        kind: "px",
        occurrences: [
          {
            variant: "Size=xs",
            axisValues: { size: "xs" },
            value: 12,
            styleName: "Text xs/Medium",
            styleKey: "key-xs",
          },
          {
            variant: "Size=xl",
            axisValues: { size: "xl" },
            value: 20,
            styleName: "Text xl/Medium",
            styleKey: "key-xl",
          },
          {
            variant: "Size=2xl",
            axisValues: { size: "2xl" },
            value: 24,
            styleName: "Display xs/Medium",
          },
        ],
      },
    ],
    [{ propName: "size", values: ["xs", "xl", "2xl"] }],
  );
  const fontSize = (
    (
      (varying.tree.imported as Record<string, unknown>).avatar as Record<
        string,
        unknown
      >
    ).text as Record<string, unknown>
  )["font-size"] as Record<string, Record<string, unknown>>;
  check(
    "per-variant font-size leaves keep the exact style name (not a sanitized path alone)",
    JSON.stringify(
      (fontSize.xs as { $extensions?: unknown }).$extensions,
    ) ===
      JSON.stringify({
        dsContracts: { textStyle: { name: "Text xs/Medium", key: "key-xs" } },
      }) &&
      JSON.stringify(
        (fontSize.xl as { $extensions?: unknown }).$extensions,
      ) ===
        JSON.stringify({
          dsContracts: {
            textStyle: { name: "Text xl/Medium", key: "key-xl" },
          },
        }) &&
      JSON.stringify(
        (fontSize["2xl"] as { $extensions?: unknown }).$extensions,
      ) ===
        JSON.stringify({
          dsContracts: { textStyle: { name: "Display xs/Medium" } },
        }),
  );
  check(
    "per-variant style identity does not invent a single imported.text.* group",
    (varying.tree.imported as Record<string, unknown>).text === undefined,
  );
}

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} minting invariant(s) failed`);
  process.exit(1);
}
console.log(
  "\n✔ all minting invariants hold (dedupe, per-variant, refusal, determinism, generation)",
);
