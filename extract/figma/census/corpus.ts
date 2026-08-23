/**
 * CANVAS CENSUS — the corpus, the denominator, the sample.
 *
 * The owner's v1 bar (2026-08-23): "generate canvas Figma designs from
 * contracts; the contract mediates and adjudicates the code and the canvas."
 * v1 is done when, for EVERY committed contract in the corpus, (1) contract →
 * canvas mints a recognisable set, (2) dump → propose round-trips to the same
 * contract, (3) code and canvas agree on every carried fact.
 *
 * This module answers ONE question deterministically: what is "every
 * committed contract in the corpus"? The answer is the manifest
 * (parity/receipts/v1/census-manifest.json), and the manifest is the
 * DENOMINATOR of the census gate — a contract that exists on disk but is not a
 * manifest row makes the gate refuse (scripts/canvas-census-check.ts), so a
 * set can never drop out of the census silently.
 *
 * CORPUS RULE (docs/23 §C.1.1 vocabulary; the owner's enumeration):
 *   · first-party: every contracts/*.contract.json whose generated Figma
 *     script exists in figma-sync/ (scripts/generate-figma.ts emits
 *     NN-<name>.js for every contract except representation "native").
 *   · example libraries: every examples/<lib>/contracts/*.contract.json for
 *     every <lib> that carries examples/<lib>/figma/*.figma.js or a
 *     examples/<lib>/figma/<lib>.bundle.json.
 *   Anything that matches neither rule is listed under `excluded` WITH its
 *   reason — the manifest names what it leaves out.
 *
 * VARIANT SAMPLE (deterministic, recorded per row): the engine's own cell
 * enumeration (canvas-gate/compile.ts deriveCells — the SAME order the Figma
 * script draws), sampled as: the all-defaults cell, then for every enum axis
 * every non-default value with the other axes at their defaults (every axis
 * value appears at least once), then one state-preview cell per contract
 * state at the primary axis's default. Capped per set at SAMPLE_CAP; when the
 * cap cuts, `cap.dropped` names how many and `axisCoverageComplete` says
 * whether every axis value survived the cut.
 *
 * FILE NAMES shared by both halves (the code half renders them, the canvas
 * half must meet them): `code-<slug>.png` / `canvas-<slug>.png`, where
 * <slug> = variantSlug(compiled variant name). The per-row code-render.json
 * lists every slug with its compiled variant name so the canvas half matches
 * by name, never by guessing the slug rule.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  ContractSchema,
  type Contract,
} from "../../../scripts/contract-schema.js";
import {
  createFigmaEngine,
  type ComponentData,
} from "../../../core/emit-figma-script.js";
import { mintedTokenCss, tokenInventoryFromJson } from "../../../core/index.js";
import { cssValueOf, cssVarName } from "../../../core/emit-tokens-css.js";
import { parseTokenSet, tokenSetTokenTrees } from "../../../core/token-set.js";
import { deriveCells, type Cell } from "../canvas-gate/compile.js";
import { loadCatalogWorld } from "../catalog-visual/world.js";

export const REPO = path.resolve(
  new URL(".", import.meta.url).pathname,
  "../../..",
);
export const MANIFEST_PATH = "parity/receipts/v1/census-manifest.json";
export const CENSUS_DIR = "parity/receipts/v1/census";
export const RECEIPT_PATH = "parity/receipts/v1/CANVAS-CENSUS.md";
export const FIRST_PARTY = "first-party";
/** Sampled variants per set. Recorded in every row; a cut is named, never silent. */
export const SAMPLE_CAP = 24;

const readJson = (p: string) =>
  JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Archetype class — docs/23 §C.1.1 vocabulary, applied by contract name
// ---------------------------------------------------------------------------

