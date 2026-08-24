/**
 * CANVAS CENSUS — the CODE-RENDER half.
 *
 *   npx tsx extract/figma/census/render.ts [--library <lib>] [--id <contract id>]
 *
 * For every manifest row (extract/figma/census/corpus.ts enumerateCorpus),
 * render the sampled variants of the contract's CODE surface and write:
 *
 *   parity/receipts/v1/census/<lib>/<id>/code-<slug>.png     one per sampled variant
 *   parity/receipts/v1/census/<lib>/<id>/code-render.json    the row's receipt
 *
 * THE RENDERER IS NOT NEW. The CSS surface is core/emit-html.ts staged by the
 * cross-surface catalog gate's own cell document
 * (extract/figma/catalog-visual/css-doc.ts buildCssCellDoc — the contract's
 * enum values written in as defaults, the emitter's first showcase item
 * isolated) and captured by the canvas gate's own shot path
 * (extract/figma/canvas-gate/shots.ts captureCell — 600×800 viewport,
 * deviceScaleFactor 2, light colour-scheme, animations pinned, painted-union
 * clip + 24px margin). State-preview cells are driven the way the catalog
 * gate drives them (CSS_STATE_DRIVER: hover / focus-visible / active by
 * pointer and keyboard, disabled by the boolean prop); a state with no driver
 * is a named refusal in the row JSON, never a silently absent PNG.
 *
 * TOKEN LAYER: first-party rows resolve against tokens/ via
 * src/styles/tokens.css (the catalog gate's world); example-library rows
 * resolve against the committed <lib>.bundle.json tokenSet — the layer the
 * plugin compiles a paste from, so code and canvas read the same variables.
 *
 * FONTS ARE REPORTED, NOT ASSUMED: `fontChecks` records whether Inter (the
 * frame's first family) resolved in this browser. The canvas half renders in
 * Figma's own font service; the adjudication column, not this half, decides
 * what a font miss means.
 *
 * A row whose contract does not compile, or whose every sampled variant
 * refuses, is written with `unavailable: <reason>` — the census gate prints
 * it as `UNAVAILABLE (<reason>)` by name.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { Browser, Page } from "playwright-core";
import {
  launchGateBrowser,
  newGatePage,
  captureCell,
  fontAvailable,
  type Interaction,
} from "../canvas-gate/shots.js";
import { buildCssCellDoc } from "../catalog-visual/css-doc.js";
import { CSS_STATE_DRIVER } from "../catalog-visual/world.js";
import { walkAnatomy } from "../../../scripts/contract-schema.js";
import {
  CENSUS_DIR,
  REPO,
  enumerateCorpus,
  loadLibraryWorld,
  sampleVariants,
  type CorpusRow,
} from "./corpus.js";

export interface RenderedVariantReceipt {
  slug: string;
  /** The compiled Figma variant name — what the canvas half screenshots. */
  variant: string;
  kind: "base" | "state";
  state?: string;
  subst: Record<string, string>;
  bools: Record<string, boolean>;
  interaction: Interaction;
  status: "rendered" | "refused";
  png?: string;
  /** CSS-px painted box of the rendered component (pre-margin). */
  contentBox?: { width: number; height: number };
  error?: string;
}

export interface CodeRenderReceipt {
  id: string;
  name: string;
  library: string;
  contractPath: string;
  contractVersion: string;
  renderer: string;
  tokenSource: string;
  platform: string;
  fontChecks: Record<string, boolean>;
  sample: {
    rule: string;
    cap: { limit: number; derived: number; sampled: number; dropped: number };
    axisCoverageComplete: boolean;
    derivation: string;
  };
  /** The contract facts the render carried — the adjudication column's input. */
  carriedFacts: {
    props: Array<{ name: string; type: string; default: unknown }>;
    states: string[];
    parts: string[];
    contentSlots: Array<{ part: string; prop: string }>;
    tokenRefs: string[];
    icons: string[];
    events: string[];
  };
  variants: RenderedVariantReceipt[];
  rendered: number;
  refused: number;
  unavailable: string | null;
}

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const ONLY_LIBRARY = flag("--library");
const ONLY_ID = flag("--id");

const propType = (t: unknown): string =>
  typeof t === "string"
    ? t
    : t && typeof t === "object" && "enum" in (t as Record<string, unknown>)
      ? "enum"
      : JSON.stringify(t);

