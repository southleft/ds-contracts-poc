/**
 * `ds-contracts onboard` — unit-pinned (plain node:test, tsx-run, the
 * draft-capture-config.test.ts discipline). Browser-free: the capture stage is
 * resumed over COMMITTED artifacts (`--from promote`), so every pin here runs
 * offline in the eval suite.
 *
 * Load-bearing pins:
 *   · PHASE 1's review gate is a real gate — an unreviewed drafted capture
 *     config makes phase 2 REFUSE BY NAME and write nothing. Proved at the
 *     `--from promote` stage too, so the gate is not stage-dependent: there is
 *     no arrangement of flags that gets past it;
 *   · PHASE 2's happy path runs promote → emit → bundle end-to-end over a real
 *     library's committed capture artifacts, and the bundle it produces is
 *     BYTE-IDENTICAL on a second run (determinism, not "it ran");
 *   · the printed checklist names the three fields that fail QUIETLY
 *     (classAllow / varPrefix / mount) with the value the config carries;
 *   · the generalized promote module reproduces the four committed libraries —
 *     that pin lives in the `promote-generalization` eval case, which compares
 *     bytes against git rather than re-deriving them here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DRAFT_MARKER_KEY, DRAFT_MARKER_MESSAGE } from '../../../extract/draft-capture-config.js';
import { onboardCommand, reviewStatus, STATE_FILENAME, type LibraryManifest, type OnboardState } from '../src/commands/onboard.js';

/** The repo root: walk up from this module until the committed Tailwind
 *  library manifest is in view. The eval suite runs this file from
 *  `evals/.scratch/packages/cli/test`, where the two levels above the scratch
 *  root ARE the repo — so the same walk works in both places, and every path
 *  it produces is READ-ONLY (all writes go to a tmpdir). */
const REPO = (() => {
  let dir = path.resolve(new URL('.', import.meta.url).pathname);
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, 'examples', 'tailwind', 'ds-library.json'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('cannot locate the repo root (no examples/tailwind/ds-library.json above this test)');
})();
const TW = path.join(REPO, 'examples', 'tailwind');

/** A scratch workspace whose manifest points its READS at the repo's committed
 *  Tailwind capture artifacts and every WRITE at the scratch dir — so a test
 *  run can never move a committed byte. */
function scratchLibrary(opts: { reviewed: boolean }): { root: string; ws: string; manifest: LibraryManifest } {
  const root = mkdtempSync(path.join(tmpdir(), 'ds-onboard-'));
  const ws = path.join(root, 'work');
  for (const d of ['contracts', 'tokens', 'figma']) mkdirSync(path.join(ws, d), { recursive: true });

  // The capture config: the real Tailwind one, optionally re-marked as an
  // UNREVIEWED DRAFT (that key is exactly what the runner refuses on).
  const captureCfg = JSON.parse(readFileSync(path.join(REPO, 'extract/computed/configs/tailwind.json'), 'utf8')) as Record<string, unknown>;
  const cfgOut = path.join(ws, 'capture-config.json');
  writeFileSync(
    cfgOut,
    JSON.stringify(
      opts.reviewed
        ? captureCfg
        : { [DRAFT_MARKER_KEY]: DRAFT_MARKER_MESSAGE, ...captureCfg, library: { ...(captureCfg.library as object), '__review:classAllow': 'not inferable from static source' } },
      null,
      2,
    ) + '\n',
  );

  const manifest: LibraryManifest = {
    library: 'scratch',
    exampleDir: 'work',
    captureOut: path.join(REPO, 'extract/computed/out/tailwind'),
    dtcg: path.join(TW, 'tokens/tailwind.dtcg.json'),
    mintedOut: 'work/tokens/scratch-minted.dtcg.json',
    mintedDoc: 'work/tokens/MINTED.md',
    components: ['button', 'badge', 'card', 'alert', 'toggleswitch'],
    contractStem: {},
    contractVersion: '0.2.0',
    promoterPath: 'ds-contracts promote --config work/ds-library.json',
    possessive: "the library's",
    mintedDocTitle: 'Scratch minted tokens',
    capture: { config: cfgOut, harness: path.join(TW, '.tw-sandbox') },
    emit: { out: 'work/figma' },
    bundle: { out: 'work/figma/scratch.bundle.json', name: 'Scratch' },
  };
  writeFileSync(path.join(ws, 'ds-library.json'), JSON.stringify(manifest, null, 2) + '\n');

  const state: OnboardState = {
    version: 1,
    target: 'work',
    library: 'scratch',
    manifest: 'work/ds-library.json',
    root,
    captureComponents: ['Button', 'Badge', 'Card', 'Alert', 'ToggleSwitch'],
    adopted: true,
  };
  writeFileSync(path.join(ws, STATE_FILENAME), JSON.stringify(state, null, 2) + '\n');
  return { root, ws, manifest };
}