/** The twenty §C.1.1 rows plus the doc's own residue class. The doc maps
 *  contracts to rows by NAME (its words: "every row maps to committed contract
 *  files"), so this is the same mapping written down as first-match keyword
 *  rules over the kebab-cased contract name. `unmapped` is the doc's stated
 *  residue ("typography, rules, glyphs and images rather than component
 *  archetypes"), listed, never hidden. */
export type Archetype =
  | "button"
  | "badge / tag / chip"
  | "checkbox / radio"
  | "toggle / switch"
  | "banner / alert / toast"
  | "input / field"
  | "card"
  | "avatar"
  | "tabs"
  | "accordion"
  | "progress / spinner"
  | "slider"
  | "select / combobox"
  | "modal / dialog"
  | "tooltip / popover"
  | "menu / dropdown"
  | "pagination"
  | "table / data-grid"
  | "breadcrumb"
  | "nav (top / side)"
  | "unmapped";

const ARCHETYPE_RULES: Array<[RegExp, Archetype]> = [
  [/breadcrumb/, "breadcrumb"],
  [/(^|-)(top|side)-?nav|(^|-)nav($|-)/, "nav (top / side)"],
  [/pagination/, "pagination"],
  [/(^|-)table|data-?grid/, "table / data-grid"],
  [/select|combobox|autocomplete|typeahead/, "select / combobox"],
  [/modal|dialog|drawer/, "modal / dialog"],
  [/tooltip|popover/, "tooltip / popover"],
  [/menu|dropdown/, "menu / dropdown"],
  [/(^|-)tabs?($|-)|tab-?list/, "tabs"],
  [/accordion/, "accordion"],
  [/progress|spinner|skeleton/, "progress / spinner"],
  [/slider/, "slider"],
  [/switch|toggle/, "toggle / switch"],
  [/checkbox|radio/, "checkbox / radio"],
  [/banner|alert|toast|notification|snackbar/, "banner / alert / toast"],
  [/badge|(^|-)tag($|-)|chip/, "badge / tag / chip"],
  [/input|field|text-?area/, "input / field"],
  [/(^|-)card($|-)/, "card"],
  [/avatar/, "avatar"],
  [/button|(^|-)fab($|-)/, "button"],
];

export const kebabName = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

export function archetypeOf(
  contract: Pick<Contract, "id" | "name">,
): Archetype {
  const keys = [
    kebabName(contract.name),
    kebabName(contract.id.split(".").slice(1).join(".")),
  ];
  for (const [re, a] of ARCHETYPE_RULES)
    if (keys.some((k) => re.test(k))) return a;
  return "unmapped";
}

// ---------------------------------------------------------------------------
// Libraries
// ---------------------------------------------------------------------------

export interface CensusLibrary {
  library: string;
  /** Repo-relative directory holding the committed contracts. */
  contractsDir: string;
  /** Repo-relative directory holding the committed Figma scripts. */
  figmaDir: string;
  /** Repo-relative CONTRACTS-BUNDLE path, or null (first-party builds its
   *  bundle on demand — core/first-party-bundle-check.ts). */
  bundlePath: string | null;
}

export interface ExcludedEntry {
  what: string;
  reason: string;
}

/** Every library in the corpus, in receipt order (first-party, then
 *  examples/<lib> alphabetically), plus everything under examples/ that is
 *  NOT a library by the corpus rule, with the reason. */
