/**
 * Receipts for the CSS-VARS READER'S ONE-HOP INDIRECTION —
 * `tsx extract/computed/local-var-hop-check.ts` (eval: `local-var-hop-recovers-token-name`).
 *
 * THE HOLE THIS CLOSES (Fluent 2 recon §5 H3). The reader offers candidates
 * per channel with this rule:
 *
 *     if (name.startsWith(vp)) push(name); else for (const t of defs[name]) push(t);
 *
 * `vp` is `library.varPrefix`. Three libraries in this corpus declare it as
 * the BARE `"--"` — Tailwind, shadcn, and (proposed) Fluent — because their
 * theme names carry no vendor prefix. With `vp === "--"` EVERY custom
 * property starts with the prefix, so the `else` can never run: the one-hop
 * resolution is unreachable BY CONSTRUCTION, and a channel written
 *
 *     --fui-Checkbox__indicator--borderColor: var(--colorCompoundBrandStroke);
 *     border-color: var(--fui-Checkbox__indicator--borderColor);
 *
 * yields only the component-local variable, which names no DTCG leaf and is
 * dropped. The theme token behind it is never a candidate. Measured on
 * Fluent's 12-component slice: 31 rules across 11 local variables, including
 * EVERY one of Checkbox's indicator colours on all four interaction planes.
 * The pixels stay right and the NAME is gone, so the contract mints an
 * anonymous literal where a real token existed — a silent loss, not a refusal.
 *
 * THE SECOND HALF, which the recon did not name: the var-name regex was
 * `--[a-zA-Z0-9-]+`, and a custom-property ident may contain `_`. So
 * `var(--fui-Checkbox__indicator--borderColor)` was read as `--fui-Checkbox`
 * — a property nothing declares, resolving to the empty string, dropped
 * before the hop could be attempted. Fixing the branch without widening the
 * class would have shipped a fix that cannot fire on the case it was written
 * for. Pin 3 below is that half.
 *
 * WHAT MAKES THIS A GATE AND NOT A DEMO: like the read-boundary gate beside
 * it, this evaluates the REAL reader source (the exported `captureJs`) in a
 * real Chromium against a page carrying the real indirection shape. It does
 * not re-implement the branch and assert on the copy.
 *
 * Node shell over the real capture source. Reads the repo; writes nothing.
 */
import { chromium } from 'playwright-core';
import { captureJs } from './capture.js';
import { chromiumExecutable } from '../figma/visual-parity/render.js';

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

/** Fluent's Checkbox indicator, reduced to its mechanism: a theme token, a
 *  component-local variable defined FROM it (underscores and all), and a
 *  channel that reads the local variable. */
const PAGE =
  `<!doctype html><html><head><style>` +
  `:root { --colorCompoundBrandStroke: rgb(15, 108, 189); }` +
  `#stage .ind { --fui-Checkbox__indicator--borderColor: var(--colorCompoundBrandStroke); }` +
  `#stage .ind { display: inline-block; width: 16px; height: 16px;` +
  ` border-bottom-style: solid; border-bottom-width: 2px;` +
  ` border-bottom-color: var(--fui-Checkbox__indicator--borderColor); }` +
  `</style></head><body><div id="stage"><span class="ind"></span></div></body></html>`;

const CHANNEL = 'border-bottom-color';
const THEME = '--colorCompoundBrandStroke';
const LOCAL = '--fui-Checkbox__indicator--borderColor';

type Cand = [string, string, string] | [string, string, string, 1];

const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
const candidatesFor = async (varPrefix: string): Promise<Cand[]> => {
  const page = await browser.newPage();
  await page.route('http://onehop.test/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: PAGE }));
  await page.goto('http://onehop.test/index.html');
  // The same preamble the real sweep runs before the reader (captureJs reads
  // the channel list off `window.__ALL_PROPS`).
  await page.evaluate(
    `(() => { const l = [...getComputedStyle(document.documentElement)].sort(); window.__ALL_PROPS = l; return l; })()`,
  );
  // THE REAL READER, not a paraphrase of it.
  const node = (await page.evaluate(captureJs('#stage', undefined, varPrefix))) as
    | { vrefs?: Record<string, Cand[]> }
    | null;
  await page.close();
  return node?.vrefs?.[CHANNEL] ?? [];
};

console.log(`\nvarPrefix "--" — the bare prefix that made the one-hop branch dead code`);
const bare = await candidatesFor('--');
const bareNames = bare.map((c) => c[0]);
check(
  `the THEME TOKEN behind the component-local variable is a candidate (${THEME})`,
  bareNames.includes(THEME),
);
check(
  'and it carries its real value, so Node-side verification can confirm it',
  bare.some((c) => c[0] === THEME && c[1] === 'rgb(15, 108, 189)'),
);
check(
  `the ident is read WHOLE — \`_\` is a legal custom-property character (${LOCAL}, not a truncation at the underscore)`,
  bareNames.includes(LOCAL),
);
check(
  'the DIRECT name is still offered, and FIRST — a recovered name can only ADD a candidate, never demote the name the library wrote at the point of use',
  bareNames[0] === LOCAL && bare[0].length === 3,
);
check(
  'the hopped candidate is FLAGGED (4th element `1`), so the Node side can prefer a direct name when both verify',
  bare.some((c) => c[0] === THEME && c.length === 4 && c[3] === 1),
);

console.log(`\nControl — varPrefix "--color", an ordinary prefix (the branch that always worked)`);
const prefixed = await candidatesFor('--color');
check(
  'the one-hop resolution still recovers the theme token under a real prefix',
  prefixed.some((c) => c[0] === THEME && c[1] === 'rgb(15, 108, 189)'),
);
check(
  'and the local variable — which does NOT start with that prefix — is still not offered as a direct candidate',
  !prefixed.some((c) => c[0] === LOCAL),
);

await browser.close();

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} one-hop invariant(s) failed`);
  process.exit(1);
}
console.log(
  '\n✔ a bare "--" varPrefix resolves one hop like any other prefix (the theme token name behind a component-local variable is recovered, as an ADDITIONAL flagged candidate — never in place of the direct name)',
);
