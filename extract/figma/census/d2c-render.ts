/**
 * DESIGN→CODE CENSUS — the RENDER half.
 *
 *   npx tsx extract/figma/census/d2c-render.ts [--kit flowbite|figma-ds] [--id <contract id>]
 *
 * For every design→code census set, screenshot BOTH truths of the sampled
 * cells and write the pairs the gate checks:
 *
 *   parity/receipts/v1/census/design-to-code/<kit>/<id>/canvas-<slug>.png
 *       Figma's own render — GET /v1/images/:key?ids=<variant>&scale=2
 *       (READ-ONLY; FIGMA_TOKEN from .env.local, never printed)
 *   parity/receipts/v1/census/design-to-code/<kit>/<id>/code-<slug>.png
 *       the GENERATED React component (the same bytes the census pipeline
 *       hashes), esbuild-bundled with its own tokens.css + CSS Modules and
 *       screenshotted headless at deviceScaleFactor 2
 *   parity/receipts/v1/census/design-to-code/<kit>/<id>/render.json
 *       the sample: slug ↔ Figma variant name ↔ nodeId ↔ React props —
 *       byte-stable (no dates), the gate's cell denominator
 *
 * SAMPLE RULE: the all-defaults cell, then every non-default value of every
 * enum/boolean-variant prop with the other props at default. Interaction
 * STATES are CSS pseudo-class planes on the code side (a hover cannot be a
 * prop), so state cells are NOT sampled as pairs — named in render.json.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { build } from "esbuild";
import { generateComponents } from "../../../scripts/generate-components.js";
import { componentIdSlug } from "../../../core/propose-figma.js";
import { chromiumExecutable } from "../visual-parity/render.js";
import { figmaToken } from "../visual-parity/env.js";
import { REPO, variantSlug } from "./corpus.js";
import {
  D2C_DIR,
  D2C_KITS,
  loadFixture,
  mapKit,
  proposeKit,
  type D2cKitDef,
} from "./design-to-code.js";

export interface D2cRenderCell {
  slug: string;
  figmaVariant: string;
  nodeId: string;
  props: Record<string, string | boolean>;
}

export interface D2cRenderReceipt {
  kit: string;
  id: string;
  setName: string;
  renderer: string;
  cells: D2cRenderCell[];
  /** Interaction-state axis values NOT sampled as cells (CSS pseudo-class
   *  planes on the code side), named so the cut is never silent. */
  notSampled: string[];
}

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const ONLY_KIT = flag("--kit");
const ONLY_ID = flag("--id");

interface EnumProp {
  name: string;
  values: string[];
  default: string;
  /** canonical value → drawn Figma value. */
  drawn: Record<string, string>;
  property: string;
  boolean: boolean;
}

function enumProps(contract: Record<string, unknown>): EnumProp[] {
  const out: EnumProp[] = [];
  for (const p of (contract.props ?? []) as Array<Record<string, unknown>>) {
    const figma = (p.bindings as { figma?: { kind?: string; property?: string; values?: Record<string, string> } })?.figma;
    if (figma?.kind !== "VARIANT") continue;
    const t = p.type;
    if (t && typeof t === "object" && "enum" in (t as object)) {
      const values = (t as { enum: string[] }).enum;
      out.push({
        name: String(p.name),
        values,
        default: String(p.default),
        drawn: figma.values ?? Object.fromEntries(values.map((v) => [v, v])),
        property: figma.property ?? String(p.name),
        boolean: false,
      });
    } else if (t === "boolean") {
      out.push({
        name: String(p.name),
        values: ["true", "false"],
        default: String(p.default ?? false),
        drawn: figma.values ?? { true: "True", false: "False" },
        property: figma.property ?? String(p.name),
        boolean: true,
      });
    }
  }
  return out;
}