export function enumerateLibraries(): {
  libraries: CensusLibrary[];
  excluded: ExcludedEntry[];
} {
  const libraries: CensusLibrary[] = [
    {
      library: FIRST_PARTY,
      contractsDir: "contracts",
      figmaDir: "figma-sync",
      bundlePath: null,
    },
  ];
  const excluded: ExcludedEntry[] = [];
  for (const lib of readdirSync(path.join(REPO, "examples")).sort()) {
    const dir = path.join(REPO, "examples", lib);
    if (!existsSync(path.join(dir, "contracts"))) {
      const stray = readdirSync(dir).filter((f) =>
        f.endsWith(".contract.json"),
      );
      excluded.push({
        what: `examples/${lib}`,
        reason:
          stray.length > 0
            ? `no examples/${lib}/contracts/ directory — ${stray.join(", ")} is a receipt-bound demo contract outside the library layout, not a library corpus`
            : `no examples/${lib}/contracts/ directory — not a contract library`,
      });
      continue;
    }
    const figmaDir = path.join(dir, "figma");
    const scripts = existsSync(figmaDir)
      ? readdirSync(figmaDir).filter((f) => f.endsWith(".figma.js"))
      : [];
    const bundle = path.join(figmaDir, `${lib}.bundle.json`);
    if (scripts.length === 0 && !existsSync(bundle)) {
      excluded.push({
        what: `examples/${lib}`,
        reason: `examples/${lib}/contracts/ exists but the library carries no examples/${lib}/figma/*.figma.js and no ${lib}.bundle.json — contract → canvas was never emitted for it`,
      });
      continue;
    }
    libraries.push({
      library: lib,
      contractsDir: `examples/${lib}/contracts`,
      figmaDir: `examples/${lib}/figma`,
      bundlePath: existsSync(bundle)
        ? `examples/${lib}/figma/${lib}.bundle.json`
        : null,
    });
  }
  return { libraries, excluded };
}

// ---------------------------------------------------------------------------
// Worlds — contracts + the SAME token layer the canvas is minted from
// ---------------------------------------------------------------------------

export interface LibraryWorld {
  library: CensusLibrary;
  contracts: Contract[];
  byId: Map<string, Contract>;
  engine: ReturnType<typeof createFigmaEngine>;
  inventory: Set<string>;
  /** :root stylesheet resolving every var(--…) the CSS surface emits. */
  tokenCss: string;
  icons: Map<string, string>;
  /** Where the token layer came from — recorded in every row's JSON. */
  tokenSource: string;
}

function flatTokenCss(flat: Record<string, unknown>, label: string): string {
  const lines = [`/* ${label} */`, ":root {"];
  for (const [name, entry] of Object.entries(flat).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const value =
      entry &&
      typeof entry === "object" &&
      "$value" in (entry as Record<string, unknown>)
        ? (entry as Record<string, unknown>).$value
        : entry;
    const css = cssValueOf(value);
    if (css !== null) lines.push(`  ${cssVarName(name)}: ${css};`);
  }
  lines.push("}");
  return lines.join("\n");
}

const worldCache = new Map<string, LibraryWorld>();

/** First-party: the catalog world (contracts/, tokens/, assets/icons,
 *  src/styles/tokens.css — extract/figma/catalog-visual/world.ts, reused).
 *  Example library: the committed CONTRACTS-BUNDLE's tokenSet + icons — the
 *  plugin compiles a paste from exactly these (core/token-set.ts
 *  tokenSetTokenTrees), so the code render resolves the same layer the
 *  canvas set is minted from. Contracts are read from the committed
 *  contracts dir (the bundle is derived from it; flowbite-bundle-fresh:check
 *  and figma:fresh hold them byte-equal). */