function carriedFacts(row: CorpusRow): CodeRenderReceipt["carriedFacts"] {
  const c = row.contract;
  const text = readFileSync(path.join(REPO, row.row.contractPath), "utf8");
  const tokenRefs = [...new Set(text.match(/"\{[a-z][^"}]*\}"/g) ?? [])]
    .map((s) => s.slice(2, -2))
    .sort();
  const parts: string[] = [];
  const contentSlots: Array<{ part: string; prop: string }> = [];
  const icons = new Set<string>();
  for (const w of walkAnatomy(c)) {
    parts.push(w.name);
    if (w.part.content?.prop)
      contentSlots.push({ part: w.name, prop: w.part.content.prop });
    const icon = (w.part as { icon?: unknown }).icon;
    if (typeof icon === "string") icons.add(icon);
    else if (icon && typeof icon === "object")
      for (const v of Object.values(icon as Record<string, unknown>))
        if (typeof v === "string") icons.add(v);
  }
  return {
    props: c.props.map((p) => ({
      name: p.name,
      type: propType(p.type),
      default: p.default ?? null,
    })),
    states: [...c.states],
    parts,
    contentSlots,
    tokenRefs,
    icons: [...icons].sort(),
    events: (c.events ?? []).map((e) =>
      typeof e === "string" ? e : (e as { name: string }).name,
    ),
  };
}

async function renderRow(
  page: Page,
  row: CorpusRow,
  interAvailable: boolean,
): Promise<CodeRenderReceipt> {
  const world = loadLibraryWorld(row.library);
  const outDir = path.join(REPO, CENSUS_DIR, row.library.library, row.row.id);
  mkdirSync(outDir, { recursive: true });
  // Stale code PNGs from an earlier sample rule are removed; canvas PNGs and
  // the verdict are the other half's and are never touched here.
  for (const f of readdirSync(outDir))
    if (/^code-.*\.png$/.test(f)) rmSync(path.join(outDir, f));

  const receipt: CodeRenderReceipt = {
    id: row.row.id,
    name: row.row.name,
    library: row.library.library,
    contractPath: row.row.contractPath,
    contractVersion: row.contract.version,
    renderer:
      "core/emit-html.ts via extract/figma/catalog-visual/css-doc.ts buildCssCellDoc + extract/figma/canvas-gate/shots.ts captureCell (600×800, dpr 2, light)",
    tokenSource: world.tokenSource,
    platform: `${process.platform}/${process.arch}`,
    fontChecks: { Inter: interAvailable },
    sample: {
      rule: "see census-manifest.json sampleRule",
      cap: { limit: 0, derived: 0, sampled: 0, dropped: 0 },
      axisCoverageComplete: true,
      derivation: "",
    },
    carriedFacts: carriedFacts(row),
    variants: [],
    rendered: 0,
    refused: 0,
    unavailable: null,
  };

  let sample;
  try {
    const data = world.engine.compileComponentData(row.contract, world.byId);
    sample = sampleVariants(row.contract, data);
  } catch (e) {
    receipt.unavailable = `engine compile refused — ${(e as Error).message.split("\n")[0]}`;
    return receipt;
  }
  receipt.sample.cap = sample.cap;
  receipt.sample.axisCoverageComplete = sample.axisCoverageComplete;
  receipt.sample.derivation = sample.derivation;

  const boolNames = new Set(
    row.contract.props.filter((p) => p.type === "boolean").map((p) => p.name),
  );
  // The catalog driver spells the disabled prop `disabled` (first-party). A
  // foreign contract spells it its own way (astryx `isDisabled`); the first
  // boolean prop whose name contains "disabled" drives the state. A contract
  // with no such prop at all keeps the named refusal — the state exists on
  // the canvas and the CSS surface has nothing to flip.
  const disabledProp = [...boolNames].sort().find((n) => /disabled/i.test(n));
  for (const s of sample.cells) {
    const v: RenderedVariantReceipt = {
      slug: s.slug,
      variant: s.cell.name,
      kind: s.cell.kind,
      ...(s.cell.state ? { state: s.cell.state } : {}),
      subst: s.cell.subst,
      bools: { ...s.bools },
      interaction: "default",
      status: "refused",
    };
    if (s.cell.state) {
      const driver = CSS_STATE_DRIVER[s.cell.state];
      if (!driver) {
        v.error = `state "${s.cell.state}" has no CSS-surface driver (catalog-visual/world.ts CSS_STATE_DRIVER)`;
        receipt.variants.push(v);
        continue;
      }
      if ("interaction" in driver) v.interaction = driver.interaction;
      else if (boolNames.has(driver.boolProp)) v.bools[driver.boolProp] = true;
      else if (driver.boolProp === "disabled" && disabledProp)
        v.bools[disabledProp] = true;
      else {
        v.error = `state "${s.cell.state}" drives boolean prop "${driver.boolProp}", which ${row.row.id} does not declare`;
        receipt.variants.push(v);
        continue;
      }
    }
    let doc: string;
    try {
      doc = buildCssCellDoc({
        contract: row.contract,
        subst: s.cell.subst,
        bools: v.bools,
        tokenCss: world.tokenCss,
        inventory: world.inventory,
        icons: world.icons,
        contracts: world.byId,
        cellKey: String(s.index),
      });
    } catch (e) {
      v.error = `emitHtml refused — ${(e as Error).message.split("\n")[0]}`;
      receipt.variants.push(v);
      continue;
    }
    try {
      await page.setContent(doc, { waitUntil: "load" });
      await page.evaluate(
        "Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))])",
      );
      const shot = await captureCell(page, String(s.index), v.interaction);
      const file = `code-${s.slug}.png`;
      writeFileSync(path.join(outDir, file), shot.png);
      v.status = "rendered";
      v.png = file;
      v.contentBox = {
        width: Math.round(shot.contentBox.width * 100) / 100,
        height: Math.round(shot.contentBox.height * 100) / 100,
      };
    } catch (e) {
      v.error = `capture refused — ${(e as Error).message.split("\n")[0]}`;
    }
    receipt.variants.push(v);
  }
  receipt.rendered = receipt.variants.filter(
    (x) => x.status === "rendered",
  ).length;
  receipt.refused = receipt.variants.length - receipt.rendered;
  if (receipt.variants.length === 0)
    receipt.unavailable =
      "the engine derived no variant cells for this contract";
  else if (receipt.rendered === 0)
    receipt.unavailable = `every sampled variant refused — first: ${receipt.variants[0].error}`;
  return receipt;
}

