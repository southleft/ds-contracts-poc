/**
 * CANVAS CENSUS — the REFERENCE half: THE REAL LIBRARY'S OWN RENDER.
 *
 *   npx tsx extract/figma/census/ref-render.ts --library <lib> [--id <id>] [--harness <dir>]
 *
 * THE PERMANENT RULE (owner, 2026-08-24, after rejecting the first census
 * with screenshots): **a visual reference is ONLY the real library's
 * render.** The census's code half is core/emit-html.ts over the CONTRACT —
 * self-referential by construction (both sides share the contract's defects
 * and agree while wrong). This half renders the SAME sampled variants with
 * the real library's own components in a real browser and writes, per row:
 *
 *   parity/receipts/v1/census/<lib>/<id>/ref-<slug>.png    one per sampled variant
 *   parity/receipts/v1/census/<lib>/<id>/ref-render.json   the row's receipt
 *
 * HOW each library's real render is produced:
 *   · first-party — the repo's own GENERATED React catalog (src/components/,
 *     the committed `npm run generate` output) IS the real implementation.
 *     Each row mounts through its generated Storybook meta (component +
 *     canonical args/render — the catalog's own documented usage), bundled
 *     with esbuild and captured by the canvas gate's captureCell.
 *   · example libraries — the library's own npm package, mounted exactly the
 *     way the computed-capture floor mounts it (extract/computed/configs/
 *     <lib>.json: provider wrapper, stylesheet imports, headStyles,
 *     preScript, font faces, axisValueMap / presenceProps / stateProps /
 *     fixedProps / childWrap / childrenSpec), in the library's documented
 *     sandbox (examples/<lib>/README recipe; version pinned — drift refuses).
 *
 * CELL MAPPING: the row's code-render.json lists the sampled variants
 * (contract subst + bools + interaction). Contract axis values map to real
 * library props through the capture config's own measured mapping
 * (axisValueMap, $props expansion, presenceProps, stateProps); a contract
 * prop the config never mapped mounts VERBATIM (the contract was proposed
 * from this library, so unmapped names are the library's own). Interaction
 * states (hover / focus-visible / active) are driven by pointer and keyboard
 * through shots.ts captureCell — the same driver as the code half.
 *
 * A variant that CANNOT be produced from the real library is recorded as
 * `ref: UNMAPPABLE (<reason>)` by name in ref-render.json — never faked,
 * never silently absent. The census gate (scripts/canvas-census-check.ts)
 * requires, at --phase full, every rendered variant to carry ref-<slug>.png
 * OR a named UNMAPPABLE row here.
 *
 * Portal components (config portalCapture — Dialog/Modal/Tooltip/Menu/…)
 * mount one cell per page with the config's openDriver and are captured as
 * the union of the stage and every DOM root the mount added to document.body
 * (the overlay lives in a portal the in-stage measure never sees).
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
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import type { Browser, Page } from "playwright-core";
import {
  launchGateBrowser,
  newGatePage,
  captureCell,
  type Interaction,
} from "../canvas-gate/shots.js";
import {
  loadConfig,
  fontFaceStyleTag,
  headStyleTags,
  preScriptTag,
  walkChildSpecs,
  type CaptureConfig,
  type ComponentConfig,
  type ChildSpec,
} from "../../computed/capture.js";
import {
  CENSUS_DIR,
  REPO,
  enumerateCorpus,
  type CorpusRow,
} from "./corpus.js";
import type { CodeRenderReceipt, RenderedVariantReceipt } from "./render.js";

export interface RefReceiptRow {
  slug: string;
  status: "rendered" | "unmappable";
  /** UNMAPPABLE (<reason>) — REQUIRED when status is "unmappable". */
  reason?: string;
  png?: string;
  /** The real-library props the cell mounted (JSON-safe echo). */
  props?: Record<string, unknown>;
  capture?: "cell" | "portal";
}

export interface RefRenderReceipt {
  id: string;
  library: string;
  renderer: string;
  /** Where the real library came from — package + pinned version + recipe. */
  harness: { package: string; version: string; recipe: string };
  configPath: string | null;
  component: string | null;
  platform: string;
  refs: RefReceiptRow[];
  rendered: number;
  unmappable: number;
}

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const ONLY_LIBRARY = flag("--library");
const ONLY_ID = flag("--id");
const HARNESS = flag("--harness");

const CONFIG_BY_LIBRARY: Record<string, string> = {
  altitude: "extract/computed/configs/altitude.json",
  antd: "extract/computed/configs/antd.json",
  astryx: "extract/computed/configs/astryx.json",
  carbon: "extract/computed/configs/carbon.json",
  fluent: "extract/computed/configs/fluent.json",
  mui: "extract/computed/configs/mui.json",
  polaris: "extract/computed/configs/polaris.json",
  shadcn: "extract/computed/configs/shadcn.json",
  tailwind: "extract/computed/configs/tailwind.json",
};