export function loadLibraryWorld(library: CensusLibrary): LibraryWorld {
  const cached = worldCache.get(library.library);
  if (cached) return cached;
  let world: LibraryWorld;
  if (library.library === FIRST_PARTY) {
    const w = loadCatalogWorld();
    world = {
      library,
      contracts: w.contracts,
      byId: w.byId,
      engine: w.engine,
      inventory: w.inventory,
      tokenCss: w.tokenCss,
      icons: w.icons,
      tokenSource:
        "tokens/ (layered primitives + brand + semantic + light/dark) via src/styles/tokens.css",
    };
  } else {
    if (!library.bundlePath) {
      throw new Error(
        `${library.library}: no ${library.library}.bundle.json — the census has no token layer to render against (emit the bundle with \`ds-contracts figma bundle\`)`,
      );
    }
    const bundle = readJson(path.join(REPO, library.bundlePath));
    const parsed = parseTokenSet(bundle.tokenSet);
    if (!parsed.ok) throw new Error(`${library.bundlePath}: ${parsed.error}`);
    const tokenSet = parsed.tokenSet;
    const trees = tokenSetTokenTrees(tokenSet);
    const icons = new Map<string, string>(
      Object.entries((bundle.icons ?? {}) as Record<string, string>).sort(
        ([a], [b]) => a.localeCompare(b),
      ),
    );
    const contracts = readdirSync(path.join(REPO, library.contractsDir))
      .filter((f) => f.endsWith(".contract.json"))
      .sort()
      .map((f) =>
        ContractSchema.parse(
          readJson(path.join(REPO, library.contractsDir, f)),
        ),
      );
    const cssBlocks: string[] = [];
    if (tokenSet.layers) {
      // A layered set: one :root per slot, light mode last (emit-tokens-css order).
      for (const slot of ["primitives", "semantic", "light"] as const) {
        const tree = tokenSet.layers[slot];
        if (tree && Object.keys(tree).length > 0)
          cssBlocks.push(mintedTokenCss(tree as Record<string, unknown>));
      }
      for (const [name, tree] of Object.entries(tokenSet.layers.brands ?? {})) {
        if (tree && Object.keys(tree).length > 0)
          cssBlocks.push(
            `/* brand ${name} */\n${mintedTokenCss(tree as Record<string, unknown>)}`,
          );
      }
    } else {
      cssBlocks.push(flatTokenCss(tokenSet.base, `${tokenSet.name} base`));
      if (tokenSet.modes?.light)
        cssBlocks.push(
          flatTokenCss(tokenSet.modes.light, `${tokenSet.name} light mode`),
        );
      if (tokenSet.minted)
        cssBlocks.push(
          `/* ${tokenSet.name} minted (imported.*) */\n${mintedTokenCss(tokenSet.minted)}`,
        );
    }
    world = {
      library,
      contracts,
      byId: new Map(contracts.map((c) => [c.id, c])),
      engine: createFigmaEngine({ tokens: trees, icons }),
      inventory: tokenInventoryFromJson([
        trees.primitives,
        trees.semantic,
        trees.light,
        trees.dark,
        ...Object.values(trees.brands ?? {}),
      ]),
      tokenCss: cssBlocks.join("\n"),
      icons,
      tokenSource: `${library.bundlePath} tokenSet (${tokenSet.layers ? "layered" : `flat base${tokenSet.minted ? " + minted" : ""}${tokenSet.modes?.light ? " + light mode" : ""}`})`,
    };
  }
  worldCache.set(library.library, world);
  return world;
}

// ---------------------------------------------------------------------------
// Manifest rows
// ---------------------------------------------------------------------------

export interface ManifestRow {
  id: string;
  name: string;
  library: string;
  contractPath: string;
  figmaScriptPath: string;
  bundlePath: string | null;
  archetype: Archetype;
  /** Enum props = variant axes. */
  variantAxes: number;
  axes: Array<{ prop: string; figmaProperty: string; values: string[] }>;
  /** Base variants the engine compiles (the full axis cross); state-preview
   *  variants counted separately. `compile: refused` rows carry the engine's
   *  own refusal text. */
  variantCount: number | null;
  stateVariantCount: number | null;
  compileRefusal: string | null;
  /** `"row":` occurrences in the committed script — the drawn variant count
   *  (a curated canvas projection, e.g. polaris.text, draws fewer than the
   *  compile). */
  scriptVariantRows: number;
}

/** DESIGN→CODE half (source = canvas): one row per component set on the two
 *  designer-kit fixtures (extract/figma/fixtures/census-d2c). Enumerated from
 *  the committed fixtures alone — deterministic, no network. */
export interface D2cManifestRow {
  kit: string;
  /** Proposed contract id — the ds_contracts/contractId stamp when the set
   *  is pipeline-drawn, else the proposer's own slug rule. */
  id: string;
  setName: string;
  nodeId: string;
  source: "canvas";
  mode: "exact" | "reviewable-inversion";
  variantCount: number;
  variantAxes: number;
}