function sampleCells(
  contract: Record<string, unknown>,
  rawDoc: { name: string; children?: Array<{ id: string; name: string }>; componentPropertyDefinitions?: Record<string, { type: string; defaultValue?: unknown }> },
): { cells: D2cRenderCell[]; notSampled: string[] } {
  const props = enumProps(contract);
  const combos: Array<Record<string, string>> = [Object.fromEntries(props.map((p) => [p.name, p.default]))];
  for (const p of props) {
    for (const v of p.values) {
      if (v === p.default) continue;
      combos.push({ ...combos[0], [p.name]: v });
    }
  }
  // Figma-side axis defaults for axes with no contract prop (State etc).
  const defs = rawDoc.componentPropertyDefinitions ?? {};
  const extraAxes: Record<string, string> = {};
  const notSampled: string[] = [];
  for (const [k, d] of Object.entries(defs)) {
    if (d.type !== "VARIANT") continue;
    const bare = k.split("#")[0];
    if (props.some((p) => p.property === bare)) continue;
    extraAxes[bare] = String(d.defaultValue ?? "");
    if (bare === "State") notSampled.push(`State axis sampled at "${String(d.defaultValue)}" only — hover/active/focus-visible/disabled are CSS pseudo-class planes on the code side, not cells`);
  }
  const cells: D2cRenderCell[] = [];
  const seen = new Set<string>();
  for (const combo of combos) {
    const wanted: Record<string, string> = { ...extraAxes };
    for (const p of props) wanted[p.property] = p.drawn[combo[p.name]] ?? combo[p.name];
    // A standalone COMPONENT has no variant children — its own document IS
    // the single cell (a COMPONENT_SET's children are the variants; a
    // COMPONENT's children are its content tree, never match targets).
    const children = (rawDoc as { type?: string }).type === "COMPONENT_SET" ? (rawDoc.children ?? []) : [];
    const match =
      children.length === 0
        ? { id: (rawDoc as { id?: string }).id ?? "", name: rawDoc.name }
        : children.find((c) => {
            const parsed = Object.fromEntries(
              c.name.split(",").map((seg) => {
                const eq = seg.indexOf("=");
                return [seg.slice(0, eq).trim(), seg.slice(eq + 1).trim()];
              }),
            );
            return (
              Object.keys(parsed).length === Object.keys(wanted).length &&
              Object.entries(wanted).every(([k, v]) => parsed[k] === v)
            );
          });
    if (!match) continue; // a combination the canvas does not draw — nothing to pair
    const slug = variantSlug(match.name);
    if (seen.has(slug)) continue;
    seen.add(slug);
    const jsxProps: Record<string, string | boolean> = {};
    for (const p of props) jsxProps[p.name] = p.boolean ? combo[p.name] === "true" : combo[p.name];
    // The children-bound TEXT prop renders as JSX children with NO destructure
    // default (the React emitter's own ROUND-3 rule), so the harness passes
    // the CONTRACT's declared default — the same value the canvas cell draws.
    for (const p of (contract.props ?? []) as Array<Record<string, unknown>>) {
      const code = (p.bindings as { code?: { prop?: string } })?.code;
      if (p.type === "text" && code?.prop === "children" && typeof p.default === "string")
        jsxProps.children = p.default;
    }
    cells.push({ slug, figmaVariant: match.name, nodeId: (match as { id: string }).id, props: jsxProps });
  }
  return { cells, notSampled };
}

async function fetchCanvasPngs(
  fileKey: string,
  wanted: Array<{ nodeId: string; outPath: string }>,
  token: string,
): Promise<void> {
  const ids = [...new Set(wanted.map((w) => w.nodeId))];
  const res = await fetch(
    `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(ids.join(","))}&scale=2&format=png`,
    { headers: { "X-Figma-Token": token } },
  );
  if (!res.ok) throw new Error(`Figma images API ${res.status} for ${fileKey}`);
  const body = (await res.json()) as { err: unknown; images: Record<string, string | null> };
  for (const w of wanted) {
    const url = body.images[w.nodeId];
    if (!url) throw new Error(`Figma rendered no image for ${w.nodeId} (${fileKey})`);
    const img = await fetch(url);
    if (!img.ok) throw new Error(`image download ${img.status} for ${w.nodeId}`);
    writeFileSync(w.outPath, Buffer.from(await img.arrayBuffer()));
  }
}

