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
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { checkCoverage } from './src/coverage.js';
import { computeStats } from './src/stats.js';
import { buildSpecPages } from './src/pages/spec.js';
import { homePage } from './src/pages/home.js';
import { buildHowPages } from './src/pages/how.js';
import { getStartedPage } from './src/pages/get-started.js';
import { contributePage } from './src/pages/contribute.js';
import { layout } from './src/html.js';

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

const pages: Array<{ route: string; html: string }> = [
  homePage(stats, receipt),
  ...(await buildSpecPages(receipt)),
  ...buildHowPages(stats),
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
for (const asset of [
  'contract-flow-light.svg',
  'contract-flow-dark.svg',
  'logo-light.svg',
  'logo-dark.svg',
]) {
  cpSync(path.join(ROOT, 'docs/assets', asset), path.join(DIST, 'assets', asset));
}

writeFileSync(path.join(DIST, 'spec-coverage.json'), JSON.stringify(receipt, null, 2) + '\n');

console.log(`✔ ${pages.length + 1} pages → site/dist/ (${pages.map((p) => p.route).join(' ')})`);
