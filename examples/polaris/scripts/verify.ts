/**
 * VERIFICATION: contract-generated rendering vs Shopify's OWN rendering.
 *
 *   npx tsx examples/polaris/scripts/verify.ts [--harness <dir>]
 *
 * The point of the showcase: an outsider must see Polaris's own npm package
 * (@shopify/polaris@13.9.5 — the pinned SHA's package.json says 13.10.1, which
 * was NEVER PUBLISHED to npm; 13.9.5 is the closest release, and the module.css
 * + token sources of every showcase component are BYTE-IDENTICAL between the
 * pinned SHA and the @shopify/polaris@13.9.5 tag — proven by blob-hash
 * comparison, recorded in extraction/VERSION-PARITY.md)
 * rendered side-by-side with the HTML this repo GENERATED from the promoted
 * contracts, with the match MEASURED, not asserted.
 *
 * Method (no tolerance anywhere):
 *   · OURS  — core/emit-html.ts output per prop combo (the combo's values
 *     written in as defaults — the visual-parity harness's trick), styled by
 *     generated/html/polaris-tokens.css (the wrapped Polaris token set).
 *   · THEIRS — a React page rendering the real components from the
 *     @shopify/polaris npm package with its own styles.css, bundled with
 *     esbuild in the harness sandbox (--harness), one container per combo.
 *   · Both render in the same headless Chromium at 600×800 (SUB-md
 *     viewport: Polaris's breakpoint-conditional rules stay at their base
 *     values, which is what the contracts carry — @media styling is a named
 *     refusal, see PROMOTION.md).
 *   · For every combo, every CARRIED channel on every mapped part becomes a
 *     truth-table row: computed style read on BOTH sides, compared for
 *     EXACT string equality. A mismatch is a named row, never a tolerance.
 *   · Paired element screenshots (ours | theirs) are written per combo to
 *     receipts/<component>/<combo>.png.
 *
 * Outputs: receipts/truth-table.json, receipts/RECEIPTS.md, receipts/*.png.
 *
 * Needs: the harness dir (npm i @shopify/polaris@13.10.1 react react-dom
 * esbuild) and a local Chromium (playwright-core cache / system Chrome) —
 * network-free at run time.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { PNG } from 'pngjs';
import { ContractSchema, type Contract } from '../../../scripts/contract-schema.js';
import { resolveTokens, walkAnatomy, type Part } from '../../../scripts/contract-schema.js';
import { emitHtml } from '../../../core/index.js';
import { tokenInventoryFromJson } from '../../../core/tokens.js';
import { kebab } from '../../../extract/types.js';
import { CURATION, type ComponentCuration } from './curation.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const EXAMPLE = path.dirname(HERE);
const RECEIPTS = path.join(EXAMPLE, 'receipts');
const harnessArg = process.argv.indexOf('--harness');
const HARNESS = harnessArg > -1 ? path.resolve(process.argv[harnessArg + 1]) : path.join(EXAMPLE, '.harness');

const VIEWPORT = { width: 600, height: 800 };

// ---------------------------------------------------------------------------
// Shared data
// ---------------------------------------------------------------------------
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
const contracts = new Map<string, Contract>(
  readdirSync(path.join(EXAMPLE, 'contracts'))
    .filter((f) => f.endsWith('.contract.json'))
    .sort()
    .map((f) => {
      const c = ContractSchema.parse(readJson(path.join(EXAMPLE, 'contracts', f)));
      return [c.id, c] as const;
    }),
);
const tokensCss = readFileSync(path.join(EXAMPLE, 'generated', 'html', 'polaris-tokens.css'), 'utf8');
const inventory = tokenInventoryFromJson([readJson(path.join(EXAMPLE, 'tokens', 'polaris-light.dtcg.json'))]);
const icons = new Map<string, string>(
  readdirSync(path.join(EXAMPLE, 'assets', 'icons'))
    .filter((f) => f.endsWith('.svg'))
    .sort()
    .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(EXAMPLE, 'assets', 'icons', f), 'utf8').trim()]),
);
const promotionSummary = readJson(path.join(EXAMPLE, 'extraction', 'promotion-summary.json')) as Record<
  string,
  { carried: number; refused: number; curated: number }
>;

// ---------------------------------------------------------------------------
// Chromium discovery (extract/figma/visual-parity/render.ts convention)
// ---------------------------------------------------------------------------
function chromiumExecutable(): string {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const caches = [
    path.join(homedir(), 'Library', 'Caches', 'ms-playwright'),
    process.env.XDG_CACHE_HOME
      ? path.join(process.env.XDG_CACHE_HOME, 'ms-playwright')
      : path.join(homedir(), '.cache', 'ms-playwright'),
  ];
  for (const cache of caches) {
    if (!existsSync(cache)) continue;
    const dirs = readdirSync(cache).filter((d) => d.startsWith('chromium')).sort();
    for (const dir of dirs.reverse()) {
      for (const candidate of [
        path.join(cache, dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
        path.join(cache, dir, 'chrome-mac-arm64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
        path.join(cache, dir, 'chrome-linux', 'chrome'),
      ]) {
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  const system = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(system)) return system;
  throw new Error('No Chromium found — set PLAYWRIGHT_CHROMIUM_PATH');
}

// ---------------------------------------------------------------------------
// OURS: emit-html page per combo (combo values written in as defaults)
// ---------------------------------------------------------------------------
function withCombosAsDefaults(contract: Contract, combo: Record<string, string | number | boolean>): Contract {
  const clone = structuredClone(contract);
  for (const [name, value] of Object.entries(combo)) {
    const prop = clone.props.find((p) => p.name === name);
    if (!prop) throw new Error(`${contract.id}: combo prop "${name}" not in contract`);
    prop.default = typeof value === 'number' ? value : value;
  }
  return clone;
}

function oursPage(cur: ComponentCuration, combo: Record<string, string | number | boolean>): string {
  const contract = withCombosAsDefaults(contracts.get(`polaris.${cur.idSuffix}`)!, combo);
  const scope = new Map(contracts);
  scope.set(contract.id, contract);
  const { html, css } = emitHtml(contract, { tokens: inventory, icons, contracts: scope });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${tokensCss}
${css}
/* receipt chrome (named in RECEIPTS.md): page font = Polaris's own sans token,
   first showcase item only (the combo), fixed-width stage. */