async function renderKit(def: D2cKitDef, token: string): Promise<void> {
  const { fixture, dump } = mapKit(def);
  const batch = proposeKit(def, dump);
  if (batch.skipped.length > 0)
    throw new Error(`${def.kit}: ${batch.skipped.map((s) => s.setName).join(", ")} refused to propose`);

  // Persist proposals + generate the React surface once for the whole kit.
  const work = mkdtempSync(path.join(tmpdir(), `d2c-render-${def.kit}-`));
  const contractFiles: string[] = [];
  const minted: Record<string, unknown> = {};
  const { mergeTokenTrees } = await import("../tokens.js");
  for (const p of batch.proposals) {
    const f = path.join(work, `${componentIdSlug(p.setName)}.contract.proposed.json`);
    writeFileSync(f, JSON.stringify(p.contract, null, 2) + "\n");
    contractFiles.push(f);
    for (const stub of p.childStubs ?? []) {
      const sf = path.join(work, `${componentIdSlug(String((stub as { id?: unknown }).id))}.stub.contract.proposed.json`);
      writeFileSync(sf, JSON.stringify(stub, null, 2) + "\n");
      if (!contractFiles.includes(sf)) contractFiles.push(sf);
    }
    if (p.mintedTokens) Object.assign(minted, mergeTokenTrees([minted, p.mintedTokens.tree]));
  }
  // Same prune rule as the pipeline half: the kit corpus wins.
  const corpusTrees = def.corpusFiles.map(
    (f) => JSON.parse(readFileSync(path.join(REPO, f), "utf8")) as Record<string, unknown>,
  );
  const { default: prune } = { default: (tree: Record<string, unknown>): void => {
    const has = (t: Record<string, unknown>, segs: string[]): boolean => {
      let cur: unknown = t;
      for (const s of segs) {
        if (!cur || typeof cur !== "object") return false;
        cur = (cur as Record<string, unknown>)[s];
      }
      return !!cur && typeof cur === "object" && "$value" in (cur as object);
    };
    const walk = (node: Record<string, unknown>, segs: string[]): void => {
      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith("$") || !v || typeof v !== "object") continue;
        const next = [...segs, k];
        if ("$value" in (v as object)) {
          if (corpusTrees.some((t) => has(t, next))) delete node[k];
        } else {
          walk(v as Record<string, unknown>, next);
          if (Object.keys(v as object).filter((x) => !x.startsWith("$")).length === 0) delete node[k];
        }
      }
    };
    walk(tree, []);
  } };
  prune(minted);
  const mintedFile = path.join(work, "minted.dtcg.json");
  writeFileSync(mintedFile, JSON.stringify(minted, null, 2) + "\n");
  const tokenFiles = [...def.corpusFiles.map((f) => path.join(REPO, f)), mintedFile];
  const reactOut = path.join(work, "react");
  const cwd = process.cwd();
  process.chdir(REPO);
  try {
    await generateComponents({
      contractFiles,
      tokenFiles,
      outDir: reactOut,
      stories: false,
      regenerateHint: "extract/figma/census/d2c-render.ts",
    });
  } finally {
    process.chdir(cwd);
  }

  // Build one entry page per kit with every sampled cell.
  const cellsBySet = new Map<string, { setName: string; receipt: D2cRenderReceipt }>();
  const imports: string[] = [];
  const jsxCells: string[] = [];
  for (const p of batch.proposals) {
    const contract = p.contract as { id?: string; name?: string };
    const id = String(contract.id);
    if (ONLY_ID && id !== ONLY_ID) continue;
    const entry = Object.values(fixture.nodes).find((e) => e?.document.name === p.setName);
    if (!entry) continue;
    const { cells, notSampled } = sampleCells(p.contract as Record<string, unknown>, entry.document as never);
    const name = String(contract.name);
    if (!readdirSync(reactOut).includes(name)) continue; // stubs render only as children
    imports.push(`import { ${name} } from './react/${name}/${name}';`);
    for (const c of cells) {
      const propsSrc = Object.entries(c.props)
        .map(([k, v]) => `${JSON.stringify(k)}: ${typeof v === "boolean" ? String(v) : JSON.stringify(v)}`)
        .join(", ");
      jsxCells.push(
        `<div key=${JSON.stringify(`${id}__${c.slug}`)} data-cell=${JSON.stringify(`${id}__${c.slug}`)} style={{ display: 'inline-block', padding: 16, background: '#fff' }}>{createElement(${name} as never, { ${propsSrc} } as never)}</div>`,
      );
    }
    cellsBySet.set(id, {
      setName: p.setName,
      receipt: {
        kit: def.kit,
        id,
        setName: p.setName,
        renderer:
          "code: generated React (design-to-code pipeline bytes) → esbuild bundle → playwright-core screenshot at deviceScaleFactor 2; canvas: GET /v1/images/:key?scale=2 (Figma's own renderer, read-only)",
        cells,
        notSampled,
      },
    });
  }
  const entryTsx = [
    `import { createElement } from 'react';`,
    `import { createRoot } from 'react-dom/client';`,
    `import './react/tokens.css';`,
    ...imports,
    `createRoot(document.getElementById('app')!).render(`,
    `  <div style={{ display: 'flex', flexDirection: 'column', gap: 32, padding: 24, alignItems: 'flex-start', background: '#fff' }}>`,
    ...jsxCells.map((c) => `    ${c},`),
    `  </div>,`,
    `);`,
  ].join("\n");
  writeFileSync(path.join(work, "entry.tsx"), entryTsx);
  writeFileSync(
    path.join(work, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="bundle.css"><style>body{margin:0;background:#fff;font-family:Inter,system-ui,sans-serif}</style></head><body><div id="app"></div><script src="bundle.js"></script></body></html>`,
  );
  await build({
    entryPoints: [path.join(work, "entry.tsx")],
    bundle: true,
    outfile: path.join(work, "bundle.js"),
    jsx: "automatic",
    loader: { ".module.css": "local-css", ".css": "css" },
    absWorkingDir: REPO,
    // The work dir lives under the OS tmpdir — outside the repo's
    // node_modules resolution chain — so react/react-dom resolve from here.
    nodePaths: [path.join(REPO, "node_modules")],
    logLevel: "silent",
  });

  const browser = await chromium.launch({ executablePath: chromiumExecutable() });
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1400, height: 2400 } });
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(`file://${path.join(work, "index.html")}`);
  await page.waitForTimeout(500);
  const canvasWanted: Array<{ nodeId: string; outPath: string }> = [];
  let shot = 0;
  for (const [id, { receipt }] of cellsBySet) {
    const dir = path.join(REPO, D2C_DIR, def.kit, id);
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(dir)) if (/^(code|canvas)-.*\.png$/.test(f)) rmSync(path.join(dir, f));
    for (const cell of receipt.cells) {
      const h = await page.$(`[data-cell="${id}__${cell.slug}"]`);
      if (!h) throw new Error(`${def.kit}/${id}: cell ${cell.slug} not on the page`);
      await h.screenshot({ path: path.join(dir, `code-${cell.slug}.png`) });
      shot++;
      canvasWanted.push({ nodeId: cell.nodeId, outPath: path.join(dir, `canvas-${cell.slug}.png`) });
    }
    writeFileSync(path.join(dir, "render.json"), JSON.stringify(receipt, null, 2) + "\n");
  }
  await browser.close();
  if (pageErrors.length > 0)
    console.error(`${def.kit}: ${pageErrors.length} page error(s) — first: ${pageErrors[0]}`);
  await fetchCanvasPngs(def.fileKey, canvasWanted, token);
  rmSync(work, { recursive: true, force: true });
  console.log(
    `✔ ${def.kit}: ${cellsBySet.size} set(s), ${shot} code PNG(s) + ${canvasWanted.length} canvas PNG(s)`,
  );
}

async function main(): Promise<void> {
  const token = figmaToken();
  for (const def of D2C_KITS) {
    if (ONLY_KIT && def.kit !== ONLY_KIT) continue;
    await renderKit(def, token);
  }
}

await main();
