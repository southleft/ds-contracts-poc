/**
 * Stages 3b–3d of the canvas→code journey (docs/35 §5) — the full offline
 * pipeline and its gate:
 *
 *   canvas facts (3a, recipe/canvas-facts.ts, committed observe substrate)
 *     → bridge (3b, recipe/canvas-facts-to-dump.ts)
 *     → universal contract (core/propose-figma.ts proposeFromDump — unchanged)
 *     → React + CSS Modules (3c, scripts/generate-components.ts — the
 *       shipping `react` emitter, unchanged)
 *     → headless-Chromium re-render + computed-style diff (3d)
 *
 * ZERO-SILENT ACCOUNTING (3d): every canvas fact lands in exactly one render
 * ledger row —
 *
 *   matched      the fact maps to a computed CSS property / DOM observation
 *                on the re-rendered component and the values AGREE;
 *   named-delta  the computed value DISAGREES with the canvas fact, and the
 *                delta is EXPLAINED BY NAME by a proposal note/degradation
 *                (an unexplained delta fails the gate);
 *   carried      the fact landed in the contract / emitted source but has no
 *                computed-style expression (the landing names where);
 *   receipted    the fact has no landing at all — the row is the named
 *                reason, nothing invented.
 *
 * silent MUST be zero; any unexplained delta fails closed. No grades are
 * minted: overallSuccess stays false, humanGrade stays pending.
 *
 * Entirely offline: zero Figma reads/writes. The browser is the pinned
 * Playwright Chromium the visual-parity and raster-calibration floors already
 * use.
 *
 *   tsx recipe/canvas-to-code.ts --write   run + write evidence under
 *                                          recipe/evidence/canvas-to-code-v1/
 *   tsx recipe/canvas-to-code.ts --check   run + compare against committed
 *                                          evidence (fail closed)
 */
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

import { capturedTokensDocument } from "../core/captured-tokens.js";
import {
  dumpCapturesHidden,
  proposeBatchFromDump,
  type FigmaProposalResult,
} from "../core/propose-figma.js";
import { tokenCorpusFromJson } from "../core/token-corpus.js";
import { launchBrowser } from "../extract/figma/visual-parity/render.js";
import { generateComponents } from "../scripts/generate-components.js";
import type { CanvasFactsDocument } from "./canvas-facts.js";
import {
  bridgeCanvasFactsToDump,
  type CanvasBridgeResult,
} from "./canvas-facts-to-dump.js";
import {
  BUTTON_CANVAS_FACTS_PATH,
  CANVAS_TO_CODE_ROOT,
  checkButtonCanvasFacts,
} from "./emit-canvas-facts.js";
import { canonicalJson } from "./normalize.js";
import type { SceneFact, SceneNodeSnapshot } from "./scene-readback.js";

export const CANVAS_TO_CODE_VERSION = "canvas-to-code-v1";
export const CANVAS_TO_CODE_RECEIPT_PATH = `${CANVAS_TO_CODE_ROOT}/receipt.json`;
export const CANVAS_TO_CODE_BRIDGE_PATH = `${CANVAS_TO_CODE_ROOT}/bridge-button.json.gz`;
export const CANVAS_TO_CODE_RENDER_LEDGER_PATH = `${CANVAS_TO_CODE_ROOT}/render-ledger-button.json.gz`;

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

// ---------------------------------------------------------------------------
// 3b + 3c — bridge, propose, emit (no browser)
// ---------------------------------------------------------------------------

export interface CanvasToCodeBuild {
  doc: CanvasFactsDocument;
  bridge: CanvasBridgeResult;
  proposal: FigmaProposalResult;
  proposalNotes: string[];
  contract: Record<string, unknown>;
  componentName: string;
  /** Where the contract/token/generated artifacts were written. */
  outRoot: string;
  generatedDir: string;
  emittedFiles: Array<{ path: string; sha256: string }>;
}