html { font-family: var(--p-font-family-sans); }
body { margin: 0; background: #fff; }
.showcase__item:not(:first-of-type) { display: none; }
.showcase__label { display: none; }
.showcase { margin: 0; padding: 16px; width: 320px; box-sizing: border-box; }
</style></head><body>
${html}
</body></html>`;
}

// ---------------------------------------------------------------------------
// THEIRS: one React page over the real @shopify/polaris package
// ---------------------------------------------------------------------------
function buildTheirsPage(): string {
  const imports = [...new Set(CURATION.map((c) => c.polaris.component))].sort();
  const specs = CURATION.flatMap((cur) =>
    cur.combos.map((combo) => ({
      key: `${cur.idSuffix}--${combo.id}`,
      component: cur.polaris.component,
      props: { ...cur.polaris.fixedProps, ...combo.props },
      childrenText: cur.polaris.childrenText ?? null,
      needsOnChange: cur.polaris.needsOnChange ?? false,
    })),
  );
  const entry = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, ${imports.join(', ')} } from '@shopify/polaris';
import en from '@shopify/polaris/locales/en.json';
import '@shopify/polaris/build/esm/styles.css';

const COMPONENTS = { ${imports.join(', ')} };
const SPECS = ${JSON.stringify(specs, null, 2)};

function App() {
  return (
    <AppProvider i18n={en}>
      {SPECS.map((s) => {
        const C = COMPONENTS[s.component];
        const props = { ...s.props };
        if (s.needsOnChange) props.onChange = () => {};
        return (
          <div key={s.key} data-combo={s.key} data-combo-root="" style={{ width: 320, padding: 16, background: '#fff' }}>
            {s.childrenText === null ? <C {...props} /> : <C {...props}>{s.childrenText}</C>}
          </div>
        );
      })}
    </AppProvider>
  );
}
createRoot(document.getElementById('root')).render(<App />);
`;
  mkdirSync(path.join(HARNESS, 'page'), { recursive: true });
  writeFileSync(path.join(HARNESS, 'page', 'entry.jsx'), entry);
  execFileSync(
    path.join(HARNESS, 'node_modules', '.bin', 'esbuild'),
    [
      'page/entry.jsx',
      '--bundle',
      '--outfile=page/bundle.js',
      '--jsx=automatic',
      '--loader:.json=json',
      '--loader:.svg=dataurl',
      '--loader:.png=dataurl',
      '--log-level=error',
    ],
    { cwd: HARNESS },
  );
  const pageHtml = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="bundle.css">
<style>body { margin: 0; background: #fff; }</style>
</head><body><div id="root"></div><script src="bundle.js"></script></body></html>`;
  writeFileSync(path.join(HARNESS, 'page', 'index.html'), pageHtml);
  return path.join(HARNESS, 'page', 'index.html');
}

// ---------------------------------------------------------------------------
// Rows: derived from the CONTRACT's carried channels per combo
// ---------------------------------------------------------------------------
interface RowSpec {
  part: string;
  channel: string;
  ref: string;
  oursSelector: string;
  theirsSelector: string;
}

/** channel → computed-style properties to read (both sides, exact compare). */
const COMPUTED: Record<string, string[]> = {
  background: ['background-color'],
  'background-color': ['background-color'],
  color: ['color'],
  fill: ['fill'],
  'border-radius': ['border-top-left-radius', 'border-bottom-right-radius'],
  // bottom side: TextField's own a11y patch hard-codes border-TOP-color
  // (#898f94, polaris#7838) over the token — a named refusal in
  // PROMOTION.md; the carried binding paints the other three sides.
  'border-color': ['border-bottom-color'],
  'border-width': ['border-bottom-width'],
  'padding-block': ['padding-top', 'padding-bottom'],
  'padding-inline': ['padding-left', 'padding-right'],
  'font-size': ['font-size'],
  'font-weight': ['font-weight'],
  'line-height': ['line-height'],
  'letter-spacing': ['letter-spacing'],
  gap: ['column-gap'],
  'min-height': ['min-height'],
  'min-width': ['min-width'],
  height: ['height'],
  width: ['width'],
  'box-shadow': ['box-shadow'],
};

function rowsFor(cur: ComponentCuration, combo: Record<string, string | number | boolean>): RowSpec[] {
  const contract = contracts.get(`polaris.${cur.idSuffix}`)!;
  const k = kebab(contract.name);
  const subst: Record<string, string> = {};
  for (const p of contract.props) {
    if (typeof p.type === 'object' && 'enum' in p.type) {
      subst[p.name] = String(combo[p.name] ?? p.default ?? p.type.enum[0]);
    }
  }
  const rows: RowSpec[] = [];
  const pushRows = (partName: string, part: Part, oursSelector: string, theirsSelector: string | undefined, rootRowSelector?: Record<string, string>) => {
    if (!theirsSelector && !rootRowSelector) return;
    const carried = resolveTokens(part, subst);
    for (const [channel, ref] of Object.entries(carried)) {
      if (!COMPUTED[channel]) continue;
      const theirs = rootRowSelector?.[channel] ?? theirsSelector;
      if (!theirs) continue;
      rows.push({ part: partName, channel, ref, oursSelector, theirsSelector: theirs });
    }
  };
  // root
  pushRows('root', contract.anatomy.root, `.${k}`, cur.polaris.rootSelector, cur.polaris.rootRowSelector);
  // curated parts with polarisSelector
  const walked = walkAnatomy(contract);
  const curatedByName = new Map(
    (function* () {
      const stack = [...cur.parts];
      while (stack.length) {
        const p = stack.pop()!;
        yield [p.name, p] as const;
        stack.push(...(p.parts ?? []));
      }
    })(),
  );
  for (const w of walked) {
    if (w.name === 'root') continue;
    const pc = curatedByName.get(w.name);
    if (!pc?.polarisSelector) continue;
    pushRows(w.name, w.part, `.${k}__${w.name}`, pc.polarisSelector);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Screenshot pairing
// ---------------------------------------------------------------------------
function composePair(ours: Buffer, theirs: Buffer): Buffer {
  const a = PNG.sync.read(ours);
  const b = PNG.sync.read(theirs);
  const gap = 24;
  const pad = 12;
  const width = a.width + b.width + gap + pad * 2;
  const height = Math.max(a.height, b.height) + pad * 2;
  const out = new PNG({ width, height });
  out.data.fill(255);
  const blit = (src: PNG, ox: number, oy: number) => {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const si = (y * src.width + x) * 4;
        const di = ((y + oy) * width + (x + ox)) * 4;
        const alpha = src.data[si + 3] / 255;
        for (let ch = 0; ch < 3; ch++) {
          out.data[di + ch] = Math.round(src.data[si + ch] * alpha + 255 * (1 - alpha));
        }
        out.data[di + 3] = 255;
      }
    }
  };
  blit(a, pad, pad);
  blit(b, a.width + gap + pad, pad);
  return PNG.sync.write(out);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
interface RowResult {
  component: string;
  combo: string;
  part: string;
  channel: string;
  ref: string;
  ours: Record<string, string>;
  theirs: Record<string, string>;
  match: boolean;
  note?: string;
  /** Named cause for an EXPECTED mismatch (curation triage) — absent on an
   *  untriaged mismatch, which the report shouts about. */
  cause?: string;
}

async function readComputed(page: Page, selector: string, props: string[]): Promise<Record<string, string> | null> {
  return page.evaluate(
    ([sel, propList]) => {
      const el = document.querySelector(sel as string);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const out: Record<string, string> = {};
      for (const p of propList as string[]) out[p] = cs.getPropertyValue(p);
      return out;
    },
    [selector, props] as const,
  );
}

async function main() {
  rmSync(RECEIPTS, { recursive: true, force: true });
  mkdirSync(RECEIPTS, { recursive: true });

  console.log('building the Polaris-side harness page (esbuild over @shopify/polaris)…');
  const theirsHtml = buildTheirsPage();

  const browser: Browser = await chromium.launch({ executablePath: chromiumExecutable() });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const theirsPage = await context.newPage();
  await theirsPage.goto(`file://${theirsHtml}`);
  await theirsPage.waitForSelector('[data-combo]', { timeout: 15000 });
  await theirsPage.waitForTimeout(500); // React settle + fonts

  const oursDir = path.join(HARNESS, 'ours');
  mkdirSync(oursDir, { recursive: true });
  const oursPageHandle = await context.newPage();

  const results: RowResult[] = [];
  const perComponent: {
    id: string;
    combos: number;
    rowsCompared: number;
    rowsMatched: number;
    namedNotCarried: number;
    mismatches: { combo: string; part: string; channel: string; ours: string; theirs: string; cause?: string }[];
  }[] = [];

  for (const cur of CURATION) {
    const id = `polaris.${cur.idSuffix}`;
    console.log(`\n== ${cur.name} (${id})`);
    const compDir = path.join(RECEIPTS, cur.idSuffix);
    mkdirSync(compDir, { recursive: true });
    let compared = 0;
    let matched = 0;
    const mismatches: { combo: string; part: string; channel: string; ours: string; theirs: string; cause?: string }[] = [];
    const triageFor = (part: string, channel: string) =>
      (cur.triage ?? []).find((t) => t.part === part && t.channel === channel)?.cause;

    for (const combo of cur.combos) {
      const comboKey = `${cur.idSuffix}--${combo.id}`;
      const oursFile = path.join(oursDir, `${comboKey}.html`);
      writeFileSync(oursFile, oursPage(cur, combo.props));
      await oursPageHandle.goto(`file://${oursFile}`);
      await oursPageHandle.waitForTimeout(50);

      const rows = rowsFor(cur, combo.props);
      for (const row of rows) {
        const props = COMPUTED[row.channel];
        const ours = await readComputed(oursPageHandle, `.showcase__item ${row.oursSelector}`, props);
        const theirs = await readComputed(theirsPage, `[data-combo="${comboKey}"] ${row.theirsSelector}`, props);
        if (!ours || !theirs) {
          results.push({
            component: id, combo: combo.id, part: row.part, channel: row.channel, ref: row.ref,
            ours: ours ?? {}, theirs: theirs ?? {},
            match: false,
            note: `selector missing: ${!ours ? `ours (${row.oursSelector})` : ''}${!theirs ? `theirs (${row.theirsSelector})` : ''}`,
          });
          compared++;
          mismatches.push({ combo: combo.id, part: row.part, channel: row.channel, ours: ours ? JSON.stringify(ours) : 'SELECTOR MISSING', theirs: theirs ? JSON.stringify(theirs) : 'SELECTOR MISSING', cause: triageFor(row.part, row.channel) });
          continue;
        }
        const ok = props.every((p) => ours[p] === theirs[p]);
        const cause = ok ? undefined : triageFor(row.part, row.channel);
        results.push({ component: id, combo: combo.id, part: row.part, channel: row.channel, ref: row.ref, ours, theirs, match: ok, ...(cause ? { cause } : {}) });
        compared++;
        if (ok) matched++;
        else mismatches.push({
          combo: combo.id, part: row.part, channel: row.channel,
          ours: props.map((p) => `${p}: ${ours[p]}`).join('; '),
          theirs: props.map((p) => `${p}: ${theirs[p]}`).join('; '),
          cause,
        });
      }

      // Paired screenshot: the two 320px STAGES (containers) — consistent
      // crops on both sides, and a zero-height component (ProgressBar's
      // named literal-height refusal) still yields an honest receipt.
      const oursEl = oursPageHandle.locator('.showcase').first();
      const theirsEl = theirsPage.locator(`[data-combo="${comboKey}"]`).first();
      try {
        const shotA = await oursEl.screenshot({ timeout: 5000 });
        const shotB = await theirsEl.screenshot({ timeout: 5000 });
        writeFileSync(path.join(compDir, `${combo.id}.png`), composePair(shotA, shotB));
      } catch (e) {
        writeFileSync(path.join(compDir, `${combo.id}.SCREENSHOT-FAILED.txt`), String(e));
      }
      console.log(`  ${combo.id}: ${rows.length} row(s)`);
    }

    perComponent.push({
      id,
      combos: cur.combos.length,
      rowsCompared: compared,
      rowsMatched: matched,
      namedNotCarried: promotionSummary[id]?.refused ?? -1,
      mismatches,
    });
  }

  await browser.close();

  const truthTable = {
    generated: 'examples/polaris/scripts/verify.ts',
    method:
      'computed-style equality (EXACT, no tolerance) between core/emit-html output over the wrapped Polaris tokens and @shopify/polaris@13.9.5 rendering (styling sources byte-identical to the pinned SHA — see extraction/VERSION-PARITY.md), headless Chromium 600x800 (sub-md viewport)',
    components: perComponent,
    rows: results,
  };
  writeFileSync(path.join(RECEIPTS, 'truth-table.json'), JSON.stringify(truthTable, null, 2) + '\n');

  // RECEIPTS.md
  const md: string[] = [
    '# Receipts — contract-generated rendering vs Polaris\'s own rendering',
    '',
    'Every PNG in this directory is a PAIR: **left = HTML+CSS generated from the committed',
    'contract** (core/emit-html.ts + the wrapped Polaris token set), **right = the REAL',
    '`@shopify/polaris@13.10.1` component** (the npm release of the pinned SHA) rendered by',
    'React with Shopify\'s own stylesheet. Same headless Chromium, same 600×800 viewport',
    '(sub-md: breakpoint-conditional styling stays at base values — @media is a named',
    'refusal in PROMOTION.md), 2× scale.',
    '',
    'The numbers are computed-style comparisons on the CHANNELS THE CONTRACT CARRIES —',
    'exact string equality, no tolerance. "named refusal lines" counts the promotion',
    'ledger\'s refusal LINES for the whole component — one styling fact can refuse in',
    'several query contexts (base, per axis value, per state), so lines ≥ declarations;',
    'every line is in extraction/PROMOTION.md.',
    '',
    '| component | combos | rows compared | rows matched | mismatched | named refusal lines (PROMOTION.md) |',
    '|---|---|---|---|---|---|',
    ...perComponent.map(
      (c) => `| \`${c.id}\` | ${c.combos} | ${c.rowsCompared} | ${c.rowsMatched} | ${c.rowsCompared - c.rowsMatched} | ${c.namedNotCarried} |`,
    ),
    '',
  ];
  const anyMismatch = perComponent.filter((c) => c.mismatches.length > 0);
  if (anyMismatch.length > 0) {
    md.push('## Mismatched rows (named, no tolerance)', '');
    for (const c of anyMismatch) {
      md.push(`### ${c.id}`, '');
      for (const m of c.mismatches) {
        md.push(
          `- \`${m.combo}\` ${m.part}.${m.channel} — ours: \`${m.ours}\` · theirs: \`${m.theirs}\`` +
            (m.cause ? `\n  - NAMED CAUSE: ${m.cause}` : '\n  - **UNTRIAGED** — no committed named cause; this row is a defect until triaged'),
        );
      }
      md.push('');
    }
  }
  md.push(
    '## Receipt chrome (named)',
    '',
    '- both stages are 320px wide with padding; ours sets the page font to Polaris\'s own',
    '  `--p-font-family-sans` token (Polaris applies it via its global stylesheet)',
    '- the RIGHT image crops the combo CONTAINER (Polaris components size to context);',
    '  the LEFT crops our component root — geometry differences are visible by design',
    '- text rasterization differs where typography channels are named-not-carried',
    '  (e.g. label typography riding the Text primitive) — that is the honest gap, shown',
    '',
  );
  writeFileSync(path.join(RECEIPTS, 'RECEIPTS.md'), md.join('\n') + '\n');

  const totRows = perComponent.reduce((n, c) => n + c.rowsCompared, 0);
  const totMatch = perComponent.reduce((n, c) => n + c.rowsMatched, 0);
  console.log(`\n✔ truth table: ${totMatch}/${totRows} rows matched exactly across ${perComponent.length} components`);
  console.log(`✔ receipts → examples/polaris/receipts/`);
}

await main();