export interface D2cManifestKit {
  kit: string;
  fileKey: string;
  fixture: string;
  mode: "exact" | "reviewable-inversion";
  sets: number;
}

export interface CensusManifest {
  _header: string;
  rule: string;
  sampleRule: string;
  sampleCap: number;
  libraries: Array<CensusLibrary & { contracts: number }>;
  rows: ManifestRow[];
  excluded: ExcludedEntry[];
  /** The design→code census denominator (census:check --phase design-to-code). */
  designToCode: { kits: D2cManifestKit[]; rows: D2cManifestRow[] };
}

const isEnum = (
  p: Contract["props"][number],
): p is Contract["props"][number] & { type: { enum: string[] } } =>
  typeof p.type === "object" && "enum" in p.type;

/** The committed Figma script that draws this contract: the file under the
 *  library's figma dir whose COMPONENTS literal carries this contractId. Batch
 *  and genesis scripts (many sets per file) are not a set's own script. */
export function findFigmaScript(
  library: CensusLibrary,
  contractId: string,
): string | null {
  const dir = path.join(REPO, library.figmaDir);
  if (!existsSync(dir)) return null;
  const needle = `"contractId": ${JSON.stringify(contractId)}`;
  const candidates = readdirSync(dir)
    .filter(
      (f) =>
        f.endsWith(".js") &&
        !/^batch-\d+\.js$/.test(f) &&
        f !== "GENESIS-BATCH.figma.js" &&
        f !== "arrange.js",
    )
    .sort();
  for (const f of candidates) {
    const text = readFileSync(path.join(dir, f), "utf8");
    if (text.includes(needle)) return `${library.figmaDir}/${f}`;
  }
  return null;
}

export interface CorpusRow {
  library: CensusLibrary;
  contract: Contract;
  row: ManifestRow;
}

/** The whole corpus: every manifest row with its contract, plus the
 *  exclusions. Deterministic — same tree, same bytes. */
export function enumerateCorpus(): {
  manifest: CensusManifest;
  corpus: CorpusRow[];
} {
  const { libraries, excluded } = enumerateLibraries();
  const rows: CorpusRow[] = [];
  const libSummary: CensusManifest["libraries"] = [];
  for (const library of libraries) {
    const dir = path.join(REPO, library.contractsDir);
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".contract.json"))
      .sort();
    let count = 0;
    for (const f of files) {
      const contractPath = `${library.contractsDir}/${f}`;
      const contract = ContractSchema.parse(readJson(path.join(dir, f)));
      const script = findFigmaScript(library, contract.id);
      if (!script) {
        excluded.push({
          what: contractPath,
          reason:
            contract.bindings.figma.representation === "native"
              ? `bindings.figma.representation is "native" — scripts/generate-figma.ts emits no set for it (maps to a native canvas capability)`
              : `no committed Figma script in ${library.figmaDir}/ carries contractId ${contract.id}`,
        });
        continue;
      }
      const axes = contract.props.filter(isEnum).map((p) => ({
        prop: p.name,
        figmaProperty: p.bindings.figma.property ?? p.name,
        values: [...p.type.enum],
      }));
      let variantCount: number | null = null;
      let stateVariantCount: number | null = null;
      let compileRefusal: string | null = null;
      try {
        const world = loadLibraryWorld(library);
        const data = world.engine.compileComponentData(contract, world.byId);
        variantCount = data.variants.length;
        stateVariantCount = data.stateVariants?.length ?? 0;
      } catch (e) {
        compileRefusal = (e instanceof Error ? e.message : String(e)).split(
          "\n",
        )[0];
      }
      const scriptText = readFileSync(path.join(REPO, script), "utf8");
      const row: ManifestRow = {
        id: contract.id,
        name: contract.name,
        library: library.library,
        contractPath,
        figmaScriptPath: script,
        bundlePath: library.bundlePath,
        archetype: archetypeOf(contract),
        variantAxes: axes.length,
        axes,
        variantCount,
        stateVariantCount,
        compileRefusal,
        scriptVariantRows: (scriptText.match(/"row": \d+/g) ?? []).length,
      };
      rows.push({ library, contract, row });
      count++;
    }
    libSummary.push({ ...library, contracts: count });
  }
  const designToCode = enumerateDesignToCode();
  const manifest: CensusManifest = {
    _header:
      "CANVAS CENSUS MANIFEST — the denominator. GENERATED by extract/figma/census/corpus.ts (`npm run census:check -- --write-manifest`); " +
      "scripts/canvas-census-check.ts regenerates it in memory on every run and REFUSES when the committed file disagrees — " +
      "a contract that exists on disk but is not a row here fails the gate by name.",
    rule:
      "first-party: contracts/*.contract.json with a generated figma-sync/NN-<name>.js; examples/<lib>/contracts/*.contract.json for every <lib> " +
      "carrying examples/<lib>/figma/*.figma.js or <lib>.bundle.json. Everything else is listed under `excluded` with its reason.",
    sampleRule:
      "all-defaults cell, then every non-default value of every enum axis with the other axes at default (every axis value at least once), " +
      "then one state-preview cell per contract state; engine cell order (canvas-gate/compile.ts deriveCells); capped at sampleCap per set — a cut is recorded in the row JSON.",
    sampleCap: SAMPLE_CAP,
    libraries: libSummary,
    rows: rows.map((r) => r.row),
    excluded,
    designToCode,
  };
  return { manifest, corpus: rows };
}