export async function buildCanvasToCodeFromFacts(
  doc: CanvasFactsDocument,
  outRoot: string,
  options?: { regenerateHint?: string; contractFileName?: string },
): Promise<CanvasToCodeBuild> {
  const bridge = bridgeCanvasFactsToDump(doc);
  const dump = bridge.dump as unknown as Record<string, unknown>;
  const captured = capturedTokensDocument(dump);
  if (captured === null)
    throw new Error("canvas-to-code: bridged dump carries no _variables");
  const corpus = tokenCorpusFromJson({
    primitives: captured.document,
    semantic: {},
    light: {},
    brandDefault: {},
  });
  const batch = proposeBatchFromDump(dump, {
    corpus,
    contractIdByName: new Map(),
    fileKey: null,
    // The observe substrate carries NONE of the pipeline's plugin-data
    // stamps (scene-readback ignores pluginData by design), so exact mode's
    // stamp-gated promotions are unavailable — reviewable inversion is the
    // honest mode for a canvas this pipeline cannot prove it drew. The
    // projection still verifies exact (structured variantProperties +
    // propertyDefinitions ride the bridge).
    projectionMode: "reviewable-inversion",
    mintUnbound: true,
    hiddenCaptured: dumpCapturesHidden(
      (dump as { _provenance?: { note?: string; dumpVersion?: string } })
        ._provenance,
    ),
  });
  if (batch.skipped.length > 0)
    throw new Error(
      `canvas-to-code: propose refused: ${batch.skipped
        .map((skip) => `${skip.setName}: ${skip.reason}`)
        .join("; ")}`,
    );
  if (batch.proposals.length !== 1)
    throw new Error(
      `canvas-to-code: expected exactly one proposal, got ${batch.proposals.length}`,
    );
  const { setName: _setName, ...proposal } = batch.proposals[0]!;
  const contract = proposal.contract;
  const componentName = String((contract as { name?: unknown }).name ?? "");
  if (componentName === "")
    throw new Error("canvas-to-code: proposed contract has no name");

  mkdirSync(outRoot, { recursive: true });
  const contractPath = path.join(
    outRoot,
    options?.contractFileName ?? "button.contract.proposed.json",
  );
  writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
  const stubPaths: string[] = [];
  for (const stub of proposal.childStubs ?? []) {
    const stubId = String((stub as { id?: unknown }).id ?? "");
    const stubPath = path.join(
      outRoot,
      `${stubId}.stub.contract.proposed.json`,
    );
    writeFileSync(stubPath, `${JSON.stringify(stub, null, 2)}\n`);
    stubPaths.push(stubPath);
  }
  const capturedPath = path.join(outRoot, "captured.dtcg.json");
  writeFileSync(
    capturedPath,
    `${JSON.stringify(captured.document, null, 2)}\n`,
  );
  const mintedPath = path.join(outRoot, "minted.dtcg.json");
  writeFileSync(
    mintedPath,
    `${JSON.stringify(proposal.mintedTokens?.tree ?? {}, null, 2)}\n`,
  );

  const generatedDir = path.join(outRoot, "generated");
  const result = await generateComponents({
    contractFiles: [contractPath, ...stubPaths],
    tokenFiles: [capturedPath, mintedPath],
    outDir: generatedDir,
    stories: false,
    regenerateHint:
      options?.regenerateHint ?? "tsx recipe/canvas-to-code.ts --write",
  });
  if (result.refused.length > 0)
    throw new Error(
      `canvas-to-code: generate refused: ${result.refused
        .map((refusal) => refusal.violations.join("; "))
        .join(" | ")}`,
    );

  const emittedFiles: Array<{ path: string; sha256: string }> = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else
        emittedFiles.push({
          path: path.relative(outRoot, full),
          sha256: sha256(readFileSync(full)),
        });
    }
  };
  walk(generatedDir);

  return {
    doc,
    bridge,
    proposal,
    proposalNotes: [...batch.notes, ...proposal.notes],
    contract,
    componentName,
    outRoot,
    generatedDir,
    emittedFiles,
  };
}

export async function buildButtonCanvasToCode(
  outRoot: string,
): Promise<CanvasToCodeBuild> {
  return buildCanvasToCodeFromFacts(checkButtonCanvasFacts(), outRoot);
}

// ---------------------------------------------------------------------------
// 3d — mount in Chromium, read computed styles
// ---------------------------------------------------------------------------

export interface MountCell {
  key: string;
  ownershipKey: string;
  props: Record<string, string>;
  variantProperties: Record<string, string>;
}

interface RenderedChild {
  tag: string;
  text: string;
  width: string;
  height: string;
}

interface RenderedCell {
  key: string;
  root: Record<string, string>;
  label: (Record<string, string> & { text: string }) | null;
  children: RenderedChild[];
}

/** Mount matrix: one cell per drawn COMPONENT, props derived from its
 *  authoritative variant tuple through the contract's own figma bindings. */
export function mountCells(
  doc: CanvasFactsDocument,
  contract: Record<string, unknown>,
): MountCell[] {
  const props = (contract as {
    props?: Array<{
      name: string;
      bindings?: { figma?: { kind?: string; property?: string; values?: Record<string, string> } };
    }>;
  }).props ?? [];
  const byAxis = new Map<
    string,
    { propName: string; canonicalByFigma: Map<string, string> }
  >();
  for (const prop of props) {
    const figma = prop.bindings?.figma;
    if (figma?.kind !== "VARIANT" || figma.property === undefined) continue;
    byAxis.set(figma.property, {
      propName: prop.name,
      canonicalByFigma: new Map(
        Object.entries(figma.values ?? {}).map(([canonical, drawn]) => [
          drawn,
          canonical,
        ]),
      ),
    });
  }
  return doc.hierarchy.children
    .filter((child) => child.type === "COMPONENT")
    .map((child) => {
      const tuple = child.variantProperties ?? {};
      const cellProps: Record<string, string> = {};
      for (const [axis, value] of Object.entries(tuple)) {
        const mapping = byAxis.get(axis);
        if (mapping === undefined)
          throw new Error(
            `canvas-to-code: variant axis ${axis} has no contract prop — cannot mount ${child.name}`,
          );
        const canonical = mapping.canonicalByFigma.get(value);
        if (canonical === undefined)
          throw new Error(
            `canvas-to-code: axis ${axis} value ${value} missing from contract prop ${mapping.propName}`,
          );
        cellProps[mapping.propName] = canonical;
      }
      return {
        key: child.ownershipKey,
        ownershipKey: child.ownershipKey,
        props: cellProps,
        variantProperties: tuple,
      };
    });
}