/** The documented sandbox location per library (examples/<lib>/README). */
const SANDBOX_BY_LIBRARY: Record<string, string> = {
  altitude: "examples/altitude/.altitude-sandbox",
  antd: "examples/antd/.antd-sandbox",
  astryx: "examples/astryx/.astryx-sandbox",
  carbon: "examples/carbon/.carbon-sandbox",
  fluent: "examples/fluent/.fluent-sandbox",
  mui: "examples/mui/.mui-sandbox",
  polaris: "examples/polaris/.polaris-sandbox",
  shadcn: "examples/shadcn/.shadcn-sandbox",
  tailwind: "examples/tailwind/.tw-sandbox",
};

/** SUPPLEMENTAL MOUNTS — census rows whose contract has NO capture-config
 *  entry (captured in a later round under a different door). Each entry is a
 *  census-ref mount only (NOT a capture-config row): the minimal canonical
 *  mount of the real component, props from the committed contract's own
 *  defaults. Provenance: this table, reviewed with the receipt. */
const SUPPLEMENTAL: Record<string, ComponentConfig[]> = {
  astryx: [
    {
      name: "DropdownMenu",
      importName: "DropdownMenu",
      contract: "examples/astryx/contracts/dropdown-menu.contract.json",
      sampleText: "",
      axes: [],
      fixedProps: {
        items: [
          { label: "Menu item" },
          { label: "Second item" },
          { label: "Third item" },
        ],
      },
    },
    {
      name: "DropdownMenuItem",
      importName: "DropdownMenuItem",
      contract: "examples/astryx/contracts/dropdown-menu-item.contract.json",
      sampleText: "",
      axes: [],
      fixedProps: { label: "Menu item" },
    },
    {
      name: "Toast",
      importName: "Toast",
      contract: "examples/astryx/contracts/toast.contract.json",
      sampleText: "",
      axes: [],
      fixedProps: { body: "Saved successfully" },
    },
  ],
};

const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;

// ---------------------------------------------------------------------------
// Contract cell → real library props (the capture config's own mapping)
// ---------------------------------------------------------------------------

function mapCellProps(
  comp: ComponentConfig,
  v: RenderedVariantReceipt,
): Record<string, unknown> {
  const props: Record<string, unknown> = { ...(comp.fixedProps ?? {}) };
  const applyMapped = (prop: string, value: string): void => {
    const mapped = comp.axisValueMap?.[prop];
    const mv = mapped && value in mapped ? mapped[value] : undefined;
    if (
      mv &&
      typeof mv === "object" &&
      !Array.isArray(mv) &&
      "$props" in (mv as Record<string, unknown>)
    ) {
      for (const [lp, lv] of Object.entries(
        (mv as { $props: Record<string, unknown> }).$props,
      ))
        props[lp] = lv;
      return;
    }
    props[prop] = mv !== undefined ? mv : value;
  };
  for (const [prop, value] of Object.entries(v.subst)) applyMapped(prop, value);
  for (const [prop, value] of Object.entries(v.bools)) {
    const pp = (comp.presenceProps ?? []).find((p) => p.prop === prop);
    if (pp) {
      if (value) props[pp.libraryProp] = pp.value;
      continue;
    }
    const mapped = comp.axisValueMap?.[prop];
    if (mapped && String(value) in mapped) {
      applyMapped(prop, String(value));
      continue;
    }
    // A false boolean mounts ABSENT (custom-element attribute-presence
    // semantics; React's own default for the rest).
    if (value) props[prop] = true;
  }
  // A state cell whose driver is a prop the CONTRACT does not spell the
  // library's way (contract declares states:[disabled], config stateProps
  // names the library prop) — map by state name.
  if (v.state) {
    const sp = (comp.stateProps ?? []).find((s) => s.state === v.state);
    if (sp && !(sp.prop in props)) {
      // The render half already set the contract-side bool when it existed;
      // drop a differently-spelled contract bool in favor of the library's.
      for (const [k, val] of Object.entries(v.bools))
        if (val === true && /disabled/i.test(k) && k !== sp.prop)
          delete props[k];
      props[sp.prop] = true;
    }
  }
  for (const cb of comp.callbackProps ?? [])
    props[cb] = { $callback: true } as unknown;
  return props;
}

/** JSON-safe echo for the receipt (markers left as-is; functions never). */
const jsonSafe = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------------------
// Foreign-library harness page (mirrors extract/computed/capture.ts semantics)
// ---------------------------------------------------------------------------

interface RefCell {
  key: string;
  rowId: string;
  slug: string;
  component: string;
  props: Record<string, unknown>;
  interaction: Interaction;
  portal: boolean;
  childWrap?: string;
  childrenSpec?: ChildSpec[];
  text: string;
  blockStage?: boolean;
  stageWidth: number;
}