// ---------------------------------------------------------------------------
// The variant sample
// ---------------------------------------------------------------------------

export interface SampledCell {
  slug: string;
  cell: Cell;
  /** Index into the cell array — the engine's own position. */
  index: number;
  /** Boolean props this cell pins (a boolean bound as a VARIANT axis —
   *  astryx.switch `value` → "Value=On/Off"). Empty on the deriveCells path. */
  bools: Record<string, boolean>;
}

export interface VariantSample {
  cells: SampledCell[];
  cap: { limit: number; derived: number; sampled: number; dropped: number };
  axisCoverageComplete: boolean;
  /** Which enumeration produced the cells — recorded in the row receipt. */
  derivation: "deriveCells" | `compiled-name-parse (${string})`;
}

/** FALLBACK ENUMERATION — the compiled variant names, parsed back through the
 *  contract's own bindings. canvas-gate/compile.ts deriveCells models enum
 *  props as the only variant axes and THROWS on drift; a boolean prop bound
 *  `kind: VARIANT` (astryx.switch `value` → "Value=Off, Label Position=End")
 *  is a real axis the engine draws, so the census reads the engine's names
 *  instead of refusing the set. Each `Prop=Value` segment maps to the prop
 *  whose bindings.figma.property is `Prop`; enum values invert
 *  bindings.figma.values, boolean values invert the true/false map, and a
 *  `State=…` segment names a contract state (label → kebab). A segment that
 *  maps to nothing is a refusal by name. */