const capture = async (fn: () => Promise<number>): Promise<{ code: number; out: string }> => {
  const lines: string[] = [];
  const log = console.log;
  const err = console.error;
  console.log = (...a: unknown[]) => void lines.push(a.map(String).join(' '));
  console.error = (...a: unknown[]) => void lines.push(a.map(String).join(' '));
  try {
    return { code: await fn(), out: lines.join('\n') };
  } finally {
    console.log = log;
    console.error = err;
  }
};

// ---------------------------------------------------------------------------

test('phase 2 REFUSES an unreviewed draft capture config by name, and writes nothing', async () => {
  const { ws } = scratchLibrary({ reviewed: false });
  const { code, out } = await capture(() => onboardCommand(['--continue', '--workspace', ws]) as Promise<number>);

  assert.equal(code, 1, 'an unreviewed draft must refuse');
  assert.match(out, /UNREVIEWED DRAFT capture config/, 'the refusal must name the draft, not fail generically');
  assert.match(out, new RegExp(DRAFT_MARKER_KEY), 'the refusal must name the marker key the human deletes');
  assert.match(out, /Nothing was captured, promoted, bundled or published/);
  assert.equal(readdirSync(path.join(ws, 'contracts')).length, 0, 'a refused run must not write contracts');
  assert.equal(readdirSync(path.join(ws, 'figma')).length, 0, 'a refused run must not write a bundle');
});

test('the review gate is not stage-dependent — --from promote still refuses an unreviewed draft', async () => {
  const { ws } = scratchLibrary({ reviewed: false });
  const { code, out } = await capture(() => onboardCommand(['--continue', '--workspace', ws, '--from', 'promote']) as Promise<number>);
  assert.equal(code, 1);
  assert.match(out, /UNREVIEWED DRAFT capture config/);
  assert.equal(readdirSync(path.join(ws, 'figma')).length, 0);
});

test('phase 2 happy path: promote → emit → bundle over committed capture artifacts', async () => {
  const { ws, manifest } = scratchLibrary({ reviewed: true });
  const { code, out } = await capture(() => onboardCommand(['--continue', '--workspace', ws, '--from', 'promote']) as Promise<number>);

  assert.equal(code, 0, `phase 2 must succeed:\n${out}`);
  // Every stage announced itself.
  for (const s of ['capture', 'promote', 'emit', 'bundle', 'publish']) {
    assert.match(out, new RegExp(`\\] ${s}`), `stage "${s}" must print a progress line`);
  }
  // Promote wrote a contract + extension sidecar per declared component.
  for (const c of manifest.components) {
    assert.ok(existsSync(path.join(ws, 'contracts', `${c}.contract.json`)), `${c} contract missing`);
    assert.ok(existsSync(path.join(ws, 'contracts', `${c}.extension.json`)), `${c} extension missing`);
  }
  assert.ok(existsSync(path.join(ws, 'tokens', 'scratch-minted.dtcg.json')), 'minted tree missing');
  assert.ok(existsSync(path.join(ws, 'tokens', 'MINTED.md')), 'promotion receipt missing');
  // The bundle is the ONE artifact a user hands over.
  const bundlePath = path.join(ws, 'figma', 'scratch.bundle.json');
  const first = readFileSync(bundlePath);
  const bundle = JSON.parse(first.toString()) as { type: string; contracts: unknown[]; tokenSet: { name: string } };
  assert.equal(bundle.type, 'CONTRACTS-BUNDLE');
  assert.equal(bundle.contracts.length, manifest.components.length);
  assert.equal(bundle.tokenSet.name, 'Scratch');
  // …and the summary names what was produced, plus the un-published state.
  assert.match(out, /── onboard summary/);
  assert.match(out, /published\s+no\. Mint a channel once with `ds-contracts figma claim-channel`/, 'with no channel key the summary must say so and name claim-channel');

  // DETERMINISM: the same inputs through the same command produce the same
  // bundle bytes. "It ran" is not the claim.
  const second = await capture(() => onboardCommand(['--continue', '--workspace', ws, '--from', 'promote']) as Promise<number>);
  assert.equal(second.code, 0);
  assert.deepEqual(readFileSync(bundlePath), first, 'double-run bundle bytes must be identical');
});