function buildForeignEntry(cfg: CaptureConfig, cells: RefCell[]): string {
  const ce = cfg.library.customElements === true;
  const importNames = [
    ...new Set(
      cells.flatMap((c) => [
        c.component,
        ...(c.childWrap ? [c.childWrap] : []),
        ...walkChildSpecs(c.childrenSpec).map((s) => s.importName),
      ]),
    ),
  ].sort();
  // $import/$render/$element markers → real imports (capture.ts grammar).
  const extraImports = new Map<string, Set<string>>();
  const collect = (v: unknown): void => {
    if (v && typeof v === "object") {
      const rec = v as Record<string, unknown>;
      const imp =
        typeof rec.$import === "string"
          ? rec.$import
          : typeof rec.$render === "string"
            ? rec.$render
            : typeof rec.$element === "string"
              ? rec.$element
              : undefined;
      if (typeof imp === "string") {
        const [pkg, name] = imp.split("#");
        (
          extraImports.get(pkg) ?? extraImports.set(pkg, new Set()).get(pkg)!
        ).add(name);
        return;
      }
      for (const x of Object.values(v)) collect(x);
    }
  };
  for (const c of cells) {
    collect(c.props);
    for (const cs of walkChildSpecs(c.childrenSpec)) collect(cs.props ?? {});
  }
  // A marker naming an export ALREADY imported from the library's main
  // import line (mui TextField as a component AND as an $element target)
  // must not be re-declared — the binding is already in scope.
  const already = new Set(ce ? [] : importNames);
  const extraImportLines = [...extraImports.entries()]
    .sort()
    .map(([pkg, names]) => {
      const wanted = [...names]
        .filter((n) => !(pkg === cfg.library.package && already.has(n)))
        .sort();
      return wanted.length > 0
        ? `import { ${wanted.join(", ")} } from '${pkg}';`
        : "";
    })
    .filter((l) => l !== "");
  const extraNames = [...new Set([...extraImports.values()].flatMap((s) => [...s]))]
    .sort();
  return `import React from 'react';
import { createRoot } from 'react-dom/client';
${ce ? "" : `import { ${importNames.join(", ")} } from '${cfg.library.package}';\n`}${extraImportLines.join("\n")}
${cfg.mount.imports.join("\n")}

const CE = ${ce};
const COMPONENTS = ${ce ? JSON.stringify(Object.fromEntries(importNames.map((n) => [n, n]))) : `{ ${importNames.join(", ")} }`};
const EXTRA = { ${extraNames.join(", ")} };
const CELLS = ${JSON.stringify(cells.map(({ key, component, props, childWrap, childrenSpec, text, blockStage, stageWidth }) => ({ key, component, props, childWrap, childrenSpec, text, blockStage, stageWidth })))};

const ceProps = (p) => {
  if (!CE) return p;
  const o = {};
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (v === false || v === undefined || v === null || typeof v === 'function') continue;
    o[k] = v;
  }
  return o;
};
function resolveMarkers(v) {
  if (v && typeof v === 'object') {
    if (v.$callback === true) return () => {};
    if (typeof v.$import === 'string') return EXTRA[v.$import.split('#')[1]];
    if (typeof v.$render === 'string') { const K = EXTRA[v.$render.split('#')[1]]; return (params) => React.createElement(K, params); }
    if (typeof v.$element === 'string') {
      const K = EXTRA[v.$element.split('#')[1]];
      return React.createElement(K, resolveMarkers(v.props || {}), v.text == null ? undefined : String(v.text));
    }
    if (Array.isArray(v)) return v.map(resolveMarkers);
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = resolveMarkers(x);
    return out;
  }
  return v;
}
function renderKidList(list) {
  return list.map((cs, i) => React.createElement(
    COMPONENTS[cs.importName],
    { key: i, ...ceProps(resolveMarkers({ ...(cs.props || {}) })) },
    cs.children ? renderKidList(cs.children) : cs.text,
  ));
}
function renderKids(c) {
  if (c.childrenSpec) return renderKidList(c.childrenSpec);
  if (c.childWrap) { const W = COMPONENTS[c.childWrap]; return React.createElement(W, null, c.text); }
  return c.text === '' ? undefined : c.text;
}
// One bad component must not kill the whole library page — the boundary
// renders a named error node the runner reads back as UNMAPPABLE.
class CellBoundary extends React.Component {
  constructor(p) { super(p); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: String((e && e.message) || e) }; }
  render() {
    if (this.state.error) return React.createElement('div', { 'data-ref-error': this.state.error });
    return this.props.children;
  }
}
function Cell({ c }) {
  const C = COMPONENTS[c.component];
  const props = ceProps(resolveMarkers({ ...c.props }));
  return React.createElement(C, props, renderKids(c));
}
function App() {
  return (
    ${cfg.mount.wrapperOpen || "<>"}
      {CELLS.map((c) => (
        <React.Fragment key={c.key}>
          <button data-sentinel={c.key} aria-label="sentinel" style={{ width: 8, height: 8, padding: 0, border: 0, margin: '0 0 28px 0', background: '#eee', display: 'block' }} />
          {/* Inner wrapper: some components render a FRAGMENT whose first
              element is invisible (flowbite ToggleSwitch's sr-only input) —
              captureCell measures the stage's FIRST child, so the wrapper is
              the single hugging box the painted-union measure reads. */}
          <div data-cell={c.key} style={c.blockStage ? { display: 'block', width: c.stageWidth, margin: '0 0 64px 0' } : { display: 'flex', alignItems: 'flex-start', width: 'max-content', margin: '0 0 64px 0' }}>
            <div style={c.blockStage ? { display: 'block', width: '100%' } : { display: 'inline-flex', alignItems: 'flex-start' }}>
              <CellBoundary><Cell c={c} /></CellBoundary>
            </div>
          </div>
        </React.Fragment>
      ))}
    ${cfg.mount.wrapperClose || "</>"}
  );
}
createRoot(document.getElementById('root')).render(<App />);
`;
}