function cellsFromCompiledNames(
  contract: Contract,
  data: ComponentData,
): { cells: Cell[]; bools: Array<Record<string, boolean>> } {
  const byProperty = new Map(
    contract.props.map((p) => [p.bindings.figma.property, p] as const),
  );
  const kebab = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const stateByLabel = new Map(
    contract.states.map((s) => [kebab(s), s] as const),
  );
  const cells: Cell[] = [];
  const bools: Array<Record<string, boolean>> = [];
  const all = [
    ...data.variants.map((v) => ({ v, kind: "base" as const })),
    ...(data.stateVariants ?? []).map((v) => ({ v, kind: "state" as const })),
  ];
  for (const { v, kind } of all) {
    const subst: Record<string, string> = {};
    const b: Record<string, boolean> = {};
    let state: string | undefined;
    for (const seg of v.name.split(", ")) {
      const eq = seg.indexOf("=");
      if (eq < 0) continue;
      const property = seg.slice(0, eq);
      const value = seg.slice(eq + 1);
      if (property === "State") {
        state = stateByLabel.get(kebab(value));
        if (!state)
          throw new Error(
            `${contract.id}: compiled variant "${v.name}" names state "${value}", which the contract does not declare`,
          );
        continue;
      }
      const prop = byProperty.get(property);
      if (!prop)
        throw new Error(
          `${contract.id}: compiled variant "${v.name}" segment "${seg}" maps to no prop (bindings.figma.property)`,
        );
      const values =
        (prop.bindings.figma as { values?: Record<string, string> }).values ??
        {};
      const inverse =
        Object.entries(values).find(([, drawn]) => drawn === value)?.[0] ??
        value;
      if (prop.type === "boolean") b[prop.name] = inverse === "true";
      else subst[prop.name] = inverse;
    }
    cells.push({
      name: v.name,
      kind,
      ...(state ? { state } : {}),
      subst,
      spec: v.spec,
    });
    bools.push(b);
  }
  return { cells, bools };
}

/** `Color=Info, Size=Xs` → `color-info__size-xs`; `…, State=Focus Visible` →
 *  `…__state-focus-visible`. Lower-case, `=` → `-`, `, ` → `__`, any other
 *  run of non [a-z0-9] → `-`. Stable and reversible through the row JSON. */