async function main(): Promise<void> {
  const { corpus } = enumerateCorpus();
  const rows = corpus.filter(
    (r) =>
      (!ONLY_LIBRARY || r.library.library === ONLY_LIBRARY) &&
      (!ONLY_ID || r.row.id === ONLY_ID),
  );
  if (rows.length === 0)
    throw new Error(
      `census render: no manifest row matches --library ${ONLY_LIBRARY ?? "*"} --id ${ONLY_ID ?? "*"}`,
    );
  const browser: Browser = await launchGateBrowser();
  const { context, page } = await newGatePage(browser);
  let interAvailable = false;
  try {
    await page.setContent(
      '<!doctype html><html><body style="font-family: Inter, sans-serif">x</body></html>',
      { waitUntil: "load" },
    );
    await page.evaluate(
      "Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))])",
    );
    interAvailable = await fontAvailable(page, "Inter");
    if (!interAvailable)
      console.error(
        "census render: the font `Inter` is NOT available — recorded in every row as fontChecks.Inter=false",
      );
    let rendered = 0;
    let refused = 0;
    let unavailable = 0;
    for (const row of rows) {
      const receipt = await renderRow(page, row, interAvailable);
      const outDir = path.join(
        REPO,
        CENSUS_DIR,
        row.library.library,
        row.row.id,
      );
      writeFileSync(
        path.join(outDir, "code-render.json"),
        JSON.stringify(receipt, null, 2) + "\n",
      );
      rendered += receipt.rendered;
      refused += receipt.refused;
      if (receipt.unavailable) unavailable++;
      console.log(
        `${receipt.unavailable ? "✘" : "✔"} ${row.library.library}/${row.row.id} — ${receipt.rendered}/${receipt.variants.length} rendered` +
          (receipt.sample.cap.dropped
            ? ` (cap ${receipt.sample.cap.limit}: ${receipt.sample.cap.dropped} dropped)`
            : "") +
          (receipt.unavailable
            ? ` — UNAVAILABLE (${receipt.unavailable})`
            : ""),
      );
    }
    console.log(
      `\ncensus render: ${rows.length} set(s), ${rendered} variant(s) rendered, ${refused} refused, ${unavailable} set(s) unavailable`,
    );
  } finally {
    await context.close();
    await browser.close();
  }
  if (!existsSync(path.join(REPO, CENSUS_DIR)))
    throw new Error("census render wrote nothing");
}

await main();