function bundleForeignPage(
  harness: string,
  cfg: CaptureConfig,
  cells: RefCell[],
  pageName: string,
): string {
  const entry = buildForeignEntry(cfg, cells);
  const pageDir = path.join(harness, pageName);
  mkdirSync(pageDir, { recursive: true });
  writeFileSync(path.join(pageDir, "entry.jsx"), entry);
  execFileSync(
    path.join(harness, "node_modules", ".bin", "esbuild"),
    [
      `${pageName}/entry.jsx`,
      "--bundle",
      `--outfile=${pageName}/bundle.js`,
      "--jsx=automatic",
      "--loader:.json=json",
      "--loader:.svg=dataurl",
      "--loader:.png=dataurl",
      "--loader:.woff=dataurl",
      "--loader:.woff2=dataurl",
      "--log-level=error",
    ],
    { cwd: harness },
  );
  const bundleCssPath = path.join(pageDir, "bundle.css");
  const bundleCss = existsSync(bundleCssPath)
    ? readFileSync(bundleCssPath, "utf8")
    : "";
  writeFileSync(
    path.join(pageDir, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8">
${fontFaceStyleTag(REPO, cfg)}${headStyleTags(harness, cfg)}${preScriptTag(cfg)}${bundleCss ? `<style>${bundleCss}</style>` : ""}
<style>html { color-scheme: light; } body { margin: 0; padding: 24px; background: #ffffff; }
*, *::before, *::after { transition: none !important; }</style>
</head><body><div id="root"></div>
<script>document.addEventListener('click', (e) => e.preventDefault(), true);</script>
<script src="bundle.js"></script></body></html>`,
  );
  return path.join(pageDir, "index.html");
}

// ---------------------------------------------------------------------------
// Portal capture — the overlay lives outside the stage
// ---------------------------------------------------------------------------

const PORTAL_SETTLE_MS = 700;

async function capturePortalCell(page: Page, key: string): Promise<Buffer> {
  await page.waitForTimeout(PORTAL_SETTLE_MS);
  await page.evaluate(`(() => {
    for (const a of document.getAnimations()) {
      let t = null;
      try { t = a.effect && a.effect.getTiming ? a.effect.getTiming() : null; } catch {}
      if (t && t.iterations === Infinity) { if (a.playState !== 'paused') { a.pause(); a.currentTime = 0; } }
      else { try { a.finish(); } catch {} }
    }
  })()`);
  const clip = (await page.evaluate(`(() => {
    const margin = 24;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const union = (r) => {
      if (r.width === 0 && r.height === 0) return;
      if (r.left < minX) minX = r.left;
      if (r.top < minY) minY = r.top;
      if (r.right > maxX) maxX = r.right;
      if (r.bottom > maxY) maxY = r.bottom;
    };
    const consider = (el) => {
      const cs = getComputedStyle(el);
      if (cs.opacity === '0' || cs.visibility !== 'visible' || cs.display === 'none') return;
      union(el.getBoundingClientRect());
      for (const d of el.querySelectorAll('*')) {
        const dcs = getComputedStyle(d);
        if (dcs.opacity === '0' || dcs.visibility !== 'visible' || dcs.display === 'none') continue;
        const r = d.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue;
        union(r);
      }
    };
    const stage = document.querySelector('[data-cell=${JSON.stringify(key)}]');
    if (stage && stage.firstElementChild) consider(stage.firstElementChild);
    for (const el of document.body.children) {
      if (el.id === 'root') continue;
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'link') continue;
      consider(el);
    }
    if (minX === Infinity) return null;
    const x0 = Math.max(0, minX - margin);
    const y0 = Math.max(0, minY - margin);
    const x1 = Math.min(window.innerWidth, maxX + margin);
    const y1 = Math.min(window.innerHeight, maxY + margin);
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  })()`)) as { x: number; y: number; width: number; height: number } | null;
  if (!clip || clip.width <= 0 || clip.height <= 0)
    throw new Error("portal cell painted nothing");
  return Buffer.from(await page.screenshot({ clip }));
}

// ---------------------------------------------------------------------------
// Rendering one library
// ---------------------------------------------------------------------------

interface RowPlan {
  row: CorpusRow;
  receiptDir: string;
  code: CodeRenderReceipt;
  comp: ComponentConfig | null;
  compReason: string | null;
  supplemental: boolean;
}

function planRows(rows: CorpusRow[], cfg: CaptureConfig | null): RowPlan[] {
  const byContractId = new Map<string, ComponentConfig>();
  for (const comp of cfg?.components ?? []) {
    try {
      const id = readJson<{ id?: string }>(path.join(REPO, comp.contract)).id;
      if (typeof id === "string") byContractId.set(id, comp);
    } catch {
      /* a config contract that does not parse simply never matches */
    }
  }
  const plans: RowPlan[] = [];
  for (const row of rows) {
    const dir = path.join(REPO, CENSUS_DIR, row.library.library, row.row.id);
    const codePath = path.join(dir, "code-render.json");
    if (!existsSync(codePath)) {
      throw new Error(
        `${row.library.library}/${row.row.id}: no code-render.json — run the code half first (extract/figma/census/render.ts)`,
      );
    }
    const code = readJson<CodeRenderReceipt>(codePath);
    let comp = byContractId.get(row.row.id) ?? null;
    let supplemental = false;
    if (!comp) {
      comp =
        (SUPPLEMENTAL[row.library.library] ?? []).find((c) => {
          try {
            return (
              readJson<{ id?: string }>(path.join(REPO, c.contract)).id ===
              row.row.id
            );
          } catch {
            return false;
          }
        }) ?? null;
      supplemental = comp !== null;
    }
    plans.push({
      row,
      receiptDir: dir,
      code,
      comp,
      compReason: comp
        ? null
        : `no real-library mount mapping: ${row.row.id} has no component entry in the capture config and no supplemental mount`,
      supplemental,
    });
  }
  return plans;
}

function writeReceipt(
  plan: RowPlan,
  refs: RefReceiptRow[],
  harness: RefRenderReceipt["harness"],
  configPath: string | null,
  renderer: string,
): RefRenderReceipt {
  for (const f of readdirSync(plan.receiptDir))
    if (/^ref-.*\.png$/.test(f)) {
      if (!refs.some((r) => r.png === f)) rmSync(path.join(plan.receiptDir, f));
    }
  const receipt: RefRenderReceipt = {
    id: plan.row.row.id,
    library: plan.row.library.library,
    renderer,
    harness,
    configPath,
    component: plan.comp ? plan.comp.name : null,
    platform: `${process.platform}/${process.arch}`,
    refs,
    rendered: refs.filter((r) => r.status === "rendered").length,
    unmappable: refs.filter((r) => r.status === "unmappable").length,
  };
  writeFileSync(
    path.join(plan.receiptDir, "ref-render.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  return receipt;
}

async function renderForeignLibrary(
  browser: Browser,
  rows: CorpusRow[],
  library: string,
): Promise<RefRenderReceipt[]> {
  const configPath = CONFIG_BY_LIBRARY[library];
  if (!configPath)
    throw new Error(`no capture config known for library "${library}"`);
  const cfg = loadConfig(REPO, path.join(REPO, configPath));
  const harnessDir = path.resolve(
    HARNESS ?? path.join(REPO, SANDBOX_BY_LIBRARY[library]),
  );
  const pkgJsonPath = path.join(
    harnessDir,
    "node_modules",
    cfg.library.package,
    "package.json",
  );
  if (!existsSync(pkgJsonPath)) {
    throw new Error(
      `harness ${harnessDir} does not carry ${cfg.library.package} — build the sandbox per examples/${library}/README (npm install), or pass --harness`,
    );
  }
  const installed = readJson<{ version: string }>(pkgJsonPath).version;
  if (installed !== cfg.library.version) {
    throw new Error(
      `harness has ${cfg.library.package}@${installed}, config pins ${cfg.library.version} — refusing (version drift would silently change every reference)`,
    );
  }
  const harness: RefRenderReceipt["harness"] = {
    package: cfg.library.package,
    version: cfg.library.version,
    recipe: `examples/${library} sandbox (${path.basename(SANDBOX_BY_LIBRARY[library])}; examples/${library}/README) mounted per ${configPath}`,
  };
  const renderer =
    "REAL LIBRARY render — the library's own npm package in its documented sandbox, mounted per the capture config, captured by extract/figma/canvas-gate/shots.ts captureCell (600×800, dpr 2, light); portal cells captured as stage+portal union";

  const plans = planRows(rows, cfg);
  const portalByName = new Set(
    cfg.components.filter((c) => c.portalCapture).map((c) => c.name),
  );

  // Assemble cells.
  const mainCells: RefCell[] = [];
  const portalCells: RefCell[] = [];
  const cellRefs = new Map<string, { plan: RowPlan; refs: RefReceiptRow[] }>();
  for (const plan of plans) {
    const refs: RefReceiptRow[] = [];
    cellRefs.set(plan.row.row.id, { plan, refs });
    const renderedVariants = (plan.code.variants ?? []).filter(
      (v) => v.status === "rendered",
    );
    if (!plan.comp) {
      for (const v of renderedVariants)
        refs.push({
          slug: v.slug,
          status: "unmappable",
          reason: `UNMAPPABLE (${plan.compReason})`,
        });
      continue;
    }
    for (const v of renderedVariants) {
      const key = `${plan.row.row.id}__${v.slug}`;
      const props = mapCellProps(plan.comp, v);
      const portal = portalByName.has(plan.comp.name);
      const cell: RefCell = {
        key,
        rowId: plan.row.row.id,
        slug: v.slug,
        component: plan.comp.importName,
        props: portal ? { ...props, ...(plan.comp.openDriver ?? {}) } : props,
        interaction: v.interaction,
        portal,
        childWrap: plan.comp.childWrap?.importName,
        childrenSpec: plan.comp.childrenSpec,
        text: plan.comp.sampleText,
        blockStage: plan.comp.blockStage,
        stageWidth: (plan.comp.stage ?? cfg.stage).width,
      };
      (portal ? portalCells : mainCells).push(cell);
    }
  }

  const pageErrors: string[] = [];
  /** A hugging stage collapses width-filling components (Polaris ProgressBar
   *  is width:100% of its container — the capture harness gave it a fixed
   *  320px stage). A cell whose painted box comes back < 8 CSS px wide is
   *  queued for a BLOCK-stage retry at the config's stage width; a cell that
   *  still paints nothing there is named UNMAPPABLE, never written blank. */
  const shootPage = async (
    page: Page,
    cells: RefCell[],
    retryQueue: RefCell[] | null,
  ): Promise<void> => {
    for (const cell of cells) {
      const entry = cellRefs.get(cell.rowId)!;
      const dir = entry.plan.receiptDir;
      const png = `ref-${cell.slug}.png`;
      try {
        const errAttr = (await page.evaluate(
          `(() => { const s = document.querySelector('[data-cell=${JSON.stringify(cell.key)}] [data-ref-error]'); return s ? s.getAttribute('data-ref-error') : null; })()`,
        )) as string | null;
        if (errAttr) throw new Error(`component threw at mount — ${errAttr}`);
        if (cell.portal) {
          const buf = await capturePortalCell(page, cell.key);
          writeFileSync(path.join(dir, png), buf);
          entry.refs.push({
            slug: cell.slug,
            status: "rendered",
            png,
            props: jsonSafe(cell.props) as Record<string, unknown>,
            capture: "portal",
          });
        } else {
          const shot = await captureCell(page, cell.key, cell.interaction);
          if (shot.contentBox.width < 8 && retryQueue && !cell.blockStage) {
            retryQueue.push({ ...cell, blockStage: true });
            continue;
          }
          if (shot.contentBox.width < 8 && !retryQueue) {
            throw new Error(
              `painted box collapsed to ${shot.contentBox.width}×${shot.contentBox.height} even in a ${cell.stageWidth}px block stage`,
            );
          }
          writeFileSync(path.join(dir, png), shot.png);
          entry.refs.push({
            slug: cell.slug,
            status: "rendered",
            png,
            props: jsonSafe(cell.props) as Record<string, unknown>,
            capture: "cell",
          });
        }
      } catch (e) {
        entry.refs.push({
          slug: cell.slug,
          status: "unmappable",
          reason: `UNMAPPABLE (real-library mount failed: ${(e as Error).message.split("\n")[0]})`,
        });
      }
    }
  };

  const runPage = async (
    cells: RefCell[],
    retryQueue: RefCell[] | null,
  ): Promise<void> => {
    const html = bundleForeignPage(harnessDir, cfg, cells, "census-ref-page");
    const { context, page } = await newGatePage(browser);
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    try {
      await page.goto(`file://${html}`);
      await page.evaluate(
        "Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))])",
      );
      await page.waitForTimeout(250);
      await shootPage(page, cells, retryQueue);
    } finally {
      await context.close();
    }
  };
  if (mainCells.length > 0) {
    const retryQueue: RefCell[] = [];
    await runPage(mainCells, retryQueue);
    if (retryQueue.length > 0) await runPage(retryQueue, null);
  }
  // Portal cells: one page each — overlays cannot share a document.
  for (const cell of portalCells) await runPage([cell], null);
  if (pageErrors.length > 0)
    console.error(
      `${library}: ${pageErrors.length} page error(s) — first: ${pageErrors[0]}`,
    );

  const receipts: RefRenderReceipt[] = [];
  for (const { plan, refs } of cellRefs.values()) {
    refs.sort(
      (a, b) =>
        plan.code.variants.findIndex((v) => v.slug === a.slug) -
        plan.code.variants.findIndex((v) => v.slug === b.slug),
    );
    receipts.push(writeReceipt(plan, refs, harness, configPath, renderer));
  }
  return receipts;
}

