/**
 * Deterministic eval suite — `npm run eval`.
 *
 * Turns the PoC's claims into falsifiable checks. Each case runs the REAL
 * pipeline (generator / token build / parity differ) in a scratch copy of the
 * repo (evals/.scratch, node_modules symlinked), applies one mutation, and
 * asserts the exact expected behavior:
 *
 *   C1 Determinism   — regeneration is byte-identical
 *   C2 Refusal       — invalid states fail the build (never silently pass)
 *   C3 Detection     — every drift class is caught, correctly classified,
 *                      with a usable promotion patch where applicable
 *   C4 Convergence   — applying a proposed patch + regenerating returns the
 *                      system to parity (with only the expected next-step
 *                      finding remaining)
 *
 * The live-Figma round-trip evals (export→import zero-diff) can't run
 * headless; their executed results are recorded in docs/07-validation.md.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
// COVERAGE ROUND pins (pure modules — no side effects at import):
import {
  customPropDefs,
  parseModuleCss,
  resolveToRef,
  type TokenLookup,
} from '../examples/polaris/scripts/lib-css.js';
import {
  CONTRACT_STATES,
  ContractSchema,
  TOKEN_CHANNELS,
  resolveTokens as schemaResolveTokens,
  tokensByPropEntries as coreTokensByPropEntries,
  walkAnatomy as coreWalkAnatomy,
  type Contract as SchemaContract,
  type Part as SchemaPart,
} from '../scripts/contract-schema.js';
import { buildPlan as proposePrBuildPlan, contentsPutBody, summarize as proposePrSummarize } from '../packages/cli/src/commands/propose-pr.js';
// PROMOTE GENERALIZATION (task #39) — the ONE promotion pipeline the four
// generalized libraries now share (was six copies under examples/*/scripts/).
import { promote as promoteFloor, type PromoteConfig } from '../packages/cli/src/promote.js';
import { emitReact as coreEmitReact, generateCss as coreGenerateCss, isMultiRoot as coreIsMultiRoot, stripCanvasOnlyChannels as coreStripCanvasOnly, validateContract as coreValidateContract } from '../core/emit-react.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import { emitHtml as coreEmitHtml } from '../core/emit-html.js';
import { tokenInventoryFromJson } from '../core/tokens.js';
// DEPTH BUILD Stage A+B pins (pure — production capture/anatomy over committed
// receipts; the evals NEVER launch a browser).
import { loadConfig as loadCaptureConfig, propSpaceFor, stageFor } from '../extract/computed/capture.js';
import {
  buildUnion as depthBuildUnion,
  buildMultiRootUnion,
  descendToRealRoots,
  nameUnion as depthNameUnion,
  pathDataExtent,
  promoteAnatomy as depthPromoteAnatomy,
  promoteMultiRootAnatomy,
} from '../extract/computed/anatomy.js';
import type { Capture as DepthCapture, CapturedNode as DepthNode } from '../extract/computed/lib.js';
import { CSS_SHORTHANDS, decomposeTranslate, isAbsurdRadius, mergeShippedMinted, mintedLeafCount, shorthandVarSkip, signature, stems } from '../extract/computed/lib.js';
import { kebab as depthKebab } from '../extract/types.js';
import { mountSanity, disclosureAdvisory, type MountRow } from '../extract/computed/mount-sanity.js';
import { emitWebComponent as wcEmit } from '../packages/emitter-web-components/src/emit-wc.js';
// POLARIS/ASTRYX REPAIR WAVE pins (both Chromium-free — the first replays the
// COMMITTED capture through fusion, the second is pure JSON).
import {
  alignSweep as fuseAlignSweep,
  applyMintToContract as fuseApplyMint,
  detectFolds as fuseDetectFolds,
  enrichLayout as fuseEnrichLayout,
  prepareMint as fusePrepareMint,
  styledChannels as fuseStyledChannels,
} from '../extract/computed/fuse.js';
import { reconstructCaptures as fuseReconstruct } from '../extract/computed/replay.js';
import { mintTokens as coreMintTokens } from '../core/mint-tokens.js';
import { applyDecisions as computedApplyDecisions, type AckedDecision } from '../extract/computed/decisions.js';
// SYNC LAYER STEP 1 pins (pure — the ledger lockfile arithmetic; no I/O at import):
import {
  classifyRecord as syncClassifyRecord,
  recordCodeToCanvasSync as syncRecordCodeToCanvas,
  serializeLedger as syncSerializeLedger,
  parseLedger as syncParseLedger,
  validateLedger as syncValidateLedger,
  emptyLedger as syncEmptyLedger,
  type LedgerRecord as SyncLedgerRecord,
  type SetObservation as SyncSetObservation,
} from '../sync/ledger.js';

const ROOT = process.cwd();
const SCRATCH = path.join(ROOT, 'evals', '.scratch');
const TSX = path.join(SCRATCH, 'node_modules', '.bin', 'tsx');

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function resetScratch() {
  rmSync(SCRATCH, { recursive: true, force: true });
  mkdirSync(SCRATCH, { recursive: true });
  // playground rides along READ-ONLY: the canvas-box-parity receipt pins the
  // canvas renderer's border-box semantics against its source (the module is
  // vite-only at runtime — import.meta.glob — so the receipt reads, never runs).
  // workers rides along for the AI-fix guardrail eval (the worker test suite
  // runs in scratch via the root tsx — workers/assist has no own node_modules).
  // packages rides along because scripts/contract-schema.ts is a re-export
  // shim over packages/schema/src (the @ds-contracts/schema source) and the
  // CLI evals run packages/cli from scratch. Build artifacts (dist/) are
  // filtered out — the CLI evals rebuild in scratch, and copying ~24 MB of
  // bundles per case would dominate the reset.
  // figma-sync rides along for the plugin-engine evals: the engine entry,
  // ui.html (embedded dump script + engine slot), and the committed
  // engine.receipt.json the zip build drift-guards against.
  for (const dir of ['contracts', 'tokens', 'scripts', 'core', 'parity', 'src', 'catalog', 'context', 'assets', 'extract', 'playground', 'workers', 'packages', 'figma-sync']) {
    cpSync(path.join(ROOT, dir), path.join(SCRATCH, dir), {
      recursive: true,
      filter: dir === 'packages' ? (src) => path.basename(src) !== 'dist' : undefined,
    });
  }
  cpSync(path.join(ROOT, 'evals', 'fixtures'), path.join(SCRATCH, 'evals', 'fixtures'), {
    recursive: true,
  });
  // examples/ is otherwise NOT copied (kept out of scratch — see astryx pins,
  // which stage what they need); plugin-engine-check reads the depth-composite
  // contract for its composite-plugin-path flow, so stage that one directory.
  cpSync(path.join(ROOT, 'examples', 'depth-composite'), path.join(SCRATCH, 'examples', 'depth-composite'), {
    recursive: true,
  });
  // plugin-engine-check's foreign-token-bundle flow reads exactly these two
  // MUI artifacts (the JSON-only bundle and the compiled-script path it must
  // be equivalent to) — staged as files, not the whole examples/mui tree.
  mkdirSync(path.join(SCRATCH, 'examples', 'mui', 'figma'), { recursive: true });
  for (const f of ['mui.bundle.json', 'GENESIS-BATCH.figma.js']) {
    cpSync(path.join(ROOT, 'examples', 'mui', 'figma', f), path.join(SCRATCH, 'examples', 'mui', 'figma', f));
  }
  // The sibling-bundles flow exercises the astryx/polaris/astryx-docs bundles
  // through the same engine path — staged as files, same discipline as above.
  for (const [dir, f] of [
    ['astryx', 'astryx.bundle.json'],
    ['astryx', 'astryx-docs.bundle.json'],
    ['polaris', 'polaris.bundle.json'],
    // CARBON ROUND: the recurring hermeticity lesson — any gate flow that reads
    // an examples/ file needs it staged here, or plugin-engine-check passes
    // locally and dies in scratch.
    ['carbon', 'carbon.bundle.json'],
    // ALTITUDE ROUND: same lesson, eighth time — the shadow-DOM library's
    // bundle is read by the sibling-bundles flow and must be staged here too.
    ['altitude', 'altitude.bundle.json'],
  ]) {
    mkdirSync(path.join(SCRATCH, 'examples', dir, 'figma'), { recursive: true });
    cpSync(path.join(ROOT, 'examples', dir, 'figma', f), path.join(SCRATCH, 'examples', dir, 'figma', f));
  }
  for (const file of ['package.json', 'tsconfig.json']) {
    cpSync(path.join(ROOT, file), path.join(SCRATCH, file));
  }
  cpSync(path.join(ROOT, 'evals', 'golden.json'), path.join(SCRATCH, 'evals', 'golden.json'));
  symlinkSync(path.join(ROOT, 'node_modules'), path.join(SCRATCH, 'node_modules'), 'dir');
}

interface RunResult {
  status: number;
  out: string;
}
function run(cmd: string, args: string[]): RunResult {
  // HERMETIC CLOCK (2026-07-22): the parity differ's snapshot-staleness guard
  // (MAX_SNAPSHOT_AGE_DAYS, default 14) is a LIVE-CI freshness concern — in
  // the eval suite it made four C3/C4 claims time-dependent: they went red by
  // pure calendar (committed snapshots crossed 14.0 days between two runs
  // with zero code change). An eval's claim is about differ LOGIC, never
  // about today's date; the guard stays fully active outside the suite.
  const r = spawnSync(cmd, args, {
    cwd: SCRATCH,
    encoding: 'utf8',
    env: { ...process.env, MAX_SNAPSHOT_AGE_DAYS: process.env.MAX_SNAPSHOT_AGE_DAYS ?? '36500' },
  });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}
const generate = () => run(TSX, ['scripts/generate-components.ts']);
const buildTokens = () => run(process.execPath, ['scripts/build-tokens.mjs']);
const parity = () => run(TSX, ['parity/diff.ts']);

interface ReportFinding {
  surface: string;
  classification: string;
  subject: string;
  proposedPatch?: Record<string, unknown>;
}
const readReport = (): ReportFinding[] =>
  JSON.parse(readFileSync(path.join(SCRATCH, 'parity', 'report.json'), 'utf8')).findings;

/** Per-component sync scripts are AMEND-CAPABLE since #60: they carry the
 *  shared sync runtime with `const COMPONENTS = [<data>]` (variants ride
 *  data.variants / data.stateVariants) instead of the old create-only
 *  VARIANTS/STATE_VARIANTS constants. */
const parseSyncComponent = (script: string): any =>
  JSON.parse(script.match(/const COMPONENTS = (\[[\s\S]*?\n\]);/)![1])[0];

function replaceInFile(rel: string, from: string | RegExp, to: string) {
  const p = path.join(SCRATCH, rel);
  const src = readFileSync(p, 'utf8');
  const next = src.replace(from, to);
  if (next === src) throw new Error(`Mutation did not apply in ${rel}: ${String(from)}`);
  writeFileSync(p, next);
}
function editJson(rel: string, fn: (data: any) => void) {
  const p = path.join(SCRATCH, rel);
  const data = JSON.parse(readFileSync(p, 'utf8'));
  fn(data);
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

function hashTree(rel: string): string {
  const hash = createHash('sha256');
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir).sort()) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else {
        hash.update(entry);
        hash.update(readFileSync(full));
      }
    }
  };
  walk(path.join(SCRATCH, rel));
  return hash.digest('hex');
}

const expectFinding = (
  findings: ReportFinding[],
  surface: string,
  classification: string,
  subject: string,
) => {
  const f = findings.find(
    (x) => x.surface === surface && x.classification === classification && x.subject === subject,
  );
  if (!f) {
    throw new Error(
      `Expected [${surface} ${classification}] ${subject}; got: ${findings.map((x) => `[${x.surface} ${x.classification}] ${x.subject}`).join(', ') || '(none)'}`,
    );
  }
  return f;
};

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

interface Case {
  id: string;
  claim: 'C1-determinism' | 'C2-refusal' | 'C3-detection' | 'C4-convergence' | 'C5-extraction' | 'C6-theming' | 'C7-cli' | 'C8-journey';
  run: () => void; // throws on failure
}

const BTN_TSX = 'src/components/Button/Button.tsx';
const CARD_TSX = 'src/components/Card/Card.tsx';
const CONTRACT = 'contracts/button.contract.json';
const FIGMA_COMPONENTS = 'parity/snapshots/figma-components.json';
const FIGMA_TOKENS = 'parity/snapshots/figma-tokens.json';

const MINIMAL_CONTRACT = (id: string, name: string, refId: string) => ({
  id,
  name,
  version: '1.0.0',
  description: 'Eval fixture.',
  semantics: { element: 'div' },
  props: [],
  anatomy: { root: { parts: { inner: { component: { id: refId } } } } },
  anchors: {
    figma: { fileKey: null, componentSetKey: null },
    code: { importPath: `src/components/${name}`, export: name },
  },
});

const cases: Case[] = [
  {
    id: 'refuse-unknown-token-reference',
    claim: 'C2-refusal',
    run: () => {
      replaceInFile(CONTRACT, '{radius.control}', '{radius.nonexistent}');
      const r = generate();
      if (r.status === 0) throw new Error('Generator accepted a nonexistent token reference');
      if (!r.out.includes('does not exist')) throw new Error('Missing token not named in error');
    },
  },
  {
    id: 'refuse-schema-invalid-contract',
    claim: 'C2-refusal',
    run: () => {
      editJson(CONTRACT, (c) => delete c.semantics);
      const r = generate();
      if (r.status === 0) throw new Error('Generator accepted a contract missing semantics');
    },
  },
  {
    id: 'refuse-incomplete-mode-set',
    claim: 'C2-refusal',
    run: () => {
      editJson('tokens/modes/semantic.dark.tokens.json', (t) => delete t.color.border);
      const r = buildTokens();
      if (r.status === 0) throw new Error('Token build accepted a light/dark mode gap');
      if (!r.out.includes('light mode but not dark')) throw new Error('Mode gap not named');
    },
  },
  {
    id: 'deterministic-regeneration',
    claim: 'C1-determinism',
    run: () => {
      if (buildTokens().status !== 0 || generate().status !== 0) throw new Error('First build failed');
      const first = hashTree('src');
      if (buildTokens().status !== 0 || generate().status !== 0) throw new Error('Second build failed');
      if (hashTree('src') !== first) throw new Error('Regeneration is not byte-identical');
    },
  },
  {
    id: 'baseline-parity-clean',
    claim: 'C3-detection',
    run: () => {
      const r = parity();
      if (r.status !== 0) throw new Error(`Baseline not clean:\n${r.out}`);
    },
  },
  {
    id: 'detect-code-added-prop',
    claim: 'C3-detection',
    run: () => {
      replaceInFile(BTN_TSX, 'loading?: boolean;', "loading?: boolean;\n  iconOnly?: boolean;");
      replaceInFile(BTN_TSX, "loading = false,", "loading = false,\n    iconOnly = false,");
      if (parity().status === 0) throw new Error('Drift not detected');
      const f = expectFinding(readReport(), 'code', 'ahead', 'Button.iconOnly');
      if ((f.proposedPatch as any)?.name !== 'iconOnly') throw new Error('Patch missing/incorrect');
    },
  },
  {
    id: 'detect-code-removed-prop',
    claim: 'C3-detection',
    run: () => {
      replaceInFile(BTN_TSX, /\s*\/\*\* Control density\. \*\/\n\s*size\?: 'sm' \| 'md' \| 'lg';/, '');
      if (parity().status === 0) throw new Error('Drift not detected');
      expectFinding(readReport(), 'code', 'behind', 'Button.size');
    },
  },
  {
    id: 'detect-code-enum-drift',
    claim: 'C3-detection',
    run: () => {
      replaceInFile(BTN_TSX, "'primary' | 'secondary' | 'danger'", "'primary' | 'secondary' | 'danger' | 'ghost'");
      if (parity().status === 0) throw new Error('Drift not detected');
      expectFinding(readReport(), 'code', 'mismatch', 'Button.variant');
    },
  },
  {
    id: 'detect-code-default-drift',
    claim: 'C3-detection',
    run: () => {
      replaceInFile(BTN_TSX, "size = 'md',", "size = 'lg',");
      if (parity().status === 0) throw new Error('Drift not detected');
      expectFinding(readReport(), 'code', 'mismatch', 'Button.size (default)');
    },
  },
  {
    id: 'detect-figma-missing-property',
    claim: 'C3-detection',
    run: () => {
      editJson(FIGMA_COMPONENTS, (s) => {
        delete s.sets.find((x: any) => x.name === 'Button').properties.Size;
      });
      if (parity().status === 0) throw new Error('Drift not detected');
      expectFinding(readReport(), 'figma', 'behind', 'Button.Size');
    },
  },
  {
    id: 'detect-figma-extra-property',
    claim: 'C3-detection',
    run: () => {
      editJson(FIGMA_COMPONENTS, (s) => {
        s.sets.find((x: any) => x.name === 'Button').properties['Elevated#1:1'] = {
          type: 'BOOLEAN',
          defaultValue: false,
          variantOptions: null,
        };
      });
      if (parity().status === 0) throw new Error('Drift not detected');
      const f = expectFinding(readReport(), 'figma', 'ahead', 'Button.Elevated');
      if (!f.proposedPatch) throw new Error('No promotion patch proposed');
    },
  },
  {
    id: 'detect-figma-variant-options-drift',
    claim: 'C3-detection',
    run: () => {
      editJson(FIGMA_COMPONENTS, (s) => {
        s.sets.find((x: any) => x.name === 'Button').properties.Variant.variantOptions.push('Ghost');
      });
      if (parity().status === 0) throw new Error('Drift not detected');
      expectFinding(readReport(), 'figma', 'mismatch', 'Button.Variant');
    },
  },
  {
    id: 'detect-token-alias-drift',
    claim: 'C3-detection',
    run: () => {
      editJson(FIGMA_TOKENS, (t) => {
        t.collections
          .find((c: any) => c.name === 'Semantic')
          .variables.find((v: any) => v.name === 'color/action/primary/background').values.Light =
          '{color/blue/700}';
      });
      if (parity().status === 0) throw new Error('Drift not detected');
      const f = expectFinding(
        readReport(),
        'figma-tokens',
        'mismatch',
        'Semantic/color/action/primary/background [Light]',
      );
      if ((f.proposedPatch as any)?.adoptFigmaValue !== '{color/blue/700}')
        throw new Error('Adoption patch missing/incorrect');
    },
  },
  {
    id: 'detect-token-missing-variable',
    claim: 'C3-detection',
    run: () => {
      editJson(FIGMA_TOKENS, (t) => {
        const sem = t.collections.find((c: any) => c.name === 'Semantic');
        sem.variables = sem.variables.filter((v: any) => v.name !== 'radius/control');
      });
      if (parity().status === 0) throw new Error('Drift not detected');
      expectFinding(readReport(), 'figma-tokens', 'behind', 'Semantic/radius/control');
    },
  },
  {
    id: 'detect-token-extra-variable',
    claim: 'C3-detection',
    run: () => {
      editJson(FIGMA_TOKENS, (t) => {
        t.collections
          .find((c: any) => c.name === 'Semantic')
          .variables.push({
            name: 'color/action/tertiary/background',
            type: 'COLOR',
            values: { Light: '{color/gray/100}', Dark: '{color/gray/800}' },
          });
      });
      if (parity().status === 0) throw new Error('Drift not detected');
      expectFinding(readReport(), 'figma-tokens', 'ahead', 'Semantic/color/action/tertiary/background');
    },
  },
  {
    id: 'refuse-circular-dependency',
    claim: 'C2-refusal',
    run: () => {
      writeFileSync(
        path.join(SCRATCH, 'contracts', 'x.contract.json'),
        JSON.stringify(MINIMAL_CONTRACT('ds.x', 'X', 'ds.y')),
      );
      writeFileSync(
        path.join(SCRATCH, 'contracts', 'y.contract.json'),
        JSON.stringify(MINIMAL_CONTRACT('ds.y', 'Y', 'ds.x')),
      );
      const r = generate();
      if (r.status === 0) throw new Error('Generator accepted a circular composition');
      if (!r.out.includes('Circular')) throw new Error('Cycle not named in error');
    },
  },
  {
    id: 'refuse-unknown-component-ref',
    claim: 'C2-refusal',
    run: () => {
      replaceInFile('contracts/card.contract.json', '"id": "ds.avatar"', '"id": "ds.ghost"');
      const r = generate();
      if (r.status === 0) throw new Error('Generator accepted an unknown component ref');
      if (!r.out.includes('unknown contract')) throw new Error('Unknown ref not named');
    },
  },
  {
    id: 'detect-figma-missing-slot-property',
    claim: 'C3-detection',
    run: () => {
      editJson(FIGMA_COMPONENTS, (s) => {
        const card = s.sets.find((x: any) => x.name === 'Card');
        delete card.properties['Actions#2:15'];
      });
      if (parity().status === 0) throw new Error('Drift not detected');
      expectFinding(readReport(), 'figma', 'behind', 'Card.Actions');
    },
  },
  {
    id: 'detect-figma-missing-nested-instance',
    claim: 'C3-detection',
    run: () => {
      editJson(FIGMA_COMPONENTS, (s) => {
        const card = s.sets.find((x: any) => x.name === 'Card');
        card.nestedInstances = card.nestedInstances.filter((n: string) => n !== 'Avatar');
      });
      if (parity().status === 0) throw new Error('Drift not detected');
      expectFinding(readReport(), 'figma', 'behind', 'Card.Avatar');
    },
  },
  {
    id: 'detect-figma-accepts-drift',
    claim: 'C3-detection',
    run: () => {
      editJson(FIGMA_COMPONENTS, (s) => {
        const card = s.sets.find((x: any) => x.name === 'Card');
        card.properties['Actions#2:15'].preferredValues = [
          { type: 'COMPONENT_SET', key: '1b5d2a573f3f39404af396bdbe944a30ca0eaec3' },
        ]; // Badge dropped from preferredValues in Figma
      });
      if (parity().status === 0) throw new Error('Drift not detected');
      expectFinding(readReport(), 'figma', 'mismatch', 'Card.Actions (accepts)');
    },
  },
  {
    id: 'detect-code-removed-slot-prop',
    claim: 'C3-detection',
    run: () => {
      replaceInFile(CARD_TSX, /\s*actions\?: ReactNode;/, '');
      if (parity().status === 0) throw new Error('Drift not detected');
      expectFinding(readReport(), 'code', 'behind', 'Card.actions');
    },
  },
  {
    // The multi-brand claim, mechanized: adding a brand is a TOKEN-LAYER-ONLY
    // operation. A new brand file must (a) leave every generated component
    // byte-identical, (b) emit a [data-brand] CSS block, (c) add a mode to
    // the design-tool Brand collection — and an incomplete brand file must
    // be refused by name.
    id: 'brand-added-token-layer-only',
    claim: 'C6-theming',
    run: () => {
      let r = buildTokens();
      if (r.status !== 0) throw new Error(`Baseline token build failed:\n${r.out}`);
      r = generate();
      if (r.status !== 0) throw new Error(`Baseline generate failed:\n${r.out}`);
      const before = hashTree('src/components');
      const nocturne = {
        brand: {
          accent: Object.fromEntries(
            ['100', '300', '400', '500', '600', '700', '900'].map((s) => [
              s,
              { $type: 'color', $value: `{color.red.${s}}` },
            ]),
          ),
          radius: { control: { $type: 'dimension', $value: '{radius.100}' } },
          font: {
            'control-family': { $type: 'fontFamily', $value: '{font.family.sans}' },
            'control-weight': { $type: 'fontWeight', $value: '{font.weight.medium}' },
          },
        },
      };
      const nocturnePath = path.join(SCRATCH, 'tokens', 'modes', 'brand.nocturne.tokens.json');
      writeFileSync(nocturnePath, JSON.stringify(nocturne, null, 2));
      r = buildTokens();
      if (r.status !== 0) throw new Error(`Token build failed with new brand:\n${r.out}`);
      r = generate();
      if (r.status !== 0) throw new Error(`Generate failed with new brand:\n${r.out}`);
      if (hashTree('src/components') !== before) {
        throw new Error('Adding a brand CHANGED generated component output — theming leaked out of the token layer');
      }
      const css = readFileSync(path.join(SCRATCH, 'src', 'styles', 'tokens.brands.css'), 'utf8');
      if (!css.includes('[data-brand="nocturne"]')) throw new Error('No [data-brand="nocturne"] CSS block emitted');
      r = run(TSX, ['scripts/generate-figma.ts']);
      if (r.status !== 0) throw new Error(`figma:plan failed with new brand:\n${r.out}`);
      const tokScript = readFileSync(path.join(SCRATCH, 'figma-sync', '01-tokens.js'), 'utf8');
      if (!tokScript.includes('"Nocturne"')) throw new Error('Brand mode "Nocturne" missing from the design-tool sync script');
      // incomplete brand file → refused by name
      const broken = JSON.parse(JSON.stringify(nocturne));
      delete broken.brand.radius;
      writeFileSync(nocturnePath, JSON.stringify(broken, null, 2));
      r = buildTokens();
      rmSync(nocturnePath);
      if (r.status === 0) throw new Error('Incomplete brand file was ACCEPTED');
      if (!r.out.includes('brand "nocturne"')) throw new Error(`Refusal did not name the brand:\n${r.out.slice(0, 300)}`);
    },
  },
  {
    // Adversarial refusal sweep (2026-07-06): these invalid states once
    // passed the generator SILENTLY. Each must now be refused BY NAME —
    // C2 is "fails loudly naming the violation", not "happens to break".
    id: 'refuse-contract-edge-cases',
    claim: 'C2-refusal',
    run: () => {
      const BADGE = 'contracts/badge.contract.json';
      const pristine = readFileSync(path.join(SCRATCH, BADGE), 'utf8');
      const expectRefusal = (label: string, needle: string, mutate: (c: any) => void) => {
        editJson(BADGE, mutate);
        const r = generate();
        writeFileSync(path.join(SCRATCH, BADGE), pristine);
        if (r.status === 0) throw new Error(`${label}: ACCEPTED (must refuse)`);
        if (!r.out.includes(needle)) throw new Error(`${label}: refused but violation not named — wanted "${needle}" in:\n${r.out.slice(0, 600)}`);
      };
      expectRefusal('default-not-in-enum', 'is not one of its enum values', (c) => {
        c.props.find((p: any) => typeof p.type === 'object').default = 'nonexistent';
      });
      expectRefusal('duplicate-figma-property', 'two props bind the same design property', (c) => {
        const first = c.props.find((p: any) => typeof p.type === 'object');
        c.props.push({ name: 'zzz', type: { enum: ['a', 'b'] }, default: 'a',
          bindings: { figma: { kind: 'VARIANT', property: first.bindings.figma.property, values: { a: 'A', b: 'B' } }, code: { prop: 'zzz' } } });
      });
      expectRefusal('figma-values-map-missing-value', 'figma values map is missing enum value', (c) => {
        const p = c.props.find((x: any) => typeof x.type === 'object' && x.bindings.figma.values);
        delete p.bindings.figma.values[p.type.enum[0]];
      });
      expectRefusal('required-text-no-default', 'must declare a string default', (c) => {
        c.props.push({ name: 'must', type: 'text', required: true,
          bindings: { figma: { kind: 'TEXT', property: 'Must' }, code: { prop: 'must' } } });
      });
      expectRefusal('malformed-token-ref', 'must be brace-wrapped', (c) => {
        c.anatomy.root.tokens['background-color'] = '{color.token.default.background';
      });
      // duplicate contract NAME across files → would clobber generated output
      const dupe = JSON.parse(pristine);
      dupe.id = 'ds.badge-two';
      writeFileSync(path.join(SCRATCH, 'contracts', 'zz-dupe.contract.json'), JSON.stringify(dupe, null, 2));
      const r = generate();
      rmSync(path.join(SCRATCH, 'contracts', 'zz-dupe.contract.json'));
      if (r.status === 0 || !r.out.includes('duplicate contract name')) {
        throw new Error(`duplicate-contract-name: not refused by name:\n${r.out.slice(0, 400)}`);
      }
      // Red-team additions (2026-07-08):
      expectRefusal('duplicate-code-binding (git-merge artifact)', 'duplicate code binding', (c) => {
        const first = c.props.find((p: any) => typeof p.type === 'object');
        const clone = JSON.parse(JSON.stringify(first));
        clone.name = 'variantTwo';
        clone.bindings.figma.property = 'Variant Two';
        c.props.push(clone); // same bindings.code.prop as the original
      });
      expectRefusal('non-semver version', 'semver', (c) => { c.version = 'v2-final'; });
      expectRefusal('unknown field silently stripped (strict schema)', 'Unrecognized key', (c) => {
        c.behavior = { on: 'hover' };
      });
      // and a refused contract must FAIL FAST by name — never crash a
      // dependent contract with an unnamed TypeError (the bug this found)
      editJson(BADGE, (c) => { c.props.find((p: any) => typeof p.type === 'object').type.enum = []; });
      const r2 = generate();
      writeFileSync(path.join(SCRATCH, BADGE), pristine);
      if (r2.status === 0) throw new Error('empty-enum: ACCEPTED');
      if (r2.out.includes('TypeError')) throw new Error('empty-enum: crashed downstream instead of failing fast with the named refusal');
    },
  },
  {
    // B.16 (docs/23) — THE DEFAULTLESS-AXIS "__unset" WALL, closed. The old
    // capture-config drafter shipped `unsetLabel: "__unset"`; fusion minted
    // that sentinel into every defaultless-axis token path and the token-ref
    // grammar (which forbids underscores) refused each ref with ~40 "must be
    // brace-wrapped" errors, NONE naming the underscore. Two pins here:
    // (a) an underscore-bearing ref is refused naming the ACTUAL rule + the
    //     sentinel + the fix (a reviewed default in the capture config);
    // (b) the shipped drafter never writes the sentinel again — its draft's
    //     unsetLabel passes the token-ref grammar as a path segment, and every
    //     defaultless enum axis gets a reviewed first-enum baseCombo pin.
    id: 'refuse-underscore-ref-names-unset-sentinel',
    claim: 'C2-refusal',
    run: () => {
      const BADGE = 'contracts/badge.contract.json';
      const pristine = readFileSync(path.join(SCRATCH, BADGE), 'utf8');
      editJson(BADGE, (c: any) => {
        c.anatomy.root.tokens['background-color'] = '{color.badge.__unset.background}';
      });
      const r = generate();
      writeFileSync(path.join(SCRATCH, BADGE), pristine);
      if (r.status === 0) throw new Error('underscore-bearing token ref was ACCEPTED (must refuse)');
      for (const needle of [
        'may not contain underscores',
        '__unset',
        'reviewed default in the capture config',
      ]) {
        if (!r.out.includes(needle)) {
          throw new Error(`refused, but the actual rule is not named — wanted "${needle}" in:\n${r.out.slice(0, 800)}`);
        }
      }
      // (b) drafter half: the sentinel never ships. Red-test discipline — this
      // fails on the pre-fix drafter (unsetLabel '__unset') by construction.
      const drafterUnit = run(TSX, ['--test', 'packages/cli/test/draft-capture-config.test.ts']);
      if (drafterUnit.status !== 0) {
        throw new Error(`draft-capture-config unit pins failed (B.16 drafter half):\n${drafterUnit.out.slice(0, 1200)}`);
      }
      console.log('refuse-underscore-ref-names-unset-sentinel: underscore refs refused naming the rule/sentinel/fix; drafter ships a token-legal unsetLabel + reviewed baseCombo');
    },
  },
  {
    // Brownfield (roadmap Phase 2): both extraction adapters must read a
    // FOREIGN library — conventions this repo's generator never emits — into
    // schema-valid proposals with correct kinds, values, defaults, events.
    id: 'extract-foreign-library',
    claim: 'C5-extraction',
    run: () => {
      for (const cfg of ['extract/fixtures/foreign-react.config.json', 'extract/fixtures/foreign-wc.config.json']) {
        const r = run(TSX, ['extract/run.ts', 'code', cfg]);
        if (r.status !== 0) throw new Error(`Extraction failed for ${cfg}:\n${r.out}`);
      }
      const chip = JSON.parse(
        readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-react/contracts/chip.contract.json'), 'utf8'),
      );
      const tone = chip.props.find((p: any) => p.name === 'tone');
      if (tone?.type?.enum?.join('|') !== 'neutral|info|success|critical' || tone.default !== 'neutral') {
        throw new Error('Chip.tone: one-hop alias enum or destructure default not extracted');
      }
      if (chip.events?.[0]?.bindings?.code?.prop !== 'onRemove') {
        throw new Error('Chip: onRemove not proposed as a declared event');
      }
      const alert = JSON.parse(
        readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-react/contracts/alert.contract.json'), 'utf8'),
      );
      if (alert.props.find((p: any) => p.name === 'severity')?.default !== 'info') {
        throw new Error('Alert.severity: legacy defaultProps default not extracted');
      }
      const tag = JSON.parse(
        readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-react/contracts/tag.contract.json'), 'utf8'),
      );
      const intent = tag.props.find((p: any) => p.name === 'intent');
      if (intent?.type?.enum?.join('|') !== 'neutral|brand|danger' || intent.default !== 'neutral') {
        throw new Error('Tag.intent: cva variant axis or defaultVariants default not extracted');
      }
      if (tag.props.find((p: any) => p.name === 'interactive')?.type !== 'boolean') {
        throw new Error('Tag.interactive: inline intersection member not extracted');
      }
      const notes = readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-react/proposals.md'), 'utf8');
      if (!notes.includes('**Opaque**') || !notes.includes('NOT extractable')) {
        throw new Error('Unreadable component was silently dropped instead of reported');
      }
      const badge = JSON.parse(
        readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-wc/contracts/fancy-badge.contract.json'), 'utf8'),
      );
      if (badge.props.find((p: any) => p.name === 'appearance')?.type?.enum?.length !== 3) {
        throw new Error('FancyBadge.appearance: CEM text-union enum not extracted');
      }
      if (badge.events?.[0]?.bindings?.code?.prop !== 'onDismiss') {
        throw new Error('FancyBadge: CEM event fb-dismiss not mapped to onDismiss');
      }
    },
  },
  {
    // Roadmap Phase 2 exit criterion, first half: the diagnostic loop runs
    // green→red→green on two surfaces this repo did NOT generate — foreign-
    // convention React source + a design dump, refereed by extracted
    // proposals, with correct per-surface classifications.
    id: 'diagnose-foreign-green-red-green',
    claim: 'C5-extraction',
    run: () => {
      const CFG = 'extract/fixtures/foreign-react.config.json';
      const diagnose = () => run(TSX, ['parity/diagnose.ts', CFG]);
      let r = run(TSX, ['extract/run.ts', 'code', CFG]);
      if (r.status !== 0) throw new Error(`Extraction failed:\n${r.out}`);
      if (diagnose().status !== 0) throw new Error('Baseline not green on foreign surfaces');
      // red on the design surface
      editJson('extract/fixtures/foreign-design.json', (d) => {
        d.components[0].variantProps.Tone = ['Neutral', 'Info', 'Success'];
      });
      r = diagnose();
      if (r.status === 0 || !r.out.includes('[design MISMATCH] Chip.Tone')) {
        throw new Error(`Design drift not caught/classified:\n${r.out}`);
      }
      editJson('extract/fixtures/foreign-design.json', (d) => {
        d.components[0].variantProps.Tone = ['Neutral', 'Info', 'Success', 'Critical'];
      });
      // red on the code surface
      replaceInFile(
        'extract/fixtures/foreign-react/Chip.tsx',
        "size?: 'compact' | 'regular';",
        "size?: 'compact' | 'regular' | 'spacious';",
      );
      r = diagnose();
      if (r.status === 0 || !r.out.includes('[code MISMATCH] Chip.size')) {
        throw new Error(`Code drift not caught/classified:\n${r.out}`);
      }
      replaceInFile(
        'extract/fixtures/foreign-react/Chip.tsx',
        "size?: 'compact' | 'regular' | 'spacious';",
        "size?: 'compact' | 'regular';",
      );
      if (diagnose().status !== 0) throw new Error('Did not return to green after revert');
    },
  },
  {
    // THE FLAGSHIP PILOT, PINNED (2026-07-26). The Shoelace pilot is the
    // repo's brownfield credibility artifact and its numbers lived only in a
    // hand-written README — which is exactly how it rotted: the committed
    // diagnose report predated `design.source` landing in its own config, so
    // "code-side diagnose ✔ clean" had never been verified against the
    // shipped config for three weeks. A number quoted in prose and gated
    // nowhere is a number that is already wrong.
    //
    // Pins the whole foreign-library chain on inputs neither surface of which
    // this repo owns: a published CEM (58 custom elements) + a read-only dump
    // of a community Figma kit.
    id: 'shoelace-reconcile-pinned',
    claim: 'C5-extraction',
    run: () => {
      const CFG = 'extract/pilots/shoelace/extract.config.json';
      const OUT = 'extract/pilots/shoelace/out';
      let r = run(TSX, ['extract/run.ts', 'code', CFG]);
      if (r.status !== 0) throw new Error(`Shoelace extraction failed:\n${r.out}`);
      const extracted = JSON.parse(
        readFileSync(path.join(SCRATCH, OUT, 'code-extraction.json'), 'utf8'),
      ) as Array<{ name: string }>;
      if (extracted.length !== 58) {
        throw new Error(`Shoelace CEM: expected 58 components, got ${extracted.length}`);
      }
      const contractsDir = path.join(SCRATCH, OUT, 'contracts');
      const files = readdirSync(contractsDir).filter((f) => f.endsWith('.contract.json'));
      let props = 0;
      let events = 0;
      for (const f of files) {
        const c = JSON.parse(readFileSync(path.join(contractsDir, f), 'utf8'));
        props += c.props.length;
        events += (c.events ?? []).length;
      }
      if (files.length !== 58 || props !== 411 || events !== 113) {
        throw new Error(
          `Proposal pin moved: ${files.length} contracts / ${props} props / ${events} events (README: 58 / 411 / 113)`,
        );
      }
      r = run(TSX, ['extract/run.ts', 'reconcile', CFG]);
      if (r.status !== 0) throw new Error(`Shoelace reconcile failed:\n${r.out}`);
      const rec = JSON.parse(readFileSync(path.join(SCRATCH, OUT, 'reconciliation.json'), 'utf8'));
      const got = `${rec.stats.matched}/${rec.stats.components} ${rec.stats.propsAgree} ${rec.stats.propsDiffer} ${rec.codeOnly.length} ${rec.designOnly.length}`;
      // The exact sentence the pilot README publishes, plus the two coverage
      // tails the diagnose orphan sweep is cross-checked against.
      if (got !== '28/58 42 236 30 8') {
        throw new Error(
          `Shoelace reconciliation pin moved — matched/components propsAgree propsDiffer codeOnly designOnly = "${got}", pinned "28/58 42 236 30 8"`,
        );
      }
      // FALSIFICATION: the pin must be sensitive to its own inputs. Rename one
      // kit set and the match count and the design-only tail must both move.
      editJson('extract/pilots/shoelace/design.json', (d) => {
        const btn = d.components.find((c: { name: string }) => c.name === 'Button');
        if (!btn) throw new Error('fixture drift: no "Button" set in the Shoelace kit dump');
        btn.name = 'Buttton';
      });
      r = run(TSX, ['extract/run.ts', 'reconcile', CFG]);
      const rec2 = JSON.parse(readFileSync(path.join(SCRATCH, OUT, 'reconciliation.json'), 'utf8'));
      if (rec2.stats.matched !== 27 || rec2.designOnly.length !== 9) {
        throw new Error(
          `Pin is not falsifiable: renaming the kit's Button left ${rec2.stats.matched} matched / ${rec2.designOnly.length} design-only (expected 27 / 9)`,
        );
      }
      console.log(
        'shoelace-reconcile-pinned: 58 elements → 58 contracts (411 props, 113 events); 28/58 matched, 42 agree, 236 decisions, 30 code-only, 8 design-only — and a one-set rename moves it',
      );
    },
  },
  {
    // THE DEFECT THIS PIN GUARDS (fixed 2026-07-26): parity/diagnose.ts matched
    // contracts to design sets on the bare name, while extract/reconcile.ts
    // stripped the vendor prefix from the same config key. Running the pilot's
    // OWN documented command therefore produced 58 `[design BEHIND] Sl* — No
    // design component set named like "Sl*"` findings, 28 of them false, and —
    // worse — because every match failed, not one design property was ever
    // compared. This case is the regression guard for all three brownfield
    // rules the referee was missing: prefix match, orphan sweep, and the
    // report recording what design input it read.
    id: 'shoelace-diagnose-prefix-match',
    claim: 'C5-extraction',
    run: () => {
      const CFG = 'extract/pilots/shoelace/extract.config.json';
      const REPORT = 'extract/pilots/shoelace/out/diagnose-report.json';
      const readReportJson = () => JSON.parse(readFileSync(path.join(SCRATCH, REPORT), 'utf8'));
      if (run(TSX, ['extract/run.ts', 'code', CFG]).status !== 0) {
        throw new Error('Shoelace extraction failed');
      }
      const r = run(TSX, ['parity/diagnose.ts', CFG]);
      if (r.status !== 1) {
        throw new Error(`Expected exit 1 (the two surfaces really do disagree), got ${r.status}`);
      }
      const rep = readReportJson();
      if (rep.designChecked !== true) {
        throw new Error('designChecked false — the design surface was not loaded at all');
      }
      if (rep.designSets !== 36 || rep.codePrefixStripped !== 'sl') {
        throw new Error(`Report provenance moved: ${rep.designSets} sets, prefix ${rep.codePrefixStripped}`);
      }
      if (rep.prefixMatched.length !== 28) {
        throw new Error(
          `THE DEFECT: ${rep.prefixMatched.length} contracts matched a kit set via the prefix rule, expected 28`,
        );
      }
      type F = { surface: string; classification: string; subject: string; detail: string };
      const findings: F[] = rep.findings;
      const missingSet = findings.filter((f) => f.detail.startsWith('No design component set'));
      const orphans = findings.filter((f) => f.detail.startsWith('No contract claims'));
      // The 30 genuinely-absent components are exactly reconcile's codeOnly
      // tail; the 28 prefix-matchable ones must NOT be in here. That equality
      // is the whole fix: 58 → 30, and the 28 that vanished were the false ones.
      if (missingSet.length !== 30) {
        throw new Error(
          `Spurious [design BEHIND] regression: ${missingSet.length} "no design component set" findings, expected 30 (58 was the bug, 28 of them false)`,
        );
      }
      if (findings.some((f) => f.surface === 'code')) {
        throw new Error('Code surface must be clean — proposals are extracted from this same manifest');
      }
      const orphanNames = orphans.map((f) => f.subject).sort().join('|');
      const EXPECTED_ORPHANS =
        'Color Swatch|Menu submenu|Menu title|Slot|_Image Comparer Handler|_demo / header|_ellipse|radio group button';
      if (orphanNames !== EXPECTED_ORPHANS) {
        throw new Error(`Orphan sweep moved:\n  got  ${orphanNames}\n  want ${EXPECTED_ORPHANS}`);
      }
      // FALSIFICATION 1 — the prefix rule is real, not a blanket match: point
      // idPrefix at the wrong vendor and the 28 false findings come straight back.
      editJson(CFG, (c) => { c.idPrefix = 'zz'; });
      const bad = run(TSX, ['parity/diagnose.ts', CFG]);
      if (bad.status !== 1) throw new Error('Expected drift with a wrong prefix');
      const repBad = readReportJson();
      if (repBad.prefixMatched.length !== 0) {
        throw new Error('A wrong idPrefix still matched sets — the rule is not reading the config');
      }
      const missingBad = (repBad.findings as F[]).filter((f) =>
        f.detail.startsWith('No design component set'),
      );
      if (missingBad.length !== 58) {
        throw new Error(
          `Falsification failed: a wrong prefix produced ${missingBad.length} unmatched contracts, expected the original 58`,
        );
      }
      editJson(CFG, (c) => { c.idPrefix = 'sl'; });
      // FALSIFICATION 2 — the orphan sweep is real: give one orphan a contract
      // name and it must stop being reported as unowned.
      editJson('extract/pilots/shoelace/design.json', (d) => {
        const orphan = d.components.find((c: { name: string }) => c.name === 'Menu title');
        orphan.name = 'Qr Code'; // ⇄ SlQrCode, one of the 30 code-only contracts
      });
      run(TSX, ['parity/diagnose.ts', CFG]);
      const rep3 = readReportJson();
      const orphans3 = (rep3.findings as F[]).filter((f) => f.detail.startsWith('No contract claims'));
      if (orphans3.length !== 7 || orphans3.some((f) => f.subject === 'Menu title')) {
        throw new Error(
          `Orphan sweep is not falsifiable: ${orphans3.length} orphans after adopting one (expected 7)`,
        );
      }
      console.log(
        'shoelace-diagnose-prefix-match: 28 prefix matches, 30 truly-absent sets (was 58, 28 false), 8 unowned kit sets, 0 code findings — wrong prefix restores all 58, adopting an orphan removes it',
      );
    },
  },
  {
    // The design side of `diagnose` is a HAND-SAVED dump: no CI can re-read a
    // Figma file, so an untouched design.json would report green forever while
    // the kit moved on. Same gate, same override, same finding shape as the
    // parity differ's snapshot-staleness check (`detect-stale-snapshot`), now
    // on the brownfield referee — where it matters more, because there is no
    // refresh command to run.
    id: 'diagnose-stale-design-snapshot',
    claim: 'C3-detection',
    run: () => {
      const CFG = 'extract/fixtures/foreign-react.config.json';
      const DESIGN = 'extract/fixtures/foreign-design.json';
      const REPORT = 'extract/fixtures/.out-react/diagnose-report.json';
      const stamp = (msAgo: number) =>
        editJson(DESIGN, (d) => { d.extractedAt = Date.now() - msAgo; });
      const staleFindings = () =>
        (JSON.parse(readFileSync(path.join(SCRATCH, REPORT), 'utf8')).findings as Array<{
          subject: string;
          surface: string;
          classification: string;
        }>).filter((f) => f.subject === 'design-snapshot');
      if (run(TSX, ['extract/run.ts', 'code', CFG]).status !== 0) {
        throw new Error('Fixture extraction failed');
      }
      // This case's claim IS the clock, so it pins the threshold back to 14
      // (run() disables the gate for every other case — the hermetic clock).
      process.env.MAX_SNAPSHOT_AGE_DAYS = '14';
      try {
        stamp(15 * 86_400_000);
        const r = run(TSX, ['parity/diagnose.ts', CFG]);
        const stale = staleFindings();
        if (r.status !== 1 || stale.length !== 1) {
          throw new Error(`A 15-day-old design dump passed the 14-day gate (exit ${r.status}, ${stale.length} findings)`);
        }
        if (stale[0].surface !== 'design' || stale[0].classification !== 'mismatch') {
          throw new Error(`Wrong classification: ${JSON.stringify(stale[0])}`);
        }
        // FALSIFICATION: a fresh stamp must clear it — and the rest of the
        // report must go back to green, proving the gate is the only thing
        // that fired.
        stamp(1 * 86_400_000);
        const ok = run(TSX, ['parity/diagnose.ts', CFG]);
        if (ok.status !== 0 || staleFindings().length !== 0) {
          throw new Error(`A 1-day-old design dump did not clear the gate:\n${ok.out}`);
        }
        const rep = JSON.parse(readFileSync(path.join(SCRATCH, REPORT), 'utf8'));
        if (rep.designSnapshot?.basis !== 'extractedAt') {
          throw new Error(`Green report must still record the snapshot age: ${JSON.stringify(rep.designSnapshot)}`);
        }
      } finally {
        delete process.env.MAX_SNAPSHOT_AGE_DAYS;
      }
      console.log(
        'diagnose-stale-design-snapshot: a 15-day-old hand-saved design dump fails the referee by name; a 1-day-old one passes, and the age is recorded even when green',
      );
    },
  },
  {
    // Enterprise gauntlet fix #1 (SIBLING-TYPE-FILE + CAST-TRANSPARENCY
    // rules): a Fluent-2-shaped component — props interface in a sibling
    // `X.types.ts`, export cast `as ForwardRefComponent<XProps>` — was
    // invisible (measured: Fluent census 0/23). It must extract with its
    // enum axes, the one-hop alias resolving THROUGH the merged table, and
    // the unreadable generic intersection member receipted by name.
    id: 'fluent-sibling-types-merge',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/run.ts', 'code', 'extract/fixtures/foreign-sibling.config.json']);
      if (r.status !== 0) throw new Error(`Extraction failed:\n${r.out}`);
      const widget = JSON.parse(
        readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-sibling/contracts/widget.contract.json'), 'utf8'),
      );
      const appearance = widget.props.find((p: any) => p.name === 'appearance');
      if (appearance?.type?.enum?.join('|') !== 'primary|outline|subtle') {
        throw new Error('Widget.appearance: sibling-types enum not extracted');
      }
      const size = widget.props.find((p: any) => p.name === 'size');
      if (size?.type?.enum?.join('|') !== 'small|medium|large') {
        throw new Error('Widget.size: one-hop alias behind the SIBLING table not resolved');
      }
      if (widget.props.find((p: any) => p.name === 'disabled')?.type !== 'boolean') {
        throw new Error('Widget.disabled: boolean not extracted through the cast');
      }
      const notes = readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-sibling/proposals.md'), 'utf8');
      if (!notes.includes('ComponentProps<WidgetSlots>') || !notes.includes('NOT carried')) {
        throw new Error('Unreadable generic intersection member not receipted by name');
      }
    },
  },
  {
    // Enterprise gauntlet fix #2 (silent-loss class B): `as`-cast exports.
    // The CAST-ALIAS rule extracts the public name (`const Pill = PillBase
    // as PillComponent`) with the base's props; an as-cast component whose
    // props type is imported lands as a NAMED skip — nothing silent.
    id: 'as-expression-named',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/run.ts', 'code', 'extract/fixtures/foreign-sibling.config.json']);
      if (r.status !== 0) throw new Error(`Extraction failed:\n${r.out}`);
      for (const id of ['pill', 'pill-base']) {
        const c = JSON.parse(
          readFileSync(path.join(SCRATCH, `extract/fixtures/.out-sibling/contracts/${id}.contract.json`), 'utf8'),
        );
        const tone = c.props.find((p: any) => p.name === 'tone');
        if (tone?.type?.enum?.join('|') !== 'neutral|bold|critical' || tone.default !== 'neutral') {
          throw new Error(`${id}: cast-alias did not carry the base component's props`);
        }
      }
      const notes = readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-sibling/proposals.md'), 'utf8');
      if (!notes.includes('**Opal**') || !notes.includes('OpalProps')) {
        throw new Error('as-cast component with imported props type not NAMED-skipped (silent loss)');
      }
    },
  },
  {
    // Enterprise gauntlet fix #3 (silent-loss class C): intersections of
    // named refs. Same-file refs RESOLVE (`type BannerProps = A & B` carries
    // A+B members instead of a hollow 0-prop "resolved" API); imported refs
    // become a NAMED skip listing them; an extends-only interface extracts
    // as genuinely zero-own-prop WITH the hollow receipt naming heritage.
    id: 'intersection-named',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/run.ts', 'code', 'extract/fixtures/foreign-sibling.config.json']);
      if (r.status !== 0) throw new Error(`Extraction failed:\n${r.out}`);
      const banner = JSON.parse(
        readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-sibling/contracts/banner.contract.json'), 'utf8'),
      );
      const tone = banner.props.find((p: any) => p.name === 'tone');
      if (tone?.type?.enum?.join('|') !== 'info|warning|critical' || tone.default !== 'info') {
        throw new Error('Banner.tone: intersection-of-named-refs member not resolved');
      }
      if (banner.props.find((p: any) => p.name === 'dismissible')?.type !== 'boolean') {
        throw new Error('Banner.dismissible: second intersection member not resolved');
      }
      const notes = readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-sibling/proposals.md'), 'utf8');
      if (!notes.includes('**Ghost**') || !notes.includes('[GhostA, GhostB]')) {
        throw new Error('Imported-refs intersection not NAMED-skipped with the refs listed');
      }
      if (!notes.includes('NO OWN members (extends React.HTMLAttributes<HTMLDivElement>')) {
        throw new Error('Extends-only interface missing the hollow receipt naming its heritage');
      }
      const plainBox = JSON.parse(
        readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-sibling/contracts/plain-box.contract.json'), 'utf8'),
      );
      if (plainBox.props.length !== 0) throw new Error('PlainBox: extends-only interface should carry zero own props');
    },
  },
  {
    // ASTRYX ROUND fix #1 (KEYOF-ENUM RULE — the 57%-median cause on the
    // Astryx census, direct analog of Carbon's `(typeof X)[number]`): a
    // prop typed `keyof X` — behind a one-hop alias, keying an in-file
    // interface (`type ButtonVariant = keyof ButtonVariantMap`), a plain
    // const table, or a `create({…})`-style factory call — must resolve to
    // its concrete value set (confidence 'inferred', assumption receipted),
    // and an UNRESOLVABLE keyof target must land as a NAMED refusal.
    id: 'keyof-enum-resolution',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/run.ts', 'code', 'extract/fixtures/foreign-keyof.config.json']);
      if (r.status !== 0) throw new Error(`Extraction failed:\n${r.out}`);
      const toggle = JSON.parse(
        readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-keyof/contracts/toggle.contract.json'), 'utf8'),
      );
      const tone = toggle.props.find((p: any) => p.name === 'tone');
      if (tone?.type?.enum?.join('|') !== 'neutral|accent|danger' || tone.default !== 'neutral') {
        throw new Error('Toggle.tone: keyof-interface enum (or its destructure default) not extracted');
      }
      if (toggle.props.find((p: any) => p.name === 'pace')?.type?.enum?.join('|') !== 'slow|fast') {
        throw new Error('Toggle.pace: keyof typeof factory-call object not resolved');
      }
      if (toggle.props.find((p: any) => p.name === 'density')?.type?.enum?.join('|') !== 'compact|cozy') {
        throw new Error('Toggle.density: keyof typeof as-const object not resolved');
      }
      const notes = readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-keyof/proposals.md'), 'utf8');
      if (!notes.includes('key-preserving factory ASSUMED')) {
        throw new Error('Factory-call key read not receipted as an assumption');
      }
      if (!notes.includes('`flavor`: keyof value set NOT carried') || !notes.includes('importedFlavors')) {
        throw new Error('Unresolvable keyof target not refused BY NAME');
      }
      // HERITAGE RECEIPT (found by the Astryx .doc.mjs referee): an
      // interface WITH own members must still name its unread parents.
      if (!notes.includes('extends BasePropsLike<HTMLButtonElement>') || !notes.includes('NOT carried')) {
        throw new Error('Heritage of an interface WITH own members not receipted');
      }
    },
  },
  {
    // ASTRYX ROUND fix #2 (UNION-OF-REFS RULE — recovers 7 of Astryx's 21
    // named skips incl. Slider; the mutually-exclusive-API sibling of
    // gauntlet fix #3): same-file `A | B` props types merge the members of
    // every readable branch (heritage chased through the same-file chain),
    // force branch-specific members optional, receipt the merge — and a
    // union with an IMPORTED branch carries the readable branch while
    // receipting the dark one by name.
    id: 'union-of-refs-composition',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/run.ts', 'code', 'extract/fixtures/foreign-keyof.config.json']);
      if (r.status !== 0) throw new Error(`Extraction failed:\n${r.out}`);
      const range = JSON.parse(
        readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-keyof/contracts/range.contract.json'), 'utf8'),
      );
      if (range.props.find((p: any) => p.name === 'tone')?.type?.enum?.join('|') !== 'quiet|loud') {
        throw new Error('Range.tone: shared-base member not carried through union branch heritage');
      }
      if (range.props.find((p: any) => p.name === 'min')?.type !== 'number') {
        throw new Error('Range.min: base member missing from the merged union surface');
      }
      const legend = range.props.find((p: any) => p.name === 'legend');
      if (!legend || legend.required === true) {
        throw new Error('Range.legend: branch-specific required member must merge as OPTIONAL');
      }
      const notes = readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-keyof/proposals.md'), 'utf8');
      if (!notes.includes('UNION of alternatives [RangeSingleProps | RangeDualProps]')) {
        throw new Error('Union merge not receipted');
      }
      const fork = JSON.parse(
        readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-keyof/contracts/fork.contract.json'), 'utf8'),
      );
      if (fork.props.find((p: any) => p.name === 'prong')?.type?.enum?.join('|') !== 'left|right') {
        throw new Error('Fork.prong: readable union branch not carried alongside a dark branch');
      }
      if (!notes.includes('[ImportedForkProps]') || !notes.includes('NOT carried')) {
        throw new Error('Dark union branch not receipted BY NAME');
      }
    },
  },
  {
    // Enterprise gauntlet fix #4: published CEM manifests ship events
    // WITHOUT a name (SWC ships 7) — extract/adapters/cem.ts:82 used to
    // crash with a TypeError. A nameless event must become a NAMED per-event
    // skip while the component and its named events keep extracting.
    id: 'cem-nameless-event-skip',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/run.ts', 'code', 'extract/fixtures/foreign-wc-nameless.config.json']);
      if (r.status !== 0) throw new Error(`Nameless-event manifest crashed extraction:\n${r.out}`);
      const c = JSON.parse(
        readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-wc-nameless/contracts/glass-dialog.contract.json'), 'utf8'),
      );
      if (c.props.find((p: any) => p.name === 'size')?.type?.enum?.length !== 3) {
        throw new Error('GlassDialog.size: attributes no longer extracted alongside the bad event');
      }
      if (c.events?.[0]?.bindings?.code?.prop !== 'onClose') {
        throw new Error('GlassDialog: the NAMED event gd-close was not carried');
      }
      const notes = readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-wc-nameless/proposals.md'), 'utf8');
      if (!notes.includes('GlassDialog event[0]') || !notes.includes('CEM event has no "name"')) {
        throw new Error('Nameless event not skipped BY NAME');
      }
    },
  },
  {
    // Enterprise gauntlet fix #6: none of Carbon/Fluent/Spectrum/Polaris
    // publishes DTCG, but every published shape is one MECHANICAL $value
    // wrap away — core/wrap-plain-tokens.ts. Fixture shapes mirror all four;
    // unknowns are skipped by name; already-DTCG input is refused (null).
    id: 'plain-token-wrap',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['evals/fixtures/plain-token-wrap-check.ts']);
      if (r.status !== 0 || !r.out.includes('all shapes load, all refusals named')) {
        throw new Error(`plain-token-wrap check failed:\n${r.out}`);
      }
    },
  },
  {
    // ASTRYX ROUND, token side: StyleX systems publish tokens as
    // `stylex.defineVars({…})` TypeScript source with dual-mode values
    // ENCODED IN THE VALUE as CSS `light-dark(a, b)` — a third mode
    // architecture (vs Carbon's parallel themes / Nord's parallel files).
    // core/stylex-tokens.ts must read the tables syntactically, split
    // light-dark() paren-aware into the v1.6 modes shape, and skip
    // everything unreadable BY NAME.
    id: 'stylex-token-wrap',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['evals/fixtures/stylex-tokens-check.ts']);
      if (r.status !== 0 || !r.out.includes('stylex-token-wrap ok:')) {
        throw new Error(`stylex-token-wrap check failed:\n${r.out}`);
      }
    },
  },
  {
    // HEAL ROUND, live-gauntlet class ① (fill-matrix-depth-drop): a bound
    // fill that is a function of TWO OR THREE variant axes with mixed-depth
    // token paths (CBDS Badge f(type,style), Chip f(type,style,state)) used
    // to DROP the root paint entirely — Badge diffed 96.85% masked, Chip
    // 98.58%, the kit's most-drawn primitives rendering as bare text. The
    // fix routes the named drift into the mint pass (captured-value literal
    // fidelity, per-variant leaves, axis pair/triple substituted root refs);
    // the eval replays the committed fixture slice through propose→referee→
    // all four emitters and pins the never-silent-drop invariant.
    id: 'fill-matrix-depth-mint',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['evals/fixtures/fill-matrix-mint-check.ts']);
      if (r.status !== 0 || !r.out.includes('fill-matrix-mint ok:')) {
        throw new Error(`fill-matrix-mint check failed:\n${r.out}`);
      }
    },
  },
  {
    // HEAL ROUND, live-gauntlet class ④ (linked-child-html-escaped-as-text):
    // CBDS Text Area showed literal '<div class="input-label">' INSIDE the
    // field — corrected diagnosis: the parent's inferred root element is
    // <textarea> (raw-text content model), so the BROWSER renders every
    // child tag as text; void roots hoist children out (input family
    // 48–66%), <select> drops them (Dropdown = caret only). emit-html now
    // projects such boxes to a neutral <div> with a NAMED comment. Pins the
    // projection AND the XSS invariants (child markup stays structure, leaf
    // text stays escaped, part-less native roots untouched).
    id: 'raw-text-root-projection',
    claim: 'C3-detection',
    run: () => {
      const r = run(TSX, ['evals/fixtures/raw-text-root-projection-check.ts']);
      if (r.status !== 0 || !r.out.includes('raw-text-root-projection ok:')) {
        throw new Error(`raw-text-root-projection check failed:\n${r.out}`);
      }
    },
  },
  {
    // HEAL ROUND, live-gauntlet harness class ⑦ (underscore pickSet): a
    // name-prefix convention is not a type test — visual-parity compose now
    // excludes the dump meta channels BY NAME and addresses the owner's 30
    // underscore-NAMED sets ("_Input label", "_Tab-item", …) exactly like
    // the playground receive path; the live-gauntlet clone is deleted.
    id: 'underscore-set-compose',
    claim: 'C3-detection',
    run: () => {
      const r = run(TSX, ['evals/fixtures/underscore-set-compose-check.ts']);
      if (r.status !== 0 || !r.out.includes('underscore-set-compose ok:')) {
        throw new Error(`underscore-set-compose check failed:\n${r.out}`);
      }
    },
  },
  {
    // HEAL ROUND, live-gauntlet class ③ (session-id-collision-false-cycle):
    // "RadioButton" the COMPONENT vs "Radio button" the set — both sanitize
    // to ds.radio-button; the session's newest-wins registry rebound the
    // icon's stub ref onto the later-imported parent and the referee
    // reported a cycle that is not drawn (all 12 variants refused). Fix:
    // proposal-time id claiming applies the stubIdFor contradicting-key
    // suffix discipline against SESSION-claimed ids (keys first — v1.5/v1.6
    // identity; setless stubs now carry the component key). Pins the suffix
    // + named note + zero-violation referee + same-key heal + unchanged
    // batch scope, over the committed trio fixture.
    id: 'session-id-collision-suffix',
    claim: 'C2-refusal',
    run: () => {
      const r = run(TSX, ['evals/fixtures/session-id-collision-check.ts']);
      if (r.status !== 0 || !r.out.includes('session-id-collision ok:')) {
        throw new Error(`session-id-collision check failed:\n${r.out}`);
      }
    },
  },
  {
    // HEAL ROUND, live-gauntlet class ⑤ (linked-icon-wrapper-collapses):
    // linking must never render worse than stubbing. The CBDS Icon wrapper
    // (slot-only root, drawn FIXED box: height + max-width bindings)
    // rendered ZERO-SIZE when its slot was empty — min-width: fit-content
    // is 0 without content — and Icon Button collapsed to a 16×48 pill
    // (54.7–63.4% masked, 180 rows). Every root max-width now mirrors onto
    // min-width for such wrappers (the stub discipline's observed-geometry
    // floor); fluid slot containers (no height binding — List/Toast/
    // Toolbar) keep fit-content, so repo output is untouched.
    id: 'slot-wrapper-floor',
    claim: 'C3-detection',
    run: () => {
      const r = run(TSX, ['evals/fixtures/slot-wrapper-floor-check.ts']);
      if (r.status !== 0 || !r.out.includes('slot-wrapper-floor ok:')) {
        throw new Error(`slot-wrapper-floor check failed:\n${r.out}`);
      }
    },
  },
  {
    // A2 layout grammar (grid): the canonical bento (conformance
    // grid-bento-span-matrix — the P8 live carriage receipt) proven headlessly
    // end to end: pinned-grammar contract → byte-deterministic .figma.js →
    // strict-mock execution (the mock enforces the real API's grid refusals:
    // count-before-sizes, place-before-span occupancy, align enum fence,
    // P9/P10 hazards) → every track/anchor/span/gap fact read back EXACTLY,
    // plus the G7 fence refusing by name at the schema.
    id: 'grid-bento-carriage',
    claim: 'C1-determinism',
    run: () => {
      const r = run(TSX, ['evals/fixtures/grid-bento-check.ts']);
      if (r.status !== 0 || !r.out.includes('grid-bento ok:')) {
        throw new Error(`grid-bento check failed:\n${r.out}`);
      }
    },
  },
  {
    // TASK #37, the owner's live canvas ("the buttons are messed up"). A ROOT's
    // max-width was baked as a FIXED width — the molecule round bound the real
    // Figma `maxWidth` ceiling for PARTS but exempted roots by name — so
    // Carbon's Button, which is `inline-size: max-content; max-inline-size:
    // 20rem`, drew a 320px box with its label stranded at the left by its own
    // `justify: space-between`. The control was in the same paste: the SAME
    // button nested in Modal's footer hugged at 125px, because a nested part
    // got the ceiling.
    //
    // The discriminator is a MEASUREMENT carried on the contract, not a list:
    // extract/computed records `hugsBelowMaxWidth` when the captured used width
    // stayed strictly below the cap in every combo. The fixture pins BOTH
    // halves on one synthetic contract — evidence-free roots keep the
    // design-width lowering (what the 21 hand-authored `{size.card.width}`
    // roots in contracts/ depend on), measured-hugging roots bind a ceiling and
    // build narrower — plus the by-name refusal of a flag that qualifies
    // nothing, and the shipped Carbon Button actually carrying the fact.
    id: 'hug-ceiling',
    claim: 'C3-detection',
    run: () => {
      // examples/ is not staged into SCRATCH (see resetScratch) — the fixture
      // takes the shipped Carbon contract by ABSOLUTE path from the real repo.
      const r = run(TSX, [
        'evals/fixtures/hug-ceiling-check.ts',
        '--carbon', path.join(ROOT, 'examples', 'carbon', 'contracts', 'button.contract.json'),
      ]);
      if (r.status !== 0 || !r.out.includes('hug-ceiling ok:')) {
        throw new Error(`hug-ceiling check failed:\n${r.out}`);
      }
    },
  },
  {
    // Red-team (2026-07-08): these five drift classes previously passed
    // "parity clean" — boolean/text defaults on the canvas were
    // presence-only, numeric code defaults were invisible to extraction,
    // a DELETED code default was accepted, and property KIND changes on
    // either surface were never compared.
    id: 'detect-default-and-kind-drift',
    claim: 'C3-detection',
    run: () => {
      const check = (label: string, surface: string, cls: string, subject: string, mutate: () => void, restore: () => void) => {
        mutate();
        const r = parity();
        try {
          if (r.status === 0) throw new Error(`${label}: NOT detected`);
          expectFinding(readReport(), surface, cls, subject);
        } finally { restore(); }
      };
      const figmaSnap = readFileSync(path.join(SCRATCH, FIGMA_COMPONENTS), 'utf8');
      check('figma boolean default flip', 'figma', 'mismatch', 'Button.Loading (default)',
        () => editJson(FIGMA_COMPONENTS, (snap) => {
          const btn = snap.sets.find((x: any) => x.name === 'Button');
          const key = Object.keys(btn.properties).find((k: string) => k.startsWith('Loading'))!;
          btn.properties[key].defaultValue = true;
        }),
        () => writeFileSync(path.join(SCRATCH, FIGMA_COMPONENTS), figmaSnap));
      check('figma text default change', 'figma', 'mismatch', 'Button.Label (default)',
        () => editJson(FIGMA_COMPONENTS, (snap) => {
          const btn = snap.sets.find((x: any) => x.name === 'Button');
          const key = Object.keys(btn.properties).find((k: string) => k.startsWith('Label'))!;
          btn.properties[key].defaultValue = 'TOTALLY DIFFERENT';
        }),
        () => writeFileSync(path.join(SCRATCH, FIGMA_COMPONENTS), figmaSnap));
      check('figma property kind change', 'figma', 'mismatch', 'Button.Loading (kind)',
        () => editJson(FIGMA_COMPONENTS, (snap) => {
          const btn = snap.sets.find((x: any) => x.name === 'Button');
          const key = Object.keys(btn.properties).find((k: string) => k.startsWith('Loading'))!;
          btn.properties[key].type = 'TEXT';
        }),
        () => writeFileSync(path.join(SCRATCH, FIGMA_COMPONENTS), figmaSnap));
      const sliderSrc = readFileSync(path.join(SCRATCH, 'src/components/Slider/Slider.tsx'), 'utf8');
      check('numeric code default drift', 'code', 'mismatch', 'Slider.value (default)',
        () => replaceInFile('src/components/Slider/Slider.tsx', 'value = 40,', 'value = 99,'),
        () => writeFileSync(path.join(SCRATCH, 'src/components/Slider/Slider.tsx'), sliderSrc));
      const btnSrc = readFileSync(path.join(SCRATCH, BTN_TSX), 'utf8');
      check('deleted code default', 'code', 'mismatch', 'Button.size (default)',
        () => replaceInFile(BTN_TSX, "size = 'md',", 'size,'),
        () => writeFileSync(path.join(SCRATCH, BTN_TSX), btnSrc));
    },
  },
  {
    // Red-team (2026-07-08): run-2-vs-run-1 determinism is true of broken
    // generators too. The golden manifest pins generator OUTPUT — mutants
    // that mirror alignment or drop the focus ring now fail here.
    id: 'golden-generated-output',
    claim: 'C1-determinism',
    run: () => {
      if (buildTokens().status !== 0 || generate().status !== 0) throw new Error('Build failed');
      if (run(TSX, ['scripts/generate-figma.ts']).status !== 0) throw new Error('figma:plan failed');
      const golden: Record<string, string> = JSON.parse(
        readFileSync(path.join(SCRATCH, 'evals', 'golden.json'), 'utf8'),
      );
      const bad: string[] = [];
      for (const [rel, hash] of Object.entries(golden)) {
        let actual = '';
        try {
          actual = createHash('sha256').update(readFileSync(path.join(SCRATCH, rel))).digest('hex');
        } catch { bad.push(`${rel}: MISSING`); continue; }
        if (actual !== hash) bad.push(rel);
      }
      if (bad.length > 0) {
        throw new Error(`Generated output diverges from golden manifest (${bad.length} file[s]): ${bad.slice(0, 5).join(', ')} — if intentional, npm run golden:update in a reviewed change`);
      }
    },
  },
  {
    // N-axis variant support (2026-07-08): every enum prop is a variant axis.
    id: 'naxis-full-cartesian-product',
    claim: 'C1-determinism',
    run: () => {
      cpSync(path.join(ROOT, 'evals', 'fixtures', 'four-axis.contract.json'),
        path.join(SCRATCH, 'contracts', 'four-axis.contract.json'));
      let r = generate();
      if (r.status !== 0) throw new Error(`4-axis contract refused:\n${r.out.slice(0, 600)}`);
      r = run(TSX, ['scripts/generate-figma.ts']);
      if (r.status !== 0) throw new Error(`figma:plan failed with 4-axis contract:\n${r.out.slice(0, 600)}`);
      const syncDir = path.join(SCRATCH, 'figma-sync');
      const parseVariants = (file: string) =>
        parseSyncComponent(readFileSync(path.join(syncDir, file), 'utf8')).variants;
      const v = parseVariants(readdirSync(syncDir).find((f) => /^\d+-fouraxis\.js$/.test(f))!);
      if (v.length !== 36) throw new Error(`Expected 36 variants (3×3×2×2), got ${v.length}`);
      if (v[0].name !== 'Variant=Primary, Size=Medium, Emphasis=Medium, Icon Position=Start')
        throw new Error(`All-defaults combo must be FIRST: "${v[0].name}"`);
      if (v.some((x: any) => x.name.split(', ').length !== 4))
        throw new Error('A variant name is missing an axis segment');
      const rowsN = Math.max(...v.map((x: any) => x.row)) + 1;
      const colsN = Math.max(...v.map((x: any) => x.col)) + 1;
      if (rowsN !== 3 || colsN !== 12) throw new Error(`Grid must be 3×12; got ${rowsN}×${colsN}`);
      const nd = v.find((x: any) => x.name === 'Variant=Danger, Size=Large, Emphasis=Semibold, Icon Position=End');
      if (nd.spec.fill !== 'color/action/danger/background' || nd.spec.bindings.paddingLeft !== 'space/inset-x/lg')
        throw new Error('Per-axis {prop} token substitution did not resolve');
      const bv = parseVariants(readdirSync(syncDir).find((f) => /^\d+-button\.js$/.test(f))!);
      if (bv[0].name !== 'Variant=Primary, Size=Medium' || bv.length !== 12)
        throw new Error(`2-axis names changed ("${bv[0].name}") — amend reconciles BY NAME`);
      rmSync(path.join(SCRATCH, 'contracts', 'four-axis.contract.json'));
    },
  },
  {
    id: 'detect-snapshot-provenance-mismatch',
    claim: 'C3-detection',
    run: () => {
      editJson(FIGMA_COMPONENTS, (s2) => { s2.fileKey = 'WRONG_FILE_KEY'; });
      const r = parity();
      if (r.status !== 1) throw new Error('Foreign-file snapshot passed parity');
      const f = readReport().find((x) => x.subject === 'snapshot-provenance');
      if (!f || f.surface !== 'figma' || f.classification !== 'mismatch')
        throw new Error(`Expected [figma mismatch] snapshot-provenance; got: ${JSON.stringify(f)}`);
    },
  },
  {
    id: 'detect-stale-snapshot',
    claim: 'C3-detection',
    run: () => {
      // This case TESTS the staleness gate, so it pins the threshold back to
      // 14 explicitly (the hermetic-clock default in run() disables the gate
      // for every OTHER case — their claims are about differ logic, not
      // today's date; this one's claim IS the clock).
      editJson(FIGMA_COMPONENTS, (s2) => { s2.extractedAt = Date.now() - 15 * 86_400_000; });
      process.env.MAX_SNAPSHOT_AGE_DAYS = '14';
      try {
        const r = parity();
        if (r.status !== 1) throw new Error('15-day-old snapshot passed the 14-day staleness gate');
        if (!readReport().some((x) => x.subject === 'snapshot-stale'))
          throw new Error('Expected snapshot-stale finding');
        // First-run softener (beta-tester packet): when snapshot-stale is the
        // ONLY active finding class — exactly the fresh-clone state — the
        // output must say so, so a first-time tester can tell "the staleness
        // gate is working" from "the components drifted".
        if (!r.out.includes('expected on a fresh clone'))
          throw new Error(`stale-only red did not print the fresh-clone note:\n${r.out}`);
        // FALSIFICATION: mix in a NON-stale finding (foreign fileKey) and the
        // note must vanish — it may never launder real drift as clone noise.
        editJson(FIGMA_COMPONENTS, (s2) => { s2.fileKey = 'WRONG_FILE_KEY'; });
        const r2 = parity();
        if (r2.status !== 1) throw new Error('mixed stale+provenance findings passed parity');
        if (!readReport().some((x) => x.subject === 'snapshot-provenance'))
          throw new Error('Expected snapshot-provenance finding in the mixed run');
        if (r2.out.includes('expected on a fresh clone'))
          throw new Error('the fresh-clone note printed over a mix that includes REAL drift findings');
      } finally {
        delete process.env.MAX_SNAPSHOT_AGE_DAYS;
      }
    },
  },
  {
    id: 'baseline-acknowledges-without-failing',
    claim: 'C3-detection',
    run: () => {
      editJson(FIGMA_COMPONENTS, (s2) => { s2.fileKey = 'WRONG_FILE_KEY'; });
      // Merge with the repo baseline rather than replacing it — the claim under
      // test is "a baselined finding stops failing the exit code", which must
      // hold regardless of what in-flight drift the repo already acknowledges.
      let existing = [];
      try { existing = JSON.parse(readFileSync(path.join(SCRATCH, 'parity', 'baseline.json'), 'utf8')); } catch { /* none */ }
      writeFileSync(path.join(SCRATCH, 'parity', 'baseline.json'),
        JSON.stringify([...existing, 'figma|mismatch|snapshot-provenance']) + '\n');
      const r = parity();
      if (r.status !== 0) throw new Error('Baselined finding still failed the exit code');
      const report = JSON.parse(readFileSync(path.join(SCRATCH, 'parity', 'report.json'), 'utf8'));
      if (!report.acknowledged?.some((f: { subject: string }) => f.subject === 'snapshot-provenance') || report.findings.length !== 0)
        throw new Error('Baselined finding not routed to acknowledged');
    },
  },
  {
    // v6 events: a contract-declared event callback is API surface — an
    // engineer deleting onToggle from the code must surface as code BEHIND.
    id: 'detect-code-removed-event',
    claim: 'C3-detection',
    run: () => {
      replaceInFile(
        'src/components/AccordionItem/AccordionItem.tsx',
        /\s*\/\*\* Fires when the trigger is activated[^*]*\*\/\n\s*onToggle\?: \(\) => void;/,
        '',
      );
      if (parity().status === 0) throw new Error('Drift not detected');
      expectFinding(readReport(), 'code', 'behind', 'AccordionItem.onToggle');
    },
  },
  {
    id: 'refuse-defaultContent-outside-accepts',
    claim: 'C2-refusal',
    run: () => {
      replaceInFile(
        'contracts/table.contract.json',
        '"defaultContent": [\n              {\n                "id": "ds.table-row"\n              },',
        '"defaultContent": [\n              {\n                "id": "ds.badge"\n              },',
      );
      const r = generate();
      if (r.status === 0) throw new Error('Generator accepted defaultContent outside accepts');
      if (!r.out.includes('not in accepts')) throw new Error('Violation not named');
    },
  },
  {
    id: 'detect-figma-missing-multislot-content',
    claim: 'C3-detection',
    run: () => {
      editJson(FIGMA_COMPONENTS, (s) => {
        const table = s.sets.find((x: any) => x.name === 'Table');
        table.nestedInstances = table.nestedInstances.filter((n: string) => n !== 'TableRow');
      });
      if (parity().status === 0) throw new Error('Drift not detected');
      expectFinding(readReport(), 'figma', 'behind', 'Table.TableRow');
    },
  },
  {
    id: 'judge-passes-canonical-screen',
    claim: 'C3-detection',
    run: () => {
      const r = run(TSX, ['parity/judge.ts', 'evals/fixtures/good-screen.tsx']);
      if (r.status !== 0) throw new Error(`Judge failed the canonical screen:\n${r.out}`);
    },
  },
  {
    id: 'judge-catches-all-violation-classes',
    claim: 'C3-detection',
    run: () => {
      const r = run(TSX, ['parity/judge.ts', 'evals/fixtures/bad-screen.tsx', '--json', 'judge-out.json']);
      if (r.status === 0) throw new Error('Judge passed a screen seeded with violations');
      const report = JSON.parse(readFileSync(path.join(SCRATCH, 'judge-out.json'), 'utf8')).reports[0];
      const rules = new Set(report.violations.map((v: { rule: string }) => v.rule));
      for (const expected of [
        'components-from-catalog',
        'no-raw-equivalents',
        'no-style-overrides',
        'tokens-only',
        'one-primary-action',
      ]) {
        if (!rules.has(expected)) throw new Error(`Judge missed violation class: ${expected}`);
      }
    },
  },
  {
    id: 'promotion-converges',
    claim: 'C4-convergence',
    run: () => {
      // 1. Code drifts ahead.
      replaceInFile(BTN_TSX, 'loading?: boolean;', "loading?: boolean;\n  iconOnly?: boolean;");
      replaceInFile(BTN_TSX, "loading = false,", "loading = false,\n    iconOnly = false,");
      if (parity().status === 0) throw new Error('Drift not detected');
      const patch = expectFinding(readReport(), 'code', 'ahead', 'Button.iconOnly').proposedPatch;
      if (!patch) throw new Error('No promotion patch proposed');
      // 2. Promote: apply the differ's own patch to the contract.
      editJson(CONTRACT, (c) => {
        c.props.push(patch);
        c.version = '1.2.0';
      });
      // 3. Regenerate code from the amended contract.
      if (generate().status !== 0) throw new Error('Regeneration after promotion failed');
      // 4. Converged: no code findings remain; the ONLY finding is the correct
      //    next step — Figma is now behind (needs the IconOnly property).
      parity();
      const after = readReport();
      if (after.some((f) => f.surface === 'code'))
        throw new Error(`Code findings remain: ${JSON.stringify(after)}`);
      expectFinding(after, 'figma', 'behind', 'Button.IconOnly');
      if (after.length !== 1) throw new Error(`Unexpected extra findings: ${JSON.stringify(after)}`);
    },
  },
  {
    // v7 elementByProp: partial maps and unknown elements must be refused by name.
    id: 'refuse-elementByProp-gaps',
    claim: 'C2-refusal',
    run: () => {
      editJson('contracts/heading.contract.json', (c) => { delete c.semantics.elementByProp.map['6']; });
      let r = generate();
      if (r.status === 0 || !r.out.includes('elementByProp map is missing enum value "6"')) throw new Error('Partial map not refused by name');
      editJson('contracts/heading.contract.json', (c) => { c.semantics.elementByProp.map['6'] = 'marquee'; });
      r = generate();
      if (r.status === 0 || !r.out.includes('unknown element "marquee"')) throw new Error('Unknown element not refused by name');
    },
  },
  {
    // v7 layoutByProp: the ChatMessage sender flip must land on BOTH surfaces —
    // reversed CSS in code, reversed compiled child order on the canvas.
    id: 'layoutByProp-flip-both-surfaces',
    claim: 'C1-determinism',
    run: () => {
      generate();
      const css = readFileSync(path.join(SCRATCH, 'src/components/ChatMessage/ChatMessage.module.css'), 'utf8');
      if (!/\.sender-user \{\n  flex-direction: row-reverse;/.test(css)) throw new Error('root flip rule missing');
      if (!/\.sender-user \.body \{\n  align-items: flex-end;/.test(css)) throw new Error('body override rule missing');
      run(TSX, ['scripts/generate-figma.ts']);
      const f = readdirSync(path.join(SCRATCH, 'figma-sync')).find((n) => /-chatmessage\.js$/.test(n))!;
      const variants = parseSyncComponent(readFileSync(path.join(SCRATCH, 'figma-sync', f), 'utf8')).variants;
      const user = variants.find((v: any) => v.name.includes('Sender=User'));
      if (user.spec.children.map((c: any) => c.name).join(',') !== 'body,avatarSlot') throw new Error('canvas child order not reversed per variant');
    },
  },
  {
    // v7 stylesWhen: non-whitelisted properties and token-shaped values refused by name.
    id: 'refuse-stylesWhen-outside-whitelist',
    claim: 'C2-refusal',
    run: () => {
      editJson('contracts/text-field.contract.json', (c) => { c.anatomy.root.stylesWhen[0].styles['background-color'] = 'red'; });
      let r = generate();
      if (r.status === 0 || !r.out.includes('not in the literal whitelist')) throw new Error('Non-whitelisted property not refused by name');
      editJson('contracts/text-field.contract.json', (c) => {
        delete c.anatomy.root.stylesWhen[0].styles['background-color'];
        c.anatomy.root.stylesWhen[0].styles.opacity = '{opacity.disabled}';
      });
      r = generate();
      if (r.status === 0 || !r.out.includes('looks like a token reference')) throw new Error('Token-shaped value not refused by name');
    },
  },
  {
    // v7 overlay: an out-of-flow part claiming in-flow growth is a contradiction.
    id: 'refuse-overlay-inflow-conflicts',
    claim: 'C2-refusal',
    run: () => {
      editJson('contracts/banner.contract.json', (c) => { c.anatomy.root.parts.endArea.overlay = { placement: 'bottom' }; c.anatomy.root.parts.endArea.layout = { grow: true }; });
      const r = generate();
      if (r.status === 0 || !r.out.includes('cannot also grow')) throw new Error('overlay+grow not refused by name');
    },
  },
  {
    // v7 arrayOf/kind NONE: code-only structured props must be skipped by every
    // design-side consumer and never reported as drift; scalar NONE refused.
    id: 'array-prop-code-only-skipped-everywhere',
    claim: 'C3-detection',
    run: () => {
      cpSync(path.join(ROOT, 'evals', 'fixtures', 'array-prop.contract.json'), path.join(SCRATCH, 'contracts', 'array-prop.contract.json'));
      editJson('contracts/array-prop.contract.json', (c) => { c.$schema = './contract.schema.json'; });
      if (generate().status !== 0) throw new Error('arrayOf fixture failed to generate');
      const tsx = readFileSync(path.join(SCRATCH, 'src/components/CrumbTrail/CrumbTrail.tsx'), 'utf8');
      if (!tsx.includes('items?: Array<{ label: string; href: string; isCurrent: boolean }>')) throw new Error('array TS type not emitted');
      if (/\bitems =/.test(tsx)) throw new Error('array prop must have no default destructure');
      run(TSX, ['scripts/generate-figma.ts']);
      const f = readdirSync(path.join(SCRATCH, 'figma-sync')).find((n) => n.includes('crumbtrail'))!;
      const script = readFileSync(path.join(SCRATCH, 'figma-sync', f), 'utf8');
      if ((parseSyncComponent(script).textProps ?? []).length !== 0) throw new Error('NONE prop leaked onto the canvas');
      parity();
      const report = JSON.parse(readFileSync(path.join(SCRATCH, 'parity', 'report.json'), 'utf8'));
      if (report.findings.some((x: any) => x.subject.startsWith('CrumbTrail.'))) throw new Error('NONE prop reported as drift');
      editJson('contracts/array-prop.contract.json', (c) => { c.props[1].type = 'text'; });
      const r = generate();
      // ROUND 3 widened the NONE-binding rule: code-only is legal for arrayOf
      // props AND for text props promoted from raw per-instance character
      // overrides — the latter only WITH a string default, because that
      // default is the only record of what the canvas draws. A scalar NONE
      // is therefore still refused BY NAME; this fixture (type flipped to
      // `text`, no default) now trips the more precise second rule, so the
      // pin accepts either refusal wording and still requires the prop name.
      const refusedByName =
        r.out.includes('but is not an arrayOf prop') ||
        (r.out.includes('binds figma kind "NONE"') && r.out.includes('declares no string default'));
      if (r.status === 0 || !refusedByName || !r.out.includes('"items"')) {
        throw new Error('scalar NONE not refused by name');
      }
      rmSync(path.join(SCRATCH, 'contracts', 'array-prop.contract.json'));
    },
  },
  {
    // Pending-first-sync: null anchors are workflow state, not drift; anchored
    // but missing stays a hard BEHIND.
    id: 'pending-first-sync-not-drift',
    claim: 'C3-detection',
    run: () => {
      // Induce the never-synced state: null anchors + no set in the snapshot.
      editJson('contracts/heading.contract.json', (c) => { c.anchors.figma.componentSetKey = null; c.anchors.figma.nodeId = null; });
      editJson(FIGMA_COMPONENTS, (s2) => { s2.sets = s2.sets.filter((x: any) => x.name !== 'Heading'); });
      if (parity().status !== 0) throw new Error('never-synced contract failed parity');
      const report = JSON.parse(readFileSync(path.join(SCRATCH, 'parity', 'report.json'), 'utf8'));
      if (!report.pending?.some((p: any) => p.subject === 'Heading')) throw new Error('Heading not routed to pending');
      editJson('contracts/heading.contract.json', (c) => { c.anchors.figma.componentSetKey = 'deadbeef'; });
      if (parity().status === 0) throw new Error('ANCHORED missing set must stay a hard BEHIND');
      expectFinding(readReport(), 'figma', 'behind', 'Heading');
    },
  },
  {
    // figmaStatePreviews (v8): the opt-in must be refused by name when hollow.
    id: 'refuse-hollow-state-previews',
    claim: 'C2-refusal',
    run: () => {
      const pristine = readFileSync(path.join(SCRATCH, CONTRACT), 'utf8');
      editJson(CONTRACT, (c) => { c.states = []; delete c.anatomy.root.states; });
      let r = generate();
      writeFileSync(path.join(SCRATCH, CONTRACT), pristine);
      if (r.status === 0 || !r.out.includes('declares no interaction states'))
        throw new Error('previews without states not refused by name');
      editJson(CONTRACT, (c) => { c.anatomy.root.states = { hover: c.anatomy.root.states.hover }; });
      r = generate();
      writeFileSync(path.join(SCRATCH, CONTRACT), pristine);
      if (r.status === 0 || !r.out.includes('state "focus-visible" declares no token overrides'))
        throw new Error('override-less state not refused by name');
    },
  },
  {
    // State previews multiply ONLY the primary enum axis; overrides land on
    // the compiled specs; the base cartesian stays the pure enum API.
    id: 'state-previews-bounded-canvas-only',
    claim: 'C1-determinism',
    run: () => {
      if (buildTokens().status !== 0 || generate().status !== 0) throw new Error('Build failed');
      if (run(TSX, ['scripts/generate-figma.ts']).status !== 0) throw new Error('figma:plan failed');
      const f = readdirSync(path.join(SCRATCH, 'figma-sync')).find((n) => /^\d+-button\.js$/.test(n))!;
      const script = readFileSync(path.join(SCRATCH, 'figma-sync', f), 'utf8');
      const base = parseSyncComponent(script).variants;
      if (base.length !== 12 || base[0].name !== 'Variant=Primary, Size=Medium')
        throw new Error('Base cartesian must stay the pure enum API (previews ride a separate overlay)');
      const sv = parseSyncComponent(script).stateVariants ?? [];
      if (sv.length !== 12) throw new Error(`Expected 12 previews (4 variants × 3 states, Size at default), got ${sv.length}`);
      const hover = sv.find((v: any) => v.name === 'Variant=Danger, Size=Medium, State=Hover');
      if (hover?.spec.fill !== 'color/action/danger/background-hover')
        throw new Error(`Hover preview must bind the state override token, got ${hover?.spec.fill}`);
      const disabled = sv.find((v: any) => v.name === 'Variant=Primary, Size=Medium, State=Disabled');
      // LITERAL node opacity, never a bound variable: Figma's opacity field is
      // percent-scaled (0-100), so binding the 0-1 token (opacity.disabled=0.5)
      // rendered the synced Disabled preview at 0.5% — near-invisible white
      // (visual-parity receipt, Button State=Disabled 93.91% masked).
      if (disabled?.spec.opacity !== 0.5)
        throw new Error(`Disabled preview must carry literal node opacity 0.5 (the token's resolved value), got ${disabled?.spec.opacity}`);
      if (disabled?.spec.bindings?.opacity !== undefined)
        throw new Error('Disabled preview must NOT bind a 0-1 opacity variable (Figma reads the field as percent — renders ~0%)');
      if (!script.includes('node.opacity = spec.opacity'))
        throw new Error('node-opacity runtime line missing — the literal never reaches the node');
      if (sv.some((v: any) => v.name.includes('Size=Small') || v.name.includes('Size=Large')))
        throw new Error('Explosion not bounded — a preview multiplied a non-primary axis');
      if (!script.includes('withStateAxis')) throw new Error('runtime merge helper missing');
    },
  },
  {
    // PROTOTYPE WIRING: the State preview axis carries LIVE behavior. The
    // emitted script must name every wire (source variant, trigger,
    // destination variant) deterministically, in the CANONICAL [hover,
    // active] order regardless of how the contract declares states — and it
    // must EXCLUDE focus-visible/disabled BY NAME, because Figma's Trigger
    // union has no focus or disabled trigger to wire them to.
    id: 'state-reactions-wired-deterministically',
    claim: 'C1-determinism',
    run: () => {
      // Declare `active` FIRST and `hover` LAST — the emission order must NOT
      // follow the contract's array order (MUI and Polaris Button declare
      // different orders for identical semantics; same semantics, same bytes).
      editJson(CONTRACT, (c) => {
        c.states = ['active', 'focus-visible', 'disabled', 'hover'];
        c.anatomy.root.states.active = { 'background-color': '{color.action.{variant}.background-hover}' };
      });
      if (buildTokens().status !== 0 || generate().status !== 0) throw new Error('Build failed');
      if (run(TSX, ['scripts/generate-figma.ts']).status !== 0) throw new Error('figma:plan failed');
      const f = readdirSync(path.join(SCRATCH, 'figma-sync')).find((n) => /^\d+-button\.js$/.test(n))!;
      const script = readFileSync(path.join(SCRATCH, 'figma-sync', f), 'utf8');
      const C = parseSyncComponent(script);
      const wires: Array<{ from: string; trigger: string; to: string }> = C.stateReactions ?? [];
      const previewNames = new Set((C.stateVariants ?? []).map((v: any) => v.name));

      // 4 primary-axis values (Variant) × 2 wired states = 8 wires.
      if (wires.length !== 8) {
        throw new Error(`Expected 8 wires (4 Variant values × [hover, active]), got ${wires.length}`);
      }
      // CANONICAL ORDER: every source's pair is [ON_HOVER, ON_PRESS] — the
      // contract declared active before hover, and it must not matter.
      for (let i = 0; i < wires.length; i += 2) {
        if (wires[i].trigger !== 'ON_HOVER' || wires[i + 1].trigger !== 'ON_PRESS') {
          throw new Error(`Canonical order broken at ${i}: ${wires[i].trigger}, ${wires[i + 1].trigger} (contract order must not leak)`);
        }
        if (wires[i].from !== wires[i + 1].from) throw new Error('Wires are not grouped by source variant');
      }
      // Sources are State=Default variants; destinations are real preview
      // variants differing ONLY in the State= segment.
      for (const w of wires) {
        if (!w.from.endsWith(', State=Default')) throw new Error(`Source is not a State=Default variant: ${w.from}`);
        if (!previewNames.has(w.to)) throw new Error(`Destination is not an emitted preview variant: ${w.to}`);
        const axis = w.from.slice(0, -', State=Default'.length);
        const wantLabel = w.trigger === 'ON_HOVER' ? 'Hover' : 'Active';
        if (w.to !== `${axis}, State=${wantLabel}`) {
          throw new Error(`Destination must differ ONLY in State=: ${w.from} → ${w.to}`);
        }
      }
      // EXCLUDED BY NAME — positively asserted: the two states Figma has no
      // trigger for are emitted as previews but are destinations of NOTHING.
      const tos = new Set(wires.map((w) => w.to));
      for (const label of ['Focus Visible', 'Disabled']) {
        if (![...previewNames].some((n: any) => n.endsWith(`, State=${label}`))) {
          throw new Error(`State=${label} preview missing — the exclusion pin has nothing to assert against`);
        }
        if ([...tos].some((n) => n.endsWith(`, State=${label}`))) {
          throw new Error(`State=${label} must be the destination of NOTHING (no Figma trigger exists — preview-only)`);
        }
      }
      // Off-default-axis base variants are NOT wired (previews pin non-primary
      // axes to values[0]) — a named coverage limit, receipted by omission.
      if (wires.some((w) => !w.from.includes('Size=Medium'))) {
        throw new Error('A wire escaped the default plane — the coverage limit is not holding');
      }
      // Runtime shape: the async setter, never plain assignment; CHANGE_TO
      // with a null transition (durations are not contract facts).
      if (!script.includes('await child.setReactionsAsync(want)')) throw new Error('setReactionsAsync call missing from the runtime');
      const codeLines = script.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
      if (codeLines.some((l) => /\.reactions\s*=[^=]/.test(l))) {
        throw new Error('Plain assignment to node.reactions — read-only under documentAccess: dynamic-page');
      }
      if (!script.includes(`navigation: 'CHANGE_TO', transition: null`)) {
        throw new Error('Action must be CHANGE_TO with transition: null');
      }
      if (!script.includes(`return 'v6:' + String(h);`)) throw new Error('Fingerprint must be v6 (binding-aware)');

      // A NON-OPTED contract carries no stateReactions field at all — the
      // omit-when-empty rule that keeps its specHash stable.
      const af = readdirSync(path.join(SCRATCH, 'figma-sync')).find((n) => /^\d+-avatar\.js$/.test(n))!;
      const avatar = parseSyncComponent(readFileSync(path.join(SCRATCH, 'figma-sync', af), 'utf8'));
      if ('stateReactions' in avatar) throw new Error('Non-opted contract must OMIT stateReactions entirely');

      // The MOCK must refuse like real Figma, or the failure classes pass
      // headlessly: (a) plain assignment throws, (b) a CHANGE_TO destination
      // outside the source's own component set refuses BY NAME.
      const probe = path.join(SCRATCH, 'reaction-refusal-probe.mjs');
      writeFileSync(probe, `
import { createFigmaMock } from './scripts/plugin-engine-mock-figma.mjs';
const { figma, firstPage } = createFigmaMock();
const mk = (setName, variantName) => {
  const c = figma.createComponent(); c.name = variantName;
  const s = figma.combineAsVariants([c], firstPage); s.name = setName;
  return c;
};
const a = mk('A', 'State=Default');
const b = mk('B', 'State=Hover');
const sib = figma.createComponent(); sib.name = 'State=Hover'; a.parent.appendChild(sib);
let assign = 'NO THROW';
try { a.reactions = []; } catch (e) { assign = e.message; }
let cross = 'NO THROW';
try {
  await a.setReactionsAsync([{ trigger: { type: 'ON_HOVER' }, actions: [{ type: 'NODE', destinationId: b.id, navigation: 'CHANGE_TO', transition: null }] }]);
} catch (e) { cross = e.message; }
await a.setReactionsAsync([{ trigger: { type: 'ON_HOVER' }, actions: [{ type: 'NODE', destinationId: sib.id, navigation: 'CHANGE_TO', transition: null }] }]);
console.log(JSON.stringify({ assign, cross, ok: a.reactions.length }));
`);
      const probed = run(process.execPath, [probe]);
      if (probed.status !== 0) throw new Error(`Reaction refusal probe failed to run: ${probed.out}`);
      const got = JSON.parse(probed.out.trim().split('\n').pop()!);
      if (!/read-only/.test(got.assign) || !/setReactionsAsync/.test(got.assign)) {
        throw new Error(`Mock must refuse plain assignment to reactions by name, got: ${got.assign}`);
      }
      if (!/not a variant of the same component set/.test(got.cross)) {
        throw new Error(`Mock must refuse a cross-set CHANGE_TO destination by name, got: ${got.cross}`);
      }
      if (got.ok !== 1) throw new Error('Mock must ACCEPT a same-set sibling CHANGE_TO');
    },
  },
  {
    // The State axis is declared surface when opted in, kit-rot drift when not.
    id: 'state-axis-drift-both-directions',
    claim: 'C3-detection',
    run: () => {
      // Induce the missing axis: strip State from the snapshot's Button set.
      editJson(FIGMA_COMPONENTS, (s2) => {
        const b = s2.sets.find((x: any) => x.name === 'Button');
        delete b.properties.State;
        b.variantCount = 12;
      });
      if (parity().status === 0) throw new Error('Opted-in contract without a canvas State axis passed parity');
      expectFinding(readReport(), 'figma', 'behind', 'Button.State');
      editJson(FIGMA_COMPONENTS, (s2) => {
        const b = s2.sets.find((x: any) => x.name === 'Button');
        b.properties.State = { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Hover', 'Focus Visible', 'Disabled'], preferredValues: null };
        b.variantCount = 24;
      });
      editJson(CONTRACT, (c) => { delete c.figmaStatePreviews; });
      editJson(FIGMA_COMPONENTS, (s) => {
        s.sets.find((x: any) => x.name === 'Button').properties.State = {
          type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Hover'], preferredValues: null,
        };
      });
      if (parity().status === 0) throw new Error('Hand-built State axis passed parity');
      const fnd = expectFinding(readReport(), 'figma', 'ahead', 'Button.State');
      if ((fnd.proposedPatch as any)?.figmaStatePreviews !== true)
        throw new Error('Kit-rot State axis must propose adoption via figmaStatePreviews');
    },
  },
  {
    // Text styles: minted from semantic typography tokens, upserted by marker,
    // and ridden by exactly-matching text nodes.
    id: 'text-styles-from-typography-tokens',
    claim: 'C1-determinism',
    run: () => {
      if (run(TSX, ['scripts/generate-figma.ts']).status !== 0) throw new Error('figma:plan failed');
      const tok = readFileSync(path.join(SCRATCH, 'figma-sync', '01-tokens.js'), 'utf8');
      const styles = JSON.parse(tok.match(/const TEXT_STYLES = (\[.*?\]);/)![1]);
      const ctrl = styles.find((s: any) => s.name === 'control/md');
      if (!ctrl || ctrl.fontSize !== 16 || ctrl.fontStyle !== 'Medium' || ctrl.tokenPath !== 'font.control.size.md')
        throw new Error(`control/md style wrong: ${JSON.stringify(ctrl)}`);
      if (!styles.some((s: any) => s.name === 'title' && s.fontStyle === 'Semi Bold'))
        throw new Error('Group weight token must drive the style weight (title → Semi Bold)');
      if (!tok.includes("getSharedPluginData('ds_contracts', 'textStyleToken')"))
        throw new Error('Text style upsert must reconcile by identity marker, never name');
      const f = readdirSync(path.join(SCRATCH, 'figma-sync')).find((n) => /^\d+-button\.js$/.test(n))!;
      const script = readFileSync(path.join(SCRATCH, 'figma-sync', f), 'utf8');
      const variants = parseSyncComponent(script).variants;
      const lg = variants.find((v: any) => v.name === 'Variant=Primary, Size=Large');
      if (lg.spec.children[1].textStyle !== 'control/lg')
        throw new Error('Large Button label must ride the control/lg text style');
      if (!script.includes('setTextStyleIdAsync')) throw new Error('runtime style application missing');
    },
  },
  {
    // CODE→CONTRACT round-trip identity: generated components are ground truth
    // for the css-module anatomy adapter — re-extracting Badge/Switch/Card must
    // referee ZERO MISMATCH, and the receipt must be able to go red.
    id: 'extract-code-roundtrip-identity',
    claim: 'C5-extraction',
    run: () => {
      let r = run(TSX, ['extract/roundtrip-code.ts']);
      if (r.status !== 0 || !r.out.includes('0 mismatched')) throw new Error(`Round trip not clean:\n${r.out}`);
      replaceInFile('src/components/Badge/Badge.module.css', 'var(--radius-badge)', 'var(--radius-control)');
      r = run(TSX, ['extract/roundtrip-code.ts']);
      if (r.status === 0 || !r.out.includes('[Badge MISMATCH] anatomy.root')) {
        throw new Error(`Token drift not caught by the round-trip receipt:\n${r.out}`);
      }
      replaceInFile('src/components/Badge/Badge.module.css', 'var(--radius-control)', 'var(--radius-badge)');
      if (run(TSX, ['extract/roundtrip-code.ts']).status !== 0) throw new Error('Did not return to zero-mismatch after revert');
    },
  },
  {
    // Raw CSS values are REPORTED with nearest-token candidates, never invented.
    id: 'extract-raw-values-never-invented',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/run.ts', 'code', 'extract/fixtures/foreign-css.config.json']);
      if (r.status !== 0) throw new Error(`Extraction failed:\n${r.out}`);
      const raw = readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-css/contracts/callout.contract.json'), 'utf8');
      if (/#f9fafb|#374151|\b(6|8|12|14)px\b/i.test(raw)) throw new Error('A raw CSS value leaked into the proposed contract');
      const c = JSON.parse(raw);
      if (c.anatomy.root.parts?.heading?.content?.prop !== 'heading' || c.anatomy.root.parts?.body?.slot?.name !== 'children') {
        throw new Error('Foreign structure (content binding + slot) not extracted');
      }
      const notes = readFileSync(path.join(SCRATCH, 'extract/fixtures/.out-css/proposals.md'), 'utf8');
      if (!notes.includes('{ background-color: #f9fafb }') || !notes.includes('{color.gray.50}')) throw new Error('Raw value not reported with nearest-token candidates');
      if (!notes.includes('var(--text-muted) which resolves to NO token')) throw new Error('Unresolvable css var not refused by name');
    },
  },
  {
    // DESIGN→CONTRACT round-trip identity: live node-tree dumps of three
    // contract-generated sets must re-propose contracts with ZERO MISMATCH.
    id: 'design-roundtrip-anatomy-zero-mismatch',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/roundtrip.ts']);
      if (r.status !== 0) throw new Error(`Round-trip receipt failed:\n${r.out}`);
      for (const name of ['Badge', 'Switch', 'Card']) {
        const line = r.out.split('\n').find((l) => l.startsWith(`${name}:`));
        if (!line || !/MISMATCH 0$/.test(line.trim()))
          throw new Error(`${name}: expected zero MISMATCH — got: ${line ?? '(no summary line)'}`);
        if (!/MATCHED [1-9]/.test(line)) throw new Error(`${name}: vacuous receipt (no matched facts)`);
      }
    },
  },
  {
    // Unbound fills: the OBSERVED value is carried as a PROVISIONAL imported.*
    // token — never a real corpus token the canvas did not use — and the
    // nearest-real-token rename hint survives the minting.
    //
    // HISTORY, because this eval flipped meaning once (2026-08-03): it used to
    // pin the CLI door's mint-OFF behavior (`tokens['background-color']` must
    // be ABSENT). When the door turned minting on — the fix that made a
    // designer's first `generate` succeed instead of refusing on dangling
    // refs — this eval red-flagged the provisional binding as "fabricated".
    // Minting the observed literal under a machine name is CARRIAGE, not
    // fabrication; what "never invented" must protect is (a) no REAL-name
    // guess, and (b) the human's rename hint. Both are pinned below, harder
    // than before: the old assertion could not tell a provisional carry from
    // a real-name guess — it just banned both.
    id: 'design-propose-unbound-fill-named-never-invented',
    claim: 'C5-extraction',
    run: () => {
      editJson('extract/figma/fixtures/main-file-dumps.json', (d) => {
        for (const v of d.Badge.variants) v.fill = { hex: '3b82f6' };
      });
      const r = run(TSX, [
        'extract/figma/propose.ts',
        'extract/figma/fixtures/main-file-dumps.json',
        '--out',
        'extract/out/figma',
        '--reviewable-inversion',
      ]);
      if (r.status !== 0) throw new Error(`Proposal failed on an unbound fill:\n${r.out}`);
      const proposed = JSON.parse(readFileSync(path.join(SCRATCH, 'extract', 'out', 'figma', 'badge.contract.proposed.json'), 'utf8'));
      const ref = proposed.anatomy.root.tokens?.['background-color'];
      if (typeof ref !== 'string' || !/^\{imported\./.test(ref)) {
        throw new Error(`Unbound fill must be carried as a PROVISIONAL imported.* ref — got ${JSON.stringify(ref)}`);
      }
      if (ref.includes('color.blue.500')) throw new Error('Proposal bound a REAL corpus token the canvas never used — that is invention');
      // The provisional leaf must hold the OBSERVED hex, verbatim.
      const minted = JSON.parse(readFileSync(path.join(SCRATCH, 'extract', 'out', 'figma', 'minted.dtcg.json'), 'utf8'));
      const leaf = ref.slice(1, -1).split('.').reduce((n, k) => (n ?? {})[k], minted);
      if (leaf?.$value !== '#3b82f6') {
        throw new Error(`Minted leaf must carry the observed #3b82f6, got ${JSON.stringify(leaf?.$value)} — a value not drawn on the canvas would be invention`);
      }
      // The rename hint survives the mint: provenance + nearest real token.
      const report = readFileSync(path.join(SCRATCH, 'extract', 'out', 'figma', 'figma-proposals.md'), 'utf8');
      if (!report.includes('observed #3b82f6 carried as a PROVISIONAL minted token')) {
        throw new Error('Minted carriage lost the unbound provenance note');
      }
      if (!report.includes('{color.blue.500}')) throw new Error('Nearest-token rename hint missing — dropping the entry silently also dropped the hint');
    },
  },
  {
    // Uncorrelated cross-variant binding is drift, never a guess.
    id: 'design-roundtrip-uncorrelated-binding-is-mismatch-not-guess',
    claim: 'C5-extraction',
    run: () => {
      editJson('extract/figma/fixtures/main-file-dumps.json', (d) => {
        d.Badge.variants[2].fill.var = 'color/feedback/success/background';
      });
      const r = run(TSX, ['extract/figma/roundtrip.ts']);
      if (r.status === 0) throw new Error('Receipt passed despite an uncorrelated cross-variant binding');
      if (!r.out.includes('part root background-color')) throw new Error('Mismatch not named');
    },
  },
  {
    // REST-mapped dump round-trips to the shipping contract (no plugin).
    id: 'design-rest-roundtrip-zero-mismatch',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/rest/roundtrip-rest.ts']);
      if (r.status !== 0) throw new Error(`REST roundtrip failed:\n${r.out}`);
      const receipt = readFileSync(path.join(SCRATCH, 'extract/figma/rest/ROUNDTRIP-REST.md'), 'utf8');
      for (const c of ['Badge', 'Card'])
        if (!new RegExp(`\\| ${c} \\| \\d+ \\| \\d+ \\| 0 \\| 0 \\| ✅`).test(receipt))
          throw new Error(`${c} row is not zero-mismatch/zero-degradation`);
    },
  },
  {
    // Variables endpoint absent (Enterprise 403): named degradations, zero fabrication.
    id: 'design-rest-degraded-variables-never-fabricates',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/rest/roundtrip-rest.ts']);
      if (r.status !== 0) throw new Error(r.out);
      const receipt = readFileSync(path.join(SCRATCH, 'extract/figma/rest/ROUNDTRIP-REST.md'), 'utf8');
      if (!receipt.includes('unresolvable — variables endpoint unavailable (Enterprise)'))
        throw new Error('degradations not named');
      if (!receipt.includes('zero fabrication: no color token ref anywhere in the degraded proposal'))
        throw new Error('fabrication check missing/failed');
    },
  },
  {
    // The engine-is-a-library claim: the new emitters' schema-driven invariants
    // hold, and the receipt can go red — a broken literal resolution must fail.
    id: 'emitter-invariants-hold-and-fail',
    claim: 'C1-determinism',
    run: () => {
      let r = run(TSX, ['core/emitters-check.ts']);
      if (r.status !== 0 || !r.out.includes('all emitter invariants hold'))
        throw new Error(`Emitter invariants failed:\n${r.out}`);
      replaceInFile('core/emit-react-inline.ts',
        "return typeof v === 'number' ? v : String(v);",
        "return `var(--${tokenPath.split('.').join('-')})`;");
      r = run(TSX, ['core/emitters-check.ts']);
      if (r.status === 0 || !r.out.includes('NO var(--'))
        throw new Error('Inline emitter leaking custom properties passed the receipt');
    },
  },
  {
    // The public-playground claim: the core barrel bundles for platform=browser
    // and emits with zero node globals — and a node:* import sneaking into the
    // core module graph must fail the receipt by name.
    id: 'core-browser-importable',
    claim: 'C1-determinism',
    run: () => {
      let r = run(process.execPath, ['scripts/core-browser-check.mjs']);
      if (r.status !== 0 || !r.out.includes('no node globals'))
        throw new Error(`Browser check failed on a clean tree:\n${r.out}`);
      replaceInFile('core/tokens.ts',
        'export function collectTokenPaths',
        "import { readFileSync } from 'node:fs';\nvoid readFileSync;\nexport function collectTokenPaths");
      r = run(process.execPath, ['scripts/core-browser-check.mjs']);
      if (r.status === 0) throw new Error('A node:fs import inside the core passed the browser bundle check');
    },
  },
  {
    // Degraded Figma imports mint provisional tokens and keep their styles —
    // and minted names never leave the imported. namespace.
    id: 'design-rest-degraded-minting-binds-styles',
    claim: 'C5-extraction',
    run: () => {
      const roundtrip = run(TSX, ['extract/figma/rest/roundtrip-rest.ts']);
      if (roundtrip.status !== 0) throw new Error(`REST roundtrip failed:\n${roundtrip.out}`);
      if (!/Badge \(degraded \+ minted\): 8\/8 checks/.test(roundtrip.out)) {
        throw new Error('degraded+minted pass did not report 8/8 checks');
      }
      const receipt = readFileSync(path.join(SCRATCH, 'extract/figma/rest/ROUNDTRIP-REST.md'), 'utf8');
      const refs = [...receipt.matchAll(/- `\{([a-z0-9.{}-]+)\}` = `/gi)].map((m) => m[1]);
      if (refs.length === 0) throw new Error('receipt lists no minted refs');
      const semantic = refs.filter((r) => !r.startsWith('imported.'));
      if (semantic.length > 0) throw new Error(`minted refs outside imported.: ${semantic.join(', ')}`);
      const mint = run(TSX, ['core/mint-check.ts']);
      if (mint.status !== 0) throw new Error(`mint invariants failed:\n${mint.out}`);
    },
  },
  {
    // Desktop-MCP import: recorded live fixtures replay to plugin-dump name
    // fidelity — Badge zero-mismatch, Eventz foreign names + the U+2024 fold.
    id: 'design-mcp-roundtrip-fixture-replay',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/mcp/receipt.ts']);
      if (r.status !== 0) throw new Error(`desktop-MCP receipt failed:\n${r.out}`);
      const receipt = readFileSync(path.join(SCRATCH, 'extract/figma/mcp/RECEIPT.md'), 'utf8');
      if (!/\| Badge \| \d+ \| \d+ \| 0 \| ✅/.test(receipt)) throw new Error('Badge row is not zero-mismatch');
      // dump v1.16: the U+2024 name FOLDS to a named rename instead of
      // refusing by grammar (design-gradient-textcase-carriage pins the fold
      // rule itself; this pins it firing on live foreign data).
      if (!receipt.includes('FOLDED to a NAMED RENAME')) throw new Error('U+2024 fold receipt missing');
    },
  },
  {
    // Field case (Eventz DS Button): variants solely wrapping an INSTANCE of a
    // shared base component name-matching the set must flatten — no self
    // component ref, captured componentProperties promoted with exact Figma
    // spellings — and pass the generator on flattened AND named-skip paths.
    id: 'design-base-instance-flattening-no-self-reference',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/base-instance-check.ts']);
      if (r.status !== 0) throw new Error(`base-instance receipt failed:\n${r.out}`);
      if (!r.out.includes('all base-instance invariants hold'))
        throw new Error('base-instance receipt did not report green');
      if (!r.out.includes('✔ no component ref anywhere in the anatomy'))
        throw new Error('self-reference check missing from the receipt output');
    },
  },
  {
    // Hand-edited contracts can still contain a self-composition the proposer
    // never emits — the generator must refuse the cycle BY NAME (direct and
    // transitive), never crash with 'Maximum call stack size exceeded'.
    id: 'generator-refuses-component-ref-cycles',
    claim: 'C2-refusal',
    run: () => {
      const r = run(TSX, ['extract/figma/base-instance-check.ts']);
      if (r.status !== 0) throw new Error(`base-instance receipt failed:\n${r.out}`);
      if (!r.out.includes('✔ emitReact REFUSES the direct self-ref by name'))
        throw new Error('direct-cycle refusal check missing/failed');
      if (!r.out.includes('✔ transitive cycle refused with the chain spelled out'))
        throw new Error('transitive-cycle refusal check missing/failed');
    },
  },
  {
    // Owner P0 (CBDS Button-Brand Primary): semantics.element is inferred
    // DETERMINISTICALLY inside proposeFromDump (name/axis table, zero AI) —
    // button from the set name, "a" from "link", no match stays div with the
    // hedge note. "This is a freaking button" must never render as a div.
    id: 'design-semantics-element-inference',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/cbds-check.ts']);
      if (r.status !== 0) throw new Error(`CBDS receipt failed:\n${r.out}`);
      if (!r.out.includes('✔ element "button" inferred (deterministic, inside proposeFromDump) and NOTED'))
        throw new Error('button inference check missing/failed');
      if (!r.out.includes('✔ name "Nav Link" → element "a", with a named inference note'))
        throw new Error('link inference check missing/failed');
      if (!r.out.includes('✔ no table match ("Chip") → element stays "div" with the existing hedge note'))
        throw new Error('no-match hedge check missing/failed');
      if (!r.out.includes('✔ emitReact: root renders <button (not a div)'))
        throw new Error('emitted <button> check missing/failed');
    },
  },
  {
    // Owner P0: a drawn `state` enum axis (default|hover|focus|pressed|
    // disabled) is the platform's interaction states, not API. Fixture replay
    // of the REAL imported set: the axis never becomes a prop; hover/pressed/
    // focus land as real state overrides; disabled is a BOOLEAN prop;
    // figmaStatePreviews round-trips the axis to the canvas; and the emitted
    // padding/font-size per SIZE variant EQUAL the dump's values exactly —
    // a wrong-but-plausible constant is the worst outcome and is refused.
    id: 'design-state-axis-promotion-cbds-replay',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/cbds-check.ts']);
      if (r.status !== 0) throw new Error(`CBDS receipt failed:\n${r.out}`);
      for (const line of [
        '✔ NO `state` prop ships in the API',
        '✔ contract states [hover, active, focus-visible, disabled] declared',
        '✔ `disabled` is a real BOOLEAN prop (default false) — never an enum value shipped to code',
        '✔ figmaStatePreviews: true (the canvas round-trips the states as a State preview axis)',
        '✔ size=large: padding EXACT — emitted padding-inline resolves to 16px/16px, padding-block to 8px/8px (dump values)',
        '✔ size=small: padding EXACT — emitted padding-inline resolves to 12px/12px, padding-block to 8px/8px (dump values)',
        '✔ size=large: font-size EXACT — emitted value resolves to 16px (dump value)',
        '✔ size=small: font-size EXACT — emitted value resolves to 14px (dump value)',
        '✔ per-size values genuinely DIFFER in the emitted output (small ≠ large padding and font-size — no first-variant constant)',
        '✔ canvas script constructs the State preview axis (State=Hover / State=Active / State=Focus Visible / State=Disabled)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Owner P0: a proposal whose nested instance has no contract in scope
    // ships a child STUB — registering it makes the emitters run; NOT
    // registering it reproduces the owner's exact refusal, BY NAME. Pinned at
    // the engine level (the playground registers result.childStubs into its
    // contracts map via engine/stub-contracts.ts).
    id: 'design-child-stubs-prevent-scope-refusals',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/cbds-check.ts']);
      if (r.status !== 0) throw new Error(`CBDS receipt failed:\n${r.out}`);
      if (!r.out.includes('✔ ds.icon child STUB auto-proposed alongside (parses against the contract schema)'))
        throw new Error('child-stub proposal check missing/failed');
      if (!r.out.includes("✔ WITHOUT the stub registered, emitReact refuses BY NAME (\"ds.icon\" … no contract in scope) — the owner's refusal, pinned"))
        throw new Error('unregistered-stub refusal check missing/failed');
      if (!r.out.includes('✔ emitReact: props extend ButtonHTMLAttributes<HTMLButtonElement>'))
        throw new Error('registered-stub emit check missing/failed');
    },
  },
  {
    // COMPOSITE CHILDREN, mechanism 1 (dump v1.5): nested instances resolve
    // by componentSetKey FIRST — RENAME-SAFE (same key, different name,
    // LINKS) — and a NAME match whose keys contradict is refused by name
    // (field failure: Shoelace "Button" name-collided with repo ds.button
    // and rendered the wrong design system's button on all 36 variants).
    id: 'key-based-linking',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/composite-check.ts']);
      if (r.status !== 0) throw new Error(`composite receipt failed:\n${r.out}`);
      for (const line of [
        '✔ same key + DIFFERENT name LINKS (rename-safe): component ref → sl.totally-renamed-button',
        '✔ name-coincidence link REFUSED by key contradiction (no component ref to ds.button)',
        '✔ the stub id is suffixed PAST the contradicting in-scope contract (ds.button-2, never ds.button)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // CROSS-IMPORT MINTED-TOKEN SCOPE (owner field case, two-import session):
    // import Button-Brand Primary (typography mints imported.*), then import
    // Dialog — session linking links the action button, and the CANVAS used
    // to refuse 'Cannot resolve token "imported.button-brand-primary.button.
    // font-size.large"' (the composite batch carried earlier minted layers
    // as CSS text only; the engine resolves literals through the token TREE).
    // The receipt replays the exact session: control refusal BY NAME, then
    // linkedImportScope compiles every surface with zero refusals and the
    // labeled cross-layer receipt line.
    id: 'cross-import-token-scope',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/cross-import-check.ts']);
      if (r.status !== 0) throw new Error(`cross-import receipt failed:\n${r.out}`);
      for (const line of [
        "✔ WITHOUT the scope, compiling the linked button refuses with the owner's exact message",
        '✔ the CANVAS compiles: dialog 4 variants',
        '✔ the LINKED button compiles too: 3 size variants',
        "✔ the cross-layer receipt line is present and labeled: 'resolving through Button-Brand Primary's imported tokens — N'",
        '✔ referee (generateCss over the scoped inventory): zero violations (got 0)',
        '✔ react (css modules) emits with ZERO refusals',
        '✔ html (preview surface) emits with ZERO refusals',
        '✔ react-inline (literal resolution through the scoped tree) emits with ZERO refusals',
        '✔ figma script (engine over the scoped tree) emits with ZERO refusals',
        "✔ the figma script's minted preamble upserts the LINKED button's minted variables too",
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // PART-LEVEL STATE OVERRIDES (P18 second half, v13 — B7 retired; owner
    // hit it twice): his kit draws the disabled button LABEL at #556275
    // ({text.disabled}) on the #dfe3eb fill; the diff used to be the B7
    // named note and the preview drew the default #fcfeff — near-invisible.
    // Part.states now carries it (color-kind channels, non-ref parts,
    // refusal-ruled), the proposer PROPOSES depth-1 diffs, and every
    // surface renders it — including a refusal case per rule.
    id: 'part-level-state-overrides',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/part-state-check.ts']);
      if (r.status !== 0) throw new Error(`part-state receipt failed:\n${r.out}`);
      for (const line of [
        '✔ the label part carries states.disabled.color = {text.disabled} (his real bound variable)',
        '✔ the blanket B7 receipt is GONE from the notes (retired where the channel carries)',
        '✔ unknown state name refuses BY NAME ("sparkle" is not a STATE_SELECTORS state)',
        '✔ an UNDECLARED state refuses (states.hover on the part with `states: ["disabled"]` on the contract)',
        '✔ a non-color channel refuses BY NAME (font-size is not a part-state channel)',
        '✔ a component-ref part refuses (the child contract owns its styling)',
        '✔ css-modules: .root:disabled .Button { color: var(--text-disabled) } (descendant rule under the root state selector)',
        '✔ emit-html: .button-brand-primary:disabled .button-brand-primary__Button { color: var(--text-disabled) }',
        '✔ EVERY State=Disabled cell draws the label bound to text/disabled (the gray label) on the bg/disabled fill',
        '✔ the base variants keep the default label fill (text/inverse-primary — overrides never leak out of the state cells)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // BROWSER PROBE — the owner's exact complaint, pixel-truth: toggle
    // disabled in the preview and the label must COMPUTE #556275 on the
    // #dfe3eb fill (his captured {text.disabled} / {bg.disabled} values),
    // via the same emitHtml + captured/minted stylesheet pipeline the
    // playground preview assembles. Real Chromium, getComputedStyle.
    id: 'part-state-disabled-label-browser-probe',
    claim: 'C1-determinism',
    run: () => {
      const probe = run(TSX, ['-e', `
        import fs from 'node:fs';
        import path from 'node:path';
        import { chromium } from 'playwright-core';
        import { chromiumExecutable } from './extract/figma/visual-parity/render.ts';
        import { ContractSchema } from './scripts/contract-schema.ts';
        import { loadTokenCorpus } from './extract/figma/tokens.ts';
        import { loadContracts } from './extract/figma/propose.ts';
        import { proposeBatchFromDump } from './core/propose-figma.ts';
        import { capturedTokensFromDump } from './core/captured-tokens.ts';
        import { emitHtml } from './core/emit-html.ts';
        import { mintedTokenCss } from './core/mint-tokens.ts';
        import { tokenInventoryFromJson } from './core/tokens.ts';
        const j = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
        const corpus = loadTokenCorpus(process.cwd());
        const loaded = loadContracts(path.resolve('contracts'));
        const dump = j('extract/figma/fixtures/cbds-plugin-button-brand-primary.dump.json');
        const batch = proposeBatchFromDump(dump, { projectionMode: 'reviewable-inversion', corpus, contractIdByName: loaded.byName, contractsById: loaded.byId, fileKey: 'WofZT8xaxXuc2Q6Je9S4XE', mintUnbound: true });
        const p = batch.proposals[0];
        const c = ContractSchema.parse(p.contract);
        const contracts = new Map([[c.id, c]]);
        for (const s of p.childStubs ?? []) { const sc = ContractSchema.parse(s); contracts.set(sc.id, sc); }
        const captured = capturedTokensFromDump(dump);
        const inv = tokenInventoryFromJson([j('tokens/primitives.tokens.json'), j('tokens/semantic.tokens.json'), j('tokens/modes/semantic.light.tokens.json'), j('tokens/modes/semantic.dark.tokens.json'), captured.tree, p.mintedTokens?.tree ?? {}]);
        const emitted = emitHtml(c, { tokens: inv, icons: new Map(), contracts });
        // The playground preview stylesheet layering: captured + minted token
        // custom properties, then the emitted component CSS.
        const doc = '<!doctype html><html><head><meta charset="utf-8"><style>' + mintedTokenCss(captured.tree) + '\\n' + mintedTokenCss(p.mintedTokens?.tree ?? {}) + '</style><style>body{margin:0;padding:32px}</style><style>' + emitted.css + '</style></head><body>' + emitted.html + '</body></html>';
        (async () => {
          const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
          try {
            const page = await browser.newPage();
            await page.setContent(doc, { waitUntil: 'load' });
            const r = await page.evaluate("(() => { const toHex = (rgb) => '#' + rgb.match(/\\\\d+/g).slice(0,3).map((n) => (+n).toString(16).padStart(2,'0')).join(''); const items = [...document.querySelectorAll('.showcase__item')]; const disabledItem = items.find((it) => it.querySelector('.button-brand-primary:disabled')); const el = disabledItem.querySelector('.button-brand-primary'); const label = el.querySelector('.button-brand-primary__Button'); const defaultEl = items[0].querySelector('.button-brand-primary'); const defaultLabel = defaultEl.querySelector('.button-brand-primary__Button'); return { bg: toHex(getComputedStyle(el).backgroundColor), label: toHex(getComputedStyle(label).color), defaultLabel: toHex(getComputedStyle(defaultLabel).color) }; })()");
            if (r.bg !== '#dfe3eb') throw new Error('disabled fill computed ' + r.bg + ', expected #dfe3eb ({bg.disabled})');
            if (r.label !== '#556275') throw new Error('disabled label computed ' + r.label + ', expected #556275 ({text.disabled}) — the near-invisible-label class');
            if (r.defaultLabel !== '#fcfeff') throw new Error('default label computed ' + r.defaultLabel + ', expected #fcfeff ({text.inverse-primary})');
            console.log('disabled label computes #556275 on #dfe3eb; default label stays #fcfeff');
          } finally { await browser.close(); }
        })().catch((e) => { console.error(e); process.exit(1); });
      `]);
      if (probe.status !== 0 || !probe.out.includes('disabled label computes #556275 on #dfe3eb; default label stays #fcfeff')) {
        throw new Error(`disabled-label browser probe failed:\n${probe.out}`);
      }
    },
  },
  {
    // COMPOSITE CHILDREN, mechanism 2 (dump v1.5): a child with no contract
    // in scope renders its OBSERVED bounding box + primary paint as minted
    // imported.stub-* tokens (per-variant via the stub's own axes; parent
    // props threaded "{size}"/"{type}") instead of a hollow nothing — and
    // never invents anatomy, borders, or its contract name as content.
    id: 'stub-geometry-render',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/composite-check.ts']);
      if (r.status !== 0) throw new Error(`composite receipt failed:\n${r.out}`);
      for (const line of [
        "✔ stub root binds minted geometry per the STUB'S OWN axes (width/height substitute {size})",
        '✔ minted leaves carry the OBSERVED values (small width 44px, large 82px, default fill #ffffff)',
        '✔ the parent\'s applied props THREAD the axes ("{size}"/"{type}" per variant, ComponentRefSchema)',
        '✔ emit-html: the stub box renders per size (.button--size-small { width: var(--imported-stub-button-2-root-width-small) })',
        '✔ emit-html: the stub renders its OBSERVED label text, and never its contract name',
        '✔ inconsistent stroke is NAMED, never faked (border not carried on the stub geometry)',
        '✔ eventz: slot design-time content proposed as defaultContent (startIcon → ds.play stub)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // COMPOSITE CHILDREN, mechanism 3 (dump v1.5): INSTANCE_SWAP
    // preferredValues (component keys) resolve through the session key index
    // into slot `accepts` (acceptsMode 'prefer' — Figma's own tier);
    // unresolvable keys stay a NAMED note carrying the keys verbatim.
    id: 'preferred-values-accepts',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/composite-check.ts']);
      if (r.status !== 0) throw new Error(`composite receipt failed:\n${r.out}`);
      for (const line of [
        '✔ unresolvable keys stay a NAMED note carrying the keys verbatim (no accepts invented)',
        '✔ with the key in scope, accepts resolves: slot accepts ["ev.icon"], acceptsMode "prefer"',
        '✔ the resolution is NAMED (preferredValues → accepts note)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Owner field case (CBDS Tooltip): the root's DROP_SHADOW must mint
    // byte-equal to the dump (0px 2px 4px #00000029), render on the CSS
    // surface, AND project onto the canvas surfaces as a native effect —
    // the exact channel whose loss made the imported tooltip "look
    // unstyled". Fixture replay of the owner's live node (695-313).
    id: 'design-shadow-mints-and-renders',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/tooltip-check.ts']);
      if (r.status !== 0) throw new Error(`Tooltip receipt failed:\n${r.out}`);
      for (const line of [
        "✔ box-shadow MINTED byte-equal to the dump's DROP_SHADOW (0px 2px 4px #00000029)",
        '✔ emitReact CSS: box-shadow declaration on the root',
        '✔ canvas spec: root carries the native DROP_SHADOW (0/2/4 #00000029 — numeric equality with the dump)',
        '✔ the shadow note states the canvas surfaces PROJECT it (the v1 "no box-shadow projection" limit is retired)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Owner field case (CBDS Tooltip): the Pointer REGULAR_POLYGON is a REAL
    // part — triangle geometry + rotation carried (#42, dump v1.3), and the
    // pointer-position axis drives genuinely DIFFERENT absolute placements
    // whose offsets equal the captured boxes exactly.
    id: 'design-pointer-geometry-carried',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/tooltip-check.ts']);
      if (r.status !== 0) throw new Error(`Tooltip receipt failed:\n${r.out}`);
      for (const line of [
        '✔ Pointer is a REAL shape part: polygon, 3 sides, 12×12 (dump intrinsic size)',
        "✔ Pointer fill resolves to the dump's #fcfeff",
        '✔ top-right placement EXACT from the captured box (right: 12px, top: -8px, rotation 0)',
        '✔ bottom-left placement EXACT (left: 12px, bottom: -8px, rotate(180deg))',
        '✔ left-center placement EXACT (left: -8px, vertically centered, rotate(-90deg))',
        '✔ the three placements genuinely DIFFER',
        '✔ canvas spec: pointer compiles to a shape node with per-variant constraints + rotation (top-right MAX/MIN rot0 · bottom-left MIN/MAX rot180 · left-center MIN/CENTER rot-90)',
        '✔ sync script constructs a REAL polygon with native rotation + ABSOLUTE placement + DROP_SHADOW effect + PIXELS line height',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Owner field case (CBDS Tooltip): pointer=false must render NO arrow —
    // the boolean the set already carries drives the part on every surface
    // (visibleWhen inverted from the hidden pattern), and the never-drawn
    // pointer-position=none combo is suppressed rather than guessed.
    id: 'design-pointer-false-no-arrow',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/tooltip-check.ts']);
      if (r.status !== 0) throw new Error(`Tooltip receipt failed:\n${r.out}`);
      for (const line of [
        '✔ visibleWhen { prop: pointer } inverted from the hidden pattern (boolean axis)',
        '✔ emitReact TSX: the arrow renders conditionally ({pointer ? …})',
        '✔ pointer-position=none suppresses the arrow even against defaults (display: none stylesWhen)',
        '✔ canvas spec: the pointer-position=none variant compiles WITHOUT the shape node (suppressed)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Owner follow-up (same tooltip): the Semi Bold title and the 16px line
    // height must CARRY — font-weight through the bounded weight-name table,
    // line-height when the canvas spells PIXELS (dump v1.3) — with numeric
    // equality against the dump on the emitted surface.
    id: 'design-text-weight-and-line-height-carried',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/tooltip-check.ts']);
      if (r.status !== 0) throw new Error(`Tooltip receipt failed:\n${r.out}`);
      for (const line of [
        '✔ Main text ("Semi Bold") font-weight resolves to 600 EXACTLY (weight-name table)',
        '✔ Main text line-height resolves to 16px EXACTLY (dump v1.3 PIXELS)',
        '✔ Supporting text ("Regular") font-weight resolves to 400 + line-height 16px',
        // v17 re-record (justified in extract/figma/tooltip-check.ts): typography
        // mints under the TEXT STYLE's name, not the anatomy path. Values are
        // unchanged and still asserted; the second line is the new distinctness
        // guard — style-naming must never collapse two styles onto one leaf.
        '✔ emitReact CSS: font-weight + line-height on both text parts, named for their TEXT STYLES (Label/Small, Body/Small)',
        '✔ the two text parts bind DIFFERENT style groups (style-naming must not collapse distinct styles)',
        '✔ canvas spec: text nodes carry Semi Bold + lineHeight 16 (weight table + dump v1.3)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Owner field failure (first live Send-to-Playground, CBDS UI Kit Demo):
    // private-helper names ("_Avatar Indicator"), template names
    // ("Button / Primary / Medium", "Type=Text, Variant=Error"), and the
    // child-stub ids derived from them produced contract ids the schema
    // refuses. The rule: sanitize AT PROPOSAL (componentIdSlug — the
    // prop-identifier discipline), every changed spelling a NAMED note, the
    // component ref and its stub sharing ONE function so they cannot drift.
    // Receipt runs over the LIVE plugin-transport dumps, committed verbatim.
    id: 'design-id-sanitize-at-proposal',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/cbds-batch-check.ts']);
      if (r.status !== 0) throw new Error(`CBDS batch receipt failed:\n${r.out}`);
      for (const line of [
        '✔ componentIdSlug("_variable-list-item") = "variable-list-item"',
        '✔ componentIdSlug("Button / Primary / Medium") = "button-primary-medium"',
        '✔ componentIdSlug("Type=Text, Variant=Error") = "type-text-variant-error"',
        '✔ componentIdSlug("01 Icons") = "c-01-icons"',
        '✔ "_variable-list-item" proposes with id "ds.variable-list-item"',
        '✔ its sanitize note NAMES the original spelling and the rule',
        '✔ "Avatar" child stub id is "ds.avatar-indicator"',
        '✔ the anatomy component ref uses the SAME sanitized id as the stub',
        '✔ the stub-id sanitize note NAMES "_Avatar Indicator" → "ds.avatar-indicator"',
        '✔ no "ds.-" id survives anywhere in the Avatar proposal or its stubs',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // The other half of the field failure: ONE bad set killed the WHOLE
    // receive and the raw zod issue array rendered verbatim in the rail.
    // proposeBatchFromDump (the function the playground receive paths run)
    // must complete the full ALL-SETS replay with zero raw errors, name a
    // poisoned set as a plain-words skip while the rest import, name real
    // sanitized-id collisions, and never headline machine text.
    id: 'design-batch-isolation-plain-words-skips',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/cbds-batch-check.ts']);
      if (r.status !== 0) throw new Error(`CBDS batch receipt failed:\n${r.out}`);
      for (const line of [
        '✔ every set accounted for: proposed + skipped = total',
        '✔ ALL 1618 sets propose (zero skips on the live dump after sanitize)',
        '✔ every proposed id satisfies the schema pattern',
        '✔ the real id collision ("RadioButton" vs "Radio button" → ds.radio-button) is NAMED, never silent',
        '✔ the healthy set still proposes',
        '✔ the poisoned set is a NAMED skip',
        '✔ the skip reason is plain words ("Set "Poisoned" could not be proposed: …"), not machine output',
        '✔ a thrown zod error formats as words ("the proposed contract did not fit the contract schema — …")',
        '✔ the raw zod text survives as expandable detail, not the headline',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Owner P0 (the final link — his CBDS Button-Brand Primary bridge send):
    // the proposal bound his REAL token names and the playground referee
    // refused ALL NINE ("does not exist in tokens/") because it knew only the
    // repo corpus. Dump v1.4 carries each bound variable's RESOLVED value
    // (_variables); the playground registers them as an import-scoped token
    // layer (core/captured-tokens.ts + token-source capturedLayer, repo
    // tokens winning on name collision), so the referee resolves his names
    // and the preview renders HIS values — ZERO refusals, pinned numerically
    // against the committed fixture, with the refusal reproduced as a control.
    id: 'design-imported-token-layer-registration-resolution',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/cbds-bridge-check.ts']);
      if (r.status !== 0) throw new Error(`CBDS bridge receipt failed:\n${r.out}`);
      for (const line of [
        '✔ 18 variables captured, 18 registrable, 0 skipped',
        '✔ captured {bg.brand.default} resolves EXACTLY to #0e61ba',
        '✔ captured {spacing.200} resolves EXACTLY to 16px',
        '✔ zero captured names shadow repo tokens — all 18 register',
        '✔ ZERO referee violations (got 0)',
        '✔ in particular: zero "does not exist in tokens/" refusals (the owner saw NINE)',
        '✔ control: WITHOUT the captured layer the referee refuses his real names by name',
        '✔ renders a focusable <button> (not a div)',
        '✔ computed background = #0e61ba from HIS {bg.brand.default} (got #0e61ba)',
        '✔ :hover computed background = #003e81 from HIS {bg.brand.hover} (got #003e81)',
        '✔ :active computed background = #002854 from HIS {bg.brand.pressed} (got #002854)',
        '✔ :disabled computed background = #dfe3eb from HIS {bg.disabled} (got #dfe3eb)',
        '✔ :focus-visible computed outline-color = #0e61ba from HIS {border.focus} (got #0e61ba)',
        '✔ label computed color = #fcfeff from HIS {text.inverse-primary} (got #fcfeff)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Owner P0 (axis-correlation): his notes showed root paddingLeft/
    // paddingRight ({spacing.200} vs {spacing.150}) and height
    // ({component-size.xlarge|large|medium}) dropped as 'bindings differ
    // across variants without correlating to any variant axis'. TRUE root
    // cause (his state-variant hypothesis disproven by replay — base facts
    // already come from default-state variants only): unifyRefs required the
    // differing path SEGMENT to spell camel(axisValue) ('200' ≠ 'large').
    // Correlation now also works by VALUE over the default-state occurrences
    // — a plain function of ONE enum axis, injectivity NOT required
    // (large/medium sharing {spacing.200} is still a function of size) —
    // and carries as tokensByProp with his real refs.
    id: 'design-correlation-over-default-state-occurrences',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/cbds-bridge-check.ts']);
      if (r.status !== 0) throw new Error(`CBDS bridge receipt failed:\n${r.out}`);
      for (const line of [
        '✔ root padding-inline base = {spacing.200} (large/medium)',
        '✔ tokensByProp rides the `size` axis',
        '✔ tokensByProp small override: padding-inline = {spacing.150}',
        '✔ large/medium share {spacing.200} — a valid (non-injective) function of size, no medium padding override needed',
        '✔ root height base = {component-size.xlarge} (large)',
        '✔ tokensByProp medium override: height = {component-size.large}',
        '✔ tokensByProp small override: height = {component-size.medium}',
        '✔ the old drift note is GONE (no "bindings differ across variants without correlating" for padding/height)',
        '✔ size=small: computed padding-inline = 12px from {spacing.150} (got 12px)',
        '✔ size=small: computed height = 32px from {component-size.medium} (got 32px)',
        '✔ size=medium: computed height = 40px from {component-size.large} (got 40px)',
        '✔ computed padding-inline = 16px (large; got 16px)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Owner P0 (global part-name dedup): his Dialog refused with 'duplicate
    // anatomy part name "Title"' + '"Icon"'. Part names are contract-wide
    // identity (CSS classes, swap layers, note paths) but the proposer
    // deduped only among SIBLINGS — his Title[FRAME] > Title[TEXT] nest and
    // two Icon instances under DIFFERENT parents slipped through to an emit
    // refusal. Fixed with a contract-global registry in partKey: pre-order
    // claiming (first drawn part keeps its name), parent-derived prefix for
    // later collisions ("frame2Icon"), else ordinal ("Title2"); every rename
    // a NAMED note carrying the node path.
    id: 'design-dialog-global-part-dedup',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/dialog-check.ts']);
      if (r.status !== 0) throw new Error(`Dialog dedup receipt failed:\n${r.out}`);
      for (const line of [
        '✔ 1 proposed, 0 skipped (the send completes)',
        '✔ part names are UNIQUE contract-wide (17 parts, 17 distinct)',
        '✔ the drawn "Title" WRAPPER keeps its name (first drawn part wins)',
        '✔ the "Title" TEXT inside it takes the ordinal — "Title2" (parent key IS the colliding name, so no prefix)',
        '✔ the second "Icon" (close icon, under "Frame 2") takes the parent-derived prefix — "frame2Icon"',
        '✔ the "Title" rename is a NAMED note carrying the node path',
        '✔ the "Icon" rename is a NAMED note carrying the node path',
        '✔ BOTH _Slot-Dialog underscore-instances carry as slots (swap-bound INSTANCE_SWAP → slot parts, sanitized names)',
        '✔ all FOUR action-button component refs present under Actions',
        '✔ BOTH Icon instances (title icon + close icon) reference the ds.icon stub',
        '✔ the scroll bar carries (hidden RECTANGLE → "scrollBar" part)',
        '✔ ZERO referee violations (got 0)',
        "✔ in particular: zero 'duplicate anatomy part name' refusals (the owner's Dialog refusal class)",
        '✔ emitHtml renders (validateContract passed — the duplicate refusal is GONE)',
        '✔ the canvas compiles — 4 variants (size axis; got 4)',
        '✔ its id rides the sanitize rule — "ds.modal-confirmation-dialog" (got ds.modal-confirmation-dialog)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Owner P0 (canvas metrics): the Code preview rendered his Button right
    // (16/12 padding-inline, 48/40/32 heights) but the CANVAS drew too-tall
    // uniform boxes (~64px, all sizes identical). Two root causes, fixed:
    // (1) compileComponentData applied `root.tokens` instead of
    // resolveTokens(root, subst) — the ROOT's tokensByProp per-size overrides
    // never reached the compiled specs (child parts already resolved right);
    // (2) the canvas preview drew content-box divs, so a bound 48px height
    // PLUS 8px padding-block rendered 64px — Figma boxes are border-box.
    // The receipt pins all 15 cells box-equal to the dump's own captured
    // variant boxes, per-size differences differing, and the border-box rule.
    id: 'design-canvas-box-parity',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/canvas-box-check.ts']);
      if (r.status !== 0) throw new Error(`canvas-box receipt failed:\n${r.out}`);
      for (const line of [
        '✔ 15 canvas cells compile (got 15)',
        '✔ every cell name maps to a distinct captured variant',
        '✔ cell "size=large" box == captured "size=large, state=default" box (h=48 via component-size/xlarge, pad=[8,16,8,16], gap=8, hug width)',
        '✔ cell "size=medium" box == captured "size=medium, state=default" box (h=40 via component-size/large, pad=[8,16,8,16], gap=8, hug width)',
        '✔ cell "size=small" box == captured "size=small, state=default" box (h=32 via component-size/medium, pad=[8,12,8,12], gap=8, hug width)',
        '✔ cell "size=small, State=Focus Visible" box == captured "size=small, state=focus" box (h=32 via component-size/medium, pad=[8,12,8,12], gap=8, hug width)',
        '✔ cell "size=small" text 14px/21px == captured 14px/21px',
        '✔ heights 48/40/32 per size, DISTINCT (got large=48, medium=40, small=32)',
        '✔ padding-inline 16/16/12 — small DIFFERS (got large=16, medium=16, small=12)',
        '✔ min-height 44 stays CSS-side BY DESIGN (the canvas draws the real per-variant height; the contract carries the fact for the code surfaces)',
        '✔ the canvas stylesheet declares box-sizing: border-box (a FIXED height includes padding, like Figma — 48px means 48px, not 48+8+8)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Owner P0 (AI-fix guardrails): Fix-with-AI resolved his Dialog's
    // duplicate-part-name refusals by DELETING parts — the rendered Dialog
    // lost its close icon and all four action buttons; legal per schema,
    // lossy in fact, and nothing said so. The worker's fix-contract prompt
    // now FORBIDS removal-as-fix (rename/dedup/restructure instead) and the
    // forced tool carries a machine-readable `removals` declaration channel
    // (shape-checked passthrough; missing → []); the playground diffs every
    // AI round against the pre-fix contract and renders deletions loud/red
    // (undeclared losses loudest). This eval runs the worker test suite —
    // guardrail prompt text, removals schema, passthrough filtering — in the
    // scratch copy via the root tsx.
    id: 'design-ai-fix-removal-guardrails',
    claim: 'C2-refusal',
    run: () => {
      const r = run(TSX, ['--test', 'workers/assist/test/handler.test.ts', 'workers/assist/test/bridge.test.ts']);
      if (r.status !== 0) throw new Error(`worker test suite failed:\n${r.out.slice(0, 4000)}`);
      for (const line of [
        'fix-contract: the system prompt forbids removal-as-fix and demands declared removals',
        'fix-contract: the forced tool schema carries the removals declaration channel',
        'fix-contract: declared removals pass through shape-checked — junk dropped, unknown kind folds to "other"',
        'fix-contract: a response without removals answers an EMPTY array — never invented, never undefined',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing worker test: ${line}`);
      }
      if (!/# fail 0/.test(r.out)) throw new Error(`worker suite reports failures:\n${r.out.slice(-2000)}`);
    },
  },
  {
    // Owner P0 (min/max sizing): his minHeight 44 dropped as
    // [min-max-size-unsupported] ×15. Dump v1.4 carries literal min/max
    // sizing as node facts; the proposer mints them as bounded, exact px
    // style facts (min-height/min-width/max-height/max-width) — the
    // tap-target renders, and the degradation is retired for literal cases.
    id: 'design-min-height-carried',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/cbds-bridge-check.ts']);
      if (r.status !== 0) throw new Error(`CBDS bridge receipt failed:\n${r.out}`);
      for (const line of [
        '✔ root min-height binds a minted px fact',
        '✔ min-height resolves EXACTLY to 44px (got 44px)',
        '✔ the min-max-size-unsupported degradation is RETIRED for the literal case (fixture carries zero)',
        '✔ computed min-height = 44px (got 44px)',
        '✔ zero UNBOUND leftovers (every raw literal minted or refused by name)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Census class fix 1/3 (component-ref-unknown-child-prop, was 12 sets):
    // an applied Figma prop on a nested instance that does not map through
    // the in-scope child contract's bindings.figma is DROPPED with a named
    // note — never emitted under a guessed spelling the referee refuses.
    // Fixture replay of the live Avatar group set.
    id: 'design-census-unmappable-child-props-dropped',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/gauntlet/class-fix-check.ts']);
      if (r.status !== 0) throw new Error(`class-fix receipt failed:\n${r.out}`);
      for (const line of [
        '✔ the unmappable applied prop is DROPPED with the named note (isVisible on nested Avatar → ds.avatar)',
        '✔ "isVisible" appears NOWHERE in the emitted anatomy (dropped, not guessed)',
        '✔ referee CLEAN (validateContract + generateCss report zero violations; got 0)',
        '✔ no "sets unknown … prop" violation anywhere',
        '✔ ALL FOUR surfaces emit (react, html, react-inline, figma-script)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Census class fix 2/3 (visiblewhen-value-outside-prop-enum, was 11
    // sets): presence riding a true/false axis spells the truthy form
    // visibleWhen { prop } (the axis promotes to a BOOLEAN prop; equals:
    // "true" is enum vocabulary). The inexpressible false side is a NAMED
    // note, kept unconditional — never a wrong condition. Fixture replay of
    // the live Alert set + a synthesized false-side set.
    id: 'design-census-boolean-visiblewhen-truthy-form',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/gauntlet/class-fix-check.ts']);
      if (r.status !== 0) throw new Error(`class-fix receipt failed:\n${r.out}`);
      for (const line of [
        '✔ presence on the true/false axis is spelled as the TRUTHY form with the named note (visibleWhen { prop: inlineAction })',
        '✔ no visibleWhen carries equals:"true"/"false" (boolean spelling, not enum vocabulary)',
        '✔ the axis promoted to a BOOLEAN prop `inlineAction`',
        '✔ no "visibleWhen.equals … is not a value of prop" violation anywhere',
        '✔ false side: the inexpressible condition is a NAMED note (visibleWhen has no negated form; kept unconditional)',
        '✔ false side: NO visibleWhen is invented on the part (never wrong)',
        '✔ false side: referee CLEAN (got 0)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Census class fix 3/3 (prop-binding-not-camelcase, was 1 set): a
    // digit-led property spelling gets the componentIdSlug digit-led
    // discipline on prop code bindings ("2nd paragraph" → `p2ndParagraph`,
    // deterministic "p" prefix) with a named note; the figma binding keeps
    // the original spelling. Fixture replay of the live Note set.
    id: 'design-census-digit-led-prop-binding-prefixed',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/gauntlet/class-fix-check.ts']);
      if (r.status !== 0) throw new Error(`class-fix receipt failed:\n${r.out}`);
      for (const line of [
        '✔ the digit-led rename is a NAMED note (`p2ndParagraph` ← "2nd paragraph", componentIdSlug discipline)',
        '✔ prop name and code binding are `p2ndParagraph` (legal camelCase)',
        '✔ the figma binding keeps the ORIGINAL spelling "2nd paragraph"',
        '✔ no "is not a legal camelCase identifier" violation anywhere',
        '✔ ALL FOUR surfaces emit (react, html, react-inline, figma-script)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Census guard 4: emit-figma-script referees. The census found the
    // canvas surface was the one emitter that never called validateContract
    // — every referee-violating set still emitted a sync script. An invalid
    // contract must refuse BY NAME on the canvas surface like the other
    // three, and valid repo contracts must emit unchanged (golden safety).
    id: 'figma-script-referees-invalid-contracts',
    claim: 'C2-refusal',
    run: () => {
      const r = run(TSX, ['extract/figma/gauntlet/class-fix-check.ts']);
      if (r.status !== 0) throw new Error(`class-fix receipt failed:\n${r.out}`);
      for (const line of [
        '✔ emitFigmaScript REFUSES the invalid contract (no sync script emitted)',
        '✔ the refusal is NAMED with the emitReact wording ("Refused — 1 contract violation(s)")',
        '✔ the violation names the part and prop (visibleWhen references unknown prop "nonexistent")',
        '✔ the VALID repo contract still emits its sync script (golden untouched)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // Owner finding (2026-07): ds.checkbox v1.1.0 emitted <button
    // role="checkbox"> — an ARIA re-creation of a control the platform
    // ships. The fixed shape is pinned on BOTH code surfaces: a real
    // focusable <input type="checkbox"> is the control, checked rides the
    // DOM (not aria-checked), and indeterminate is the DOM PROPERTY set via
    // a ref — never a fake attribute. Switch pins the modern pattern:
    // input[type=checkbox][role=switch].
    id: 'checkbox-native-input',
    claim: 'C4-convergence',
    run: () => {
      if (generate().status !== 0) throw new Error('generate failed');
      const cb = readFileSync(path.join(SCRATCH, 'src/components/Checkbox/Checkbox.tsx'), 'utf8');
      const sw = readFileSync(path.join(SCRATCH, 'src/components/Switch/Switch.tsx'), 'utf8');
      const cbCss = readFileSync(path.join(SCRATCH, 'src/components/Checkbox/Checkbox.module.css'), 'utf8');
      for (const [what, ok] of [
        ['Checkbox renders a native input[type=checkbox]', cb.includes('type="checkbox"') && cb.includes('<input')],
        ["Checkbox checked is DOM state (checked={value === 'checked'})", cb.includes("checked={value === 'checked'}")],
        ['Checkbox indeterminate is the DOM PROPERTY via ref, not an attribute', cb.includes('el.indeterminate =') && !cb.includes('indeterminate=')],
        ['Checkbox carries NO role="checkbox" and NO aria-checked (native semantics)', !cb.includes('role="checkbox"') && !cb.includes('aria-checked')],
        ['Checkbox input toggles via onChange', cb.includes('onChange={handleToggle}')],
        ['Checkbox input is focusable (visually managed, never display:none)', cbCss.includes('opacity: 0') && !cbCss.match(/\.input\s*\{[^}]*display:\s*none/)],
        ['Switch is input[type=checkbox][role=switch] (modern switch pattern)', sw.includes('type="checkbox"') && sw.includes('role="switch"') && !sw.includes('aria-checked')],
      ] as Array<[string, boolean]>) {
        if (!ok) throw new Error(`pin failed: ${what}`);
      }
      // Same shape on the no-build-step surface: emitHtml renders a real
      // void <input type="checkbox">, `checked` as the attribute on the on
      // value, and NAMES indeterminate as a DOM property in a comment.
      const probe = run(TSX, ['-e', `
        import { emitHtml } from './core/emit-html.ts';
        import { ContractSchema } from './scripts/contract-schema.ts';
        import { tokenInventoryFromJson } from './core/tokens.ts';
        import fs from 'node:fs';
        const c = ContractSchema.parse(JSON.parse(fs.readFileSync('contracts/checkbox.contract.json','utf8')));
        const trees = ['tokens/primitives.tokens.json','tokens/semantic.tokens.json','tokens/modes/semantic.light.tokens.json','tokens/modes/semantic.dark.tokens.json'].map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
        const icons = new Map(fs.readdirSync('assets/icons').filter(f=>f.endsWith('.svg')).map(f=>[f.replace('.svg',''),fs.readFileSync('assets/icons/'+f,'utf8').trim()]));
        const { html } = emitHtml(c, { tokens: tokenInventoryFromJson(trees), icons, contracts: new Map([[c.id,c]]) });
        if (!html.includes('<input class="checkbox__input" type="checkbox">')) throw new Error('html surface lost the native input');
        if (!html.includes('type="checkbox" checked>')) throw new Error('html surface lost the checked attribute');
        if (!html.includes('el.indeterminate = true')) throw new Error('html surface does not name indeterminate as a DOM property');
        if (html.includes('indeterminate>') || html.includes('indeterminate=')) throw new Error('html surface fakes indeterminate as an attribute');
        console.log('html surface converges on the native input');
      `]);
      if (probe.status !== 0 || !probe.out.includes('html surface converges on the native input')) {
        throw new Error(`emitHtml probe failed:\n${probe.out}`);
      }
    },
  },
  {
    // The STANDING SEMANTIC LINT — this class of error must be impossible,
    // not just fixed. Reintroducing the exact owner-found shape (<button
    // role="checkbox"> where a native input exists) refuses BY NAME at
    // generation, on every surface that calls validateContract (react/html/
    // react-inline/figma-script, the census, the playground referee). A
    // DECLARED exception passes (ds.progress-bar ships one; the whole-catalog
    // generate above is the positive case), and a dangling exception refuses
    // too — it never rides along silently.
    id: 'refuse-role-recreating-native-control',
    claim: 'C2-refusal',
    run: () => {
      // Reintroduce the owner's finding on the checkbox contract.
      editJson('contracts/checkbox.contract.json', (c) => {
        const box = c.anatomy.root.parts.box;
        delete box.parts.input;
        box.element = 'button';
        box.attrs = { role: 'checkbox' };
        c.events[0].trigger = 'box';
      });
      const r = generate();
      if (r.status === 0) throw new Error('Generator accepted <button role="checkbox"> — the owner-found shape must refuse');
      if (!r.out.includes('claims role "checkbox" on element "button"') || !r.out.includes('native <input type="checkbox"> exists')) {
        throw new Error(`Refusal not named (expected the native-equivalent violation):\n${r.out}`);
      }
      if (!r.out.includes('declare the exception')) throw new Error('Refusal does not point at the exception field');
      // The exception mechanism must never ride along silently: removing the
      // claim ds.progress-bar's declared exception covers refuses by name.
      resetScratch();
      editJson('contracts/progress-bar.contract.json', (c) => {
        delete c.anatomy.root.attrs.role;
      });
      const r2 = generate();
      if (r2.status === 0) throw new Error('Generator accepted a dangling roleException');
      if (!r2.out.includes('roleException is declared but no root-level role claim needs it')) {
        throw new Error(`Dangling exception not named:\n${r2.out}`);
      }
    },
  },
  {
    // VOID-ELEMENT MOUNT GUARD (Eventz field case — the emit-side half of the
    // wrong-element-mount class): Atoms/Checkbox and Atoms/Input proposed
    // `semantics.element: "input"` over drawn children, and the emitters
    // mounted the anatomy INSIDE the void element — React refuses that at
    // runtime and the component renders NOTHING, silently. Reintroducing the
    // shape must refuse BY NAME at generation, on every surface that calls
    // validateContract, at BOTH guard sites: the single-root semantics
    // element, and any part carrying an explicit void element. The legal void
    // root stays legal — ds.divider's childless <hr> compiles in the
    // whole-catalog generate that every green eval already exercises.
    id: 'refuse-void-element-children-mount',
    claim: 'C2-refusal',
    run: () => {
      // Site 1 — the Eventz shape verbatim: a void ROOT over child parts.
      editJson('contracts/checkbox.contract.json', (c) => {
        c.semantics.element = 'input';
      });
      const r = generate();
      if (r.status === 0) {
        throw new Error('Generator accepted children mounted inside a void <input> root — the Eventz mounted-nothing shape must refuse');
      }
      if (!r.out.includes('ds.checkbox') || !r.out.includes('children cannot mount inside void element <input>')) {
        throw new Error(`Refusal not named (expected the void-element violation on ds.checkbox):\n${r.out}`);
      }
      if (!r.out.includes('Re-root the part') || !r.out.includes('or wrap the control')) {
        throw new Error(`Refusal does not state the fix (re-root / wrap):\n${r.out}`);
      }
      // Site 2 — a PART carrying an explicit void element over children.
      resetScratch();
      editJson('contracts/checkbox.contract.json', (c) => {
        c.anatomy.root.parts.box.element = 'img';
      });
      const r2 = generate();
      if (r2.status === 0) throw new Error('Generator accepted child parts inside a void <img> part');
      if (!r2.out.includes('part "box"') || !r2.out.includes('children cannot mount inside void element <img>')) {
        throw new Error(`Part-level refusal not named:\n${r2.out}`);
      }
    },
  },
  {
    // The PROPOSE-SIDE half of the same defect: the name/axis table infers
    // "input" for checkbox/input-named sets, and a proposal must NEVER
    // produce a contract the emitter refuses. When the drawn anatomy mounts
    // children under a void inference, proposeFromDump demotes to the "div"
    // container with a REVIEW re-root note — and the receipt EMITS the
    // demoted proposal to prove the invariant, while a childless input-named
    // set keeps element "input" (the ds.divider-class void root stays legal).
    id: 'design-void-element-re-root',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/cbds-check.ts']);
      if (r.status !== 0) throw new Error(`CBDS receipt failed:\n${r.out}`);
      for (const line of [
        '✔ input-named set WITH drawn children → element demoted to "div" (never the emitter-refused void shape), with a REVIEW re-root note',
        '✔ the demoted proposal EMITS — proposeFromDump never produces a contract the emitter refuses',
        '✔ a CHILDLESS input-named set keeps element "input" (the demotion is scoped to drawn children — ds.divider-class void roots stay legal)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // The Examples gallery captions state FACTS about their contracts, and
    // one shipped wrong (the Badge card said "four variant classes" over a
    // five-variant contract). Countable claims are DERIVED in
    // playground/src/engine/examples.ts; this receipt pins every derivation
    // site against the real contracts and refuses reintroduced hardcoded
    // counts (playground/scripts/caption-check.ts — reads source as text,
    // same discipline as design-canvas-box-parity).
    id: 'playground-caption-consistency',
    claim: 'C3-detection',
    run: () => {
      const r = run(TSX, ['playground/scripts/caption-check.ts']);
      if (r.status !== 0) throw new Error(`caption-consistency check failed:\n${r.out}`);
      for (const line of [
        'contractId references all resolve to shipping contracts',
        'enum-derivation sites resolve to non-empty enums',
        'caption-consistency: all claims hold',
      ]) {
        if (!r.out.includes(line)) throw new Error(`caption check receipt missing "${line}":\n${r.out}`);
      }
    },
  },
  {
    // Field failure (Split view): the Switch thumb — a text:"" part carrying
    // width/height/fill tokens — compiled correctly (the sync script wraps
    // styled static text in a frame that carries the box) but the canvas
    // preview's text branch dropped every box channel: a height-0 transparent
    // span, no thumb on screen. Pins BOTH halves: the compiled spec carries
    // the channels, and the canvas renderer's text branch renders them.
    id: 'switch-canvas-thumb',
    claim: 'C1-determinism',
    run: () => {
      const probe = run(TSX, ['-e', `
        import fs from 'node:fs';
        import { createFigmaEngine } from './core/emit-figma-script.ts';
        import { ContractSchema } from './scripts/contract-schema.ts';
        const j = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
        const tokens = { primitives: j('tokens/primitives.tokens.json'), semantic: j('tokens/semantic.tokens.json'), light: j('tokens/modes/semantic.light.tokens.json'), dark: j('tokens/modes/semantic.dark.tokens.json'), brands: { default: j('tokens/modes/brand.default.tokens.json') } };
        const icons = new Map(fs.readdirSync('assets/icons').filter(f=>f.endsWith('.svg')).map(f=>[f.replace('.svg',''),fs.readFileSync('assets/icons/'+f,'utf8')]));
        const byId = new Map(fs.readdirSync('contracts').filter(f=>f.endsWith('.contract.json')).map(f=>ContractSchema.parse(j('contracts/'+f))).map(c=>[c.id,c]));
        const data = createFigmaEngine({ tokens, icons }).compileComponentData(byId.get('ds.switch'), byId);
        const find = (s, name) => s.name === name ? s : (s.children ?? []).map(c => find(c, name)).find(Boolean);
        const thumb = find(data.variants[0].spec, 'thumb');
        if (!thumb) throw new Error('no thumb spec compiled');
        if (thumb.type !== 'text') throw new Error('thumb is expected to compile as a styled static TEXT spec, got ' + thumb.type);
        if (thumb.fill !== 'color/switch/thumb') throw new Error('thumb spec lost its fill: ' + thumb.fill);
        if (thumb.fixedWidth?.px !== 16 || thumb.fixedHeight?.px !== 16) throw new Error('thumb spec lost its 16px box');
        if (thumb.bindings?.topLeftRadius !== 'radius/pill') throw new Error('thumb spec lost its radius binding');
        console.log('thumb spec carries fill+16px box+radius');
      `]);
      if (probe.status !== 0 || !probe.out.includes('thumb spec carries fill+16px box+radius')) {
        throw new Error(`thumb spec probe failed:\n${probe.out}`);
      }
      // The canvas renderer's text branch renders those channels (the same
      // source-pin style as design-canvas-box-parity).
      const canvasSrc = readFileSync(
        path.join(SCRATCH, 'playground', 'src', 'engine', 'canvas-preview.ts'),
        'utf8',
      );
      const textBranch = canvasSrc.slice(canvasSrc.indexOf("spec.type === 'text'"), canvasSrc.indexOf("spec.type === 'instance'"));
      if (!/if \(spec\.fill \|\| spec\.fixedWidth \|\| spec\.fixedHeight \|\| spec\.bindings\)/.test(textBranch)) {
        throw new Error('canvas text branch no longer renders the styled-static-text box wrap (the height-0 thumb class)');
      }
      if (!textBranch.includes('nodeStyle(spec, ctx)')) {
        throw new Error('canvas text-box wrap no longer carries the box styles via nodeStyle');
      }
    },
  },
  {
    // BROWSER PROBE — real keyboard focus must NOT render the pressed/hover
    // fill. Field failure (visual-parity): every CBDS/Eventz focus row
    // screenshotted the hover fill under the ring (68-70% masked) — the
    // harness's stale mouse, not the emitters; this pins the emitter truth in
    // a real browser so the class can never be a silent emitter regression.
    id: 'focus-not-pressed-browser-probe',
    claim: 'C1-determinism',
    run: () => {
      const probe = run(TSX, ['-e', `
        import fs from 'node:fs';
        import { chromium } from 'playwright-core';
        import { chromiumExecutable } from './extract/figma/visual-parity/render.ts';
        import { emitHtml } from './core/emit-html.ts';
        import { ContractSchema } from './scripts/contract-schema.ts';
        import { tokenInventoryFromJson } from './core/tokens.ts';
        const j = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
        const c = ContractSchema.parse(j('contracts/button.contract.json'));
        const inv = tokenInventoryFromJson(['tokens/primitives.tokens.json','tokens/semantic.tokens.json','tokens/modes/semantic.light.tokens.json','tokens/modes/semantic.dark.tokens.json'].map(j));
        const icons = new Map(fs.readdirSync('assets/icons').filter(f=>f.endsWith('.svg')).map(f=>[f.replace('.svg',''),fs.readFileSync('assets/icons/'+f,'utf8').trim()]));
        const emitted = emitHtml(c, { tokens: inv, icons, contracts: new Map([[c.id, c]]) });
        const doc = '<!doctype html><html><head><meta charset="utf-8"><style>' + fs.readFileSync('src/styles/tokens.css','utf8') + '</style><style>body{margin:0;padding:32px}</style><style>' + emitted.css + '</style></head><body>' + emitted.html + '</body></html>';
        (async () => {
          const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
          try {
            const page = await browser.newPage();
            await page.setContent(doc, { waitUntil: 'load' });
            await page.mouse.move(0, 0); // pointer parked OFF the component
            await page.keyboard.press('Tab');
            const r = await page.evaluate("(() => { const el = document.querySelector('.showcase .button'); const cs = getComputedStyle(el); const v = (n) => { const probe = document.createElement('div'); probe.style.backgroundColor = 'var(' + n + ')'; document.body.appendChild(probe); const out = getComputedStyle(probe).backgroundColor; probe.remove(); return out; }; return { focused: document.activeElement === el, fv: el.matches(':focus-visible'), bg: cs.backgroundColor, outlineStyle: cs.outlineStyle, def: v('--color-action-primary-background'), hover: v('--color-action-primary-background-hover') }; })()");
            if (!r.focused || !r.fv) throw new Error('Tab did not keyboard-focus the button: ' + JSON.stringify(r));
            if (r.outlineStyle !== 'solid') throw new Error('focus ring missing: ' + JSON.stringify(r));
            if (r.bg !== r.def) throw new Error('real keyboard focus changed the fill: got ' + r.bg + ', default is ' + r.def + ' (hover is ' + r.hover + ')');
            if (r.bg === r.hover) throw new Error('focus renders the hover fill');
            console.log('keyboard focus keeps the default fill under the ring');
          } finally { await browser.close(); }
        })().catch((e) => { console.error(e); process.exit(1); });
      `]);
      if (probe.status !== 0 || !probe.out.includes('keyboard focus keeps the default fill under the ring')) {
        throw new Error(`focus browser probe failed:\n${probe.out}`);
      }
    },
  },
  {
    // Empty slot = ABSENT content — never painted placeholder text (field
    // failure: Eventz '[startIcon slot]' placeholders inflated every
    // visual-parity row 55-97%). Declared defaultContent still renders.
    id: 'slot-empty-not-placeholder',
    claim: 'C1-determinism',
    run: () => {
      const probe = run(TSX, ['-e', `
        import fs from 'node:fs';
        import { emitHtml } from './core/emit-html.ts';
        import { ContractSchema } from './scripts/contract-schema.ts';
        import { tokenInventoryFromJson } from './core/tokens.ts';
        const j = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
        const inv = tokenInventoryFromJson(['tokens/primitives.tokens.json','tokens/semantic.tokens.json','tokens/modes/semantic.light.tokens.json','tokens/modes/semantic.dark.tokens.json'].map(j));
        const icons = new Map(fs.readdirSync('assets/icons').filter(f=>f.endsWith('.svg')).map(f=>[f.replace('.svg',''),fs.readFileSync('assets/icons/'+f,'utf8').trim()]));
        const byId = new Map(fs.readdirSync('contracts').filter(f=>f.endsWith('.contract.json')).map(f=>ContractSchema.parse(j('contracts/'+f))).map(c=>[c.id,c]));
        // ds.token: two slots (icon, endContent), neither has defaultContent.
        const token = emitHtml(byId.get('ds.token'), { tokens: inv, icons, contracts: byId }).html;
        if (/\\[[a-zA-Z]+ slot\\]/.test(token)) throw new Error('empty slot painted bracket placeholder text');
        if (token.includes('slot-placeholder')) throw new Error('slot placeholder class still emitted');
        if (!token.includes('<!-- icon slot: no content -->')) throw new Error('empty slot absence not NAMED (comment missing)');
        // ds.breadcrumbs: its items slot DECLARES defaultContent — it must
        // still render composed children, never the absence comment.
        const bc = emitHtml(byId.get('ds.breadcrumbs'), { tokens: inv, icons, contracts: byId }).html;
        if (!bc.includes('breadcrumb-item')) throw new Error('declared defaultContent no longer renders: ' + bc.slice(0, 400));
        if (bc.includes('slot: no content')) throw new Error('a slot WITH defaultContent was marked absent');
        console.log('empty slots are absent-and-named; defaultContent renders');
      `]);
      if (probe.status !== 0 || !probe.out.includes('empty slots are absent-and-named; defaultContent renders')) {
        throw new Error(`slot probe failed:\n${probe.out}`);
      }
    },
  },
  {
    // UA-margin neutralization: a root that can render as a UA-margined
    // element carries margin: 0 in the emitted CSS on BOTH css surfaces; a
    // root that cannot (Badge: span) carries none.
    id: 'heading-margin-reset',
    claim: 'C1-determinism',
    run: () => {
      if (generate().status !== 0) throw new Error('generate failed');
      const rootBlock = (css: string) => css.slice(css.indexOf('.root {'), css.indexOf('}', css.indexOf('.root {')));
      for (const name of ['Heading', 'Blockquote', 'Divider', 'List']) {
        const css = readFileSync(path.join(SCRATCH, `src/components/${name}/${name}.module.css`), 'utf8');
        if (!rootBlock(css).includes('margin: 0;')) throw new Error(`${name} root lost the UA-margin reset`);
      }
      const badge = readFileSync(path.join(SCRATCH, 'src/components/Badge/Badge.module.css'), 'utf8');
      if (rootBlock(badge).includes('margin: 0;')) throw new Error('Badge (span root — no UA margin) gained a gratuitous reset');
      const probe = run(TSX, ['-e', `
        import fs from 'node:fs';
        import { emitHtml } from './core/emit-html.ts';
        import { ContractSchema } from './scripts/contract-schema.ts';
        import { tokenInventoryFromJson } from './core/tokens.ts';
        const j = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
        const c = ContractSchema.parse(j('contracts/heading.contract.json'));
        const inv = tokenInventoryFromJson(['tokens/primitives.tokens.json','tokens/semantic.tokens.json','tokens/modes/semantic.light.tokens.json','tokens/modes/semantic.dark.tokens.json'].map(j));
        const { css } = emitHtml(c, { tokens: inv, icons: new Map(), contracts: new Map([[c.id, c]]) });
        const root = css.slice(css.indexOf('.heading {'), css.indexOf('}', css.indexOf('.heading {')));
        if (!root.includes('margin: 0;')) throw new Error('html surface lost the UA-margin reset');
        console.log('html surface resets UA margins on the heading root');
      `]);
      if (probe.status !== 0 || !probe.out.includes('html surface resets UA margins')) {
        throw new Error(`heading html probe failed:\n${probe.out}`);
      }
    },
  },
  {
    // a11y.minHitArea is ENFORCED by emitted CSS (declared floor → the
    // centered ::before extension, both css surfaces), and the number FLOWS
    // from the contract (raising it re-emits the raised floor — not
    // hardcoded).
    id: 'hit-area-enforced',
    claim: 'C1-determinism',
    run: () => {
      if (generate().status !== 0) throw new Error('generate failed');
      const css = readFileSync(path.join(SCRATCH, 'src/components/Button/Button.module.css'), 'utf8');
      if (!css.includes('.root::before')) throw new Error('minHitArea ::before extension missing');
      if (!css.includes('width: max(100%, 44px);') || !css.includes('height: max(100%, 44px);')) {
        throw new Error('declared 44px floor not enforced per axis');
      }
      const rootBlock = css.slice(css.indexOf('.root {'), css.indexOf('}', css.indexOf('.root {')));
      if (!rootBlock.includes('position: relative;')) throw new Error('root lost the positioning context for the hit-target extension');
      // The floor flows from the contract.
      editJson('contracts/button.contract.json', (c) => {
        c.a11y.minHitArea = 48;
      });
      if (generate().status !== 0) throw new Error('generate failed after minHitArea edit');
      const raised = readFileSync(path.join(SCRATCH, 'src/components/Button/Button.module.css'), 'utf8');
      if (!raised.includes('max(100%, 48px)')) throw new Error('raised floor did not flow into the emitted CSS');
    },
  },
  {
    // ds.token's size scale is LIVE: each non-default size emits a distinct,
    // non-empty override rule (the dead-prop class: an enum axis that binds
    // nothing renders every value identically).
    id: 'token-size-live',
    claim: 'C1-determinism',
    run: () => {
      if (generate().status !== 0) throw new Error('generate failed');
      const css = readFileSync(path.join(SCRATCH, 'src/components/Token/Token.module.css'), 'utf8');
      const block = (cls: string) => {
        const i = css.indexOf(`.${cls} {`);
        if (i < 0) return null;
        return css.slice(i, css.indexOf('}', i));
      };
      const sm = block('size-sm');
      const lg = block('size-lg');
      if (!sm || !sm.includes('padding-inline: var(--space-inset-y-sm);')) {
        throw new Error('size-sm override missing — the size prop is dead again');
      }
      if (!lg || !lg.includes('font-size: var(--font-control-size-sm);') || !lg.includes('padding-inline: var(--space-inset-x-sm);')) {
        throw new Error('size-lg override missing — the size prop is dead again');
      }
      if (sm === lg) throw new Error('size overrides do not differ');
      // The tsx composes the class (it did even when the prop was dead —
      // the CSS is what makes it live).
      const tsx = readFileSync(path.join(SCRATCH, 'src/components/Token/Token.tsx'), 'utf8');
      if (!tsx.includes('styles[`size-${size}`]')) throw new Error('Token.tsx no longer composes the size class');
    },
  },
  {
    // §3 (theme/mode-axis promotion, P17): a drawn Theme=Light|Dark variant
    // axis is a TOKEN MODE, never a component prop — the mirror image of
    // state promotion. Promotion requires the bounded name table AND
    // structural corroboration; base facts come from the default mode only;
    // mode-excluded variants never feed the mint pass; per-mode captured-
    // variable values ride the captured-token layer's modes channel (dump
    // v1.6). Near-misses stay enum props with NAMED notes.
    id: 'theme-axis-promotion',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/theme-mode-check.ts']);
      if (r.status !== 0) throw new Error(`theme-mode receipt failed:\n${r.out}`);
      for (const line of [
        '✔ NO `theme` prop ships in the API',
        '✔ contract `modes` metadata names the token modes (["light","dark"])',
        '✔ the promotion is the NAMED §3 receipt (corroboration + mint isolation + rename story spelled out)',
        '✔ base facts bind the REAL variable names from the light variants (background-color = {bg.{variant}}; got {bg.{variant}})',
        '✔ the DARK accent literal mints NOWHERE (#9ec2ff — mode-excluded variants never fabricate a second palette)',
        '✔ {bg.info} RESOLVES per mode — light #eef4ff, dark #0b1d3a (got #eef4ff / #0b1d3a)',
        '✔ the near-miss is a WARNING note naming the first structural difference (2 vs 3 children)',
        '✔ `theme` STAYS an enum prop (uncorroborated promotion never drops an axis silently)',
        '✔ the out-of-vocabulary value is a NAMED note; the axis stays a prop',
        '✔ `variant` ships as an enum prop (default|inverse)',
        '✔ no mode-axis note fires at all (the name table never matches "variant")',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // P9 (repeated-children collections, schema v12 `repeat`): ≥3 adjacent
    // sibling instances of the same child with a carriable per-item field
    // propose as ONE item-template part + arrayOf prop — React maps the live
    // array, the canvas/static surfaces render the OBSERVED sample (the
    // meter discipline). Per-item enum/state differences (P10) and pre-v1.5
    // TEXT/VARIANT-ambiguous keys stay NAMED receipts; "Show item N" count
    // booleans never promote. Receipt runs the REAL owner's-kit
    // Navigation-Header fixture + a v1.5-shaped synthetic run.
    id: 'repeated-children-collection',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/repeat-collection-check.ts']);
      if (r.status !== 0) throw new Error(`repeat receipt failed:\n${r.out}`);
      for (const line of [
        '✔ exactly ONE repeat part proposes for the 5 drawn menu items (got 1)',
        '✔ the sample carries the 5 OBSERVED siblings (got 5)',
        '✔ the arrayOf prop `items` ships code-only (bindings.figma.kind NONE)',
        '✔ the collection carry is the NAMED flagship note (P9, meter discipline spelled out)',
        '✔ the per-item TEXT stays a NAMED ambiguity receipt (pre-v1.5 dump — never guessed)',
        '✔ the "Show item N" count booleans are receipted, never promoted (rename story named)',
        '✔ React maps the LIVE array ({items?.map((item, index) => …iconRight={item.iconRight}…)})',
        '✔ the canvas constructs the OBSERVED instances (5 LinkNeutral sample instances in the sync script)',
        '✔ per-item TEXT carries as a field — the "#id" suffix is TEXT certainty (fields: { children: text })',
        '✔ the sample carries the drawn labels VERBATIM (One/Two/Three/Four)',
        '✔ the varying enum is the P10 receipt (selected-item stays note-gated, never carried)',
        '✔ the static surface renders the OBSERVED sample per item (One…Four appear in the html)',
        '✔ the pattern is DETECTED and the fallback is a NAMED note (no field invented)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },
  {
    // NEITHER LEDGER.md NOR RESIDUALS.md WAS GATED BY ANYTHING. Both are
    // AGGREGATORS — every number in them is read from a committed artifact —
    // so the moment a fidelity round moved fidelity.json, the residual
    // accounting went stale in silence. Measured this round: after the
    // ragged-matrix fix, RESIDUALS.md still reported slider 89.41 (actual
    // 91.18) and dropdown-list-item 87.26 (actual 90.91), and still charged
    // the engine 10.09 points for the slider it had just stopped losing.
    //
    // That matters more than any single number, because RESIDUALS.md is the
    // document that decides which points are ENGINE-fixable and which are
    // INSTRUMENT artifact — a stale copy misdirects the NEXT round's
    // priorities. This is the same guard `figma:fresh` already provides for
    // the emitted figma scripts, and it exists there for the same reason
    // ("MUI's scripts sat three engine fixes stale while the suite stayed
    // green").
    id: 'ledger-and-residuals-are-fresh',
    claim: 'C3-detection',
    run: () => {
      // RUN IN THE REAL REPO, NOT THE SCRATCH COPY. `run()` executes in
      // evals/.scratch, which does not carry examples/untitled-ui/renders/
      // (595 committed PNGs) — so both aggregators crashed on a missing
      // fidelity.json there. The claim is about the bytes COMMITTED in this
      // repo, so the check belongs in this repo.
      for (const [script, doc] of [
        ['extract/figma/ledger/build.ts', 'LEDGER.md'],
        ['extract/figma/ledger/residuals.ts', 'RESIDUALS.md'],
      ]) {
        const r = spawnSync(TSX, [script, '--check'], { cwd: ROOT, encoding: 'utf8' });
        const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
        if ((r.status ?? -1) !== 0) throw new Error(`${doc} is STALE vs a rebuild from its committed sources:\n${out}`);
        if (!out.includes(`${doc} is byte-identical`)) throw new Error(`${doc} freshness check did not report`);
      }

      console.log(
        'ledger-and-residuals-are-fresh: both aggregators re-derive byte-identically from their committed sources. Neither was gated before, and this round proved why — the ragged-matrix fix moved fidelity.json and RESIDUALS.md went on reporting slider 89.41 / engine 10.09 (actually 91.18 / 8.32) with nothing noticing. A one-digit edit makes the check refuse.',
      );
    },
  },
  {
    // THE SUCCESS DOCUMENT IS THE ONE MOST DANGEROUS TO LEAVE UNGATED.
    // `docs/24-what-works.md` is a third aggregator, built on the same rule as
    // LEDGER.md and RESIDUALS.md — every number READ from a committed artifact,
    // nothing typed in. It differs from them in one respect that decides how it
    // must be gated: its output is FLATTERING NUMBERS, and it is the document
    // an adopter is most likely to read and least likely to re-derive.
    //
    // A stale RESIDUALS.md misdirects the next round's priorities, which is
    // bad. A stale 24-what-works.md makes favourable claims the repo can no
    // longer support, to an outside reader, in this repo's own voice. It reads
    // as current because it has no date on it — that is deliberate (a clock
    // would break determinism) and it is exactly what makes the freshness gate
    // load-bearing rather than tidy.
    //
    // The gate also covers the document's CROSS-CHECK section: §8 derives
    // eighteen numbers twice from independent artifacts (the filesystem, and
    // the coverage table in docs/22 §8.3 written months earlier for another
    // purpose) and PRINTS disagreements instead of resolving them. Because a
    // disagreement changes the rendered bytes, this check goes red when two
    // sources drift apart — not only when a number moves.
    id: 'capability-report-is-fresh',
    claim: 'C3-detection',
    run: () => {
      // RUN IN THE REAL REPO, NOT THE SCRATCH COPY — same reason as the
      // ledger check above: `run()` executes in evals/.scratch, which does not
      // carry examples/untitled-ui/renders/. The claim is about the bytes
      // COMMITTED in this repo, so the check belongs in this repo.
      const r = spawnSync('node', ['scripts/build-capability-report.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      if ((r.status ?? -1) !== 0) throw new Error(`docs/24-what-works.md is STALE vs a rebuild from its committed sources:\n${out}`);
      if (!out.includes('docs/24-what-works.md is byte-identical')) throw new Error('capability report freshness check did not report');

      // A GREEN FRESHNESS CHECK ON A DOCUMENT THAT SILENTLY DROPPED ITS
      // HONESTY SECTIONS WOULD STILL BE GREEN. The freshness gate only proves
      // the bytes match a rebuild; it cannot notice that the rebuild stopped
      // printing the denominator. So assert the load-bearing sentences are
      // present, by name. These are the ones whose ABSENCE turns this file
      // from a measurement into marketing.
      const doc = readFileSync(path.join(ROOT, 'docs/24-what-works.md'), 'utf8');
      for (const required of [
        'Read every percentage on this page as "on the easy', // the denominator caveat, inline
        '## 2. The denominator, first',                        // and printed BEFORE the means
        '## 7. What the sources cannot answer',                // sources that cannot answer say so
        '## 8. Cross-checks',                                  // derived twice, disagreements printed
        'is never resolved toward the more flattering',        // the tie-break rule, stated
        '23-known-limitations.md',                             // the cost document, linked
      ]) {
        if (!doc.includes(required)) throw new Error(`docs/24-what-works.md no longer contains its honesty guard: ${JSON.stringify(required)}`);
      }
      // THE CAVEAT MUST APPEAR MORE THAN ONCE — under §2 and again under the
      // fidelity table in §3. A single mention at the top is the shape a reader
      // scrolls past.
      const caveats = doc.split('Read every percentage on this page as "on the easy').length - 1;
      if (caveats < 2) throw new Error(`the coverage caveat appears ${caveats}×; it must be printed inline under EVERY table that averages over captured components`);
      if (doc.includes('**✘ DISAGREE**')) throw new Error('docs/24-what-works.md reports a cross-check DISAGREEMENT — two artifacts that must agree do not. Reconcile the artifacts.');

      console.log(
        `capability-report-is-fresh: docs/24-what-works.md re-derives byte-identically from its committed sources, prints the coverage denominator ${caveats}× inline, names what its sources cannot answer, and reports no cross-check disagreement. It is the success-side counterpart to the 23 doc and the only aggregator here whose output is flattering — so it is gated on its honesty sections, not just its bytes.`,
      );
    },
  },

  {
    // A REFUSAL THAT NAMES THE WRONG DESTINATION is worse than no refusal: it
    // tells a reviewer the case is handled. fuse.ts refused a part with no
    // default-plane observations as "interaction-only part — state rounds own
    // it". The state round diffs an interaction plane AGAINST the default
    // plane, so a part with no default-plane element fails its guard and is
    // dropped there too — the receipt pointed straight at the door that
    // discards the fact.
    //
    // MEASURED on carbon's Accordion (offline re-fuse, extract:computed:regate
    // --component Accordion): 10 such receipts on `accordion__wrapper-2`, and
    // the part ships in the anatomy with `description` + `declared` only — no
    // tokens, no states. A probe at the drop site found the sentence wrong
    // TWICE: the part is not interaction-only, it is absent from BOTH the
    // default and every interaction plane (3 parts × 3 interactions = 9 drops).
    // The first cut of the fix fired only on `!d0 && d1` and was DEAD CODE for
    // a case that does not occur; the corrected receipt reports the measured
    // one.
    //
    // The behavioural check is the on-demand regate (Chromium, deliberately
    // not in this suite — see shipped-contract-refs-resolve). This is the cheap
    // regression half: the false promise must not come back, and both writers
    // must keep surfacing the drop.
    id: 'no-receipt-names-a-door-that-drops-it',
    claim: 'C2-refusal',
    run: () => {
      const fuse = readFileSync(path.join(ROOT, 'extract/computed/fuse.ts'), 'utf8');
      // Match the retired receipt AS A STRING LITERAL — note the trailing
      // apostrophe. fuse.ts's own comments quote the old wording (twice) to
      // explain why it was wrong, and two successive attempts at a plainer
      // substring match tripped on those quotations rather than on a
      // reintroduction. A comment never ends the phrase with a closing quote;
      // the receipt literal always does.
      if (fuse.includes("— state rounds own it'")) {
        throw new Error('fuse.ts reintroduced the retired receipt "(interaction-only part) — state rounds own it" — a refusal naming a destination that drops the fact');
      }
      if (!fuse.includes('planeAbsentDrops')) throw new Error('fuse.ts no longer records planeAbsentDrops');
      if (!/absent from BOTH the default and \$\{interaction\} planes/.test(fuse)) {
        throw new Error('fuse.ts no longer names the MEASURED case (both planes absent)');
      }
      for (const w of ['extract/computed/run.ts', 'extract/computed/regate.ts']) {
        const src = readFileSync(path.join(ROOT, w), 'utf8');
        if (!src.includes('interactionOnlyPlaneDrops')) throw new Error(`${w} stopped surfacing interactionOnlyPlaneDrops`);
      }
      console.log(
        'no-receipt-names-a-door-that-drops-it: fuse.ts refused parts with no default-plane observation as "interaction-only — state rounds own it", and the state round drops exactly those parts (it diffs against the default plane, which they have no element in). Measured on carbon Accordion: 10 receipts on accordion__wrapper-2, which ships with declared facts only; a probe showed the sentence wrong twice over — the part is absent from BOTH planes, 3 parts × 3 interactions = 9 drops now named at the door where they happen. COMMITTED ARTIFACTS STILL CARRY THE OLD TEXT until their library is re-captured (the harness needs each library\'s dev server); this pin guards the source so the false promise cannot return.',
      );
    },
  },

  {
    // The CSS-vars reader walks document.styleSheets and BOTH of its reads
    // swallowed a throw (`catch {}` and `catch { continue; }`). A cross-origin
    // <link> — how a great many design systems ship CSS — exposes no cssRules
    // at all, so the whole sheet vanished from the reader while
    // source-bindings.json printed `skips: []`: the artifact asserting
    // completeness over a read it never made. THIRD instance of this class in
    // that one file (the calc blanket skip and the shorthand ceiling were the
    // first two, and both of their comments say the same thing). The gate
    // evaluates the REAL reader source against a genuinely cross-origin sheet,
    // not a re-implementation of the catch.
    id: 'reader-names-what-it-could-not-read',
    claim: 'C2-refusal',
    run: () => {
      const r = run(TSX, ['extract/computed/stylesheet-ceiling-check.ts']);
      if (r.status !== 0) throw new Error(`read-boundary receipt failed:\n${r.out}`);
      for (const line of [
        '✔ the unreadable sheet is COUNTED, not swallowed',
        '✔ and the receipt NAMES the sheet by href (so a reader can tell WHICH CSS was missed)',
        '✔ a fully readable page records ZERO skips — the ceiling tracks the READ, not the page',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
      console.log(
        'reader-names-what-it-could-not-read: a cross-origin stylesheet throws on .cssRules and used to vanish from the CSS-vars reader in total silence, while source-bindings.json printed `skips: []` and the console printed `0 named skip(s)`. It is now a counted, href-named ceiling (stylesheetCeiling / stylesheetSkips) beside the shorthand and calc ceilings, so "the library declared no token names" and "the reader could not look" are different, visible facts. Proven against the REAL reader source (the exported captureJs) driven at a genuinely cross-origin sheet; restoring the silent catch fails three of the four pins while the control still passes.',
      );
    },
  },

  {
    // Figma's ConstraintType is MIN|CENTER|MAX|STRETCH|SCALE; both dump capture
    // sites mapped only the first three, so a STRETCH/SCALE node had its WHOLE
    // constraints field dropped — and propose reads an absent field as
    // `?? 'LEFT'` / `?? 'TOP'`. That does not lose a fact, it SUBSTITUTES one.
    // MEASURED: of 811 absBoxOf-visible boxes in the committed dumps, 352 carry
    // no constraints field. (Untitled UI's Progress-circle ring is the
    // CANDIDATE that surfaced it — equal insets in 6 of its 16 occurrences —
    // but that is consistent with a stretch, not proof: STRETCH permits ANY
    // fixed insets.) propose has always carried a refusal for
    // this and a plugin dump could NEVER reach it; the only fixture that does
    // is a HAND-AUTHORED conformance case containing a value the real capture
    // cannot emit — a green gate over a dead path, the POLYGON shape again.
    id: 'constraints-reach-the-decision',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/constraints-check.ts']);
      if (r.status !== 0) throw new Error(`constraints receipt failed:\n${r.out}`);
      for (const line of [
        '✔ STRETCH pins BOTH edges on both axes (left+right / top+bottom)',
        '✔ a STRETCHED axis bakes NO width/height (a size would freeze the resize the constraint expresses)',
        '✔ SCALE is REFUSED BY NAME, and the reason says why CSS cannot spell it',
        '✔ the LEFT×TOP assumption is NAMED (it used to be silent)',
        '✔ geometry is UNCHANGED (top-left + baked size) — naming the assumption moves no corpus',
        '✔ an EXPLICIT LEFT×TOP emits no assumption note (the note tracks the missing field, not the value)',
        // The contradiction an adversarial probe caught: skipping only the size
        // MINT let a BOUND width survive beside left+right, and CSS resolves an
        // over-constrained box by DROPPING an edge — which edge flips under
        // `direction: rtl` — so the box froze at its drawn size while the note
        // still claimed it tracked its parent, and the canvas leg disagreed.
        '✔ and the box does NOT ship left+right+width together (CSS would silently drop an edge)',
        '✔ the contradiction is NAMED',
        '✔ the VERTICAL axis (unbound) still stretches — the refusal is per-axis, not whole-part',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
      console.log(
        'constraints-reach-the-decision: dump v1.13 spells all FIVE ConstraintType values, so STRETCH/SCALE stop being dropped at capture. STRETCH is CARRIED as both edges with no baked size (CSS left+right — the box tracks its parent, which a frozen width destroyed); SCALE keeps its named refusal (CSS has no proportional resize on a positioned box); an ABSENT field keeps today\'s LEFT×TOP geometry — no corpus moves — but the ASSUMPTION IS NAMED. NAMED LIMITS: (1) a dump already taken cannot be repaired — of 811 absBoxOf-visible boxes in the committed corpora, 352 carry no constraints field and need a RE-CAPTURE at v1.13+ before a STRETCH box can be told from a real top-left pin; (2) a STRETCH axis whose size is ALREADY BOUND is a contradiction, so the design\'s binding wins and the stretch is refused on that axis, BY NAME; (3) with STRETCH now reaching the mixed-constraint check, a set mixing STRETCH with another value refuses the whole placement rather than carrying a wrong one — correct, but a behaviour no committed corpus can exercise until a re-capture exists.',
      );
    },
  },

  {
    id: 'wrapping-survives-the-round-trip',
    claim: 'C5-extraction',
    // core/emit-figma-script.ts has written `node.layoutWrap = 'WRAP'` from a
    // contract's `layout.wrap` since v15, and the dump never read the field
    // back — so code→design carried wrapping and design→code silently deleted
    // it, with no degradation and no note. Exactly ONE of 804 committed
    // contracts uses `layout.wrap` (ds.composite-modal's tags row — the very
    // archetype), so it was reproducible against a committed artifact all
    // along; what was missing was a GATE. dump v1.12 reads it; this pins both
    // legs, including the CENTERED root an adversarial probe caught the first
    // cut silently dropping.
    run: () => {
      const r = run(TSX, ['extract/figma/wrap-check.ts']);
      if (r.status !== 0) throw new Error(`wrap receipt failed:\n${r.out}`);
      for (const line of [
        '✔ root proposes layout.wrap: true (the fact the return leg used to delete)',
        '✔ CSS emits `flex-wrap: wrap` on the root',
        "✔ the figma script writes layoutWrap 'WRAP' (code→design still carries it)",
        '✔ the un-carriable ROW gap is a NAMED note (one `gap` covers both axes, as it does in Figma)',
        '✔ layout.wrap is NOT set (wrap holds in only half the variants — never guessed)',
        '✔ the mixed-wrap limit is a NAMED note',
        '✔ no wrap key on a non-wrapping stack',
        // THE REGRESSION PIN. The first cut of this fix appended the wrap carry
        // BELOW invertLayout's isRoot early return, so a CENTERED wrapping root
        // — the motivating case, and the only shape a wrapping root can take,
        // since layoutWrap is HORIZONTAL-only — produced no layout, no note and
        // no degradation. The gate certified a leg it never tested.
        '✔ a CENTERED wrapping root still carries layout.wrap (the early return no longer swallows it)',
        '✔ and a CENTERED non-wrapping root still proposes NO layout block (the early return is intact)',
        '✔ a NESTED wrapping part carries layout.wrap',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
      console.log(
        'wrapping-survives-the-round-trip: layoutWrap is READ BACK (dump v1.12) — uniform wrap carries as layout.wrap and closes the loop through CSS `flex-wrap: wrap` and the canvas script; a MIXED wrap is a per-part invariant that is refused BY NAME rather than resolved by the default variant; a DISTINCT counterAxisSpacing has no schema spelling and is NAMED. The capture half is pinned against the REAL dump source in plugin-engine-check (a falsification probe that deletes the capture fails it).',
      );
    },
  },

  {
    // GRADIENT_LINEAR fills, textCase, and the U+2024 name fold (dump v1.16 —
    // the Eventz #21 close). The contract→canvas leg had parsed CSS
    // linear-gradients into native GRADIENT_LINEAR paints since v15
    // (parseCssGradient) while the design-side capture refused EVERY gradient
    // at the dump (`paint-unsupported` — solid paints only), so the Badge
    // accent/info/warning/featured grounds rendered NOTHING and badge scored
    // 23.5. The same capture dropped textCase UPPER ("Label" for "LABEL")
    // and refused 16 bindings of U+2024-named variables ("spacing/1․5").
    // This pins the design-side half end to end on synthetic dumps:
    // axis-aligned ramps carry EXACTLY (visible-segment normalization — the
    // Eventz handles overshoot the box, and a naive full-ramp spelling would
    // repaint half the ground), oblique ramps refuse BY NAME (the CSS angle
    // is a function of the box's aspect ratio), and both new carries
    // round-trip through the SAME engine the plugin runs. The live proof is
    // examples/eventz-vars (badge 23.5 → 61.2, NOTES.md receipts).
    id: 'design-gradient-textcase-carriage',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/gradient-fill-check.ts']);
      if (r.status !== 0) throw new Error(`gradient/textCase receipt failed:\n${r.out}`);
      for (const line of [
        '✔ root tokens carry background-image as a substituted per-variant ref',
        '✔ the Grad leaf is the VISIBLE-SEGMENT spelling — edge colors interpolated on the ramp (#808080 at 0%), stops inside the grammar',
        "✔ the Plain leaf mints 'none' (its ground rides background-color)",
        '✔ a 3-stop ramp remaps its interior stop into the segment (0.75 → 50%)',
        '✔ CSS emits per-variant background-image vars',
        '✔ the Grad variant compiles a native GRADIENT_LINEAR paint (angle 270, 2 stops, no gradientMiss)',
        "✔ the Plain variant compiles NO gradient layer ('none' round-trips clean, no gradientMiss)",
        '✔ the refusal is NAMED with the raw handles (box-aspect-dependent angle)',
        '✔ uniform textCase UPPER → declared text-transform: uppercase on the Label part',
        '✔ the Label spec carries textCase UPPER (declared text-transform round-trips)',
        '✔ a MIXED case axis proposes nothing and is NAMED (never sampled)',
        "✔ the binding CARRIES as {spacing.1-5} (was: 'outside the token-ref grammar', binding not proposed)",
        '✔ the fold is a NAMED RENAME, one receipt per variable per set',
        '✔ the captured-token layer registers the SAME fold (refs resolve end to end), original name kept on the entry',
        '✔ a fold target another variable owns REFUSES registration by name (the occupant keeps the path)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
      console.log(
        'design-gradient-textcase-carriage: dump v1.16 captures GRADIENT_LINEAR fills (handles + stops, both producers) and textCase — axis-aligned ramps carry as background-image minted gradient leaves normalized to the visible segment and round-trip to native GRADIENT_LINEAR paints; oblique ramps refuse BY NAME with the raw handles; textCase carries as declared text-transform when uniform; U+2024 variable names fold to a NAMED rename that resolves end to end, with fold-target collisions refused at registration.',
      );
    },
  },

  {
    // P21 (overlap collections): negative auto-layout spacing must NEVER
    // mint a plain negative-px gap token (`gap: -8px` is invalid CSS and the
    // overlap silently vanished — the pre-P21 bug). Uniform negative spacing
    // inverts to the existing `layout.overlap` vocabulary with the drawn
    // magnitude on the gap token (the ds.avatar-group owner-precedent:
    // {space.overlap} = -8px, projected as a negative child margin / negative
    // itemSpacing); mixed-sign spacing is a NAMED per-part-invariant limit.
    // Receipt replays the owner's live Avatar group census fixture.
    id: 'negative-spacing-overlap',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/overlap-check.ts']);
      if (r.status !== 0) throw new Error(`overlap receipt failed:\n${r.out}`);
      for (const line of [
        '✔ root proposes layout.overlap: true (children OVERLAP — P21)',
        '✔ the overlap carry is a NAMED note (owner-precedent projection spelled out)',
        '✔ the minted gap token carries the DRAWN magnitude -8px (got -8px)',
        '✔ CSS projects the overlap as a negative CHILD MARGIN (.root > * + * { margin-left: … })',
        '✔ CSS never emits the invalid `gap:` declaration for the overlap token',
        '✔ the mixed-sign limit is a NAMED note (per-part invariant, gap NOT minted)',
        '✔ layout.overlap is NOT set (overlap holds in only half the variants — never guessed)',
        '✔ NO negative px token mints anywhere (got 0; the pre-P21 bug class is gone)',
        '✔ the unbound itemSpacing report SURVIVES for review',
        '✔ the bound-negative channel keeps its existing NAMED refusal (illegal variable name — rename or map manually)',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing check: ${line}`);
      }
    },
  },

  // -------------------------------------------------------------------------
  // POLARIS SHOWCASE (examples/polaris) — the Phase A end-to-end artifact.
  // -------------------------------------------------------------------------
  {
    // COVERAGE ROUND workstream 1: var() chains resolve to SAME-PACKAGE
    // literal definitions (depth-capped, cycles refused BY NAME, bounded
    // calc() evaluated deterministically) — and the committed contracts
    // carry the resulting facts (ProgressBar per-size heights, Avatar
    // per-size widths) as schema-v14 literals with provenance.
    id: 'var-chain-resolution',
    claim: 'C5-extraction',
    run: () => {
      const rules = parseModuleCss(`
        .Root {
          --base: 16px;
          --alias: var(--base);
          --half: calc(var(--base) * 0.5);
          --loop-a: var(--loop-b);
          --loop-b: var(--loop-a);
          --tok: var(--p-space-100);
        }
      `);
      const defs = customPropDefs(rules, new Set(['Root']));
      const lookup: TokenLookup = {
        pathOfVar: (v) => (v === 'p-space-100' ? 'p.space-100' : undefined),
      };
      const chain = resolveToRef('var(--alias)', defs, lookup);
      if (chain.kind !== 'literal' || chain.value !== '16px') {
        throw new Error(`chain literal: expected 16px literal, got ${JSON.stringify(chain)}`);
      }
      if (!chain.via.includes('--alias') || !chain.via.includes('--base') || chain.defSelector !== '.Root') {
        throw new Error(`chain literal provenance missing: ${JSON.stringify(chain)}`);
      }
      const calc = resolveToRef('var(--half)', defs, lookup);
      if (calc.kind !== 'literal' || calc.value !== '8px') {
        throw new Error(`calc over resolved literal: expected 8px, got ${JSON.stringify(calc)}`);
      }
      const cyc = resolveToRef('var(--loop-a)', defs, lookup);
      if (cyc.kind !== 'refused' || !cyc.reason.includes('var() cycle') || !cyc.reason.includes('--loop-a')) {
        throw new Error(`cycle must refuse BY NAME, got ${JSON.stringify(cyc)}`);
      }
      const tok = resolveToRef('var(--tok)', defs, lookup);
      if (tok.kind !== 'ref' || tok.ref !== '{p.space-100}') {
        throw new Error(`token chains must still resolve to refs, got ${JSON.stringify(tok)}`);
      }
      const raw = resolveToRef('4px', defs, lookup);
      if (raw.kind !== 'refused' || !raw.reason.includes('never turned into an invented token')) {
        throw new Error(`a RAW literal (no chain) must still refuse, got ${JSON.stringify(raw)}`);
      }
      // The committed contracts carry the resolved facts.
      const pb = JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/contracts/progress-bar.contract.json'), 'utf8'));
      const pbMap = pb.anatomy.root.literalsByProp?.[0];
      if (pbMap?.prop !== 'size' || pbMap.map.small?.height !== '8px' || pbMap.map.medium?.height !== '16px' || pbMap.map.large?.height !== '32px') {
        throw new Error(`progress-bar per-size literal heights not carried: ${JSON.stringify(pb.anatomy.root.literalsByProp)}`);
      }
      const av = JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/contracts/avatar.contract.json'), 'utf8'));
      const avMap = av.anatomy.root.literalsByProp?.[0];
      if (avMap?.prop !== 'size' || avMap.map.xs?.width !== '20px' || avMap.map.xl?.width !== '40px') {
        throw new Error(`avatar per-size literal widths not carried: ${JSON.stringify(av.anatomy.root.literalsByProp)}`);
      }
      // NARROWED refusals: unresolvable vars name their class.
      const ledger = readFileSync(path.join(ROOT, 'examples/polaris/extraction/PROMOTION.md'), 'utf8');
      if (!ledger.includes('is RUNTIME-SET')) throw new Error('no RUNTIME-SET narrowed refusal in PROMOTION.md');
      if (!/MEDIA-DEPENDENT|defined only in other class contexts/.test(ledger)) {
        throw new Error('no narrowed media/class-context refusal in PROMOTION.md');
      }
    },
  },
  {
    // COVERAGE ROUND workstream 2: composition-owned typography — Button's
    // label typography flows through Polaris's Text primitive; the chain is
    // deterministic (literal props in Button.tsx), so the committed contract
    // carries it, resolved from Text's OWN CSS; runtime/multi-axis branches
    // are refused by name in the ledger.
    id: 'composition-typography-carry',
    claim: 'C5-extraction',
    run: () => {
      const btn = JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/contracts/button.contract.json'), 'utf8'));
      const label = btn.anatomy.root.parts?.label;
      if (!label) throw new Error('button contract has no label part');
      if (label.tokens?.['font-size'] !== '{p.text-body-sm-font-size}') {
        throw new Error(`label font-size not carried through Text: ${JSON.stringify(label.tokens)}`);
      }
      if (label.tokens?.['font-weight'] !== '{p.font-weight-medium}') {
        throw new Error(`label font-weight not carried through Text: ${JSON.stringify(label.tokens)}`);
      }
      const entries = Array.isArray(label.tokensByProp) ? label.tokensByProp : [label.tokensByProp].filter(Boolean);
      const sizeEntry = entries.find((e: { prop: string }) => e.prop === 'size');
      if (sizeEntry?.map?.large?.['font-size'] !== '{p.text-body-md-font-size}') {
        throw new Error(`size=large bodyMd upgrade not carried: ${JSON.stringify(entries)}`);
      }
      const variantEntry = entries.find((e: { prop: string }) => e.prop === 'variant');
      if (variantEntry?.map?.plain?.['font-weight'] !== '{p.font-weight-regular}') {
        throw new Error(`variant=plain regular weight not carried: ${JSON.stringify(entries)}`);
      }
      const ledger = readFileSync(path.join(ROOT, 'examples/polaris/extraction/PROMOTION.md'), 'utf8');
      if (!ledger.includes('media-dependent RUNTIME branch')) {
        throw new Error('the mdUp fontWeight branch must be a named refusal');
      }
      if (!ledger.includes('conditioned on BOTH variant and size')) {
        throw new Error('the plain+size bodyMd branch must be a named two-axis refusal');
      }
      // Banner title rides Text headingSm the same way. Round 4: the title
      // sits at its PROMOTED nesting position (root › … › ribbon row), so
      // the pin walks the anatomy for it instead of assuming a flat path.
      const banner = JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/contracts/banner.contract.json'), 'utf8'));
      let bannerTitle: { tokens?: Record<string, string> } | null = null;
      const findTitle = (name: string, part: { tokens?: Record<string, string>; parts?: Record<string, never> }) => {
        if (name === 'title') bannerTitle = part;
        for (const [n, c] of Object.entries(part.parts ?? {})) findTitle(n, c);
      };
      for (const [n, c] of Object.entries(banner.anatomy)) findTitle(n, c as never);
      if (!bannerTitle || (bannerTitle as { tokens?: Record<string, string> }).tokens?.['font-size'] !== '{p.text-heading-sm-font-size}') {
        throw new Error('banner title headingSm typography not carried');
      }
    },
  },
  {
    // COVERAGE ROUND workstream 3: multiple tokensByProp entries per part —
    // ordered later-wins semantics, and the refusal rules: a conflicting
    // channel+prop pair (same prop AND same channel in two entries, within
    // tokensByProp or across tokensByProp/literalsByProp) refuses BY NAME.
    id: 'multi-tokensbyprop-refusals',
    claim: 'C2-refusal',
    run: () => {
      const mk = (rootExtra: Record<string, unknown>): SchemaContract =>
        ContractSchema.parse({
          id: 'ds.evalfixture',
          name: 'EvalFixture',
          version: '1.0.0',
          description: 'Eval fixture.',
          semantics: { element: 'div' },
          props: [
            {
              name: 'size',
              type: { enum: ['sm', 'lg'] },
              default: 'sm',
              bindings: { figma: { kind: 'VARIANT', property: 'Size' }, code: { prop: 'size' } },
            },
            {
              name: 'variant',
              type: { enum: ['a', 'b'] },
              default: 'a',
              bindings: { figma: { kind: 'VARIANT', property: 'Variant' }, code: { prop: 'variant' } },
            },
          ],
          anatomy: { root: rootExtra },
          anchors: {
            figma: { fileKey: null, componentSetKey: null },
            code: { importPath: 'src/components/EvalFixture', export: 'EvalFixture' },
          },
        });
      // Ordered later-wins: two entries on DIFFERENT props overriding the
      // same channel — the later entry wins for a combo carrying both.
      const ok = mk({
        tokens: { color: '{color.text.primary}' },
        tokensByProp: [
          { prop: 'variant', map: { b: { color: '{color.text.secondary}' } } },
          { prop: 'size', map: { lg: { color: '{color.text.tertiary}' } } },
        ],
      });
      const errs: string[] = [];
      coreValidateContract(ok, new Map([[ok.id, ok]]), errs, new Map());
      if (errs.length > 0) throw new Error(`clean multi-entry contract must validate: ${errs.join('; ')}`);
      const resolved = schemaResolveTokens(ok.anatomy.root as SchemaPart, { variant: 'b', size: 'lg' });
      if (resolved.color !== '{color.text.tertiary}') {
        throw new Error(`later entry must win per channel, got ${resolved.color}`);
      }
      const resolvedFirst = schemaResolveTokens(ok.anatomy.root as SchemaPart, { variant: 'b', size: 'sm' });
      if (resolvedFirst.color !== '{color.text.secondary}') {
        throw new Error(`non-overridden combo must keep the earlier entry, got ${resolvedFirst.color}`);
      }
      // Conflicting channel+prop pair — refused by name.
      const conflict = mk({
        tokensByProp: [
          { prop: 'size', map: { sm: { color: '{color.text.primary}' } } },
          { prop: 'size', map: { lg: { color: '{color.text.secondary}' } } },
        ],
      });
      const errs2: string[] = [];
      coreValidateContract(conflict, new Map([[conflict.id, conflict]]), errs2, new Map());
      if (!errs2.some((e) => e.includes('conflicting channel+prop pair'))) {
        throw new Error(`same prop+channel in two entries must refuse by name; got: ${errs2.join('; ') || '(none)'}`);
      }
      // Cross-kind conflict (tokensByProp vs literalsByProp) — refused too.
      const crossKind = mk({
        tokensByProp: { prop: 'size', map: { sm: { height: '{size.control.sm}' } } },
        literalsByProp: [{ prop: 'size', map: { lg: { height: '32px' } } }],
      });
      const errs3: string[] = [];
      coreValidateContract(crossKind, new Map([[crossKind.id, crossKind]]), errs3, new Map());
      if (!errs3.some((e) => e.includes('conflicting channel+prop pair'))) {
        throw new Error(`token/literal same prop+channel must refuse by name; got: ${errs3.join('; ') || '(none)'}`);
      }
      // Literal channel whitelist — box-shadow is not a literal channel.
      const badChannel = mk({ literals: { 'box-shadow': '0px' } });
      const errs4: string[] = [];
      coreValidateContract(badChannel, new Map([[badChannel.id, badChannel]]), errs4, new Map());
      if (!errs4.some((e) => e.includes('not a literal channel'))) {
        throw new Error(`non-whitelisted literal channel must refuse by name; got: ${errs4.join('; ') || '(none)'}`);
      }
      // Token + literal on the SAME base channel — ambiguous, refused.
      const dupBase = mk({
        tokens: { height: '{size.control.sm}' },
        literals: { height: '16px' },
      });
      const errs5: string[] = [];
      coreValidateContract(dupBase, new Map([[dupBase.id, dupBase]]), errs5, new Map());
      if (!errs5.some((e) => e.includes('BOTH a token binding and a literal'))) {
        throw new Error(`token+literal same base channel must refuse by name; got: ${errs5.join('; ') || '(none)'}`);
      }
      // The committed Text contract exercises the lift: variant AND
      // fontWeight maps, in CSS source order (fontWeight later — Polaris's
      // own cascade comment).
      const text = JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/contracts/text.contract.json'), 'utf8'));
      const tEntries = text.anatomy.root.tokensByProp;
      if (!Array.isArray(tEntries)) throw new Error('text contract must carry MULTIPLE tokensByProp entries');
      const props = tEntries.map((e: { prop: string }) => e.prop);
      if (!(props.includes('variant') && props.includes('fontWeight') && props.includes('tone'))) {
        throw new Error(`text must carry variant+fontWeight+tone maps, got ${props.join(',')}`);
      }
      if (props.indexOf('fontWeight') < props.indexOf('variant')) {
        throw new Error('fontWeight entry must come AFTER variant (CSS source order — later wins)');
      }
    },
  },
  {
    // COVERAGE ROUND workstream 4: the filed Phase B emitter bugs are dead
    // at the source — the emitted token script parses rgb()/rgba() verbatim
    // values (alpha preserved), the emitted shape branch carries stroke +
    // bindings and clears the default paint, and the Figma emitter binds the
    // `background` channel the HTML surface always carried (Avatar).
    id: 'rgba-stroke-emitter-fixes',
    claim: 'C1-determinism',
    run: () => {
      const tokensScript = readFileSync(path.join(ROOT, 'examples/polaris/figma/00-tokens.figma.js'), 'utf8');
      const m = tokensScript.match(/function hexToRgb[\s\S]*?\n\}/);
      if (!m) throw new Error('00-tokens.figma.js has no hexToRgb');
      const hexToRgb = new Function(`${m[0].replace('function hexToRgb', 'function __f')}; return __f;`)() as (
        v: string,
      ) => { r: number; g: number; b: number; a?: number };
      const rgba = hexToRgb('rgba(0, 0, 0, 0.71)');
      if (rgba.r !== 0 || rgba.a !== 0.71) throw new Error(`emitted parser must accept rgba(): ${JSON.stringify(rgba)}`);
      const rgb = hexToRgb('rgb(145, 208, 255)');
      if (Math.abs(rgb.g - 208 / 255) > 1e-9) throw new Error(`emitted parser must accept rgb(): ${JSON.stringify(rgb)}`);
      const hex = hexToRgb('#ff0000');
      if (hex.r !== 1 || hex.g !== 0) throw new Error(`emitted parser must still accept hex: ${JSON.stringify(hex)}`);
      // NaN channels (the Phase B live failure) are impossible for either spelling.
      for (const v of ['rgba(255, 255, 255, 1)', '#00000012']) {
        const c = hexToRgb(v);
        if ([c.r, c.g, c.b].some(Number.isNaN)) throw new Error(`NaN channel for ${v}`);
      }
      // Shape branch: stroke + bindings + default-paint clear (checkbox).
      const checkbox = readFileSync(path.join(ROOT, 'examples/polaris/figma/checkbox.figma.js'), 'utf8');
      const shapeBranch = checkbox.slice(checkbox.indexOf("spec.type === 'shape'"));
      // FC-PSEUDO-STROKE-GLYPH added an INNER `if (spec.svg) { … } else {`
      // split inside the shape branch, so slicing at the first '} else {'
      // truncated the branch before the parametric body this pin asserts on
      // (the instrument, not the emitter, went stale). The branch's real end
      // is the OUTER two-space-indented `} else {` (the frame default arm).
      const shapeBody = shapeBranch.slice(0, shapeBranch.indexOf('\n  } else {'));
      if (!shapeBody.includes('spec.stroke')) throw new Error('shape branch must apply spec.stroke');
      if (!shapeBody.includes('spec.bindings')) throw new Error('shape branch must apply spec.bindings');
      // Round 5f (B5E finding 2): the shape branch applies a LITERAL fill
      // (spec.lits.fillColor — the RadioButton dot white) at source, and still
      // CLEARS the default gray paint when neither a bound fill nor a literal
      // fill is carried (the checkbox backdrop with only a stroke).
      if (!shapeBody.includes('spec.lits.fillColor')) {
        throw new Error('shape branch must apply the literal fill (lits.fillColor) — B5E finding 2 (radio dot white)');
      }
      if (!shapeBody.includes('[boundPaint(spec.fill, node)]') || !/:\s*\[\]/.test(shapeBody)) {
        throw new Error('shape branch must bind spec.fill and clear ([]) the default paint when no fill/literal is carried');
      }
      // Round 5f (B5E finding 3): applyInsetOverlay lowers ONLY childless
      // BACKDROP overlays to index 0; a CONTENT overlay (the check glyph) stays
      // ON TOP — else the opaque backdrop paints over the glyph (z-order fix at
      // source, not a per-session canvas correction).
      if (checkbox.includes('function applyInsetOverlay(')) {
        const io = checkbox.slice(checkbox.indexOf('function applyInsetOverlay('));
        const ioBody = io.slice(0, io.indexOf('\n}'));
        if (!/childNode\.children[\s\S]*length === 0[\s\S]*insertChild\(0/.test(ioBody)) {
          throw new Error('applyInsetOverlay must guard the index-0 lowering to CHILDLESS backdrops — a content overlay (check glyph) would be painted over by the backdrop (B5E finding 3)');
        }
      }
      // Cross-generator carry: Avatar's background binds on the canvas too.
      const avatarScript = readFileSync(path.join(ROOT, 'examples/polaris/figma/avatar.figma.js'), 'utf8');
      if (!avatarScript.includes('"fill": "p/color-avatar-one-bg-fill"')) {
        throw new Error('avatar figma script must bind the background fill the HTML surface carries');
      }
    },
  },
  {
    // S4 ROUND 1 (north-star push): the v15 channel lifts land on the CANVAS
    // emitter with the capability-matrix verdicts — per-corner radii and
    // per-side widths BIND (each field is variable-bindable), gradients parse
    // into native GRADIENT_LINEAR paints, shadow stacks (multi-layer + inset)
    // become native effect lists, the A22 text channels draw natively
    // (textCase/textDecoration/textAlignHorizontal/letterSpacing/fontFamily/
    // textTruncation), layout.wrap becomes layoutWrap 'WRAP', and every
    // 'annotate'-verdict declared fact lands as the matrix §b annotation copy
    // in the component description — declared-not-drawn, never dropped. The
    // CSS surfaces render the same facts verbatim.
    id: 's4-canvas-channel-lifts',
    claim: 'C1-determinism',
    run: () => {
      const fixture: any = {
        id: 's4.lifts',
        name: 'S4Lifts',
        version: '1.0.0',
        status: 'draft',
        description: 'S4 channel-lift eval fixture.',
        semantics: { element: 'button' },
        props: [
          { name: 'children', type: 'text', default: 'Lift', bindings: { figma: { kind: 'TEXT', property: 'Label' }, code: { prop: 'children' } } },
          { name: 'variant', type: { enum: ['a', 'b'] }, default: 'a', bindings: { figma: { kind: 'VARIANT', property: 'Variant' }, code: { prop: 'variant' } } },
        ],
        states: ['disabled'],
        anatomy: {
          root: {
            layout: { display: 'flex', wrap: true },
            tokens: {
              'border-top-left-radius': '{s4.radius-tl}',
              'border-top-width': '{s4.bw-top}',
              'border-color': '{s4.border}',
              'background-image': '{s4.grad}',
              'box-shadow': '{s4.shadow-stack}',
            },
            declared: { cursor: 'pointer', 'user-select': 'none', position: 'relative' },
            declaredStates: { disabled: { cursor: 'pointer' } },
            parts: {
              label: {
                content: { prop: 'children' },
                tokens: { 'letter-spacing': '{s4.tracking}', 'font-family': '{s4.family}' },
                declared: {
                  'text-transform': 'uppercase',
                  'text-decoration-line': 'underline',
                  'text-align': 'center',
                  'text-overflow': 'ellipsis',
                },
              },
            },
          },
        },
        anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'src/components/S4Lifts', export: 'S4Lifts' } },
      };
      const parsed = ContractSchema.parse(fixture); // v15 fields are schema vocabulary, not extensions
      const errs: string[] = [];
      coreValidateContract(parsed as any, new Map([[parsed.id, parsed as any]]), errs, new Map());
      if (errs.length > 0) throw new Error('fixture must validate: ' + errs.join('; '));
      // Grammar refusals stay refusals: position outside the relative class,
      // channels outside the registry, values outside the bounded grammar.
      const bad = structuredClone(fixture);
      bad.anatomy.root.declared.position = 'fixed';
      bad.anatomy.root.declared['z-index'] = '3';
      const badErrs: string[] = [];
      coreValidateContract(bad, new Map([[bad.id, bad]]), badErrs, new Map());
      if (!badErrs.some((e) => e.includes('"position"') && e.includes('bounded grammar'))) {
        throw new Error('position: fixed must refuse by grammar; got: ' + badErrs.join('; '));
      }
      if (!badErrs.some((e) => e.includes('"z-index"') && e.includes('not a declared channel'))) {
        throw new Error('z-index must refuse as a non-registry channel; got: ' + badErrs.join('; '));
      }
      const engine = createFigmaEngine({
        tokens: {
          primitives: {
            s4: {
              'radius-tl': { $value: '4px', $type: 'dimension' },
              'bw-top': { $value: '2px', $type: 'dimension' },
              border: { $value: '#112233', $type: 'color' },
              grad: { $value: 'linear-gradient(180deg, #ff0000 0%, rgba(0, 0, 255, 0.5) 100%)', $type: 'gradient' },
              'shadow-stack': { $value: '0px 1px 2px 0px rgba(0, 0, 0, 0.5), inset 0px -1px 0px 1px #112233', $type: 'shadow' },
              tracking: { $value: '0.5px', $type: 'dimension' },
              family: { $value: '"Söhne", "Helvetica Neue", sans-serif', $type: 'fontFamily' },
            },
          },
          semantic: {}, light: {}, dark: {}, brands: { default: {} },
        },
        icons: new Map(),
      });
      const script = engine.buildComponentScript(parsed as any, new Map([[parsed.id, parsed as any]]));
      const comp = JSON.parse(script.match(/const COMPONENTS = (\[[\s\S]*?\n\]);/)![1])[0];
      const va = comp.variants[0].spec;
      if (va.bindings?.topLeftRadius !== 's4/radius-tl') throw new Error('per-corner radius must BIND topLeftRadius');
      if (va.bindings?.strokeTopWeight !== 's4/bw-top') throw new Error('per-side width must BIND strokeTopWeight');
      if (va.layout?.wrap !== true) throw new Error('layout.wrap must compile to LayoutSpec.wrap');
      if (va.gradient?.angle !== 180 || va.gradient.stops.length !== 2) throw new Error('gradient must parse angle + stops: ' + JSON.stringify(va.gradient));
      const stop2 = va.gradient.stops[1];
      if (stop2.position !== 1 || stop2.color.b !== 1 || stop2.color.a !== 0.5) throw new Error('gradient stop 2 must carry rgba + position: ' + JSON.stringify(stop2));
      if (va.effectStack?.length !== 2) throw new Error('shadow stack must parse BOTH layers: ' + JSON.stringify(va.effectStack));
      if (va.effectStack[1].inner !== true || va.effectStack[1].spread !== 1) throw new Error('inset layer must carry inner + spread: ' + JSON.stringify(va.effectStack[1]));
      const label = va.children[0];
      if (label.letterSpacing !== 0.5) throw new Error('letter-spacing must ride the text node (px literal)');
      if (label.textCase !== 'UPPER' || label.textDecoration !== 'UNDERLINE' || label.textAlignH !== 'CENTER') {
        throw new Error('declared text facts must DRAW: ' + JSON.stringify({ c: label.textCase, d: label.textDecoration, a: label.textAlignH }));
      }
      if (label.fontFamily !== 'Söhne') throw new Error('font-family must carry the first stack entry, got ' + label.fontFamily);
      if (label.textTruncation !== true) throw new Error('text-overflow: ellipsis must carry textTruncation');
      for (const marker of ["layoutWrap = 'WRAP'", 'INNER_SHADOW', 'GRADIENT_LINEAR', 'node.textCase = spec.textCase', 'loadFontAsync({ family: spec.fontFamily']) {
        if (!script.includes(marker)) throw new Error('emitted runtime missing: ' + marker);
      }
      // ROUND 4 (owner de-noise directive): descriptions are ONE caption line
      // + a single trailing dagger when code-only facts exist — the
      // capability-matrix paragraphs live in repo receipts only. This pin
      // REPLACES the pre-round-4 assertion that annotation copy landed in the
      // description (the old behavior is retired, not broken).
      if (!/^S4Lifts — generated from contract s4\.lifts v1\.0\.0/.test(comp.description)) {
        throw new Error('description must be the one-line caption, got: ' + JSON.stringify(comp.description).slice(0, 120));
      }
      if (!comp.description.includes('†')) {
        throw new Error('a contract with code-only facts must carry the † footnote marker');
      }
      if (comp.description.includes('Cursor changes')) {
        throw new Error('de-noise regression: capability-matrix annotation copy leaked back into the description');
      }
      if (comp.description.split('\n').length > 2) {
        throw new Error('description must stay a single caption line (+ optional footnote), got ' + comp.description.split('\n').length + ' lines');
      }
      // CSS surfaces render the same facts verbatim (and the declared cursor
      // supersedes the emitter chrome — no invented not-allowed).
      const html = coreEmitHtml(parsed as any, {
        tokens: tokenInventoryFromJson([{ s4: { 'radius-tl': { $value: '4px', $type: 'dimension' } } }]),
        icons: new Map(),
        contracts: new Map([[parsed.id, parsed as any]]),
      });
      for (const rule of ['flex-wrap: wrap', 'cursor: pointer', 'text-transform: uppercase', 'text-decoration-line: underline', 'user-select: none']) {
        if (!html.css.includes(rule)) throw new Error('emit-html missing declared/wrap rule: ' + rule);
      }
      if (html.css.includes('not-allowed')) throw new Error('declared cursor must supersede the built-in :disabled not-allowed chrome');
    },
  },
  {
    // #60 — the four named canvas-emitter defects, each pinned; the fillClear
    // pin EXECUTES the emitted runtime (never just greps it).
    //   1. fillClear precedence: a spec-carried fill is never trampled
    //   2. per-component scripts are AMEND-CAPABLE (shared sync runtime)
    //   3. standalone COMPONENTs amend in place (amendComponent)
    //   4. empty-child runtime-sized geometry gets declared defaults (FILL)
    id: 'figma-60-canvas-emitter-fixes',
    claim: 'C1-determinism',
    run: () => {
      const fixture: any = {
        id: 's4.fillclear',
        name: 'FillClearFx',
        version: '1.0.0',
        status: 'draft',
        description: '#60 fillClear precedence fixture.',
        semantics: { element: 'div' },
        props: [
          { name: 'variant', type: { enum: ['a', 'b'] }, default: 'a', bindings: { figma: { kind: 'VARIANT', property: 'Variant' }, code: { prop: 'variant' } } },
        ],
        states: [],
        anatomy: {
          root: {
            tokensByProp: { prop: 'variant', map: { a: { background: '{fx.bg}' } } },
            literals: { background: 'transparent' },
          },
        },
        anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'src/components/FillClearFx', export: 'FillClearFx' } },
      };
      const engine = createFigmaEngine({
        tokens: { primitives: { fx: { bg: { $value: '#301050', $type: 'color' } } }, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
        icons: new Map(),
      });
      const script = engine.buildComponentScript(fixture, new Map([[fixture.id, fixture]]));
      const comp = JSON.parse(script.match(/const COMPONENTS = (\[[\s\S]*?\n\]);/)![1])[0];
      const specA = comp.variants.find((v: any) => v.name.includes('=a')).spec;
      const specB = comp.variants.find((v: any) => v.name.includes('=b')).spec;
      // (1) compile side: fill + fillClear on one spec = fill wins (fillClear
      // is not compiled at all); the fill-less variant keeps its clear.
      if (specA.fill !== 'fx/bg' || specA.lits?.fillClear) throw new Error('fix 1 (compile): fill variant must carry fill and NO fillClear: ' + JSON.stringify(specA.lits));
      if (specB.fill !== undefined || specB.lits?.fillClear !== true) throw new Error('fix 1 (compile): fill-less variant must keep fillClear');
      // (1) runtime side: EXECUTE the emitted applyFrameSpec against both
      // orders — a hand-fed spec carrying BOTH must keep its fill.
      const src = script.match(/function applyFrameSpec\(node, spec\) \{[\s\S]*?\n\}/)![0];
      const applyFrameSpec = (new Function('need', 'boundPaint', src + '; return applyFrameSpec;'))(
        () => ({}),
        () => 'BOUND-PAINT',
      ) as (node: any, spec: any) => void;
      const layout = { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN' };
      const node1: any = { type: 'FRAME', setBoundVariable() {}, resize() {}, width: 0, height: 0 };
      applyFrameSpec(node1, { layout, fill: 'fx/bg', lits: { fillClear: true } });
      if (!Array.isArray(node1.fills) || node1.fills[0] !== 'BOUND-PAINT') {
        throw new Error('fix 1 (runtime): executed applyFrameSpec trampled the spec-carried fill: ' + JSON.stringify(node1.fills));
      }
      const node2: any = { type: 'FRAME', setBoundVariable() {}, resize() {}, width: 0, height: 0 };
      applyFrameSpec(node2, { layout, lits: { fillClear: true } });
      if (!Array.isArray(node2.fills) || node2.fills.length !== 0) {
        throw new Error('fix 1 (runtime): fill-less fillClear must clear: ' + JSON.stringify(node2.fills));
      }
      // (2) amend-capable per-component runtime — the create-only skip is gone.
      for (const marker of ['async function amendSet', 'async function syncOne']) {
        if (!script.includes(marker)) throw new Error('fix 2: per-component script missing ' + marker);
      }
      if (script.includes('return { skipped: true, nodeId: existing.id, key: existing.key };')) {
        throw new Error('fix 2: create-only skip path still emitted');
      }
      // (3) standalone amend — the v1 refusal is retired, amendComponent routes.
      if (!script.includes('async function amendComponent')) throw new Error('fix 3: amendComponent missing');
      if (script.includes("reason: 'standalone component — amend supports variant sets in v1'")) {
        throw new Error('fix 3: v1 standalone skip still emitted');
      }
      if (!script.includes("existing.type === 'COMPONENT' && !C.isSet")) throw new Error('fix 3: standalone routing missing');
      // (4) empty-child declared defaults in ALL THREE build paths (create,
      // set amend, standalone amend) — never Figma's 100×100 artifact.
      const fillFixCount = script.split("childNode.layoutSizingVertical = 'FILL'").length - 1;
      if (fillFixCount < 3) throw new Error('fix 4: empty-child FILL default missing from a build path (found ' + fillFixCount + '/3)');
      // The COMMITTED polaris artifacts carry the fixes at source: Badge is
      // the standalone class Phase B-2 had to delete+recreate; ProgressBar is
      // finding 4's indicator.
      const badge = readFileSync(path.join(ROOT, 'examples/polaris/figma/badge.figma.js'), 'utf8');
      if (!badge.includes('amendComponent')) throw new Error('committed badge script must be standalone-amend-capable');
      const pbar = readFileSync(path.join(ROOT, 'examples/polaris/figma/progress-bar.figma.js'), 'utf8');
      if (!pbar.includes("layoutSizingVertical = 'FILL'")) throw new Error('committed progress-bar script must carry the empty-child default');
      // Round 5c: Button's tone×variant re-mint gave EVERY variant a fill
      // binding, so its script no longer carries fillClear lits and the
      // feature-gated runtime drops that chunk (byte-stable by design). Tag
      // still carries transparent planes — its committed script carries the
      // runtime guard.
      const tagScript = readFileSync(path.join(ROOT, 'examples/polaris/figma/tag.figma.js'), 'utf8');
      if (!tagScript.includes('li.fillClear && !spec.fill')) throw new Error('committed tag script must carry the runtime fillClear guard');
    },
  },
  {
    // Re-running the showcase generation from the COMMITTED contracts +
    // token wrap is byte-stable (every generated/react, generated/html and
    // figma/ file re-emits identical), and the truth-table numbers quoted in
    // SHOWCASE.md byte-match receipts/truth-table.json — prose can never
    // drift from the measured data. Runs against the repo tree (read-only:
    // --check writes nothing); needs no Polaris clone and no network.
    id: 'polaris-showcase-reproducible',
    claim: 'C1-determinism',
    run: () => {
      const r = spawnSync(TSX, ['examples/polaris/generate.ts', '--check'], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      if ((r.status ?? -1) !== 0) throw new Error(`showcase --check failed:\n${out}`);
      if (!out.includes('byte-stable')) throw new Error(`missing byte-stability line:\n${out}`);
      if (!out.includes('truth-table rows match')) throw new Error(`missing truth-table consistency line:\n${out}`);
    },
  },
  {
    // COMPUTED FLOOR (extract/computed — the productionized capture spike):
    // the COMMITTED Button captured-truth fixture replays offline through
    // the shared replay implementation in real Chromium, and computed
    // re-read equality holds at the committed floor (no harness, no npm
    // sandbox, no network — the fixture IS the capture). Plus the §1.4
    // enumeration certificate: a synthetic ≥3-axis interaction is REFUSED BY
    // NAME under per-axis+pairwise policy, and the artifact set is
    // internally consistent (scorecard counts = numbers counts — the
    // prose-drift guard between receipts). Missing Chromium fails by name
    // (CERTIFICATION convention: `npx playwright install chromium` or
    // PLAYWRIGHT_CHROMIUM_PATH).
    id: 'computed-floor-gate',
    claim: 'C1-determinism',
    run: () => {
      const probe = run(TSX, ['-e', `
        import fs from 'node:fs';
        import path from 'node:path';
        import { chromium } from 'playwright-core';
        import { chromiumExecutable } from './extract/figma/visual-parity/render.ts';
        import { ContractSchema } from './scripts/contract-schema.ts';
        import { validateContract } from './core/emit-react.ts';
        import { enumerate, pairwiseCertificate } from './extract/computed/lib.ts';
        import { buildReplayHtml, reconstructCaptures, rereadEquality } from './extract/computed/replay.ts';

        const j = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

        // 1) enumeration policy + the ≥3-axis certificate (pure)
        const axes = [
          { prop: 'a', values: ['a1', 'a2', 'a3', 'a4'] },
          { prop: 'b', values: ['b1', 'b2', 'b3', 'b4'] },
          { prop: 'c', values: ['c1', 'c2', 'c3', 'c4'] },
          { prop: 'd', values: ['d1', 'd2', 'd3', 'd4'] },
        ];
        const en = enumerate(axes, [], 100, { a: 'a1', b: 'b1', c: 'c1', d: 'd1' });
        if (en.policy !== 'per-axis+pairwise') throw new Error('256 > 100 must switch to per-axis+pairwise, got ' + en.policy);
        if (en.combos.length >= 256 || en.combos.length < 20) throw new Error('pairwise row count implausible: ' + en.combos.length);
        // planted ≥3-axis interaction: value depends on a AND b AND c jointly
        const threeAxis = en.combos.map((cm) => ({ axisValues: cm.axisValues, value: [cm.axisValues.a, cm.axisValues.b, cm.axisValues.c].join('+') }));
        const refusals = pairwiseCertificate(threeAxis, axes);
        if (refusals.length === 0 || !refusals[0].includes('pairwise-inconsistent')) {
          throw new Error('planted 3-axis interaction NOT refused by name: ' + JSON.stringify(refusals));
        }
        // a clean 2-axis function must pass the certificate
        const twoAxis = en.combos.map((cm) => ({ axisValues: cm.axisValues, value: [cm.axisValues.a, cm.axisValues.b].join('+') }));
        if (pairwiseCertificate(twoAxis, axes).length !== 0) throw new Error('2-axis function wrongly refused');

        // 2) committed artifact set: schema-valid + generator-valid enriched
        //    contract, and scorecard/numbers agree (receipts cannot drift)
        const dir = path.resolve('extract/computed/out/button');
        const truth = j(path.join(dir, 'captured-truth.json'));
        const enriched = ContractSchema.parse(j(path.join(dir, 'enriched.contract.json')));
        const errs = [];
        // round 4: promoted contracts may reference floor-reconstructed svg
        // assets — validate against the same merged icon map the floor used
        const icons = new Map();
        for (const iconDir of ['examples/polaris/assets/icons', path.join(dir, 'assets')]) {
          if (!fs.existsSync(iconDir)) continue;
          for (const f of fs.readdirSync(iconDir)) {
            if (f.endsWith('.svg')) icons.set(f.slice(0, -4), fs.readFileSync(path.join(iconDir, f), 'utf8').trim());
          }
        }
        validateContract(enriched, new Map([[enriched.id, enriched]]), errs, icons);
        if (errs.length) throw new Error('committed enriched contract fails validateContract: ' + errs[0]);
        const numbers = j(path.join(dir, 'numbers.json'));
        const scorecard = j(path.join(dir, 'scorecard.json'));
        const platformBaselines = j('evals/fixtures/computed-floor-platform-baseline.json');
        const platformBaseline = platformBaselines[process.platform];
        if (!platformBaseline) {
          throw new Error('computed-floor has no reviewed baseline for platform ' + process.platform);
        }
        const replayExtraExclusions = platformBaseline.extraExclusions ?? [];
        for (const [a, b, what] of [
          [scorecard.fusion.contradictions, numbers.bound.contradictions, 'contradictions'],
          [scorecard.fusion.mintedLeaves, numbers.minted.leaves, 'minted leaves'],
          [scorecard.fusion.boundConfirmed, numbers.bound.confirmed, 'bound confirmed'],
        ]) { if (a !== b) throw new Error('scorecard/numbers drift on ' + what + ': ' + a + ' vs ' + b); }
        if (numbers.folds.mintedLeavesFolded >= numbers.folds.mintedLeavesUnfolded) {
          throw new Error('folding pass receipt implausible: folded ' + numbers.folds.mintedLeavesFolded + ' >= unfolded ' + numbers.folds.mintedLeavesUnfolded);
        }

        // 3) offline replay of the committed capture in real Chromium
        const captures = reconstructCaptures(truth);
        if (captures.length !== numbers.captures) throw new Error('reconstruction count ' + captures.length + ' != committed ' + numbers.captures);
        const specs = captures.map((c) => ({ key: c.combo + '__' + c.interaction, root: c.root }));
        const html = buildReplayHtml(specs, truth._provenance.stage, 'light', replayExtraExclusions);
        const tmp = path.join('evals', '.computed-replay.html');
        fs.writeFileSync(tmp, html);
        (async () => {
          const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
          try {
            const page = await browser.newPage();
            await page.goto('file://' + path.resolve(tmp));
            await page.waitForFunction('window.__READY === true');
            await page.evaluate('document.fonts.ready');
            const reread = await rereadEquality(
              (js) => page.evaluate(js),
              specs,
              truth._provenance.channels,
              replayExtraExclusions,
            );
            if (reread.cellsCompared !== platformBaseline.cellsCompared) {
              throw new Error(
                'replay denominator drifted on ' + process.platform + ': ' +
                reread.cellsCompared + ' vs reviewed ' + platformBaseline.cellsCompared,
              );
            }
            if (JSON.stringify(reread.namedExclusions) !== JSON.stringify(platformBaseline.namedExclusions)) {
              throw new Error(
                'replay exclusion inventory drifted on ' + process.platform + ': ' +
                JSON.stringify(reread.namedExclusions) + ' vs reviewed ' +
                JSON.stringify(platformBaseline.namedExclusions),
              );
            }
            if (reread.pct < 99.9) {
              throw new Error(
                'replay computed equality ' + reread.pct.toFixed(6) +
                '% below the platform-independent 99.9% correctness floor; mismatches ' +
                JSON.stringify(reread.topMismatchedChannels),
              );
            }
            const platformDelta = Math.abs(reread.pct - platformBaseline.pct);
            if (platformDelta > platformBaseline.tolerancePp) {
              throw new Error(
                'replay equality drifted on ' + process.platform + ': ' + reread.pct.toFixed(3) +
                '% vs reviewed ' + Number(platformBaseline.pct).toFixed(3) +
                '% (delta ' + platformDelta.toFixed(3) + 'pp, tolerance ' + platformBaseline.tolerancePp + 'pp)',
              );
            }
            console.log(
              'computed-floor replay: ' + reread.cellsMatched + '/' + reread.cellsCompared +
              ' cells (' + reread.pct.toFixed(6) + '%) across ' + specs.length +
              ' captures on ' + process.platform + '; mismatches ' +
              JSON.stringify(reread.topMismatchedChannels),
            );
          } finally { await browser.close(); fs.rmSync(tmp, { force: true }); }
        })().catch((e) => { console.error(e); process.exit(1); });
      `]);
      if (probe.status !== 0 || !probe.out.includes('computed-floor replay:')) {
        throw new Error(`computed-floor gate failed:\n${probe.out}`);
      }
      console.log(probe.out.split('\n').find((line) => line.includes('computed-floor replay:')));
    },
  },
  {
    // ROUND 4 — DOM-ANATOMY PROMOTION: the committed Banner contract carries
    // the anatomy the owner's reference shows — the tone RIBBON (an inner
    // box whose background rides a per-tone map), per-tone icon glyph parts
    // with committed svg assets, the dismiss button gated on the promoted
    // `dismissible` boolean, and the action row gated on `withAction`. The
    // emitted static HTML renders all of it (ribbon classes + inline svg).
    id: 'dom-anatomy-promotion',
    claim: 'C3-detection',
    run: () => {
      const j = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
      const banner = ContractSchema.parse(j('examples/polaris/contracts/banner.contract.json')) as SchemaContract;
      const parts: Array<[string, SchemaPart]> = [];
      const walk = (name: string, part: SchemaPart) => {
        parts.push([name, part]);
        for (const [n, c] of Object.entries(part.parts ?? {})) walk(n, c as SchemaPart);
      };
      for (const [n, c] of Object.entries(banner.anatomy)) walk(n, c as SchemaPart);
      // ribbon: a non-root part with a per-tone background-color map
      const ribbon = parts.find(([n, p]) => {
        if (n === 'root') return false;
        const tbp = p.tokensByProp;
        const entries = tbp ? (Array.isArray(tbp) ? tbp : [tbp]) : [];
        return entries.some((e) => e.prop === 'tone' && Object.values(e.map).some((m) => 'background-color' in m));
      });
      if (!ribbon) throw new Error('promoted Banner contract has NO tone-ribbon part (per-tone background-color map missing)');
      // per-tone glyph parts with committed assets
      const iconsDir = path.join(ROOT, 'examples/polaris/assets/icons');
      const glyphs = parts.filter(([, p]) => p.icon && p.visibleWhen?.prop === 'tone');
      if (glyphs.length < 4) throw new Error(`expected ≥4 per-tone icon glyph parts, found ${glyphs.length}`);
      for (const [n, p] of glyphs) {
        if (!existsSync(path.join(iconsDir, `${p.icon!.asset}.svg`))) {
          throw new Error(`glyph part "${n}" references missing asset ${p.icon!.asset}.svg`);
        }
      }
      // presence props + gated subtrees
      for (const propName of ['dismissible', 'withAction']) {
        const prop = banner.props.find((pr) => pr.name === propName);
        if (!prop || prop.type !== 'boolean') throw new Error(`promoted boolean prop "${propName}" missing`);
        const gated = parts.find(([, p]) => p.visibleWhen?.prop === propName);
        if (!gated) throw new Error(`no part gated on "${propName}"`);
      }
      const dismissBtn = parts.find(([, p]) => p.element === 'button' && p.visibleWhen?.prop === 'dismissible');
      if (!dismissBtn) throw new Error('dismiss button part (element button, visibleWhen dismissible) missing');
      // the emitted static HTML draws the ribbon + glyph svg
      const icons = new Map<string, string>();
      for (const f of readdirSync(iconsDir)) {
        if (f.endsWith('.svg')) icons.set(f.slice(0, -4), readFileSync(path.join(iconsDir, f), 'utf8').trim());
      }
      const tokens = tokenInventoryFromJson(
        ['examples/polaris/tokens/polaris.dtcg.json', 'examples/polaris/tokens/polaris-minted.dtcg.json']
          .filter((f) => existsSync(path.join(ROOT, f)))
          .map((f) => j(f)),
      );
      const clone = structuredClone(banner);
      for (const pr of clone.props) {
        if (pr.name === 'dismissible' || pr.name === 'withAction') pr.default = true;
      }
      const out = coreEmitHtml(clone, { tokens, icons, contracts: new Map([[clone.id, clone]]) });
      if (!out.html.includes('<svg')) throw new Error('emitted Banner HTML contains no inline svg glyph');
      if (!out.css.includes('background-color: var(--imported-banner-')) {
        throw new Error('emitted Banner CSS carries no minted ribbon background');
      }
      console.log(`dom-anatomy-promotion: ribbon "${ribbon[0]}", ${glyphs.length} tone glyphs, dismiss+action gated parts present; HTML renders inline svg`);
    },
  },
  {
    // ROUND 4 — SVG CONTENT ROUND TRIP: the committed captured truth's svg
    // subtree reconstructs BYTE-EQUAL to the committed icon asset (capture →
    // reconstructSvg → assets/icons), and the reconstructed markup carries
    // real path data that survives into the emitted HTML.
    id: 'svg-content-round-trip',
    claim: 'C1-determinism',
    run: () => {
      const probe = run(TSX, ['-e', `
        import fs from 'node:fs';
        import path from 'node:path';
        import { reconstructCaptures } from './extract/computed/replay.ts';
        import { reconstructSvg } from './extract/computed/anatomy.ts';
        const j = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
        const truth = j('extract/computed/out/banner/captured-truth.json');
        const base = reconstructCaptures(truth)[0];
        // find the tone-icon svg element in the base tree
        let svgNode = null;
        const walk = (n) => {
          if (n.tag === 'svg' && !svgNode) { svgNode = n; return; }
          for (const c of n.nodes) if (c.t === 'el') walk(c.el);
        };
        walk(base.root);
        if (!svgNode) throw new Error('no svg element in the committed banner base capture');
        const receipts = [];
        // Round 5c: the pipeline prefers the currentColor spelling when the
        // svg's fill==color identity holds in EVERY combo (per-svg decision,
        // promoteAnatomy) — mirror it here from the base capture's styles.
        const identity = !!(svgNode.style && svgNode.style['fill'] && svgNode.style['fill'] === svgNode.style['color']);
        const r = reconstructSvg(svgNode, receipts, 'eval', identity);
        if (!r) throw new Error('reconstructSvg refused the committed banner glyph: ' + receipts.join('; '));
        if (!/^<svg viewBox="0 0 \\d+ \\d+"/.test(r.markup)) throw new Error('markup missing viewBox: ' + r.markup.slice(0, 60));
        if (!r.markup.includes('<path d="M')) throw new Error('markup missing path data');
        // the committed asset for the base tone (info) byte-matches
        const asset = fs.readFileSync('extract/computed/out/banner/assets/banner-icon-info.svg', 'utf8').trim();
        if (asset !== r.markup) throw new Error('committed asset differs from a fresh reconstruction:\\n' + asset.slice(0, 120) + '\\nvs\\n' + r.markup.slice(0, 120));
        console.log('svg round trip: ' + r.markup.length + ' bytes, viewBox reconstructed, byte-equal to the committed asset');
      `]);
      if (probe.status !== 0 || !probe.out.includes('svg round trip:')) {
        throw new Error(`svg round trip failed:\n${probe.out}`);
      }
    },
  },
  {
    // ORGANISM ROUND — the four engine classes the composed MUI DataTable
    // required, pinned as PURE functions so none of them can regress
    // headlessly:
    //   1. RECURSIVE childrenSpec — the canonical-children vocabulary is a
    //      TREE, imports are collected at every depth, and a node that is
    //      BOTH a text leaf and a composition is a NAMED load refusal.
    //   2. TABLE LOWERING — display:table* is outside every vocabulary the
    //      schema speaks; it lowers to flex (+ the matching ARIA role)
    //      instead of growing the bounded declared grammar.
    //   3. TABLE-CELL COLUMN WIDTH — geometry is excluded from fusion BY
    //      NAME; a column whose rows AGREE re-admits width, and a column
    //      whose rows DISAGREE refuses by name and admits nothing.
    //   4. The promoted organism actually carries it: the committed
    //      table.contract.json has one width per column, shared by header
    //      and body, and per-cell dividers.
    id: 'organism-table-lowering',
    claim: 'C5-extraction',
    run: () => {
      // loadConfig REFUSES a config whose seed contracts are missing — stage
      // them (files, not trees: the scratch-hermeticity discipline).
      cpSync(path.join(ROOT, 'examples', 'mui', 'contracts-seed'), path.join(SCRATCH, 'examples', 'mui', 'contracts-seed'), {
        recursive: true,
      });
      // …and its SHIPPED minted tree (task #21): loadConfig refuses a config
      // whose declared `tokens.minted` is missing, because a silent fallback
      // to fresh-mint-only inventory is the defect that fix closed. Same
      // scratch-hermeticity discipline — stage the file, don't weaken the
      // referee.
      mkdirSync(path.join(SCRATCH, 'examples', 'mui', 'tokens'), { recursive: true });
      cpSync(
        path.join(ROOT, 'examples', 'mui', 'tokens', 'mui-minted.dtcg.json'),
        path.join(SCRATCH, 'examples', 'mui', 'tokens', 'mui-minted.dtcg.json'),
      );
      const probe = run(TSX, ['-e', `
        import fs from 'node:fs';
        import { loadConfig, walkChildSpecs } from './extract/computed/capture.ts';
        import { lowerTableDisplay, tableRoleFor } from './extract/computed/anatomy.ts';

        // 1. recursive childrenSpec over the REAL committed config
        const cfg = loadConfig(process.cwd(), 'extract/computed/configs/mui.json');
        const table = cfg.components.find((c) => c.name === 'Table');
        if (!table) throw new Error('the MUI config has no Table component');
        const flat = walkChildSpecs(table.childrenSpec);
        const depth = (list, d = 1) => Math.max(d, ...(list ?? []).map((c) => c.children ? depth(c.children, d + 1) : d));
        if (depth(table.childrenSpec) < 4) throw new Error('Table childrenSpec is not a TREE (depth ' + depth(table.childrenSpec) + ' < 4)');
        if (flat.length !== 26) throw new Error('expected 26 childrenSpec nodes in the Table organism, got ' + flat.length);
        for (const want of ['TableHead', 'TableBody', 'TableRow', 'TableCell', 'Checkbox', 'TableSortLabel', 'IconButton']) {
          if (!flat.some((c) => c.importName === want)) throw new Error('childrenSpec walk missed ' + want + ' — nested imports would never reach the mount page');
        }
        // the text-leaf-vs-composition refusal is NAMED at load
        const tmp = JSON.parse(fs.readFileSync('extract/computed/configs/mui.json', 'utf8'));
        tmp.components = [{ ...table, childrenSpec: [{ importName: 'TableHead', text: 'x', children: [{ importName: 'TableRow' }] }] }];
        fs.mkdirSync('.eval-tmp', { recursive: true });
        fs.writeFileSync('.eval-tmp/bad.json', JSON.stringify(tmp));
        let refused = '';
        try { loadConfig(process.cwd(), '.eval-tmp/bad.json'); } catch (e) { refused = String(e.message); }
        fs.rmSync('.eval-tmp', { recursive: true, force: true });
        if (!refused.includes('BOTH text and children')) throw new Error('a text+children childrenSpec node was NOT refused by name (got: ' + refused + ')');

        // 2. table lowering + ARIA role
        const cell = lowerTableDisplay('table-cell', { 'vertical-align': 'middle', 'text-align': 'right' });
        if (!cell || cell.layout.direction !== 'row' || cell.layout.align !== 'center' || cell.layout.justify !== 'end') {
          throw new Error('table-cell lowering wrong: ' + JSON.stringify(cell));
        }
        const row = lowerTableDisplay('table-row', {});
        if (!row || row.layout.direction !== 'row' || row.layout.align !== 'stretch') throw new Error('table-row lowering wrong: ' + JSON.stringify(row));
        const stack = lowerTableDisplay('table-header-group', {});
        if (!stack || stack.layout.direction !== 'column' || stack.layout.align !== 'stretch') throw new Error('table-header-group lowering wrong: ' + JSON.stringify(stack));
        if (lowerTableDisplay('table-column', {}) !== null) throw new Error('table-column must NOT lower (named residue)');
        const roles = ['table:table', 'table-row-group:rowgroup', 'table-row:row'].map((s) => s.split(':'));
        for (const [d, want] of roles) if (tableRoleFor(d, 'div') !== want) throw new Error(d + ' role should be ' + want);
        if (tableRoleFor('table-cell', 'th') !== 'columnheader' || tableRoleFor('table-cell', 'td') !== 'cell') throw new Error('cell roles wrong');

        console.log('organism engine: childrenSpec tree ' + flat.length + ' nodes depth ' + depth(table.childrenSpec) + '; lowering + roles pinned; text+children refused by name');
      `]);
      if (probe.status !== 0 || !probe.out.includes('organism engine:')) {
        throw new Error(`organism engine pins failed:\n${probe.out}`);
      }
      // 3. the column-width admission REFUSES a disagreeing column by name
      const refusal = run(TSX, ['-e', `
        import { tableGeometry } from './extract/computed/fuse.ts';
        // Two rows, two columns. Column 0 agrees (60px outer everywhere);
        // column 1 DISAGREES between the header and the body row.
        const style = (o) => ({ display: 'table-cell', 'box-sizing': 'border-box', ...o });
        const el = (s) => ({ path: '', sig: '', partName: '', node: { tag: 'td', classes: [], nodes: [], style: s, pseudo: {} } });
        const parts = ['root', 'rowA', 'a0', 'a1', 'rowB', 'b0', 'b1'];
        const styles = [
          { display: 'table' }, { display: 'table-row' }, style({ width: '60px' }), style({ width: '100px' }),
          { display: 'table-row' }, style({ width: '60px' }), style({ width: '140px' }),
        ];
        const mk = (id, parent) => ({ id, parent, children: [], sig: '', rep: {}, repPath: '', repKey: '', inBase: true, partName: parts[id] });
        const nodes = [];
        for (let i = 0; i < parts.length; i++) nodes.push(mk(i, null));
        const link = (p, c) => { nodes[c].parent = nodes[p]; nodes[p].children.push(nodes[c]); };
        link(0, 1); link(1, 2); link(1, 3); link(0, 4); link(4, 5); link(4, 6);
        const aligned = new Map([['base__default', styles.map((s) => el(s))]]);
        const a = {
          baseFlat: styles.map((s) => el(s)),
          partNames: parts,
          union: { entries: nodes },
          getAligned: (k) => aligned.get(k),
        };
        const space = { enumeration: { combos: [{ key: 'base', axisValues: {}, stateFlags: {} }] } };
        const g = tableGeometry(a, space);
        const admitted = [...g.cellAdmit].map((i) => parts[i]).sort();
        if (admitted.join(',') !== 'a0,b0') throw new Error('expected only the AGREEING column admitted, got [' + admitted.join(', ') + ']');
        if (!g.refusals.some((r) => r.startsWith('table-column-width-disagreement:'))) {
          throw new Error('a disagreeing column did NOT refuse by name: ' + JSON.stringify(g.refusals));
        }
        console.log('column admission: agreeing column admitted, disagreeing column REFUSED BY NAME');
      `]);
      if (refusal.status !== 0 || !refusal.out.includes('column admission:')) {
        throw new Error(`table-column admission pins failed:\n${refusal.out}`);
      }
      // 4. the PROMOTED organism carries it: one width per column, shared by
      //    header and body rows, plus the per-cell divider.
      const contract = JSON.parse(
        readFileSync(path.join(ROOT, 'examples/mui/contracts/table.contract.json'), 'utf8'),
      ) as { anatomy: { root: Record<string, unknown> } };
      type P = { attrs?: Record<string, string>; parts?: Record<string, P>; tokens?: Record<string, string>; layout?: Record<string, string> };
      const rows: P[] = [];
      const walk = (p: P) => {
        if (p.attrs?.role === 'row') rows.push(p);
        for (const c of Object.values(p.parts ?? {})) walk(c);
      };
      walk(contract.anatomy.root as P);
      if (rows.length !== 3) throw new Error(`promoted table has ${rows.length} role="row" parts, expected 3`);
      const grid = rows.map((r) =>
        Object.values(r.parts ?? {}).map((c) => {
          if (!c.tokens?.['width']) throw new Error('a promoted table cell carries no width token — the column fact is gone');
          if (!c.tokens?.['border-bottom-width']) throw new Error('a promoted table cell carries no bottom divider');
          return c.tokens['width'];
        }),
      );
      if (grid.some((r) => r.length !== 5)) throw new Error(`promoted rows are not all 5 cells: ${grid.map((r) => r.length).join('/')}`);
      for (let ci = 0; ci < 5; ci++) {
        const refs = new Set(grid.map((r) => r[ci]));
        if (refs.size !== 1) throw new Error(`column ${ci} does not share ONE width token across header+body: ${[...refs].join(' vs ')}`);
      }
      console.log(
        `organism-table-lowering: recursive childrenSpec + table→flex lowering + ARIA roles pinned; a disagreeing column refuses BY NAME; the promoted DataTable shares ONE width token per column across all 3 rows (${grid[0].join(', ')}) with per-cell dividers`,
      );
    },
  },
  {
    // ROUND 4 — CANVAS PIXEL GATE receipts: the committed per-component
    // scorecards exist for the 10 pixel-scoped components, quote per-cell
    // masked numbers, keep the summary consistent with the rows (prose-drift
    // guard), and name a cause on every cell over 10%.
    id: 'canvas-pixel-gate-receipts',
    claim: 'C3-detection',
    run: () => {
      const dir = path.join(ROOT, 'examples/polaris/receipts/canvas-gate');
      const comps = ['button', 'badge', 'tag', 'banner', 'checkbox', 'radio-button', 'avatar', 'progress-bar', 'thumbnail', 'spinner'];
      for (const c of comps) {
        const f = path.join(dir, `${c}.scorecard.json`);
        if (!existsSync(f)) throw new Error(`missing canvas-gate scorecard: ${c}`);
        const sc = JSON.parse(readFileSync(f, 'utf8')) as {
          cells: Array<{ cell: string; pctAAMasked: number; note?: string }>;
          summary: { meanAAMasked: number; maxAAMasked: number };
          acceptance: { allCellsOver10Named: boolean };
        };
        if (!Array.isArray(sc.cells) || sc.cells.length === 0) throw new Error(`${c}: no cells scored`);
        // fully-masked cells score null (no scorable pixels) — excluded from
        // the mean on both sides of this consistency check.
        const scored = sc.cells.filter((r) => typeof r.pctAAMasked === 'number');
        if (scored.length === 0) throw new Error(`${c}: every cell fully masked — nothing scored`);
        const mean = scored.reduce((n, r) => n + (r.pctAAMasked as number), 0) / scored.length;
        if (Math.abs(mean - sc.summary.meanAAMasked) > 0.5) {
          throw new Error(`${c}: summary meanAAMasked ${sc.summary.meanAAMasked} drifts from rows (${mean.toFixed(3)})`);
        }
        if (!sc.acceptance.allCellsOver10Named) throw new Error(`${c}: cells over 10% without named causes`);
      }
      console.log(`canvas-pixel-gate: ${comps.length} scorecards present, summaries row-consistent, every >10% cell named`);
    },
  },
  {
    // PHASE 1 (@ds-contracts/cli) — the whole command surface, from a scratch
    // work dir the way a consumer would run it: build the bundled CLI, then
    // init → extract (the committed foreign-sibling fixture) → generate
    // (the committed Polaris Badge contract, react target + stories) →
    // figma (sync script) → diff (exit 0 clean, exit 1 on planted drift) →
    // propose-pr --dry-run (REST plan, no token, no network). Generation is
    // run TWICE and must be byte-stable.
    id: 'cli-smoke',
    claim: 'C7-cli',
    run: () => {
      const built = run(process.execPath, ['packages/cli/build.mjs']);
      if (built.status !== 0) throw new Error(`CLI build failed:\n${built.out}`);
      const cli = path.join(SCRATCH, 'packages', 'cli', 'dist', 'cli.js');
      const work = path.join(SCRATCH, 'cliwork');
      mkdirSync(work, { recursive: true });
      const runCli = (args: string[], cwd = work): RunResult => {
        const r = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
        return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
      };

      // Committed inputs: the foreign-sibling extraction fixture rides the
      // scratch copy; the Polaris Badge contract + tokens + icons are
      // committed showcase artifacts copied in from the repo root.
      cpSync(path.join(SCRATCH, 'extract', 'fixtures', 'foreign-sibling'), path.join(work, 'lib'), { recursive: true });
      mkdirSync(path.join(work, 'polaris', 'contracts'), { recursive: true });
      cpSync(path.join(ROOT, 'examples', 'polaris', 'contracts', 'badge.contract.json'), path.join(work, 'polaris', 'contracts', 'badge.contract.json'));
      cpSync(path.join(ROOT, 'examples', 'polaris', 'tokens'), path.join(work, 'polaris', 'tokens'), { recursive: true });
      cpSync(path.join(ROOT, 'examples', 'polaris', 'assets', 'icons'), path.join(work, 'polaris', 'icons'), { recursive: true });

      // init: writes the config; a second init refuses by name.
      const init = runCli(['init']);
      if (init.status !== 0 || !existsSync(path.join(work, 'ds-contracts.config.json'))) {
        throw new Error(`init failed:\n${init.out}`);
      }
      const initAgain = runCli(['init']);
      if (initAgain.status !== 2 || !initAgain.out.includes('already exists')) {
        throw new Error(`second init must refuse by name (got ${initAgain.status}):\n${initAgain.out}`);
      }

      // extract over the committed foreign-sibling fixture.
      writeFileSync(
        path.join(work, 'extract.config.json'),
        JSON.stringify({ code: { adapter: 'react-tsx', root: 'lib' }, idPrefix: 'acme', out: 'out' }, null, 2),
      );
      const extract = runCli(['extract', 'extract.config.json']);
      if (extract.status !== 0 || !extract.out.includes('5 proposed contract(s)') || !extract.out.includes('2 component(s) seen but not extractable')) {
        throw new Error(`extract must propose 5 contracts and NAME the 2 skips:\n${extract.out}`);
      }

      // generate (react + stories) and figma, twice each — byte-stable.
      const tokens = 'polaris/tokens/polaris-light.dtcg.json,polaris/tokens/polaris-minted.dtcg.json';
      for (const dir of ['gen-a', 'gen-b']) {
        const g = runCli(['generate', 'polaris/contracts/badge.contract.json', '--out', `${dir}/react`, '--tokens', tokens, '--icons', 'polaris/icons', '--stories']);
        if (g.status !== 0) throw new Error(`generate failed (${dir}):\n${g.out}`);
        const f = runCli(['figma', 'polaris/contracts/badge.contract.json', '--out', `${dir}/figma`, '--tokens', tokens, '--icons', 'polaris/icons']);
        if (f.status !== 0) throw new Error(`figma failed (${dir}):\n${f.out}`);
      }
      for (const rel of ['react', 'figma']) {
        const a = hashTree(path.join('cliwork', 'gen-a', rel));
        const b = hashTree(path.join('cliwork', 'gen-b', rel));
        if (a !== b) throw new Error(`CLI ${rel} output is not byte-stable across two runs`);
      }
      for (const f of ['react/Badge/Badge.tsx', 'react/Badge/Badge.module.css', 'react/Badge/Badge.stories.tsx', 'react/Badge/index.ts', 'figma/badge.figma.js']) {
        if (!existsSync(path.join(work, 'gen-a', f))) throw new Error(`expected output missing: ${f}`);
      }

      // diff: clean on the fresh extraction (exit 0), then a planted code
      // prop drifts it (exit 1, [code AHEAD] named).
      const clean = runCli(['diff', 'extract.config.json']);
      if (clean.status !== 0 || !clean.out.includes('Diagnostic clean')) {
        throw new Error(`diff must exit 0 clean right after extraction:\n${clean.out}`);
      }
      const pill = path.join(work, 'lib', 'Pill.tsx');
      writeFileSync(pill, readFileSync(pill, 'utf8').replace('interface PillProps {', 'interface PillProps {\n  planted?: boolean;'));
      const drift = runCli(['diff', 'extract.config.json']);
      if (drift.status !== 1 || !drift.out.includes('[code AHEAD] Pill.planted')) {
        throw new Error(`diff must exit 1 naming the planted [code AHEAD] drift (got ${drift.status}):\n${drift.out}`);
      }

      // propose-pr --dry-run: the exact REST plan, zero token, zero network.
      const pr = runCli(['propose-pr', 'out/contracts/pill.contract.json', '--repo', 'acme/design-system', '--dry-run']);
      if (
        pr.status !== 0 ||
        !pr.out.includes('DRY RUN') ||
        !pr.out.includes('POST /repos/acme/design-system/pulls') ||
        !pr.out.includes('contents/contracts/pill.contract.json') ||
        !pr.out.includes('never persisted')
      ) {
        throw new Error(`propose-pr --dry-run must print the full REST plan without a token:\n${pr.out}`);
      }

      // extract --computed stays a LAZY, NAMED seam: the browser-dependent
      // runner is a separate chunk, never imported by the other verbs.
      if (!existsSync(path.join(SCRATCH, 'packages', 'cli', 'dist', 'computed.js'))) {
        throw new Error('dist/computed.js (the lazy browser chunk) was not built');
      }
      const cliBundle = readFileSync(cli, 'utf8');
      if (/from\s*["']playwright-core["']/.test(cliBundle)) {
        throw new Error('dist/cli.js must not import playwright-core statically — the lazy boundary is broken');
      }
      const noConfig = runCli(['extract', '--computed', '--config', 'missing.json']);
      if (noConfig.status !== 2 || !noConfig.out.includes('--config not found')) {
        throw new Error(`extract --computed must refuse a missing config by name:\n${noConfig.out}`);
      }

      console.log('cli-smoke: init → extract(5+2 named) → generate/figma byte-stable ×2 → diff 0/1 → propose-pr dry-run plan → lazy computed seam intact');
    },
  },
  {
    // PHASE 1 (@ds-contracts/cli) — propose-pr LIVE-PATH shape pin. The
    // dry-run plan is pinned above; this pins the two request shapes the live
    // GitHub path builds, which dry-run never exercised. A promotion normally
    // UPDATES a contract the target repo already carries, and PUT /contents
    // REFUSES to overwrite an existing blob without its current sha — the
    // first live run 422'd on exactly this ("\"sha\" wasn't supplied"). So
    // contentsPutBody must carry sha when the file exists (update) and omit it
    // when it doesn't (create); and the PR body must summarize the change in
    // plain words. All pure + offline — the actual PR open is a network+auth
    // receipt (examples/ci/PROPOSE-PR-LIVE.md), not an eval.
    id: 'propose-pr-live-shape',
    claim: 'C7-cli',
    run: () => {
      const { plan, content } = proposePrBuildPlan(
        path.join(ROOT, 'examples', 'polaris', 'contracts', 'badge.contract.json'),
        'tpitre/ds-contracts-pr-test',
        {},
      );

      // UPDATE: existing blob sha present → PUT body carries it verbatim.
      const upd = contentsPutBody(plan, content, 'abc123def456');
      if (upd.sha !== 'abc123def456') {
        throw new Error('contentsPutBody(update) must include the existing blob sha (else PUT /contents 422s on an existing contract)');
      }
      if (upd.branch !== plan.branch || upd.message !== plan.title) {
        throw new Error('contentsPutBody must commit to the proposal branch with the plan title');
      }
      if (Buffer.from(upd.content, 'base64').toString('utf8') !== content) {
        throw new Error('contentsPutBody must base64-encode the contract verbatim');
      }

      // CREATE: no existing sha → PUT body omits sha entirely (create path).
      const cre = contentsPutBody(plan, content, null);
      if ('sha' in cre) {
        throw new Error('contentsPutBody(create) must omit sha — sending an empty/absent sha on a fresh path is rejected');
      }

      // PR body carries a plain-words change summary read from the contract.
      const summary = proposePrSummarize(JSON.parse(content));
      if (!summary.includes('What changed') || !summary.includes('Badge')) {
        throw new Error(`propose-pr body must summarize the change in plain words:\n${summary}`);
      }
      if (!plan.body.includes('What changed')) {
        throw new Error('buildPlan body must embed the plain-words summary');
      }

      console.log('propose-pr-live-shape: PUT body carries sha on update, omits it on create, base64 verbatim; PR body summarizes the change (live open is a network receipt)');
    },
  },
  {
    // CANVAS → CODE, THE WHOLE LOOP (task #40) — the four promises the Send
    // panel and `propose-pr` make to each other, made falsifiable:
    //
    //   a. THE PATH TABLE IS NOT A GUESS. core/canvas-code-plan.ts names the
    //      files a proposal would create, and the plugin's Send panel shows
    //      that list to a designer BEFORE anything is written. It is a
    //      promise the CLI has to keep, so the REAL emitters run here and
    //      their paths must equal plannedCodePaths() for html, react-inline
    //      and (through generateCodeFiles, the shipping generator) react.
    //   b. "BYTE FOR BYTE" IS MEASURED, NOT CLAIMED. The tool-generated PR
    //      body says re-running the emitters reproduces the component byte
    //      for byte; so the repo's OWN Badge is regenerated from its OWN
    //      contract + four token trees + icons and compared to the committed
    //      files. A formatter change, a prettier bump, a stray emitter tweak
    //      turns that sentence into a lie — and fails here first.
    //   c. The react ROOT BARREL is never shipped (it names the whole
    //      library; a proposal knows one component) and its absence is NAMED.
    //   d. A CONTRACT-PROPOSAL envelope is UNWRAPPED — committing the
    //      envelope puts a non-contract where a contract belongs, which is
    //      the exact defect readProposalInput() was written to close.
    //   e. THE ASYMMETRY IS NON-NEGOTIABLE. tool-generated says "true round
    //      trip"/"byte for byte"; hand-built says INVERSION and "STARTING
    //      POINT, NOT A REPRODUCTION" and MUST NOT anywhere say "byte for
    //      byte"; an unstamped envelope says neither and admits it.
    //   f. A FRAMEWORK IS NEVER GUESSED: no config and no --target refuses
    //      by name ("not something to guess"), as do a target with nowhere
    //      to put the code and an unregistered target.
    //
    // Runs as a scratch probe (generateCodeFiles is async; the case runner is
    // sync) over the STAGED repo — contracts/, tokens/, assets/, src/ and
    // packages/ all ride along, and examples/ deliberately does not.
    id: 'canvas-code-loop',
    claim: 'C7-cli',
    run: () => {
      // Written as a FILE, not `tsx -e`: -e compiles to CJS, and the shipping
      // generator this loop must run through (scripts/generate-components.ts,
      // reached via generateCodeFiles) is ESM with a top-level await.
      const probeFile = path.join(SCRATCH, 'canvas-code-loop-probe.ts');
      writeFileSync(probeFile, `
        import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
        import path from 'node:path';
        import { buildPlan, generateCodeFiles, readProposalInput, resolveCodeConfig } from './packages/cli/src/commands/propose-pr.ts';
        import { plannedCodePaths } from './core/canvas-code-plan.ts';
        import { emitterByName } from './core/emitter.ts';
        import { ContractSchema } from './scripts/contract-schema.ts';

        const CWD = process.cwd();
        const CONTRACT = 'contracts/badge.contract.json';
        const TOKENS = ['tokens/primitives.tokens.json', 'tokens/semantic.tokens.json', 'tokens/modes/semantic.light.tokens.json', 'tokens/modes/semantic.dark.tokens.json'];
        const ICONS = 'assets/icons';
        const readJson = (rel) => JSON.parse(readFileSync(path.join(CWD, rel), 'utf8'));
        const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

        // (a) THE PATH TABLE IS THE REAL EMITTERS' PATHS — pure-emitter targets.
        const contract = ContractSchema.parse(readJson(CONTRACT));
        const ctx = {
          tokens: {
            primitives: readJson(TOKENS[0]), semantic: readJson(TOKENS[1]), light: readJson(TOKENS[2]), dark: readJson(TOKENS[3]),
            brands: Object.fromEntries(readdirSync('tokens/modes').filter((f) => /^brand\\./.test(f)).map((f) => [f.replace(/^brand\\.|\\.tokens\\.json$/g, ''), readJson('tokens/modes/' + f)])),
          },
          icons: new Map(readdirSync(ICONS).filter((f) => f.endsWith('.svg')).map((f) => [f.replace(/\\.svg$/, ''), readFileSync(path.join(CWD, ICONS, f), 'utf8').trim()])),
          contracts: new Map([[contract.id, contract]]),
        };
        for (const target of ['html', 'react-inline']) {
          const real = emitterByName.get(target).emit(contract, ctx).map((f) => f.path).sort();
          const planned = plannedCodePaths('Badge', target).sort();
          if (!eq(real, planned)) {
            throw new Error('plannedCodePaths(Badge, ' + target + ') = ' + JSON.stringify(planned) + ' but the REAL emitter writes ' + JSON.stringify(real) + ' — the Send panel would promise a designer file names the CLI does not write');
          }
        }

        // (a + b + c) react, through the SHIPPING generator propose-pr runs.
        const cfg = { targets: ['react'], outDir: 'src/components', tokenFiles: TOKENS, iconsDir: ICONS, stories: false, source: 'config' };
        const gen = await generateCodeFiles(readFileSync(path.join(CWD, CONTRACT), 'utf8'), cfg, CWD);
        const rel = gen.files.map((f) => f.destPath.slice(cfg.outDir.length + 1)).sort();
        const plannedReact = plannedCodePaths('Badge', 'react', { stories: false }).sort();
        if (!eq(plannedReact, ['Badge/Badge.module.css', 'Badge/Badge.tsx', 'Badge/index.ts'])) {
          throw new Error('plannedCodePaths(Badge, react, stories:false) changed shape: ' + JSON.stringify(plannedReact));
        }
        if (!eq(rel, plannedReact)) {
          throw new Error('react: generateCodeFiles wrote ' + JSON.stringify(rel) + ' but the plan promised ' + JSON.stringify(plannedReact));
        }
        for (const f of gen.files) {
          const committed = readFileSync(path.join(CWD, f.destPath), 'utf8');
          if (committed !== f.contents) {
            throw new Error('NOT a round trip: ' + f.destPath + ' regenerated from the contract in this repo differs from the COMMITTED file (' + committed.length + ' vs ' + f.contents.length + ' chars) — the tool-generated PR body says "byte for byte"');
          }
        }
        if (gen.files.some((f) => f.destPath === cfg.outDir + '/index.ts')) {
          throw new Error('the react ROOT BARREL was shipped — it lists every component in the library and would clobber a real repo barrel down to one line');
        }
        if (!gen.notes.some((n) => n.includes('root barrel'))) {
          throw new Error('the dropped root barrel is not NAMED in the notes: ' + JSON.stringify(gen.notes));
        }

        // (d) A CONTRACT-PROPOSAL envelope is unwrapped to its contract, and
        //     the plugin's stamp decides the provenance — never a guess.
        const dir = path.join(CWD, 'canvas-code-loop');
        mkdirSync(dir, { recursive: true });
        const contractDoc = readJson(CONTRACT);
        const WANT_CONTENT = JSON.stringify(contractDoc, null, 2) + '\\n';
        const bodies = {};
        for (const [stamp, want] of [[true, 'tool-generated'], [false, 'hand-built'], [undefined, 'unrecorded']]) {
          const envelope = { type: 'CONTRACT-PROPOSAL', proposedContract: contractDoc };
          if (stamp !== undefined) envelope.provenance = { toolGenerated: stamp };
          const file = path.join(dir, 'proposal-' + String(stamp) + '.json');
          writeFileSync(file, JSON.stringify(envelope, null, 2) + '\\n');
          const input = readProposalInput(file);
          if (input.content !== WANT_CONTENT) {
            throw new Error('toolGenerated=' + String(stamp) + ': the ENVELOPE itself was about to be committed where a contract belongs');
          }
          if (!input.unwrapped) throw new Error('toolGenerated=' + String(stamp) + ': the envelope was not reported as unwrapped');
          if (input.provenance !== want) {
            throw new Error('toolGenerated=' + String(stamp) + ' must resolve provenance "' + want + '", got "' + input.provenance + '"');
          }
          const built = buildPlan(file, 'acme/design-system', {});
          if (built.plan.provenance !== want) throw new Error('buildPlan lost the provenance for toolGenerated=' + String(stamp));
          bodies[want] = built.plan.body;
        }

        // (e) THE PR-BODY ASYMMETRY — the sentence a reviewer reads.
        for (const [prov, must, mustNot] of [
          ['tool-generated', ['true round trip', 'byte for byte'], []],
          ['hand-built', ['STARTING POINT, NOT A REPRODUCTION', 'INVERSION'], ['byte for byte']],
          ['unrecorded', ['No canvas provenance was recorded'], []],
        ]) {
          for (const phrase of must) {
            if (!bodies[prov].includes(phrase)) throw new Error(prov + ' PR body must say "' + phrase + '"');
          }
          for (const phrase of mustNot) {
            if (bodies[prov].includes(phrase)) throw new Error(prov + ' PR body must NEVER say "' + phrase + '" — a hand-built set is an INVERSION, and promising a reproduction is the one thing this loop may not do');
          }
        }

        // (f) A FRAMEWORK IS NEVER GUESSED.
        for (const [label, got, reason] of [
          ['no config and no --target', resolveCodeConfig({ noCode: false }, null, 'ds-contracts.config.json'), 'not something to guess'],
          ['--target with no out dir', resolveCodeConfig({ target: 'react', noCode: false }, null, 'ds-contracts.config.json'), 'somewhere to put the code'],
          ['unknown --target', resolveCodeConfig({ target: 'svelte', codePath: 'out', noCode: false }, null, 'ds-contracts.config.json'), 'Unknown --target svelte'],
        ]) {
          if (got.ok) throw new Error(label + ': resolveCodeConfig GUESSED a code plan instead of refusing by name');
          if (!got.reason.includes(reason)) throw new Error(label + ': the refusal does not name "' + reason + '" — ' + got.reason);
        }
        const configured = resolveCodeConfig({ noCode: false }, { generate: { target: 'react', out: 'src/components' } }, 'ds-contracts.config.json');
        if (!configured.ok) throw new Error('a RECORDED generate.target must resolve, got: ' + configured.reason);
        if (!eq(configured.config.targets, ['react']) || configured.config.outDir !== 'src/components' || configured.config.source !== 'config') {
          throw new Error('config-derived code plan wrong: ' + JSON.stringify(configured.config));
        }

        console.log('canvas-code-loop probe ok: ' + rel.join(', '));
      `);
      const probe = run(TSX, ['canvas-code-loop-probe.ts']);
      if (probe.status !== 0 || !probe.out.includes('canvas-code-loop probe ok: Badge/Badge.module.css, Badge/Badge.tsx, Badge/index.ts')) {
        throw new Error(`canvas-code-loop probe failed:\n${probe.out}`);
      }
      console.log('canvas-code-loop: the Send panel\'s path table equals the REAL emitters (html, react-inline, react), the repo\'s own Badge regenerates BYTE-IDENTICAL to its committed files, the root barrel stays out and is named, the CONTRACT-PROPOSAL envelope is unwrapped, and the round-trip/inversion/unrecorded PR sentences stay asymmetric — with no framework guessed');
    },
  },
  {
    // PHASE 1 (open emitter registry) — registerEmitter(): a foreign emitter
    // module registers, appears in getEmitters() AND the live `emitters`
    // array (the one every generic consumer iterates), name collisions and
    // shape errors refuse by name, and the CLI's --emitter flag loads the
    // same module so `generate --target test-emitter` emits its file.
    id: 'emitter-plugin-loads',
    claim: 'C7-cli',
    run: () => {
      const probe = run(TSX, ['-e', `
        import { emitters, emitterByName, getEmitters, registerEmitter } from './core/emitter.ts';
        import testEmitter from './evals/fixtures/test-emitter.mjs';
        const before = emitters.map((e) => e.name).join(',');
        if (before !== 'react,html,react-inline,figma-script') {
          throw new Error('built-in emitter order changed (load-bearing): ' + before);
        }
        registerEmitter(testEmitter);
        if (!getEmitters().some((e) => e.name === 'test-emitter')) throw new Error('not in getEmitters()');
        if (!emitters.some((e) => e.name === 'test-emitter')) throw new Error('registry array is not live — generic consumers would miss plugins');
        if (emitterByName.get('test-emitter') !== testEmitter) throw new Error('not in emitterByName');
        // Collisions and shape errors refuse by name — including the built-ins.
        for (const [bad, want] of [
          [testEmitter, 'already registered'],
          [{ name: 'react', label: 'x', emit: () => [] }, 'already registered'],
          [{ name: '', label: 'x', emit: () => [] }, 'non-empty string'],
          [{ name: 'no-emit', label: 'x' }, 'emit(contract, ctx) function'],
        ]) {
          let threw = '';
          try { registerEmitter(bad); } catch (e) { threw = String(e); }
          if (!threw.includes(want)) throw new Error('expected named refusal containing "' + want + '", got: ' + (threw || '(registered!)'));
        }
        console.log('registry probe ok: ' + getEmitters().map((e) => e.name).join(','));
      `]);
      if (probe.status !== 0 || !probe.out.includes('registry probe ok: react,html,react-inline,figma-script,test-emitter')) {
        throw new Error(`registry probe failed:\n${probe.out}`);
      }

      // The CLI loads the same module via --emitter and emits through it.
      const built = run(process.execPath, ['packages/cli/build.mjs']);
      if (built.status !== 0) throw new Error(`CLI build failed:\n${built.out}`);
      const cli = path.join(SCRATCH, 'packages', 'cli', 'dist', 'cli.js');
      const r = spawnSync(
        process.execPath,
        [cli, 'generate', path.join(ROOT, 'examples', 'polaris', 'contracts', 'badge.contract.json'),
          '--out', 'plugin-out', '--target', 'test-emitter',
          '--emitter', 'evals/fixtures/test-emitter.mjs',
          '--tokens', path.join(ROOT, 'examples', 'polaris', 'tokens', 'polaris-light.dtcg.json')],
        { cwd: SCRATCH, encoding: 'utf8' },
      );
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      if (r.status !== 0 || !out.includes('Registered emitter "test-emitter"')) {
        throw new Error(`CLI --emitter registration failed:\n${out}`);
      }
      const emitted = path.join(SCRATCH, 'plugin-out', 'badge.inventory.txt');
      if (!existsSync(emitted)) throw new Error('plugin emitter file not written');
      const contents = readFileSync(emitted, 'utf8');
      if (!contents.startsWith('polaris.badge@') || !contents.includes('props: tone, progress')) {
        throw new Error(`plugin emitter output wrong:\n${contents}`);
      }
      console.log('emitter-plugin-loads: registered (live array + getEmitters + byName), 4 named refusals, CLI --emitter emitted badge.inventory.txt');
    },
  },
  {
    // ROUND 5d — CANVAS GATE STANDING PIN (pin move RE-EARNED by the 5d
    // harnessed gate run, 2026-07-20, Chromium 148.0.7778.96 pin): the
    // owner's four visual defects are fixed at source — continuous check
    // glyph (dash animation vehicles dropped), control↔label gap as bound
    // itemSpacing + margin-box runtime, focus outline as an OUTSIDE-aligned
    // stroke (full-pair rule: a lone outline-color state recolor stays
    // inert, like CSS), all four Badge corners on {p.border-radius-200}.
    // Banner 4.60→3.17 (ring wraps the ribbon), Button 7.02→6.46 (5 focus
    // cells improved; SAME 53-cell named >10% membership as 5c), Tag
    // 29.97→22.55 (OUTSIDE ring on the two named preview cells), Checkbox
    // 3.06→3.22 (checked-cell raster of the continuous 2px stroke — the
    // capsule class is retired, named). SEVEN components PASS the ≤5%
    // masked-mean acceptance; every other component's mean is pinned, its
    // >10% cells all carry named causes (font raster / runtime-% /
    // outline→stroke previews / S3 state×tone residue), and a silent
    // regression (any mean drifting UP past its pin) fails this eval by
    // name. Re-earning the numbers needs the harnessed gate run
    // (extract/figma/canvas-gate/run.ts); this pin guards the committed
    // receipts between runs.
    id: 'canvas-gate-standing-pin',
    claim: 'C3-detection',
    run: () => {
      const dir = path.join(ROOT, 'examples/polaris/receipts/canvas-gate');
      // meanAAMasked pinned per component (round-5d final run, 2026-07-20,
      // Chromium 148.0.7778.96).
      const PIN: Record<string, { mean: number; accept: boolean }> = {
        avatar: { mean: 0, accept: true },
        badge: { mean: 0.07, accept: true },
        banner: { mean: 3.17, accept: true },
        // Button's mean is dominated by the 46 fully-masked text-only cells
        // (named font-raster class) + 5 focus-ring + 2 state×tone S3 cells.
        button: { mean: 6.46, accept: false },
        checkbox: { mean: 3.22, accept: true },
        'progress-bar': { mean: 26.22, accept: false },
        'radio-button': { mean: 0, accept: true },
        spinner: { mean: 0, accept: true },
        // Tag base + disabled are EXACT (0.00) on BOTH sizes; the mean is the
        // FOUR named active/focus state-preview cells (C5 outline
        // approximation). Round 5f: the defaultless `size` enum only carried
        // its 'large' set-value, so every Tag was forced large — materializing
        // the unset value added the PLAIN medium tag (Size=none base + disabled
        // both EXACT 0.00) and, with it, the medium size's two state-preview
        // cells of the SAME named class. Pin lifted 22.55→27.04 for the added
        // (smaller-box, so higher-%) medium state-preview cells; the set
        // changed shape (4→8 cells) — documented, same named residue.
        tag: { mean: 27.04, accept: false },
        thumbnail: { mean: 2.16, accept: true },
      };
      // Pixel-scoring nondeterminism headroom (AA classifier at 2x DSF):
      // observed byte-stable across consecutive runs; 0.75pp guards against
      // font-rasterization jitter without hiding a real regression.
      const TOL = 0.75;
      for (const [comp, pin] of Object.entries(PIN)) {
        const sc = JSON.parse(readFileSync(path.join(dir, `${comp}.scorecard.json`), 'utf8')) as {
          summary: { meanAAMasked: number };
          acceptance: { maskedMeanLE5: boolean; allCellsOver10Named: boolean; noBlankCanvasCells: boolean };
        };
        if (sc.summary.meanAAMasked > pin.mean + TOL) {
          throw new Error(`${comp}: masked mean ${sc.summary.meanAAMasked}% regressed past the round-5 pin ${pin.mean}%`);
        }
        if (!sc.acceptance.allCellsOver10Named) throw new Error(`${comp}: unnamed >10% cells`);
        const accepted = sc.acceptance.maskedMeanLE5 && sc.acceptance.noBlankCanvasCells;
        if (pin.accept && !accepted) {
          throw new Error(`${comp}: round-5 PASSING component no longer passes (mean≤5 ∧ noBlank)`);
        }
      }
      console.log('canvas-gate-standing-pin: 7/10 PASS pinned (Avatar, Badge, Banner, Checkbox, RadioButton, Spinner, Thumbnail); 10/10 means at or under their round-5d pins, all >10% cells named');
    },
  },
  {
    // PHASE 4 (Two Journeys) — J-ENGINEER standing gate. Figma is truth: the
    // committed CBDS plugin dump (the owner's live Button-Brand Primary send)
    // replays through the REAL propose path (proposeBatchFromDump — the same
    // function the playground receive path runs), the proposed contract plus
    // the captured/minted token layers land in the committed Storybook
    // skeleton (evals/fixtures/storybook-skeleton), the LOCAL packages/cli
    // build (the published CLI's exact source — network-free) generates
    // React + stories from the manifest command line
    // (evals/fixtures/journey-commands.json — the docs render the SAME file,
    // so documented and tested commands cannot diverge), and the emitted
    // story module renders in the real-browser harness with computed-style
    // spot checks against the committed Figma ground truth (the
    // cbds-bridge-check receipt numbers: #0e61ba background, #fcfeff label,
    // 48px height, 44px min-height tap target, 16px→12px padding-inline and
    // 48px→32px height across the size axis, 8px radius). Full Storybook is
    // deliberately NOT run (package install/network, tens of seconds); the
    // eval instead asserts the emitted stories land inside the committed
    // main.ts glob and renders the story module itself
    // (evals/fixtures/journey-engineer.entry.tsx, esbuild-bundled).
    id: 'journey-engineer',
    claim: 'C8-journey',
    run: () => {
      // The manifest is the ONLY place this eval's CLI command line lives.
      const manifest = JSON.parse(
        readFileSync(path.join(SCRATCH, 'evals', 'fixtures', 'journey-commands.json'), 'utf8'),
      ) as { cliPrefix: string; journeys: Record<string, { steps: Array<{ id: string; command: string }> }> };
      const argvOf = (journey: string, stepId: string): string[] => {
        const step = manifest.journeys[journey]?.steps.find((s) => s.id === stepId);
        if (!step) throw new Error(`journey-commands.json: missing step ${journey}/${stepId}`);
        const prefix = `${manifest.cliPrefix} `;
        if (!step.command.startsWith(prefix)) {
          throw new Error(`manifest command must start with "${prefix}": ${step.command}`);
        }
        return step.command.slice(prefix.length).split(/\s+/);
      };

      // 1. Replay the committed dump through the real propose path and lay
      //    the engineer's repo out in the committed Storybook skeleton.
      const setup = run(TSX, ['-e', `
        import fs from 'node:fs';
        import path from 'node:path';
        import { loadTokenCorpus } from './extract/figma/tokens.ts';
        import { loadContracts } from './extract/figma/propose.ts';
        import { proposeBatchFromDump } from './core/propose-figma.ts';
        import { capturedTokensFromDump } from './core/captured-tokens.ts';
        import { flattenTokens } from './core/tokens.ts';
        const WORK = 'jwork';
        const dump = JSON.parse(fs.readFileSync('extract/figma/fixtures/cbds-plugin-button-brand-primary.dump.json', 'utf8'));
        const loaded = loadContracts(path.resolve('contracts'));
        const batch = proposeBatchFromDump(dump, { projectionMode: 'reviewable-inversion', corpus: loadTokenCorpus(process.cwd()), contractIdByName: loaded.byName, contractsById: loaded.byId, fileKey: 'WofZT8xaxXuc2Q6Je9S4XE', mintUnbound: true });
        if (batch.proposals.length !== 1 || batch.skipped.length !== 0) throw new Error('dump replay must propose exactly 1 with 0 skips (got ' + batch.proposals.length + '/' + batch.skipped.length + ')');
        const proposal = batch.proposals[0];
        const c = proposal.contract;
        if (c.name !== 'ButtonBrandPrimary') throw new Error('unexpected proposal name: ' + c.name);
        fs.cpSync('evals/fixtures/storybook-skeleton', WORK, { recursive: true });
        fs.mkdirSync(path.join(WORK, 'contracts'), { recursive: true });
        fs.writeFileSync(path.join(WORK, 'contracts', 'button-brand-primary.contract.json'), JSON.stringify(c, null, 2) + '\\n');
        for (const s of proposal.childStubs ?? []) {
          fs.writeFileSync(path.join(WORK, 'contracts', s.id.split('.').pop() + '.contract.json'), JSON.stringify(s, null, 2) + '\\n');
        }
        const captured = capturedTokensFromDump(dump);
        if (!captured || captured.count !== 18) throw new Error('captured layer must carry the 18 dump variables (got ' + (captured && captured.count) + ')');
        fs.mkdirSync(path.join(WORK, 'tokens'), { recursive: true });
        fs.writeFileSync(path.join(WORK, 'tokens', 'captured.dtcg.json'), JSON.stringify(captured.tree, null, 2) + '\\n');
        fs.writeFileSync(path.join(WORK, 'tokens', 'minted.dtcg.json'), JSON.stringify((proposal.mintedTokens && proposal.mintedTokens.tree) || {}, null, 2) + '\\n');
        // The consumer's token build: captured + minted values as CSS custom
        // properties (token dots -> hyphens, the generateCss naming rule).
        const vars = [];
        for (const e of captured.entries) vars.push('  --' + e.path.split('.').join('-') + ': ' + e.value + ';');
        for (const [p, entry] of flattenTokens((proposal.mintedTokens && proposal.mintedTokens.tree) || {})) vars.push('  --' + p.split('.').join('-') + ': ' + entry.value + ';');
        fs.writeFileSync(path.join(WORK, 'src', 'tokens.css'), ':root {\\n' + vars.join('\\n') + '\\n}\\n');
        console.log('setup ok: contract + ' + ((proposal.childStubs || []).length) + ' stub(s), ' + vars.length + ' css vars');
      `]);
      if (setup.status !== 0 || !setup.out.includes('setup ok:')) {
        throw new Error(`dump replay / skeleton setup failed:\n${setup.out}`);
      }

      // 2. The manifest command, executed by the LOCAL CLI build in the
      //    engineer's repo (published-CLI-equivalent; the published bundle is
      //    npx-verified separately in examples/ci/VALIDATION.md).
      const built = run(process.execPath, ['packages/cli/build.mjs']);
      if (built.status !== 0) throw new Error(`CLI build failed:\n${built.out}`);
      const cli = path.join(SCRATCH, 'packages', 'cli', 'dist', 'cli.js');
      const jwork = path.join(SCRATCH, 'jwork');
      const gen = spawnSync(process.execPath, [cli, ...argvOf('engineer', 'generate-stories')], {
        cwd: jwork,
        encoding: 'utf8',
      });
      const genOut = `${gen.stdout ?? ''}${gen.stderr ?? ''}`;
      if ((gen.status ?? -1) !== 0 || !genOut.includes('ButtonBrandPrimary')) {
        throw new Error(`manifest generate command failed:\n${genOut}`);
      }

      // 3. Glob conformance: the emitted story file sits inside the
      //    committed skeleton's main.ts stories glob — a real
      //    `npm run storybook` over this exact layout picks it up.
      const mainTs = readFileSync(path.join(jwork, '.storybook', 'main.ts'), 'utf8');
      if (!mainTs.includes("stories: ['../src/generated/**/*.stories.@(ts|tsx)']")) {
        throw new Error('storybook-skeleton main.ts glob changed — update this eval AND the layout docs together');
      }
      const storyFile = path.join(jwork, 'src', 'generated', 'ButtonBrandPrimary', 'ButtonBrandPrimary.stories.tsx');
      if (!existsSync(storyFile)) {
        throw new Error('emitted story missing from the skeleton glob target: src/generated/ButtonBrandPrimary/ButtonBrandPrimary.stories.tsx');
      }

      // 4. Render the story module in the real browser; computed styles must
      //    equal the committed Figma ground truth (bridge receipt numbers).
      const probe = run(TSX, ['-e', `
        import fs from 'node:fs';
        import { build } from 'esbuild';
        import { chromium } from 'playwright-core';
        import { chromiumExecutable } from './extract/figma/visual-parity/render.ts';
        (async () => {
          fs.copyFileSync('evals/fixtures/journey-engineer.entry.tsx', 'jwork/__eval-entry.tsx');
          await build({ entryPoints: ['jwork/__eval-entry.tsx'], bundle: true, outfile: 'jwork/__eval-bundle/entry.js', format: 'iife', platform: 'browser', jsx: 'automatic', logLevel: 'silent' });
          const doc = '<!doctype html><html><head><meta charset="utf-8"><style>' + fs.readFileSync('jwork/src/tokens.css', 'utf8') + '</style><style>' + fs.readFileSync('jwork/__eval-bundle/entry.css', 'utf8') + '</style></head><body><div id="root-default"></div><div id="root-small"></div><script>' + fs.readFileSync('jwork/__eval-bundle/entry.js', 'utf8') + '</script></body></html>';
          const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
          try {
            const page = await browser.newPage();
            page.on('pageerror', (e) => { console.error('pageerror: ' + String(e)); process.exitCode = 1; });
            await page.setContent(doc, { waitUntil: 'load' });
            await page.waitForSelector('#root-default button', { timeout: 15000 });
            await page.waitForSelector('#root-small button', { timeout: 15000 });
            const r = await page.evaluate("(() => { const btn = document.querySelector('#root-default button'); const cs = getComputedStyle(btn); const label = Array.from(btn.querySelectorAll('span')).find((n) => n.textContent.trim() === 'Button'); const small = document.querySelector('#root-small button'); const scs = getComputedStyle(small); return { csf: window.__CSF__, text: btn.textContent.trim(), bg: cs.backgroundColor, height: cs.height, minHeight: cs.minHeight, padLeft: cs.paddingLeft, padRight: cs.paddingRight, padTop: cs.paddingTop, radius: cs.borderRadius, labelColor: label ? getComputedStyle(label).color : null, smallHeight: scs.height, smallPadLeft: scs.paddingLeft }; })()");
            // Ground truth = the committed dump's numbers, receipted in
            // extract/figma/cbds-bridge-check.ts (npm run extract:figma:cbds:bridge:check).
            const expect = {
              text: 'Button',
              bg: 'rgb(14, 97, 186)',        // {bg.brand.default} #0e61ba
              labelColor: 'rgb(252, 254, 255)', // {text.inverse-primary} #fcfeff on the label part
              height: '48px',                 // {component-size.xlarge} (size=large default)
              minHeight: '44px',              // minted tap-target literal
              padLeft: '16px', padRight: '16px', // {spacing.200}
              padTop: '8px',                  // {spacing.100} padding-block
              radius: '8px',                  // {corner-radius.100}
              smallHeight: '44px',            // size=small height token is 32px ({component-size.medium},
                                              // tokensByProp) but the carried 44px min-height tap target
                                              // clamps the rendered box — the same clamp the canvas shows
              smallPadLeft: '12px',           // tokensByProp size=small -> {spacing.150}
            };
            const bad = Object.entries(expect).filter(([k, v]) => r[k] !== v);
            if (bad.length > 0) throw new Error('computed-style drift vs Figma ground truth: ' + bad.map(([k, v]) => k + ' expected ' + v + ' got ' + r[k]).join('; '));
            if (!r.csf || r.csf.title !== 'Components/ButtonBrandPrimary') throw new Error('CSF meta title wrong: ' + JSON.stringify(r.csf));
            if (!r.csf.stories.includes('Playground') || r.csf.stories.length < 4) throw new Error('CSF stories missing: ' + JSON.stringify(r.csf.stories));
            console.log('journey-engineer render ok: ' + r.csf.stories.length + ' stories, all ' + Object.keys(expect).length + ' computed spot checks equal the dump truth');
          } finally { await browser.close(); }
        })().catch((e) => { console.error(e); process.exit(1); });
      `]);
      if (probe.status !== 0 || !probe.out.includes('journey-engineer render ok:')) {
        throw new Error(`story render probe failed:\n${probe.out}`);
      }
      console.log('journey-engineer: dump → propose (1/0) → manifest generate (local CLI build) → skeleton glob hit → browser render matches the 11-point Figma ground truth');
    },
  },
  {
    // PHASE 4 (Two Journeys) — J-DESIGNER standing gate. Code is truth: the
    // committed Polaris Badge contract (the showcase artifact) compiles to a
    // Figma sync script through the LOCAL CLI build using the manifest
    // command line (evals/fixtures/journey-commands.json — the docs-drift
    // guard seam, same file the docs render), the emitted script's compiled
    // COMPONENTS payload (createFigmaEngine's build product — the
    // emitters-check/canvas pattern, headless) is asserted on variant counts
    // and spot-checked bound values, and the `figma push` leg runs DRY: the
    // CONTRACTS-BUNDLE the CLI would post (toBundle — the exact function the
    // push verb runs) travels through the REAL worker pipeline
    // (workers/assist handleRequest over a Map-backed KV, fetchImpl throws —
    // zero network) and must arrive byte-identical, kind-tagged,
    // deliver-once; a malformed envelope must refuse by name. The live HTTP
    // transport itself is pinned by workers/assist/test/bridge.test.ts.
    id: 'journey-designer',
    claim: 'C8-journey',
    run: () => {
      const manifest = JSON.parse(
        readFileSync(path.join(SCRATCH, 'evals', 'fixtures', 'journey-commands.json'), 'utf8'),
      ) as { cliPrefix: string; journeys: Record<string, { steps: Array<{ id: string; command: string }> }> };
      const argvOf = (journey: string, stepId: string): string[] => {
        const step = manifest.journeys[journey]?.steps.find((s) => s.id === stepId);
        if (!step) throw new Error(`journey-commands.json: missing step ${journey}/${stepId}`);
        const prefix = `${manifest.cliPrefix} `;
        if (!step.command.startsWith(prefix)) {
          throw new Error(`manifest command must start with "${prefix}": ${step.command}`);
        }
        return step.command.slice(prefix.length).split(/\s+/);
      };

      // The designer-side repo: committed showcase artifacts, laid out the
      // way the manifest commands expect (same inputs as cli-smoke).
      const work = path.join(SCRATCH, 'jd-work');
      mkdirSync(path.join(work, 'contracts'), { recursive: true });
      mkdirSync(path.join(work, 'tokens'), { recursive: true });
      cpSync(path.join(ROOT, 'examples', 'polaris', 'contracts', 'badge.contract.json'), path.join(work, 'contracts', 'badge.contract.json'));
      for (const t of ['polaris-light.dtcg.json', 'polaris-minted.dtcg.json']) {
        cpSync(path.join(ROOT, 'examples', 'polaris', 'tokens', t), path.join(work, 'tokens', t));
      }
      cpSync(path.join(ROOT, 'examples', 'polaris', 'assets', 'icons'), path.join(work, 'icons'), { recursive: true });

      // 1. figma-emit: the manifest command through the local CLI build.
      const built = run(process.execPath, ['packages/cli/build.mjs']);
      if (built.status !== 0) throw new Error(`CLI build failed:\n${built.out}`);
      const cli = path.join(SCRATCH, 'packages', 'cli', 'dist', 'cli.js');
      const emit = spawnSync(process.execPath, [cli, ...argvOf('designer', 'figma-emit')], { cwd: work, encoding: 'utf8' });
      const emitOut = `${emit.stdout ?? ''}${emit.stderr ?? ''}`;
      if ((emit.status ?? -1) !== 0 || !emitOut.includes('badge.figma.js')) {
        throw new Error(`manifest figma-emit command failed:\n${emitOut}`);
      }

      // 2. Headless canvas-engine compile: the sync script's COMPONENTS
      //    payload IS createFigmaEngine's compiled build product — variant
      //    counts and bound values, asserted against the contract's axes.
      const comp = parseSyncComponent(readFileSync(path.join(work, 'figma-sync', 'badge.figma.js'), 'utf8'));
      if (comp.setName !== 'Badge' || comp.contractId !== 'polaris.badge' || comp.isSet !== true) {
        throw new Error(`compiled set identity wrong: ${JSON.stringify({ setName: comp.setName, contractId: comp.contractId, isSet: comp.isSet })}`);
      }
      // Round 5f — OPTIONAL-ADORNMENT: `progress` is a defaultless enum that
      // gates the status pip; its unset value 'none' is materialized as the
      // DEFAULT, so the set is 14 tones × 4 progress (none|incomplete|
      // partiallyComplete|complete) = 56, and the DEFAULT variant is the PLAIN
      // (no-pip) badge.
      if (comp.variants.length !== 56) throw new Error(`Badge must compile 14 tones × 4 progress (incl. the plain 'none') = 56 variants, got ${comp.variants.length}`);
      const tones = new Set<string>();
      const progresses = new Set<string>();
      for (const v of comp.variants) {
        const m = /^Tone=([^,]+), Progress=(.+)$/.exec(v.name);
        if (!m) throw new Error(`variant name grammar broke: ${v.name}`);
        tones.add(m[1]);
        progresses.add(m[2]);
      }
      if (tones.size !== 14 || progresses.size !== 4 || !progresses.has('none')) {
        throw new Error(`variant grid wrong: ${tones.size} tones × ${progresses.size} progress values (must include 'none')`);
      }
      // Spot checks: per-tone fill substitution + literal token bindings
      // (variable names use SLASHES on the canvas — the emitter's mapping).
      const v0 = comp.variants[0];
      if (v0.name !== 'Tone=info, Progress=none') throw new Error(`default combo must be the PLAIN Progress=none badge and compile first, got ${v0.name}`);
      if (v0.spec.fill !== 'imported/badge/root/background-color/info') {
        throw new Error(`tone-substituted fill binding wrong on v0: ${v0.spec.fill}`);
      }
      const success = comp.variants.find((v: { name: string }) => v.name === 'Tone=success, Progress=complete');
      if (!success || success.spec.fill !== 'imported/badge/root/background-color/success') {
        throw new Error(`tone-substituted fill binding wrong on success: ${success?.spec.fill}`);
      }
      if (v0.spec.bindings?.topLeftRadius !== 'p/border-radius-200' || v0.spec.bindings?.paddingLeft !== 'p/space-200') {
        throw new Error(`literal token bindings wrong: ${JSON.stringify(v0.spec.bindings)}`);
      }
      // The PLAIN default variant draws NO pip (adornment absent); a
      // Progress=set variant DOES (the optional-adornment gate).
      const v0Kinds = (v0.spec.children ?? []).map((ch: { type: string; name: string }) => `${ch.type}:${ch.name}`);
      if (v0Kinds.some((k: string) => k.endsWith(':icon'))) throw new Error(`plain default variant DREW the pip: ${v0Kinds.join(', ')}`);
      if (!v0Kinds.includes('text:label')) throw new Error(`compiled anatomy children wrong: ${v0Kinds.join(', ')}`);
      const withPip = comp.variants.find((v: { name: string }) => v.name === 'Tone=info, Progress=incomplete')!;
      const pipKinds = (withPip.spec.children ?? []).map((ch: { type: string; name: string }) => `${ch.type}:${ch.name}`);
      if (!pipKinds.includes('frame:icon')) throw new Error(`Progress=incomplete variant lost the pip: ${pipKinds.join(', ')}`);

      // 3. figma push, DRY: the code-led CI artifact shape, the CLI's own
      //    toBundle, the REAL worker pipeline in-process — no network.
      const badge = JSON.parse(readFileSync(path.join(work, 'contracts', 'badge.contract.json'), 'utf8'));
      writeFileSync(
        path.join(work, 'contracts-bundle.json'),
        JSON.stringify({ type: 'CONTRACTS-BUNDLE', version: 1, contracts: [badge] }, null, 2) + '\n',
      );
      const pushArgv = argvOf('designer', 'figma-push');
      if (pushArgv[0] !== 'figma' || pushArgv[1] !== 'push' || pushArgv[2] !== 'contracts-bundle.json' || pushArgv[3] !== '--code' || pushArgv[4] !== '<CODE>') {
        throw new Error(`manifest figma-push command shape changed: ${pushArgv.join(' ')}`);
      }
      const push = run(TSX, ['-e', `
        import fs from 'node:fs';
        import { handleRequest } from './workers/assist/src/index.ts';
        import { toBundle, CONTRACTS_BUNDLE_TYPE } from './packages/cli/src/commands/figma.ts';
        (async () => {
          const bundle = toBundle('jd-work/contracts-bundle.json');
          if (bundle.type !== CONTRACTS_BUNDLE_TYPE || bundle.version !== 1 || bundle.contracts.length !== 1) throw new Error('toBundle envelope wrong: ' + JSON.stringify({ type: bundle.type, version: bundle.version, n: bundle.contracts.length }));
          const store = new Map();
          const env = { ANTHROPIC_API_KEY: 'x', ASSIST_KV: { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); } }, ASSIST_ENABLED: 'true', BRIDGE_ENABLED: 'true' };
          const deps = { fetchImpl: () => { throw new Error('bridge routes must not fetch'); }, now: () => new Date() };
          const req = (p, o) => { o = o || {}; const h = new Headers(); if (o.origin !== null) h.set('origin', o.origin || 'https://ds-contracts-playground.pages.dev'); h.set('cf-connecting-ip', '203.0.113.7'); const m = o.method || 'POST'; return new Request('https://assist.example' + p, { method: m, headers: h, body: m === 'GET' ? undefined : (o.body || '{}') }); };
          const created = await handleRequest(req('/bridge/session'), env, deps);
          if (created.status !== 200) throw new Error('session mint failed: ' + created.status);
          const code = (await created.json()).code;
          // The push body, exactly as the CLI posts it: no Origin header.
          const sent = await handleRequest(req('/bridge/' + code, { origin: null, body: JSON.stringify(bundle) }), env, deps);
          const sentBody = await sent.json();
          if (sent.status !== 200 || sentBody.ok !== true) throw new Error('bridge refused the push: ' + sent.status + ' ' + JSON.stringify(sentBody));
          const stored = JSON.parse(store.get('bridge:payload:' + code));
          if (stored.kind !== 'contracts-bundle') throw new Error('payload kind not recorded as contracts-bundle');
          const delivered = await handleRequest(req('/bridge/' + code, { method: 'GET' }), env, deps);
          const body = await delivered.json();
          if (body.status !== 'delivered' || body.kind !== 'contracts-bundle') throw new Error('delivery wrong: ' + JSON.stringify(body).slice(0, 200));
          if (JSON.stringify(body.dump) !== JSON.stringify(bundle)) throw new Error('bundle not byte-identical through the bridge');
          if (body.dump.contracts[0].id !== 'polaris.badge') throw new Error('wrong contract delivered: ' + body.dump.contracts[0].id);
          if (store.has('bridge:payload:' + code) || store.has('bridge:dump:' + code) || store.has('bridge:sess:' + code)) throw new Error('deliver-once keys not deleted after delivery');
          // Referee: a malformed envelope refuses BY NAME (the bridge schema).
          const s2 = await handleRequest(req('/bridge/session'), env, deps);
          const code2 = (await s2.json()).code;
          const refused = await handleRequest(req('/bridge/' + code2, { origin: null, body: JSON.stringify({ type: CONTRACTS_BUNDLE_TYPE, version: 1, contracts: [] }) }), env, deps);
          const rb = await refused.json();
          if (refused.status !== 400 || !String(rb.error).includes('non-empty "contracts" array')) throw new Error('empty bundle must refuse 400 naming the schema, got ' + refused.status + ': ' + rb.error);
          console.log('push-dry ok: ' + JSON.stringify(bundle).length + ' bytes under code ' + code + ', kind-tagged, byte-identical, deliver-once, malformed envelope refused by name');
        })().catch((e) => { console.error(e); process.exit(1); });
      `]);
      if (push.status !== 0 || !push.out.includes('push-dry ok:')) {
        throw new Error(`figma push DRY failed:\n${push.out}`);
      }
      console.log('journey-designer: manifest figma-emit (local CLI build) → 42-variant compiled set (14×3, tone-substituted fills, slash-bound tokens, icon+label anatomy) → push DRY through the real worker pipeline (zero network)');
    },
  },
  {
    // REVERSE BRIDGE (the dev door, no GitHub): a designer's proposed
    // contract change leaves the plugin's Send tab and lands in a
    // developer's working tree as a REVIEWED LOCAL DIFF — plugin → pairing
    // bridge (kind 'proposal') → `figma receive` → unified diff + saved
    // .proposals artifact; the contract file NEVER moves without --apply.
    // Two layers, zero network: (a) the CLI unit suite pins the pure core
    // (parseProposal / planReceive / unifiedDiff — contractWrite is null
    // without --apply, the guarantee lives in the plan) AND the real
    // receiveCommand shell against an in-process fake bridge (existing
    // contract bytes never move); (b) the plugin's exact exportJson envelope
    // (engine proposeDiff's shape) travels through the REAL worker pipeline
    // (handleRequest, Map-backed KV, fetchImpl throws) — kind-tagged
    // 'proposal', deliver-once, delivered to a no-Origin read (the code is
    // the auth), malformed envelope refused BY NAME — then parses and plans
    // on the CLI side from the delivered bytes.
    id: 'reverse-bridge-dev-door',
    claim: 'C8-journey',
    run: () => {
      // (a) The CLI unit suite — pure core + thin shell.
      const t = run(TSX, ['--test', 'packages/cli/test/figma-receive.test.ts']);
      if (t.status !== 0) throw new Error(`figma-receive unit suite failed:\n${t.out.slice(0, 4000)}`);
      for (const line of [
        'planReceive WITHOUT --apply: contractWrite is null even when the diff is non-empty — nothing writes silently',
        'figma receive (shell) without --apply: proposal artifact saved, contract file untouched; with --apply: written',
        'figma receive (shell): a dump-kind delivery is refused by name, nothing written',
        // §B.15 softener: the one canvas door that does not REFUSE stub
        // anatomy (script emit, kept for CI diffing) must WARN by name,
        // listing each stub — and stay silent on all-drawable input.
        'figma emit (script path) warns drawable-empty BY NAME, listing each stub — and stays silent when every contract is drawable',
      ]) {
        if (!t.out.includes(line)) throw new Error(`missing figma-receive test: ${line}`);
      }
      if (!/# fail 0/.test(t.out)) throw new Error(`figma-receive suite reports failures:\n${t.out.slice(-2000)}`);

      // (b) The plugin envelope through the real worker, then the CLI's
      // referee + plan over the delivered bytes.
      const trip = run(TSX, ['-e', `
        import { handleRequest } from './workers/assist/src/index.ts';
        import { parseProposal, planReceive, CONTRACT_PROPOSAL_TYPE } from './packages/cli/src/commands/figma.ts';
        (async () => {
          // The envelope EXACTLY as the plugin engine's proposeDiff exports it.
          const envelope = {
            type: CONTRACT_PROPOSAL_TYPE,
            baseContractId: 'polaris.badge', baseVersion: '1.0.0', setName: 'Badge',
            summary: ['version: 1.0.0 → 1.1.0'],
            proposedContract: { id: 'polaris.badge', name: 'Badge', version: '1.1.0', props: [] },
            proposalNotes: [],
          };
          const store = new Map();
          const env = { ANTHROPIC_API_KEY: 'x', ASSIST_KV: { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); } }, ASSIST_ENABLED: 'true', BRIDGE_ENABLED: 'true' };
          const deps = { fetchImpl: () => { throw new Error('bridge routes must not fetch'); }, now: () => new Date() };
          const req = (p, o) => { o = o || {}; const h = new Headers(); if (o.origin !== null) h.set('origin', o.origin); h.set('cf-connecting-ip', '203.0.113.7'); const m = o.method || 'POST'; return new Request('https://assist.example' + p, { method: m, headers: h, body: m === 'GET' ? undefined : (o.body || '{}') }); };
          // figma receive mints the session — a plain fetch, no Origin header.
          const created = await handleRequest(req('/bridge/session', { origin: null }), env, deps);
          if (created.status !== 200) throw new Error('session mint failed: ' + created.status);
          const code = (await created.json()).code;
          // The plugin uploads — the literal "null" origin a plugin iframe sends.
          const sent = await handleRequest(req('/bridge/' + code, { origin: 'null', body: JSON.stringify(envelope) }), env, deps);
          if (sent.status !== 200) throw new Error('bridge refused the proposal upload: ' + sent.status);
          const stored = JSON.parse(store.get('bridge:payload:' + code));
          if (stored.kind !== 'proposal') throw new Error('payload kind not recorded as proposal');
          // The CLI polls — no Origin at all; the pairing code is the auth.
          const delivered = await handleRequest(req('/bridge/' + code, { method: 'GET', origin: null }), env, deps);
          const body = await delivered.json();
          if (body.status !== 'delivered' || body.kind !== 'proposal') throw new Error('delivery wrong: ' + JSON.stringify(body).slice(0, 200));
          if (JSON.stringify(body.dump) !== JSON.stringify(envelope)) throw new Error('proposal not byte-identical through the bridge');
          if (store.has('bridge:payload:' + code) || store.has('bridge:dump:' + code) || store.has('bridge:sess:' + code) || store.has('bridge:kind:' + code)) throw new Error('deliver-once keys not deleted after delivery');
          // The CLI side over the DELIVERED bytes: referee → plan; without
          // --apply the plan forbids the contract write, diff still renders.
          const parsed = parseProposal(body.dump);
          if (!parsed.ok) throw new Error('CLI referee refused the plugin envelope: ' + parsed.error);
          const plan = planReceive(parsed.proposal, { fileName: 'badge.contract.json', text: '{\\n  "id": "polaris.badge",\\n  "version": "1.0.0"\\n}\\n' }, false);
          if (plan.contractWrite !== null) throw new Error('planReceive without --apply must not write the contract file');
          if (!plan.changed || plan.diff.length === 0) throw new Error('the reviewed diff did not render');
          if (!plan.diff.some((l) => l.startsWith('+') && l.includes('1.1.0'))) throw new Error('the diff does not carry the proposed version line');
          // Referee: a malformed proposal envelope refuses BY NAME.
          const s2 = await handleRequest(req('/bridge/session', { origin: null }), env, deps);
          const code2 = (await s2.json()).code;
          const refused = await handleRequest(req('/bridge/' + code2, { origin: 'null', body: JSON.stringify({ type: CONTRACT_PROPOSAL_TYPE }) }), env, deps);
          const rb = await refused.json();
          if (refused.status !== 400 || !String(rb.error).includes('proposedContract')) throw new Error('malformed proposal must refuse 400 naming the envelope, got ' + refused.status + ': ' + rb.error);
          console.log('dev-door ok: proposal kind-tagged, deliver-once, byte-identical, no-write-without-apply plan, malformed envelope refused by name');
        })().catch((e) => { console.error(e); process.exit(1); });
      `]);
      if (trip.status !== 0 || !trip.out.includes('dev-door ok:')) {
        throw new Error(`reverse-bridge round trip failed:\n${trip.out}`);
      }
      console.log('reverse-bridge-dev-door: plugin exportJson envelope → real worker pipeline (kind proposal, deliver-once) → CLI referee + plan (no write without --apply) — plus the figma-receive unit suite (19 cases incl. envelope-v2 stubs+minted) incl. the live shell against a fake bridge');
    },
  },
  {
    // G1 (docs/18) — THE STANDING CI↔FIGMA CHANNEL, slices S1+S2, end to end
    // with ZERO network. The pairing-code bridge needs a person on each end
    // in the same 15 minutes; docs/18 calls that "the courier that dies of
    // neglect" and names G1 the hinge under G3, G13 and the whole
    // "zero manual sync chores" claim.
    //
    // This gate walks the real thing in-process: the CLI's own pure core
    // (detectProvenance / buildPublishBody / publishDryRunLines — the exact
    // functions `figma publish` runs) → the REAL worker pipeline
    // (workers/assist handleRequest over a Map-backed KV, fetchImpl throws)
    // → the plugin engine's own channel functions (the same module-level
    // exports the built bundle puts on window.DSC, pinned separately by
    // plugin-engine-check's `standing-channel` flow).
    //
    // What it must prove, in the order the round's risk sits:
    //   1. THE KEY SPLIT — readKey === sha256(writeKey); a readKey cannot
    //      publish, a writeKey cannot read. A leaked Figma-side key reads;
    //      it can never inject into the source of truth.
    //   2. NON-CONSUMING reads with a monotonic seq (the bridge cannot do
    //      either; "1 update waiting" is impossible under deliver-once).
    //   3. PROVENANCE echoes back byte-identically and UNREAD.
    //   4. THE FRESHNESS GUARD — the silent-downgrade hole this round
    //      closes. Republishing an equal/older delivery to a file that
    //      already applied #N fires BY NAME and unchecks Apply.
    // The live HTTP transport itself is pinned by
    // workers/assist/test/channel.test.ts (24 cases).
    id: 'channel-round-trip',
    claim: 'C8-journey',
    run: () => {
      const badgePath = path.join(ROOT, 'examples', 'polaris', 'contracts', 'badge.contract.json');
      const work = path.join(SCRATCH, 'chan-work');
      mkdirSync(work, { recursive: true });
      const badge = JSON.parse(readFileSync(badgePath, 'utf8')) as Record<string, unknown>;
      writeFileSync(
        path.join(work, 'contracts-bundle.json'),
        JSON.stringify({ type: 'CONTRACTS-BUNDLE', version: 1, contracts: [badge] }, null, 2) + '\n',
      );

      const trip = run(TSX, ['-e', `
        import { createHash } from 'node:crypto';
        import { handleRequest } from './workers/assist/src/index.ts';
        import { CHANNEL_MESSAGES, CHANNEL_TTL_SECONDS } from './workers/assist/src/channel.ts';
        import { toBundle, detectProvenance, buildPublishBody, publishDryRunLines, maskChannelKey } from './packages/cli/src/commands/figma.ts';
        import { parseApplyLog, appendApplyEntry, lastAppliedSeq, channelFreshness, channelFingerprint, provenanceLine } from './figma-sync/plugin/engine/entry.ts';
        (async () => {
          const ttls = new Map();
          const store = new Map();
          const env = {
            ANTHROPIC_API_KEY: 'x',
            ASSIST_KV: {
              get: async (k) => (store.has(k) ? store.get(k) : null),
              put: async (k, v, o) => { store.set(k, v); ttls.set(k, o && o.expirationTtl); },
              delete: async (k) => { store.delete(k); },
            },
            ASSIST_ENABLED: 'true', BRIDGE_ENABLED: 'true', CHANNEL_ENABLED: 'true',
          };
          const deps = { fetchImpl: () => { throw new Error('channel routes must not fetch'); }, now: () => new Date('2026-07-25T12:00:00Z') };
          const req = (p, o) => { o = o || {}; const h = new Headers(); if (o.origin) h.set('origin', o.origin); h.set('cf-connecting-ip', o.ip || '203.0.113.7'); const m = o.method || 'POST'; return new Request('https://assist.example' + p, { method: m, headers: h, body: m === 'GET' ? undefined : (o.body || '{}') }); };

          // --- 1. THE CLI'S PURE CORE (no network, no key) ------------------
          const bundle = toBundle('chan-work/contracts-bundle.json');
          if (bundle.type !== 'CONTRACTS-BUNDLE' || bundle.contracts.length !== 1) throw new Error('toBundle envelope wrong');
          const ciEnv = {
            GITHUB_REPOSITORY: 'acme/design-system', GITHUB_RUN_ID: '17654321',
            GITHUB_SHA: '9f1c2ab3d4e5f60718293a4b5c6d7e8f90a1b2c3', GITHUB_REF: 'refs/heads/main',
            GITHUB_SERVER_URL: 'https://github.com',
          };
          const prov = detectProvenance(ciEnv, {}, new Date('2026-07-25T11:59:00Z'));
          if (!prov || prov.repo !== 'acme/design-system' || prov.runId !== '17654321') throw new Error('GitHub Actions context not detected: ' + JSON.stringify(prov));
          if (prov.runUrl !== 'https://github.com/acme/design-system/actions/runs/17654321') throw new Error('runUrl not derived from server+repo+run: ' + prov.runUrl);
          if (detectProvenance({}, {}, new Date()) !== null) throw new Error('a laptop run must yield NO provenance rather than invented fields');
          const overridden = detectProvenance({}, { repo: 'x/y', commit: 'deadbeef' }, new Date());
          if (!overridden || overridden.repo !== 'x/y' || overridden.runId !== undefined) throw new Error('explicit flags must work with no CI env, and must not invent the missing fields');
          // PROVENANCE IS A SIBLING, NEVER INSIDE THE BUNDLE — figma bundle's
          // byte-determinism guarantee survives contact with the channel.
          const body = buildPublishBody(bundle, prov);
          if (JSON.stringify(body.bundle) !== JSON.stringify(bundle)) throw new Error('publish envelope mutated the bundle bytes');
          if (JSON.stringify(body.bundle).includes('acme/design-system')) throw new Error('provenance leaked INTO the bundle — figma bundle determinism broken');
          const dry = publishDryRunLines('contracts-bundle.json', 'https://assist.example', bundle, prov, JSON.stringify(bundle).length);
          if (!dry[0].startsWith('DRY RUN') || !dry.some((l) => l.includes('POST https://assist.example/channel/<writeKey>'))) throw new Error('dry-run plan does not print the exact request: ' + JSON.stringify(dry));
          if (!dry.some((l) => l.includes('never persisted, never logged'))) throw new Error('dry-run must state the key discipline');
          if (dry.some((l) => l.includes('dscw_'))) throw new Error('the dry-run plan must never print a key');

          // --- 2. CLAIM: the key split ---------------------------------------
          const claimed = await handleRequest(req('/channel/claim'), env, deps);
          if (claimed.status !== 200) throw new Error('claim failed: ' + claimed.status);
          const { writeKey, readKey, ttlSeconds } = await claimed.json();
          if (ttlSeconds !== CHANNEL_TTL_SECONDS) throw new Error('claim did not report the 30-day TTL');
          if (readKey !== 'dscr_' + createHash('sha256').update(writeKey).digest('hex')) throw new Error('readKey is NOT sha256(writeKey) — the one-way derivation is the whole security story');
          // Only ever a masked prefix reaches a log line — never the key.
          const masked = maskChannelKey(writeKey);
          if (!masked.startsWith('dscw_') || masked.length !== 10 || !masked.endsWith('…')) throw new Error('maskChannelKey must show a 9-char prefix and an ellipsis: ' + masked);
          if (writeKey.indexOf(masked) === 0 || writeKey.slice(9).length === 0) throw new Error('the mask must not be a usable prefix of the key');
          // A leaked Figma-side key cannot publish…
          const injected = await handleRequest(req('/channel/' + readKey, { body: JSON.stringify(buildPublishBody(bundle, null)) }), env, deps);
          if (injected.status !== 400 || (await injected.json()).error !== CHANNEL_MESSAGES.notWriteKey) throw new Error('a READ key must be refused BY NAME on the publish route — this is the supply-chain guarantee');
          // …and the CI secret is not a read route.
          const misread = await handleRequest(req('/channel/' + writeKey, { method: 'GET' }), env, deps);
          if (misread.status !== 400 || (await misread.json()).error !== CHANNEL_MESSAGES.notReadKey) throw new Error('a WRITE key must be refused BY NAME on the read route');

          // --- 3. PUBLISH + NON-CONSUMING READ -------------------------------
          const sent = await handleRequest(req('/channel/' + writeKey, { body: JSON.stringify(body) }), env, deps);
          const sentBody = await sent.json();
          if (sent.status !== 200 || sentBody.ok !== true || sentBody.seq !== 1) throw new Error('publish failed: ' + sent.status + ' ' + JSON.stringify(sentBody));
          for (const k of ['chan:' + readKey + ':meta', 'chan:' + readKey + ':bundle', 'chan:' + readKey + ':prov']) {
            if (ttls.get(k) !== CHANNEL_TTL_SECONDS) throw new Error('KV write without the 30-day TTL: ' + k);
          }
          // The designer reads. TWICE. Nothing is consumed — the bridge could
          // never do this, and "1 update waiting" is impossible without it.
          let delivered = null;
          for (let i = 0; i < 2; i++) {
            const got = await handleRequest(req('/channel/' + readKey + '?since=0', { method: 'GET', origin: 'null' }), env, deps);
            if (got.status !== 200) throw new Error('read ' + (i + 1) + ' failed: ' + got.status);
            delivered = await got.json();
            if (delivered.status !== 'update' || delivered.seq !== 1) throw new Error('read ' + (i + 1) + ' did not deliver: ' + JSON.stringify(delivered).slice(0, 200));
          }
          if (JSON.stringify(delivered.bundle) !== JSON.stringify(bundle)) throw new Error('bundle not byte-identical through the channel');
          if (delivered.bundle.contracts[0].id !== 'polaris.badge') throw new Error('wrong contract delivered');
          // PROVENANCE echoed back verbatim, and the worker never read it.
          if (JSON.stringify(delivered.provenance) !== JSON.stringify(prov)) throw new Error('provenance did not echo byte-identically: ' + JSON.stringify(delivered.provenance));
          // Already at the head: told so, and NOT handed 4 MB again.
          const current = await handleRequest(req('/channel/' + readKey + '?since=1', { method: 'GET' }), env, deps);
          const currentBody = await current.json();
          if (currentBody.status !== 'current' || 'bundle' in currentBody) throw new Error('a caller at the head must be told "current" with no payload');
          // The cheap check-on-open question.
          const head = await handleRequest(req('/channel/' + readKey + '?since=0&meta=1', { method: 'GET' }), env, deps);
          const headBody = await head.json();
          if (headBody.status !== 'update' || 'bundle' in headBody || !headBody.provenance) throw new Error('meta=1 must answer the head WITH provenance and WITHOUT the bundle');

          // --- 4. THE PLUGIN SIDE: apply → memory → freshness guard ----------
          const fp = channelFingerprint(readKey);
          if (readKey.indexOf(fp) !== 0 || fp.length !== 12) throw new Error('the apply log must store a fingerprint of the key');
          if (fp === readKey) throw new Error('the full read key must never be what lands in the file');
          const line = provenanceLine(delivered.provenance, delivered.publishedAt, new Date('2026-07-25T12:04:00Z'));
          if (line !== 'acme/design-system — CI run #17654321, commit 9f1c2ab, branch main, published 4 minutes ago.') throw new Error('provenance line wrong: ' + line);
          // Fresh file: the guard is SILENT (it must never cry wolf on day one).
          let log = parseApplyLog(null);
          if (channelFreshness({ seq: 1 }, log, fp).stale !== false) throw new Error('the guard fired on a first-ever delivery');
          // The designer applies #1; the file remembers.
          log = appendApplyEntry(log, { source: 'channel', channel: fp, seq: 1, publishedAt: delivered.publishedAt, appliedAt: '2026-07-25T12:05:00Z', contractIds: ['polaris.badge'], bytes: delivered.bytes });
          if (lastAppliedSeq(log, fp) !== 1) throw new Error('the apply log did not record delivery #1');

          // --- 5. THE HOLE THIS ROUND CLOSES ---------------------------------
          // seq is monotonic, so a WORKER can never hand back an older number.
          const second = await handleRequest(req('/channel/' + writeKey, { body: JSON.stringify(buildPublishBody(bundle, null)) }), env, deps);
          if ((await second.json()).seq !== 2) throw new Error('seq is not monotonic across publishes');
          // The real-world path to an out-of-order delivery: the channel
          // expires after 30 days with no publish and is RE-CLAIMED, so its
          // numbering restarts at 1 while the file still remembers a higher
          // number. Before this round that applied as an ordinary
          // default-SELECTED change — the silent downgrade.
          let deep = parseApplyLog(null);
          deep = appendApplyEntry(deep, { source: 'channel', channel: fp, seq: 7, publishedAt: null, appliedAt: 'x', contractIds: [], bytes: null });
          const stale = channelFreshness({ seq: 1 }, deep, fp);
          if (!stale.stale) throw new Error('THE SILENT-DOWNGRADE HOLE IS OPEN: an older delivery was not caught');
          if (!stale.line.includes('#1') || !stale.line.includes('#7') || !stale.line.includes('BACKWARDS')) throw new Error('the refusal must NAME both delivery numbers: ' + stale.line);
          const equal = channelFreshness({ seq: 7 }, deep, fp);
          if (!equal.stale || !equal.line.includes('last applied')) throw new Error('re-applying the SAME delivery must be named too: ' + equal.line);
          // A DIFFERENT channel's numbers are never borrowed — two channels
          // number independently, so comparing them would invent a warning.
          if (channelFreshness({ seq: 1 }, deep, 'dscr_someother').stale !== false) throw new Error('a different channel must not inherit this one\\'s ordering');
          // A pairing-code receive / paste carries no ordering at all and is
          // therefore untouched by this round, by construction.
          if (channelFreshness({ seq: 1 }, deep, null).stale !== false) throw new Error('a source with no channel must keep todays behaviour');

          // --- 6. Wrong / expired keys are indistinguishable ------------------
          const nobody = await handleRequest(req('/channel/dscr_' + 'a'.repeat(64), { method: 'GET' }), env, deps);
          if (nobody.status !== 404 || (await nobody.json()).error !== CHANNEL_MESSAGES.noChannel) throw new Error('an unminted key must 404 with the named message');
          store.delete('chan:' + readKey + ':meta');
          const expired = await handleRequest(req('/channel/' + readKey, { method: 'GET' }), env, deps);
          if (expired.status !== 404 || (await expired.json()).error !== CHANNEL_MESSAGES.noChannel) throw new Error('an expired channel must be indistinguishable from one that never existed');

          console.log('channel ok: readKey=sha256(writeKey), split refused both ways by name, publish→2 non-consuming reads byte-identical with provenance echoed unread, meta=1 head without payload, seq monotonic, freshness guard names #older vs #applied and stays silent across channels and on paste, wrong/expired indistinguishable');
        })().catch((e) => { console.error(e); process.exit(1); });
      `]);
      if (trip.status !== 0 || !trip.out.includes('channel ok:')) {
        throw new Error(`channel round trip failed:\n${trip.out}`);
      }

      // The worker's own 24-case suite carries the transport-level detail
      // (TTL on every write, caps by channel, kill-switch independence, the
      // 4 MB cap, every malformed envelope refused by name).
      const suite = run(TSX, ['--test', 'workers/assist/test/channel.test.ts']);
      if (suite.status !== 0) throw new Error(`workers/assist channel suite failed:\n${suite.out.slice(-4000)}`);
      for (const line of [
        'split: a writeKey cannot READ and a readKey cannot WRITE — both refused 400 by name',
        'read is NON-CONSUMING: the same delivery answers ten times and the keys survive',
        'seq is MONOTONIC across publishes, last write wins on the payload',
        'TTL: EVERY channel KV write carries the 30-day expirationTtl',
        'caps: the publish cap is per CHANNEL — a churning CI IP is irrelevant, another channel is unaffected',
        'kill switch: CHANNEL_ENABLED unset answers 503 everywhere and is INDEPENDENT of bridge + assist',
        'isolation: the channel never disturbs the bridge (both live in one worker, one KV)',
      ]) {
        if (!suite.out.includes(line)) throw new Error(`missing channel worker test: ${line}`);
      }
      if (!/# fail 0/.test(suite.out)) throw new Error(`channel worker suite reports failures:\n${suite.out.slice(-2000)}`);

      console.log(
        'channel-round-trip: CLI pure core (provenance auto-detect, sibling envelope, dry-run plan) → real worker pipeline (claim/publish/non-consuming read, key split refused both ways) → plugin engine (apply log, provenance line, freshness guard closing the silent-downgrade hole) — zero network, plus the 24-case worker suite',
      );
    },
  },
  {
    // G6+G14 (docs/18): the brownfield onboarding ramps — draft capture-
    // config generation (refuses unreviewed drafts by name), the coverage
    // scorecard, bulk candidate acceptance (ledgered, refusals named), and
    // init --detect (every prefill detected-not-confirmed). The four suites
    // carry the load-bearing pins; this gate runs them and checks the names.
    id: 'onboarding-ramps',
    claim: 'C5-extraction',
    run: () => {
      const files = [
        'packages/cli/test/draft-capture-config.test.ts',
        'packages/cli/test/accept-candidates.test.ts',
        'packages/cli/test/init-detect.test.ts',
        'packages/cli/test/library-scorecard.test.ts',
      ];
      const r = run(TSX, ['--test', ...files]);
      const out = r.out;
      if ((r.status ?? -1) !== 0 || !/# fail 0\b/.test(out)) {
        const notOk = out.split('\n').filter((l) => l.startsWith('not ok')).join('\n');
        throw new Error(`onboarding suites failed — failing tests:\n${notOk || '(none tagged — see head)'}\n\nHEAD:\n${out.slice(0, 2000)}`);
      }
      for (const pin of [
        'capture runner REFUSES an unreviewed draft by name',
        'exact mode: only the unambiguous unique-candidate items are accepted',
        'every prefill is marked detected-not-confirmed',
      ]) {
        if (!out.includes(pin)) throw new Error(`onboarding gate missing load-bearing test "${pin}"`);
      }
      console.log('onboarding-ramps: draft-config refusal, exact-only bulk acceptance, detect-not-confirmed prefill — 4 suites green');
    },
  },
  {
    // `ds-contracts onboard` (task #39) — the two-phase code→canvas command.
    // The suite is browser-free: it resumes phase 2 over COMMITTED capture
    // artifacts (`--from promote`), so what runs here is the real promote →
    // emit → bundle chain, the real refusal path, and the real review gate.
    //
    // The load-bearing claim is the REFUSAL: an unreviewed drafted capture
    // config must stop phase 2 dead and write nothing — at every stage, so
    // there is no arrangement of flags that gets past the one place a human
    // must decide (docs/21 §4: classAllow/varPrefix/mount fail QUIETLY).
    id: 'onboard-two-phase',
    claim: 'C8-journey',
    run: () => {
      const r = run(TSX, ['--test', 'packages/cli/test/onboard.test.ts']);
      if ((r.status ?? -1) !== 0 || !/# fail 0\b/.test(r.out)) {
        const notOk = r.out.split('\n').filter((l) => l.startsWith('not ok')).join('\n');
        throw new Error(`onboard suite failed:\n${notOk || '(none tagged)'}\n\nHEAD:\n${r.out.slice(0, 2500)}`);
      }
      for (const pin of [
        'phase 2 REFUSES an unreviewed draft capture config by name, and writes nothing',
        'the review gate is not stage-dependent — --from promote still refuses an unreviewed draft',
        'phase 2 happy path: promote → emit → bundle over committed capture artifacts',
        'a QUARANTINED component ships no contract, is named in the summary, and the run still finishes the others',
        'the review gate warns when a queued component can capture its trigger instead of itself',
      ]) {
        if (!r.out.includes(pin)) throw new Error(`onboard gate missing load-bearing test "${pin}"`);
      }
      console.log('onboard-two-phase: unreviewed-draft refusal (stage-independent), phase-2 promote→emit→bundle, per-component quarantine excluded BY NAME with a non-zero exit, double-run bundle byte-identity, and the review gate\'s trigger-capture advisory (fires on 2 undriven disclosure components, silent on the 4 driven/ordinary ones) — 9 pins green');
    },
  },
  {
    // PROMOTE GENERALIZATION (task #39). Promotion used to be six near-
    // identical copies of a ~450-line script under `examples/*/scripts/`, and
    // it was the one pipeline step with no CLI verb. It is now ONE module
    // (packages/cli/src/promote.ts) driven by a per-library manifest.
    //
    // The claim a refactor like that has to earn is BYTE IDENTITY: the shared
    // module must reproduce every committed artifact of every library it took
    // over, quirks included. This runs the real promotion for all four into a
    // throwaway example dir (reads point at the committed capture artifacts,
    // writes go to a temp dir — a green run can never move a committed byte)
    // and compares every produced file to the one in the repo.
    //
    // NOT COVERED, BY NAME: polaris (a different generation — v0.3.2, no
    // source-alias pass, bespoke per-component provenance prose) and astryx
    // (its re-anchor decisions ledger must be re-applied after the mint merge,
    // and it refuses at HEAD on a stale ledger row, task #43). Both keep their
    // own scripts, and that is a stated limit rather than a silent one.
    id: 'promote-generalization',
    claim: 'C1-determinism',
    run: () => {
      const tmp = path.join(SCRATCH, '.promote-generalization');
      rmSync(tmp, { recursive: true, force: true });
      let compared = 0;
      for (const lib of ['carbon', 'mui', 'tailwind', 'altitude']) {
        const committedDir = path.join(ROOT, 'examples', lib);
        const manifest = JSON.parse(readFileSync(path.join(committedDir, 'ds-library.json'), 'utf8')) as PromoteConfig;
        // A throwaway example dir seeded with the committed icons (the icon map
        // is an INPUT to the figmaStatePreviews probe) — everything else the
        // module reads stays pointed at the repo.
        const workDir = path.join(tmp, lib);
        mkdirSync(path.join(workDir, 'contracts'), { recursive: true });
        mkdirSync(path.join(workDir, 'tokens'), { recursive: true });
        if (existsSync(path.join(committedDir, 'assets'))) {
          cpSync(path.join(committedDir, 'assets'), path.join(workDir, 'assets'), { recursive: true });
        }
        const rel = (p: string): string => p.replace(`examples/${lib}/`, '');
        promoteFloor(ROOT, {
          ...manifest,
          exampleDir: path.relative(ROOT, workDir),
          mintedOut: path.join(path.relative(ROOT, workDir), 'tokens', path.basename(manifest.mintedOut)),
          mintedDoc: path.join(path.relative(ROOT, workDir), 'tokens', path.basename(manifest.mintedDoc)),
        }, () => {});

        for (const sub of ['contracts', 'tokens', 'assets']) {
          const producedDir = path.join(workDir, sub);
          if (!existsSync(producedDir)) continue;
          for (const f of readdirSync(producedDir).sort()) {
            const produced = path.join(producedDir, f);
            if (statSync(produced).isDirectory()) continue;
            const committed = path.join(committedDir, sub, f);
            if (!existsSync(committed)) throw new Error(`${lib}: the shared promote module produced ${sub}/${f}, which the repo does not carry`);
            if (!readFileSync(produced).equals(readFileSync(committed))) {
              throw new Error(`${lib}: ${sub}/${f} — the shared promote module did NOT reproduce the committed bytes (${rel(committed)})`);
            }
            compared++;
          }
        }
        // …and the committed set has nothing the module failed to produce.
        for (const f of readdirSync(path.join(committedDir, 'contracts')).sort()) {
          if (!/\.(contract|extension|anchors)\.json$/.test(f)) continue;
          if (!existsSync(path.join(workDir, 'contracts', f))) {
            throw new Error(`${lib}: the repo carries contracts/${f} but the shared promote module did not produce it`);
          }
        }
      }
      rmSync(tmp, { recursive: true, force: true });
      console.log(`promote-generalization: 4 libraries (carbon, mui, tailwind, altitude) re-promoted through the ONE shared module — ${compared} committed artifact(s) byte-identical; polaris + astryx keep their scripts BY NAME`);
    },
  },
  {
    // PLUGIN ENGINE (Phase 2, plugin v2) — the Figma plugin's engine bundle:
    // (a) a fresh esbuild of figma-sync/plugin/engine/entry.ts matches the
    // committed drift-guard receipt and the headless harness EXECUTES the
    // bundle's generate flow (tokens + Badge + version marker) against a
    // mocked figma global — the stored ds_contracts/specHash must equal the
    // engine's mirror, so the update report's "unchanged" detection can
    // never silently drift from the emitted runtime; (b) mutating core makes
    // the NEXT zip build refuse BY NAME (stale receipt) — the same
    // discipline as the embedded-dump-script guard.
    // THE PASTE DOOR (the adopter's path). LEDGER §3.4 called the plugin's
    // paste referee "the largest single refusal for an adopter" for two
    // rounds: the round-trip runner had to BYPASS it because Untitled UI hit
    // both blockers at once — an empty `base` tokenSet refused outright (its
    // vocabulary is entirely MINTED, 990 self-sufficient literal leaves), and
    // a per-variant icon ref (`{"asset":"{platform}"}`) read as a literal
    // filename with all six SVGs present. Both fixed; this drives the REAL
    // referee (parseIncomingText → planGenerate, no bypass) for a Community
    // kit that publishes ZERO variables AND for one that publishes real ones
    // with Light/Dark, and requires a mode DIFFERENCE rather than a mode
    // count. If this goes red, an outside adopter cannot use the tool.
    id: 'paste-door-open',
    claim: 'C4-convergence',
    run: () => {
      // Runs at the REPO ROOT, not in SCRATCH: the subject IS the committed
      // kits (examples/untitled-ui, examples/eventz-vars), which the scratch
      // copy filters out. Safe to do — the check only READS the repo and
      // writes its bundle into an OS temp dir, so it mutates nothing here.
      const r = spawnSync('npx', ['tsx', 'extract/figma/paste-door-check.ts'], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      const check = { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
      if (check.status !== 0) throw new Error(`paste-door-check failed:\n${check.out}`);
      for (const want of [
        '✔ GATE 1 — the plugin ACCEPTS the paste (30 contracts)',
        '✔ GATE 2 — generate plans without refusal',
        // 990 -> 1026 when the RAGGED-MATRIX pass landed (core/mint-tokens.ts):
        // Slider's Progress/Progress line width and _Dropdown list item's root
        // gap stopped being refused and now mint 16+16+4 leaves. The exact
        // number is pinned, not just the >=900 floor, so a channel silently
        // ceasing to mint is a failure and not a quiet pass.
        'the collection plans ≥900 variables (1031)',
        'genuinely DIFFER between Light and Dark (43)',
        '✔ THE PASTE DOOR IS OPEN for both kits',
      ]) {
        if (!check.out.includes(want)) throw new Error(`paste-door-check missing receipt: ${want}\n${check.out}`);
      }
      console.log(
        'paste-door-open: the developer path (contract → CLI bundle → paste → variable collection + component sets) runs END TO END through the REAL referee, with no bypass, for BOTH a Figma Community kit that publishes ZERO variables (Untitled UI — 30 contracts, 1031 minted variables, 17 icon assets incl. the per-variant {platform} glyph) and a kit that publishes real ones (Eventz — 17 contracts, 112 variables, 43 genuinely differing between Light and Dark). LEDGER §3.4 recorded this door SHUT for two rounds.',
      );
    },
  },
  {
    id: 'plugin-engine-bundle',
    claim: 'C1-determinism',
    run: () => {
      const check = run(process.execPath, ['scripts/plugin-engine-check.mjs']);
      if (check.status !== 0) throw new Error(`plugin-engine-check failed:\n${check.out}`);
      for (const want of [
        '✔ engine bundle fresh vs committed receipt',
        // The tokenSet modes SHAPE pin (found by the first nested mode input —
        // a captured Figma variable collection). A nested modes tree used to
        // parse and then silently render Dark as Light; every committed bundle
        // is flat, so no library pin could have caught it.
        '✔ tokenSet modes: a FLAT modes object parses and a NESTED one is REFUSED BY NAME',
        '✔ headless generate: Badge v',
        'stored specHash equals the engine mirror',
        // G9 — the sample-library cold start: the baked bundle builds with
        // ONE click, no paste, no repo (the designer's first trust moment).
        '✔ G9 sample library: the baked bundle (Card, Badge, Avatar, Button) parses, plans tokens-first, and builds in the mock',
        '✔ bundle order: ds.card plans 4 component scripts, dependencies first (ds.avatar → ds.button → ds.badge → ds.card)',
        // FOREIGN TOKEN SET — the JSON-only Generate: the MUI bundle
        // (contracts + tokenSet + icons in ONE paste, Wave 5 denominator) through
        // the real engine bundle path is EQUIVALENT to the compiled-script
        // path (same sets + standalone Menu/Tooltip/TablePagination, 2136 variables incl. 134
        // Figma-native aliases, contained-primary Button fill resolves
        // #1976d2), and a contract ref outside base+minted refuses BY NAME.
        // STATE-PLANE PROJECTION round: Switch 14→28 (checked is a VARIANT
        // AXIS now) and Button 63→75 (accepted State preview axis) — both
        // survive the JSON-only paste identically to the script path.
        '✔ foreign token set (MUI): mui.bundle.json — ONE JSON paste — plans tokenSet-first ("MUI" collection) and builds Accordion(4), Alert(12), Autocomplete(2), Avatar(3), Badge(14), Button(75), Card(4), Checkbox(3), Chip(28), CircularProgress(2), Dialog(5), Divider(3), Drawer(2), Fab(9), IconButton(9), InputAdornment(2), LinearProgress(2), Link(42), Paper(8), Radio(14), Select(2), Slider(12), Snackbar(3), Switch(28), Table(2), Tabs(6), TextField(6) + standalone Menu, TablePagination, Tooltip with 2136 variables (134 Figma-native aliases), EQUIVALENT to the compiled-script path (sets, standalone, variants, variable inventory); contained-primary Button fill resolves #1976d2; a ref outside base+minted refuses BY NAME',
        'plugin-engine-check: all flows green',
      ]) {
        if (!check.out.includes(want)) throw new Error(`missing "${want}" in:\n${check.out}`);
      }
      // Drift guard: a real core change (a string literal the minifier keeps)
      // must make the zip build refuse by name until the receipt is
      // re-recorded deliberately.
      replaceInFile('core/emit-figma-script.ts', "'WRONG FILE: expected '", "'WRONG FILE!! expected '");
      const stale = run(process.execPath, ['scripts/build-plugin-zip.mjs']);
      if (stale.status === 0) throw new Error('zip build did NOT refuse after a core mutation — the engine drift guard is dead');
      if (!stale.out.includes('STALE vs core') || !stale.out.includes('--update-engine-receipt')) {
        throw new Error(`stale-engine refusal is not named:\n${stale.out}`);
      }
      console.log('plugin-engine-bundle: fresh bundle matches the receipt, headless generate green, core mutation → named STALE refusal');
    },
  },
  {
    // DETERMINISTIC ROUND-TRIP — the whole point: the journey is a chain of
    // PURE FUNCTIONS with no AI in the conversion. contract → canvas (the
    // plugin engine) is run TWICE and the built node trees must be
    // byte-identical (an AI in the loop could not guarantee that); then
    // canvas → contract (dump + propose) recovers the composite anatomy and the
    // loop closes; then contract → code (emit-react) emits from the same
    // contract. The AI only ever BUILDS this tooling — never runs the
    // conversion. Runs scripts/deterministic-roundtrip.mjs under tsx.
    id: 'deterministic-roundtrip',
    claim: 'C1-determinism',
    run: () => {
      const r = run(TSX, ['scripts/deterministic-roundtrip.mjs']);
      if (r.status !== 0) throw new Error(`deterministic-roundtrip failed:\n${r.out.slice(0, 1600)}`);
      for (const want of [
        'byte-identical', // contract→canvas run twice, identical → deterministic
        'round-trip closes: the anatomy that went to canvas came back',
        'emitted', // contract→code
        'THE FULL LOOP RAN WITH ZERO AI',
      ]) {
        if (!r.out.includes(want)) throw new Error(`deterministic-roundtrip missing "${want}":\n${r.out.slice(0, 1600)}`);
      }
      console.log('deterministic-roundtrip: contract→canvas byte-identical across two runs (deterministic), canvas→contract recovers the anatomy, contract→code emits — the full journey is pure functions, no AI in the conversion');
    },
  },
  {
    // PLUGIN UPDATE REPORT (Phase 2, plugin v2) — the Update-library tab's
    // mandatory report+confirm: the EXACT plain-words change report renders
    // BEFORE anything applies (version → version with +prop, new-with-
    // variant-count, unchanged-skip, counts, nothing-applied tail), a
    // duplicate contract id refuses by name, and Apply then amends IN PLACE
    // (same node id, props added, markers updated).
    id: 'plugin-update-report',
    claim: 'C3-detection',
    run: () => {
      const check = run(process.execPath, ['scripts/plugin-engine-check.mjs']);
      if (check.status !== 0) throw new Error(`plugin-engine-check failed:\n${check.out}`);
      for (const want of [
        '✔ update report (before anything applies):',
        '• Badge 1.1.0 → 9.9.9: +prop Experimental.',
        '• Switch 2.0.0: new — will be created (2 variants).',
        '1 to update · 1 new · 0 unchanged.',
        'Nothing has been applied — review the list, then Apply.',
        '• Badge 1.1.0: unchanged — will be skipped.',
        // G8 — a recolor-only update itemizes per channel in the drift
        // report's language instead of "interior/style changes".
        '✔ G8 style diff: a recolor-only update itemizes per channel',
        // G2 (covenant repair) — the check recomputes the canvas state; a
        // canvas-edited target warns BY NAME and defaults UNCHECKED.
        '✔ G2 drift-aware update check: a canvas-edited target gets a NAMED overwrite warning and its Apply box defaults UNCHECKED',
        '✔ apply: Badge amended in place (same node ',
        '+prop Experimental, markers updated to v9.9.9',
      ]) {
        if (!check.out.includes(want)) throw new Error(`missing "${want}" in:\n${check.out}`);
      }
      console.log('plugin-update-report: exact plain-words report before apply, drift-aware default-unchecked + per-channel style diff in the report, amend-in-place after');
    },
  },
  {
    // PLUGIN PROPOSE DRY-RUN (Phase 2, plugin v2) — the Propose tab: the
    // ui.html-embedded dump script (drift-guarded verbatim copy) reads the
    // mock-generated set back, proposeDiff yields a proposal + bounded
    // API-level diff (a base missing a drawn prop surfaces "+prop <name>" by
    // name), and the GitHub PR flow's DRY RUN prints its exact 4-step REST
    // plan with the session-only token note — zero network.
    id: 'plugin-propose-dry-run',
    claim: 'C4-convergence',
    run: () => {
      const check = run(process.execPath, ['scripts/plugin-engine-check.mjs']);
      if (check.status !== 0) throw new Error(`plugin-engine-check failed:\n${check.out}`);
      for (const want of [
        '✔ propose: mock canvas dumped through the embedded dump script → proposal + bounded diff; a base missing "variant" surfaces "+prop variant" by name',
        '✔ PR dry-run plan: 4 named REST steps, deterministic branch, session-only token note — zero network',
      ]) {
        if (!check.out.includes(want)) throw new Error(`missing "${want}" in:\n${check.out}`);
      }
      console.log('plugin-propose-dry-run: dump→proposal→bounded diff round-trip + exact PR dry-run plan');
    },
  },
  {
    // G3 STALE-BASE GUARD (partial) — docs/18 Flow 7 step 4. The Send tab
    // used to diff the canvas against WHATEVER base was pasted, with no check
    // that the base is what the canvas was last synced from — a canvas N
    // syncs behind main proposed the engineer's merged changes back out as
    // the designer's "edits" (a silent revert the PR then blamed on her).
    // The guard compares the provided base's spec fingerprint against the
    // set's stored ds_contracts sync markers and WARNS by name — in the
    // summary (→ PR body + export envelope) and as a structured verdict —
    // while a matching base stays silent and absent markers verdict
    // 'unverifiable' rather than a silent 'match'. Pinned through the built
    // bundle in plugin-engine-check §5b (stale fixture + fresh fixture).
    id: 'plugin-stale-base-guard',
    claim: 'C2-refusal',
    run: () => {
      const check = run(process.execPath, ['scripts/plugin-engine-check.mjs']);
      if (check.status !== 0) throw new Error(`plugin-engine-check failed:\n${check.out}`);
      const want =
        '✔ G3 stale-base guard (partial): a base matching the stored sync fingerprint stays silent; the pre-sync v1 base WARNS by name ("may contain reverts") in summary + envelope; absent markers verdict "unverifiable", never a silent match';
      if (!check.out.includes(want)) throw new Error(`missing "${want}" in:\n${check.out}`);
      console.log('plugin-stale-base-guard: stale base warns by name in UI summary + PR/export envelope; fresh base silent; absent markers named unverifiable');
    },
  },
  {
    // PHASE 6 CLOSURE RECEIPT — @ds-contracts/emitter-web-components proves
    // the emitter plugin interface PRESERVES TRUTH: emit Web Components for
    // five contracts (repo Badge/Button/Switch/Card + the Polaris badge
    // pilot), generate custom-elements.json FROM the contracts, run the
    // REPO'S OWN CEM extraction adapter over the emitted package, and diff
    // the round-tripped proposal against each source contract — props/
    // enums/defaults/events must survive; every non-survivor is NAMED with
    // its mechanism (anatomy doesn't ride CEM — expected, named). Plus the
    // registry/CLI integration: the package's default export registers as
    // "web-components" (live array + getEmitters + byName, collision
    // refused by name) and the BUILT dist bundle loads through
    // `generate --target web-components --emitter <dist>`.
    id: 'wc-emitter-roundtrip',
    claim: 'C7-cli',
    run: () => {
      // 1) The closure receipt itself (examples/ is not copied into scratch —
      //    the Polaris pilot rides in read-only from the repo root).
      const receipt = run(TSX, [
        'packages/emitter-web-components/scripts/roundtrip-check.ts',
        '--examples-root', path.join(ROOT, 'examples'),
        '--out', 'wc-samples',
      ]);
      if (receipt.status !== 0) throw new Error(`roundtrip receipt failed:\n${receipt.out}`);
      for (const line of [
        'cem: every emitted component extracted (no silent drops)',
        'cem: zero skips (the emitted manifest is fully legible)',
        '✔ prop variant: enum values survive [primary, secondary, danger, ghost]',
        '✔ prop variant: default "primary" survives',
        '✔ prop disabled: boolean kind survives',
        '✔ event toggle: survives as event prop onToggle',
        "✔ proposal: event 'toggle' back with bindings.code.prop onToggle",
        "✔ proposal: variant back as enum with the full value set + default 'primary'",
        '✔ prop toneAndProgressLabelOverride: attribute "tone-and-progress-label-override" maps back to canonical "toneAndProgressLabelOverride"',
        '✔ prop tone: enum values survive [info, success, warning, critical, attention, new, magic, info-strong, success-strong, warning-strong, critical-strong, attention-strong, read-only, enabled]',
        '✔ NAMED non-survivor — anatomy (parts/tokens/layout/…): CEM describes an API, never an implementation — the proposal returns a stub anatomy',
        '✔ NAMED non-survivor — slot constraints (accepts/min/max/required): CEM slots carry name + description only — the constraint set does not ride',
        '✔ wc-emitter-roundtrip: 5 contracts emitted, CEM-extracted, and diffed — props/enums/defaults/events survive; every non-survivor named',
      ]) {
        if (!receipt.out.includes(line)) throw new Error(`missing receipt line: ${line}\n${receipt.out}`);
      }

      // 2) Registry integration: the package default export IS an Emitter;
      //    registration lands in the live array, getEmitters, and byName;
      //    a name collision refuses by name.
      const probe = run(TSX, ['-e', `
        import { emitters, emitterByName, getEmitters, registerEmitter } from './core/emitter.ts';
        import wc from './packages/emitter-web-components/src/index.ts';
        registerEmitter(wc);
        if (!getEmitters().some((e) => e.name === 'web-components')) throw new Error('not in getEmitters()');
        if (!emitters.some((e) => e.name === 'web-components')) throw new Error('registry array is not live');
        if (emitterByName.get('web-components') !== wc) throw new Error('not in emitterByName');
        let threw = '';
        try { registerEmitter({ name: 'web-components', label: 'x', emit: () => [] }); } catch (e) { threw = String(e); }
        if (!threw.includes('already registered')) throw new Error('collision not refused by name: ' + (threw || '(registered!)'));
        console.log('wc registry probe ok: ' + getEmitters().map((e) => e.name).join(','));
      `]);
      if (probe.status !== 0 || !probe.out.includes('wc registry probe ok: react,html,react-inline,figma-script,web-components')) {
        throw new Error(`wc registry probe failed:\n${probe.out}`);
      }

      // 3) CLI integration with the BUILT artifact (the publishable shape):
      //    build the plugin bundle + the CLI in scratch, then generate.
      const builtWc = run(process.execPath, ['packages/emitter-web-components/build.mjs']);
      if (builtWc.status !== 0) throw new Error(`plugin build failed:\n${builtWc.out}`);
      const builtCli = run(process.execPath, ['packages/cli/build.mjs']);
      if (builtCli.status !== 0) throw new Error(`CLI build failed:\n${builtCli.out}`);
      const cli = path.join(SCRATCH, 'packages', 'cli', 'dist', 'cli.js');
      const r = spawnSync(
        process.execPath,
        // ALL FOUR TOKEN TREES, not just primitives. This invocation used to
        // pass `--tokens tokens/primitives.tokens.json` alone and "worked" —
        // but ONLY on this target, because the web-components emitter had no
        // token inventory to check against (task #47). The badge contract
        // references SEMANTIC tokens (`color.feedback.*`, `space.inset-x.sm`,
        // `radius.badge`, `font.control.*`); the identical command with
        // `--target react` refuses with 16 errors and always did. So the
        // fixture was asserting that the `--emitter` path works using
        // arguments no other target accepts — a green that came from the
        // missing check, not from the CLI being right.
        [cli, 'generate', 'contracts/badge.contract.json', 'contracts/button.contract.json',
          '--out', 'wc-out', '--target', 'web-components',
          '--emitter', 'packages/emitter-web-components/dist/index.js',
          // COMMA-SEPARATED, not a repeated flag: `--tokens` takes a list and
          // a second `--tokens` REPLACES the first rather than adding to it.
          // Worth knowing — the repeated form loads only the LAST file and
          // fails in a way that looks like a contract problem (badge's ten
          // colour refs resolve from the dark tree, its six non-colour refs
          // do not).
          '--tokens', 'tokens/primitives.tokens.json,tokens/semantic.tokens.json,tokens/modes/semantic.light.tokens.json,tokens/modes/semantic.dark.tokens.json',
          '--icons', 'assets/icons'],
        { cwd: SCRATCH, encoding: 'utf8' },
      );
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      if (r.status !== 0 || !out.includes('Registered emitter "web-components"')) {
        throw new Error(`CLI --emitter web-components failed:\n${out}`);
      }
      for (const f of ['ds-badge.ts', 'ds-badge.css.ts', 'ds-badge.demo.html', 'ds-badge.custom-elements.json', 'ds-button.ts']) {
        if (!existsSync(path.join(SCRATCH, 'wc-out', f))) throw new Error(`CLI did not write wc-out/${f}`);
      }
      const badgeTs = readFileSync(path.join(SCRATCH, 'wc-out', 'ds-badge.ts'), 'utf8');
      if (!badgeTs.includes("customElements.define('ds-badge', BadgeElement)") ||
          !badgeTs.includes('static observedAttributes = ["variant"]')) {
        throw new Error(`emitted ds-badge.ts missing definition/observedAttributes:\n${badgeTs.slice(0, 400)}`);
      }
      // THE PIN FOR WHAT THIS FIXTURE USED TO MISS. Re-run the SAME command
      // with primitives alone — the arguments this eval carried until task
      // #47 — and require it to REFUSE. Without this, dropping the inventory
      // out of the ctx again would restore a silent green here.
      const starved = spawnSync(
        process.execPath,
        [cli, 'generate', 'contracts/badge.contract.json',
          '--out', 'wc-starved', '--target', 'web-components',
          '--emitter', 'packages/emitter-web-components/dist/index.js',
          '--tokens', 'tokens/primitives.tokens.json', '--icons', 'assets/icons'],
        { cwd: SCRATCH, encoding: 'utf8' },
      );
      const starvedOut = `${starved.stdout ?? ''}${starved.stderr ?? ''}`;
      if (starved.status === 0) throw new Error('the CLI EMITTED web components for a contract whose semantic token refs were not in any supplied tree — the inventory is not reaching the emitter, and dangling var(--…) would ship');
      if (!starvedOut.includes('color.feedback.info.background')) throw new Error(`the refusal must NAME an unresolvable token; got:\n${starvedOut.slice(0, 400)}`);

      console.log('wc-emitter-roundtrip: 5-contract CEM round trip survived (props/enums/defaults/events; non-survivors named), registry + CLI --target web-components proven on the built dist bundle. The CLI invocation now supplies ALL FOUR token trees — it passed primitives alone until task #47 and "worked" only because this target had no inventory to check against (the identical command with --target react refuses with 16 errors and always did). Starving it back to primitives is now a PINNED REFUSAL, so removing the inventory cannot restore a silent green here.');
    },
  },
  {
    // PHASE 6 CROSS-EMITTER CONSISTENCY RECEIPT — the emitted Web Component
    // demo renders in REAL Chromium next to core/emit-html.ts's render of
    // the SAME contracts, and the component root computed-compares across
    // every showcase item: 9 computed channels + bounding width/height per
    // item, 165 comparisons over Badge/Button/Switch (enum × boolean ×
    // state chrome included — disabled opacity, loading spinner geometry,
    // switch checked layout). The shadow-scoped selector translation must
    // resolve the cascade EXACTLY like emit-html's class rules: one
    // contract, one computed truth across emitters.
    id: 'wc-emitter-css-parity',
    claim: 'C1-determinism',
    run: () => {
      const r = run(TSX, ['packages/emitter-web-components/scripts/css-parity-check.ts']);
      if (r.status !== 0) throw new Error(`css-parity receipt failed:\n${r.out}`);
      for (const line of [
        '✔ [disabled=true] 11/11 channels match (9 computed + width/height)',
        '✔ [loading=true] 11/11 channels match (9 computed + width/height)',
        '✔ [value=on] 11/11 channels match (9 computed + width/height)',
        '✔ wc-emitter-css-parity: 3 subjects, 15 showcase items, 165 channel comparisons, 0 mismatches — one contract, one computed truth across emitters',
      ]) {
        if (!r.out.includes(line)) throw new Error(`missing parity line: ${line}\n${r.out}`);
      }
      console.log('wc-emitter-css-parity: 165/165 computed channels equal across emitters (real Chromium)');
    },
  },
  {
    // ROUND 5c — REACT EMITTERS: hyphenated part names must emit VALID,
    // EXECUTABLE JavaScript. Found by the CI journey validation
    // (examples/ci/VALIDATION.md): round-4 promoted anatomies carry part
    // names like "label-2" / "icon-3-incomplete", and `styles.label-2`
    // PARSES — as subtraction (NaN class names); `styles.icon - 3 -
    // incomplete` throws ReferenceError the moment the part renders. A grep
    // or a parse pass cannot catch this class, so this eval EXECUTES both
    // emitted modules: the CSS-module emitter's output is esbuild-bundled
    // (local-css) and rendered with react-dom/server; the inline emitter's
    // output likewise. Every hyphen-named part is unconditionally visible in
    // the fixture, so the defective member accesses would evaluate.
    id: 'react-hyphenated-part-names-execute',
    claim: 'C3-detection',
    run: () => {
      const probe = run(TSX, ['-e', `
        import fs from 'node:fs';
        import path from 'node:path';
        import { pathToFileURL } from 'node:url';
        import { build } from 'esbuild';
        import { ContractSchema } from './scripts/contract-schema.ts';
        import { emitReact } from './core/emit-react.ts';
        import { emitReactInline } from './core/emit-react-inline.ts';
        (async () => {
          const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
          const fixture = ContractSchema.parse({
            id: 'eval.hyphenparts',
            name: 'HyphenParts',
            version: '1.0.0',
            description: 'Eval fixture: round-4-style hyphenated part names.',
            semantics: { element: 'div' },
            props: [{
              name: 'children', description: 'text', type: 'text', required: true, default: 'hello-eval',
              bindings: { figma: { kind: 'TEXT', property: 'Label' }, code: { prop: 'children' } },
            }],
            states: [],
            anatomy: { root: { layout: { display: 'flex' }, parts: {
              'label-2': { content: { prop: 'children' }, literals: { 'padding-left': '2px' } },
              'note-3-static': { text: 'static run', literals: { 'padding-left': '2px' } },
              'icon-3-incomplete': { icon: { asset: 'eval-check' }, element: 'span' },
              'box-4': { layout: { display: 'flex' }, parts: { 'part-0-1': { text: 'leaf', literals: { 'padding-left': '2px' } } } },
            } } },
            anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'src/components/HyphenParts', export: 'HyphenParts' } },
          });
          const icons = new Map([['eval-check', '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h20v20H0z"/></svg>']]);
          const contracts = new Map([[fixture.id, fixture]]);

          // ---- CSS-module emitter: emit → bundle (local-css) → EXECUTE ----
          const { tsx, css } = emitReact(fixture, { tokens: new Set(), icons, contracts });
          if (/styles\\.[A-Za-z0-9_$]+\\s*-\\s*\\d/.test(tsx)) throw new Error('emitted tsx still contains a subtraction-parsed styles access');
          fs.mkdirSync('hyphen-eval', { recursive: true });
          fs.writeFileSync('hyphen-eval/HyphenParts.tsx', tsx);
          fs.writeFileSync('hyphen-eval/HyphenParts.module.css', css);
          fs.writeFileSync('hyphen-eval/entry.tsx', [
            "import { createElement } from 'react';",
            "import { renderToStaticMarkup } from 'react-dom/server';",
            "import { HyphenParts } from './HyphenParts';",
            "import styles from './HyphenParts.module.css';",
            "export const markup = renderToStaticMarkup(createElement(HyphenParts, null, 'hello-eval'));",
            "export const classMap = styles;",
          ].join('\\n'));
          await build({
            entryPoints: ['hyphen-eval/entry.tsx'], bundle: true, outfile: 'hyphen-eval/entry.cjs',
            format: 'cjs', platform: 'node', jsx: 'automatic', logLevel: 'silent',
            loader: { '.css': 'local-css' }, external: ['react', 'react-dom'],
          });
          const mod = await import(pathToFileURL(path.resolve('hyphen-eval/entry.cjs')).href);
          const { markup, classMap } = mod.default ?? mod;
          for (const part of ['label-2', 'note-3-static', 'icon-3-incomplete', 'icon-3-incompleteGlyph', 'box-4', 'part-0-1']) {
            const cls = classMap[part];
            if (typeof cls !== 'string' || cls.length === 0) throw new Error('css-module class missing for part ' + part);
            if (!markup.includes(cls)) throw new Error('rendered markup missing the class for part ' + part + ' (' + cls + ')');
          }
          if (markup.includes('NaN')) throw new Error('rendered markup contains NaN class names (the subtraction defect): ' + markup);
          if (!markup.includes('hello-eval') || !markup.includes('static run') || !markup.includes('leaf')) {
            throw new Error('fixture content missing from the render: ' + markup);
          }

          // ---- inline emitter: emit → bundle → EXECUTE (S['label-2']) ----
          const brands = Object.fromEntries(fs.readdirSync('tokens/modes').filter((f) => /^brand\\./.test(f)).map((f) => [f.replace(/^brand\\.|\\.tokens\\.json$/g, ''), read('tokens/modes/' + f)]));
          const tokens = { primitives: read('tokens/primitives.tokens.json'), semantic: read('tokens/semantic.tokens.json'), light: read('tokens/modes/semantic.light.tokens.json'), dark: read('tokens/modes/semantic.dark.tokens.json'), brands };
          const inline = emitReactInline(fixture, { tokens, icons, contracts, mode: 'light' });
          if (/S\\.[A-Za-z0-9_$]+\\s*-\\s*\\d/.test(inline.tsx)) throw new Error('inline emitter still contains a subtraction-parsed S access');
          fs.writeFileSync('hyphen-eval/Inline.tsx', inline.tsx);
          fs.writeFileSync('hyphen-eval/inline-entry.tsx', [
            "import { createElement } from 'react';",
            "import { renderToStaticMarkup } from 'react-dom/server';",
            "import { HyphenParts } from './Inline';",
            "export const markup = renderToStaticMarkup(createElement(HyphenParts, null, 'hello-inline'));",
          ].join('\\n'));
          await build({
            entryPoints: ['hyphen-eval/inline-entry.tsx'], bundle: true, outfile: 'hyphen-eval/inline-entry.cjs',
            format: 'cjs', platform: 'node', jsx: 'automatic', logLevel: 'silent',
            external: ['react', 'react-dom'],
          });
          const imod = await import(pathToFileURL(path.resolve('hyphen-eval/inline-entry.cjs')).href);
          const inlineMarkup = (imod.default ?? imod).markup;
          if (inlineMarkup.includes('NaN')) throw new Error('inline render contains NaN (the subtraction defect)');
          if (!inlineMarkup.includes('hello-inline') || !inlineMarkup.includes('static run')) {
            throw new Error('inline fixture content missing: ' + inlineMarkup);
          }
          console.log('hyphen-parts ok: both emitted modules EXECUTED — 5 hyphen-named classes rendered, no NaN, no ReferenceError');
        })().catch((e) => { console.error(e); process.exit(1); });
      `]);
      if (probe.status !== 0 || !probe.out.includes('hyphen-parts ok:')) {
        throw new Error(`hyphenated-part execution probe failed:\n${probe.out}`);
      }
      console.log('react-hyphenated-part-names-execute: emitReact + emitReactInline outputs bundled and EXECUTED with react-dom/server — hyphen-named parts render real classes (the styles.label-2 subtraction defect stays fixed)');
    },
  },
  {
    // ROUND 5d — GLYPH-RECONSTRUCTION CLASS PIN (owner defect: the Checkbox
    // check drew as SEGMENTED CAPSULES). Dash channels are pathLength-
    // RELATIVE and pathLength is an ATTRIBUTE, not a computed style (the
    // viewBox class) — Polaris normalizes the check path to pathLength=1 and
    // drives stroke-dashoffset as a draw-on animation, so the computed 2px
    // dasharray is an animation VEHICLE, not resting geometry. This pin
    // (a) re-runs reconstructSvg over the COMMITTED checkbox capture (whose
    // path style carries dasharray 2px) and asserts the emitted markup is a
    // dash-free continuous stroke with the named receipt, byte-equal to the
    // committed asset; (b) sweeps EVERY committed icon asset for the
    // signature — a dash channel reappearing in any asset fails by name.
    id: 'svg-dash-animation-vehicle-pin',
    claim: 'C3-detection',
    run: () => {
      const iconsDir = path.join(ROOT, 'examples/polaris/assets/icons');
      for (const f of readdirSync(iconsDir).filter((f) => f.endsWith('.svg'))) {
        const body = readFileSync(path.join(iconsDir, f), 'utf8');
        if (/stroke-dash(array|offset)/.test(body)) {
          throw new Error(`committed asset ${f} carries a dash channel — the animation-vehicle class is back`);
        }
      }
      // the PROMOTED check glyphs are the floor reconstruction verbatim
      // (promote-floor copies byte-for-byte; a divergence means a stale
      // promotion).
      // task #26 recapture renamed the reconstructed glyphs: checkbox-icon-6
      // (visible check), checkbox-icon.svg (the same path at opacity 0 — the
      // unchecked resting form), checkbox-icon-4 (the indeterminate bar).
      for (const f of ['checkbox-icon-6.svg', 'checkbox-icon.svg', 'checkbox-icon-4.svg']) {
        const promoted = readFileSync(path.join(iconsDir, f), 'utf8');
        const floor = readFileSync(path.join(ROOT, 'extract/computed/out/checkbox/assets', f), 'utf8');
        if (promoted !== floor) throw new Error(`${f}: promoted asset diverges from the floor reconstruction`);
      }
      const probe = run(TSX, ['-e', `
        import fs from 'node:fs';
        import { reconstructCaptures } from './extract/computed/replay.ts';
        import { reconstructSvg } from './extract/computed/anatomy.ts';
        const truth = JSON.parse(fs.readFileSync('extract/computed/out/checkbox/captured-truth.json', 'utf8'));
        const base = reconstructCaptures(truth)[0];
        let svgNode = null;
        const walk = (n) => {
          if (n.tag === 'svg' && !svgNode) { svgNode = n; return; }
          for (const c of n.nodes) if (c.t === 'el') walk(c.el);
        };
        walk(base.root);
        if (!svgNode) throw new Error('no svg element in the committed checkbox base capture');
        // the committed capture DOES carry the dash channels on the path —
        // the pin is meaningless if the fixture no longer has them.
        let pathNode = null;
        const walkP = (n) => { for (const c of n.nodes) if (c.t === 'el') { if (c.el.tag === 'path' && !pathNode) pathNode = c.el; walkP(c.el); } };
        walkP(svgNode);
        if (!pathNode || pathNode.style['stroke-dasharray'] !== '2px') {
          throw new Error('fixture drift: committed checkbox capture no longer carries stroke-dasharray 2px on the check path');
        }
        const receipts = [];
        const r = reconstructSvg(svgNode, receipts, 'eval', false);
        if (!r) throw new Error('reconstructSvg refused the committed checkbox glyph: ' + receipts.join('; '));
        if (/stroke-dash/.test(r.markup)) throw new Error('reconstruction still carries dash channels: ' + r.markup);
        if (!/stroke-linecap="round"/.test(r.markup)) throw new Error('reconstruction lost the round linecap: ' + r.markup);
        if ((r.markup.match(/<path /g) || []).length !== 1) throw new Error('check glyph is not a single path: ' + r.markup);
        if (!receipts.some((x) => x.startsWith('svg-dash-channels-dropped:'))) {
          throw new Error('dash drop is not receipted by name: ' + receipts.join('; '));
        }
        // (the eval scratch carries extract/ but not examples/ — the floor's
        // own asset is the byte-source promote-floor copies verbatim)
        const asset = fs.readFileSync('extract/computed/out/checkbox/assets/checkbox-icon.svg', 'utf8').trim();
        if (asset !== r.markup) throw new Error('committed asset differs from a fresh reconstruction:\\n' + asset + '\\nvs\\n' + r.markup);
        console.log('dash pin ok: continuous single-path stroke, named receipt, byte-equal committed asset');
      `]);
      if (probe.status !== 0 || !probe.out.includes('dash pin ok:')) {
        throw new Error(`dash reconstruction probe failed:\n${probe.out}`);
      }
      console.log('svg-dash-animation-vehicle-pin: 22 committed assets dash-free; committed checkbox capture (dasharray 2px in style) reconstructs to the continuous stroke with the svg-dash-channels-dropped receipt, byte-equal to the committed asset');
    },
  },
  {
    // ROUND 5d — MARGIN/GAP CLASS PIN (owner defect: the Checkbox and
    // RadioButton control↔label gap was missing on the live canvas; the
    // Badge pip drew oversized). The contracts carry the gap as a
    // choice-control margin-right token; margins used to be a preview-only
    // fact the sync runtime never applied. The compile now lowers a uniform
    // positive sibling margin to the parent's itemSpacing BOUND TO THE
    // MARGIN'S OWN VARIABLE, and the runtime applies every residual margin
    // as the child's CSS margin box (wrapper frame). This pin reads the
    // COMMITTED emitted scripts (generate.ts --check guards contract↔script
    // drift), so a regression in either the compile or the emit fails here
    // by name.
    id: 'canvas-margin-gap-pin',
    claim: 'C3-detection',
    run: () => {
      const fig = (f: string) => readFileSync(path.join(ROOT, 'examples/polaris/figma', f), 'utf8');
      const cb = fig('checkbox.figma.js');
      if (!cb.includes('"itemSpacing": "imported/checkbox/choice-control/margin-right"')) {
        throw new Error('checkbox root gap no longer binds imported/checkbox/choice-control/margin-right as itemSpacing');
      }
      const rb = fig('radio-button.figma.js');
      if (!rb.includes('"itemSpacing": "imported/radio-button/choice-control/margin-right"')) {
        throw new Error('radio-button root gap no longer binds imported/radio-button/choice-control/margin-right as itemSpacing');
      }
      const badge = fig('badge.figma.js');
      if (!badge.includes('"margins"')) {
        throw new Error('badge icon lost its residual margin facts (the -2/-2/-8 pip box)');
      }
      if (!badge.includes('function applyMarginBox(')) {
        throw new Error('badge script lost the margin-box runtime — residual margins would silently not apply on canvas again');
      }
      // the radius half of the owner question: every corner rides the
      // semantic token, no minted sibling leaves.
      for (const corner of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) {
        if (!badge.includes(`"${corner}": "p/border-radius-200"`)) {
          throw new Error(`badge ${corner} no longer binds p/border-radius-200`);
        }
      }
      // (imported/shared/size-8 may legitimately appear in the shared minted
      // preamble for OTHER components' channels — only a radius BINDING to
      // it is the regression.)
      if (/"(topLeft|topRight|bottomLeft|bottomRight)Radius": "imported\/shared\/size-8"/.test(badge)) {
        throw new Error('badge script binds a corner to imported/shared/size-8 — the shorthand-coverage class is back');
      }
      console.log('canvas-margin-gap-pin: checkbox/radio itemSpacing binds the margin-right variable; badge keeps residual pip margins + applyMarginBox runtime; all four badge corners bind p/border-radius-200 (no size-8 siblings)');
    },
  },
  {
    // Round 5f — CLASS 4a: amendSet must run applyMarginBox on TOP-LEVEL
    // variant children. buildNode applied margin boxes only to NESTED children
    // (its own loop); the AMEND path's variant-child loop called buildNode +
    // applyOverlay only, so every margins-carrying DIRECT child of a variant
    // root lost its margin box on re-amend (B5E finding 1: Badge pip 24→20,
    // Button icon, TextField label gap). This pin reads the COMMITTED emitted
    // scripts: the margin-box runtime AND both call sites (create=buildNode,
    // amend=amendSet) must be present so a re-amend carries margins at source.
    id: 'amend-margin-box',
    claim: 'C3-detection',
    run: () => {
      const fig = (f: string) => readFileSync(path.join(ROOT, 'examples/polaris/figma', f), 'utf8');
      // button carries icon margins + Show WithIcon (left-gap finding); badge
      // still exercises the same runtime via any re-emitted Polaris script.
      for (const f of ['button.figma.js']) {
        const s = fig(f);
        if (!s.includes('function applyMarginBox(')) throw new Error(`${f}: no margin-box runtime`);
        // create path (buildNode): applyMarginBox(node, childNode, child, registry)
        if (!s.includes('applyMarginBox(node, childNode, child, registry)')) {
          throw new Error(`${f}: buildNode create path lost applyMarginBox(…, registry)`);
        }
        // amend path (amendSet): applyMarginBox(comp, childNode, childSpec, registry)
        // the B5E-finding-1 fix; without it top-level margins vanish on re-amend
        if (!s.includes('applyMarginBox(comp, childNode, childSpec, registry)')) {
          throw new Error(`${f}: amendSet top-level child loop is MISSING applyMarginBox — B5E finding 1 regressed (Badge pip would measure 24px on re-amend, spec/gate say 20px)`);
        }
        if (!s.includes('vis.node === childNode') || !s.includes('vis.node = box')) {
          throw new Error(`${f}: applyMarginBox must retarget Show bindings onto the margin-box wrapper (Polaris Button left-gap finding)`);
        }
      }
      console.log('amend-margin-box: button script carries applyMarginBox on create+amend with Show→wrapper retarget (Polaris icon left-gap)');
    },
  },
  {
    // Round 5f — CLASS 3: the Checkbox check glyph (and RadioButton dot) must
    // be CENTERED in the control box. The captured display:block carried no
    // centering, so a glyph inside an inset-0 absolute overlay pinned
    // top-left (owner: not centered vertically/horizontally). The emit now
    // centers an inset-overlay container that HAS content; an empty backdrop
    // overlay stays untouched. Verified through the REAL compile on a
    // synthesized fixture (an 18-box with an absolute inset overlay wrapping a
    // 14-box glyph).
    id: 'checkbox-center',
    claim: 'C3-detection',
    run: () => {
      const emptyTokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
      const engine = createFigmaEngine({ tokens: emptyTokens, icons: new Map() });
      const fixture: any = {
        id: 'fixture.control', name: 'Control', version: '0.0.0', status: 'draft',
        description: 'synthesized inset-overlay centering fixture', semantics: { element: 'span' },
        props: [{ name: 'variant', type: { enum: ['a'] }, default: 'a',
          bindings: { figma: { kind: 'VARIANT', property: 'V' }, code: { prop: 'variant' } } }],
        states: [],
        anatomy: { root: { layout: { display: 'flex' }, parts: {
          box: { element: 'span', declared: { position: 'relative', width: '18px', height: '18px' }, parts: {
            backdrop: { shape: { kind: 'rect', width: 18, height: 18 } },
            // absolute inset overlay WITH content — must center the glyph
            glyph: { element: 'span', declared: { position: 'absolute', 'aspect-ratio': '1 / 1' }, parts: {
              inner: { element: 'span', declared: { width: '14px', height: '14px' } },
            } },
          } },
        } } },
        anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'Control' } },
      };
      ContractSchema.parse(fixture);
      const data = engine.compileComponentData(fixture, new Map([[fixture.id, fixture]]));
      const find = (s: any, name: string): any => s.name === name ? s : (s.children ?? []).map((c: any) => find(c, name)).find(Boolean);
      const glyph = find(data.variants[0].spec, 'glyph');
      if (!glyph) throw new Error('inset-overlay glyph part not compiled');
      if (!glyph.insetOverlay) throw new Error('glyph part is not an inset overlay (position:absolute inset:0)');
      if (glyph.layout?.primary !== 'CENTER' || glyph.layout?.counter !== 'CENTER') {
        throw new Error(`inset-overlay content is NOT centered: layout=${JSON.stringify(glyph.layout)} — the check glyph would pin top-left`);
      }
      // an empty backdrop overlay must NOT be force-centered (byte-neutral guard):
      const backdrop = find(data.variants[0].spec, 'backdrop');
      if (backdrop?.insetOverlay && (backdrop.children?.length ?? 0) === 0 && backdrop.layout?.primary === 'CENTER') {
        throw new Error('empty backdrop overlay was force-centered — should be untouched');
      }
      console.log('checkbox-center: an inset-overlay container WITH content compiles to CENTER/CENTER (glyph centered in the control box); empty backdrop overlays untouched');
    },
  },
  {
    // Round 5f — OPTIONAL-ADORNMENT-FORCED-PRESENT, the general rule as a
    // SYNTHESIZED minimal fixture (independent of Polaris): a component with
    // BOTH adornment shapes — an optional-ICON boolean (withIcon) and an
    // optional-PIP defaultless enum whose unset value the promotion
    // materialized as the default (pip: none|a|b, default none, base-hidden
    // shownWhen). Proves, through the REAL canvas compile (createFigmaEngine
    // .compileComponentData):
    //   · the DEFAULT variant (first) carries NO pip part (adornment absent);
    //   · a pip=set variant DOES carry it (adornment present);
    //   · the boolean toggle is EXPOSED as a Figma BOOLEAN property (a
    //     designer can turn the icon ON), default OFF → the icon node renders
    //     EMPTY (visibleDefault false), never a drawn box;
    //   · the unset value IS enumerated as a real variant (the plain cell).
    id: 'optional-adornment-gating-general-fixture',
    claim: 'C3-detection',
    run: () => {
      const emptyTokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
      const engine = createFigmaEngine({ tokens: emptyTokens, icons: new Map() });
      const fixture: any = {
        id: 'fixture.adorned', name: 'Adorned', version: '0.0.0', status: 'draft',
        description: 'synthesized optional-adornment fixture', semantics: { element: 'span' },
        props: [
          { name: 'label', type: 'text', default: 'Hi',
            bindings: { figma: { kind: 'TEXT', property: 'Label' }, code: { prop: 'children' } } },
          { name: 'withIcon', type: 'boolean', default: false,
            bindings: { figma: { kind: 'BOOLEAN', property: 'Show Icon' }, code: { prop: 'withIcon' } } },
          // defaultless-origin enum, unset value 'none' materialized as default
          { name: 'pip', type: { enum: ['none', 'a', 'b'] }, default: 'none',
            bindings: { figma: { kind: 'VARIANT', property: 'Pip' }, code: { prop: 'pip' } } },
        ],
        states: [],
        anatomy: {
          root: {
            layout: { display: 'flex', align: 'center' },
            parts: {
              icon: { element: 'span', declared: { width: '20px', height: '16px' },
                visibleWhen: { prop: 'withIcon' },
                description: 'optional icon, boolean-gated' },
              pip: { element: 'span', declared: { display: 'none' },
                stylesWhen: [
                  { prop: 'pip', equals: 'a', styles: { display: 'block' } },
                  { prop: 'pip', equals: 'b', styles: { display: 'block' } },
                ],
                description: 'optional pip, base-hidden defaultless enum' },
              label: { element: 'span', text: 'Hi' },
            },
          },
        },
        anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'Adorned' } },
      };
      ContractSchema.parse(fixture);
      const data = engine.compileComponentData(fixture, new Map([[fixture.id, fixture]]));
      const childNames = (v: any) => (v.spec.children ?? []).map((c: any) => c.name);
      // default variant is first; it is the plain (Pip=none) cell
      const def = data.variants[0];
      if (!/Pip=none/.test(def.name)) throw new Error(`default variant is not the plain Pip=none cell: "${def.name}"`);
      if (childNames(def).includes('pip')) throw new Error('default (Pip=none) variant DREW the pip — adornment forced present');
      // the unset value is a real enumerated variant, AND set values remain
      const names = data.variants.map((v: any) => v.name);
      if (!names.some((n: string) => /Pip=a/.test(n))) throw new Error('pip=a variant not enumerated (set values lost)');
      const pipA = data.variants.find((v: any) => /Pip=a/.test(v.name))!;
      if (!childNames(pipA).includes('pip')) throw new Error('pip=a variant did NOT draw the pip (adornment gate broken)');
      // the boolean toggle is exposed, default OFF, icon renders empty
      const bp = data.boolProps.find((b: any) => b.property === 'Show Icon');
      if (!bp) throw new Error('withIcon boolean toggle "Show Icon" not exposed as a Figma property');
      if (bp.default !== false) throw new Error('withIcon default is not OFF — the default variant would draw the icon');
      const iconNode = (def.spec.children ?? []).find((c: any) => c.name === 'icon');
      if (!iconNode) throw new Error('icon node missing entirely');
      if (iconNode.visibleDefault !== false) throw new Error('icon visibleDefault is not false — the empty icon box would draw by default');
      console.log('optional-adornment-gating-general-fixture: default variant plain (no pip), pip=a variant has it, "Show Icon" boolean exposed default OFF (icon node visibleDefault false), unset value enumerated as a real variant');
    },
  },
  // -------------------------------------------------------------------------
  // DEPTH BUILD — Stage A+B pins (portal-aware capture + multi-root anatomy).
  // Deterministic + browser-free: they read the committed production receipt
  // (extract/computed/depth/receipts/, generated by depth-receipt.ts) and re-run
  // the PRODUCTION anatomy functions over it. Regenerate the receipt with
  //   npx tsx extract/computed/depth/depth-receipt.ts --harness <polaris-sandbox>
  // -------------------------------------------------------------------------
  {
    // Stage A: the whole-document baseline-diff reader captures the Modal
    // dialog PORTALED to document.body, exactly where the CURRENT in-stage
    // reader (stage.firstElementChild) sees NOTHING (ADVANCED-PROBE N1).
    id: 'portal-capture-modal',
    claim: 'C5-extraction',
    run: () => {
      const cap = JSON.parse(
        readFileSync(path.join(ROOT, 'extract/computed/depth/receipts/modal.capture.json'), 'utf8'),
      ) as {
        currentReader: { present: boolean; descendantEls: number };
        roots: Array<{ location: string; bytes: number; node: DepthNode }>;
      };
      // the current in-stage floor reader is ABSENT — the sweep would throw today
      if (cap.currentReader.present !== false || cap.currentReader.descendantEls !== 0) {
        throw new Error(`current in-stage reader is not absent (present=${cap.currentReader.present}) — the portal escape was not proven`);
      }
      const portaled = cap.roots.filter((r) => r.location === 'portaled');
      const inStage = cap.roots.filter((r) => r.location === 'in-stage');
      if (portaled.length < 1) throw new Error('no portaled root captured — Modal renders 100% into a portal');
      if (inStage.length !== 0) throw new Error('unexpected in-stage root for a fully portaled Modal');
      const portalBytes = portaled.reduce((n, r) => n + r.bytes, 0);
      if (portalBytes < 3000) throw new Error(`portaled DOM ${portalBytes} B is too small to be the real dialog subtree`);
      // the portaled root descends (production descent) to the real roots,
      // with the LIBRARY'S OWN class prefix (no vendor literal in the engine)
      const dcfg = loadCaptureConfig(ROOT, path.join(ROOT, 'extract/computed/configs/polaris-depth.json'));
      const real = cap.roots.flatMap((r) => descendToRealRoots(r.node, dcfg.library.classPrefix));
      if (real.length < 2) throw new Error(`descent yielded ${real.length} real root(s) — expected the dialog + backdrop`);
      console.log(`portal-capture-modal: current reader ABSENT (0) → 1 portaled root, ${portalBytes} B dialog; descends to ${real.length} real roots`);
    },
  },
  {
    // Stage B: the PRODUCTION descent + multi-root union/promotion turns the
    // captured portal tree into a real MULTI-ROOT anatomy {dialog, backdrop}
    // (the current single-root reader returns 0). Schema-valid with NO schema
    // change (anatomy is already Record<string, Part>).
    id: 'multi-root-anatomy',
    claim: 'C5-extraction',
    run: () => {
      const cap = JSON.parse(
        readFileSync(path.join(ROOT, 'extract/computed/depth/receipts/modal.capture.json'), 'utf8'),
      ) as { roots: Array<{ node: DepthNode }> };
      const cfg = loadCaptureConfig(ROOT, path.join(ROOT, 'extract/computed/configs/polaris-depth.json'));
      const modal = cfg.components.find((c) => c.name === 'Modal')!;
      const space = propSpaceFor(ROOT, cfg, modal);
      const multi = buildMultiRootUnion(
        [{ combo: space.baseComboKey, interaction: 'default', newRoots: cap.roots.map((r) => r.node) }],
        `${space.baseComboKey}__default`,
        modal.name,
        cfg.library.classPrefix,
      );
      const promo = promoteMultiRootAnatomy(space, modal, multi, depthKebab(space.contract.name));
      // multi-root anatomy is schema-valid with NO schema change
      ContractSchema.parse(promo.contract);
      const roots = Object.keys(promo.contract.anatomy);
      if (roots.length !== 2) throw new Error(`expected 2 anatomy roots, got ${roots.length}: ${roots.join(', ')}`);
      if (!roots.includes('dialog') || !roots.includes('backdrop')) {
        throw new Error(`multi-root anatomy is not {dialog, backdrop}: ${roots.join(', ')}`);
      }
      // match/beat the spike (2 roots, 17 parts, depth 7)
      if (promo.partCount < 17) throw new Error(`promoted ${promo.partCount} parts (< spike 17)`);
      if (promo.depth < 7) throw new Error(`promoted depth ${promo.depth} (< spike 7)`);
      console.log(`multi-root-anatomy: {${roots.join(', ')}}, ${promo.partCount} parts depth ${promo.depth} (spike 17/7) — single-root reader returns 0`);
    },
  },
  {
    // REGRESSION GUARD: the multi-root path is ADDITIVE. For an HTML-rooted
    // component (Badge/Button/Checkbox) descent is a no-op — realRootsOf(root)
    // == [root] — so the multi-root promoted anatomy is BYTE-IDENTICAL to the
    // single-root promotion. Proves Stage A+B does not shift the committed 12.
    id: 'simple-component-anatomy-unchanged',
    claim: 'C1-determinism',
    run: () => {
      const cfg = loadCaptureConfig(ROOT, path.join(ROOT, 'extract/computed/configs/polaris.json'));
      for (const name of ['Badge', 'Button', 'Checkbox']) {
        const sc = cfg.components.find((c) => c.name === name)!;
        const ss = propSpaceFor(ROOT, cfg, sc);
        const truth = JSON.parse(
          readFileSync(path.join(ROOT, 'extract/computed/out', name.toLowerCase(), 'captured-truth.json'), 'utf8'),
        ) as { base: { root: DepthNode } };
        const root = truth.base.root;
        const rr = descendToRealRoots(root, cfg.library.classPrefix);
        if (!(rr.length === 1 && rr[0] === root)) {
          throw new Error(`${name}: realRootsOf(root) descended a wrapper — the census root is not preserved`);
        }
        const caps: DepthCapture[] = [{ combo: ss.baseComboKey, interaction: 'default', root }];
        const uSingle = depthBuildUnion(caps, caps[0], cfg.library.classPrefix);
        depthNameUnion(uSingle.entries, sc.name, cfg.library.classPrefix);
        const single = depthPromoteAnatomy(ss, sc, uSingle, depthKebab(ss.contract.name)).contract.anatomy;
        const m = buildMultiRootUnion(
          [{ combo: ss.baseComboKey, interaction: 'default', newRoots: [root] }],
          `${ss.baseComboKey}__default`,
          sc.name,
          cfg.library.classPrefix,
        );
        const multiA = promoteMultiRootAnatomy(ss, sc, m, depthKebab(ss.contract.name)).contract.anatomy;
        if (JSON.stringify(single) !== JSON.stringify(multiA)) {
          throw new Error(`${name}: multi-root anatomy differs from single-root anatomy — the multi-root path is NOT additive`);
        }
      }
      console.log('simple-component-anatomy-unchanged: Badge/Button/Checkbox descend zero wrappers; multi-root anatomy == single-root anatomy (byte-identical)');
    },
  },
  {
    // CLASS-STEM PREFIX DEFECT (task #25) — THE CLASS, not the instance.
    //
    // `stems()` decides what a captured element IS: signature = tag + stems,
    // and part names come from the dominant stem. It drops "modifier" classes
    // by testing for `--`. That test is only meaningful on what the library
    // wrote AFTER its own prefix — so prefix-stripping MUST run FIRST.
    //
    // It did not. Carbon's `classPrefix` is `cds--`, so the modifier filter
    // read the PREFIX's own separator and discarded EVERY Carbon class:
    // `cds--btn` scored `button|` (tag only) while the node's `classes` still
    // said `["cds--btn"]`. Alignment fell back to POSITION and every part
    // named `part-<path>`. `classAllow` had preserved exactly the right
    // classes; the engine threw them away one step later.
    //
    // This pin is written against the CLASS — "a library whose classPrefix
    // contains `--` keeps its block classes as stems" — using both a
    // synthetic prefix and Carbon's committed capture, plus the two
    // properties the fix must not break (BEM modifiers still dropped, the
    // `Block--root` block-root case still yields the block name). Falsified
    // by reverting the order: every assertion below fails BY NAME.
    id: 'class-stem-prefix-order',
    claim: 'C1-determinism',
    run: () => {
      // 1. THE CLASS: any prefix containing '--'. Synthetic, so the rule is
      //    pinned independently of whether Carbon is still in the repo.
      const s1 = stems(['zz--card', 'zz--card__title', 'zz--card--elevated'], 'zz--');
      if (JSON.stringify(s1) !== JSON.stringify(['card', 'card__title'])) {
        throw new Error(`a classPrefix containing '--' lost its block classes: got [${s1.join(', ')}] — expected [card, card__title] (prefix-stripping must precede modifier-filtering)`);
      }
      // 2. THE PROPERTIES THE FIX MUST NOT BREAK.
      //    BEM modifiers still drop, after the prefix comes off.
      if (stems(['cds--btn--primary'], 'cds--').length !== 0) {
        throw new Error('a real BEM modifier survived the filter — cds--btn--primary is not an element');
      }
      //    A `Block--root` block-root keeps the block name (Polaris Text).
      if (JSON.stringify(stems(['Polaris-Text--root', 'Polaris-Text--bodyMd'], 'Polaris-')) !== JSON.stringify(['Text'])) {
        throw new Error('the Block--root block-root special case no longer yields the block name');
      }
      //    An empty prefix (Tailwind) is untouched.
      if (JSON.stringify(stems(['rounded-md', 'bg-blue-600'], '')) !== JSON.stringify(['bg-blue-600', 'rounded-md'])) {
        throw new Error('the empty-prefix (Tailwind) reading moved');
      }
      // 3. THE FIELD CASE, against the COMMITTED Carbon capture: every node
      //    the config's own classAllow kept must produce at least one stem,
      //    and the root signature must carry a class, not just a tag.
      const cfg = loadCaptureConfig(ROOT, path.join(ROOT, 'extract/computed/configs/carbon.json'));
      if (!cfg.library.classPrefix.includes('--')) {
        throw new Error(`carbon.json classPrefix is "${cfg.library.classPrefix}" — this pin needs the library whose prefix contains '--'`);
      }
      const truth = JSON.parse(
        readFileSync(path.join(ROOT, 'extract/computed/out/carbon/button/captured-truth.json'), 'utf8'),
      ) as { base: { root: DepthNode } };
      let classed = 0;
      let stemless: string[] = [];
      const walk = (n: DepthNode): void => {
        if (n.classes.length > 0) {
          classed++;
          if (stems(n.classes, cfg.library.classPrefix).length === 0) stemless.push(n.classes.join('.'));
        }
        for (const c of n.nodes) if (c.t === 'el') walk((c as { el: DepthNode }).el);
      };
      walk(truth.base.root);
      if (classed === 0) throw new Error('carbon/button capture carries no classed nodes — the fixture cannot pin anything');
      if (stemless.length > 0) {
        throw new Error(`${stemless.length}/${classed} classed Carbon node(s) produced ZERO stems — the prefix's own '--' is being read as a BEM modifier: ${stemless.slice(0, 3).join(' | ')}`);
      }
      const rootSig = signature(truth.base.root, cfg.library.classPrefix);
      if (!rootSig.includes('|') || rootSig.endsWith('|')) {
        throw new Error(`carbon/button root signature is "${rootSig}" — tag-only, so union alignment falls back to POSITION and parts name as part-<path>`);
      }
      console.log(`class-stem-prefix-order: a classPrefix containing '--' keeps its block classes (zz--card → card); modifiers still drop, Block--root still yields the block, empty prefix untouched; all ${classed} classed nodes of the committed carbon/Button capture yield stems and the root signature is "${rootSig}" (was "button|")`);
    },
  },
  {
    // ADVANCED-COMPOSITION GATE — the multi-root Modal emits on all four
    // surfaces. The depth north star (both journeys) needed the emitters +
    // validator to consume MULTI-ROOT anatomy (a captured composite = several
    // top-level roots). This pin runs the committed receipt harness
    // (examples/depth-modal/emit-modal-receipt.ts) which drives the assembled
    // schema-valid composite `ds.modal-composite` ({dialog, backdrop}) through
    // every emitter and PROVES each by EXECUTION (not grep): emit-react +
    // emit-react-inline are esbuild-bundled and rendered with react-dom/server
    // (real modal markup — role="dialog" header→(title,close), body,
    // footer→(Cancel,Save), sibling backdrop); emit-html carries the same
    // static markup; emit-figma-script's COMPONENTS payload referees to ONE
    // variant frame whose children are both roots AND the whole script
    // headless-executes in a VM against the mocked figma global.
    // examples/ is not copied into scratch (see astryx-dev-journey), so the
    // harness + contract are staged in first; it writes into the staged scratch
    // copy (never the committed ROOT artifacts).
    id: 'emitter-multi-root-modal',
    claim: 'C8-journey',
    run: () => {
      cpSync(
        path.join(ROOT, 'examples', 'depth-modal'),
        path.join(SCRATCH, 'examples', 'depth-modal'),
        { recursive: true },
      );
      const r = run(TSX, ['examples/depth-modal/emit-modal-receipt.ts']);
      if (r.status !== 0 || !r.out.includes('all 5 surfaces emitted + EXECUTED')) {
        throw new Error(`multi-root Modal receipt failed:\n${r.out.slice(0, 1600)}`);
      }
      // The harness prints one ✔ line per surface; require all five.
      for (const surface of [
        'emit-react —',
        'emit-react-inline —',
        'emit-html —',
        'emit-figma-script (referee)',
        'emit-figma-script (headless)',
      ]) {
        if (!r.out.includes(`✔ ${surface}`)) {
          throw new Error(`multi-root Modal: surface "${surface}" did not pass:\n${r.out.slice(0, 1600)}`);
        }
      }
      console.log('emitter-multi-root-modal: {dialog, backdrop} emits valid React (bundles+renders headless) + HTML markup + figma-script (referee frame carries both roots, headless-executes) — dialog+backdrop present, Cancel/Save actions render');
    },
  },
  {
    // SINGLE-ROOT GOLDEN INVARIANT — the multi-root generalization is ADDITIVE.
    // Every repo contract is single-root (one top-level "root"), so each takes
    // the UNTOUCHED N=1 emitter path: a forwardRef component around one root
    // element, a `.root` CSS rule, and NEVER the multi-root Fragment branch.
    // The BYTE authority is `golden-generated-output` (it re-hashes every
    // src/ + figma-sync file against evals/golden.json); this pin names that
    // dependency and proves the branch SELECTION directly — a single-root
    // contract must not carry one byte of the multi-root marker.
    id: 'single-root-golden-invariant',
    claim: 'C1-determinism',
    run: () => {
      const byId = new Map(
        readdirSync(path.join(ROOT, 'contracts'))
          .filter((f) => f.endsWith('.contract.json'))
          .map((f) => ContractSchema.parse(JSON.parse(readFileSync(path.join(ROOT, 'contracts', f), 'utf8'))))
          .map((c) => [c.id, c]),
      );
      const icons = new Map(
        readdirSync(path.join(ROOT, 'assets', 'icons'))
          .filter((f) => f.endsWith('.svg'))
          .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(ROOT, 'assets', 'icons', f), 'utf8').trim()]),
      );
      const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));
      const tokenInv = tokenInventoryFromJson([
        read('tokens/primitives.tokens.json'),
        read('tokens/semantic.tokens.json'),
        read('tokens/modes/semantic.light.tokens.json'),
        read('tokens/modes/semantic.dark.tokens.json'),
      ]);
      let multiRootCount = 0;
      for (const c of byId.values()) if (coreIsMultiRoot(c)) multiRootCount++;
      if (multiRootCount !== 0) {
        throw new Error(`${multiRootCount} repo contract(s) are multi-root — the golden set must be all single-root`);
      }
      for (const id of ['ds.badge', 'ds.button', 'ds.card']) {
        const c = byId.get(id)!;
        const { tsx, css } = coreEmitReact(c, { tokens: tokenInv, icons, contracts: byId });
        if (coreIsMultiRoot(c)) throw new Error(`${id}: isMultiRoot true — expected single-root`);
        if (tsx.includes('MULTI-ROOT composite')) {
          throw new Error(`${id}: single-root emit carries the multi-root marker — the branch guard leaked`);
        }
        if (!tsx.includes('forwardRef<')) throw new Error(`${id}: single-root React is not the forwardRef component`);
        if (!/\.root\s*\{/.test(css)) throw new Error(`${id}: single-root CSS lost its .root rule`);
      }
      console.log(`single-root-golden-invariant: all ${byId.size} repo contracts are single-root (0 multi-root); Badge/Button/Card take the untouched forwardRef+.root path, zero multi-root marker — byte authority is golden-generated-output`);
    },
  },
  {
    // DEPTH STAGE C — the DYNAMIC CHILD-COLLECTION composite. The advanced-
    // composition frontier on top of the multi-root path: a multi-root Modal
    // (ds.composite-modal = {dialog, backdrop}) whose BODY holds composed
    // children rather than only static leaf parts — a single composed ds.card
    // instance AND a ds.badge template REPEATED over the arrayOf `items` prop.
    // KEY FINDING this pin locks in: Stage C required ZERO core/emit-*.ts
    // changes — the `component` + `repeat` channels already lived in every
    // emitter, so composition was latent in the multi-root gate. This runs the
    // committed receipt (examples/depth-composite/emit-composite-receipt.ts),
    // proving each of the four surfaces by EXECUTION: emit-react +
    // emit-react-inline esbuild-bundle and render (role="dialog" body holds
    // <Card> + the live items array mapped to N <Badge> children, sibling
    // backdrop); emit-html the same static markup; emit-figma-script referees
    // to one variant frame (body = composed summary instance + N repeated tag
    // instances) AND headless-executes in a VM — seeding token variables
    // (buildTokensScript) then syncing the transitive deps in order
    // (Avatar→Button→Badge→Card, incl. slot.accepts INSTANCE_SWAP targets)
    // before the composite builds its nested instance composition. THE NORTH
    // STAR is the 6th check: the built canvas COMPONENT node tree is walked and
    // asserted to line up with the CONTRACT anatomy PART-FOR-PART (every part at
    // its declared nesting path; body.summary a nested ds.card INSTANCE;
    // body.tags N repeated ds.badge INSTANCEs; dialog+backdrop sibling roots) —
    // "the anatomy of a coded component lines up with the anatomy of a canvas-
    // based Figma component." examples/ is not copied into scratch (see
    // astryx-dev-journey) — stage it in first.
    id: 'depth-composite-child-collection',
    claim: 'C8-journey',
    run: () => {
      cpSync(
        path.join(ROOT, 'examples', 'depth-composite'),
        path.join(SCRATCH, 'examples', 'depth-composite'),
        { recursive: true },
      );
      const r = run(TSX, ['examples/depth-composite/emit-composite-receipt.ts']);
      if (r.status !== 0 || !r.out.includes('5 surfaces emitted + EXECUTED, canvas anatomy ≡ code anatomy')) {
        throw new Error(`Stage C composite receipt failed:\n${r.out.slice(0, 1600)}`);
      }
      for (const surface of [
        'emit-react —',
        'emit-react-inline —',
        'emit-html —',
        'emit-figma-script (referee)',
        'emit-figma-script (headless)',
        'anatomy-parity (code ≡ canvas)',
      ]) {
        if (!r.out.includes(`✔ ${surface}`)) {
          throw new Error(`Stage C composite: check "${surface}" did not pass:\n${r.out.slice(0, 1600)}`);
        }
      }
      console.log('depth-composite-child-collection: multi-root Modal body holds a composed ds.card + a ds.badge collection REPEATED over items — renders on React/inline/HTML and headless-executes as figma-script; NORTH STAR: the built canvas COMPONENT anatomy lines up with the contract PART-FOR-PART (body.summary a nested ds.card INSTANCE, body.tags 3 repeated ds.badge INSTANCEs, dialog+backdrop sibling roots); ZERO core/emit-*.ts changes — composition was latent in the multi-root channels');
    },
  },
  {
    // ASTRYX DEV-JOURNEY pin — the second-system exhibit's runnable tail.
    // The 10 promoted flagship contracts (examples/astryx/contracts, code-side
    // extraction of @astryxdesign/core@0.1.6) are the developer-journey input;
    // this pin asserts the two load-bearing invariants self-contained (no
    // network, no sandbox): (1) the LOCAL generator turns them into React +
    // CSS + stories BYTE-STABLE (two runs, identical tree hash), and (2) a
    // committed Figma sync script COMPILES (the referee: its COMPONENTS
    // payload parses to the Badge set with the full 14-tone variant grid).
    // examples/ is not copied into scratch by resetScratch, so the fixture is
    // staged in first; generation runs through the SAME generateComponents the
    // ds-contracts CLI's `generate` verb calls.
    id: 'astryx-dev-journey',
    claim: 'C8-journey',
    run: () => {
      cpSync(path.join(ROOT, 'examples', 'astryx'), path.join(SCRATCH, 'examples', 'astryx'), {
        recursive: true,
      });
      // 1. generate byte-stable — the SAME CLI shell `npm run generate` runs
      //    (scripts/generate-components.ts), twice, over the 10 flagship
      //    contracts; the two output trees must hash identical.
      const genArgs = (out: string) => [
        'scripts/generate-components.ts',
        '--contracts', 'examples/astryx/contracts',
        '--tokens', 'examples/astryx/tokens/astryx.dtcg.json,examples/astryx/tokens/astryx-minted.dtcg.json',
        // Exact-conversion wave: banner's four status icons and text-input's
        // three type glyphs are real SVG assets in the example's own icons
        // dir — same flag the MUI genesis eval already passes.
        '--icons', 'examples/astryx/assets/icons',
        '--out', out,
        '--stories',
      ];
      const a = run(TSX, genArgs('examples/astryx/.pin-a'));
      // Phase B (2026-07-22): the 10 flagships + the 3 promoted composition
      // contracts (DropdownMenu, DropdownMenuItem, Toast) — 13 components.
      if (a.status !== 0 || !a.out.includes('Generated 13 component(s)')) {
        throw new Error(`astryx generate (run A) did not emit 13 components:\n${a.out}`);
      }
      const b = run(TSX, genArgs('examples/astryx/.pin-b'));
      if (b.status !== 0) throw new Error(`astryx generate (run B) failed:\n${b.out}`);
      const hA = hashTree('examples/astryx/.pin-a');
      const hB = hashTree('examples/astryx/.pin-b');
      if (hA !== hB) throw new Error(`astryx generate is NOT byte-stable: ${hA} != ${hB}`);
      // 2. a committed Figma sync script compiles (referee): its COMPONENTS
      //    payload parses to the Badge set with the full 14-tone variant grid.
      const comp = parseSyncComponent(
        readFileSync(path.join(SCRATCH, 'examples', 'astryx', 'figma', 'badge.figma.js'), 'utf8'),
      );
      if (comp.setName !== 'Badge' || comp.contractId !== 'astryx.badge' || comp.isSet !== true) {
        throw new Error(`badge figma set identity wrong: ${JSON.stringify({ s: comp.setName, c: comp.contractId, i: comp.isSet })}`);
      }
      if ((comp.variants ?? []).length !== 14) {
        throw new Error(`badge figma compiled ${(comp.variants ?? []).length} variants, expected 14`);
      }
      console.log(
        `astryx-dev-journey: 13 contracts (10 flagships + 3 composition-tier) → generator byte-stable × 2 runs (${hA.slice(0, 12)}…); ` +
          `committed badge.figma.js compiles to the 14-variant Badge set (referee)`,
      );
    },
  },
  {
    // ASTRYX GENESIS (Phase B, 2026-07-22) — the full foreign-system canvas
    // gate: 13 committed Figma scripts referee-pass AND headless-execute
    // (fresh-mock per primitive, shared dependency-ordered mock for the
    // composed pair with built-tree assertions — repeated item labels,
    // applied Button instance labels, multi-root split, non-collapse width
    // floors), the genesis token upsert runs twice (re-run = update in
    // place), and the ONE-PASTE GENESIS-BATCH executes start-to-finish in a
    // single mock (13 components + >=180 variables + host sections). This is
    // the code→design proof on a system this project does not own.
    id: 'astryx-figma-genesis',
    claim: 'C8-journey',
    run: () => {
      cpSync(path.join(ROOT, 'examples', 'astryx'), path.join(SCRATCH, 'examples', 'astryx'), {
        recursive: true,
        filter: (src) => !src.includes('.astryx-sandbox'),
      });
      const r = run(process.execPath, ['examples/astryx/scripts/figma-compile-receipt.mjs']);
      if (r.status !== 0) throw new Error(`astryx figma compile receipt failed:\n${r.out.slice(0, 1600)}`);
      if (!r.out.includes('13/13 scripts referee-pass + headless-run')) {
        throw new Error(`astryx figma compile receipt missing the 13/13 line:\n${r.out.slice(0, 800)}`);
      }
      console.log('astryx-figma-genesis: 13/13 foreign-system scripts referee+execute headless; composition trees asserted (repeat labels, instance labels, multi-root); genesis batch runs start-to-finish in one mock');
    },
  },
  {
    // ASTRYX MINTED-LITERAL RE-ANCHORING (2026-07-26) — the pass that attacks
    // DOCS-THEME.md's named finding (111 of 222 color refs ride minted
    // literals, so an alternate theme re-skins only half the surface).
    //
    // StyleX compiles the source token NAME away, so astryx has no
    // source-bindings.json and MUI's evidence-driven alias pass cannot run.
    // All that survives is the VALUE — so the pass is a value join that RANKS
    // and PRESENTS and never auto-resolves, plus a human ledger.
    //
    // This pin covers the four properties the round is worth nothing without,
    // and FALSIFIES each one:
    //   1. --propose is deterministic (two runs, byte-identical outputs)
    //   2. the ANCHOR-PLANE guard refuses a docs-plane anchor BY NAME (joining
    //      a re-themed plane would freeze theme-neutral behind a "clean" alias)
    //   3. --apply refuses an un-acked id, and refuses an EXCLUDED row
    //   4. the BYTE-GATE holds: the 9 applied aliases resolve to the same
    //      NEUTRAL values and the 13 neutral component scripts re-emit
    //      byte-identical (aliasing must not move a neutral pixel)
    id: 'astryx-reanchor-minted',
    claim: 'C1-determinism',
    run: () => {
      cpSync(path.join(ROOT, 'examples', 'astryx'), path.join(SCRATCH, 'examples', 'astryx'), {
        recursive: true,
        filter: (src) => !src.includes('.astryx-sandbox'),
      });
      const SCRIPT = 'examples/astryx/scripts/reanchor-minted.ts';
      const T = (rel: string) => path.join(SCRATCH, rel);
      const sha = (rel: string) => createHash('sha256').update(readFileSync(T(rel))).digest('hex');
      const OUTPUTS = [
        'examples/astryx/tokens/reanchor-proposals.json',
        'examples/astryx/tokens/reanchor-proposals.md',
        'examples/astryx/tokens/MINTED.md',
      ];
      const MINTED = 'examples/astryx/tokens/astryx-minted.dtcg.json';
      const BASE = 'examples/astryx/tokens/astryx.dtcg.json';

      // --- 1. propose is deterministic -------------------------------------
      const p1 = run(TSX, [SCRIPT, '--propose']);
      if (p1.status !== 0) throw new Error(`--propose failed:\n${p1.out}`);
      const h1 = OUTPUTS.map(sha);
      const p2 = run(TSX, [SCRIPT, '--propose']);
      if (p2.status !== 0) throw new Error(`--propose (run B) failed:\n${p2.out}`);
      const h2 = OUTPUTS.map(sha);
      if (h1.join() !== h2.join()) throw new Error(`--propose is NOT byte-stable:\n${h1.join()}\n${h2.join()}`);
      // and it agrees with the COMMITTED artifacts (no uncommitted drift)
      for (const rel of OUTPUTS) {
        if (!readFileSync(T(rel)).equals(readFileSync(path.join(ROOT, rel)))) {
          throw new Error(`${rel} regenerates DIFFERENT bytes than the committed artifact`);
        }
      }
      const proposals = JSON.parse(readFileSync(T(OUTPUTS[0]), 'utf8'));
      const disp = (d: string) => proposals.rows.filter((r: any) => r.disposition === d);
      const refsOf = (d: string) => disp(d).reduce((a: number, r: any) => a + r.refs, 0);
      // POST-REVIEW STATE: the queue is RESOLVED — 78 refs applied, 0 ambiguous.
      //
      // Was 63/0 against the FROZEN capture, then 70/0 after the 2026-07-29
      // recapture (task #43) review. The 2026-08 exact-conversion wave rebound
      // the badge and switch contracts, minting new colour leaves that
      // reopened the queue at 34 applied / 43 ambiguous; the 2026-08-08
      // continuation review round (executed by automation under the owner
      // delegation of TJ 2026-07-26, flagged for owner review) resolved it:
      // five rows extended mechanically as same-value/same-target
      // continuations, five new arms decided on the committed source bindings
      // in the sandbox @astryxdesign/core (Badge.tsx names color-accent /
      // color-error / color-success / color-warning and their color-on-*
      // content partners per variant; Switch.tsx names color-text-secondary
      // for labels and color-background-surface for the thumb), and one new
      // kept-literal receipt for badge-neutral's alpha-serialisation near-miss.
      if (refsOf('applied') !== 78 || refsOf('ambiguous') !== 0) {
        throw new Error(`join moved: expected 78 applied / 0 ambiguous refs, got ${refsOf('applied')} / ${refsOf('ambiguous')}`);
      }
      // THE KEPT-LITERAL RECEIPTS TURNED OVER COMPLETELY, and both halves of
      // that are the point.
      //
      // GONE (2 rows / 2 leaves): each explained why a value-named SHARED leaf
      // stayed anonymous, and both existed only to back `row-rule-color` refs
      // on the slider tooltip. With that currentcolor mirror folded away (task
      // #35) the leaves are not minted at all, so the receipts explain nothing.
      // One had NAMED its own unblocking condition — "name the tooltip surface
      // first ... then this leaf becomes decidable" — and this round names that
      // surface (color-background-inverted), so the white tooltip text it
      // declined is now DECIDED as color-on-dark.
      //
      // NEW (1 row / 2 leaves): #00000000 on button variant=ghost and card
      // variant=transparent. No candidate exists because the anchor names no
      // token for the ABSENCE of paint, and re-anchoring either would make a
      // deliberately transparent surface start painting on a re-theme. Kept
      // literal on purpose, so the pair is DECIDED rather than pending.
      //
      // 2026-08-08 continuation round: a SECOND receipt (1 row / 1 leaf).
      // badge.root.background-color.neutral is #0536591A in the wave's fresh
      // mint; the source names {color-neutral} outright, but the anchor
      // authors that token as rgba(5, 54, 89, 0.1) — alpha 25.5/255 vs the
      // capture's 26/255 — and the join refuses near-miss tuple equality BY
      // DESIGN. Receipted with the unblocking condition named (re-author the
      // anchor's alpha so it round-trips), not silently pending.
      const lit = proposals.summary.literalReceipts;
      if (!lit || lit.rows !== 2 || lit.leaves !== 3 || lit.refs !== 3) {
        throw new Error(`the decided-literal receipts moved: expected 2 rows / 3 leaves / 3 refs (the transparent pair + badge-neutral alpha near-miss), got ${JSON.stringify(lit)}`);
      }
      const cardBorder = proposals.rows.find((r: any) => r.exclusion === 'card-border-degraded-capture');
      if (!cardBorder || cardBorder.refs !== 48) {
        throw new Error(`the 48 card-border refs are not refused by name (got ${cardBorder ? cardBorder.refs : 'no row'})`);
      }
      if (disp('ambiguous').some((r: any) => r.candidates.length < 2)) {
        throw new Error('an "ambiguous" row has fewer than 2 candidates — the disposition is wrong');
      }
      // NOTHING SILENTLY PENDING: every live leaf of every non-excluded row is
      // either re-anchored or carries a named kept-literal receipt. This is the
      // structural claim "the queue reads as RESOLVED", checked rather than
      // asserted in prose.
      const silent = proposals.rows
        .filter((r: any) => r.disposition !== 'excluded')
        .flatMap((r: any) => r.leafDetail.filter((d: any) => d.refs > 0 && !d.aliasedTo && d.decidedLiteral === undefined).map((d: any) => d.leaf));
      if (silent.length > 0) throw new Error(`${silent.length} live leaf/leaves are pending with NO decision and NO receipt: ${silent.join(', ')}`);

      // --- 2. the anchor-plane guard ---------------------------------------
      const docsAnchor = run(TSX, [SCRIPT, '--propose', '--anchor', 'examples/astryx/tokens/astryx-docs.dtcg.json']);
      if (docsAnchor.status === 0) throw new Error('a DOCS-plane anchor was ACCEPTED — the join would freeze theme-neutral behind a "clean" alias');
      if (!docsAnchor.out.includes('anchor plane is NOT theme-neutral') || !docsAnchor.out.includes('color-accent')) {
        throw new Error(`the anchor refusal does not name the plane and the probe:\n${docsAnchor.out}`);
      }
      // FALSIFIED by step 1: the NEUTRAL anchor is accepted (p1.status === 0).

      // --- 3. --apply is explicit-ack only ---------------------------------
      // Every live row is acked now, so the un-acked path is falsified by
      // UN-ACKING one: drop RA-ccd3db's two decisions from the scratch ledger
      // and the id must refuse instead of landing on affinity.
      const LEDGER = 'examples/astryx/tokens/reanchor-decisions.json';
      const ledgerSrc = readFileSync(T(LEDGER), 'utf8');
      const ledgerObj = JSON.parse(ledgerSrc);
      writeFileSync(
        T(LEDGER),
        JSON.stringify({ ...ledgerObj, decisions: ledgerObj.decisions.filter((d: any) => !d.ids.includes('RA-ccd3db')) }, null, 2) + '\n',
      );
      const unacked = run(TSX, [SCRIPT, '--apply', 'RA-ccd3db']);
      writeFileSync(T(LEDGER), ledgerSrc);
      if (unacked.status === 0) throw new Error('an UN-ACKED row id was applied');
      if (!unacked.out.includes('un-acked ids never land')) throw new Error(`the un-acked refusal is not named:\n${unacked.out}`);
      const excluded = run(TSX, [SCRIPT, '--apply', 'RA-X-cardborder-000000']);
      if (excluded.status === 0) throw new Error('an EXCLUDED row was applied — exclusions must never be targets');
      if (!excluded.out.includes('exclusions are receipts')) throw new Error(`the exclusion refusal is not named:\n${excluded.out}`);
      const mintedBefore = sha(MINTED);

      // FALSIFY: an ACKED id applies, idempotently, leaving the tree untouched
      const acked = run(TSX, [SCRIPT, '--apply', 'RA-042f97']);
      if (acked.status !== 0) throw new Error(`an acked id did NOT apply:\n${acked.out}`);
      if (sha(MINTED) !== mintedBefore) throw new Error('--apply on an already-landed row was not idempotent');

      // --- 4. the byte-gate + the light plane ------------------------------
      if (!acked.out.includes('13 neutral-plane component script(s) re-emitted BYTE-IDENTICAL')) {
        throw new Error(`the byte-gate did not run over all 13 component scripts:\n${acked.out}`);
      }
      const ledger = JSON.parse(readFileSync(T('examples/astryx/tokens/reanchor-decisions.json'), 'utf8')).decisions;
      const base = JSON.parse(readFileSync(T(BASE), 'utf8'));
      const mintedTree = JSON.parse(readFileSync(T(MINTED), 'utf8'));
      const at = (p: string) => p.split('.').reduce<any>((n, s) => (n ? n[s] : undefined), mintedTree);
      const norm = (v: string) => String(v).trim().toLowerCase();
      // 35 rows after the 2026-07-29 post-recapture review (was 19 against the
      // frozen capture). The turnover is larger than the net: 12 rows were
      // RETIRED and 4 PRUNED because every leaf they anchored was a
      // `row-rule-color` — the currentcolor mirror task #35 folds away — and 28
      // rows were authored against the fresh mint, 17 of whose leaves carry the
      // SAME target the previous round reviewed and are continuations rather
      // than new judgements.
      // 36 rows after the 2026-08-08 continuation round (was 31): the wave's
      // badge/switch rebinding reopened the queue and the round authored 5 new
      // arms (badge warning content, badge success content, switch thumb
      // surface, badge success background, badge warning background) while
      // extending 5 existing rows in place — rows sharing an id AND a target
      // stay merged, so no leaf is anchored twice.
      if (ledger.length !== 36) throw new Error(`expected 36 ledger rows (31 post-recapture + 5 arms from the 2026-08-08 continuation round; rows sharing an id AND a target were merged, so no leaf is anchored twice), got ${ledger.length}`);
      let aliasedLeaves = 0;
      for (const d of ledger) {
        if (d.ack !== 'explicit CLI --apply') throw new Error(`ledger row ${d.ids} carries the wrong ack`);
        if (norm(base[d.to].$value) !== norm(d.value)) {
          throw new Error(`LIGHT PLANE MOVED: {${d.to}} is ${base[d.to].$value}, the ledger was acked against ${d.value}`);
        }
        // THE DELEGATION PROVENANCE IS PART OF THE RECEIPT: the reviewed rows
        // were acked by the orchestrator under an authority the owner granted
        // on a named date, and a row that cannot say so is not a receipt.
        if (!/auto-clean: single candidate/.test(d.ackNote ?? '') && !/ORCHESTRATOR-REVIEWED UNDER OWNER DELEGATION, TJ 2026-07-26/.test(d.cause)) {
          throw new Error(`ledger row ${d.ids} does not carry the delegation provenance in its cause`);
        }
        for (const leaf of d.leaves) {
          if (at(leaf)?.$value !== `{${d.to}}`) throw new Error(`${leaf} is not aliased to {${d.to}}`);
          aliasedLeaves++;
        }
      }
      // 78 leaves carry an alias after the 2026-08-08 continuation round (was
      // 68 post-recapture, 54 before that): +12 new badge/switch leaves
      // decided this round, -2 pruned mechanically because the wave's
      // rebinding left them with zero contract refs (shared.color-0064e0 and
      // badge.root.color.neutral now sit in the unreferenced-leaf exclusion;
      // their tree aliases are untouched, see _prunedByWaveUnbind). Every
      // leaf is anchored exactly ONCE — rows sharing an id and a target
      // are merged, so the ledger cannot say the same leaf twice.
      //
      // THE NUMBER THAT SAYS WHETHER THE ROUND HELPED is the anchorable
      // denominator, not the raw total: of the minted tree's COLOUR leaves —
      // the only kind a colour token can ever name — aliased went 54/113 =
      // 47.8% to 68/134 = 50.7%, while the capture itself began reading 21 more
      // colour leaves and 150 more dimension leaves than the frozen one did.
      // Measured against the whole tree the share appears to FALL (22.8% ->
      // 16.7%) purely because those 150 dimension leaves join the denominator
      // and no colour token can address them.
      if (aliasedLeaves !== 78) throw new Error(`expected 78 re-anchored leaves, got ${aliasedLeaves}`);

      // PER-LEAF GRAIN. One value group splits into several decisions under one
      // id, and the applier must land EVERY row that names the id — the
      // pre-round `find` would have landed one arm and reported success with
      // the rest still literal.
      //
      // #FFFFFF now answers FOUR ways, up from three, and the fourth arm is the
      // interesting one. It is content-on-a-surface for button primary
      // (color-on-accent) and destructive (color-on-error); it is a SURFACE on
      // card's default background (color-background-card, since the color-on-*
      // family is excluded by channel); and it is the slider tooltip's white
      // text (color-on-dark). That last arm was DECLINED as undecidable by the
      // previous round, whose receipt named its own unblocking condition —
      // "name the tooltip surface first … then this leaf becomes decidable" —
      // and the post-recapture review names that surface
      // (color-background-inverted), so the text became decidable.
      const ffffff = ledger.filter((d: any) => d.ids.includes('RA-ffffff'));
      // SIX arms after the 2026-08-08 continuation round (was 4): the wave's
      // badge/switch rebinding minted new #ffffff leaves and the round added
      // (5) badge success content -> color-on-success (the role-over-hue
      // rubric, corroborated by Badge.tsx variantStyles.success) and (6) the
      // switch thumb surface -> color-background-surface (a COMMITTED source
      // binding in Switch.tsx styles.thumb outranks the mode-safe prediction;
      // the row carries a `deviation` field saying so).
      if (ffffff.length !== 6) throw new Error(`RA-ffffff should split into 6 per-leaf decisions, got ${ffffff.length}`);
      if (new Set(ffffff.map((d: any) => d.to)).size !== 6) throw new Error('the RA-ffffff split does not reach 6 distinct targets — the per-leaf grain is not exercised');
      // 18 leaves (was 13): +1 badge info content, +1 badge error content,
      // +1 badge success content, +2 switch thumbs — all minted by the wave's
      // rebinding and decided in the 2026-08-08 continuation round.
      if (ffffff.reduce((a: number, d: any) => a + d.leaves.length, 0) !== 18) throw new Error('RA-ffffff does not cover its 18 re-anchored leaves');

      // THE OTHER HALF OF THE REVIEW: kept-literal receipts.
      const literals = JSON.parse(readFileSync(T(LEDGER), 'utf8')).literals;
      // TWO receipts after the 2026-08-08 continuation round: the transparent
      // pair (unchanged), plus badge-neutral's background — the source names
      // {color-neutral} but the anchor's rgba(5, 54, 89, 0.1) does not
      // tuple-equal the captured #0536591A (alpha 25.5 vs 26), and the join
      // refuses near-miss equality by design, so the leaf is receipted with
      // its unblocking condition rather than left pending.
      if (!Array.isArray(literals) || literals.length !== 2) throw new Error(`expected 2 decided-literal receipts (the transparent pair + badge-neutral alpha near-miss), got ${literals?.length}`);
      for (const d of literals) {
        if (d.ack !== 'decided-literal') throw new Error(`literal receipt ${d.ids} carries the wrong ack`);
        if (!/ORCHESTRATOR-REVIEWED UNDER OWNER DELEGATION, TJ 2026-07-26/.test(d.cause)) {
          throw new Error(`literal receipt ${d.ids} does not carry the delegation provenance`);
        }
        for (const leaf of d.leaves) {
          if (/^\{.+\}$/.test(String(at(leaf)?.$value))) throw new Error(`${leaf} is DECIDED-LITERAL but got aliased to ${at(leaf).$value}`);
        }
      }
      // FALSIFY the literal-receipt guard: drift a kept-literal leaf's value in
      // the tree and --propose must refuse BY NAME rather than keep printing a
      // receipt that no longer describes the leaf it receipts. (A refusal that
      // only checks the ALIASES would let the "decided" half rot silently.)
      const mintedSrc = readFileSync(T(MINTED), 'utf8');
      // Retargeted onto the leaf that IS decided-literal today: button
      // variant=ghost's transparent background. The old target
      // (imported.shared.color-0a1317) is no longer minted at all.
      // Retargeted onto a leaf that IS decided-literal today: the transparent
      // pair (button variant=ghost / card variant=transparent). The old target,
      // imported.shared.color-0a1317, is no longer minted at all. Matched on the
      // VALUE rather than on surrounding indentation, so re-serialising the tree
      // cannot silently disarm the falsification.
      const drifted0a = mintedSrc.replace('"$value": "#00000000"', '"$value": "#123456"');
      if (drifted0a === mintedSrc) throw new Error('no decided-literal #00000000 leaf found — the falsification has nothing to drift');
      writeFileSync(T(MINTED), drifted0a);
      const staleReceipt = run(TSX, [SCRIPT, '--propose']);
      writeFileSync(T(MINTED), mintedSrc);
      if (staleReceipt.status === 0) throw new Error('a DRIFTED decided-literal leaf was accepted under its old receipt');
      if (!staleReceipt.out.includes('STALE LITERAL RECEIPT') || !staleReceipt.out.includes('imported.button.root.background-color.ghost')) {
        throw new Error(`the stale-receipt refusal is not named:\n${staleReceipt.out}`);
      }

      // FALSIFY the byte-gate: move ONE byte of a committed component script
      // and the gate must refuse by name rather than accept the diff.
      const badge = T('examples/astryx/figma/badge.figma.js');
      const badgeSrc = readFileSync(badge);
      writeFileSync(badge, Buffer.concat([badgeSrc, Buffer.from('\n// tamper\n')]));
      const tampered = run(TSX, [SCRIPT, '--apply', 'RA-042f97']);
      writeFileSync(badge, badgeSrc);
      if (tampered.status === 0) throw new Error('the byte-gate ACCEPTED a moved neutral component script');
      if (!tampered.out.includes('BYTE-GATE') || !tampered.out.includes('badge.figma.js')) {
        throw new Error(`the byte-gate refusal does not name the moved script:\n${tampered.out}`);
      }

      // FALSIFY the stale-ledger guard: drift the DTCG under the ledger.
      const baseSrc = readFileSync(T(BASE), 'utf8');
      writeFileSync(T(BASE), baseSrc.replace('"#042F97"', '"#123456"'));
      const stale = run(TSX, [SCRIPT, '--apply', 'RA-042f97']);
      if (stale.status === 0) throw new Error('--apply accepted a ledger whose token value had drifted');
      if (!stale.out.includes('STALE LEDGER')) throw new Error(`the drift refusal is not named:\n${stale.out}`);
      // …and the same drift must move --propose (proving step 1 measures the
      // real input, not a cached constant).
      const drifted = run(TSX, [SCRIPT, '--propose']);
      if (drifted.status !== 0) throw new Error(`--propose failed on the drifted anchor:\n${drifted.out}`);
      if (OUTPUTS.map(sha).join() === h1.join()) throw new Error('--propose produced identical bytes from a DIFFERENT anchor — it is not reading the input');
      writeFileSync(T(BASE), baseSrc);

      console.log(
        `astryx-reanchor-minted: value-identity join over the minted tree — --propose byte-stable ×2 AND byte-equal to the committed artifacts ` +
          `(${proposals.rows.length} rows, queue RESOLVED: 78 applied refs across 36 ledger rows / 78 leaves, 0 ambiguous, 3 refs on 3 leaves REVIEWED AND KEPT LITERAL with receipts, 48 card-border refs REFUSED by name for a degraded capture; no live leaf is pending without a decision or a receipt); ` +
          `every reviewed row carries the delegation provenance (orchestrator-reviewed under owner delegation, TJ 2026-07-26; the 2026-08-08 continuation round is additionally labelled executed-by-automation and flagged for owner review); PER-LEAF GRAIN pinned — RA-ffffff splits into 6 decisions / 6 targets / 18 leaves under one id; ` +
          `a docs-plane anchor is refused BY NAME (the silent-no-op trap); --apply refuses an un-acked id AND an excluded row, and is idempotent on an acked one; ` +
          `the 78 aliases resolve to the UNCHANGED neutral light values and the 13 neutral component scripts re-emit byte-identical. ` +
          `Falsified: tampered script → BYTE-GATE refusal; drifted DTCG → STALE LEDGER refusal + moved proposals; drifted kept-literal leaf → STALE LITERAL RECEIPT refusal`,
      );
    },
  },
  {
    // STATE-PLANE PROJECTION ROUND — the defect: `checked` was declared a
    // capture-config stateProp with state "checked", OUTSIDE the closed
    // contract state vocabulary. Nothing checked it (StateAxisSpec.state is a
    // TypeScript annotation over cast JSON), so the captured deltas minted
    // `<channel>-state-checked` names that stateOfMintProperty could not
    // re-read and that landed as INERT channels: the Figma emitter dropped
    // them silently and the CSS emitters wrote invalid declarations. Captured,
    // minted, rendered by NOBODY.
    //
    // This eval pins the CLOSURE (checked is a real variant axis whose facts
    // ride the base plane, on BOTH libraries), the GUARDRAIL that makes the
    // class unrepeatable, and the ONE residual that stayed — honestly, as a
    // fact, so the day it is fixed this eval speaks.
    id: 'checked-axis-projection',
    claim: 'C5-extraction',
    run: () => {
      type AnyPart = { parts?: Record<string, AnyPart>; tokens?: Record<string, string>; tokensByProp?: unknown };
      const partsOf = (root: AnyPart): Array<[string, AnyPart]> => {
        const out: Array<[string, AnyPart]> = [['root', root]];
        const walk = (p: AnyPart) => {
          for (const [k, v] of Object.entries(p.parts ?? {})) { out.push([k, v]); walk(v); }
        };
        walk(root);
        return out;
      };
      const entriesOf = (p: AnyPart): Array<{ prop: string; map: Record<string, Record<string, string>> }> => {
        const t = p.tokensByProp;
        if (!t) return [];
        return (Array.isArray(t) ? t : [t]) as Array<{ prop: string; map: Record<string, Record<string, string>> }>;
      };

      // ---- 1. the CLOSED vocabulary has exactly ONE spelling ----
      if (CONTRACT_STATES.includes('checked' as never)) {
        throw new Error('CONTRACT_STATES gained "checked" — a prop-selected rendering is a VARIANT AXIS, never a pseudo-class plane');
      }

      // ---- 2. the load-time REFEREE refuses an out-of-vocabulary config ----
      const cfgPath = path.join(SCRATCH, 'bad-state-config.json');
      const good = JSON.parse(readFileSync(path.join(ROOT, 'extract/computed/configs/mui.json'), 'utf8')) as {
        components: Array<{ name: string; stateProps?: Array<{ prop: string; state: string }> }>;
      };
      const sw = good.components.find((c) => c.name === 'Switch')!;
      // the exact pre-round spelling, restored
      sw.stateProps = [{ prop: 'checked', state: 'checked' }, { prop: 'disabled', state: 'disabled' }];
      mkdirSync(SCRATCH, { recursive: true });
      writeFileSync(cfgPath, JSON.stringify(good, null, 2));
      let refusal = '';
      try {
        loadCaptureConfig(ROOT, cfgPath);
      } catch (e) {
        refusal = (e as Error).message;
      }
      if (!refusal) throw new Error('loadConfig ACCEPTED stateProps state "checked" — the inert-channel class is reopened');
      for (const frag of ['outside the closed contract state vocabulary', 'VARIANT AXIS', 'axisValueMap']) {
        if (!refusal.includes(frag)) throw new Error(`config-state refusal is not NAMED enough (missing "${frag}"): ${refusal}`);
      }
      // …and the real configs pass it
      for (const cfgName of ['mui.json', 'tailwind.json']) {
        loadCaptureConfig(ROOT, path.join(ROOT, 'extract/computed/configs', cfgName));
      }

      // ---- 3. MUI Switch: checked is an enum VARIANT prop, and its facts
      //         are BASE-PLANE per-axis facts (not state suffixes) ----
      const swc = JSON.parse(readFileSync(path.join(ROOT, 'examples/mui/contracts/switch.contract.json'), 'utf8')) as {
        props: Array<{ name: string; type: unknown; default?: unknown; bindings: { figma: { kind: string; property: string } } }>;
        anatomy: { root: AnyPart };
      };
      const ck = swc.props.find((p) => p.name === 'checked');
      if (!ck) throw new Error('mui.switch lost its `checked` prop');
      if (typeof ck.type !== 'object' || !('enum' in (ck.type as object))) {
        throw new Error('mui.switch `checked` is not an enum prop — a prop-selected rendering must be an axis, not a boolean state');
      }
      if ((ck.type as { enum: string[] }).enum.join(',') !== 'unchecked,checked') {
        throw new Error(`mui.switch checked enum is ${(ck.type as { enum: string[] }).enum.join(',')}, expected unchecked,checked`);
      }
      if (ck.bindings.figma.kind !== 'VARIANT' || ck.bindings.figma.property !== 'Checked') {
        throw new Error('mui.switch `checked` must bind a VARIANT property "Checked" (it drives the canvas grid)');
      }
      const swParts = new Map(partsOf(swc.anatomy.root));
      const track = swParts.get('switch-track');
      if (!track) throw new Error('mui.switch lost switch-track');
      const trackChecked = entriesOf(track).find((e) => e.prop === 'checked');
      if (!trackChecked) throw new Error('switch-track carries no tokensByProp[checked] — the checked plane is not a base-plane fact');
      for (const v of ['checked', 'unchecked']) {
        const ref = trackChecked.map[v]?.['background-color'];
        if (!ref) throw new Error(`switch-track tokensByProp[checked].${v} carries no background-color — the checked track colour is unprojected`);
        // NESTED TWO-AXIS CARRIAGE: the fact is f(color, checked); the map
        // pins `checked` and keeps ONE placeholder naming the OTHER axis.
        if (!ref.includes('{color}')) {
          throw new Error(`switch-track checked ref "${ref}" lost the {color} substitution — the pair collapsed to one axis`);
        }
      }
      if (trackChecked.map['checked']['background-color'] === trackChecked.map['unchecked']['background-color']) {
        throw new Error('switch-track binds the SAME ref on both checked planes — the delta is gone');
      }

      // ---- 4. Tailwind ToggleSwitch: the same closure, single-axis case ----
      const tsc = JSON.parse(readFileSync(path.join(ROOT, 'examples/tailwind/contracts/toggleswitch.contract.json'), 'utf8')) as {
        props: Array<{ name: string; bindings: { figma: { kind: string; property: string } } }>;
        anatomy: { root: AnyPart };
      };
      const tck = tsc.props.find((p) => p.name === 'checked');
      if (!tck || tck.bindings.figma.kind !== 'VARIANT' || tck.bindings.figma.property !== 'Checked') {
        throw new Error('flowbite.toggleswitch has no `checked` VARIANT prop');
      }
      const tsChecked = partsOf(tsc.anatomy.root)
        .flatMap(([, p]) => entriesOf(p))
        .filter((e) => e.prop === 'checked');
      const tsFills = tsChecked.flatMap((e) => Object.values(e.map).map((m) => m['background-color']).filter(Boolean));
      if (tsFills.length < 2 || new Set(tsFills).size < 2) {
        throw new Error(`flowbite.toggleswitch carries no distinct per-checked track background-color (found ${tsFills.length})`);
      }

      // ---- 5. NO INERT CHANNEL SURVIVES anywhere in either promoted set ----
      const scanned: string[] = [];
      for (const dir of ['examples/mui/contracts', 'examples/tailwind/contracts']) {
        for (const f of readdirSync(path.join(ROOT, dir)).sort()) {
          if (!f.endsWith('.json')) continue;
          const body = readFileSync(path.join(ROOT, dir, f), 'utf8');
          if (body.includes('-state-checked')) throw new Error(`${dir}/${f} still carries an inert "-state-checked" channel name`);
          scanned.push(`${dir}/${f}`);
        }
      }
      for (const t of ['examples/mui/tokens/mui-minted.dtcg.json', 'examples/tailwind/tokens/tailwind-minted.dtcg.json',
                       'examples/mui/figma/mui.bundle.json', 'examples/tailwind/figma/tailwind.bundle.json']) {
        if (readFileSync(path.join(ROOT, t), 'utf8').includes('-state-checked')) {
          throw new Error(`${t} still carries an inert "-state-checked" name — regenerate it`);
        }
      }

      // ---- 6. THE NAMED RESIDUAL, pinned as a FACT (defect-first) ----
      // MUI translates the checked thumb, but the overlay-cluster synthetic
      // translate door only decomposes a matrix present on the BASE combo,
      // and Switch's base is transform:none. Pinned so the residual cannot
      // quietly change identity: it is a `transform` codeOnly channel, NOT a
      // carried translate. See examples/mui/PROVENANCE.md.
      const swExt = JSON.parse(readFileSync(path.join(ROOT, 'examples/mui/contracts/switch.extension.json'), 'utf8')) as {
        codeOnlyChannels: Array<{ part: string; channel: string; distinctValues: number }>;
        stateOverflow: unknown[];
      };
      if (swExt.stateOverflow.length !== 0) {
        throw new Error(`mui.switch stateOverflow is no longer empty (${swExt.stateOverflow.length}) — the checked deltas escaped the base plane again`);
      }
      const xf = swExt.codeOnlyChannels.find((c) => c.part === 'buttonbase-root' && c.channel === 'transform');
      if (!xf) {
        throw new Error('mui.switch buttonbase-root.transform is no longer a codeOnly channel — if the synthetic-translate door was generalised, update this pin, the compile-receipt thumb-position pin, and examples/mui/PROVENANCE.md together');
      }
      if (xf.distinctValues !== 3) {
        throw new Error(`mui.switch buttonbase-root.transform now has ${xf.distinctValues} distinct values (expected 3: none + the two per-size checked matrices)`);
      }
      console.log(
        `checked-axis-projection: \`checked\` is a VARIANT AXIS on both libraries (MUI Switch 14→28 cells, ToggleSwitch 3→6); ` +
          `the checked track/thumb colours are BASE-PLANE facts (MUI's are nested two-axis maps keeping the {color} substitution); ` +
          `${scanned.length} promoted contracts + 2 minted trees + 2 bundles carry ZERO "-state-checked" names; ` +
          `an out-of-vocabulary stateProps state is REFUSED BY NAME at load; ` +
          `residual pinned as fact: the checked thumb TRANSLATE stays codeOnly (the synthetic-translate door is keyed to the base combo, which is transform:none)`,
      );
    },
  },
  {
    id: 'mui-figma-genesis',
    claim: 'C8-journey',
    run: () => {
      // The FOURTH library (repo → Polaris → Astryx → MUI) and the first with
      // Emotion runtime styling: contracts derive from the computed floor with
      // the CSS-variables reader's source facts aliasing minted leaves to
      // MUI's own token names. MOLECULE round: 11 components — the original 5
      // + Tabs/Accordion/Autocomplete (census) + Dialog/Menu/Tooltip (portal-
      // swept overlays; Menu and Tooltip are STANDALONE, no variant axes).
      // ORGANISM round: 14 — plus Checkbox (tri-state on one axis, three
      // glyph assets), TablePagination (STANDALONE) and TABLE, the first
      // composed ORGANISM (recursive childrenSpec; the CSS table box model
      // lowered to the flex vocabulary, per-column widths minted).
      // This eval re-runs the compile receipt (referee per contract axes +
      // headless execute of tokens-then-component per script, INCLUDING the
      // organism structural pins — rows horizontal, one width per column
      // shared by header and body, per-cell dividers, selected-row tint) and
      // the genesis-batch builder (which REFUSES to write unless the exact
      // one-paste byte stream builds all 11 sets + 3 standalone in the mock).
      cpSync(path.join(ROOT, 'examples', 'mui'), path.join(SCRATCH, 'examples', 'mui'), {
        recursive: true,
        filter: (src) => !src.includes('.mui-sandbox'),
      });
      const receipt = run(process.execPath, ['examples/mui/scripts/figma-compile-receipt.mjs']);
      if (receipt.status !== 0) throw new Error(`mui figma compile receipt failed:\n${receipt.out.slice(0, 1600)}`);
      if (!receipt.out.includes('31 scripts, 273 variants')) {
        throw new Error(`mui figma compile receipt missing the 31-scripts/273-variants line:\n${receipt.out.slice(0, 800)}`);
      }
      const batch = run(process.execPath, ['examples/mui/scripts/build-genesis-batch.mjs']);
      if (batch.status !== 0) throw new Error(`mui genesis batch refused:\n${batch.out.slice(0, 1600)}`);
      if (!/mock-proven \(27 sets: Button\(75\), Card\(4\), Chip\(28\), Slider\(12\), Switch\(28\), Tabs\(6\), Accordion\(4\), Autocomplete\(2\), Dialog\(5\), Checkbox\(3\), Table\(2\), InputAdornment\(2\), TextField\(6\), Avatar\(3\), Fab\(9\), IconButton\(9\), CircularProgress\(2\), LinearProgress\(2\), Alert\(12\), Badge\(14\), Divider\(3\), Link\(42\), Paper\(8\), Drawer\(2\), Radio\(14\), Select\(2\), Snackbar\(3\); standalone: TablePagination, Menu, Tooltip, Breadcrumbs; 2136 variables\)/.test(batch.out)) {
        throw new Error(`mui genesis batch missing the mock-proof line:\n${batch.out.slice(0, 800)}`);
      }
      // FOREIGN-TOKEN BUNDLE (the JSON-only payload): `figma bundle` is
      // byte-deterministic — two builds from the same inputs are identical —
      // and the COMMITTED examples/mui/figma/mui.bundle.json is fresh
      // (byte-equal to a rebuild). The engine-side equivalence gate lives in
      // plugin-engine-check (pinned by plugin-engine-bundle).
      const bundleArgs = [
        'packages/cli/src/cli.ts', 'figma', 'bundle', 'examples/mui/contracts',
        '--tokens', 'examples/mui/tokens/mui.dtcg.json,examples/mui/tokens/mui-minted.dtcg.json',
        '--modes', 'examples/mui/tokens/modes/mui.light.dtcg.json,examples/mui/tokens/modes/mui.dark.dtcg.json',
        '--name', 'MUI',
        // MOLECULE round: Autocomplete's floor-reconstructed indicator/chip
        // SVGs ride the bundle — JSON stays the only thing a user pastes.
        '--icons', 'examples/mui/assets/icons',
      ];
      const b1 = run(TSX, [...bundleArgs, '--out', 'examples/mui/figma/bundle-run-a.json']);
      const b2 = run(TSX, [...bundleArgs, '--out', 'examples/mui/figma/bundle-run-b.json']);
      if (b1.status !== 0 || b2.status !== 0) throw new Error(`figma bundle failed:\n${(b1.out + b2.out).slice(0, 1200)}`);
      const runA = readFileSync(path.join(SCRATCH, 'examples/mui/figma/bundle-run-a.json'), 'utf8');
      const runB = readFileSync(path.join(SCRATCH, 'examples/mui/figma/bundle-run-b.json'), 'utf8');
      if (runA !== runB) throw new Error('figma bundle is NOT byte-deterministic — two builds from identical inputs differ');
      const committed = readFileSync(path.join(ROOT, 'examples/mui/figma/mui.bundle.json'), 'utf8');
      if (runA !== committed) throw new Error('committed examples/mui/figma/mui.bundle.json is STALE — a fresh `figma bundle` build differs; regenerate and commit it');
      console.log('mui-figma-genesis: 31/31 Emotion-runtime scripts referee+execute headless (273 variants — Wave 5 denominator; state-plane projection: Switch 14→28 on Checked, Button 63→75 on State preview); token sync 2136 variables incl. 134 Figma-native source aliases; one-paste batch mock-proven; figma bundle (with 22 embedded icon assets) byte-deterministic twice and committed mui.bundle.json fresh');
    },
  },
  {
    id: 'tailwind-figma-genesis',
    claim: 'C8-journey',
    run: () => {
      // The FIFTH library and the FOURTH styling method — Tailwind v4
      // (flowbite-react) completes the tier-1 guarantee (docs/16). Utilities
      // compile to var(--theme-token) references, so the CSS-vars reader
      // binds the library's own token names (text-sm, font-weight-medium,
      // color-white); oklch theme colors convert through the shared OKLab
      // math; inline-themed values (Flowbite's primary palette) stay
      // gracefully-degraded minted literals by the library's own choice.
      cpSync(path.join(ROOT, 'examples', 'tailwind'), path.join(SCRATCH, 'examples', 'tailwind'), {
        recursive: true,
        filter: (src) => !src.includes('.tw-sandbox'),
      });
      const receipt = run(process.execPath, ['examples/tailwind/scripts/figma-compile-receipt.mjs']);
      if (receipt.status !== 0) throw new Error(`tailwind figma compile receipt failed:\n${receipt.out.slice(0, 1600)}`);
      if (!receipt.out.includes('5 scripts, 48 variants')) {
        throw new Error(`tailwind compile receipt missing the 5-scripts/48-variants line:\n${receipt.out.slice(0, 800)}`);
      }
      const batch = run(process.execPath, ['examples/tailwind/scripts/build-genesis-batch.mjs']);
      if (batch.status !== 0) throw new Error(`tailwind genesis batch refused:\n${batch.out.slice(0, 1600)}`);
      if (!/mock-proven \(5 sets: Alert\(4\), Badge\(24\), Button\(45\), Card\(1\), ToggleSwitch\(6\); 304 variables\)/.test(batch.out)) {
        throw new Error(`tailwind genesis batch missing the mock-proof line:\n${batch.out.slice(0, 800)}`);
      }
      // FOREIGN-TOKEN BUNDLE freshness (single-mode variant — no modes dir):
      // the committed tailwind.bundle.json is byte-equal to a fresh build.
      const twBundle = run(TSX, [
        'packages/cli/src/cli.ts', 'figma', 'bundle', 'examples/tailwind/contracts',
        '--tokens', 'examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json',
        '--name', 'Tailwind',
        // Exact-conversion wave: alert's status/dismiss icons are real SVG
        // assets that ride the bundle (the MUI bundle's --icons precedent).
        '--icons', 'examples/tailwind/assets/icons',
        '--out', 'examples/tailwind/figma/bundle-run.json',
      ]);
      if (twBundle.status !== 0) throw new Error(`figma bundle (tailwind) failed:\n${twBundle.out.slice(0, 1200)}`);
      const twRun = readFileSync(path.join(SCRATCH, 'examples/tailwind/figma/bundle-run.json'), 'utf8');
      const twCommitted = readFileSync(path.join(ROOT, 'examples/tailwind/figma/tailwind.bundle.json'), 'utf8');
      if (twRun !== twCommitted) throw new Error('committed examples/tailwind/figma/tailwind.bundle.json is STALE — a fresh `figma bundle` build differs; regenerate and commit it');
      console.log('tailwind-figma-genesis: 5/5 Tailwind-v4 scripts referee+execute headless (48 variants — ToggleSwitch 3→6 on the new Checked axis; Badge/Button carry accepted State preview axes); reader bound the library\'s own utility tokens; one-paste batch mock-proven; committed tailwind.bundle.json fresh — tier-1 four-method guarantee complete');
    },
  },
  {
    id: 'carbon-figma-genesis',
    claim: 'C8-journey',
    run: () => {
      // THE GENERALITY CONTROL CASE — library #7 (@carbon/react), run against
      // the explicit prediction that a new library costs CONFIG ONLY. What this
      // eval pins is the SHIPPED end of that claim; the engine-side accounting
      // lives in examples/carbon/PROVENANCE.md ("The generality verdict").
      //
      // Three things here are Carbon-specific and cannot be checked anywhere
      // else in the suite:
      //   (1) DEFAULTLESS ENUM AXES. Carbon is the first library whose axes ship
      //       with no default (Button/Tag/TextInput/Modal/IconButton/Accordion
      //       `size`, Tag `type`). The capture leads such an axis with the
      //       `unset` pseudo-value, that value becomes a SEGMENT of every minted
      //       token path, and the contract token-ref regex forbids underscores —
      //       which is why the config carries `unsetLabel: "unset"` and not the
      //       drafter's `"__unset"`. The compile receipt refuses an "Unset"
      //       variant cell by name.
      //   (2) CLASS-SCOPED THEMES. Carbon's Light/Dark are `.cds--white` and
      //       `.cds--g100` — two complete inventories of the same 339 names.
      //   (3) A FOREIGN-PACKAGE GLYPH through the untouched marker grammar
      //       ({"$import":"@carbon/icons-react#Add"}).
      cpSync(path.join(ROOT, 'examples', 'carbon'), path.join(SCRATCH, 'examples', 'carbon'), {
        recursive: true,
        filter: (src) => !src.includes('.carbon-sandbox'),
      });
      const receipt = run(process.execPath, ['examples/carbon/scripts/figma-compile-receipt.mjs']);
      if (receipt.status !== 0) throw new Error(`carbon figma compile receipt failed:\n${receipt.out.slice(0, 1600)}`);
      if (!receipt.out.includes('10 scripts, 132 variants')) {
        throw new Error(`carbon compile receipt missing the 10-scripts/132-variants line:\n${receipt.out.slice(0, 800)}`);
      }
      const batch = run(process.execPath, ['examples/carbon/scripts/build-genesis-batch.mjs']);
      if (batch.status !== 0) throw new Error(`carbon genesis batch refused:\n${batch.out.slice(0, 1600)}`);
      // ORPHAN-LEAF + ROW-RULE ROUND (tasks #42/#35) — REPINNED 1425 → 1207
      // variables: the shipped minted tree lost every `row-rule-color` leaf (a
      // `currentcolor` mirror nobody authored) and every leaf of a part the
      // anatomy promotion had already refused by name. Carbon/IconButton alone
      // shed 112. Previously: LIVE-DEFECT ROUND (task #30) — REPINNED 1459 → 1425 variables after
      // REVIEW, not silently. The 34 that left are the minted leaves of parts
      // the round REFUSED: Carbon's tooltip `popover` wrapper and its subtree
      // (inert-overlay-wrapper — it painted nothing in any combo and every
      // child was display:none) on IconButton and on Modal's close button,
      // plus InlineNotification's five per-path parts per glyph, which are now
      // one reconstructed ICON ASSET each because `<title>` no longer refuses
      // the svg grammar. Variant cells (132) and source aliases (94) are
      // UNCHANGED — no variant and no alias was lost. The compile receipt this
      // eval runs also carries the round's six structural pins (D1 SVG title
      // as ink / D2 checkbox box + toggle knob / D3 no child wider than its
      // parent / D5 modal not a viewport rectangle / D6 no inert part + the
      // icon button keeps its box), so this eval fails if any of them regress.
      // EXACT-CONVERSION WAVE — REPINNED 1207 → 1215 variables, after review,
      // not silently: inline-notification's exact pass minted 15 new leaves
      // (per-contrast root border widths+colors high/low — the D2-class ring
      // facts —, the per-contrast close-button color the FC-CONTRAST-ICON pin
      // requires, and root/showcase-width) and retired the single
      // un-substituted close-button color leaf. The landing round corrected
      // the wave's first repin (1221): it had not counted the SIX tabs width
      // leaves the same wave retired (tabs-nav-item{,-2,-3} and their
      // label-wrapper widths — FC-CARBON-TABS-LABEL demands the wrappers HUG,
      // so their minted fixed widths left the tree): 1207 + 15 − 1 − 6 = 1215.
      // Variant cells (132) and source aliases (96) are unchanged.
      if (!/mock-proven \(10 sets: Accordion\(8\), Button\(80\), Checkbox\(3\), IconButton\(16\), InlineNotification\(12\), Modal\(4\), Tabs\(3\), Tag\(36\), TextInput\(8\), Toggle\(4\); 1215 variables\)/.test(batch.out)) {
        throw new Error(`carbon genesis batch missing the mock-proof line:\n${batch.out.slice(0, 800)}`);
      }
      // The token wrap is a PURE function of the pinned compiled stylesheet, so
      // the committed DTCG must be byte-reproducible — and it re-asserts the
      // .cds--white / .cds--g100 / :root-layout block sizes it was written
      // against, refusing rather than silently shrinking on a Carbon bump.
      // (Run only when the sandbox is present; the eval suite is network-free.)
      const sandboxCss = path.join(ROOT, 'examples/carbon/.carbon-sandbox/node_modules/@carbon/styles/css/styles.css');
      let tokenNote = 'token wrap not re-run (sandbox absent — network-free suite)';
      if (existsSync(sandboxCss)) {
        const before = readFileSync(path.join(ROOT, 'examples/carbon/tokens/carbon.dtcg.json'), 'utf8');
        const tw = run(process.execPath, [path.join(ROOT, 'examples/carbon/scripts/build-tokens.mjs')]);
        if (tw.status !== 0) throw new Error(`carbon build-tokens refused:\n${tw.out.slice(0, 800)}`);
        const after = readFileSync(path.join(ROOT, 'examples/carbon/tokens/carbon.dtcg.json'), 'utf8');
        if (before !== after) throw new Error('committed examples/carbon/tokens/carbon.dtcg.json is STALE — a fresh wrap of the pinned stylesheet differs');
        tokenNote = 'token wrap re-run against the pinned stylesheet: byte-identical';
      }
      // MODES ARE REAL, not one theme twice — checked on the committed files.
      const light = JSON.parse(readFileSync(path.join(ROOT, 'examples/carbon/tokens/modes/carbon.light.dtcg.json'), 'utf8')) as Record<string, { $value: string }>;
      const dark = JSON.parse(readFileSync(path.join(ROOT, 'examples/carbon/tokens/modes/carbon.dark.dtcg.json'), 'utf8')) as Record<string, { $value: string }>;
      const differing = Object.keys(light).filter((k) => k in dark && light[k].$value !== dark[k].$value);
      if (differing.length < 200) {
        throw new Error(`carbon Light/Dark differ on only ${differing.length} tokens — .cds--white and .cds--g100 are two DIFFERENT themes; this few means one block was parsed twice`);
      }
      if (light['layer-01'].$value !== '#f4f4f4' || dark['layer-01'].$value !== '#262626') {
        throw new Error(`carbon layer-01 is ${light['layer-01'].$value}/${dark['layer-01'].$value}, expected #f4f4f4/#262626 (the contextual-alias resolution follows ONE hop INSIDE each theme block — taking the literal var() fallback instead would bake the light value into Dark)`);
      }
      // NO "unset" LEAKED INTO A CONTRACT ENUM. The pseudo-value is a
      // capture-side plane; a contract that carries it as a real enum value
      // would put an Unset cell on the canvas.
      for (const f of readdirSync(path.join(ROOT, 'examples/carbon/contracts')).filter((x) => x.endsWith('.contract.json'))) {
        const c = JSON.parse(readFileSync(path.join(ROOT, 'examples/carbon/contracts', f), 'utf8')) as { props?: Array<{ name: string; type?: { enum?: string[] } }> };
        for (const pr of c.props ?? []) {
          if (pr.type?.enum?.includes('unset')) throw new Error(`${f}: prop "${pr.name}" carries the "unset" PSEUDO-value as a real enum value — it is a capture-side plane, never a variant`);
        }
      }
      // FOREIGN-TOKEN BUNDLE freshness (two-mode variant).
      const bundleArgs = [
        'packages/cli/src/cli.ts', 'figma', 'bundle', 'examples/carbon/contracts',
        '--tokens', 'examples/carbon/tokens/carbon.dtcg.json,examples/carbon/tokens/carbon-minted.dtcg.json',
        '--modes', 'examples/carbon/tokens/modes/carbon.light.dtcg.json,examples/carbon/tokens/modes/carbon.dark.dtcg.json',
        '--name', 'Carbon',
        '--icons', 'examples/carbon/assets/icons',
      ];
      const c1 = run(TSX, [...bundleArgs, '--out', 'examples/carbon/figma/bundle-run-a.json']);
      const c2 = run(TSX, [...bundleArgs, '--out', 'examples/carbon/figma/bundle-run-b.json']);
      if (c1.status !== 0 || c2.status !== 0) throw new Error(`figma bundle (carbon) failed:\n${(c1.out + c2.out).slice(0, 1200)}`);
      const runA = readFileSync(path.join(SCRATCH, 'examples/carbon/figma/bundle-run-a.json'), 'utf8');
      const runB = readFileSync(path.join(SCRATCH, 'examples/carbon/figma/bundle-run-b.json'), 'utf8');
      if (runA !== runB) throw new Error('carbon figma bundle is NOT byte-deterministic — two builds from identical inputs differ');
      const committed = readFileSync(path.join(ROOT, 'examples/carbon/figma/carbon.bundle.json'), 'utf8');
      if (runA !== committed) throw new Error('committed examples/carbon/figma/carbon.bundle.json is STALE — a fresh `figma bundle` build differs; regenerate and commit it');
      console.log(
        `carbon-figma-genesis: 10/10 scripts referee+execute headless (132 variant cells, 1215 variables incl. 96 Figma-native source aliases; live-defect round: the six canvas defects are pinned by the compile receipt this eval runs); ` +
          `Light/Dark = .cds--white/.cds--g100 differ on ${differing.length} tokens; no "unset" pseudo-value reached a contract enum; ` +
          `one-paste batch mock-proven; committed carbon.bundle.json fresh and byte-deterministic; ${tokenNote} — the generality control case`,
      );
    },
  },
  {
    id: 'altitude-shadow-dom-genesis',
    claim: 'C8-journey',
    run: () => {
      // THE FIRST SHADOW-DOM LIBRARY — altitude-web-components@1.0.2 (Lit 3,
      // 65 components, the owner's own OSS system), library #8. What this eval
      // pins is the SHIPPED end; the engine accounting lives in
      // examples/altitude/PROVENANCE.md ("THE SHADOW-DOM VERDICT").
      //
      // Four things here are Altitude-specific and cannot be checked anywhere
      // else in the suite:
      //   (1) SLOTTED TEXT. Every component's text lives in the LIGHT DOM and
      //       reaches the render only through a <slot> inside the shadow root.
      //       The compile receipt asserts the sample text reached the canvas —
      //       a reader that did not resolve assignedNodes() produces an empty
      //       one.
      //   (2) DEPTH-2 SHADOW. al-avatar hasBadge mounts a nested <al-badge>
      //       with its OWN shadow root; the promoted contract must carry both
      //       the nested host part and its inner box.
      //   (3) SVG INSIDE A SHADOW ROOT. al-icon-close's glyph is only
      //       reachable through the shadow reader.
      //   (4) EVERY ENUM IS DEFAULTLESS. There is no variant="primary" —
      //       primary IS the absent attribute — so the `unset` pseudo-value is
      //       a segment of a minted token path on EVERY component, and no
      //       "Unset" cell may reach the canvas.
      cpSync(path.join(ROOT, 'examples', 'altitude'), path.join(SCRATCH, 'examples', 'altitude'), {
        recursive: true,
        filter: (src) => !src.includes('.altitude-sandbox'),
      });
      const receipt = run(process.execPath, ['examples/altitude/scripts/figma-compile-receipt.mjs']);
      if (receipt.status !== 0) throw new Error(`altitude figma compile receipt failed:\n${receipt.out.slice(0, 1600)}`);
      // Exact-conversion wave: 41 → 47 variant cells. The FC-ENUM-HOLE pin
      // (code-to-canvas-wave-a-emit-pins) REQUIRES chip Type to carry the
      // developed `default` (pill) alongside `squared` — 5×2=10 cells, +5 —
      // and divider's contract documents the same enum-hole class (`default`
      // horizontal rule alongside `vertical`) — 2 cells, +1, which also makes
      // Divider a SET, not a standalone. 41 could only hold with chip
      // Type(1), which the enum-hole pin forbids; the receipt derives every
      // count from the contracts' own axes.
      if (!receipt.out.includes('8 scripts, 47 variants')) {
        throw new Error(`altitude compile receipt missing the 8-scripts/47-variants line:\n${receipt.out.slice(0, 800)}`);
      }
      const batch = run(process.execPath, ['examples/altitude/scripts/build-genesis-batch.mjs']);
      if (batch.status !== 0) throw new Error(`altitude genesis batch refused:\n${batch.out.slice(0, 1600)}`);
      if (!/mock-proven \(7 sets: Badge\(8\), Button\(12\), Chip\(10\), Divider\(2\), Heading\(12\), IconClose\(7\), Link\(9\); standalone: Avatar; 638 variables\)/.test(batch.out)) {
        throw new Error(`altitude genesis batch missing the mock-proof line:\n${batch.out.slice(0, 800)}`);
      }
      // THE SHADOW-DOM ANATOMY PINS, read off the COMMITTED promoted contracts.
      const contractOf = (stem: string) =>
        JSON.parse(readFileSync(path.join(ROOT, 'examples/altitude/contracts', `${stem}.contract.json`), 'utf8')) as {
          props?: Array<{ name: string; type?: { enum?: string[] } }>;
          anatomy?: Record<string, unknown>;
        };
      // (2) depth-2: the nested <al-badge> host AND its inner box are parts.
      const avatarJson = JSON.stringify(contractOf('avatar'));
      for (const part of ['avatar__badge', 'badge']) {
        if (!avatarJson.includes(`"${part}"`)) {
          throw new Error(`altitude avatar: promoted contract carries no "${part}" part — the nested <al-badge>'s OWN shadow root was not read (depth-2)`);
        }
      }
      // (3) svg inside a shadow root → committed icon assets, one per size.
      const icons = readdirSync(path.join(ROOT, 'examples/altitude/assets/icons')).filter((f) => f.endsWith('.svg'));
      if (icons.length < 8) {
        throw new Error(`altitude: ${icons.length} promoted icon asset(s) — al-icon-close's glyph lives inside its shadow root and must reconstruct once per size value (8)`);
      }
      // (4) no "unset" pseudo-value reached a contract enum, on ANY component
      // (every axis in this library is defaultless, so this is 8/8, not 1/8).
      let defaultlessAxes = 0;
      for (const f of readdirSync(path.join(ROOT, 'examples/altitude/contracts')).filter((x) => x.endsWith('.contract.json'))) {
        const c = JSON.parse(readFileSync(path.join(ROOT, 'examples/altitude/contracts', f), 'utf8')) as {
          props?: Array<{ name: string; type?: { enum?: string[] }; default?: unknown }>;
        };
        for (const pr of c.props ?? []) {
          if (pr.type?.enum?.includes('unset')) {
            throw new Error(`${f}: prop "${pr.name}" carries the "unset" PSEUDO-value as a real enum value — it is a capture-side plane, never a variant`);
          }
          if (pr.type?.enum && pr.default === undefined) defaultlessAxes++;
        }
      }
      if (defaultlessAxes < 8) {
        throw new Error(`altitude: only ${defaultlessAxes} defaultless enum axes across the promoted contracts — this library has no defaulted variant at all (primary IS the absent attribute); this few means an axis grew a default it does not have`);
      }
      // The token wrap is a PURE function of the pinned shipped stylesheets.
      const sandboxCss = path.join(ROOT, 'examples/altitude/.altitude-sandbox/node_modules/altitude-web-components/dist/css/tokens-light.css');
      let tokenNote = 'token wrap not re-run (sandbox absent — network-free suite)';
      if (existsSync(sandboxCss)) {
        const before = readFileSync(path.join(ROOT, 'examples/altitude/tokens/altitude.dtcg.json'), 'utf8');
        const tw = run(process.execPath, [path.join(ROOT, 'examples/altitude/scripts/build-tokens.mjs')]);
        if (tw.status !== 0) throw new Error(`altitude build-tokens refused:\n${tw.out.slice(0, 800)}`);
        const after = readFileSync(path.join(ROOT, 'examples/altitude/tokens/altitude.dtcg.json'), 'utf8');
        if (before !== after) throw new Error('committed examples/altitude/tokens/altitude.dtcg.json is STALE — a fresh wrap of the pinned stylesheets differs');
        tokenNote = 'token wrap re-run against the pinned stylesheets: byte-identical';
      }
      // MODES ARE REAL — but Altitude's dark mode is THIN by its own choice
      // (brand and status colours are identical in both), so the pin is sized
      // to the measured truth and says which families move. Reading a low
      // number here as a parsing failure is exactly the mistake this comment
      // exists to prevent.
      const light = JSON.parse(readFileSync(path.join(ROOT, 'examples/altitude/tokens/modes/altitude.light.dtcg.json'), 'utf8')) as Record<string, { $value: string }>;
      const dark = JSON.parse(readFileSync(path.join(ROOT, 'examples/altitude/tokens/modes/altitude.dark.dtcg.json'), 'utf8')) as Record<string, { $value: string }>;
      const differing = Object.keys(light).filter((k) => k in dark && light[k].$value !== dark[k].$value);
      if (differing.length < 20) {
        throw new Error(`altitude Light/Dark differ on only ${differing.length} tokens — tokens-light.css and tokens-dark.css are two DIFFERENT shipped stylesheets; this few means one was parsed twice`);
      }
      if (light['theme-color-content-default'].$value === dark['theme-color-content-default'].$value) {
        throw new Error('altitude theme-color-content-default is identical in Light and Dark — the alias chain was resolved against ONE block instead of each mode\'s own');
      }
      // FOREIGN-TOKEN BUNDLE freshness (two-mode variant).
      const bundleArgs = [
        'packages/cli/src/cli.ts', 'figma', 'bundle', 'examples/altitude/contracts',
        '--tokens', 'examples/altitude/tokens/altitude.dtcg.json,examples/altitude/tokens/altitude-minted.dtcg.json',
        '--modes', 'examples/altitude/tokens/modes/altitude.light.dtcg.json,examples/altitude/tokens/modes/altitude.dark.dtcg.json',
        '--name', 'Altitude',
        '--icons', 'examples/altitude/assets/icons',
      ];
      const a1 = run(TSX, [...bundleArgs, '--out', 'examples/altitude/figma/bundle-run-a.json']);
      const a2 = run(TSX, [...bundleArgs, '--out', 'examples/altitude/figma/bundle-run-b.json']);
      if (a1.status !== 0 || a2.status !== 0) throw new Error(`figma bundle (altitude) failed:\n${(a1.out + a2.out).slice(0, 1200)}`);
      const runA = readFileSync(path.join(SCRATCH, 'examples/altitude/figma/bundle-run-a.json'), 'utf8');
      const runB = readFileSync(path.join(SCRATCH, 'examples/altitude/figma/bundle-run-b.json'), 'utf8');
      if (runA !== runB) throw new Error('altitude figma bundle is NOT byte-deterministic — two builds from identical inputs differ');
      const committed = readFileSync(path.join(ROOT, 'examples/altitude/figma/altitude.bundle.json'), 'utf8');
      if (runA !== committed) throw new Error('committed examples/altitude/figma/altitude.bundle.json is STALE — a fresh `figma bundle` build differs; regenerate and commit it');
      console.log(
        `altitude-shadow-dom-genesis: 8/8 shadow-DOM scripts referee+execute headless (47 variant cells, 638 variables incl. 46 Figma-native source aliases); ` +
          `slotted text, depth-2 nested shadow (avatar → al-badge) and an svg inside a shadow root all reached the canvas; ` +
          `${defaultlessAxes} defaultless axes and no "unset" pseudo-value in any contract enum; Light/Dark differ on ${differing.length} tokens (thin by Altitude's own choice); ` +
          `one-paste batch mock-proven; committed altitude.bundle.json fresh and byte-deterministic; ${tokenNote} — the first shadow-DOM subject`,
      );
    },
  },
  {
    id: 'generalized-translate-door',
    claim: 'C5-extraction',
    run: () => {
      // PSEUDO-DECOR v2 ROUND. Two things are pinned here:
      //   (1) the `translate` LONGHAND decomposition (Tailwind v4's
      //       translate-x-full compiles to `translate`, NOT `transform`),
      //       including the %-bake against the element's OWN border box and
      //       the both-spellings-set refusal;
      //   (2) the GENERALIZED door: MUI Switch's checked thumb offset is a
      //       base-plane-absent fact that now mints per {size}×checked, with
      //       ABSENT ≡ 0px.

      // ---- 1. `translate` longhand: px, %, two-component, none ----
      const dec = (st: Record<string, string>) => { const c = { ...st }; decomposeTranslate(c); return c; };
      const pxCase = dec({ translate: '12px', width: '16px', height: '16px' });
      if (pxCase['translate-x'] !== '12px' || pxCase['translate-y'] !== '0px') {
        throw new Error(`translate longhand px decomposition wrong: ${JSON.stringify(pxCase)}`);
      }
      // the toggle knob: 100% of its OWN 16px border box = 16px, y untouched
      const pctCase = dec({ translate: '100%', width: '16px', height: '16px' });
      if (pctCase['translate-x'] !== '16px' || pctCase['translate-y'] !== '0px') {
        throw new Error(`translate %-bake must resolve against the element's own border box (16px), got ${JSON.stringify(pctCase)}`);
      }
      const pctBig = dec({ translate: '100%', width: '24px', height: '24px' });
      if (pctBig['translate-x'] !== '24px') throw new Error(`%-bake must track the element's own width (24px), got ${pctBig['translate-x']}`);
      const twoComp = dec({ translate: '50% 10px', width: '20px', height: '8px' });
      if (twoComp['translate-x'] !== '10px' || twoComp['translate-y'] !== '10px') {
        throw new Error(`two-component translate wrong: ${JSON.stringify(twoComp)}`);
      }
      if (dec({ translate: 'none', width: '16px', height: '16px' })['translate-x'] !== undefined) {
        throw new Error('translate:none must contribute NO synthetic channel');
      }
      // a % with no px box to bake against contributes nothing (named residue)
      if (dec({ translate: '100%', width: 'auto', height: 'auto' })['translate-x'] !== undefined) {
        throw new Error('a %-translate with no px box must decompose to NOTHING, not to 0');
      }
      // ---- 2. both spellings set is OUTSIDE the grammar: write NEITHER ----
      const both = dec({ transform: 'matrix(1, 0, 0, 1, 5, 0)', translate: '100%', width: '16px', height: '16px' });
      if (both['translate-x'] !== undefined || both['translate-y'] !== undefined) {
        throw new Error(`transform AND translate both set must decompose to NEITHER channel (never silently pick one), got ${JSON.stringify(both)}`);
      }
      // a non-translate transform stays outside too
      const scaled = dec({ transform: 'matrix(2, 0, 0, 2, 0, 0)', width: '16px', height: '16px' });
      if (scaled['translate-x'] !== undefined) throw new Error('a scale matrix must not decompose into translate channels');
      // identity-translate transform still decomposes (v1 behaviour intact)
      const mtx = dec({ transform: 'matrix(1, 0, 0, 1, 20, 0)', width: '20px', height: '20px' });
      if (mtx['translate-x'] !== '20px' || mtx['translate-y'] !== '0px') {
        throw new Error(`identity-matrix decomposition regressed: ${JSON.stringify(mtx)}`);
      }
      // decomposition is IDEMPOTENT (applied at BOTH read boundaries)
      const once = dec({ transform: 'matrix(1, 0, 0, 1, 20, 0)', width: '20px', height: '20px' });
      const twice = dec(once);
      if (JSON.stringify(once) !== JSON.stringify(twice)) throw new Error('decomposeTranslate is not idempotent');

      // ---- 3. the shared PILL SENTINEL (square-thumb trap) ----
      if (!isAbsurdRadius('3.35544e+07px')) throw new Error('the clamped calc(infinity*1px) radius must read as the pill idiom');
      if (isAbsurdRadius('8px')) throw new Error('an ordinary px radius must NOT read as a pill');

      // ---- 4. MUI Switch: the checked thumb offset is CARRIED, per size ----
      const swc = JSON.parse(readFileSync(path.join(ROOT, 'examples/mui/contracts/switch.contract.json'), 'utf8')) as Record<string, unknown>;
      const json = JSON.stringify(swc);
      if (!json.includes('translate-x')) {
        throw new Error('MUI Switch contract carries NO translate-x — the generalized door regressed and the checked thumb is motionless again');
      }
      for (const plane of ['checked', 'unchecked']) {
        const ref = `{imported.switch.buttonbase-root.translate-x.{size}.${plane}}`;
        if (!json.includes(ref)) throw new Error(`MUI Switch must bind ${ref} — the offset is a {size}×checked PRODUCT (single-prop stylesWhen could never express it)`);
      }
      // the minted VALUES are the real travel, and unchecked is exactly 0
      const minted = JSON.parse(readFileSync(path.join(ROOT, 'examples/mui/tokens/mui-minted.dtcg.json'), 'utf8')) as Record<string, unknown>;
      const dig = (o: unknown, p: string): unknown => p.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], o);
      const leaf = (p: string): string => {
        const n = dig(minted, p) as { $value?: string } | undefined;
        if (!n || n.$value === undefined) throw new Error(`minted leaf missing: ${p}`);
        return n.$value;
      };
      const travels: Array<[string, string]> = [['medium', '20px'], ['small', '16px']];
      for (const [size, want] of travels) {
        const un = leaf(`imported.switch.buttonbase-root.translate-x.${size}.unchecked`);
        const ch = leaf(`imported.switch.buttonbase-root.translate-x.${size}.checked`);
        if (un !== '0px') throw new Error(`switch translate-x.${size}.unchecked must be 0px (ABSENT ≡ 0px — transform:none IS zero), got ${un}`);
        if (ch !== want) throw new Error(`switch translate-x.${size}.checked must be ${want} (MUI's own translate for this size), got ${ch}`);
      }
      console.log('generalized-translate-door: `translate` longhand decomposes (px/%/two-component, %-baked against the own border box; both-spellings-set and scale matrices refuse by name, idempotent); pill sentinel shared; MUI Switch checked-thumb offset carried as a {size}×checked minted product (medium 0→20px, small 0→16px) — the state round\'s pinned residual is CLOSED');
    },
  },
  {
    // REGATE-DRIFT TRIAGE. The gate page resolves token refs through CSS
    // custom properties, and emit-html maps ANY `{a.b.c}` to `var(--a-b-c)`
    // WITHOUT consulting the inventory — so a ref no token tree carries
    // renders as an EMPTY custom property: black text, missing fills, a
    // silently depressed score and no receipt naming why. That is exactly
    // how an offline re-fuse of the astryx Slider read as a 32-point
    // "engine regression" (it is contract/mint SKEW — the frozen promoted
    // contract references 14 minted leaves the current mint no longer
    // produces; extract/computed/regate-baseline.json names it).
    //
    // This pin is the CHEAP half of that guard — no Chromium, no capture,
    // pure JSON: every SHIPPED contract must resolve every token ref
    // against its own library's token trees, using the emitters' OWN
    // referee (generateCss). The EXPENSIVE half — the offline gate numbers
    // themselves, ~5 minutes of real Chromium — is the on-demand
    // `npm run extract:computed:drift` (docs/20-regate-drift.md); it is
    // deliberately NOT in this suite, and the reason is measured, not
    // assumed.
    id: 'shipped-contract-refs-resolve',
    claim: 'C2-refusal',
    run: () => {
      const libs = ['polaris', 'astryx', 'mui', 'tailwind', 'carbon', 'altitude'];
      let contracts = 0;
      const findings: string[] = [];
      for (const lib of libs) {
        const tokensDir = path.join(ROOT, 'examples', lib, 'tokens');
        const trees: Array<Record<string, unknown>> = [];
        for (const f of readdirSync(tokensDir)) {
          if (f.endsWith('.dtcg.json')) trees.push(JSON.parse(readFileSync(path.join(tokensDir, f), 'utf8')) as Record<string, unknown>);
        }
        if (trees.length === 0) throw new Error(`${lib}: no DTCG token trees found — the inventory would be vacuously satisfied`);
        const inventory = tokenInventoryFromJson(trees);
        const contractsDir = path.join(ROOT, 'examples', lib, 'contracts');
        for (const f of readdirSync(contractsDir)) {
          if (!f.endsWith('.contract.json')) continue;
          contracts++;
          const contract = JSON.parse(readFileSync(path.join(contractsDir, f), 'utf8'));
          const errors: string[] = [];
          coreGenerateCss(contract, inventory, errors);
          for (const e of errors.filter((x) => x.includes('does not exist in tokens/'))) findings.push(`${lib}/${f}: ${e}`);
        }
      }
      if (findings.length > 0) {
        throw new Error(
          `${findings.length} shipped contract token ref(s) resolve to NOTHING — they would render as empty custom properties:\n  - ${findings.slice(0, 6).join('\n  - ')}`,
        );
      }
      // FALSIFIABLE: a planted bad ref must be caught, or the pin is decorative.
      const probe = JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/contracts/badge.contract.json'), 'utf8'));
      probe.anatomy.root.tokens['font-size'] = '{font-size-sm}'; // the REPO spelling, not Polaris's {p.*}
      const planted: string[] = [];
      coreGenerateCss(probe, tokenInventoryFromJson([
        JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/tokens/polaris-light.dtcg.json'), 'utf8')) as Record<string, unknown>,
      ]), planted);
      if (!planted.some((e) => e.includes('{font-size-sm}') && e.includes('does not exist in tokens/'))) {
        throw new Error('planted cross-library token ref was NOT refused — the ref check is decorative');
      }
      console.log(`shipped-contract-refs-resolve: ${contracts} shipped contracts across ${libs.length} libraries resolve EVERY token ref against their own library trees (planted cross-library ref refused by name); the offline-gate number itself is pinned on demand by \`npm run extract:computed:drift\``);
    },
  },
  {
    // GATE-INVENTORY FIX (task #21, docs/20-regate-drift.md).
    //
    // `shipped-contract-refs-resolve` (above) proves a shipped contract's
    // refs resolve against its LIBRARY's trees. That pin passed all the way
    // through the round in which astryx Slider measured 55.299 — because the
    // FIDELITY GATE was not using the library's trees. It built its
    // inventory (and its rendered custom properties) from `cfg.tokens.dtcg`
    // + the run's FRESH mint only, never the SHIPPED minted tree, so every
    // reviewed-layer ref the current mint no longer produces rendered as an
    // EMPTY custom property and the score fell with no receipt saying why.
    //
    // This is the pin for that class, stated so it cannot pass vacuously:
    // a ref that resolves in the shipped tree but is ABSENT from the fresh
    // mint must NOT measure as unresolved. It runs on the committed astryx
    // facts (the fresh mint from the harness's own extension block, the
    // gated contract the harness scored) and falsifies itself twice — with
    // the shipped tree withheld the 44 refs must come back, and a planted
    // value divergence must be REPORTED rather than silently resolved.
    id: 'gate-inventory-shipped-minted',
    claim: 'C2-refusal',
    run: () => {
      // 1. Every capture config NAMES its library's shipped minted tree.
      //    An absent declaration is exactly how the defect stayed invisible.
      const cfgDir = path.join(ROOT, 'extract/computed/configs');
      const configs = readdirSync(cfgDir).filter((f) => f.endsWith('.json'));
      const undeclared: string[] = [];
      for (const f of configs) {
        const cfg = JSON.parse(readFileSync(path.join(cfgDir, f), 'utf8')) as { tokens?: { minted?: string } };
        if (!cfg.tokens?.minted) undeclared.push(`${f}: no tokens.minted — the gate would score against fresh-mint-only inventory`);
        else if (!existsSync(path.join(ROOT, cfg.tokens.minted))) undeclared.push(`${f}: tokens.minted does not exist (${cfg.tokens.minted})`);
      }
      if (undeclared.length > 0) throw new Error(`${undeclared.length} capture config(s) cannot see their shipped minted tree:\n  - ${undeclared.join('\n  - ')}`);

      // …and loadConfig REFUSES a declared-but-absent tree BY NAME, so the
      // fallback can never happen silently.
      const bad = JSON.parse(readFileSync(path.join(cfgDir, 'astryx.json'), 'utf8')) as Record<string, unknown>;
      (bad.tokens as Record<string, unknown>).minted = 'examples/astryx/tokens/does-not-exist.dtcg.json';
      mkdirSync(path.join(ROOT, '.eval-tmp'), { recursive: true });
      const badPath = path.join(ROOT, '.eval-tmp', 'gate-inventory.json');
      writeFileSync(badPath, JSON.stringify(bad));
      let refusal = '';
      try { loadCaptureConfig(ROOT, badPath); } catch (e) { refusal = String((e as Error).message); }
      rmSync(path.join(ROOT, '.eval-tmp'), { recursive: true, force: true });
      if (!refusal.includes('tokens.minted not found')) {
        throw new Error(`loadConfig ACCEPTED a config whose declared minted tree is missing — the gate would fall back to fresh-mint-only inventory in silence (got: ${refusal || 'no refusal'})`);
      }

      // 1b. THE ORDERING GUARD (task #28). "Absent" was never the state that
      //     actually happened: the pipeline runs the harness BEFORE
      //     promote-floor writes the minted tree, so the tree gets stubbed to
      //     satisfy the refusal above and the gate records `leavesAdded: 0`
      //     for a tree that did not exist yet — which is exactly what all ten
      //     committed Carbon scorecards said. A DECLARED tree with ZERO
      //     leaves is now refused by name, the bootstrap allowance is
      //     explicit and RECEIPTED, and the allowance cannot rot.
      const guard = (mutate: (t: Record<string, unknown>) => void, mintedJson: string): string => {
        mkdirSync(path.join(ROOT, '.eval-tmp'), { recursive: true });
        const c = JSON.parse(readFileSync(path.join(cfgDir, 'astryx.json'), 'utf8')) as Record<string, unknown>;
        const mintedPath = path.join(ROOT, '.eval-tmp', 'minted.dtcg.json');
        writeFileSync(mintedPath, mintedJson);
        (c.tokens as Record<string, unknown>).minted = path.relative(ROOT, mintedPath);
        mutate(c);
        const p = path.join(ROOT, '.eval-tmp', 'ordering-guard.json');
        writeFileSync(p, JSON.stringify(c));
        let msg = '';
        try { loadCaptureConfig(ROOT, p); } catch (e) { msg = String((e as Error).message); }
        rmSync(path.join(ROOT, '.eval-tmp'), { recursive: true, force: true });
        return msg;
      };
      const LEAF = '{"imported":{"probe":{"$value":"#000000","$type":"color"}}}';
      const emptyRefusal = guard(() => {}, '{}');
      if (!emptyRefusal.includes('ZERO leaves')) {
        throw new Error(`loadConfig ACCEPTED a declared minted tree with zero leaves — the gate would record leavesAdded: 0 for a tree the promotion has not written (got: ${emptyRefusal || 'no refusal'})`);
      }
      const bootstrapped = guard((c) => { (c.tokens as Record<string, unknown>).mintedBootstrap = true; }, '{}');
      if (bootstrapped !== '') {
        throw new Error(`a library's genuine FIRST-EVER pass cannot run: mintedBootstrap did not allow an empty tree (got: ${bootstrapped})`);
      }
      const rotted = guard((c) => { (c.tokens as Record<string, unknown>).mintedBootstrap = true; }, LEAF);
      if (!rotted.includes('outlived')) {
        throw new Error(`a stale mintedBootstrap flag was ACCEPTED over a tree that now carries leaves — it would suppress the ordering guard forever (got: ${rotted || 'no refusal'})`);
      }
      if (mintedLeafCount(JSON.parse('{}') as Record<string, unknown>) !== 0 || mintedLeafCount(JSON.parse(LEAF) as Record<string, unknown>) !== 1) {
        throw new Error('mintedLeafCount does not agree with the guard on what "exists" means');
      }
      // …and no SHIPPING config leans on the allowance.
      for (const f of configs) {
        const c = JSON.parse(readFileSync(path.join(cfgDir, f), 'utf8')) as { tokens?: { minted?: string; mintedBootstrap?: boolean } };
        if (c.tokens?.mintedBootstrap) throw new Error(`${f} still carries tokens.mintedBootstrap — a shipped library measures against its shipped tree`);
        const n = mintedLeafCount(JSON.parse(readFileSync(path.join(ROOT, c.tokens!.minted!), 'utf8')) as Record<string, unknown>);
        if (n === 0) throw new Error(`${f}: shipped minted tree ${c.tokens!.minted} carries ZERO leaves`);
      }

      // 2. THE CLASS. astryx Slider's gated contract binds 44 refs that live
      //    in the shipped tree and NOT in the run's own fresh mint.
      const out = path.join(ROOT, 'extract/computed/out/astryx/slider');
      const fresh = (JSON.parse(readFileSync(path.join(out, 'enriched.extension.json'), 'utf8')) as { mintedTokens: Record<string, unknown> }).mintedTokens;
      const gated = JSON.parse(readFileSync(path.join(out, 'resolved.contract.json'), 'utf8'));
      const base = JSON.parse(readFileSync(path.join(ROOT, 'examples/astryx/tokens/astryx.dtcg.json'), 'utf8')) as Record<string, unknown>;
      const shipped = JSON.parse(readFileSync(path.join(ROOT, 'examples/astryx/tokens/astryx-minted.dtcg.json'), 'utf8')) as Record<string, unknown>;

      const unresolved = (trees: Array<Record<string, unknown>>): string[] => {
        const errors: string[] = [];
        coreGenerateCss(gated, tokenInventoryFromJson(trees), errors);
        return [...new Set(errors.filter((e) => e.includes('does not exist in tokens/')))];
      };
      const merged = mergeShippedMinted(fresh, shipped);
      const withShipped = unresolved([base, merged.tree]);
      if (withShipped.length > 0) {
        throw new Error(`${withShipped.length} ref(s) of the gated astryx Slider contract still resolve to NOTHING against base + fresh mint + SHIPPED minted tree — they would render as empty custom properties:\n  - ${withShipped.slice(0, 5).join('\n  - ')}`);
      }
      // FALSIFIABLE (the defect itself): the referee must go BLIND without the
      // shipped tree.
      //
      // This used to withhold the shipped tree from the real astryx Slider and
      // require the refs to come back. That fixture is GONE, and its going is a
      // good thing rather than a loss: it only existed because astryx could not
      // be re-promoted, so its shipped tree and its fresh mint had drifted
      // apart. Since the recapture (task #43) they agree — and a sweep of
      // polaris, carbon and mui finds no component that exercises the
      // divergence either, because every shipped tree in the corpus is now in
      // sync with its own mint.
      //
      // So the falsification is now SYNTHETIC, which also makes it stronger: it
      // no longer depends on some library happening to be stale. Plant a ref
      // that lives ONLY in the shipped layer and require the referee to resolve
      // it with that layer and refuse without it.
      const plantedRef = 'imported.__shipped_only_probe.color';
      const plantedContract = structuredClone(gated) as { anatomy: Record<string, { tokens?: Record<string, string> }> };
      plantedContract.anatomy.root.tokens = { ...(plantedContract.anatomy.root.tokens ?? {}), color: `{${plantedRef}}` };
      const plantedShipped = { ...shipped, imported: { ...(shipped.imported as object), __shipped_only_probe: { color: { $value: '#abcdef', $type: 'color' } } } };
      const unresolvedFor = (contract: unknown, trees: Array<Record<string, unknown>>): string[] => {
        const errors: string[] = [];
        coreGenerateCss(contract as never, tokenInventoryFromJson(trees), errors);
        return [...new Set(errors.filter((e) => e.includes('does not exist in tokens/')))];
      };
      const plantedMerged = mergeShippedMinted(fresh, plantedShipped as Record<string, unknown>);
      if (unresolvedFor(plantedContract, [base, plantedMerged.tree]).some((e) => e.includes(plantedRef))) {
        throw new Error(`a ref present ONLY in the shipped minted tree did not resolve through gateInventory's merge — the shipped layer is not reaching the referee`);
      }
      if (!unresolvedFor(plantedContract, [base, fresh]).some((e) => e.includes(plantedRef))) {
        throw new Error('withholding the shipped minted tree did NOT make the shipped-only ref unresolvable — this pin is decorative, the referee is not actually consulting that layer');
      }

      // 3. PRECEDENCE, both halves. Fresh wins a collision (the run's own
      //    measurement), and a leaf whose value actually disagrees is
      //    REPORTED rather than silently chosen.
      const freshProbe = { imported: { probe: { c: { $value: '#111111', $type: 'color' } } } };
      const shippedProbe = { imported: { probe: { c: { $value: '#222222', $type: 'color' }, only: { $value: '4px', $type: 'dimension' } } } };
      const probe = mergeShippedMinted(freshProbe, shippedProbe);
      const kept = ((probe.tree.imported as Record<string, Record<string, Record<string, unknown>>>).probe.c.$value);
      if (kept !== '#111111') throw new Error(`shipped value overwrote the FRESH mint on collision (${String(kept)}) — precedence is fresh-first, shipped-fallback`);
      if (!probe.added.includes('imported.probe.only')) throw new Error('a shipped-only leaf was NOT added to the inventory — the fallback half of the rule does nothing');
      if (!probe.divergent.some((d) => d.token === 'imported.probe.c' && d.fresh === '#111111' && d.shipped === '#222222')) {
        throw new Error('a fresh/shipped VALUE divergence was chosen SILENTLY — a real library regression looks exactly like this row');
      }
      if (structuredClone(freshProbe).imported.probe.c.$value !== '#111111' || 'only' in (freshProbe.imported.probe as object)) {
        throw new Error('mergeShippedMinted MUTATED the caller‘s fresh tree — the harness writes that tree into the extension block');
      }
      console.log(`gate-inventory-shipped-minted: ${configs.length} capture configs name their shipped minted tree (absent path refused by name at load; a ZERO-LEAF tree refused as the task-#28 ORDERING GUARD, bootstrap allowance explicit + receipted + unable to rot); the gate inventory = base + fresh mint + shipped tree resolves every ref of the gated astryx Slider contract; the falsification is now SYNTHETIC — a ref planted in the shipped layer alone resolves through the merge and is UNRESOLVABLE without it — because the old fixture (a real shipped/fresh divergence) is gone: astryx's trees agree since the task-#43 recapture, and a sweep of polaris, carbon and mui finds no component that diverges either, so the whole corpus is now in sync and the pin no longer depends on a library happening to be stale; precedence fresh-first/shipped-fallback with value divergences named`);
    },
  },
  {
    // INHERITANCE-AWARE NESTED REFUSAL (polaris/astryx repair wave).
    //
    // The state-plane projection round let a NESTED part carry a two-axis
    // BASE binding, but the nested STATE door still carries plain color-kind
    // refs only. polaris Button's `label` therefore gained a base colour
    // while all four of its per-state colour deltas were refused — severing
    // the CSS inheritance that had been rendering :hover/:focus-visible
    // correctly, and costing 91.331 → 85.858 on the offline gate.
    //
    // The repair refuses that base binding when the CAPTURE proves the
    // channel is pure inheritance (equal to the ancestor on EVERY plane) AND
    // the part's own state delta goes uncarried. This pin replays the
    // COMMITTED Button capture through the real fusion path — no Chromium,
    // no harness — and asserts BOTH directions, so it cannot pass by
    // accident: with the measured facts the label carries no colour; with
    // them withheld (the pre-fix engine) it does.
    id: 'nested-inheritance-refusal',
    claim: 'C2-refusal',
    run: () => {
      const cfg = loadCaptureConfig(ROOT, path.join(ROOT, 'extract/computed/configs/polaris.json'));
      const comp = cfg.components.find((c) => c.name === 'Button')!;
      const outDir = path.join(ROOT, 'extract/computed/out/button');
      const truth = JSON.parse(readFileSync(path.join(outDir, 'captured-truth.json'), 'utf8'));
      const space = propSpaceFor(ROOT, cfg, comp);
      const captures = fuseReconstruct(truth).map((c) => ({ ...c, combo: `${comp.name}:${c.combo}` }));
      const aligned = fuseAlignSweep(
        { captures, controls: truth.controls, allProps: truth._provenance.channels, browserVersion: 'committed', fontChecks: {}, pinnedAnimations: [] } as never,
        comp, space, cfg.library.classPrefix,
      );
      const promotion = depthPromoteAnatomy(space, comp, aligned.union, depthKebab(space.contract.name));
      const svgConsumed = new Set([...promotion.consumed].map((i) => aligned.partNames[i]));
      const controlStyles = Object.fromEntries(Object.entries(truth.controls as Record<string, { style: Record<string, string> }>).map(([t, n]) => [t, n.style]));
      const styled = fuseStyledChannels(aligned, space, controlStyles, truth._provenance.channels, [], {
        // task #20: the harness box fusion judges viewport-derived geometry
        // against (Polaris Button is in-stage and unaffected — its root is
        // display:inline-flex and nothing in it is ICB-resolved).
        viewport: cfg.browser.viewport,
        // stageFor(), not a second spelling of `comp.stage ?? cfg.stage` —
        // run.ts and regate.ts call the function, and fuse.ts's own comment
        // records that two spellings of one rule is how the base door and the
        // state door drifted apart. They agree today; this keeps them agreeing.
        stage: stageFor(cfg, comp),
        portaled: comp.portalCapture === true,
      });
      const folds = fuseDetectFolds(aligned, styled);
      const layout = fuseEnrichLayout(aligned, space, styled, promotion.contract);
      const prep = fusePrepareMint(aligned, comp, space, styled, folds, layout.handled, promotion.contract, svgConsumed);

      // The MEASURED fact: label.color tracks its ancestor on every plane.
      if (!prep.inheritanceOnly.includes('label|color')) {
        throw new Error(`polaris Button label.color was NOT measured as inheritance-only — the capture-side half of the refusal is not firing (got: ${prep.inheritanceOnly.join(', ') || 'none'})`);
      }
      const labelOf = (contract: unknown): Record<string, unknown> | null => {
        const walk = (p: Record<string, unknown>): Record<string, unknown> | null => {
          for (const [k, v] of Object.entries((p.parts ?? {}) as Record<string, Record<string, unknown>>)) {
            if (k === 'label') return v;
            const hit = walk(v);
            if (hit) return hit;
          }
          return null;
        };
        return walk(((contract as Record<string, never>).anatomy as Record<string, never>).root);
      };
      const colourBindings = (label: Record<string, unknown> | null): number => {
        if (!label) return -1;
        let n = 'color' in ((label.tokens ?? {}) as object) ? 1 : 0;
        for (const e of (label.tokensByProp ?? []) as Array<{ map: Record<string, Record<string, string>> }>) {
          for (const m of Object.values(e.map)) if ('color' in m) n++;
        }
        return n;
      };
      const mintBase = coreMintTokens(comp.name, prep.baseObs, prep.axes, { nestedPairs: true });
      const mintStates = coreMintTokens(comp.name, prep.stateObs, prep.axes, { nestedPairs: true });
      const applyWith = (inheritance: { only: string[]; stateDeltas: string[] }) =>
        fuseApplyMint(
          promotion.contract, space, mintBase, prep.baseObs, mintStates, prep.stateObs, layout.enriched,
          prep.declared, prep.declaredStates, prep.setPlaneLiterals, inheritance,
        ).enriched;

      const repaired = colourBindings(labelOf(applyWith({ only: prep.inheritanceOnly, stateDeltas: prep.inheritanceStateDeltas })));
      if (repaired !== 0) {
        throw new Error(`polaris Button's nested label still carries ${repaired} colour binding(s) — the base binding blocks inheritance of the root's hover/focus colour on every state plane`);
      }
      // FALSIFIABLE: withhold the measured facts (= the pre-fix engine) and
      // the very same inputs must reproduce the regression, or this pin is
      // asserting nothing about the repair.
      const preFix = colourBindings(labelOf(applyWith({ only: [], stateDeltas: [] })));
      if (preFix <= 0) {
        throw new Error(`without the inheritance facts the label carried ${preFix} colour bindings — the pin cannot distinguish the repair from the defect it fixes`);
      }
      // The safety condition must be load-bearing, not decorative: a channel
      // whose ANCESTOR carries it nowhere is deliberately left bound (astryx
      // Slider's label-3 is the live example), so a blanket "drop every
      // inherited nested binding" rule would be a different, unsafe fix.
      const rejected = prep.inheritanceReceipts.filter((r) => r.startsWith('inheritance-check-rejected:'));
      console.log(`nested-inheritance-refusal: polaris Button label.color measured inheritance-only across the committed capture; base binding refused (${preFix} colour binding(s) without the facts → 0 with them); ${prep.inheritanceOnly.length} inheritance-only channel(s), ${rejected.length} candidate(s) rejected by the ancestor-carries guard`);
    },
  },
  {
    // DECISION LEDGER APPLY-TIME VALUE CHECK (polaris/astryx repair wave).
    //
    // applyDecisions matches by (part, channel, scope) — `ids` are provenance,
    // never a selector, because combo vocabularies drift between rounds. That
    // also means a ledger belonging to a DIFFERENT library applies silently,
    // and one did: the pre-namespacing astryx Badge run left its ledger in the
    // un-namespaced polaris root, where its `{spacing-0}`/`{font-size-sm}`
    // targets overwrote Polaris's real bindings and rendered as EMPTY custom
    // properties (97.327 → 95.159).
    //
    // Two pins: the guard refuses an unresolvable target by name, and NO
    // committed ledger carries a target outside its own library's inventory.
    id: 'decision-ledger-value-check',
    claim: 'C2-refusal',
    run: () => {
      const inventory = tokenInventoryFromJson([
        JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/tokens/polaris-light.dtcg.json'), 'utf8')) as Record<string, unknown>,
      ]);
      const mk = () => JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/contracts/badge.contract.json'), 'utf8'));
      const foreign: AckedDecision[] = [{
        ids: ['blue|root|padding-block'], part: 'root', channel: 'padding-block', scope: 'base',
        from: '{spacing-0-5}', to: '{spacing-0}', observed: '0px', expected: '2px',
        cause: 'the astryx Badge ledger, verbatim', ack: 'planted',
      }];
      const guarded = mk();
      const before = guarded.anatomy.root.tokens['padding-block'];
      const res = computedApplyDecisions(guarded, foreign, inventory);
      if (res.applied.length !== 0 || res.skipped.length !== 1 || !res.skipped[0].includes('NOT in this library')) {
        throw new Error(`a decision targeting {spacing-0} (absent from the Polaris inventory) was NOT refused by name: applied=${JSON.stringify(res.applied)} skipped=${JSON.stringify(res.skipped)}`);
      }
      if (guarded.anatomy.root.tokens['padding-block'] !== before) {
        throw new Error('the refused decision still mutated the contract — the guard must refuse BEFORE writing');
      }
      // FALSIFIABLE both ways: without the inventory the same ledger applies,
      // which is exactly the silent corruption this guard exists to stop.
      const unguarded = mk();
      computedApplyDecisions(unguarded, foreign);
      if (unguarded.anatomy.root.tokens['padding-block'] !== '{spacing-0}') {
        throw new Error('the planted foreign decision did not apply without the inventory — the pin cannot show what the guard prevents');
      }
      // A LEGITIMATE target must still apply, or the guard is over-broad.
      const ok = mk();
      computedApplyDecisions(ok, [{ ...foreign[0], to: '{p.space-0}' }], inventory);
      if (ok.anatomy.root.tokens['padding-block'] !== '{p.space-0}') {
        throw new Error('a decision targeting a REAL Polaris token was refused — the guard is over-broad');
      }
      // REGRESSION PIN: no committed ledger may target a token its own
      // library does not ship.
      const roots: Array<{ lib: string; out: string }> = [
        { lib: 'polaris', out: 'extract/computed/out' },
        { lib: 'mui', out: 'extract/computed/out/mui' },
        { lib: 'astryx', out: 'extract/computed/out/astryx' },
        { lib: 'tailwind', out: 'extract/computed/out/tailwind' },
      ];
      const bad: string[] = [];
      let ledgers = 0;
      for (const { lib, out } of roots) {
        const tokensDir = path.join(ROOT, 'examples', lib, 'tokens');
        const trees = readdirSync(tokensDir)
          .filter((f) => f.endsWith('.dtcg.json'))
          .map((f) => JSON.parse(readFileSync(path.join(tokensDir, f), 'utf8')) as Record<string, unknown>);
        const inv = tokenInventoryFromJson(trees);
        const outAbs = path.join(ROOT, out);
        for (const d of readdirSync(outAbs)) {
          const led = path.join(outAbs, d, 'decisions.json');
          if (!existsSync(led) || !statSync(path.join(outAbs, d)).isDirectory()) continue;
          ledgers++;
          for (const row of JSON.parse(readFileSync(led, 'utf8')) as AckedDecision[]) {
            if (/^\{[a-z0-9.-]+\}$/i.test(row.to) && !inv.has(row.to.slice(1, -1))) {
              bad.push(`${lib}/${d}: ${row.part}.${row.channel} → ${row.to}`);
            }
          }
        }
      }
      if (bad.length > 0) {
        throw new Error(`${bad.length} committed decision row(s) target a token absent from their own library's trees (the cross-library ledger class):\n  - ${bad.join('\n  - ')}`);
      }
      console.log(`decision-ledger-value-check: unresolvable decision targets refused by name (and applied without the guard — the corruption is real); ${ledgers} committed ledgers across 4 libraries target only tokens their own library ships`);
    },
  },
  {
    // ---- SILENT-LOSS ROUND (task #33) — fix 4: THE TOKEN-CHANNEL REGISTRY.
    //
    // `tokens` was `z.record(z.string(), TokenRefSchema)` and validateContract
    // whitelisted `declared` and `literals` but NOT `tokens`, so ANY string
    // was a legal channel and the CSS emitters wrote it out verbatim. The
    // live consequence, verifiable before this round: MUI's Switch carries
    // `tokens["translate-y"]` — a SYNTHETIC channel invented by
    // decomposeTranslate — and Switch.module.css said
    // `translate-y: var(--imported-shared-size-0)`, a property no browser
    // understands, dropped by every UA in silence. Same class as the
    // `-state-checked` bug this repo thought it had closed.
    id: 'token-channel-registry',
    claim: 'C2-refusal',
    run: () => {
      // 1. REFUSAL: an unregistered channel is refused BY NAME, on the field
      //    that had no gate at all.
      const base = JSON.parse(readFileSync(path.join(ROOT, 'examples/mui/contracts/switch.contract.json'), 'utf8')) as SchemaContract;
      const planted = (mut: (c: any) => void) => {
        const c = JSON.parse(JSON.stringify(base));
        mut(c);
        const errs: string[] = [];
        coreValidateContract(c, new Map(), errs, new Map());
        return errs;
      };
      const cases: Array<[string, (c: any) => void, string]> = [
        ['tokens', (c) => { c.anatomy.root.tokens['translate-z'] = '{imported.shared.size-0}'; }, 'translate-z'],
        ['root states', (c) => { c.anatomy.root.states = { ...(c.anatomy.root.states ?? {}), disabled: { 'scroll-snap-type': '{imported.shared.size-0}' } }; }, 'scroll-snap-type'],
      ];
      for (const [where, mut, channel] of cases) {
        const errs = planted(mut);
        const named = errs.filter((e) => e.includes(channel) && e.includes('not a token channel'));
        if (named.length === 0) {
          throw new Error(`an unregistered channel in ${where} was NOT refused by name (errors: ${errs.join(' | ') || 'none'})`);
        }
      }
      // …and the guard is not over-broad: the real contract validates clean.
      const clean: string[] = [];
      coreValidateContract(JSON.parse(JSON.stringify(base)), new Map(), clean, new Map());
      const channelErrs = clean.filter((e) => e.includes('not a token channel'));
      if (channelErrs.length > 0) throw new Error(`the registry refuses a channel the shipped MUI Switch actually carries: ${channelErrs.join(' | ')}`);

      // 2. EVERY committed contract in the repo, across all seven libraries,
      //    carries only registered channels — the census that makes the
      //    registry a fact rather than a wish.
      const dirs = ['contracts', ...readdirSync(path.join(ROOT, 'examples'), { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(path.join(ROOT, 'examples', e.name, 'contracts')))
        .map((e) => `examples/${e.name}/contracts`)];
      const unregistered = new Set<string>();
      let contractCount = 0;
      const seen = new Set<string>();
      for (const d of dirs) {
        for (const f of readdirSync(path.join(ROOT, d)).filter((x) => x.endsWith('.contract.json'))) {
          contractCount++;
          const c = JSON.parse(readFileSync(path.join(ROOT, d, f), 'utf8')) as SchemaContract;
          for (const { part } of coreWalkAnatomy(c)) {
            const chans = [
              ...Object.keys(part.tokens ?? {}),
              ...coreTokensByPropEntries(part).flatMap((e) => Object.values(e.map ?? {}).flatMap((m) => Object.keys(m))),
            ];
            for (const ch of chans) { seen.add(ch); if (!TOKEN_CHANNELS[ch]) unregistered.add(`${d}/${f}: ${ch}`); }
          }
        }
      }
      if (unregistered.size > 0) {
        throw new Error(`${unregistered.size} committed token channel(s) outside TOKEN_CHANNELS:\n  - ${[...unregistered].join('\n  - ')}`);
      }

      // 3. THE CSS SURFACE: a canvas-only synthetic channel must NEVER reach a
      //    stylesheet as a declaration, and its absence must be NAMED there.
      const tokens = tokenInventoryFromJson([
        JSON.parse(readFileSync(path.join(ROOT, 'examples/mui/tokens/mui.dtcg.json'), 'utf8')) as Record<string, unknown>,
        JSON.parse(readFileSync(path.join(ROOT, 'examples/mui/tokens/mui-minted.dtcg.json'), 'utf8')) as Record<string, unknown>,
      ]);
      const cssErrors: string[] = [];
      const css = coreGenerateCss(base, tokens, cssErrors);
      // strip the leading /* … */ note before looking for declarations: the
      // note NAMES the refused channels, so a naive grep matches itself.
      const declLines = css.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => /^\s*translate-[xy]\s*:/.test(l));
      if (declLines.length > 0) {
        throw new Error(`the emitted stylesheet still declares a synthetic channel no browser understands:\n  ${declLines.join('\n  ')}`);
      }
      if (!css.includes('REFUSED BY NAME') || !css.includes('translate-x') || !css.includes('translate-y')) {
        throw new Error('the CSS drops translate-x/translate-y SILENTLY — the refusal must be named in the stylesheet');
      }
      // FALSIFICATION: the stripper is what removes them. Feed it a stylesheet
      // that declares one and it must come back both stripped and named.
      const proof = coreStripCanvasOnly('.x {\n  color: red;\n  translate-y: var(--t);\n}\n');
      if (/^\s*translate-y\s*:/m.test(proof.replace(/\/\*[\s\S]*?\*\//g, '')) || !proof.includes('REFUSED BY NAME')) {
        throw new Error('stripCanvasOnlyChannels did not strip-and-name a planted declaration');
      }
      console.log(`token-channel-registry: ${Object.keys(TOKEN_CHANNELS).length} registered channels; ${seen.size} distinct channels across ${contractCount} committed contracts all registered; an unregistered channel in tokens AND in root states refuses BY NAME (root states had NO gate at all before); MUI Switch's synthetic translate-x/translate-y no longer reach the stylesheet as invalid declarations and the refusal is named there`);
    },
  },
  {
    // ---- fix 3: CHANNEL MISSES. `applyTokens`/`applyLiterals` ended in
    // `default: break;` — three separate rounds of that same defect are
    // documented in emit-figma-script.ts's own comments (padding longhands,
    // column-gap, the RadioButton ring), each found on a canvas by a person
    // AFTER shipping. A channel the contract CARRIES and the canvas cannot
    // draw now says so, through the same marker path the file already had for
    // gradients and shadows.
    id: 'channel-miss-named',
    claim: 'C2-refusal',
    run: () => {
      const contract = JSON.parse(readFileSync(path.join(ROOT, 'examples/carbon/contracts/modal.contract.json'), 'utf8')) as SchemaContract;
      const trees = ['carbon.dtcg.json', 'carbon-minted.dtcg.json'].map(
        (f) => JSON.parse(readFileSync(path.join(ROOT, 'examples/carbon/tokens', f), 'utf8')) as Record<string, unknown>,
      );
      const mkEngine = (t: Record<string, unknown>[], ic: Map<string, string> = new Map()) => createFigmaEngine({
        tokens: { primitives: t[0], semantic: t[1], light: {}, dark: {}, brands: { default: {} } } as never,
        icons: ic,
      });
      const icons = new Map(readdirSync(path.join(ROOT, 'examples/carbon/assets/icons')).map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(ROOT, 'examples/carbon/assets/icons', f), 'utf8')]));
      const emit = (c: SchemaContract) => mkEngine(trees, icons).buildComponentScript(c as never, new Map([[c.id, c as never]]));
      // Carbon's Modal carries grid-template-columns / grid-column-start /
      // max-height — real facts, no Figma field. The dagger must be on.
      const script = emit(contract);
      if (!/"description": "[^"]*†"/.test(script)) {
        throw new Error('a component carrying grid/max-height token channels emitted NO code-only-fact marker — the miss is silent again');
      }
      // FALSIFICATION: strip every unhandled channel and the dagger must go
      // away for the right reason — i.e. the marker tracks the FACT, not the
      // component. (Modal also carries events/declared facts, so compare a
      // component that carries neither.)
      const bare = JSON.parse(readFileSync(path.join(ROOT, 'examples/tailwind/contracts/card.contract.json'), 'utf8')) as SchemaContract;
      const twTrees = ['tailwind.dtcg.json', 'tailwind-minted.dtcg.json'].map(
        (f) => JSON.parse(readFileSync(path.join(ROOT, 'examples/tailwind/tokens', f), 'utf8')) as Record<string, unknown>,
      );
      const emitTw = (c: SchemaContract) => mkEngine(twTrees).buildComponentScript(c as never, new Map([[c.id, c as never]]));
      const withMiss = emitTw(bare);
      if (!/"description": "[^"]*†"/.test(withMiss)) {
        throw new Error('tailwind Card carries row-rule-color (a channel with no canvas field) and emitted no marker');
      }
      // Remove every channel that CAN miss: the registry's non-'draw'
      // verdicts, plus the two CONDITIONAL no-ops (a gap longhand on the
      // CROSS axis has a native field on one axis and none on the other, so
      // the registry alone cannot classify it — tailwind's Card label carries
      // BOTH row-gap and column-gap and the emitter used to drop one of them
      // in silence, which is how this pin found it).
      const CAN_MISS = (ch: string) => (TOKEN_CHANNELS[ch] && TOKEN_CHANNELS[ch].canvas !== 'draw') || ch === 'row-gap' || ch === 'column-gap';
      const stripped = JSON.parse(JSON.stringify(bare)) as SchemaContract;
      let removed = 0;
      for (const { part } of coreWalkAnatomy(stripped)) {
        for (const ch of Object.keys(part.tokens ?? {})) {
          if (CAN_MISS(ch)) { delete (part.tokens as Record<string, string>)[ch]; removed++; }
        }
        for (const e of coreTokensByPropEntries(part)) {
          for (const m of Object.values(e.map ?? {})) {
            for (const ch of Object.keys(m)) if (CAN_MISS(ch)) { delete (m as Record<string, string>)[ch]; removed++; }
          }
        }
      }
      if (removed === 0) throw new Error('the falsification removed nothing — tailwind Card carries no undrawable channel, so this pin proves nothing');
      const noMiss = emitTw(stripped);
      if (/"description": "[^"]*†"/.test(noMiss)) {
        throw new Error(`removing all ${removed} undrawable channel(s) left the marker on — it is not tracking the miss`);
      }
      console.log(`channel-miss-named: a carried channel with no canvas field marks the component as carrying code-only facts (carbon Modal: grid-template-columns/grid-column-start/max-height; tailwind Card: row-rule-color AND a CROSS-AXIS gap longhand — the conditional no-op class this pin found on its first run); removing all ${removed} missable channels from Card clears the marker — the mark tracks the FACT, not the component`);
    },
  },
  {
    // ---- SILENT-LOSS ROUND (task #33) — fixes 1, 2 and 5, the three RECEIPT
    // fixes. Each one turned a bare `continue` / a fabricated number into a
    // named, counted fact. Each pin here is the falsification: it fails if the
    // silence returns.
    id: 'silent-loss-receipts',
    claim: 'C2-refusal',
    run: () => {
      // ---- fix 1: THE SHORTHAND CEILING (task #27) -------------------------
      // The audit located this at extract/computed/run.ts's
      // `if (el.node.style[ch] === undefined) continue;`. MEASURED, the loss
      // is one layer EARLIER: Chromium stores `background: var(--tok)` as a
      // PENDING-SUBSTITUTION value and enumerates the shorthand's LONGHANDS
      // with the EMPTY STRING, so capture.ts's `if (!val …) continue` dropped
      // the declaration before the Node side ever saw it. Both layers now
      // name what they drop; this pin covers the message contract.
      for (const sh of ['background', 'font', 'border', 'padding', 'transition']) {
        if (!CSS_SHORTHANDS.has(sh)) throw new Error(`CSS_SHORTHANDS is missing "${sh}" — the audit named it explicitly`);
        const msg = shorthandVarSkip('root', sh, ['--tok', '--tok']);
        if (!msg.includes(sh) || !msg.includes('--tok') || !msg.includes('SHORTHAND') || !msg.includes('LONGHANDS')) {
          throw new Error(`the shorthand skip for "${sh}" does not name the property, the var and the reason: ${msg}`);
        }
        if (msg.split('--tok').length - 1 !== 1) throw new Error(`the skip repeats a var name — the message must dedupe: ${msg}`);
      }
      // …and a NON-shorthand property that simply is not enumerated reads
      // DIFFERENTLY. Two causes must never share a message.
      const other = shorthandVarSkip('root', 'app-region', ['--x']);
      if (other.includes('SHORTHAND')) throw new Error('a non-shorthand unenumerated property is reported as a shorthand — the two causes share a message');

      // ---- fix 2: THE TWO BARE `continue`s -------------------------------
      // The pseudo-element loop hid EVERY un-promoted pseudo: text/glyph
      // content (icon-font ligature carets, chevrons, close ×s) and the
      // `!drawn` skip, which CONFLATED "legitimately hidden in this combo"
      // with "painted by something the grammar cannot read" — the exact shape
      // of Carbon's hollow checkbox. The two must stay distinguishable.
      const HIDDEN = 'pseudo-decor-hidden-in-combo';
      const OUTSIDE = 'pseudo-decor-outside-grammar';
      const CONTENT = 'pseudo-content-not-canvas-ink';
      const src = readFileSync(path.join(ROOT, 'extract/computed/anatomy.ts'), 'utf8');
      for (const marker of [HIDDEN, OUTSIDE, CONTENT]) {
        if (!src.includes(marker)) throw new Error(`the pseudo-element loop no longer emits "${marker}" — a skip went silent again`);
      }
      if (src.includes("if (st['content'] !== '\"\"') continue;") || /if \(!drawn\) continue;/.test(src)) {
        throw new Error('a BARE `continue` is back in the pseudo-element loop — the skip it takes is silent');
      }
      // The three names must be genuinely distinct strings, or "distinguishable"
      // is a claim the messages do not keep.
      if (new Set([HIDDEN, OUTSIDE, CONTENT]).size !== 3) throw new Error('the pseudo refusal names collide');
      // Every committed capture receipt that DOES carry one of these names
      // carries it with its measurement, never bare.
      let pseudoNamed = 0;
      for (const root of ['extract/computed/out', 'extract/computed/out/mui', 'extract/computed/out/astryx', 'extract/computed/out/tailwind', 'extract/computed/out/carbon', 'extract/computed/out/altitude']) {
        const abs = path.join(ROOT, root);
        if (!existsSync(abs)) continue;
        for (const d of readdirSync(abs)) {
          const f = path.join(abs, d, 'scorecard.json');
          if (!existsSync(f) || !statSync(path.join(abs, d)).isDirectory()) continue;
          for (const l of (JSON.parse(readFileSync(f, 'utf8')).namedLosses ?? []) as string[]) {
            if (!l.includes(OUTSIDE) && !l.includes(CONTENT) && !l.includes(HIDDEN)) continue;
            pseudoNamed++;
            if (!/\d/.test(l)) throw new Error(`a pseudo refusal carries no measurement: ${l}`);
          }
        }
      }

      // ---- fix 5: THE PIXEL GATE'S FABRICATED NUMBER ----------------------
      // On a size mismatch the gate wrote `pctExact = 100; pctAA = 100` — a
      // number pixelmatch never produced — and let it into the mean. (The
      // audit read that as "scores a wrong-sized box 100% PERFECT"; in this
      // metric 100 is the WORST value, so the number pointed the right way.
      // It was still fabricated, still indistinguishable from a measured
      // 100, and — in run.ts's roll-up — the "original screenshot
      // unavailable" rows were averaged the same way while their own note
      // said "pixel not scored".) Unscorable rows are now NULL, excluded from
      // the mean, COUNTED and PRINTED.
      const gateSrc = readFileSync(path.join(ROOT, 'extract/computed/gate.ts'), 'utf8');
      const runSrc = readFileSync(path.join(ROOT, 'extract/computed/run.ts'), 'utf8');
      for (const [file, text] of [['gate.ts', gateSrc], ['run.ts', runSrc]] as const) {
        if (/pctExact\s*[:=]\s*100/.test(text) || /pctAA\s*[:=]\s*100/.test(text)) {
          throw new Error(`${file} still writes the fabricated 100 into a pixel score`);
        }
        if (!text.includes('size-mismatch') || !text.includes('no-original')) {
          throw new Error(`${file} no longer distinguishes the two unscorable causes`);
        }
      }
      // An empty mean must be NULL, never 0 — in this metric 0 reads as
      // PERFECT, which is the inversion the audit was worried about.
      if (!/measured\.length === 0 \? null/.test(gateSrc) || !/pxMeasured\.length === 0 \? null/.test(runSrc)) {
        throw new Error('an empty pixel mean can still render as 0 — the best possible score for something nothing could be measured on');
      }
      // Every committed receipt that carries the NEW shape must be internally
      // consistent, and no receipt may report a scored row that is also
      // unscorable.
      let checked = 0;
      let oldShape = 0;
      for (const root of ['extract/computed/out', 'extract/computed/out/mui', 'extract/computed/out/astryx', 'extract/computed/out/tailwind', 'extract/computed/out/carbon', 'extract/computed/out/altitude']) {
        const abs = path.join(ROOT, root);
        if (!existsSync(abs)) continue;
        for (const d of readdirSync(abs)) {
          const f = path.join(abs, d, 'scorecard.json');
          if (!existsSync(f) || !statSync(path.join(abs, d)).isDirectory()) continue;
          const sc = JSON.parse(readFileSync(f, 'utf8')) as { pixel?: { pairs: number; measured?: number; unscored?: { sizeMismatch: number }; meanAA: number | null } };
          if (!sc.pixel) continue;
          if (sc.pixel.measured === undefined) { oldShape++; continue; }
          checked++;
          if (sc.pixel.measured + (sc.pixel.unscored?.sizeMismatch ?? 0) !== sc.pixel.pairs) {
            throw new Error(`${root}/${d}: measured ${sc.pixel.measured} + size-mismatched ${sc.pixel.unscored?.sizeMismatch} ≠ pairs ${sc.pixel.pairs} — the denominator does not add up`);
          }
          if (sc.pixel.measured === 0 && sc.pixel.meanAA !== null) {
            throw new Error(`${root}/${d}: 0 pairs measured but meanAA is ${sc.pixel.meanAA} — an unmeasured mean must be null`);
          }
        }
      }
      console.log(`silent-loss-receipts: fix 1 — the shorthand ceiling names property+var+cause for all 5 shorthands the audit listed and reads DIFFERENTLY for a merely-unenumerated property (the loss is in capture.ts, one layer earlier than the audit placed it: Chromium enumerates a var()-carrying shorthand's longhands with the EMPTY string); fix 2 — the two bare continues are gone and the three refusal names (${CONTENT} / ${OUTSIDE} / ${HIDDEN}) are distinct, ${pseudoNamed} committed refusal(s) all carry their measurement; fix 5 — neither roll-up can write the fabricated 100, both name size-mismatch vs no-original, an empty mean is null not 0 (0 means PERFECT here), ${checked} receipt(s) in the new shape are denominator-consistent (${oldShape} still in the pre-round shape — they gain the fields at their next capture)`);
    },
  },
  {
    // ---- fix 2 companion + the repo-wide CHILD-WIDER RATCHET and the
    // FIGMA-SCRIPT FRESHNESS gate. Both are the same lesson from two
    // directions: an ungated surface rots, and a number published only in
    // prose rots faster.
    id: 'child-wider-ratchet-and-script-freshness',
    claim: 'C3-detection',
    run: () => {
      // Both instruments read `examples/*/figma`, which resetScratch does not
      // copy — they run against the REAL tree (read-only) by design.
      const atRoot = (args: string[]) => {
        const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
        return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
      };
      const ratchet = atRoot(['scripts/child-wider.mjs']);
      if (ratchet.status !== 0) throw new Error(`child-wider ratchet RED:\n${ratchet.out.slice(0, 1600)}`);
      const baseline = JSON.parse(readFileSync(path.join(ROOT, 'scripts/child-wider-baseline.json'), 'utf8')) as {
        rows: Array<{ library: string; overflows: number; textCaused: number; marginBox: number; cause: string }>;
      };
      // Every library with figma scripts has a row, and every nonzero row
      // names its cause — an exemption nobody counts is a silent drop.
      const libDirs = readdirSync(path.join(ROOT, 'examples'), { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(path.join(ROOT, 'examples', e.name, 'figma')))
        .map((e) => e.name)
        .filter((n) => readdirSync(path.join(ROOT, 'examples', n, 'figma')).some((f) => f.endsWith('.figma.js') && f !== '00-tokens.figma.js' && f !== 'GENESIS-BATCH.figma.js'));
      for (const lib of libDirs) {
        const row = baseline.rows.find((r) => r.library === lib);
        if (!row) throw new Error(`${lib} has committed figma scripts and NO child-wider baseline row — an ungated surface`);
        if (row.overflows + row.textCaused + row.marginBox > 0 && (!row.cause || row.cause.startsWith('UNNAMED'))) {
          throw new Error(`${lib}: ${row.overflows + row.textCaused + row.marginBox} overflow(s) with no named cause`);
        }
      }
      // FALSIFICATION: lowering a committed number must make the ratchet red
      // (a two-sided ratchet catches an unrecorded IMPROVEMENT too — a stale
      // high baseline is room to regrow in silence).
      // The falsification runs entirely inside SCRATCH (run()'s cwd) — a pin
      // that mutates the real repo to prove itself is a pin that can leave the
      // repo broken when it throws.
      const scratchBaseline = path.join(SCRATCH, 'child-wider-baseline-planted.json');
      const planted = JSON.parse(JSON.stringify(baseline));
      planted.rows.find((r: { library: string }) => r.library === 'astryx').overflows = 99;
      writeFileSync(scratchBaseline, JSON.stringify(planted, null, 2));
      const red = atRoot(['scripts/child-wider.mjs', '--baseline', scratchBaseline]);
      if (red.status === 0) throw new Error('the ratchet passed against a baseline the measurement disagrees with — it is not gating');
      if (!red.out.includes('IMPROVED')) throw new Error(`the ratchet did not name the DECREASE direction:\n${red.out.slice(0, 800)}`);

      const fresh = atRoot(['scripts/figma-scripts-fresh.mjs']);
      if (fresh.status !== 0) throw new Error(`figma sync scripts are STALE vs a rebuild:\n${fresh.out.slice(0, 1600)}`);
      // Task #26 closed the polaris NAMED hole (the last one): its scripts are
      // rebuilt by generate.ts --check, a byte-compare over ALL 76 generated
      // surfaces. The assertion flips accordingly: a NOT GATED row REAPPEARING
      // is the failure now (a library fell out of the freshness net), and
      // polaris must carry a real 'fresh' row — the gate itself still hard-fails
      // on any figma dir with neither a row nor a named hole, so a silent skip
      // remains structurally impossible.
      if (fresh.out.includes('NOT GATED')) {
        throw new Error(`a library has fallen back to a NOT GATED named hole — the freshness net is torn again:\n${fresh.out.slice(0, 1200)}`);
      }
      if (!/polaris\s+fresh/.test(fresh.out)) {
        throw new Error(`polaris lost its freshness row (task #26 added it via generate.ts --check):\n${fresh.out.slice(0, 1200)}`);
      }
      const total = baseline.rows.reduce((n, r) => n + r.overflows, 0);
      console.log(`child-wider-ratchet-and-script-freshness: ${baseline.rows.length} libraries carry a committed child-wider baseline (${total} real overflows repo-wide, the MUI hug-cell label pair — the astryx ProgressBar percent-width class was FIXED by the exact-conversion wave and re-recorded; text-caused and margin-box counted SEPARATELY so neither can flatter the first number), the ratchet is two-sided and names an unrecorded improvement, and every library's sync scripts are BYTE-FRESH vs a fresh emission (polaris via generate.ts --check since task #26 — zero named holes remain) — the gap that let MUI's scripts sit three engine fixes stale while the suite stayed green`);
    },
  },
  {
    // ---- THE CSS/DOM CONFORMANCE FIXTURE (task #32).
    //
    // The owner's question was "can we start PREDICTING the flaws instead of
    // discovering one per library". The structural reason we could not: every
    // instrument in this repo derives its denominator from the same filter
    // that decides carriage. The fidelity gate scores channels that passed
    // isFusable, so a channel the filter never opened is not in the
    // denominator and scores 100%. Promotion removes refused parts from
    // scoring, so refusing a part cannot lower a score.
    //
    // The fixture inverts that: a synthetic library of labelled CSS/DOM
    // constructs whose expected disposition is declared IN ADVANCE, in a
    // manifest derived from NOTHING in the engine. This eval is the gate on
    // that gate — it runs the conformance measurement against its committed
    // baseline and RED-s on drift in either direction, and it separately
    // asserts the properties that make the instrument trustworthy at all.
    //
    // Chromium-free: the measurement reads the committed capture artifacts.
    id: 'css-dom-conformance-frontier',
    claim: 'C3-detection',
    run: () => {
      // The fixture reads conformance/ and extract/computed/out/conformance,
      // neither of which resetScratch copies — it runs against the REAL tree
      // (read-only) by design, exactly as the child-wider ratchet does.
      const atRoot = (args: string[]) => {
        const r = spawnSync('npx', ['tsx', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
      };

      // 1 · THE GATE ITSELF. Reds on any SILENT-LOSS, UNDECLARED-CARRY,
      //     WRONG-NAME, or UNMEASURED-for-a-CARRIED/LOWERED case that is not
      //     in the committed frontier — and equally on any that has been
      //     FIXED without re-recording, so a repair can never be absorbed
      //     silently.
      const gate = atRoot(['conformance/run.ts']);
      if (gate.status !== 0) throw new Error(`conformance gate RED (drift against conformance/BASELINE.json):\n${gate.out.slice(-2400)}`);

      // 2 · THE MANIFEST IS THE DENOMINATOR, and it is INDEPENDENT of the
      //     engine. This is the whole claim; if the manifest ever starts
      //     importing the filters, the fixture becomes another instrument
      //     that cannot be surprised.
      const manifest = JSON.parse(readFileSync(path.join(ROOT, 'conformance/MANIFEST.json'), 'utf8')) as {
        count: number;
        byExpectation: Record<string, number>;
        cases: Array<{ id: string; expect: string; expectName: string; observable: { channel: string } }>;
      };
      const caseDirs = readdirSync(path.join(ROOT, 'conformance/cases'), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
      if (manifest.count !== caseDirs.length || manifest.cases.length !== caseDirs.length) {
        throw new Error(`MANIFEST.json is stale: ${manifest.count} entries vs ${caseDirs.length} case directories — run npm run conformance:build`);
      }
      for (const src of ['conformance/build.ts', 'conformance/run.ts', 'conformance/report.ts']) {
        const text = readFileSync(path.join(ROOT, src), 'utf8');
        // The engine's own filters, by name. Mentioning them in PROSE is the
        // point (the doc comments explain why they are excluded); IMPORTING
        // them would make the denominator derived.
        const imports = text.split('\n').filter((l) => /^\s*import\b/.test(l)).join('\n');
        for (const forbidden of ['extract/computed/lib', 'extract/computed/fuse', 'extract/computed/gate', 'contract-schema', 'core/emit-']) {
          if (imports.includes(forbidden)) {
            throw new Error(`${src} imports "${forbidden}" — THE MANIFEST IS THE DENOMINATOR and must not be derived from the filter that decides carriage (isFusable / styled / DECLARED_CHANNELS / CHANNEL_TO_COMPUTED / TOKEN_CHANNELS / carriedParts)`);
          }
        }
      }

      // 3 · THE CLOSED VOCABULARY. There is no fifth expectation value, and
      //     UNSUPPORTED is not a free pass — it must still be NAMED.
      const VOCAB = ['CARRIED', 'LOWERED', 'REFUSED', 'UNSUPPORTED'];
      for (const c of manifest.cases) {
        if (!VOCAB.includes(c.expect)) throw new Error(`${c.id}: expect "${c.expect}" is outside the closed vocabulary`);
        if (c.expect !== 'CARRIED' && !c.expectName) throw new Error(`${c.id}: ${c.expect} with no expectName — UNSUPPORTED is not a free pass`);
        if (!c.observable?.channel) throw new Error(`${c.id}: no observable channel — nothing to measure`);
      }

      // 4 · THE RATCHET. The UNSUPPORTED count is a committed number that may
      //     only DECREASE without an explicit manifest edit.
      const base = JSON.parse(readFileSync(path.join(ROOT, 'conformance/BASELINE.json'), 'utf8')) as {
        counts: Record<string, number>;
        unsupportedDeclared: number;
        verdicts: Record<string, string>;
      };
      const declaredUnsupported = manifest.byExpectation.UNSUPPORTED;
      if (declaredUnsupported > base.unsupportedDeclared) {
        throw new Error(`UNSUPPORTED ratchet: ${base.unsupportedDeclared} → ${declaredUnsupported}. A construct moving INTO "never modelled" widens the hole and must be argued for, not defaulted into.`);
      }
      if (Object.keys(base.verdicts).length !== manifest.count) {
        throw new Error(`BASELINE.json covers ${Object.keys(base.verdicts).length} cases, the manifest has ${manifest.count} — every case must have a recorded verdict`);
      }

      // 5 · THE REPORT IS GENERATED, NOT ASSERTED, and it agrees with the
      //     measurement it claims to describe. (docs/FIGMA-CAPABILITY-MATRIX.md
      //     is the counter-example this replaces: 355 asserted lines that
      //     nothing reads and nothing checks.)
      const expectations = readFileSync(path.join(ROOT, 'conformance/EXPECTATIONS.md'), 'utf8');
      const reds = ['SILENT-LOSS', 'RUN-ABORTED', 'UNDECLARED-CARRY', 'WRONG-NAME', 'UNMEASURED'].reduce(
        (n, v) => n + (base.counts[v] ?? 0),
        0,
      );
      for (const claim of [
        `| cases | **${manifest.count}** |`,
        `| 🟢 pass | **${base.counts.PASS}** |`,
        `| 🔴 red | **${reds}** |`,
        `| 🟡 yellow (UNSUPPORTED, never read) | **${base.counts['UNMEASURED-YELLOW']}** |`,
      ]) {
        if (!expectations.includes(claim)) {
          throw new Error(`conformance/EXPECTATIONS.md is stale — it does not carry "${claim}". Run npm run conformance:report`);
        }
      }
      const matrix = readFileSync(path.join(ROOT, 'docs/FIGMA-CAPABILITY-MATRIX.md'), 'utf8');
      if (!matrix.includes('conformance/EXPECTATIONS.md')) {
        throw new Error('docs/FIGMA-CAPABILITY-MATRIX.md does not point at the GENERATED capability matrix — a hand-asserted matrix that outlives a measured one is how the fiction restarts');
      }

      // 6 · THE FIXTURE MUST NOT LAUNDER ITS OWN SILENCE. Not one case class
      //     may contain a CSS channel name: a part signature spelled
      //     `root(div|filter-blur)` in the LEDGER would satisfy a search for
      //     "filter" and turn a silent loss into a PASS. (This eval caught
      //     exactly that: 8 of the first run's "passes" were the engine
      //     echoing the case's own name back at the gate.)
      for (const dir of caseDirs) {
        const tsx = readFileSync(path.join(ROOT, 'conformance/cases', dir, 'Case.tsx'), 'utf8');
        for (const m of tsx.matchAll(/className="([^"]*)"/g)) {
          for (const cls of m[1].split(/\s+/).filter(Boolean)) {
            if (!/^cf-(root|a|b|c)$/.test(cls)) {
              throw new Error(`conformance/cases/${dir}/Case.tsx uses class "${cls}" — case classes must be NEUTRAL (cf-root / cf-a / cf-b / cf-c) and cases scoped by data-cf, or the class name reaches the anatomy signature and the fixture launders its own silence`);
            }
          }
        }
        if (!tsx.includes(`data-cf="${dir}"`)) {
          throw new Error(`conformance/cases/${dir}/Case.tsx does not scope itself with data-cf="${dir}" — every case shares one stylesheet`);
        }
      }

      console.log(
        `css-dom-conformance-frontier: ${manifest.count} labelled CSS/DOM cases through the UNMODIFIED extract/computed pipeline as a real library — ` +
          `${base.counts.PASS} green, ${reds} red, ${base.counts['UNMEASURED-YELLOW']} yellow, and the frontier is PINNED both ways (a new red is a regression, a fixed red must be re-recorded). ` +
          `The denominator is a hand-authored manifest that imports none of isFusable/styled/DECLARED_CHANNELS/CHANNEL_TO_COMPUTED/TOKEN_CHANNELS/carriedParts — the independence that makes a construct the filters never opened FAILABLE instead of absent. ` +
          `UNSUPPORTED ratchet at ${base.unsupportedDeclared} (decrease-only), EXPECTATIONS.md generated and agreeing, and no case class carries a CSS channel name (the leak that turned 8 first-run silences into passes).`,
      );
    },
  },
  {
    // ---- SCOPE INDEPENDENCE (task #45): A COMPONENT'S ARTIFACTS MAY NOT
    // CONTAIN ANOTHER COMPONENT'S FACTS.
    //
    // The defect this pins: `extract/computed/run.ts` spliced the run-wide
    // read-boundary accumulators (`SweepResult.textFillFolds` /
    // `.closedShadowSuspects`) into EVERY component's `frontierReceipts` and
    // into every component's LEDGER.md. Capturing `--component Button` alone
    // therefore produced DIFFERENT BYTES for Button than capturing Button
    // inside the full-library sweep — measured on Carbon, where all ten
    // components carried the same 380 lines and MUI, where all fourteen
    // carried the same 80. "The same component yields different bytes
    // depending on which siblings ran" contradicts the determinism claim this
    // whole project rests on, and it is why `onboard` had to default to
    // whole-library sweeps.
    //
    // The property is checkable OFFLINE and without Chromium, because every
    // capture-scoped receipt in this pipeline embeds its capture key and every
    // capture key is `${component}:${combo}__${interaction}`. So: no committed
    // artifact of component X may quote a capture key belonging to component
    // Y. That is exactly what a leak looks like, and it is what this asserts —
    // over BOTH serializations of the receipts (enriched.extension.json and
    // the human-facing LEDGER.md), because the bug was reported against the
    // ledger and found in the JSON.
    //
    // The BYTE-IDENTITY half of the proof (capture one component alone,
    // capture it inside its library, diff the artifacts) needs a harness run
    // and a browser; it is run by hand per round and recorded in
    // examples/tailwind/PROVENANCE.md. This pin is the part that can run in
    // the suite, and it would have failed loudly on every Carbon and MUI
    // component at HEAD.
    id: 'capture-scope-independence',
    claim: 'C1-determinism',
    run: () => {
      const cfgDir = path.join(ROOT, 'extract/computed/configs');
      // The component-name universe comes from the CONFIGS, not from the
      // artifacts — so a leak cannot hide by also being missing from the
      // corpus.
      const namesByConfig = new Map<string, string[]>();
      for (const f of readdirSync(cfgDir).filter((x) => x.endsWith('.json')).sort()) {
        const cfg = JSON.parse(readFileSync(path.join(cfgDir, f), 'utf8')) as { components?: Array<{ name: string }> };
        namesByConfig.set(f, (cfg.components ?? []).map((c) => c.name));
      }
      const allNames = [...new Set([...namesByConfig.values()].flat())];
      if (allNames.length < 20) throw new Error(`only ${allNames.length} configured component names found — the scan universe is too small to prove anything`);

      const outRoot = path.join(ROOT, 'extract/computed/out');
      const dirs: string[] = [];
      (function walk(d: string): void {
        for (const f of readdirSync(d)) {
          const p = path.join(d, f);
          if (!statSync(p).isDirectory()) continue;
          if (existsSync(path.join(p, 'enriched.extension.json'))) dirs.push(p);
          else walk(p);
        }
      })(outRoot);
      if (dirs.length < 40) throw new Error(`only ${dirs.length} committed component output dirs found — expected the whole corpus`);

      const leaks: string[] = [];
      let receiptLines = 0;
      let scanned = 0;
      for (const dir of dirs) {
        const ext = JSON.parse(readFileSync(path.join(dir, 'enriched.extension.json'), 'utf8')) as {
          generatedBy?: string; frontierReceipts?: string[];
        };
        // whose component is this? the capture-key prefix is the component
        // NAME (not the lower-cased directory), so resolve it by matching the
        // directory stem against the configured names.
        const stem = path.basename(dir);
        const mine = allNames.filter((n) => n.toLowerCase() === stem);
        if (mine.length === 0) continue; // depth/conformance fixtures — not config components
        scanned++;
        const others = allNames.filter((n) => n.toLowerCase() !== stem);
        const bodies: Array<[string, string]> = [
          ['enriched.extension.json', (ext.frontierReceipts ?? []).join('\n')],
        ];
        const ledger = path.join(dir, 'LEDGER.md');
        if (existsSync(ledger)) bodies.push(['LEDGER.md', readFileSync(ledger, 'utf8')]);
        receiptLines += (ext.frontierReceipts ?? []).length;
        for (const [file, body] of bodies) {
          for (const other of others) {
            // a capture key: `Name:` immediately followed by a combo key.
            // Anchored on the receipt grammar so ordinary prose naming a
            // sibling component cannot false-positive.
            const re = new RegExp(`(?:^|[\\s@])${other}:[A-Za-z0-9]`, 'm');
            if (re.test(body)) {
              leaks.push(`${path.relative(ROOT, dir)}/${file} quotes a CAPTURE KEY of "${other}"`);
            }
          }
        }
      }
      if (scanned < 40) throw new Error(`only ${scanned} of ${dirs.length} output dirs resolved to a configured component — the resolver is broken, so a green result would prove nothing`);
      if (leaks.length > 0) {
        throw new Error(
          `CAPTURE SCOPE LEAK — ${leaks.length} artifact(s) carry another component's capture keys, so the bytes they contain depend on which SIBLINGS were in the run (task #45):\n  ${leaks.slice(0, 12).join('\n  ')}`,
        );
      }
      console.log(
        `capture-scope-independence: ${scanned} committed component output dirs (${receiptLines} frontier receipt lines, plus every LEDGER.md) contain ZERO capture keys belonging to another of the ${allNames.length} configured components — a component's artifacts are a function of that component alone, not of which siblings shared the sweep. At HEAD this failed on all 10 Carbon components (380 leaked lines each) and all 14 MUI components (80 each).`,
      );
    },
  },
  {
    // ---- A CAPTURE MAY NOT READ ITS OWN PROMOTE OUTPUT (task #43).
    //
    // Astryx's capture config pointed at `examples/astryx/contracts/` — the
    // directory `promote` WRITES. So each round captured from the previous
    // round's result: a feedback loop, not a measurement. The damage was
    // already in the shipped artifacts and visible in one grep — the
    // FLOOR-PROMOTED and COMPUTED-ENRICHED provenance sentences appear TWICE
    // in button/badge/slider, once in card, and zero times in switch, which
    // had never promoted at all. Five components in three different states,
    // which is what "not idempotent" looks like when it reaches disk.
    //
    // The invariant is one line and it holds for every library: a seed is a
    // FROZEN INPUT. Six of seven configs already obeyed it by convention
    // (contracts-seed/ or extraction/static-contracts/); nothing enforced it,
    // so the seventh drifted silently for several rounds.
    id: 'capture-seeds-are-not-promote-output',
    claim: 'C1-determinism',
    run: () => {
      const cfgDir = path.join(ROOT, 'extract/computed/configs');
      const files = readdirSync(cfgDir).filter((f) => f.endsWith('.json')).sort();
      if (files.length < 7) throw new Error(`only ${files.length} capture configs found — the scan universe is too small`);

      const offenders: string[] = [];
      let checked = 0;
      for (const f of files) {
        const cfg = JSON.parse(readFileSync(path.join(cfgDir, f), 'utf8')) as { components?: Array<{ name: string; contract?: string }> };
        for (const c of cfg.components ?? []) {
          if (!c.contract) continue;
          checked++;
          // `promote` writes to <exampleDir>/contracts/. A seed path whose
          // directory is exactly that is the feedback loop. `contracts-seed/`
          // and `extraction/static-contracts/` are frozen inputs and fine —
          // matched on the path SEGMENT so `contracts-seed` cannot be read as
          // `contracts`.
          const segments = c.contract.split('/');
          const dirSegment = segments[segments.length - 2];
          if (dirSegment === 'contracts') offenders.push(`${f}: ${c.name} → ${c.contract}`);
        }
      }
      if (offenders.length > 0) {
        throw new Error(
          `A CAPTURE CONFIG READS ITS OWN PROMOTE OUTPUT — the round-trip is a feedback loop, not a measurement (task #43):\n  ${offenders.join('\n  ')}\n` +
            `  Move the seed to <example>/contracts-seed/ (a frozen copy of the static extraction) and repoint the config.`,
        );
      }

      // The seeds must also BE seeds: stub anatomy, not a promoted result.
      // A frozen copy of a promoted contract would satisfy the path rule
      // above while reintroducing the same compounding.
      const promoted: string[] = [];
      for (const f of files) {
        const cfg = JSON.parse(readFileSync(path.join(cfgDir, f), 'utf8')) as { components?: Array<{ name: string; contract?: string }> };
        for (const c of cfg.components ?? []) {
          if (!c.contract) continue;
          const abs = path.join(ROOT, c.contract);
          if (!existsSync(abs)) continue;
          const seed = JSON.parse(readFileSync(abs, 'utf8')) as { description?: string };
          const d = seed.description ?? '';
          if (d.includes('FLOOR-PROMOTED') || d.includes('COMPUTED-ENRICHED')) {
            promoted.push(`${f}: ${c.name} → ${c.contract} carries a promotion/enrichment sentence`);
          }
        }
      }
      if (promoted.length > 0) {
        throw new Error(
          `A SEED IS A PROMOTED CONTRACT — freezing the output does not stop the compounding, it only hides it (task #43):\n  ${promoted.join('\n  ')}`,
        );
      }

      console.log(
        `capture-seeds-are-not-promote-output: ${checked} seed reference(s) across ${files.length} capture configs, ZERO pointing at a \`contracts/\` directory (what promote writes) and ZERO carrying a FLOOR-PROMOTED / COMPUTED-ENRICHED sentence. At HEAD astryx failed both halves: all 5 of its components read \`examples/astryx/contracts/\`, and the shipped result showed it — the provenance sentence appears TWICE in button/badge/slider, once in card, and switch had never promoted at all. Six libraries obeyed this by convention; nothing enforced it, which is why the seventh could drift for rounds without a single gate noticing.`,
      );
    },
  },
  {
    // ---- EVERY TARGET REFUSES AN UNDEFINED TOKEN (task #47).
    //
    // "The tool refuses rather than guesses" was true on three of four
    // registered targets. The web-components emitter had NO token inventory in
    // its ctx at all, so a contract referencing a token that does not exist
    // compiled cleanly and shipped `var(--p-does-not-exist)` — a dangling
    // custom property that renders as NOTHING at runtime, silently, on one
    // target only. A guarantee with an exception is not a guarantee.
    //
    // The fix deliberately reuses `generateCss`'s checker rather than writing
    // a second one: two targets that disagree about whether a contract is
    // valid would be worse than one that never checked.
    id: 'emitters-refuse-undefined-tokens',
    claim: 'C2-refusal',
    run: () => {
      const contract = JSON.parse(readFileSync(path.join(ROOT, 'contracts/badge.contract.json'), 'utf8')) as SchemaContract;
      const inventory = tokenInventoryFromJson([
        JSON.parse(readFileSync(path.join(ROOT, 'tokens/primitives.tokens.json'), 'utf8')),
        JSON.parse(readFileSync(path.join(ROOT, 'tokens/semantic.tokens.json'), 'utf8')),
        JSON.parse(readFileSync(path.join(ROOT, 'tokens/modes/semantic.light.tokens.json'), 'utf8')),
        JSON.parse(readFileSync(path.join(ROOT, 'tokens/modes/semantic.dark.tokens.json'), 'utf8')),
      ]);
      const icons = new Map<string, string>();
      const contracts = new Map<string, SchemaContract>([[contract.id, contract]]);

      // CONTROL: the real contract against the real inventory must EMIT.
      // Without this the assertions below would also pass if the emitter
      // refused everything.
      wcEmit(contract, { icons, contracts, tokens: inventory });

      // The poisoned twin — one root token ref repointed at a path that is not
      // in any tree. Everything else is identical.
      const poisoned = JSON.parse(JSON.stringify(contract)) as SchemaContract;
      const rootTokens = (poisoned.anatomy as Record<string, { tokens?: Record<string, string> }>).root?.tokens;
      const firstChannel = rootTokens ? Object.keys(rootTokens)[0] : undefined;
      if (!rootTokens || !firstChannel) throw new Error('contracts/badge.contract.json has no anatomy.root.tokens — this eval cannot poison a ref it cannot find');
      rootTokens[firstChannel] = '{p.this-token-does-not-exist}';

      let refused = '';
      try {
        wcEmit(poisoned, { icons, contracts: new Map([[poisoned.id, poisoned]]), tokens: inventory });
      } catch (e) {
        refused = (e as Error).message;
      }
      if (!refused) throw new Error('the web-components emitter EMITTED a contract referencing a token that does not exist — it would ship a dangling var(--…) that renders as nothing');
      if (!refused.includes('p.this-token-does-not-exist')) throw new Error(`the refusal does not name the offending token:\n${refused}`);

      // And the absence of an inventory is itself a refusal, not a pass —
      // otherwise any caller could opt out of the check by omitting a field.
      let noInventory = '';
      try {
        wcEmit(contract, { icons, contracts });
      } catch (e) {
        noInventory = (e as Error).message;
      }
      if (!noInventory.includes('no token inventory was supplied')) throw new Error(`omitting the inventory must refuse by name, not emit unchecked. Got: ${noInventory || '(no error — it emitted)'}`);

      // The registered target must supply the inventory itself, so a CLI user
      // gets the check without knowing it exists.
      const adapter = readFileSync(path.join(ROOT, 'packages/emitter-web-components/src/index.ts'), 'utf8');
      if (!adapter.includes('tokenInventoryFromJson(')) throw new Error('packages/emitter-web-components/src/index.ts no longer builds an inventory — the registered target would emit unchecked even though the underlying function can check');

      console.log(
        `emitters-refuse-undefined-tokens: all 4 registered targets now refuse a token that is not in the inventory. The web-components target had NO inventory in its ctx (task #47) and shipped \`var(--…)\` for any ref — proven here by poisoning ONE root channel of contracts/badge.contract.json and requiring the refusal to NAME "p.this-token-does-not-exist", with the unpoisoned contract emitting as a control. Omitting the inventory entirely is also a named refusal, so the check cannot be opted out of by leaving a field undefined, and the registered adapter builds the inventory itself. It reuses generateCss's checker rather than a second implementation — two targets disagreeing about validity is worse than one that never checked.`,
      );
    },
  },
  {
    // ---- MOUNT SANITY (task #48): DID THE CAPTURE MOUNT THE COMPONENT, OR
    // SOMETHING ELSE?
    //
    // The beta trap this closes: point the capture at a component that needs a
    // trigger (Popover, Dropdown, Menu) with no open state configured and the
    // harness renders the ACTIVATOR. Nothing throws. A "Popover contract"
    // ships describing a button — a plausible artifact, which is why it is
    // dangerous.
    //
    // THIS EVAL IS THE FALSE-POSITIVE PROOF. The check refuses two components
    // whose captures are indistinguishable, so its whole cost is borne by
    // legitimate components that happen to look alike. The conformance fixture
    // is the adversarial input for that: 50 cases that are deliberately
    // near-identical single-div documents. Weaker fingerprints were measured
    // and rejected on it — structure alone collides 41 times, structure plus
    // channel NAMES collides 17 times. The shipped fingerprint (structure plus
    // channel names plus VALUES) collides zero times across all 104 captured
    // components, fixture included.
    //
    // It also pins the CALL SITE, because a check nothing calls is a comment.
    id: 'mount-sanity',
    claim: 'C2-refusal',
    run: () => {
      const outRoot = path.join(ROOT, 'extract/computed/out');
      const chainOf = (dir: string): string | null => {
        const p = path.join(dir, 'LEDGER.md');
        if (!existsSync(p)) return null;
        const m = /- rendered anatomy: (.*)$/m.exec(readFileSync(p, 'utf8'));
        return m ? [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]).join(' → ') : null;
      };
      // Grouped by LIBRARY, because the check is per-run: two libraries'
      // components never share a sweep, so a cross-library match is not a
      // collision and counting it as one would be a fabricated finding.
      const groups = new Map<string, MountRow[]>();
      const collect = (dir: string, label: string): void => {
        for (const d of readdirSync(dir)) {
          const cd = path.join(dir, d);
          if (!statSync(cd).isDirectory()) continue;
          const cf = ['resolved.contract.json', 'enriched.contract.json'].map((f) => path.join(cd, f)).find(existsSync);
          const sigChain = chainOf(cd);
          if (!cf || sigChain === null) continue;
          const anatomy = (JSON.parse(readFileSync(cf, 'utf8')) as { anatomy?: unknown }).anatomy;
          (groups.get(label) ?? groups.set(label, []).get(label)!).push({ name: d, sigChain, anatomy });
        }
      };
      const libDirs = readdirSync(outRoot).filter((d) => statSync(path.join(outRoot, d)).isDirectory());
      for (const d of libDirs) collect(path.join(outRoot, d), d);
      collect(outRoot, 'polaris');

      const total = [...groups.values()].reduce((n, g) => n + g.length, 0);
      if (total < 90) throw new Error(`only ${total} captured components found — too few to prove the fingerprint does not collide`);
      const fixture = groups.get('conformance')?.length ?? 0;
      if (fixture < 40) throw new Error(`the conformance fixture contributed only ${fixture} components — it IS the adversarial input for this check; without it the zero below proves much less`);

      const findings = [...groups.entries()].flatMap(([lib, rows]) => mountSanity(rows).map((f) => `${lib}: ${f.components[1]} == ${f.components[0]}`));
      if (findings.length > 0) {
        throw new Error(
          `MOUNT COLLISION — ${findings.length} pair(s) of components produced identical captures, so at least one mounted the other (task #48):\n  ${findings.join('\n  ')}`,
        );
      }

      // THE TRUE-POSITIVE HALF. Everything above proves the check does not
      // fire when it should not. On its own that is also what a function
      // returning `[]` unconditionally would prove. So: replay the actual
      // failure — Popover captured with no open state renders its activator,
      // which IS the Button — using two real committed captures.
      const real = [...groups.values()].flat();
      const button = real.find((r) => r.name === 'button');
      if (!button) throw new Error('no committed `button` capture to build the wrong-mount replay from');
      const popoverThatMountedTheButton: MountRow = { name: 'popover', sigChain: button.sigChain, anatomy: button.anatomy };
      const fired = mountSanity([button, popoverThatMountedTheButton]);
      if (fired.length !== 1) throw new Error(`the check did NOT fire on a component whose capture is byte-for-byte another component's — it found ${fired.length} collision(s), so every zero above is meaningless`);
      if (fired[0].name !== 'mount-collision') throw new Error(`the finding is named "${fired[0].name}" — the refusal name is what a person greps for and it must be stable`);
      if (!fired[0].message.includes('popover') || !fired[0].message.includes('button')) throw new Error(`the finding must NAME BOTH components; got: ${fired[0].message}`);

      // The call site. Without this the function above could be deleted from
      // run.ts and every number here would stay green.
      const runSrc = readFileSync(path.join(ROOT, 'extract/computed/run.ts'), 'utf8');
      for (const needle of ['mountSanity(mountRows)', 'mountRows.push(', 'process.exitCode = 1']) {
        if (!runSrc.includes(needle)) throw new Error(`extract/computed/run.ts no longer contains \`${needle}\` — the mount-sanity check is not wired into the capture run, so it protects nothing a user would hit`);
      }

      // The advisory half, exercised on its own vocabulary rather than
      // asserted: it must fire on a bare disclosure prop and stay silent once
      // the config drives the open state.
      if (disclosureAdvisory('Popover', ['active', 'activator'], {}) === null) throw new Error('disclosureAdvisory stayed silent on a component declaring BOTH `active` and `activator` with nothing driving them');
      if (disclosureAdvisory('Tooltip', ['open'], { openDriver: { open: true } }) !== null) throw new Error('disclosureAdvisory fired on a component whose config DOES drive the open state — that is a false positive at the review gate');
      if (disclosureAdvisory('Button', ['variant', 'size', 'disabled'], {}) !== null) throw new Error('disclosureAdvisory fired on an ordinary component — `disabled` is a state axis, not a disclosure');

      console.log(
        `mount-sanity: ${total} captured components across ${groups.size} libraries — including the ${fixture}-case conformance fixture, whose near-identical single-div documents collide 41 times under a structure-only fingerprint and 17 times under structure+channel-names — produce ${total} DISTINCT captures under the shipped fingerprint. Zero collisions, so the check that refuses "this contract describes a different component" costs no legitimate component anything — and the TRUE-POSITIVE half is proven in the same breath rather than assumed: replaying the actual failure (a "popover" row carrying the committed button capture verbatim, which is exactly what a trigger-required component with no open state produces) fires exactly one \`mount-collision\` naming both components. The refusal is wired into extract/computed/run.ts at run level (never per-component: writing it into a component's own directory would make its bytes depend on which siblings shared the sweep, which capture-scope-independence proves they do not). KNOWN GAP, not papered over: the collision only fires when the thing mounted INSTEAD is also a configured component.`,
      );
    },
  },
  {
    // ---- ORPHANED MINTED LEAVES (task #42): THE SHIPPED TOKEN SET MAY NOT
    // GROW VARIABLES NOTHING BINDS.
    //
    // Every library's `tokens/<lib>-minted.dtcg.json` becomes real Figma
    // variables — `00-tokens.figma.js` creates one per leaf, and the pasted
    // `<lib>.bundle.json` carries the whole tree. A leaf no contract
    // references is therefore a variable the user imports and nothing uses.
    //
    // TWO DISTINCT CAUSES, and this pin separates them because they have
    // different remedies:
    //
    //   A. THE PART DOES NOT EXIST. The anatomy promotion refused the part by
    //      name (`non-painting-part`, `inert-overlay-wrapper`, …) and the mint
    //      went on minting its channels anyway. A leaf that exists because of
    //      a part that does not is the same class of lie as the phantom part,
    //      so it is now refused AT THE MINT DOOR (fuse.ts `mintablePart`).
    //      This half is asserted at ZERO — a hard failure, not a ratchet.
    //
    //   B. THE BINDING WAS DROPPED DOWNSTREAM. The part is real and the mint
    //      is real, but `applyMintToContract` did not bind it — the
    //      inheritance-aware refusal proved the child carries no independent
    //      fact, a reviewed binding won the collision, or it went to
    //      overflowBindings. The leaf is honest; it is just unreferenced.
    //      Removing these is a LIBRARY-LEVEL sweep (the reference set spans
    //      every contract — mui's table-pagination binds `imported.pagination.*`),
    //      so it belongs in the minted MERGE in packages/cli/src/promote.ts,
    //      beside `resolutionGuard`, which already computes exactly this
    //      reference set in the other direction. Not done in this round; the
    //      count is RATCHETED here instead of going unrecorded.
    id: 'minted-leaves-bind-to-something',
    claim: 'C2-refusal',
    run: () => {
      const isLeaf = (v: unknown): v is { $value: unknown } => !!v && typeof v === 'object' && '$value' in (v as object);
      const leafPaths = (t: Record<string, unknown>, p: string[] = [], o = new Set<string>()): Set<string> => {
        for (const [k, v] of Object.entries(t)) {
          if (isLeaf(v)) o.add([...p, k].join('.'));
          else if (v && typeof v === 'object') leafPaths(v as Record<string, unknown>, [...p, k], o);
        }
        return o;
      };
      // ---- half A: NOTHING may mint under a part the promotion refused ----
      const outRoot = path.join(ROOT, 'extract/computed/out');
      const compDirs: string[] = [];
      (function walk(d: string): void {
        for (const f of readdirSync(d)) {
          const q = path.join(d, f);
          if (!statSync(q).isDirectory()) continue;
          if (existsSync(path.join(q, 'enriched.extension.json'))) compDirs.push(q);
          else walk(q);
        }
      })(outRoot);
      const kebabPart = (n: string) => n.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
      const phantom: string[] = [];
      for (const d of compDirs) {
        const ext = JSON.parse(readFileSync(path.join(d, 'enriched.extension.json'), 'utf8')) as {
          mintedTokens?: Record<string, unknown>;
          anatomyPromotion?: { partsCarried?: string[] };
        };
        const carried = new Set((ext.anatomyPromotion?.partsCarried ?? []).map(kebabPart));
        for (const leaf of leafPaths(ext.mintedTokens ?? {})) {
          const seg = leaf.split('.');
          if (seg[0] !== 'imported' || seg.length < 4) continue;
          if (!carried.has(seg[2])) phantom.push(`${path.relative(ROOT, d)}: ${leaf} (part "${seg[2]}" is NOT in the promoted anatomy)`);
        }
      }
      if (phantom.length > 0) {
        throw new Error(
          `PHANTOM MINTED LEAVES — ${phantom.length} leaf/leaves are minted under a part the anatomy promotion REFUSED, so the shipped token set carries Figma variables for parts that do not exist (task #42, cause A — the mint door in fuse.ts is not holding):\n  ${phantom.slice(0, 10).join('\n  ')}`,
        );
      }
      // ---- half B: the unreferenced-leaf RATCHET, per library ----
      const BASELINE = path.join(ROOT, 'extract/computed/minted-orphan-baseline.json');
      const rows: Array<{ library: string; leaves: number; unreferenced: number }> = [];
      for (const lib of readdirSync(path.join(ROOT, 'examples')).sort()) {
        const tokDir = path.join(ROOT, 'examples', lib, 'tokens');
        const cDir = path.join(ROOT, 'examples', lib, 'contracts');
        if (!existsSync(tokDir) || !existsSync(cDir)) continue;
        const mf = readdirSync(tokDir).find((f) => f.includes('minted') && f.endsWith('.json'));
        if (!mf) continue;
        const leaves = leafPaths(JSON.parse(readFileSync(path.join(tokDir, mf), 'utf8')) as Record<string, unknown>);
        const referenced = new Set<string>();
        for (const f of readdirSync(cDir).filter((x) => x.endsWith('.contract.json'))) {
          const c = JSON.parse(readFileSync(path.join(cDir, f), 'utf8')) as { props?: Array<{ name: string; type?: { enum?: string[] } }> };
          const enums: Record<string, string[]> = {};
          for (const pr of c.props ?? []) if (pr.type?.enum) enums[pr.name] = pr.type.enum;
          const expand = (ref: string): string[] => {
            let refs = [ref];
            for (const [prop, vals] of Object.entries(enums)) {
              if (!ref.includes(`{${prop}}`)) continue;
              refs = refs.flatMap((r) => vals.map((v) => r.replaceAll(`{${prop}}`, v)));
            }
            return refs;
          };
          for (const m of JSON.stringify(c).matchAll(/"\{(imported\.[^"]+)\}"/g)) for (const r of expand(m[1])) referenced.add(r);
        }
        rows.push({ library: lib, leaves: leaves.size, unreferenced: [...leaves].filter((l) => !referenced.has(l)).length });
      }
      if (rows.length < 5) throw new Error(`only ${rows.length} libraries measured — the scan is broken`);
      if (process.argv.includes('--write-orphan-baseline')) {
        writeFileSync(BASELINE, JSON.stringify({ _marker: 'UNREFERENCED MINTED LEAVES per library — a DECREASE-ONLY ratchet (task #42, cause B). Re-record with `npm run eval -- --only minted-leaves --write-orphan-baseline` as part of a reviewed change.', rows }, null, 2) + '\n');
      }
      const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as { rows: typeof rows };
      const worse: string[] = [];
      const better: string[] = [];
      for (const r of rows) {
        const b = baseline.rows.find((x) => x.library === r.library);
        if (!b) { worse.push(`${r.library}: NO BASELINE ROW — a new library must record one`); continue; }
        if (r.unreferenced > b.unreferenced) worse.push(`${r.library}: ${b.unreferenced} → ${r.unreferenced} unreferenced minted leaves (GREW)`);
        if (r.unreferenced < b.unreferenced) better.push(`${r.library}: ${b.unreferenced} → ${r.unreferenced}`);
      }
      if (worse.length > 0) {
        throw new Error(`the shipped token sets grew variables nothing binds (task #42):\n  ${worse.join('\n  ')}`);
      }
      if (better.length > 0) {
        throw new Error(`the ratchet IMPROVED and was not re-recorded — an unrecorded win is as much drift as a loss:\n  ${better.join('\n  ')}\nRe-record with: npm run eval -- --only minted-leaves --write-orphan-baseline`);
      }
      const totalLeaves = rows.reduce((n, r) => n + r.leaves, 0);
      const totalUnref = rows.reduce((n, r) => n + r.unreferenced, 0);
      console.log(
        `minted-leaves-bind-to-something: ZERO of ${totalLeaves} shipped minted leaves across ${rows.length} libraries sit under a part the anatomy promotion refused (cause A — the mint door holds; before it, carbon/IconButton alone minted 112 such leaves under \`popover\`/\`label\`/\`popover-caret\`). ` +
          `The residual ${totalUnref} unreferenced leaves are cause B — real parts whose BINDING was dropped downstream (inheritance refusal, reviewed-binding collision, overflow) — ratcheted decrease-only per library: ${rows.map((r) => `${r.library} ${r.unreferenced}/${r.leaves}`).join(', ')}. Removing them is a library-level sweep that belongs beside promote.ts's resolutionGuard; it is NAMED and COUNTED here rather than left to accumulate.`,
      );
    },
  },

  {
    // V1-EVID-04 live half — machine receipt for edit→detect→restore on a real
    // Figma file. Offline half stays variant-drift:check. Console MCP replay
    // scripts under parity/receipts/console-mcp/ are transport docs, not this pin.
    id: 'live-figma-evidence-receipt',
    claim: 'C3-detection',
    run: () => {
      const r = spawnSync(process.execPath, ['scripts/live-figma-evidence-check.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      if ((r.status ?? -1) !== 0) {
        throw new Error(`live-figma-evidence-check failed:\n${out}`);
      }
      if (!out.includes('completed receipt')) {
        throw new Error('live-figma-evidence-check did not report a completed receipt');
      }
      console.log(
        'live-figma-evidence-receipt: committed V1-EVID-04 machine twin proves baseline→detached-edit→restore on DS-Contracts-Testing; offline half remains variant-drift:check',
      );
    },
  },

  {
    // Human/release/second-impl rows must stay listed open — packaging and live
    // receipts must not silently promote to "v1 shipped" or Phase 3 Candidate.
    id: 'human-gate-inventory-honest',
    claim: 'C2-refusal',
    run: () => {
      const r = spawnSync(process.execPath, ['scripts/human-gate-inventory-check.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      if ((r.status ?? -1) !== 0) {
        throw new Error(`human-gates:inventory failed:\n${out}`);
      }
      if (!out.includes('still open')) {
        throw new Error('human-gates:inventory did not report open rows');
      }
      console.log(
        'human-gate-inventory-honest: HUMAN-HANDOFF still lists pilot/Wave8/security/publish/deploy/W11-C/Phase4 and refuses false v1/Candidate claims',
      );
    },
  },

  {
    // Console MCP live loop: contract → chunked figma_execute → screenshot →
    // audit → v6 fingerprint → zero-mismatch light round-trip, receipted under
    // parity/receipts/console-loop/components/ on DS-Contracts-Testing.
    // Evidence semantics: first-party visual claims have no pixel scorecards
    // yet — the gate must exit 0 but print them loudly as ATTESTED-ONLY, and
    // the "first-party" ratchet floor must hold.
    id: 'console-loop-evidence-receipt',
    claim: 'C3-detection',
    run: () => {
      const r = spawnSync(process.execPath, ['scripts/console-loop-evidence-check.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      if ((r.status ?? -1) !== 0) {
        throw new Error(`console-loop-evidence-check failed:\n${out}`);
      }
      if (!out.includes('required ok')) {
        throw new Error('console-loop-evidence-check did not report required ok');
      }
      if (!out.includes('ATTESTED-ONLY')) {
        throw new Error(
          'console-loop-evidence-check must print unscored visual claims as ATTESTED-ONLY (first-party lane has no pixel scorecards yet)',
        );
      }
      if (!out.includes('ratchet floor')) {
        throw new Error('console-loop-evidence-check did not report the ratchet floor check');
      }
      console.log(
        'console-loop-evidence-receipt: first-party receipts pinned; visual claims surfaced as attested-only (no scorecards yet); ratchet floor holds',
      );
    },
  },

  {
    // MUI denominator (31) on MUI Test 1 — same Console MCP loop, foreign corpus.
    // STRICT since 2026-08-08: every stem carries a pixel scorecard
    // (mui/scores/<stem>.json, headless REST cell @1x vs committed developed
    // refs under mui/refs/), so the gate reads scorecards, never receipt
    // booleans — a pass-claim without a passing, hash-pinned scorecard fails
    // the gate by name; honest fail-closed receipts are counted, not failed.
    id: 'console-loop-mui-evidence-receipt',
    claim: 'C3-detection',
    run: () => {
      const r = spawnSync(process.execPath, ['scripts/console-loop-mui-evidence-check.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      if ((r.status ?? -1) !== 0) {
        throw new Error(`console-loop-mui-evidence-check failed:\n${out}`);
      }
      if (!out.includes('31/31')) {
        throw new Error('console-loop-mui-evidence-check did not report 31/31');
      }
      if (out.includes('ATTESTED-ONLY')) {
        throw new Error(
          'console-loop-mui-evidence-check printed ATTESTED-ONLY — the MUI lane is strict; attested claims must be impossible',
        );
      }
      if (!/\d+ scored-pass/.test(out) || !/\d+ fail-closed/.test(out)) {
        throw new Error(
          'console-loop-mui-evidence-check must report scored-pass and fail-closed counts',
        );
      }
      console.log(
        'console-loop-mui-evidence-receipt: MUI DENOMINATOR-50 stems receipted under the STRICT scorecard bar; ratchet floor holds',
      );
    },
  },

  ...(['tailwind', 'altitude', 'astryx', 'carbon', 'polaris'] as const).map((lib) => ({
    // Foreign lanes are STRICT: the gate reads pixel scorecards
    // (scores/<stem>.json, bar pctAAMasked<=5 AND compositionOk), never
    // receipt booleans. Green means: every pass-claim is scorecard-backed and
    // hash-pinned, honest fail-closed receipts (named defects, no claims) are
    // counted without failing CI, and the RATCHET.json floor holds.
    // Red-test: a synthetic receipt claiming a visual pass against a failing
    // scorecard must fail the gate, naming the stem.
    id: `console-loop-${lib}-evidence-receipt`,
    claim: 'C3-detection' as const,
    run: () => {
      const r = spawnSync(
        process.execPath,
        ['scripts/console-loop-lib-evidence-check.mjs', lib],
        { cwd: ROOT, encoding: 'utf8' },
      );
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      if ((r.status ?? -1) !== 0) {
        throw new Error(`console-loop-${lib}-evidence-check failed:\n${out}`);
      }
      if (!out.includes('stems ok')) {
        throw new Error(`console-loop-${lib}-evidence-check did not report stems ok`);
      }
      if (!/\d+ scored-pass/.test(out) || !/\d+ fail-closed/.test(out)) {
        throw new Error(
          `console-loop-${lib}-evidence-check did not report scored-pass / fail-closed counts`,
        );
      }
      if (!out.includes('ratchet floor')) {
        throw new Error(`console-loop-${lib}-evidence-check did not report the ratchet floor check`);
      }

      // Red-test: false pass-claim (matchDeveloped:true, scorecard fail) must be refused.
      const dir = path.join(SCRATCH, `console-loop-red-${lib}`);
      rmSync(dir, { recursive: true, force: true });
      const base = path.join(dir, 'parity', 'receipts', 'console-loop');
      mkdirSync(path.join(base, lib, 'components'), { recursive: true });
      mkdirSync(path.join(base, lib, 'scores'), { recursive: true });
      mkdirSync(path.join(dir, 'scripts'), { recursive: true });
      for (const f of ['console-loop-lib-evidence-check.mjs', 'console-loop-scorecard-lib.mjs']) {
        cpSync(path.join(ROOT, 'scripts', f), path.join(dir, 'scripts', f));
      }
      writeFileSync(
        path.join(base, 'RATCHET.json'),
        `${JSON.stringify({ version: 1, floors: { [lib]: 0 } }, null, 2)}\n`,
      );
      writeFileSync(
        path.join(base, lib, 'manifest.json'),
        `${JSON.stringify({ fileKey: 'FAKEKEY', kind: `console-loop-${lib}-component`, required: ['widget'] }, null, 2)}\n`,
      );
      writeFileSync(
        path.join(base, lib, 'components', 'widget.json'),
        `${JSON.stringify(
          {
            version: 1,
            kind: `console-loop-${lib}-component`,
            status: 'completed',
            component: 'widget',
            fileKey: 'FAKEKEY',
            visual: { ok: true, matchDeveloped: true, defects: [] },
            fingerprint: { v6: 'v6:12345' },
            roundtrip: { mismatches: [] },
            acceptance: { screenshotReviewed: true, zeroMismatch: true, visualMatchDeveloped: true },
          },
          null,
          2,
        )}\n`,
      );
      writeFileSync(
        path.join(base, lib, 'components', 'widget.md'),
        '# widget\nFAKEKEY\nv6:12345\n',
      );
      writeFileSync(
        path.join(base, lib, 'scores', 'widget.json'),
        `${JSON.stringify(
          {
            version: 3,
            status: 'fail',
            passBar: { pctAAMaskedMax: 5, compositionOk: true },
            metrics: { pctAAMasked: 42.5 },
            compositionOk: false,
          },
          null,
          2,
        )}\n`,
      );
      const red = spawnSync(
        process.execPath,
        [path.join(dir, 'scripts', 'console-loop-lib-evidence-check.mjs'), lib],
        { cwd: dir, encoding: 'utf8' },
      );
      const redOut = `${red.stdout ?? ''}${red.stderr ?? ''}`;
      if ((red.status ?? 0) === 0) {
        throw new Error(
          `console-loop-${lib}-evidence-check accepted a false pass-claim (receipt matchDeveloped:true, scorecard fail):\n${redOut}`,
        );
      }
      if (!redOut.includes('widget') || !redOut.includes('contradicts')) {
        throw new Error(
          `console-loop-${lib}-evidence-check refusal did not name the contradicting stem:\n${redOut}`,
        );
      }
      rmSync(dir, { recursive: true, force: true });
      console.log(
        `console-loop-${lib}-evidence-receipt: scorecard-backed passes + honest fail-closed receipts green; false pass-claim refused by name`,
      );
    },
  })),

  // -------------------------------------------------------------------------
  // CODE → CANVAS HILL-CLIMB — Wave A emit pins (FC-* failure classes).
  // Deterministic + browser-free: createFigmaEngine over synthesized fixtures
  // (same shape as checkbox-center). Empty/minimal token trees.
  // -------------------------------------------------------------------------
  {
    id: 'code-to-canvas-wave-a-emit-pins',
    claim: 'C3-detection',
    run: () => {
      const emptyTokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
      const engine = createFigmaEngine({ tokens: emptyTokens, icons: new Map() });
      const find = (s: any, name: string): any =>
        s.name === name ? s : (s.children ?? []).map((c: any) => find(c, name)).find(Boolean);
      const baseAnchors = { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'Fx' } };
      const variantProp = {
        name: 'variant', type: { enum: ['a'] }, default: 'a',
        bindings: { figma: { kind: 'VARIANT', property: 'V' }, code: { prop: 'variant' } },
      };

      // FC-LH-RATIO — unitless ratio 1.4286 → PERCENT 142.86 (not 1.4px clip)
      {
        const fixture: any = {
          id: 'fixture.lh-ratio', name: 'LhRatio', version: '0.0.0', status: 'draft',
          description: 'Wave A FC-LH-RATIO pin', semantics: { element: 'span' },
          props: [variantProp], states: [],
          anatomy: {
            root: {
              layout: { display: 'flex' },
              parts: {
                label: {
                  element: 'span',
                  text: 'Toast body',
                  literals: { 'line-height': '1.4286', 'font-size': '14px' },
                },
              },
            },
          },
          anchors: baseAnchors,
        };
        ContractSchema.parse(fixture);
        const data = engine.compileComponentData(fixture, new Map([[fixture.id, fixture]]));
        const label = find(data.variants[0].spec, 'label');
        if (!label) throw new Error('FC-LH-RATIO: text node missing');
        const lh = label.lineHeight;
        if (!lh || typeof lh !== 'object' || lh.unit !== 'PERCENT') {
          throw new Error(`FC-LH-RATIO: expected PERCENT lineHeight, got ${JSON.stringify(lh)}`);
        }
        if (Math.abs(lh.value - 142.86) > 0.01) {
          throw new Error(`FC-LH-RATIO: expected ~142.86 PERCENT, got ${lh.value}`);
        }
        const script = engine.buildComponentScript(fixture, new Map([[fixture.id, fixture]]));
        if (!script.includes("unit === 'PERCENT'") && !script.includes('PERCENT')) {
          throw new Error('FC-LH-RATIO: emitted runtime missing PERCENT lineHeight handling');
        }
      }

      // FC-PLACEHOLDER — unresolved `{placeholder}` must not paint on canvas
      {
        const fixture: any = {
          id: 'fixture.placeholder', name: 'PlaceholderFx', version: '0.0.0', status: 'draft',
          description: 'Wave A FC-PLACEHOLDER pin', semantics: { element: 'div' },
          props: [
            variantProp,
            {
              name: 'placeholder', type: 'text',
              // intentionally no default — brace form must not leak
              bindings: { figma: { kind: 'TEXT', property: 'Placeholder' }, code: { prop: 'placeholder' } },
            },
          ],
          states: [],
          anatomy: {
            root: {
              layout: { display: 'flex' },
              parts: {
                input: { element: 'input', attrs: { placeholder: '{placeholder}' } },
              },
            },
          },
          anchors: baseAnchors,
        };
        ContractSchema.parse(fixture);
        const data = engine.compileComponentData(fixture, new Map([[fixture.id, fixture]]));
        const input = find(data.variants[0].spec, 'input');
        const ph = (input?.children ?? []).find((c: any) => c.name === 'placeholder');
        if (!ph) throw new Error('FC-PLACEHOLDER: placeholder text child missing');
        if (ph.characters === '{placeholder}' || /\{[a-z][\w-]*\}/.test(String(ph.characters ?? ''))) {
          throw new Error(`FC-PLACEHOLDER: unresolved brace leaked onto canvas: ${JSON.stringify(ph.characters)}`);
        }
        if (ph.characters !== '' && ph.characters != null && String(ph.characters).includes('{')) {
          throw new Error(`FC-PLACEHOLDER: characters still contain braces: ${JSON.stringify(ph.characters)}`);
        }
      }

      // FC-BLOCK-ROW — display:block + layout.align without direction → VERTICAL
      {
        const fixture: any = {
          id: 'fixture.block-row', name: 'BlockRow', version: '0.0.0', status: 'draft',
          description: 'Wave A FC-BLOCK-ROW pin', semantics: { element: 'div' },
          props: [variantProp], states: [],
          anatomy: {
            root: {
              declared: { display: 'block' },
              layout: { align: 'center' },
              parts: {
                label: { element: 'span', text: 'Label' },
                field: { element: 'span', text: 'Field' },
              },
            },
          },
          anchors: baseAnchors,
        };
        ContractSchema.parse(fixture);
        const data = engine.compileComponentData(fixture, new Map([[fixture.id, fixture]]));
        const mode = data.variants[0].spec.layout?.mode;
        if (mode !== 'VERTICAL') {
          throw new Error(`FC-BLOCK-ROW: expected VERTICAL root (block stack), got ${mode} — label would sit beside field`);
        }
      }

      // FC-SLOT-DEFAULT — optional slot Show BOOLEAN defaults false (not true)
      {
        const fixture: any = {
          id: 'fixture.slot-default', name: 'SlotDefault', version: '0.0.0', status: 'draft',
          description: 'Wave A FC-SLOT-DEFAULT pin', semantics: { element: 'div' },
          props: [
            variantProp,
            {
              name: 'body', type: 'text', default: 'Hello',
              bindings: { figma: { kind: 'TEXT', property: 'Body' }, code: { prop: 'body' } },
            },
          ],
          states: [],
          anatomy: {
            root: {
              layout: { display: 'flex', direction: 'row' },
              parts: {
                bodyText: { element: 'span', content: { prop: 'body' } },
                end: {
                  element: 'div',
                  slot: { name: 'endContent' },
                  optional: true,
                },
              },
            },
          },
          anchors: baseAnchors,
        };
        ContractSchema.parse(fixture);
        const script = engine.buildComponentScript(fixture, new Map([[fixture.id, fixture]]));
        if (!script.includes("'BOOLEAN', false") && !script.includes('"BOOLEAN", false')) {
          throw new Error("FC-SLOT-DEFAULT: emitted script missing BOOLEAN', false for optional Show");
        }
        // Show mint sites must default false — never true for optional slots
        const showMintTrue = /Show ' \+ sl\.spec\.slotProperty,\s*'BOOLEAN',\s*true/.test(script)
          || /'Show ' \+ s\.spec\.slotProperty,\s*'BOOLEAN',\s*true/.test(script)
          || /mintOnce\('Show ' \+ s\.spec\.slotProperty,\s*'BOOLEAN',\s*true\)/.test(script);
        if (showMintTrue) {
          throw new Error('FC-SLOT-DEFAULT: optional slot Show defaults to true — dashed Slot chrome would show');
        }
        if (!script.includes("Show ' + sl.spec.slotProperty, 'BOOLEAN', false")
          && !script.includes("mintOnce('Show ' + s.spec.slotProperty, 'BOOLEAN', false)")) {
          throw new Error('FC-SLOT-DEFAULT: Show + BOOLEAN false mint site missing from emitted runtime');
        }
      }

      // FC-ABS-SIZE — applyInsetOverlay keeps fixedW/H (fw != null guard)
      {
        const fixture: any = {
          id: 'fixture.abs-size', name: 'AbsSize', version: '0.0.0', status: 'draft',
          description: 'Wave A FC-ABS-SIZE pin', semantics: { element: 'span' },
          props: [variantProp], states: [],
          anatomy: {
            root: {
              layout: { display: 'flex' },
              parts: {
                track: {
                  element: 'span',
                  declared: { position: 'relative' },
                  literals: { width: '100px', height: '20px' },
                  parts: {
                    // absolute parent-bound overlay WITH fixed size — must emit
                    // applyInsetOverlay + fw!=null guard (aspect-ratio → inset-0)
                    thumb: {
                      element: 'span',
                      declared: { position: 'absolute', 'aspect-ratio': '1 / 1' },
                      literals: { width: '20px', height: '20px' },
                    },
                  },
                },
              },
            },
          },
          anchors: baseAnchors,
        };
        ContractSchema.parse(fixture);
        const script = engine.buildComponentScript(fixture, new Map([[fixture.id, fixture]]));
        if (!script.includes('function applyInsetOverlay')) {
          throw new Error('FC-ABS-SIZE: applyInsetOverlay runtime not emitted (inset overlay missing from compile)');
        }
        if (!script.includes('fw != null')) {
          throw new Error('FC-ABS-SIZE: fixedWidth/fixedHeight guard (fw != null) missing from applyInsetOverlay');
        }
        if (!script.includes('clipsContent = false')) {
          throw new Error('FC-ABS-SIZE: inset/absolute hosts must unclip (clipsContent = false)');
        }
      }

      // FC-ABS-SIZE residual — display:contents parents hoist children (no
      // clipped hug wrapper that half-cuts a fixed-size absolute thumb).
      {
        const fixture: any = {
          id: 'fixture.contents-hoist', name: 'ContentsHoist', version: '0.0.0', status: 'draft',
          description: 'Wave B.4 display:contents hoist pin', semantics: { element: 'div' },
          props: [variantProp], states: [],
          anatomy: {
            root: {
              layout: { display: 'flex' },
              literals: { width: '100px', height: '20px' },
              parts: {
                wrapper: {
                  element: 'div',
                  declared: { display: 'contents' },
                  parts: {
                    thumb: {
                      element: 'span',
                      declared: { position: 'absolute' },
                      literals: { width: '20px', height: '20px', left: '10px', top: '0px' },
                    },
                  },
                },
              },
            },
          },
          anchors: baseAnchors,
        };
        ContractSchema.parse(fixture);
        const data = engine.compileComponentData(fixture, new Map([[fixture.id, fixture]]));
        const root = data.variants[0].spec;
        const names = (root.children ?? []).map((c: any) => c.name);
        if (names.includes('wrapper')) {
          throw new Error('FC-ABS-SIZE contents: display:contents wrapper must be hoisted away, not emitted');
        }
        if (!names.includes('thumb')) {
          throw new Error(`FC-ABS-SIZE contents: expected hoisted thumb among root children, got ${JSON.stringify(names)}`);
        }
      }

      // FC-PSEUDO-SIZE / ELLIPSE stroke — emitted runtime must guard per-side
      // stroke weights (ELLIPSE has strokeWeight only).
      {
        const fixture: any = {
          id: 'fixture.ellipse-stroke', name: 'EllipseStroke', version: '0.0.0', status: 'draft',
          description: 'Wave B.1 ELLIPSE strokeSides guard pin', semantics: { element: 'span' },
          props: [
            {
              name: 'sizing', type: { enum: ['sm', 'md'] }, default: 'md',
              bindings: { figma: { kind: 'VARIANT', property: 'Sizing', values: { sm: 'Sm', md: 'Md' } }, code: { prop: 'sizing' } },
            },
          ],
          states: [],
          anatomy: {
            root: {
              layout: { display: 'flex' },
              parts: {
                thumb: {
                  element: 'span',
                  shape: { kind: 'ellipse', width: 20, height: 20 },
                  declared: { position: 'absolute' },
                  literals: {
                    'background-color': 'rgba(255, 255, 255, 1)',
                    'border-top-width': '1px',
                    'border-right-width': '1px',
                    'border-bottom-width': '1px',
                    'border-left-width': '1px',
                    'border-top-color': 'rgba(209, 213, 219, 1)',
                    width: '20px',
                    height: '20px',
                    top: '2px',
                    left: '2px',
                  },
                  literalsByProp: [
                    {
                      prop: 'sizing',
                      map: {
                        sm: { width: '16px', height: '16px' },
                        md: { width: '20px', height: '20px' },
                      },
                    },
                  ],
                },
              },
            },
          },
          anchors: baseAnchors,
        };
        ContractSchema.parse(fixture);
        const data = engine.compileComponentData(fixture, new Map([[fixture.id, fixture]]));
        const sm = data.variants.find((v: any) => v.name.includes('Sm'));
        const md = data.variants.find((v: any) => v.name.includes('Md'));
        if (!sm || !md) throw new Error('FC-PSEUDO-SIZE: Sm/Md variants missing');
        const smThumb = find(sm.spec, 'thumb');
        const mdThumb = find(md.spec, 'thumb');
        if (smThumb?.shape?.width !== 16 || mdThumb?.shape?.width !== 20) {
          throw new Error(
            `FC-PSEUDO-SIZE: expected shape widths 16/20, got ${smThumb?.shape?.width}/${mdThumb?.shape?.width}`,
          );
        }
        const script = engine.buildComponentScript(fixture, new Map([[fixture.id, fixture]]));
        if (!script.includes("'strokeTopWeight' in node") && !script.includes('"strokeTopWeight" in node')) {
          throw new Error('FC-PSEUDO-SIZE: emitted runtime missing ELLIPSE strokeTopWeight guard');
        }
      }

      // FC-PSEUDO-STROKE-GLYPH — adjacent two-side border L → ROUND polyline SVG
      // (not a fillClear rect with strokeLeft+strokeBottom — the thin-V failure).
      {
        const fixture: any = {
          id: 'fixture.l-stroke-glyph', name: 'LStrokeGlyph', version: '0.0.0', status: 'draft',
          description: 'Wave B FC-PSEUDO-STROKE-GLYPH pin', semantics: { element: 'span' },
          props: [variantProp],
          states: [],
          anatomy: {
            root: {
              layout: { display: 'flex' },
              parts: {
                box: {
                  element: 'span',
                  shape: { kind: 'rect', width: 16, height: 16 },
                  declared: { position: 'absolute' },
                  literals: {
                    'background-color': 'rgba(22, 22, 22, 1)',
                    width: '16px',
                    height: '16px',
                    top: '2px',
                    left: '0px',
                  },
                },
                mark: {
                  element: 'span',
                  shape: { kind: 'rect', width: 10, height: 6 },
                  declared: { position: 'absolute' },
                  literals: {
                    'background-color': 'transparent',
                    'border-top-width': '0px',
                    'border-right-width': '0px',
                    'border-bottom-width': '2px',
                    'border-left-width': '2px',
                    'border-bottom-color': 'rgba(255, 255, 255, 1)',
                    'border-left-color': 'rgba(255, 255, 255, 1)',
                    width: '10px',
                    height: '6px',
                    top: '4px',
                    left: '7px',
                  },
                  stylesWhen: [
                    {
                      prop: 'variant',
                      equals: 'a',
                      styles: {
                        position: 'absolute',
                        top: '4px',
                        left: '7px',
                        transform: 'rotate(-45deg)',
                      },
                    },
                  ],
                },
                bar: {
                  element: 'span',
                  shape: { kind: 'rect', width: 8, height: 5 },
                  declared: { position: 'absolute' },
                  literals: {
                    'background-color': 'transparent',
                    'border-top-width': '0px',
                    'border-right-width': '0px',
                    'border-bottom-width': '2px',
                    'border-left-width': '0px',
                    'border-bottom-color': 'rgba(255, 255, 255, 1)',
                    width: '8px',
                    height: '5px',
                    top: '8px',
                    left: '4px',
                  },
                },
              },
            },
          },
          anchors: baseAnchors,
        };
        ContractSchema.parse(fixture);
        const data = engine.compileComponentData(fixture, new Map([[fixture.id, fixture]]));
        const mark = find(data.variants[0].spec, 'mark');
        if (!mark) throw new Error('FC-PSEUDO-STROKE-GLYPH: mark missing');
        if (!mark.svg || !String(mark.svg).includes('polyline')) {
          throw new Error(`FC-PSEUDO-STROKE-GLYPH: expected polyline SVG, got ${JSON.stringify(mark.svg)?.slice(0, 120)}`);
        }
        if (!String(mark.svg).includes('stroke-linecap="round"')) {
          throw new Error('FC-PSEUDO-STROKE-GLYPH: polyline missing ROUND stroke-linecap');
        }
        if (mark.lits?.strokeSides) {
          throw new Error('FC-PSEUDO-STROKE-GLYPH: strokeSides should be cleared after L→SVG collapse');
        }
        if (mark.shape?.rotation !== -45) {
          throw new Error(`FC-PSEUDO-STROKE-GLYPH: expected rotation -45, got ${mark.shape?.rotation}`);
        }
        // Host-centering: left:7 in a 16×16 box at (0,2) → center on (8,10) →
        // left=3 top=7, then -45° optical nudge top -= min(10,6)*0.2 = 1.2 → 5.8
        if (mark.absolute?.left !== 3 || Math.abs((mark.absolute?.top ?? 0) - 5.8) > 0.01) {
          throw new Error(
            `FC-PSEUDO-STROKE-GLYPH: expected host-centered absolute (3,5.8), got (${mark.absolute?.left},${mark.absolute?.top})`,
          );
        }
        if (/points="[^"]*,0 |points="0,/.test(String(mark.svg))) {
          throw new Error('FC-PSEUDO-STROKE-GLYPH: polyline endpoints must be inset so ROUND caps stay in viewBox');
        }
        const bar = find(data.variants[0].spec, 'bar');
        if (!bar) throw new Error('FC-PSEUDO-STROKE-GLYPH: single-side bar control missing');
        if (bar.svg) throw new Error('FC-PSEUDO-STROKE-GLYPH: single-side bar must NOT become SVG polyline');
        if (!bar.lits?.fillColor || bar.lits.height !== 2) {
          throw new Error(
            `FC-PSEUDO-STROKE-GLYPH: single-side control should stay filled-bar collapse, got height=${bar.lits?.height} fill=${!!bar.lits?.fillColor}`,
          );
        }
        const script = engine.buildComponentScript(fixture, new Map([[fixture.id, fixture]]));
        if (!script.includes('createNodeFromSvg(spec.svg)')) {
          throw new Error('FC-PSEUDO-STROKE-GLYPH: shapeRuntime missing createNodeFromSvg(spec.svg) path');
        }
      }

      // FC-MISSING-AXIS residual — literalsByProp on VARIANT-bound boolean
      // (Astryx Switch On thumb: true → 20×20 @ left 18).
      {
        const fixture: any = {
          id: 'fixture.variant-bool-lbp', name: 'VariantBoolLbp', version: '0.0.0', status: 'draft',
          description: 'Wave B literalsByProp on VARIANT-bound boolean', semantics: { element: 'div' },
          props: [
            {
              name: 'value', type: 'boolean', default: false,
              bindings: {
                figma: { kind: 'VARIANT', property: 'Value', values: { false: 'Off', true: 'On' } },
                code: { prop: 'value' },
              },
            },
          ],
          states: [],
          anatomy: {
            root: {
              layout: { display: 'flex' },
              parts: {
                thumb: {
                  element: 'span',
                  declared: { position: 'absolute' },
                  literals: { width: '16px', height: '16px', left: '4px', top: '4px' },
                  literalsByProp: [
                    {
                      prop: 'value',
                      map: {
                        false: { width: '16px', height: '16px', left: '4px', top: '4px' },
                        true: { width: '20px', height: '20px', left: '18px', top: '2px' },
                      },
                    },
                  ],
                },
              },
            },
          },
          anchors: baseAnchors,
        };
        ContractSchema.parse(fixture);
        const data = engine.compileComponentData(fixture, new Map([[fixture.id, fixture]]));
        const on = data.variants.find((v: any) => /Value=On/.test(v.name));
        const off = data.variants.find((v: any) => /Value=Off/.test(v.name));
        if (!on || !off) throw new Error('FC-VARIANT-BOOL-LBP: Off/On variants missing');
        const onThumb = find(on.spec, 'thumb');
        const offThumb = find(off.spec, 'thumb');
        if (offThumb?.absolute?.left !== 4 || offThumb?.lits?.width !== 16) {
          throw new Error(`FC-VARIANT-BOOL-LBP: Off expected 16@4, got w=${offThumb?.lits?.width} left=${offThumb?.absolute?.left}`);
        }
        if (onThumb?.absolute?.left !== 18 || onThumb?.lits?.width !== 20) {
          throw new Error(`FC-VARIANT-BOOL-LBP: On expected 20@18, got w=${onThumb?.lits?.width} left=${onThumb?.absolute?.left}`);
        }
      }

      // FC-CARBON-TABS-LABEL — tab labels HUG full strings; no textTruncation
      {
        const carbonTokens = {
          primitives: JSON.parse(readFileSync(path.join(ROOT, 'examples/carbon/tokens/carbon.dtcg.json'), 'utf8')),
          semantic: JSON.parse(readFileSync(path.join(ROOT, 'examples/carbon/tokens/carbon-minted.dtcg.json'), 'utf8')),
          light: {},
          dark: {},
          brands: { default: {} },
        };
        const carbonIcons = new Map<string, string>();
        const carbonIconsDir = path.join(ROOT, 'examples/carbon/assets/icons');
        if (existsSync(carbonIconsDir)) {
          for (const f of readdirSync(carbonIconsDir)) {
            if (f.endsWith('.svg')) {
              carbonIcons.set(f.replace(/\.svg$/, ''), readFileSync(path.join(carbonIconsDir, f), 'utf8').trim());
            }
          }
        }
        const carbonEngine = createFigmaEngine({ tokens: carbonTokens, icons: carbonIcons });
        const tabsPath = path.join(ROOT, 'examples/carbon/contracts/tabs.contract.json');
        const tabsContract = ContractSchema.parse(JSON.parse(readFileSync(tabsPath, 'utf8')));
        const tabsById = new Map([[tabsContract.id, tabsContract]]);
        const tabsData = carbonEngine.compileComponentData(tabsContract, tabsById);
        const tabsScript = carbonEngine.buildComponentScript(tabsContract, tabsById);
        const walkSpecs = (s: any, fn: (n: any) => void) => {
          fn(s);
          for (const c of s.children ?? []) walkSpecs(c, fn);
        };
        const textNodes: any[] = [];
        for (const v of [...tabsData.variants, ...(tabsData.stateVariants ?? [])]) {
          walkSpecs(v.spec, (n) => { if (n.type === 'text') textNodes.push(n); });
        }
        if (textNodes.length === 0) throw new Error('FC-CARBON-TABS-LABEL: no text nodes in carbon.tabs emit');
        for (const t of textNodes) {
          if (t.textTruncation) {
            throw new Error(`FC-CARBON-TABS-LABEL: textTruncation on ${t.name} — labels must not truncate`);
          }
          if (t.fillW) {
            throw new Error(`FC-CARBON-TABS-LABEL: fillW on ${t.name} — labels must HUG without truncation`);
          }
          if (typeof t.characters === 'string' && t.characters.length <= 5 && /^(Overv|Activ|Setti)$/.test(t.characters)) {
            throw new Error(`FC-CARBON-TABS-LABEL: clipped label characters ${JSON.stringify(t.characters)}`);
          }
        }
        const fullLabels = textNodes.filter((t) => /^(Overview|Activity|Settings)$/.test(String(t.characters ?? '')));
        if (fullLabels.length < 3) {
          throw new Error(`FC-CARBON-TABS-LABEL: expected Overview/Activity/Settings labels, got ${textNodes.map((t) => t.characters).join(', ')}`);
        }
        for (const name of ['tabs__nav-item-label-wrapper', 'tabs__nav-item-label-wrapper-2', 'tabs__nav-item-label-wrapper-3']) {
          const wrap = find(tabsData.variants[0].spec, name);
          if (wrap?.fixedWidth) {
            throw new Error(`FC-CARBON-TABS-LABEL: ${name} still has fixedWidth ${wrap.fixedWidth.px}px — wrapper must HUG text`);
          }
        }
        if (tabsScript.includes('textTruncation') && /textTruncation:\s*true/.test(tabsScript)) {
          throw new Error('FC-CARBON-TABS-LABEL: emitted script carries textTruncation:true on tab labels');
        }
        // FC-FIGMA-CLIP-DEFAULT — frames unclip unless clipsContent:true
        if (!/clipsContent = spec\.clipsContent === true/.test(tabsScript) && !/node\.clipsContent = spec\.clipsContent === true/.test(tabsScript)) {
          throw new Error('FC-FIGMA-CLIP-DEFAULT: applyFrameSpec must set clipsContent from spec (default false)');
        }
        if (!tabsScript.includes('wrap.clipsContent = false')) {
          throw new Error('FC-FIGMA-CLIP-DEFAULT: text wrappers must set clipsContent = false');
        }
        if (!tabsScript.includes('RUNTIME_EMIT_REV')) {
          throw new Error('FC-FIGMA-CLIP-DEFAULT: RUNTIME_EMIT_REV must salt specHash so runtime-only fixes force amend');
        }
      }

      // FC-ASTRYX-SLIDER-TOOLTIP — Value Display=Tooltip restores the bubble
      {
        const astryxTokens = {
          primitives: JSON.parse(readFileSync(path.join(ROOT, 'examples/astryx/tokens/astryx-docs.dtcg.json'), 'utf8')),
          semantic: JSON.parse(readFileSync(path.join(ROOT, 'examples/astryx/tokens/astryx-minted.dtcg.json'), 'utf8')),
          light: {},
          dark: {},
          brands: { default: {} },
        };
        const astryxEngine = createFigmaEngine({ tokens: astryxTokens, icons: new Map() });
        const sliderPath = path.join(ROOT, 'examples/astryx/contracts/slider.contract.json');
        const sliderContract = ContractSchema.parse(JSON.parse(readFileSync(sliderPath, 'utf8')));
        const sliderById = new Map([[sliderContract.id, sliderContract]]);
        const sliderData = astryxEngine.compileComponentData(sliderContract, sliderById);
        const tipVar = sliderData.variants.find((v: any) => /Value Display=Tooltip/.test(v.name));
        const noneVar = sliderData.variants.find((v: any) => /Value Display=None/.test(v.name));
        const textV = sliderData.variants.find((v: any) => /Orientation=Vertical, Value Display=Text/.test(v.name));
        if (!tipVar || !noneVar) throw new Error('FC-ASTRYX-SLIDER-TOOLTIP: Tooltip/None variants missing');
        const hasTip = (s: any): boolean => {
          if (s.name === 'tooltip') return true;
          return (s.children ?? []).some(hasTip);
        };
        if (!hasTip(tipVar.spec)) {
          throw new Error('FC-ASTRYX-SLIDER-TOOLTIP: tooltip part missing on Tooltip variant — need stylesWhen display restore');
        }
        if (hasTip(noneVar.spec)) {
          throw new Error('FC-ASTRYX-SLIDER-TOOLTIP: tooltip must stay omitted on None');
        }
        const findAbs = (s: any, name: string): any => {
          if (s.name === name) return s;
          for (const c of s.children ?? []) {
            const hit = findAbs(c, name);
            if (hit) return hit;
          }
          return null;
        };
        const vLabel = textV && findAbs(textV.spec, 'label-3');
        if (!vLabel?.absolute || vLabel.absolute.top !== 86) {
          throw new Error(
            `FC-ASTRYX-SLIDER-TOOLTIP: vertical Text label-3 must pin beside thumb (top=86), got ${JSON.stringify(vLabel?.absolute)}`,
          );
        }
      }

      // FC-SVG-VIEWBOX — elliptical-arc radii must not inflate viewBox
      {
        const d =
          'M 10 3.5 A 449.26 449.26 0 0 1 5.843 8.794 L 16.1 15.316 A 429.497 429.497 0 0 1 12.152 4.947 Z';
        const extent = pathDataExtent(d);
        if (extent > 40) {
          throw new Error(`FC-SVG-VIEWBOX: pathDataExtent leaked arc radii (got ${extent})`);
        }
        const warnSvg = readFileSync(
          path.join(ROOT, 'examples/polaris/assets/icons/banner-icon-warning.svg'),
          'utf8',
        );
        if (!/viewBox="0 0 20 20"/.test(warnSvg)) {
          throw new Error('FC-SVG-VIEWBOX: banner-icon-warning.svg must be viewBox 0 0 20 20');
        }
        const polarisIcons = new Map<string, string>();
        const polarisIconsDir = path.join(ROOT, 'examples/polaris/assets/icons');
        if (existsSync(polarisIconsDir)) {
          for (const f of readdirSync(polarisIconsDir)) {
            if (f.endsWith('.svg')) {
              polarisIcons.set(f.replace(/\.svg$/, ''), readFileSync(path.join(polarisIconsDir, f), 'utf8').trim());
            }
          }
        }
        const polarisTokens = {
          primitives: JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/tokens/polaris-light.dtcg.json'), 'utf8')),
          semantic: JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/tokens/polaris-minted.dtcg.json'), 'utf8')),
          light: {},
          dark: {},
          brands: { default: {} },
        };
        const bannerEngine = createFigmaEngine({ tokens: polarisTokens, icons: polarisIcons });
        const bannerContract = ContractSchema.parse(
          JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/contracts/banner.contract.json'), 'utf8')),
        );
        const bannerScript = bannerEngine.buildComponentScript(
          bannerContract,
          new Map([[bannerContract.id, bannerContract]]),
          undefined,
        );
        if (/banner-icon-warning[\s\S]{0,200}viewBox=\\"0 0 450 450\\"/.test(bannerScript) || /viewBox=\\"0 0 450 450\\"[\s\S]{0,80}449\.26/.test(bannerScript)) {
          throw new Error('FC-SVG-VIEWBOX: banner emit still embeds 450×450 warning glyph');
        }
        if (!bannerScript.includes('viewBox=\\"0 0 20 20\\"') && !bannerScript.includes('viewBox="0 0 20 20"')) {
          // warning asset must appear with 20×20 — at least one 20 viewBox in script
          throw new Error('FC-SVG-VIEWBOX: banner emit missing 20×20 viewBox (warning icon)');
        }
      }

      // FC-FLEX-BASIS / modal footer grow
      {
        const carbonTokens = {
          primitives: JSON.parse(readFileSync(path.join(ROOT, 'examples/carbon/tokens/carbon.dtcg.json'), 'utf8')),
          semantic: JSON.parse(readFileSync(path.join(ROOT, 'examples/carbon/tokens/carbon-minted.dtcg.json'), 'utf8')),
          light: {},
          dark: {},
          brands: { default: {} },
        };
        const carbonIcons = new Map<string, string>();
        const carbonIconsDir = path.join(ROOT, 'examples/carbon/assets/icons');
        if (existsSync(carbonIconsDir)) {
          for (const f of readdirSync(carbonIconsDir)) {
            if (f.endsWith('.svg')) {
              carbonIcons.set(f.replace(/\.svg$/, ''), readFileSync(path.join(carbonIconsDir, f), 'utf8').trim());
            }
          }
        }
        const carbonEngine = createFigmaEngine({ tokens: carbonTokens, icons: carbonIcons });
        const modalContract = ContractSchema.parse(
          JSON.parse(readFileSync(path.join(ROOT, 'examples/carbon/contracts/modal.contract.json'), 'utf8')),
        );
        const modalData = carbonEngine.compileComponentData(
          modalContract,
          new Map([[modalContract.id, modalContract]]),
        );
        const find = (s: any, name: string): any => {
          if (s.name === name) return s;
          for (const c of s.children ?? []) {
            const hit = find(c, name);
            if (hit) return hit;
          }
          return null;
        };
        const btn6 = find(modalData.variants[0].spec, 'label-6');
        const btn7 = find(modalData.variants[0].spec, 'label-7');
        if (!btn6?.grow && !btn6?.fillW) {
          throw new Error('FC-FLEX-BASIS: modal Cancel (label-6) must grow/fillW for 50/50 footer');
        }
        if (!btn7?.grow && !btn7?.fillW) {
          throw new Error('FC-FLEX-BASIS: modal Save (label-7) must grow/fillW for 50/50 footer');
        }
      }

      // FC-SVG-ROTATION — declared transform rotate on icon → spec.rotation
      {
        const spinnerContract = ContractSchema.parse(
          JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/contracts/spinner.contract.json'), 'utf8')),
        );
        const polarisIcons = (() => {
          const m = new Map<string, string>();
          const dir = path.join(ROOT, 'examples/polaris/assets/icons');
          if (existsSync(dir)) {
            for (const f of readdirSync(dir)) {
              if (f.endsWith('.svg')) m.set(f.replace(/\.svg$/, ''), readFileSync(path.join(dir, f), 'utf8').trim());
            }
          }
          return m;
        })();
        const spinnerEngine = createFigmaEngine({
          tokens: {
            primitives: JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/tokens/polaris-light.dtcg.json'), 'utf8')),
            semantic: JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/tokens/polaris-minted.dtcg.json'), 'utf8')),
            light: {},
            dark: {},
            brands: { default: {} },
          },
          icons: polarisIcons,
        });
        const spinnerData = spinnerEngine.compileComponentData(
          spinnerContract,
          new Map([[spinnerContract.id, spinnerContract]]),
        );
        const findRot = (s: any): any => {
          if (s.type === 'svg' && typeof s.rotation === 'number') return s;
          for (const c of s.children ?? []) {
            const hit = findRot(c);
            if (hit) return hit;
          }
          return null;
        };
        const rotated = findRot(spinnerData.variants[0].spec);
        if (!rotated || rotated.rotation !== 90) {
          throw new Error('FC-SVG-ROTATION: spinner icon must compile rotation: 90 (CSS clockwise)');
        }
        const spinnerScript = spinnerEngine.buildComponentScript(
          spinnerContract,
          new Map([[spinnerContract.id, spinnerContract]]),
          undefined,
        );
        // The rev moved rt4-svg-rotation → rt5-text-fill-alignment at the
        // landing round (FC-TEXT-FILL-ALIGNMENT runtime guard change); the
        // rotation lowering itself is still pinned by spec.rotation above,
        // and the salt requirement is pinned against the CURRENT rev.
        if (!spinnerScript.includes('spec.rotation') || !spinnerScript.includes('rt5-text-fill-alignment')) {
          throw new Error('FC-SVG-ROTATION: runtime must apply spec.rotation and salt RUNTIME_EMIT_REV');
        }
      }

      // FC-WIDTH-TOKEN — text-field showcase width (not hug "Example")
      {
        const tfRaw = readFileSync(path.join(ROOT, 'examples/polaris/contracts/text-field.contract.json'), 'utf8');
        if (!tfRaw.includes('imported.text-field.connected.width.off.off')) {
          throw new Error('FC-WIDTH-TOKEN: text-field contract must bind connected.width.off.off');
        }
        const tfScriptPath = path.join(ROOT, 'examples/polaris/figma/text-field.figma.js');
        if (existsSync(tfScriptPath)) {
          const tfScript = readFileSync(tfScriptPath, 'utf8');
          if (!/"px":\s*211/.test(tfScript) && !/"px":211/.test(tfScript)) {
            throw new Error('FC-WIDTH-TOKEN: text-field emit must include fixedWidth ~211px');
          }
        }
      }

      // FC-PSEUDO-OVERFLOW — inline-notification must not emit fixed 425px red root-before
      {
        const inlPath = path.join(ROOT, 'examples/carbon/contracts/inlinenotification.contract.json');
        const inlRaw = readFileSync(inlPath, 'utf8');
        if (inlRaw.includes('root-before') || inlRaw.includes('425')) {
          throw new Error('FC-PSEUDO-OVERFLOW: inline-notification must drop overflow root-before (425px red spur)');
        }
        if (!inlRaw.includes('border-top-width.{contrast}')) {
          throw new Error('FC-PSEUDO-OVERFLOW: low-contrast box border must bind border-*-width.{contrast}');
        }
        const inlScriptPath = path.join(ROOT, 'examples/carbon/figma/inline-notification.figma.js');
        if (existsSync(inlScriptPath)) {
          const inlScript = readFileSync(inlScriptPath, 'utf8');
          if (inlScript.includes('"name": "root-before"') || /"width":\s*425/.test(inlScript)) {
            throw new Error('FC-PSEUDO-OVERFLOW: emit still contains root-before / 425px decor');
          }
        }
      }

      // FC-ENUM-HOLE — altitude chip Type must include Default (pill), not Squared-only
      {
        const chip = JSON.parse(
          readFileSync(path.join(ROOT, 'examples/altitude/contracts/chip.contract.json'), 'utf8'),
        ) as { props?: Array<{ name: string; type?: { enum?: string[] } }> };
        const typeProp = chip.props?.find((p) => p.name === 'type');
        if (!typeProp?.type?.enum?.includes('default') || !typeProp.type.enum.includes('squared')) {
          throw new Error('FC-ENUM-HOLE: altitude.chip type must enum [default, squared] (pill + squared)');
        }
        if (typeProp.type.enum.includes('unset')) {
          throw new Error('FC-ENUM-HOLE: altitude.chip must not use capture-side unset as enum value');
        }
        const chipScriptPath = path.join(ROOT, 'examples/altitude/figma/chip.figma.js');
        if (existsSync(chipScriptPath)) {
          const chipScript = readFileSync(chipScriptPath, 'utf8');
          if (!/Type=Default/.test(chipScript) || !/Type=Squared/.test(chipScript)) {
            throw new Error('FC-ENUM-HOLE: chip emit must include Type=Default and Type=Squared variants');
          }
          if (!chipScript.includes('border-top-left-radius/unset')) {
            throw new Error('FC-ENUM-HOLE: chip Default must bind pill radius token (.../unset)');
          }
          if (!chipScript.includes('border-top-left-radius/squared')) {
            throw new Error('FC-ENUM-HOLE: chip Squared must bind squared radius token');
          }
        }
      }

      // FC-CONTRAST-ICON — high-contrast close glyph uses inverse/white paint
      {
        const inlContract = ContractSchema.parse(
          JSON.parse(readFileSync(path.join(ROOT, 'examples/carbon/contracts/inlinenotification.contract.json'), 'utf8')),
        );
        const inlEngine = createFigmaEngine({
          tokens: {
            primitives: JSON.parse(readFileSync(path.join(ROOT, 'examples/carbon/tokens/carbon.dtcg.json'), 'utf8')),
            semantic: JSON.parse(readFileSync(path.join(ROOT, 'examples/carbon/tokens/carbon-minted.dtcg.json'), 'utf8')),
            light: {},
            dark: {},
            brands: { default: {} },
          },
          icons: (() => {
            const m = new Map<string, string>();
            const dir = path.join(ROOT, 'examples/carbon/assets/icons');
            if (existsSync(dir)) {
              for (const f of readdirSync(dir)) {
                if (f.endsWith('.svg')) m.set(f.replace(/\.svg$/, ''), readFileSync(path.join(dir, f), 'utf8').trim());
              }
            }
            return m;
          })(),
        });
        const inlData = inlEngine.compileComponentData(
          inlContract,
          new Map([[inlContract.id, inlContract]]),
        );
        const high = inlData.variants.find((v: any) => /Contrast=High/i.test(v.name) || /contrast.*high/i.test(v.name));
        const low = inlData.variants.find((v: any) => /Contrast=Low/i.test(v.name) || /contrast.*low/i.test(v.name));
        const findClosePaint = (s: any): string | null => {
          if (s.name?.includes('close-button') && s.svgPaintVar) return s.svgPaintVar;
          for (const c of s.children ?? []) {
            const hit = findClosePaint(c);
            if (hit) return hit;
          }
          return null;
        };
        const highPaint = high ? findClosePaint(high.spec) : null;
        const lowPaint = low ? findClosePaint(low.spec) : null;
        if (!highPaint || !/color\/high/.test(highPaint)) {
          throw new Error(`FC-CONTRAST-ICON: high-contrast close svgPaintVar must end color/high (got ${highPaint})`);
        }
        if (!lowPaint || !/color\/low/.test(lowPaint)) {
          throw new Error(`FC-CONTRAST-ICON: low-contrast close svgPaintVar must end color/low (got ${lowPaint})`);
        }
      }

      // FC-STATE-PREVIEW-NOISE — altitude chip Default-only canvas (no Focus Visible grid)
      {
        const chip = JSON.parse(
          readFileSync(path.join(ROOT, 'examples/altitude/contracts/chip.contract.json'), 'utf8'),
        ) as { figmaStatePreviews?: boolean };
        if (chip.figmaStatePreviews) {
          throw new Error('FC-STATE-PREVIEW-NOISE: altitude.chip figmaStatePreviews must be false (focus blue rings clutter showcase)');
        }
        const chipScriptPath = path.join(ROOT, 'examples/altitude/figma/chip.figma.js');
        if (existsSync(chipScriptPath)) {
          const chipScript = readFileSync(chipScriptPath, 'utf8');
          // Measure the payload, not the runtime prose: every emitted script
          // carries the amend-cleanup runtime whose COMMENT names the
          // "State=Focus Visible" leftovers it removes — that string is not a
          // variant. A real preview variant lands as a quoted node NAME in the
          // COMPONENTS payload ("Variant=…, State=Focus Visible"), which is
          // what this pin forbids when figmaStatePreviews is off.
          if (/"name": "[^"]*State=Focus Visible/.test(chipScript)) {
            throw new Error('FC-STATE-PREVIEW-NOISE: chip emit must not include Focus Visible variants');
          }
        }
      }

      console.log(
        'code-to-canvas-wave-a-emit-pins: FC-LH-RATIO PERCENT, FC-PLACEHOLDER empty, FC-BLOCK-ROW VERTICAL, FC-SLOT-DEFAULT Show=false, FC-ABS-SIZE fw!=null, FC-PSEUDO-SIZE ellipse stroke, FC-PSEUDO-STROKE-GLYPH L→SVG, FC-VARIANT-BOOL-LBP, FC-CARBON-TABS-LABEL, FC-FIGMA-CLIP-DEFAULT, FC-ASTRYX-SLIDER-TOOLTIP, FC-SVG-VIEWBOX, FC-FLEX-BASIS, FC-SVG-ROTATION, FC-WIDTH-TOKEN, FC-CONTRAST-ICON, FC-ENUM-HOLE chip, FC-PSEUDO-OVERFLOW, FC-STATE-PREVIEW-NOISE — all green',
      );
    },
  },

  {
    // Trap corpus structural gate — contracts/scripts/refs + emit markers.
    // Does NOT require matchDeveloped / pixel scores (those stay warn/pending).
    id: 'trap-corpus-check',
    claim: 'C3-detection',
    run: () => {
      const r = spawnSync(process.execPath, ['scripts/trap-corpus-check.mjs'], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      if ((r.status ?? -1) !== 0) {
        throw new Error(`trap-corpus-check failed:\n${out}`);
      }
      if (!out.includes('trap-corpus-check')) {
        throw new Error('trap-corpus-check did not print summary');
      }
      console.log('trap-corpus-check: frozen adversarial stems structural/compile markers green');
    },
  },

  {
    // SYNC LAYER STEP 1 — the repo sync-ledger lockfile (sync/ledger.json).
    // Red-tests the drift arithmetic BY NAME: a hand-edited canvas fingerprint
    // (simulated designer edit) flips observe to canvas-ahead naming the
    // component; a contract-hash bump flips to code-ahead; both → conflict;
    // and the ECHO-LOOP invariant — a code→canvas amend that records its new
    // fingerprint at write time classifies the follow-up observation as
    // self-inflicted (in-sync), while a ledger the writer forgot to update
    // raises the canvas-ahead false alarm the invariant exists to prevent.
    // Then runs the offline gate (schema + deterministic bytes + seeded
    // records vs their READ-ONLY receipts + the committed-fixture drift table).
    id: 'sync-ledger-lockfile',
    claim: 'C3-detection',
    run: () => {
      const AT = '2026-08-07T00:00:00.000Z';
      const HASH_A = `sha256:${'a'.repeat(64)}`;
      const HASH_B = `sha256:${'b'.repeat(64)}`;
      const record: SyncLedgerRecord = {
        contractId: 'ds.probe',
        contractPath: 'contracts/probe.contract.json',
        contractHash: HASH_A,
        fileKey: 'FILEKEY',
        setNodeId: '1:1',
        canvasFingerprint: 'v6:100',
        lastSyncedVersionId: '41',
        lastSyncedAt: AT,
        direction: 'code→canvas',
        observed: { dumpFingerprint: 'dumpv1:10', fileVersionId: '41', observedAt: AT },
        provenance: 'sync-record',
      };
      const obs = (stamp: string, dump: string): SyncSetObservation => ({
        fileKey: 'FILEKEY',
        setNodeId: '1:1',
        setName: 'Probe',
        stamp,
        dumpFingerprint: dump,
        fileVersionId: '42',
      });

      // In-sync control — hash matches, stamp matches, baseline matches.
      const clean = syncClassifyRecord(record, HASH_A, obs('v6:100', 'dumpv1:10'));
      if (clean.status !== 'in-sync') throw new Error(`control row must be in-sync (got ${clean.status})`);

      // RED 1: simulated canvas edit (dump fingerprint moved, stamp did not).
      const canvasEdit = syncClassifyRecord(record, HASH_A, obs('v6:100', 'dumpv1:99'));
      if (canvasEdit.status !== 'canvas-ahead')
        throw new Error(`hand-edited canvas fingerprint must classify canvas-ahead (got ${canvasEdit.status})`);
      if (canvasEdit.contractId !== 'ds.probe' || !canvasEdit.notes.some((n) => n.includes('dumpv1:99')))
        throw new Error('canvas-ahead row must name the component and the drifted fingerprint');

      // Cross-version stamps are two instruments, not drift (live finding,
      // MUI Test 1: v5-era canvas stamps vs v6 receipt records raised 13
      // false canvas-ahead alarms). With the baseline agreeing, the row must
      // classify in-sync and NAME the incomparability.
      const crossVersion = syncClassifyRecord(record, HASH_A, obs('v5:77', 'dumpv1:10'));
      if (crossVersion.status !== 'in-sync' || !crossVersion.notes.some((n) => n.includes('incomparable')))
        throw new Error(
          `a v5 stamp vs a v6 record with an agreeing baseline must be in-sync with a named incomparability note (got ${crossVersion.status})`,
        );

      // RED 2: contract-hash bump → code-ahead.
      const codeBump = syncClassifyRecord(record, HASH_B, obs('v6:100', 'dumpv1:10'));
      if (codeBump.status !== 'code-ahead')
        throw new Error(`contract-hash bump must classify code-ahead (got ${codeBump.status})`);

      // RED 3: both → conflict.
      const both = syncClassifyRecord(record, HASH_B, obs('v6:100', 'dumpv1:99'));
      if (both.status !== 'conflict') throw new Error(`both halves drifting must classify conflict (got ${both.status})`);

      // ECHO-LOOP INVARIANT. The amend records its new v6 at write time…
      const ledger0 = { ...syncEmptyLedger(), records: [record] };
      const ledger1 = syncRecordCodeToCanvas(ledger0, {
        contractId: 'ds.probe',
        contractHash: HASH_B,
        fileKey: 'FILEKEY',
        setNodeId: '1:1',
        canvasFingerprint: 'v6:200',
        at: AT,
      });
      const amended = ledger1.records.find((r) => r.contractId === 'ds.probe')!;
      if (amended.observed !== null)
        throw new Error('recordCodeToCanvasSync must drop the stale observation baseline (it describes the replaced canvas)');
      const echo = syncClassifyRecord(amended, HASH_B, obs('v6:200', 'dumpv1:99'));
      if (echo.status !== 'in-sync')
        throw new Error(
          `echo case: the observation after a RECORDED amend must classify self-inflicted/in-sync (got ${echo.status})`,
        );
      // …and the ledger the writer FORGOT to update raises the false alarm.
      const forgot = syncClassifyRecord(record, HASH_A, obs('v6:200', 'dumpv1:99'));
      if (forgot.status !== 'canvas-ahead')
        throw new Error(`unrecorded amend must surface as canvas-ahead (got ${forgot.status}) — the invariant is falsifiable`);
      // The writer cannot even CLAIM a code→canvas sync without the fingerprint.
      let refusal = '';
      try {
        syncRecordCodeToCanvas(ledger0, {
          contractId: 'ds.probe',
          contractHash: HASH_B,
          fileKey: 'FILEKEY',
          setNodeId: '1:1',
          canvasFingerprint: '',
          at: AT,
        });
      } catch (e) {
        refusal = String(e);
      }
      if (!refusal.includes('echo-loop'))
        throw new Error('a code→canvas record without a v6 fingerprint must refuse naming the echo-loop invariant');

      // Deterministic serialization + schema refusal by name.
      const bytes = syncSerializeLedger(ledger1);
      if (syncSerializeLedger(syncParseLedger(bytes)) !== bytes)
        throw new Error('serializeLedger(parseLedger(bytes)) must reproduce the bytes exactly');
      let schemaRefusal = '';
      try {
        syncValidateLedger({ version: 1, records: [{ ...record, direction: 'sideways' }] });
      } catch (e) {
        schemaRefusal = String(e);
      }
      if (!schemaRefusal.includes('direction'))
        throw new Error('an invalid direction must refuse naming the field');

      // The offline gate over the COMMITTED ledger + fixture (receipts READ-ONLY).
      const r = spawnSync(TSX, [path.join(ROOT, 'sync', 'ledger-check.ts')], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      if ((r.status ?? -1) !== 0) throw new Error(`sync:ledger:check failed:\n${out}`);
      if (!/\d+ record\(s\) ok/.test(out) || !out.includes('seeded-from-receipts'))
        throw new Error('sync:ledger:check did not report record/seed verification');
      if (!out.includes('in-sync / code-ahead / canvas-ahead / conflict / untracked'))
        throw new Error('sync:ledger:check did not report the five-status fixture drift table');
      console.log(
        'sync-ledger-lockfile: canvas-edit→canvas-ahead, hash-bump→code-ahead, both→conflict, recorded-amend echo→in-sync ' +
          '(unrecorded amend raises the named false alarm); serialization deterministic; offline gate green over the committed ledger',
      );
    },
  },

  {
    // SYNC LAYER STEP 2 — the drift spine (sync/spine.ts) over the SAME
    // committed fixture canvas the ledger gate rides. Red tests, by name:
    //   1. canvas-ahead fixture (Gamma) → the spine plan CONTAINS the pulled
    //      proposal bundle: proposed contract + unified diff + per-property
    //      classification + the inversion-honesty copy + a PR body whose
    //      marker records the ledger fingerprints it was based on, and the
    //      code-ahead record (Beta) gets its "canvas is behind" row.
    //   2. in-sync scope (--only fixture.alpha) → the spine plans NOTHING
    //      and exits 0.
    //   3. echo safety: a cursor (state.json) recording run 1's observed
    //      fingerprints makes the rerun SKIP Gamma by name — no duplicate
    //      PR bundle for a drift already on review.
    // The live spine (FIGMA_TOKEN + network + gh) is this run's twin —
    // EXCLUDED by name in .github/scripts/lane-coverage.ts; this fixture-mode
    // eval is the committed gate.
    id: 'sync-spine-drift',
    claim: 'C3-detection',
    run: () => {
      const outRoot = path.join(SCRATCH, 'spine-out');
      const spine = (extra: string[]): { status: number | null; out: string } => {
        const r = spawnSync(
          TSX,
          [
            path.join(ROOT, 'sync', 'spine.ts'),
            '--fixture',
            'sync/fixtures/canvas.rest.fixture.json',
            '--ledger',
            'sync/fixtures/ledger.fixture.json',
            '--out',
            outRoot,
            ...extra,
          ],
          { cwd: ROOT, encoding: 'utf8' },
        );
        return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
      };

      // RED 1: the canvas-ahead fixture must land in the plan as a full bundle.
      const run1 = spine(['--run-id', 'run1']);
      if (run1.status !== 1)
        throw new Error(`fixture spine must exit 1 (drift present) — got ${run1.status}:\n${run1.out}`);
      if (!run1.out.includes('canvas-ahead') || !run1.out.includes('fixture.gamma'))
        throw new Error('spine plan must classify and name the canvas-ahead record');
      const gammaDir = path.join(outRoot, 'run1', 'fixture-gamma');
      for (const f of [
        'fixture-gamma.contract.proposed.json',
        'fixture-gamma.contract.diff',
        'drift.json',
        'DRIFT.md',
        'PR.md',
        'plan.json',
      ]) {
        if (!existsSync(path.join(gammaDir, f)))
          throw new Error(`spine plan must write ${f} for the canvas-ahead record (missing in ${gammaDir})`);
      }
      const driftMd = readFileSync(path.join(gammaDir, 'DRIFT.md'), 'utf8');
      if (!driftMd.includes('mismatch') || !driftMd.includes('REVIEWABLE INVERSION'))
        throw new Error('DRIFT.md must carry the per-property classification and the inversion-honesty copy');
      const prBody = readFileSync(path.join(gammaDir, 'PR.md'), 'utf8');
      if (
        !prBody.includes('ds-contracts sync-spine: key=fixture.gamma@SYNCFIXTUREFILE0') ||
        !prBody.includes('ledger-stamp=v6:3333')
      )
        throw new Error('the PR body must record the ledger fingerprints it was based on (the echo-safety marker)');
      if (!prBody.includes('inversion, not a round trip') && !prBody.includes('reviewable inversion'))
        throw new Error('the PR body must carry the inversion-vs-roundtrip honesty copy');
      const plan1 = JSON.parse(readFileSync(path.join(gammaDir, 'plan.json'), 'utf8')) as {
        branch: string;
        basedOn: Record<string, string | null>;
      };
      if (plan1.branch !== 'sync-spine/fixture-gamma')
        throw new Error(`PR plan must suggest the sync-spine/<stem> branch (got ${plan1.branch})`);
      const diffText = readFileSync(path.join(gammaDir, 'fixture-gamma.contract.diff'), 'utf8');
      if (!/^\+/m.test(diffText) || !/^-/m.test(diffText))
        throw new Error('the proposed-contract diff must contain actual +/- lines');
      if (!run1.out.includes('canvas is behind: publish+apply needed') || !run1.out.includes('fixture.beta'))
        throw new Error('the code-ahead record must surface as the "canvas is behind: publish+apply needed" row');
      if (!existsSync(path.join(outRoot, 'run1', 'fixture-beta', 'fixture-beta.bundle.json')))
        throw new Error('the code-ahead record must get a regenerated CONTRACTS-BUNDLE');

      // RED 2: an in-sync scope plans nothing.
      const run2 = spine(['--run-id', 'run2', '--only', 'fixture.alpha']);
      if (run2.status !== 0)
        throw new Error(`--only fixture.alpha (in-sync) must exit 0 — got ${run2.status}:\n${run2.out}`);
      if (!run2.out.includes('nothing to pull'))
        throw new Error('an in-sync scope must say it plans nothing');
      if (existsSync(path.join(outRoot, 'run2', 'fixture-alpha')))
        throw new Error('an in-sync record must produce NO proposal bundle');

      // RED 3: the cursor skips a drift that is already PR'd — by name.
      const statePath = path.join(outRoot, 'state.json');
      writeFileSync(
        statePath,
        JSON.stringify(
          {
            version: 1,
            entries: {
              'fixture.gamma@SYNCFIXTUREFILE0': {
                branch: plan1.branch,
                prUrl: 'https://github.com/example/repo/pull/999',
                openedAt: new Date().toISOString(),
                basedOn: plan1.basedOn,
              },
            },
          },
          null,
          2,
        ) + '\n',
      );
      const run3 = spine(['--run-id', 'run3', '--state', statePath]);
      if (!run3.out.includes("already PR'd") || !run3.out.includes('fixture.gamma@SYNCFIXTUREFILE0'))
        throw new Error('a cursor hit must skip the record BY NAME (no duplicate PR per drift)');
      if (existsSync(path.join(outRoot, 'run3', 'fixture-gamma')))
        throw new Error('a cursor-skipped record must not be pulled again');
      if (!existsSync(path.join(outRoot, 'run3', 'fixture-delta')))
        throw new Error('the cursor must skip ONLY the PR-d record — the conflict record still pulls');
      console.log(
        'sync-spine-drift: canvas-ahead fixture → plan carries proposal+diff+classification+marker PR body; ' +
          'in-sync scope plans nothing; cursor skips the already-PR-d drift by name (conflict sibling still pulls)',
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

// `npm run eval -- --only <substring>[,<substring>]` runs a SUBSET. The subset
// run deliberately does NOT write evals/results.json — a partial run must
// never be able to masquerade as the committed suite result (docs:check reads
// that file and gates every "N/N" claim in the docs against it).
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1].split(',') : null;
})();

const results: Array<{ id: string; claim: string; pass: boolean; error?: string }> = [];
for (const c of ONLY ? cases.filter((x) => ONLY.some((o) => x.id.includes(o))) : cases) {
  resetScratch();
  try {
    c.run();
    results.push({ id: c.id, claim: c.claim, pass: true });
    console.log(`  ✔ ${c.claim}  ${c.id}`);
  } catch (err) {
    results.push({ id: c.id, claim: c.claim, pass: false, error: String(err) });
    console.log(`  ✖ ${c.claim}  ${c.id}\n      ${String(err)}`);
  }
}
rmSync(SCRATCH, { recursive: true, force: true });

const passed = results.filter((r) => r.pass).length;
if (ONLY) {
  console.log(`\n${passed}/${results.length} evals passed — SUBSET run (--only ${ONLY.join(',')}); evals/results.json NOT written`);
} else {
  writeFileSync(
    path.join(ROOT, 'evals', 'results.json'),
    JSON.stringify({ passed, total: results.length, results }, null, 2) + '\n',
  );
  console.log(`\n${passed}/${results.length} evals passed — evals/results.json`);
}
process.exit(passed === results.length ? 0 : 1);