export function variantSlug(name: string): string {
  return name
    .split(", ")
    .map((seg) =>
      seg
        .toLowerCase()
        .replace(/=/g, "-")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .join("__");
}

export function sampleVariants(
  contract: Contract,
  data: ComponentData,
): VariantSample {
  let cells: Cell[];
  let cellBools: Array<Record<string, boolean>>;
  let derivation: VariantSample["derivation"];
  try {
    cells = deriveCells(contract, data);
    cellBools = cells.map(() => ({}));
    derivation = "deriveCells";
  } catch (e) {
    const drift = (e instanceof Error ? e.message : String(e)).split("\n")[0];
    const parsed = cellsFromCompiledNames(contract, data);
    cells = parsed.cells;
    cellBools = parsed.bools;
    derivation = `compiled-name-parse (${drift})`;
  }
  // Axis values as strings — a boolean VARIANT axis counts like an enum one.
  const axisValues = (i: number): Record<string, string> => ({
    ...cells[i].subst,
    ...Object.fromEntries(
      Object.entries(cellBools[i]).map(([k, v]) => [k, String(v)]),
    ),
  });
  const base = cells
    .map((c, i) => (c.kind === "base" ? i : -1))
    .filter((i) => i >= 0);
  const picked: number[] = [];
  const pick = (i: number) => {
    if (!picked.includes(i)) picked.push(i);
  };
  if (base.length > 0) pick(base[0]);
  const defaults = base.length > 0 ? axisValues(base[0]) : {};
  const axisProps = Object.keys(defaults);
  for (const prop of axisProps) {
    const seen = new Set<string>([defaults[prop]]);
    for (const i of base) {
      const av = axisValues(i);
      if (seen.has(av[prop])) continue;
      const othersDefault = axisProps.every(
        (o) => o === prop || av[o] === defaults[o],
      );
      if (!othersDefault) continue;
      seen.add(av[prop]);
      pick(i);
    }
  }
  const stateSeen = new Set<string>();
  cells.forEach((c, i) => {
    if (c.kind !== "state" || !c.state || stateSeen.has(c.state)) return;
    stateSeen.add(c.state);
    pick(i);
  });
  const ordered = [...picked].sort((a, b) => a - b);
  const kept = ordered.slice(0, SAMPLE_CAP);
  const covered = new Map<string, Set<string>>();
  for (const i of kept)
    for (const [p, v] of Object.entries(axisValues(i)))
      (covered.get(p) ?? covered.set(p, new Set()).get(p)!).add(v);
  const axisCoverageComplete = axisProps.every((p) => {
    const declared = contract.props.find((x) => x.name === p);
    const values =
      declared && isEnum(declared) ? declared.type.enum : ["true", "false"];
    return values.every((v) => covered.get(p)?.has(v));
  });
  return {
    cells: kept.map((i) => ({
      slug: variantSlug(cells[i].name),
      cell: cells[i],
      index: i,
      bools: cellBools[i],
    })),
    cap: {
      limit: SAMPLE_CAP,
      derived: cells.length,
      sampled: kept.length,
      dropped: ordered.length - kept.length,
    },
    axisCoverageComplete,
    derivation,
  };
}

// ---------------------------------------------------------------------------
// DESIGN→CODE denominator — every component set on the committed designer-kit
// fixtures (extract/figma/fixtures/census-d2c/<kit>.rest-nodes.json). The
// pipeline half lives in extract/figma/census/design-to-code.ts; this
// enumeration is manifest-cheap (no propose, no generate): identity from the
// ds_contracts stamp when present, else the proposer's own slug rule.
// ---------------------------------------------------------------------------

/** Kit definitions mirrored from design-to-code.ts (kept here so the
 *  manifest enumeration does not pull the propose/generate dependency
 *  graph into every census run). design-to-code.ts asserts the mirror. */
export const D2C_MANIFEST_KITS: ReadonlyArray<{
  kit: string;
  fileKey: string;
  mode: "exact" | "reviewable-inversion";
}> = [
  { kit: "flowbite", fileKey: "59mLQlOMiD5w5za6SUcoO5", mode: "exact" },
  {
    kit: "figma-ds",
    fileKey: "aekVseUceg35tVn62knRrj",
    mode: "reviewable-inversion",
  },
];

const d2cSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "c";

export function enumerateDesignToCode(): CensusManifest["designToCode"] {
  const kits: D2cManifestKit[] = [];
  const rows: D2cManifestRow[] = [];
  for (const def of D2C_MANIFEST_KITS) {
    const fixture = `extract/figma/fixtures/census-d2c/${def.kit}.rest-nodes.json`;
    const raw = readJson(path.join(REPO, fixture)) as unknown as {
      nodes: Record<
        string,
        {
          document: {
            id: string;
            name: string;
            type: string;
            children?: Array<{ name: string }>;
            componentPropertyDefinitions?: Record<string, { type: string }>;
            sharedPluginData?: Record<string, Record<string, string>>;
          };
        } | null
      >;
    };
    let sets = 0;
    for (const entry of Object.values(raw.nodes)) {
      if (!entry) continue;
      const doc = entry.document;
      if (doc.type !== "COMPONENT_SET" && doc.type !== "COMPONENT") continue;
      const stamped = doc.sharedPluginData?.ds_contracts?.contractId;
      const axes = Object.values(doc.componentPropertyDefinitions ?? {}).filter(
        (d) => d.type === "VARIANT",
      ).length;
      rows.push({
        kit: def.kit,
        id:
          typeof stamped === "string" && stamped !== ""
            ? stamped
            : `ds.${d2cSlug(doc.name)}`,
        setName: doc.name,
        nodeId: doc.id,
        source: "canvas",
        mode: def.mode,
        variantCount:
          doc.type === "COMPONENT_SET" ? (doc.children ?? []).length : 1,
        variantAxes: axes,
      });
      sets++;
    }
    kits.push({
      kit: def.kit,
      fileKey: def.fileKey,
      fixture,
      mode: def.mode,
      sets,
    });
  }
  rows.sort((a, b) =>
    a.kit === b.kit ? (a.setName < b.setName ? -1 : 1) : a.kit < b.kit ? -1 : 1,
  );
  return { kits, rows };
}