// ---------------------------------------------------------------------------
// First-party — the generated React catalog through its own stories
// ---------------------------------------------------------------------------

async function renderFirstParty(
  browser: Browser,
  rows: CorpusRow[],
): Promise<RefRenderReceipt[]> {
  const plans = planRows(rows, null);
  const harness: RefRenderReceipt["harness"] = {
    package: "src/components (generated catalog — npm run generate)",
    version: "committed tree",
    recipe:
      "the repo's own generated React components ARE the real first-party implementation; mounted through each component's generated Storybook meta (canonical args/render), esbuild-bundled with src/components/tokens.css",
  };
  const renderer =
    "REAL IMPLEMENTATION render — generated React catalog (src/components) via its Storybook meta, captured by extract/figma/canvas-gate/shots.ts captureCell (600×800, dpr 2, light)";

  const work = path.join(REPO, "extract", "figma", "census", ".ref-fp-work");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  interface FpCell {
    key: string;
    rowId: string;
    slug: string;
    name: string;
    overrides: Record<string, unknown>;
    interaction: Interaction;
    /** Fixed-width block stage (retry for width-filling components). */
    block?: boolean;
  }
  const cells: FpCell[] = [];
  const cellRefs = new Map<string, { plan: RowPlan; refs: RefReceiptRow[] }>();
  const names = new Set<string>();
  for (const plan of plans) {
    const refs: RefReceiptRow[] = [];
    cellRefs.set(plan.row.row.id, { plan, refs });
    const name = plan.row.row.name;
    const stories = path.join(REPO, "src", "components", name, `${name}.stories.tsx`);
    const renderedVariants = (plan.code.variants ?? []).filter(
      (v) => v.status === "rendered",
    );
    if (!existsSync(stories)) {
      for (const v of renderedVariants)
        refs.push({
          slug: v.slug,
          status: "unmappable",
          reason: `UNMAPPABLE (no generated component/stories at src/components/${name})`,
        });
      continue;
    }
    names.add(name);
    for (const v of renderedVariants) {
      const overrides: Record<string, unknown> = { ...v.subst };
      for (const [k, b] of Object.entries(v.bools)) overrides[k] = b;
      cells.push({
        key: `${plan.row.row.id}__${v.slug}`,
        rowId: plan.row.row.id,
        slug: v.slug,
        name,
        overrides,
        interaction: v.interaction,
      });
    }
  }

  const imports = [...names]
    .sort()
    .map(
      (n) =>
        `import * as S_${n} from ${JSON.stringify(
          path.join(REPO, "src", "components", n, `${n}.stories.tsx`),
        )};`,
    );
  const buildFpEntry = (pageCells: FpCell[]): string => `import React from 'react';
import { createRoot } from 'react-dom/client';
${imports.join("\n")}

const METAS = { ${[...names]
    .sort()
    .map((n) => `${JSON.stringify(n)}: S_${n}.default`)
    .join(", ")} };
const CELLS = ${JSON.stringify(
    pageCells.map(({ key, name, overrides, block }) => ({
      key,
      name,
      overrides,
      block: block === true,
    })),
  )};

class CellBoundary extends React.Component {
  constructor(p) { super(p); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: String((e && e.message) || e) }; }
  render() {
    if (this.state.error) return React.createElement('div', { 'data-ref-error': this.state.error });
    return this.props.children;
  }
}
function Cell({ c }) {
  const meta = METAS[c.name];
  const args = { ...(meta.args || {}), ...c.overrides };
  if (typeof meta.render === 'function') return meta.render(args);
  const { children, ...rest } = args;
  return React.createElement(meta.component, rest, children);
}
createRoot(document.getElementById('root')).render(
  <>
    {CELLS.map((c) => (
      <React.Fragment key={c.key}>
        <button data-sentinel={c.key} aria-label="sentinel" style={{ width: 8, height: 8, padding: 0, border: 0, margin: '0 0 28px 0', background: '#eee', display: 'block' }} />
        <div data-cell={c.key} style={c.block ? { display: 'block', width: 320, margin: '0 0 64px 0' } : { display: 'flex', alignItems: 'flex-start', width: 'max-content', margin: '0 0 64px 0' }}>
          <div style={c.block ? { display: 'block', width: '100%' } : { display: 'inline-flex', alignItems: 'flex-start' }}>
            <CellBoundary><Cell c={c} /></CellBoundary>
          </div>
        </div>
      </React.Fragment>
    ))}
  </>,
);
`;
  const pageErrors: string[] = [];
  const runFpPage = async (
    pageCells: FpCell[],
    retryQueue: FpCell[] | null,
  ): Promise<void> => {
    writeFileSync(path.join(work, "entry.jsx"), buildFpEntry(pageCells));
    await build({
      entryPoints: [path.join(work, "entry.jsx")],
      bundle: true,
      outfile: path.join(work, "bundle.js"),
      jsx: "automatic",
      loader: { ".module.css": "local-css", ".css": "css", ".svg": "dataurl" },
      absWorkingDir: REPO,
      nodePaths: [path.join(REPO, "node_modules")],
      logLevel: "silent",
    });
    const bundleCssPath = path.join(work, "bundle.css");
    const bundleCss = existsSync(bundleCssPath)
      ? readFileSync(bundleCssPath, "utf8")
      : "";
    writeFileSync(
      path.join(work, "index.html"),
      `<!doctype html><html><head><meta charset="utf-8">${bundleCss ? `<style>${bundleCss}</style>` : ""}
<style>html { color-scheme: light; } body { margin: 0; padding: 24px; background: #ffffff; font-family: Inter, system-ui, sans-serif; }
*, *::before, *::after { transition: none !important; }</style>
</head><body><div id="root"></div>
<script>document.addEventListener('click', (e) => e.preventDefault(), true);</script>
<script src="bundle.js"></script></body></html>`,
    );
    const { context, page } = await newGatePage(browser);
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    try {
      await page.goto(`file://${path.join(work, "index.html")}`);
      await page.evaluate(
        "Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))])",
      );
      await page.waitForTimeout(250);
      for (const cell of pageCells) {
        const entryRef = cellRefs.get(cell.rowId)!;
        const dir = entryRef.plan.receiptDir;
        const png = `ref-${cell.slug}.png`;
        try {
          const errAttr = (await page.evaluate(
            `(() => { const s = document.querySelector('[data-cell=${JSON.stringify(cell.key)}] [data-ref-error]'); return s ? s.getAttribute('data-ref-error') : null; })()`,
          )) as string | null;
          if (errAttr) throw new Error(`component threw at mount — ${errAttr}`);
          const shot = await captureCell(page, cell.key, cell.interaction);
          // Width-filling components collapse in the hugging stage — retry
          // once in a fixed 320px block stage; a still-empty paint is named.
          if (shot.contentBox.width < 8 && retryQueue && !cell.block) {
            retryQueue.push({ ...cell, block: true });
            continue;
          }
          if (shot.contentBox.width < 8 && !retryQueue) {
            throw new Error(
              `painted box collapsed to ${shot.contentBox.width}×${shot.contentBox.height} even in a 320px block stage`,
            );
          }
          writeFileSync(path.join(dir, png), shot.png);
          entryRef.refs.push({
            slug: cell.slug,
            status: "rendered",
            png,
            props: jsonSafe(cell.overrides) as Record<string, unknown>,
            capture: "cell",
          });
        } catch (e) {
          entryRef.refs.push({
            slug: cell.slug,
            status: "unmappable",
            reason: `UNMAPPABLE (generated catalog mount failed: ${(e as Error).message.split("\n")[0]})`,
          });
        }
      }
    } finally {
      await context.close();
    }
  };
  if (cells.length > 0) {
    const retryQueue: FpCell[] = [];
    await runFpPage(cells, retryQueue);
    if (retryQueue.length > 0) await runFpPage(retryQueue, null);
  }
  if (pageErrors.length > 0)
    console.error(
      `first-party: ${pageErrors.length} page error(s) — first: ${pageErrors[0]}`,
    );
  rmSync(work, { recursive: true, force: true });

  const receipts: RefRenderReceipt[] = [];
  for (const { plan, refs } of cellRefs.values()) {
    refs.sort(
      (a, b) =>
        plan.code.variants.findIndex((v) => v.slug === a.slug) -
        plan.code.variants.findIndex((v) => v.slug === b.slug),
    );
    receipts.push(writeReceipt(plan, refs, harness, null, renderer));
  }
  return receipts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { corpus } = enumerateCorpus();
  const rows = corpus.filter(
    (r) =>
      (!ONLY_LIBRARY || r.library.library === ONLY_LIBRARY) &&
      (!ONLY_ID || r.row.id === ONLY_ID),
  );
  if (rows.length === 0)
    throw new Error(
      `census ref-render: no manifest row matches --library ${ONLY_LIBRARY ?? "*"} --id ${ONLY_ID ?? "*"}`,
    );
  const byLibrary = new Map<string, CorpusRow[]>();
  for (const r of rows)
    (
      byLibrary.get(r.library.library) ??
      byLibrary.set(r.library.library, []).get(r.library.library)!
    ).push(r);
  const browser = await launchGateBrowser();
  let rendered = 0;
  let unmappable = 0;
  try {
    for (const [library, libRows] of byLibrary) {
      const receipts =
        library === "first-party"
          ? await renderFirstParty(browser, libRows)
          : await renderForeignLibrary(browser, libRows, library);
      for (const r of receipts) {
        rendered += r.rendered;
        unmappable += r.unmappable;
        console.log(
          `${r.unmappable === 0 ? "✔" : "◐"} ${r.library}/${r.id} — ${r.rendered}/${r.refs.length} ref(s) rendered` +
            (r.unmappable > 0
              ? ` — ${r.unmappable} UNMAPPABLE: ${r.refs
                  .filter((x) => x.status === "unmappable")
                  .map((x) => `${x.slug} ${x.reason}`)
                  .join("; ")}`
              : ""),
        );
      }
    }
  } finally {
    await browser.close();
  }
  console.log(
    `\ncensus ref-render: ${rows.length} set(s), ${rendered} reference(s) rendered, ${unmappable} UNMAPPABLE (named)`,
  );
}

await main();
