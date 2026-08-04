/**
 * PUBLISHED-CLI FRESHNESS — `npm run publish:check`.
 *
 * WHY THIS EXISTS. On 2026-08-03 a 332-line rewrite of `onboard` landed in
 * this tree — the review gate that had never printed, the phase-2 runner that
 * could never resolve, the host-repo extraction guard — under the SAME version
 * the registry already served. Every doc's first runnable command is
 * `npm i -g @ds-contracts/cli`, so an adopter following the README got the
 * pre-fix build while this repo's gates were green on the fixed one. Same
 * shape as the deployment incident the week before: the BUILD was fresh, the
 * DISTRIBUTED ARTIFACT was not, and nothing compared them.
 *
 * WHAT IT CHECKS — the tree's built CLI against the bytes the registry serves
 * for the version in packages/cli/package.json:
 *   · version NOT published yet  → PASS, and says so (a pending release is a
 *     normal state; it is only a defect when the docs point at the old one)
 *   · version published, bytes IDENTICAL → PASS
 *   · version published, bytes DIFFER    → REFUSE. The tree has moved without
 *     a version bump, so `npm i -g` hands users something this repo does not
 *     test.
 *
 * Needs network (registry read only — it never publishes; that requires the
 * owner's OTP and is deliberately a human act).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const PKG_DIR = path.join(ROOT, 'packages', 'cli');
const pkg = JSON.parse(readFileSync(path.join(PKG_DIR, 'package.json'), 'utf8'));
const { name, version } = pkg;
const sha = (b) => createHash('sha256').update(b).digest('hex');

const localCli = path.join(PKG_DIR, 'dist', 'cli.js');
if (!existsSync(localCli)) {
  console.error(`REFUSED: ${path.relative(ROOT, localCli)} is not built — nothing to compare. Build first:  cd packages/cli && node build.mjs`);
  process.exit(1);
}

let published;
try {
  published = JSON.parse(execFileSync('npm', ['view', `${name}@${version}`, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
} catch {
  console.log(`  ✔ ${name}@${version} is NOT on the registry yet — this tree is ahead of what adopters can install.`);
  console.log(`    Publishing is a human act (it needs the owner's OTP):  cd packages/cli && npm publish`);
  console.log(`    Until then, every doc that says "npm i -g ${name}" points at an OLDER build than this repo tests.`);
  process.exit(0);
}

const tarballUrl = published?.dist?.tarball;
if (!tarballUrl) {
  console.error(`REFUSED: the registry returned no tarball URL for ${name}@${version} — cannot compare.`);
  process.exit(1);
}

const tmp = mkdtempSync(path.join(tmpdir(), 'dsc-pub-'));
execFileSync('sh', ['-c', `curl -sL "${tarballUrl}" -o "${tmp}/p.tgz" && tar xzf "${tmp}/p.tgz" -C "${tmp}"`], { stdio: 'ignore' });
const publishedCli = path.join(tmp, 'package', 'dist', 'cli.js');
if (!existsSync(publishedCli)) {
  console.error(`REFUSED: the published ${name}@${version} tarball carries no dist/cli.js — cannot compare.`);
  process.exit(1);
}

const localBytes = readFileSync(localCli);
const pubBytes = readFileSync(publishedCli);
if (sha(localBytes) === sha(pubBytes)) {
  console.log(`  ✔ ${name}@${version}: the registry serves exactly what this tree builds (${localBytes.length} bytes, sha ${sha(localBytes).slice(0, 12)}…).`);
  process.exit(0);
}

console.error(
  `✘ PUBLISHED CLI IS STALE — ${name}@${version} on the registry differs from this tree's build:\n` +
    `    registry: ${pubBytes.length} bytes (sha ${sha(pubBytes).slice(0, 12)}…)\n` +
    `    this tree: ${localBytes.length} bytes (sha ${sha(localBytes).slice(0, 12)}…)\n\n` +
    `  Every doc's first command is "npm i -g ${name}", so adopters are installing the registry copy —\n` +
    `  a build this repo's gates did not test. Bump the version in packages/cli/package.json and publish\n` +
    `  (cd packages/cli && npm publish — needs the owner's OTP), or revert the tree.`,
);
process.exit(1);