test('a QUARANTINED component ships no contract, is named in the summary, and the run still finishes the others', async () => {
  const { ws, manifest, root } = scratchLibrary({ reviewed: true });

  // A capture-out dir of our own: the committed Tailwind artifacts for four
  // components, and for the fifth ONLY the runner's quarantine receipt — which
  // is exactly what a quarantined component leaves behind (refusal.json +
  // REFUSAL.md + captured-truth.json, and deliberately NO contract).
  const out = path.join(root, 'capture-out');
  const src = path.join(REPO, 'extract/computed/out/tailwind');
  for (const c of manifest.components) {
    mkdirSync(path.join(out, c), { recursive: true });
    if (c === 'card') {
      writeFileSync(
        path.join(out, c, 'refusal.json'),
        JSON.stringify({ component: 'Card', reason: 'generator registry refused a channel', detail: ['synthetic quarantine for this pin'] }, null, 2) + '\n',
      );
      continue;
    }
    for (const f of readdirSync(path.join(src, c))) {
      if (!f.endsWith('.json')) continue;
      cpSync(path.join(src, c, f), path.join(out, c, f));
    }
  }
  const manifestPath = path.join(ws, 'ds-library.json');
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, captureOut: out }, null, 2) + '\n');

  const { code, out: log } = await capture(() => onboardCommand(['--continue', '--workspace', ws, '--from', 'promote']) as Promise<number>);

  assert.equal(code, 1, 'a quarantine is a defect, not a waiver — the exit status must say so');
  assert.match(log, /QUARANTINED {4}1 component\(s\) shipped NO CONTRACT/, 'the summary must name the quarantine');
  assert.match(log, /Card: generator registry refused a channel/);
  assert.match(log, /quarantined component\(s\) excluded BY NAME/);
  assert.ok(!existsSync(path.join(ws, 'contracts', 'card.contract.json')), 'a quarantined component must ship NO contract');
  // …and the other four finished all the way to the bundle.
  const bundle = JSON.parse(readFileSync(path.join(ws, 'figma', 'scratch.bundle.json'), 'utf8')) as { contracts: Array<{ id: string }> };
  assert.equal(bundle.contracts.length, 4);
  assert.ok(!bundle.contracts.some((c) => c.id.endsWith('.card')), 'the quarantined component must not reach the bundle');
});

test('phase 2 refuses a --from stage it does not have', async () => {
  const { ws } = scratchLibrary({ reviewed: true });
  await assert.rejects(
    () => onboardCommand(['--continue', '--workspace', ws, '--from', 'nonsense']) as Promise<number>,
    /--from must be one of: capture, promote, emit, bundle, publish/,
  );
});

test('the review checklist names the three fields that fail quietly, with their values', () => {
  const cfg = JSON.parse(readFileSync(path.join(REPO, 'extract/computed/configs/carbon.json'), 'utf8')) as Record<string, unknown>;
  const status = reviewStatus(cfg);
  assert.equal(status.reviewed, true, "carbon's committed capture config is reviewed");
  assert.deepEqual(status.craft.map((c) => c.field), ['library.classAllow', 'library.varPrefix', 'mount.wrapperOpen']);
  assert.equal(status.craft[0].value, '^cds--(?!.*--)');
  assert.equal(status.craft[1].value, '--cds-');
  assert.match(status.craft[1].why, /degrade to anonymous literals/);
});

test('reviewStatus collects every open "__review:*" marker from a drafted config', () => {
  const status = reviewStatus({
    [DRAFT_MARKER_KEY]: 'draft',
    library: { '__review:classAllow': 'a', '__review:varPrefix': 'b' },
    mount: { '__review:mount': 'c' },
    components: [{ name: 'Button', '__review:fixedProps': 'd' }],
  });
  assert.equal(status.reviewed, false);
  assert.deepEqual(
    status.open.map((o) => o.field).sort(),
    ['components.0.fixedProps', 'library.classAllow', 'library.varPrefix', 'mount.mount'],
  );
});

test('phase 1 refuses a target that is neither a manifest dir nor resolvable', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ds-onboard-arg-'));
  await assert.rejects(
    () => onboardCommand([]) as Promise<number>,
    /onboard needs a package or path/,
  );
  // A directory WITH a manifest whose declared inputs are absent refuses by
  // naming each one rather than half-running.
  const lib = path.join(root, 'lib');
  mkdirSync(lib, { recursive: true });
  cpSync(path.join(TW, 'ds-library.json'), path.join(lib, 'ds-library.json'));
  await assert.rejects(
    () => onboardCommand([lib]) as Promise<number>,
    /names input\(s\) that do not exist here/,
  );
});
