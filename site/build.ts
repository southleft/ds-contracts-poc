/**
 * Spec-site build — `npm run site:build` → site/dist/.
 *
 * Zero-dependency-beyond-the-repo static generation: TypeScript pages run
 * under tsx (the repo's existing runner), the schema reference is rendered
 * from scripts/contract-schema.ts by introspection, and the build FAILS on
 * schema-coverage drift (see site/src/coverage.ts).
 *
 * Order matters: the coverage guard runs before any page is written — an
 * undocumented schema branch refuses the whole build, by name.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { checkCoverage } from './src/coverage.js';
import { computeStats } from './src/stats.js';
import { buildSpecPages } from './src/pages/spec.js';
import { homePage } from './src/pages/home.js';
import { buildHowPages } from './src/pages/how.js';
import { getStartedPage } from './src/pages/get-started.js';
import { contributePage } from './src/pages/contribute.js';
import { layout } from './src/html.js';
import { loadHowReplays } from './src/how-replays.js';
import {
  dependencyGraphSvg,
  instrumentsSvg,
  propLifecycleSvg,
  receiptsFlowSvg,
  sessionLinkingSvg,
  type Theme,
} from './src/diagrams.js';

const ROOT = process.cwd();
const SITE = path.join(ROOT, 'site');
const DIST = path.join(SITE, 'dist');

// ---------------------------------------------------------------- guard ----
const receipt = checkCoverage();
if (receipt.missing.length > 0 || receipt.stale.length > 0) {
  console.error('✖ schema-coverage drift guard FAILED — the site refuses to build:');
  for (const m of receipt.missing) {
    console.error(`   MISSING  ${m} — the schema has this branch; no reference page documents it`);
  }
  for (const s of receipt.stale) {
    console.error(`   STALE    ${s} — the reference documents this branch; the schema no longer has it`);
  }
  console.error('  Fix: map the branch in site/src/coverage.ts and document it on its page.');
  process.exit(1);
}
console.log(
  `✔ schema-coverage: ${receipt.documented}/${receipt.schemaBranches} branches documented, 0 missing, 0 stale`,
);

// ---------------------------------------------------------------- pages ----
const stats = await computeStats();

// Engine replays for the How-it-works question pages: real emitters, the
// real parity differ (in a throwaway scratch), and the committed captures.
const replays = await loadHowReplays();

const pages: Array<{ route: string; html: string }> = [
  homePage(stats, receipt),
  ...(await buildSpecPages(receipt)),
  ...buildHowPages(stats, replays),
  getStartedPage(),
  contributePage(),
];

// 404 — served by Cloudflare Pages for unknown routes.
const notFound = layout(
  { path: '/404/', title: 'Not found — Design System Contracts', description: 'Page not found.' },
  `<p class="eyebrow">404</p><h1>No contract at this path</h1><p class="lede">The page you asked for doesn't exist — a gap is reported, never papered over.</p><div class="doors"><a class="door door--primary" href="/">Home</a><a class="door" href="/spec/">The Spec</a></div>`,
);

// ---------------------------------------------------------------- write ----
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

for (const page of pages) {
  const dir = path.join(DIST, page.route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), page.html);
}
writeFileSync(path.join(DIST, '404.html'), notFound);

cpSync(path.join(SITE, 'src/styles.css'), path.join(DIST, 'styles.css'));
mkdirSync(path.join(DIST, 'assets'), { recursive: true });
for (const asset of ['logo-light.svg', 'logo-dark.svg']) {
  cpSync(path.join(ROOT, 'docs/assets', asset), path.join(DIST, 'assets', asset));
}
// The contract-flow pair declares font-family:inherit, which an SVG inside
// an <img> cannot honor (it falls back to the browser serif). Patch the
// COPIES at build with the site's font stack — the source assets in
// docs/assets/ (used by the README) stay untouched.
for (const asset of ['contract-flow-light.svg', 'contract-flow-dark.svg']) {
  const svg = readFileSync(path.join(ROOT, 'docs/assets', asset), 'utf8').replace(
    'font-family:inherit',
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
  );
  writeFileSync(path.join(DIST, 'assets', asset), svg);
}

// Build-time themed diagrams (the contract-flow-*.svg pattern): each is
// emitted light + dark; the dependency graph is COMPUTED from the committed
// whole-kit capture via the replays above.
for (const theme of ['light', 'dark'] as Theme[]) {
  const diagrams: Array<[string, string]> = [
    ['prop-lifecycle', propLifecycleSvg(theme)],
    ['session-linking', sessionLinkingSvg(theme)],
    ['receipts-flow', receiptsFlowSvg(theme)],
    ['instruments', instrumentsSvg(theme)],
    ['dependency-graph', dependencyGraphSvg(theme, replays.scale.graph)],
  ];
  for (const [name, svg] of diagrams) {
    writeFileSync(path.join(DIST, 'assets', `${name}-${theme}.svg`), svg);
  }
}

writeFileSync(path.join(DIST, 'spec-coverage.json'), JSON.stringify(receipt, null, 2) + '\n');

console.log(`✔ ${pages.length + 1} pages → site/dist/ (${pages.map((p) => p.route).join(' ')})`);