const READ_ROOT_PROPS = [
  "display",
  "flex-direction",
  "justify-content",
  "align-items",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "column-gap",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "background-color",
  "box-shadow",
  "outline-width",
  "outline-color",
  "outline-style",
  "opacity",
] as const;

const READ_LABEL_PROPS = [
  "font-size",
  "font-weight",
  "font-family",
  "line-height",
  "color",
  "text-align",
] as const;

export async function renderCells(
  build: CanvasToCodeBuild,
  cells: MountCell[],
): Promise<RenderedCell[]> {
  const harness = mkdtempSync(path.join(os.tmpdir(), "canvas-to-code-"));
  try {
    writeFileSync(
      path.join(harness, "cells.json"),
      JSON.stringify(cells.map(({ key, props }) => ({ key, props }))),
    );
    const genIndex = path
      .join(path.resolve(REPO, build.generatedDir), "index")
      .split(path.sep)
      .join("/");
    writeFileSync(
      path.join(harness, "entry.jsx"),
      `import React from 'react';
import { createRoot } from 'react-dom/client';
import * as GEN from ${JSON.stringify(genIndex)};
import CELLS from './cells.json';
const Component = GEN[${JSON.stringify(build.componentName)}];
function App() {
  return (
    <div>
      {CELLS.map((cell) => (
        <div data-cell={cell.key} key={cell.key} style={{ margin: 8 }}>
          <Component {...cell.props} />
        </div>
      ))}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
`,
    );
    const esbuild = (await import("esbuild")) as typeof import("esbuild");
    await esbuild.build({
      entryPoints: [path.join(harness, "entry.jsx")],
      bundle: true,
      outdir: harness,
      entryNames: "bundle",
      jsx: "automatic",
      absWorkingDir: REPO,
      nodePaths: [path.join(REPO, "node_modules")],
      logLevel: "error",
    });
    const bundleCssPath = path.join(harness, "bundle.css");
    let bundleCss = "";
    try {
      bundleCss = readFileSync(bundleCssPath, "utf8");
    } catch {
      throw new Error(
        "canvas-to-code: esbuild produced no bundle.css — the CSS Modules import did not land",
      );
    }
    writeFileSync(
      path.join(harness, "index.html"),
      `<!doctype html><html><head><meta charset="utf-8">
<style>html { color-scheme: light; } body { margin: 0; background: #ffffff; }
*, *::before, *::after { animation: none !important; transition: none !important; }</style>
<style>${bundleCss}</style>
</head><body><div id="root"></div>
<script src="bundle.js"></script></body></html>`,
    );

    const browser = await launchBrowser();
    try {
      const page = await browser.newPage({
        viewport: { width: 1400, height: 900 },
        colorScheme: "light",
        locale: "en-US",
        timezoneId: "UTC",
      });
      await page.goto(`file://${path.join(harness, "index.html")}`, {
        waitUntil: "load",
      });
      await page.waitForSelector("[data-cell]");
      const rendered = (await page.evaluate(
        `(() => {
  const ROOT_PROPS = ${JSON.stringify(READ_ROOT_PROPS)};
  const LABEL_PROPS = ${JSON.stringify(READ_LABEL_PROPS)};
  const read = (el, props) => {
    const cs = getComputedStyle(el);
    const out = {};
    for (const p of props) out[p] = cs.getPropertyValue(p);
    return out;
  };
  const out = [];
  for (const cellEl of document.querySelectorAll('[data-cell]')) {
    const root = cellEl.firstElementChild;
    if (!root) { out.push({ key: cellEl.getAttribute('data-cell'), root: null, label: null, children: [] }); continue; }
    let label = null;
    const children = [];
    for (const child of root.children) {
      const text = (child.textContent || '').trim();
      if (text.length > 0 && label === null) {
        label = { ...read(child, LABEL_PROPS), text };
      } else {
        const cs = getComputedStyle(child);
        children.push({
          tag: child.tagName.toLowerCase(),
          text,
          width: cs.getPropertyValue('width'),
          height: cs.getPropertyValue('height'),
        });
      }
    }
    out.push({
      key: cellEl.getAttribute('data-cell'),
      root: read(root, ROOT_PROPS),
      label,
      children,
    });
  }
  return out;
})()`,
      )) as RenderedCell[];
      await page.close();
      return rendered;
    } finally {
      await browser.close();
    }
  } finally {
    rmSync(harness, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 3d — the computed-style diff / accounting engine
// ---------------------------------------------------------------------------

export type RenderDisposition =
  | "matched"
  | "named-delta"
  | "carried"
  | "receipted";

export interface RenderLedgerRow {
  factId: string;
  nodeOwnershipKey: string;
  channel: string;
  disposition: RenderDisposition;
  /** Computed property compared (matched / named-delta). */
  computed?: string;
  expected?: string;
  actual?: string;
  /** Carriage rule (carried) or named reason (receipted). */
  landing?: string;
  /** The proposal note/degradation that EXPLAINS a named-delta. */
  explainedBy?: string;
}

const hexToCss = (hex: string): string => {
  const raw = hex.toLowerCase().replace(/^#/, "");
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if (raw.length === 8) {
    const a = Number.parseInt(raw.slice(6, 8), 16) / 255;
    if (a >= 1) return `rgb(${r}, ${g}, ${b})`;
    return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
};

const FONT_WEIGHT_BY_STYLE: Record<string, string> = {
  regular: "400",
  medium: "500",
  semibold: "600",
  "semi bold": "600",
  bold: "700",
};

/** Colors compare numerically with ±1/255 per channel (Chromium rounds
 *  fractional alpha compositing); everything else compares as strings. */
const colorsAgree = (expected: string, actual: string): boolean => {
  if (expected === actual) return true;
  const parse = (value: string): number[] | null => {
    const match = value.match(/^rgba?\(([^)]+)\)$/);
    if (!match) return null;
    return match[1]!.split(",").map((part) => Number.parseFloat(part.trim()));
  };
  const left = parse(expected);
  const right = parse(actual);
  if (left === null || right === null) return false;
  if (left.length === 3) left.push(1);
  if (right.length === 3) right.push(1);
  return (
    left.length === right.length &&
    left.every((v, i) => Math.abs(v - (right[i] ?? Number.NaN)) <= (i === 3 ? 0.02 : 1))
  );
};

export interface RenderDiffResult {
  ledger: RenderLedgerRow[];
  counts: {
    facts: number;
    matched: number;
    namedDeltas: number;
    carried: number;
    receipted: number;
    silent: number;
    unexplainedDeltas: number;
  };
  deltaSummaries: string[];
}

export function diffRenderedAgainstFacts(
  doc: CanvasFactsDocument,
  build: CanvasToCodeBuild,
  cells: MountCell[],
  rendered: RenderedCell[],
): RenderDiffResult {
  const renderedByKey = new Map(rendered.map((cell) => [cell.key, cell]));
  const sceneByKey = new Map<string, SceneNodeSnapshot>();
  const index = (node: SceneNodeSnapshot): void => {
    sceneByKey.set(node.ownershipKey, node);
    for (const child of node.children) index(child);
  };
  index(doc.scene);

  /** Cell lookup: componentKey → { cell, rendered }. Child nodes resolve to
   *  their owning component by ownership-key prefix. */
  const cellByComponentKey = new Map(cells.map((cell) => [cell.ownershipKey, cell]));
  const componentKeyOf = (ownershipKey: string): string | null => {
    const match = ownershipKey.match(/^(root\/children\/\d+)/);
    return match?.[1] ?? null;
  };

  const notes = build.proposalNotes;
  const explain = (keywords: string[]): string | undefined =>
    notes.find((note) =>
      keywords.some((keyword) =>
        note.toLowerCase().includes(keyword.toLowerCase()),
      ),
    );

  const rows: RenderLedgerRow[] = [];
  const unexplained: string[] = [];
  const row = (
    fact: SceneFact,
    partial: Omit<RenderLedgerRow, "factId" | "nodeOwnershipKey" | "channel">,
  ): void => {
    rows.push({
      factId: fact.id,
      nodeOwnershipKey: fact.nodeOwnershipKey,
      channel: fact.channel,
      ...partial,
    });
    if (partial.disposition === "named-delta" && partial.explainedBy === undefined)
      unexplained.push(
        `${fact.id}: ${partial.computed ?? fact.channel} expected ${partial.expected} got ${partial.actual} — NO proposal note explains this delta`,
      );
  };

  const compare = (
    fact: SceneFact,
    computed: string,
    expected: string,
    actual: string | undefined,
    explanationKeywords: string[],
    agree?: (expected: string, actual: string) => boolean,
  ): void => {
    if (actual === undefined) {
      row(fact, {
        disposition: "named-delta",
        computed,
        expected,
        actual: "(element not rendered)",
        explainedBy: explain(explanationKeywords),
      });
      return;
    }
    const same = agree ? agree(expected, actual) : expected === actual;
    if (same) {
      row(fact, { disposition: "matched", computed, expected, actual });
    } else {
      row(fact, {
        disposition: "named-delta",
        computed,
        expected,
        actual,
        explainedBy: explain(explanationKeywords),
      });
    }
  };

  /** Rendered child element for an INSTANCE node: canvas children of a
   *  component are [instances…, label, instances…]; rendered children
   *  (excluding the label span) hold instances in the SAME drawn order. */
  const renderedInstance = (
    componentKey: string,
    instanceKey: string,
  ): RenderedChild | undefined => {
    const component = sceneByKey.get(componentKey);
    const renderedCell = renderedByKey.get(componentKey);
    if (component === undefined || renderedCell === undefined)
      return undefined;
    const instanceKeys = component.children
      .map((child, i) => ({ child, key: `${componentKey}/children/${i}` }))
      .filter(({ child }) => child.type === "INSTANCE")
      .map(({ key }) => key);
    const position = instanceKeys.indexOf(instanceKey);
    if (position < 0) return undefined;
    return renderedCell.children[position];
  };

  for (const fact of doc.facts) {
    const componentKey = componentKeyOf(fact.nodeOwnershipKey);

    // ---- set-root facts -------------------------------------------------
    if (componentKey === null) {
      if (fact.channel === "variantAxis") {
        row(fact, {
          disposition: "matched",
          computed: "mount matrix",
          expected: canonicalJson(fact.value),
          actual: `prop landed; every drawn cell mounted (${cells.length})`,
        });
      } else if (fact.channel === "child") {
        row(fact, {
          disposition: "carried",
          landing: "variants[] order → mount matrix order",
        });
      } else if (fact.channel === "name") {
        row(fact, {
          disposition: "carried",
          landing: "setName → contract id/name (verbatim-name rule, named in proposal notes)",
        });
      } else {
        row(fact, {
          disposition: "receipted",
          landing:
            "component-set proof-sheet chrome — the emitted component has no set-level surface; receipt (same class as the bridge receipt)",
        });
      }
      continue;
    }

    const node = sceneByKey.get(fact.nodeOwnershipKey);
    const renderedCell = renderedByKey.get(componentKey);
    if (node === undefined)
      throw new Error(`canvas-to-code: no scene node for ${fact.nodeOwnershipKey}`);
    if (renderedCell === undefined || renderedCell.root === null)
      throw new Error(`canvas-to-code: cell ${componentKey} did not render`);
    const root = renderedCell.root;
    const label = renderedCell.label;
    const isComponentRoot = fact.nodeOwnershipKey === componentKey;
    const isText = node.type === "TEXT";
    const isInstance = node.type === "INSTANCE";

    switch (fact.channel) {
      case "layout.mode": {
        compare(
          fact,
          "display/flex-direction",
          fact.value === "horizontal" ? "inline-flex/row" : "inline-flex/column",
          `${root.display}/${root["flex-direction"]}`,
          ["layout"],
          (expected, actual) =>
            (expected === "inline-flex/row" &&
              (actual === "inline-flex/row" || actual === "flex/row")) ||
            expected === actual,
        );
        break;
      }
      case "layout.primaryAxisAlign": {
        const expected =
          { min: "normal|flex-start", center: "center", max: "flex-end", "space-between": "space-between" }[
            String(fact.value)
          ] ?? String(fact.value);
        compare(fact, "justify-content", expected, root["justify-content"], ["layout"], (e, a) =>
          e.split("|").includes(a),
        );
        break;
      }
      case "layout.counterAxisAlign": {
        const expected =
          { min: "normal|flex-start", center: "center", max: "flex-end", baseline: "baseline" }[
            String(fact.value)
          ] ?? String(fact.value);
        compare(fact, "align-items", expected, root["align-items"], ["layout"], (e, a) =>
          e.split("|").includes(a),
        );
        break;
      }
      case "layout.itemSpacing": {
        compare(fact, "column-gap", `${String(fact.value)}px`, root["column-gap"], ["gap", "spacing"]);
        break;
      }
      case "layout.padding": {
        const padding = fact.value as { top: number; right: number; bottom: number; left: number };
        const actual = `${root["padding-top"]}/${root["padding-right"]}/${root["padding-bottom"]}/${root["padding-left"]}`;
        compare(
          fact,
          "padding (t/r/b/l)",
          `${padding.top}px/${padding.right}px/${padding.bottom}px/${padding.left}px`,
          actual,
          ["padding"],
        );
        break;
      }
      case "cornerRadius": {
        const radius = fact.value as {
          topLeft: number;
          topRight: number;
          bottomRight: number;
          bottomLeft: number;
        };
        if (!isComponentRoot) {
          row(fact, {
            disposition: "carried",
            landing:
              "instance corner radius belongs to the child component (dump v1 stops at instance boundaries); the stub renders the observed box",
          });
          break;
        }
        const actual = `${root["border-top-left-radius"]}/${root["border-top-right-radius"]}/${root["border-bottom-right-radius"]}/${root["border-bottom-left-radius"]}`;
        compare(
          fact,
          "border-radius (tl/tr/br/bl)",
          `${radius.topLeft}px/${radius.topRight}px/${radius.bottomRight}px/${radius.bottomLeft}px`,
          actual,
          ["radius"],
        );
        break;
      }
      case "fill": {
        const paint = fact.value as { kind: string; color?: string };
        if (paint.kind !== "solid" || paint.color === undefined) {
          row(fact, {
            disposition: "receipted",
            landing: `non-solid ${paint.kind} paint — outside the diff vocabulary; receipt`,
          });
          break;
        }
        if (isText) {
          compare(fact, "color (label)", hexToCss(paint.color), label?.color, ["fill", "color"], colorsAgree);
        } else if (isInstance) {
          row(fact, {
            disposition: "receipted",
            landing: "instance fill — internals belong to the child component; receipt",
          });
        } else {
          compare(fact, "background-color", hexToCss(paint.color), root["background-color"], ["fill", "background"], colorsAgree);
        }
        break;
      }
      case "stroke": {
        const stroke = fact.value as {
          weight: number;
          align: string;
          paint: { kind: string; color?: string };
        };
        if (stroke.paint.kind !== "solid" || stroke.paint.color === undefined) {
          row(fact, {
            disposition: "receipted",
            landing: `non-solid stroke paint — outside the diff vocabulary; receipt`,
          });
          break;
        }
        const expected = `${stroke.weight}px ${hexToCss(stroke.paint.color)} (${stroke.align})`;
        const actual = `${root["border-top-width"]} ${root["border-top-color"]} (INSIDE-as-border)`;
        compare(
          fact,
          "border-width/color vs drawn stroke",
          expected,
          actual,
          ["stroke", "border"],
          (e, a) => {
            const em = e.match(/^([\d.]+)px (rgba?\([^)]+\)) \((\w+)/);
            const am = a.match(/^([\d.]+)px (rgba?\([^)]+\))/);
            if (!em || !am) return false;
            if (em[3] !== "inside") return false; // outside strokes need the outline vocabulary — delta
            return em[1] === am[1] && (em[1] === "0" || colorsAgree(em[2]!, am[2]!));
          },
        );
        break;
      }
      case "effect": {
        const effect = fact.value as {
          kind: string;
          offsetX?: number;
          offsetY?: number;
          blur?: number;
          spread?: number;
          color?: string;
        };
        if (effect.kind !== "drop-shadow") {
          row(fact, {
            disposition: "receipted",
            landing: `${effect.kind} — outside the diff vocabulary; receipt`,
          });
          break;
        }
        const expected = `${hexToCss(effect.color ?? "#000000")} ${effect.offsetX ?? 0}px ${effect.offsetY ?? 0}px ${effect.blur ?? 0}px ${effect.spread ?? 0}px`;
        compare(fact, "box-shadow", expected, root["box-shadow"], ["effect", "box-shadow", "shadow"], (e, a) => {
          if (a === "none") return false;
          const norm = (s: string) => s.replace(/\s+/g, " ").trim();
          return norm(a) === norm(e);
        });
        break;
      }
      case "characters": {
        compare(fact, "textContent (label)", String(fact.value), label?.text, ["characters", "text prop", "content"]);
        break;
      }
      case "type": {
        const type = fact.value as {
          fontFamily: string;
          fontStyle: string;
          fontSize: number;
          lineHeight: { unit: string; value?: number };
        };
        const weight =
          FONT_WEIGHT_BY_STYLE[type.fontStyle.replace(/\s+/g, "").toLowerCase()];
        const expectedLine =
          type.lineHeight.unit === "px" ? `${type.lineHeight.value}px` : type.lineHeight.unit;
        const expected = `${type.fontSize}px/${expectedLine} w${weight ?? `?(${type.fontStyle})`} ${type.fontFamily}`;
        const actual =
          label === null
            ? undefined
            : `${label["font-size"]}/${label["line-height"]} w${label["font-weight"]} ${label["font-family"]?.replaceAll('"', "")}`;
        compare(fact, "font-size/line-height/font-weight/font-family", expected, actual, ["font", "text style"]);
        break;
      }
      case "align": {
        compare(
          fact,
          "text-align (label)",
          String(fact.value).toLowerCase(),
          label?.["text-align"],
          ["text-align", "textAlign"],
        );
        break;
      }
      case "verticalAlign": {
        row(fact, {
          disposition: "receipted",
          landing:
            "textAlignVertical has no computed-CSS twin here — the root's align-items centering carries the rendered position (compared on layout.counterAxisAlign); receipt",
        });
        break;
      }
      case "binding": {
        row(fact, {
          disposition: "carried",
          landing:
            "token identity — carried through the bridge rename table into captured/minted DTCG trees; the RESOLVED VALUE is verified wherever its channel is compared (fill/stroke/padding/gap/radius/typography rows)",
        });
        break;
      }
      case "componentRef":
      case "properties": {
        const instance = renderedInstance(componentKey, fact.nodeOwnershipKey);
        if (instance === undefined) {
          row(fact, {
            disposition: "named-delta",
            computed: "child element presence",
            expected: `rendered child for ${String(
              fact.channel === "componentRef" ? fact.value : "instance",
            )}`,
            actual: "(not rendered)",
            explainedBy: explain(["DEGRADATION part omitted", "part omitted"]),
          });
        } else {
          row(fact, {
            disposition: "matched",
            computed: "child element presence",
            expected: "rendered child element",
            actual: `<${instance.tag}> ${instance.width}×${instance.height}`,
          });
        }
        break;
      }
      case "width.value":
      case "height.value": {
        if (isInstance) {
          const instance = renderedInstance(componentKey, fact.nodeOwnershipKey);
          const axis = fact.channel === "width.value" ? "width" : "height";
          compare(
            fact,
            `${axis} (stub box)`,
            `${String(fact.value)}px`,
            instance?.[axis],
            ["DEGRADATION part omitted", "part omitted", "stub"],
          );
        } else {
          row(fact, {
            disposition: "carried",
            landing: "fixed drawn size carried as fixedSize/bbox in the bridge; not re-measured (text metrics differ off-canvas)",
          });
        }
        break;
      }
      case "width.mode":
      case "height.mode": {
        row(fact, {
          disposition: "carried",
          landing:
            String(fact.value) === "fixed"
              ? "FIXED sizing verified via width.value/height.value rows where an element renders"
              : "hug/fill sizing is a layout MODE, not a computed property — carried by the emitted flex layout (display/flex rows)",
        });
        break;
      }
      case "opacity": {
        if (isComponentRoot) {
          compare(fact, "opacity", String(fact.value), root.opacity, ["opacity"]);
        } else {
          row(fact, {
            disposition: "carried",
            landing: "child opacity 1 — the dump omits it; nothing to diff",
          });
        }
        break;
      }
      case "kind": {
        row(fact, { disposition: "carried", landing: "node type → dump node type → anatomy part class" });
        break;
      }
      case "name": {
        row(fact, { disposition: "carried", landing: "drawn name → dump name → part name (sanitizations named in proposal notes)" });
        break;
      }
      case "role": {
        row(fact, { disposition: "carried", landing: "role rides the drawn name (role :: label spelling)" });
        break;
      }
      case "child": {
        row(fact, { disposition: "carried", landing: "children[] order → anatomy part order (instance presence verified per componentRef row)" });
        break;
      }
      case "visible": {
        row(fact, {
          disposition: fact.value === true ? "carried" : "receipted",
          landing:
            fact.value === true
              ? "visible:true is the dump default (hidden captured only when false)"
              : "hidden node — not in this diff's vocabulary; receipt",
        });
        break;
      }
      case "clipsContent": {
        row(fact, {
          disposition: "carried",
          landing: "clipsContent:false is the CSS default (overflow visible) — dump captures only true",
        });
        break;
      }
      case "layout.positioning": {
        row(fact, {
          disposition: "carried",
          landing: "in-flow (AUTO) — the emitted flex flow IS in-flow; absolute would be a bridge receipt",
        });
        break;
      }
      case "variantProperties": {
        row(fact, {
          disposition: "matched",
          computed: "mount cell props",
          expected: canonicalJson(fact.value),
          actual: canonicalJson(cellByComponentKey.get(componentKey)?.props ?? {}),
        });
        break;
      }
      default: {
        row(fact, {
          disposition: "receipted",
          landing: `channel ${fact.channel} has no diff rule — receipt (extend the engine before claiming it)`,
        });
      }
    }
  }

  const silent = doc.facts.length - rows.length;
  const counts = {
    facts: doc.facts.length,
    matched: rows.filter((r) => r.disposition === "matched").length,
    namedDeltas: rows.filter((r) => r.disposition === "named-delta").length,
    carried: rows.filter((r) => r.disposition === "carried").length,
    receipted: rows.filter((r) => r.disposition === "receipted").length,
    silent,
    unexplainedDeltas: unexplained.length,
  };
  const deltaSummaries = [...new Set(
    rows
      .filter((r) => r.disposition === "named-delta")
      .map(
        (r) =>
          `${r.channel} (${r.computed}): explained by ${
            r.explainedBy === undefined ? "NOTHING — FAIL" : `"${r.explainedBy.slice(0, 140)}…"`
          }`,
      ),
  )];
  if (silent !== 0)
    throw new Error(
      `canvas-to-code: ${silent} fact(s) produced no render-ledger row — silent loss forbidden`,
    );
  if (unexplained.length > 0)
    throw new Error(
      `canvas-to-code: ${unexplained.length} UNEXPLAINED render delta(s):\n${unexplained
        .slice(0, 20)
        .join("\n")}`,
    );
  return { ledger: rows, counts, deltaSummaries };
}

export async function runCanvasToCodeFromFacts(
  doc: CanvasFactsDocument,
  outRoot: string,
  options?: {
    extraNotes?: string[];
    regenerateHint?: string;
    contractFileName?: string;
  },
): Promise<{
  build: CanvasToCodeBuild;
  diff: RenderDiffResult;
  cellsMounted: number;
}> {
  const build = await buildCanvasToCodeFromFacts(doc, outRoot, options);
  if (options?.extraNotes) build.proposalNotes.push(...options.extraNotes);
  const cells = mountCells(build.doc, build.contract);
  const rendered = await renderCells(build, cells);
  const diff = diffRenderedAgainstFacts(build.doc, build, cells, rendered);
  return { build, diff, cellsMounted: cells.length };
}

// ---------------------------------------------------------------------------
// Receipt + CLI
// ---------------------------------------------------------------------------

export interface CanvasToCodeReceipt {
  artifactVersion: typeof CANVAS_TO_CODE_VERSION;
  method: "committed-observe → canvas-facts → bridge → proposeFromDump → react emitter → chromium computed-style diff";
  substrate: {
    observePath: string;
    observeSha256: string;
    canvasFactsPath: string;
    figmaWrites: 0;
    liveReads: 0;
  };
  bridge: CanvasBridgeResult["counts"] & { tokenRenames: number };
  proposal: {
    contractId: string;
    componentName: string;
    projection: string;
    notes: number;
    unbound: number;
    mintedTokens: number;
    childStubs: number;
  };
  emitted: Array<{ path: string; sha256: string }>;
  render: RenderDiffResult["counts"] & { cellsMounted: number };
  deltaSummaries: string[];
  checkbox: {
    status: "named-blocker";
    blocker: string;
  };
  humanGrade: "pending";
  gradeInvented: false;
  overallSuccess: false;
}

export const CHECKBOX_BLOCKER =
  "Checkbox has NO committed scene observe: the only committed canvas artifacts for checkbox v3 (recipe/evidence/checkbox-live-pivot-v3/) are structural receipts (set ids, winding, glyph paths) and stay records — no SceneNodeSnapshot tree with per-node geometry/paints/typography exists offline, and this task forbids live Figma reads. Producing the Checkbox observe (a scene readback of page 198:77718) is the named unblocking step for a future LIVE session.";

export async function runCanvasToCode(write: boolean): Promise<CanvasToCodeReceipt> {
  const workRoot = write
    ? path.resolve(REPO, CANVAS_TO_CODE_ROOT)
    : mkdtempSync(path.join(os.tmpdir(), "canvas-to-code-check-"));
  try {
    const build = await buildButtonCanvasToCode(
      write ? workRoot : path.join(workRoot, "out"),
    );
    const cells = mountCells(build.doc, build.contract);
    const rendered = await renderCells(build, cells);
    const diff = diffRenderedAgainstFacts(build.doc, build, cells, rendered);

    const receipt: CanvasToCodeReceipt = {
      artifactVersion: CANVAS_TO_CODE_VERSION,
      method:
        "committed-observe → canvas-facts → bridge → proposeFromDump → react emitter → chromium computed-style diff",
      substrate: {
        observePath: build.doc.source.observePath,
        observeSha256: build.doc.source.observeSha256,
        canvasFactsPath: BUTTON_CANVAS_FACTS_PATH,
        figmaWrites: 0,
        liveReads: 0,
      },
      bridge: {
        ...build.bridge.counts,
        tokenRenames: build.bridge.tokenRenames.length,
      },
      proposal: {
        contractId: String((build.contract as { id?: unknown }).id ?? ""),
        componentName: build.componentName,
        projection: (build.proposal.projection as { status?: string }).status ?? "",
        notes: build.proposalNotes.length,
        unbound: build.proposal.unbound.length,
        mintedTokens: build.proposal.mintedTokens?.count ?? 0,
        childStubs: (build.proposal.childStubs ?? []).length,
      },
      emitted: build.emittedFiles,
      render: { ...diff.counts, cellsMounted: cells.length },
      deltaSummaries: diff.deltaSummaries,
      checkbox: { status: "named-blocker", blocker: CHECKBOX_BLOCKER },
      humanGrade: "pending",
      gradeInvented: false,
      overallSuccess: false,
    };

    if (write) {
      writeFileSync(
        path.resolve(REPO, CANVAS_TO_CODE_BRIDGE_PATH),
        gzipSync(
          Buffer.from(
            `${canonicalJson({
              dump: build.bridge.dump,
              ledger: build.bridge.ledger,
              tokenRenames: build.bridge.tokenRenames,
              counts: build.bridge.counts,
            })}\n`,
            "utf8",
          ),
          { level: 9 },
        ),
      );
      writeFileSync(
        path.resolve(REPO, CANVAS_TO_CODE_RENDER_LEDGER_PATH),
        gzipSync(
          Buffer.from(
            `${canonicalJson({ ledger: diff.ledger, counts: diff.counts })}\n`,
            "utf8",
          ),
          { level: 9 },
        ),
      );
      writeFileSync(
        path.resolve(REPO, CANVAS_TO_CODE_RECEIPT_PATH),
        `${canonicalJson(receipt)}\n`,
      );
    } else {
      // Fail closed: the committed receipt must match this recomputation.
      const committed = JSON.parse(
        readFileSync(path.resolve(REPO, CANVAS_TO_CODE_RECEIPT_PATH), "utf8"),
      ) as CanvasToCodeReceipt;
      if (canonicalJson(committed) !== canonicalJson(receipt)) {
        throw new Error(
          "canvas-to-code: committed receipt.json does not match recomputation — re-run `tsx recipe/canvas-to-code.ts --write` and review the diff",
        );
      }
      // The committed generated/ tree must match the regenerated bytes.
      for (const file of build.emittedFiles) {
        const committedPath = path.resolve(REPO, CANVAS_TO_CODE_ROOT, file.path);
        const committedHash = sha256(readFileSync(committedPath));
        if (committedHash !== file.sha256)
          throw new Error(
            `canvas-to-code: committed ${file.path} drifted from regeneration (${committedHash} != ${file.sha256})`,
          );
      }
    }
    return receipt;
  } finally {
    if (!write) rmSync(workRoot, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const write = process.argv.includes("--write");
  runCanvasToCode(write)
    .then((receipt) => {
      process.stdout.write(
        `${canonicalJson({
          artifactVersion: receipt.artifactVersion,
          mode: write ? "written" : "checked",
          bridge: receipt.bridge,
          render: receipt.render,
          deltaSummaries: receipt.deltaSummaries,
          checkbox: receipt.checkbox.status,
          overallSuccess: receipt.overallSuccess,
        })}\n`,
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
