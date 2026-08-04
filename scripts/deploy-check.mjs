/**
 * DEPLOY FRESHNESS CHECK — `npm run deploy:check`.
 *
 * WHY THIS EXISTS. On 2026-08-03 the live playground was serving a plugin zip
 * built in mid-July: six tabs that had been DELETED on 2026-07-26 (Generate /
 * Update library / Propose / Send to Playground / …), an engine ~11 dump
 * revisions behind (v1.2 vs v1.13), and a spec site missing the plugin-install
 * story entirely. Every BUILD-time drift guard in this repo was green the whole
 * time — build-plugin-zip refuses a stale engine, plugin-ui-check sweeps the
 * built UI — because the failure was one step later: the builds were fresh and
 * the DEPLOY step had no gate at all. Both Pages projects are direct-upload
 * (no git integration), so nothing deploys unless a human runs it, and nothing
 * noticed when no human did.
 *
 * WHAT IT CHECKS — local build artifacts vs the live Cloudflare Pages bytes:
 *   1. the plugin zip   playground/dist/ds-contracts-sync-runner-plugin.zip
 *                       vs  https://ds-contracts-playground.pages.dev/ds-contracts-sync-runner-plugin.zip
 *                       (deterministic bytes by construction — build-plugin-zip
 *                       pins the zip timestamp — so sha256 equality is exact)
 *   2. the playground   the hashed asset filenames referenced by dist/index.html
 *                       vs the ones the live index.html references (vite content-
 *                       hashes every chunk, so a single changed byte renames it)
 *   3. the spec site    sha256 of site/dist/get-started/index.html vs the live
 *                       page (the site build is deterministic over repo state)
 *
 * REFUSES BY NAME when a local artifact is missing — a check that silently
 * passes because there was nothing to compare is the `skips: []` defect this
 * repo keeps finding. Build first:
 *   npm run plugin:zip && npm run build:playground && npm run site:build
 *
 * This check needs NO credentials (public URLs + local files). `npm run deploy`
 * runs it automatically after publishing — deploying and verifying are one
 * verb, so the gate cannot be skipped by forgetting it.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PLAYGROUND = 'https://ds-contracts-playground.pages.dev';
const SPEC = 'https://ds-contracts-spec.pages.dev';

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

async function fetchBytes(url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow', cache: 'no-store' });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((res) => setTimeout(res, 5000 * (i + 1)));
  }
  throw new Error(`${url}: ${lastErr}`);
}

/** vite content-hashes every chunk, so the asset filenames ARE the version. */
const assetRefs = (html) => [...html.matchAll(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g)].map((m) => m[0]).sort();

/** Cloudflare Pages serves the previous deployment for a short window after
 *  the upload returns. The first cut retried only HTTP FAILURES, not STALE
 *  CONTENT — so `npm run deploy` reported red on a perfectly good deploy twice
 *  (2026-08-03), and a human re-running the check 60-90s later saw green. A
 *  gate that cries wolf on success is a gate people learn to ignore. Each
 *  surface now re-fetches until it matches or the window closes; only then is
 *  it a finding. Verified against a real deploy: the spec site converged on a
 *  later attempt and the run went green without human intervention. */
const PROPAGATION_MS = 240_000;
const POLL_MS = 15_000;
async function settle(label, fetchOnce) {
  const deadline = Date.now() + PROPAGATION_MS;
  let last = await fetchOnce();
  let waited = 0;
  while (!last.ok && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    waited += POLL_MS;
    process.stdout.write(`    … ${label}: still serving the previous deployment, re-checking (${Math.round(waited / 1000)}s)\n`);
    last = await fetchOnce();
  }
  if (last.ok && waited > 0) console.log(`    (${label} converged after ${Math.round(waited / 1000)}s of CDN propagation)`);
  return last;
}

const findings = [];
const ok = [];

// --- local artifacts must exist: absence is a refusal, never a pass ---------
const zipLocal = path.join(ROOT, 'playground', 'dist', 'ds-contracts-sync-runner-plugin.zip');
const idxLocal = path.join(ROOT, 'playground', 'dist', 'index.html');
const siteLocal = path.join(ROOT, 'site', 'dist', 'get-started', 'index.html');
const missing = [zipLocal, idxLocal, siteLocal].filter((p) => !existsSync(p));
if (missing.length > 0) {
  console.error(
    `REFUSED: local build artifact(s) missing — nothing honest to compare against:\n` +
      missing.map((m) => `  - ${path.relative(ROOT, m)}`).join('\n') +
      `\nBuild first: npm run plugin:zip && npm run build:playground && npm run site:build`,
  );
  process.exit(1);
}

// --- 1. plugin zip: exact byte identity -------------------------------------
{
  const local = readFileSync(zipLocal);
  const r = await settle('plugin zip', async () => {
    const live = await fetchBytes(`${PLAYGROUND}/ds-contracts-sync-runner-plugin.zip`);
    return { ok: sha(local) === sha(live), live };
  });
  const live = r.live;
  if (r.ok) ok.push(`plugin zip: live == local build (${local.length} bytes, sha ${sha(local).slice(0, 12)}…)`);
  else
    findings.push(
      `plugin zip STALE: live is ${live.length} bytes (sha ${sha(live).slice(0, 12)}…), local build is ${local.length} bytes (sha ${sha(local).slice(0, 12)}…) — a designer downloading today gets a different engine than this repo builds`,
    );
}

// --- 2. playground: hashed asset references ---------------------------------
{
  const local = assetRefs(readFileSync(idxLocal, 'utf8'));
  const r = await settle('playground', async () => {
    const live = assetRefs((await fetchBytes(`${PLAYGROUND}/`)).toString('utf8'));
    return { ok: JSON.stringify(local) === JSON.stringify(live), live };
  });
  const live = r.live;
  if (r.ok) ok.push(`playground: live index references the same ${local.length} content-hashed asset(s)`);
  else
    findings.push(
      `playground STALE: live index references [${live.join(', ')}], local build references [${local.join(', ')}] — vite renames every chunk on any content change, so these are different builds`,
    );
}

// --- 3. spec site: byte identity of a representative page -------------------
{
  const local = readFileSync(siteLocal);
  const r = await settle('spec site', async () => {
    const live = await fetchBytes(`${SPEC}/get-started/`);
    return { ok: sha(local) === sha(live), live };
  });
  const live = r.live;
  if (r.ok) ok.push(`spec site: /get-started/ live == local build (${local.length} bytes)`);
  else
    findings.push(
      `spec site STALE: /get-started/ live is ${live.length} bytes (sha ${sha(live).slice(0, 12)}…), local build is ${local.length} bytes (sha ${sha(local).slice(0, 12)}…)`,
    );
}

for (const line of ok) console.log(`  ✔ ${line}`);
if (findings.length > 0) {
  console.error(`\n✘ ${findings.length} deployed surface(s) DIVERGE from the local build:\n${findings.map((f) => `  - ${f}`).join('\n')}`);
  console.error(`\nRedeploy with: npm run deploy   (builds, publishes both Pages projects, then re-runs this check)`);
  process.exit(1);
}
console.log('\n✔ all three deployed surfaces serve exactly what this repo builds.');
