/**
 * DEPLOY — `npm run deploy`. Build → publish both Pages projects → VERIFY live.
 *
 * One verb, deliberately: the 2026-08-03 staleness incident (live playground
 * serving a mid-July plugin with six deleted tabs and a v1.2 engine) happened
 * because building and deploying were separate manual steps and only the first
 * had gates. This script folds the freshness check INTO the deploy, so a
 * deploy that did not stick — or only half-stuck — exits red instead of
 * looking done.
 *
 * Steps, each of which refuses loudly rather than continuing degraded:
 *   0. tree must be CLEAN (a deployed artifact should be reproducible from a
 *      commit; override with --allow-dirty for a deliberate preview)
 *   1. npm run plugin:zip        — inherits build-plugin-zip's own gates
 *                                  (engine-receipt freshness, dump-source drift)
 *   2. npm run build:playground  — vite copies the fresh zip from public/
 *   3. npm run site:build
 *   4. wrangler pages deploy playground/dist → ds-contracts-playground
 *   5. wrangler pages deploy site/dist      → ds-contracts-spec
 *   6. scripts/deploy-check.mjs  — live bytes must equal the local build
 *
 * Needs a wrangler login with access to both Pages projects (`npx wrangler
 * whoami` to check). The verify step needs nothing but the public URLs.
 */
import { execSync, spawnSync } from 'node:child_process';

const run = (cmd, label) => {
  console.log(`\n── ${label}\n   $ ${cmd}`);
  const r = spawnSync(cmd, { shell: true, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\n✘ deploy ABORTED at: ${label} (exit ${r.status}) — nothing after this step ran; the live surfaces are in whatever state the previous successful deploy left them.`);
    process.exit(r.status ?? 1);
  }
};

// 0. reproducibility guard
const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (dirty && !process.argv.includes('--allow-dirty')) {
  console.error(
    `REFUSED: working tree is dirty — a deployed artifact should be reproducible from a commit.\n${dirty
      .split('\n')
      .slice(0, 10)
      .map((l) => `  ${l}`)
      .join('\n')}\nCommit first, or pass --allow-dirty for a deliberate preview deploy.`,
  );
  process.exit(1);
}
console.log(`deploying from ${execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()}${dirty ? ' (+ DIRTY tree, --allow-dirty)' : ''}`);

run('npm run plugin:zip', '1/6 build the plugin zip (engine-receipt + dump-source gates run here)');
run('npm run build:playground', '2/6 build the playground (bundles the fresh zip)');
run('npm run site:build', '3/6 build the spec site');
run('npx wrangler pages deploy playground/dist --project-name ds-contracts-playground --branch main --commit-dirty=true', '4/6 publish the playground');
run('npx wrangler pages deploy site/dist --project-name ds-contracts-spec --branch main --commit-dirty=true', '5/6 publish the spec site');
run('node scripts/deploy-check.mjs', '6/6 VERIFY: live bytes == this build (retries while the CDN propagates)');

console.log('\n✔ deployed and verified: both Pages projects serve exactly what this commit builds.');
