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
  ContractSchema,
  resolveTokens as schemaResolveTokens,
  type Contract as SchemaContract,
  type Part as SchemaPart,
} from '../scripts/contract-schema.js';
import { validateContract as coreValidateContract } from '../core/emit-react.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import { emitHtml as coreEmitHtml } from '../core/emit-html.js';
import { tokenInventoryFromJson } from '../core/tokens.js';

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
  const r = spawnSync(cmd, args, { cwd: SCRATCH, encoding: 'utf8' });
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
      editJson(FIGMA_COMPONENTS, (s2) => { s2.extractedAt = Date.now() - 15 * 86_400_000; });
      const r = parity();
      if (r.status !== 1) throw new Error('15-day-old snapshot passed the 14-day staleness gate');
      if (!readReport().some((x) => x.subject === 'snapshot-stale'))
        throw new Error('Expected snapshot-stale finding');
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
      if (r.status === 0 || !r.out.includes('but is not an arrayOf prop')) throw new Error('scalar NONE not refused by name');
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
    // Unbound fills are REPORTED with nearest-token candidates, never invented.
    id: 'design-propose-unbound-fill-named-never-invented',
    claim: 'C5-extraction',
    run: () => {
      editJson('extract/figma/fixtures/main-file-dumps.json', (d) => {
        for (const v of d.Badge.variants) v.fill = { hex: '3b82f6' };
      });
      const r = run(TSX, ['extract/figma/propose.ts', 'extract/figma/fixtures/main-file-dumps.json', '--out', 'extract/out/figma']);
      if (r.status !== 0) throw new Error(`Proposal failed on an unbound fill:\n${r.out}`);
      const proposed = JSON.parse(readFileSync(path.join(SCRATCH, 'extract', 'out', 'figma', 'badge.contract.proposed.json'), 'utf8'));
      if (proposed.anatomy.root.tokens?.['background-color']) throw new Error('Proposal fabricated a token for an unbound fill');
      const report = readFileSync(path.join(SCRATCH, 'extract', 'out', 'figma', 'figma-proposals.md'), 'utf8');
      if (!report.includes('UNBOUND Badge:root fill = #3b82f6')) throw new Error('Unbound fill not named in the report');
      if (!report.includes('{color.blue.500}')) throw new Error('Nearest-token suggestions missing');
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
    // fidelity — Badge zero-mismatch, Eventz foreign names + the U+2024 refusal.
    id: 'design-mcp-roundtrip-fixture-replay',
    claim: 'C5-extraction',
    run: () => {
      const r = run(TSX, ['extract/figma/mcp/receipt.ts']);
      if (r.status !== 0) throw new Error(`desktop-MCP receipt failed:\n${r.out}`);
      const receipt = readFileSync(path.join(SCRATCH, 'extract/figma/mcp/RECEIPT.md'), 'utf8');
      if (!/\| Badge \| \d+ \| \d+ \| 0 \| ✅/.test(receipt)) throw new Error('Badge row is not zero-mismatch');
      if (!receipt.includes('REFUSED by the token-ref grammar')) throw new Error('U+2024 refusal receipt missing');
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
        const batch = proposeBatchFromDump(dump, { corpus, contractIdByName: loaded.byName, contractsById: loaded.byId, fileKey: 'WofZT8xaxXuc2Q6Je9S4XE', mintUnbound: true });
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
        '✔ emitReact CSS: font-weight + line-height declarations on both text parts',
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
      const shapeBody = shapeBranch.slice(0, shapeBranch.indexOf('} else {'));
      if (!shapeBody.includes('spec.stroke')) throw new Error('shape branch must apply spec.stroke');
      if (!shapeBody.includes('spec.bindings')) throw new Error('shape branch must apply spec.bindings');
      if (!shapeBody.includes("node.fills = spec.fill ? [boundPaint(spec.fill, node)] : []")) {
        throw new Error('shape branch must clear the default paint when no fill channel is carried');
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
        const html = buildReplayHtml(specs, truth._provenance.stage, 'light');
        const tmp = path.join('evals', '.computed-replay.html');
        fs.writeFileSync(tmp, html);
        (async () => {
          const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
          try {
            const page = await browser.newPage();
            await page.goto('file://' + path.resolve(tmp));
            await page.waitForFunction('window.__READY === true');
            await page.evaluate('document.fonts.ready');
            const reread = await rereadEquality((js) => page.evaluate(js), specs, truth._provenance.channels);
            if (reread.pct < 99.9) throw new Error('replay computed equality ' + reread.pct.toFixed(3) + '% below the 99.9% floor');
            if (reread.pct < numbers.replayComputedEquality.pct - 0.05) {
              throw new Error('replay equality regressed vs committed: ' + reread.pct.toFixed(3) + '% vs ' + numbers.replayComputedEquality.pct.toFixed(3) + '%');
            }
            console.log('computed-floor replay: ' + reread.cellsMatched + '/' + reread.cellsCompared + ' cells (' + reread.pct.toFixed(3) + '%) across ' + specs.length + ' captures');
          } finally { await browser.close(); fs.rmSync(tmp, { force: true }); }
        })().catch((e) => { console.error(e); process.exit(1); });
      `]);
      if (probe.status !== 0 || !probe.out.includes('computed-floor replay:')) {
        throw new Error(`computed-floor gate failed:\n${probe.out}`);
      }
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
    // ROUND 5c — CANVAS GATE STANDING PIN: the committed scorecards carry
    // the round-5c numbers (the six 5a promotion-level causes fixed; the
    // v0.3.1 contracts carry the Tag label, the Spinner glyph+color, the
    // Button tone paint maps, captured 18×18 backdrops, authored Avatar
    // viewBoxes, and the Radio dot). SEVEN components PASS the ≤5%
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
      // meanAAMasked pinned per component (round-5c final run, 2026-07-19,
      // Chromium 148.0.7778.96).
      const PIN: Record<string, { mean: number; accept: boolean }> = {
        avatar: { mean: 0, accept: true },
        badge: { mean: 0.07, accept: true },
        banner: { mean: 4.6, accept: true },
        // Button's mean is dominated by the 46 fully-masked text-only cells
        // (named font-raster class) + 5 focus-ring + 2 state×tone S3 cells.
        button: { mean: 7.02, accept: false },
        checkbox: { mean: 3.06, accept: true },
        'progress-bar': { mean: 26.22, accept: false },
        'radio-button': { mean: 0, accept: true },
        spinner: { mean: 0, accept: true },
        // Tag base + disabled are EXACT (0.00); the mean is the two named
        // active/focus state-preview cells (C5 outline approximation).
        tag: { mean: 29.97, accept: false },
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
      console.log('canvas-gate-standing-pin: 7/10 PASS pinned (Avatar, Badge, Banner, Checkbox, RadioButton, Spinner, Thumbnail); 10/10 means at or under their round-5c pins, all >10% cells named');
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
        const batch = proposeBatchFromDump(dump, { corpus: loadTokenCorpus(process.cwd()), contractIdByName: loaded.byName, contractsById: loaded.byId, fileKey: 'WofZT8xaxXuc2Q6Je9S4XE', mintUnbound: true });
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
      if (comp.variants.length !== 42) throw new Error(`Badge must compile 14 tones × 3 progress = 42 variants, got ${comp.variants.length}`);
      const tones = new Set<string>();
      const progresses = new Set<string>();
      for (const v of comp.variants) {
        const m = /^Tone=([^,]+), Progress=(.+)$/.exec(v.name);
        if (!m) throw new Error(`variant name grammar broke: ${v.name}`);
        tones.add(m[1]);
        progresses.add(m[2]);
      }
      if (tones.size !== 14 || progresses.size !== 3) {
        throw new Error(`variant grid wrong: ${tones.size} tones × ${progresses.size} progress values`);
      }
      // Spot checks: per-tone fill substitution + literal token bindings
      // (variable names use SLASHES on the canvas — the emitter's mapping).
      const v0 = comp.variants[0];
      if (v0.name !== 'Tone=info, Progress=incomplete') throw new Error(`default combo must compile first, got ${v0.name}`);
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
      const childKinds = (v0.spec.children ?? []).map((ch: { type: string; name: string }) => `${ch.type}:${ch.name}`);
      if (!childKinds.includes('frame:icon') || !childKinds.includes('text:label')) {
        throw new Error(`compiled anatomy children wrong: ${childKinds.join(', ')}`);
      }

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
          if (store.get('bridge:kind:' + code) !== 'contracts-bundle') throw new Error('payload kind not recorded as contracts-bundle');
          const delivered = await handleRequest(req('/bridge/' + code, { method: 'GET' }), env, deps);
          const body = await delivered.json();
          if (body.status !== 'delivered' || body.kind !== 'contracts-bundle') throw new Error('delivery wrong: ' + JSON.stringify(body).slice(0, 200));
          if (JSON.stringify(body.dump) !== JSON.stringify(bundle)) throw new Error('bundle not byte-identical through the bridge');
          if (body.dump.contracts[0].id !== 'polaris.badge') throw new Error('wrong contract delivered: ' + body.dump.contracts[0].id);
          if (store.has('bridge:dump:' + code) || store.has('bridge:sess:' + code)) throw new Error('deliver-once keys not deleted after delivery');
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
    // PLUGIN ENGINE (Phase 2, plugin v2) — the Figma plugin's engine bundle:
    // (a) a fresh esbuild of figma-sync/plugin/engine/entry.ts matches the
    // committed drift-guard receipt and the headless harness EXECUTES the
    // bundle's generate flow (tokens + Badge + version marker) against a
    // mocked figma global — the stored ds_contracts/specHash must equal the
    // engine's mirror, so the update report's "unchanged" detection can
    // never silently drift from the emitted runtime; (b) mutating core makes
    // the NEXT zip build refuse BY NAME (stale receipt) — the same
    // discipline as the embedded-dump-script guard.
    id: 'plugin-engine-bundle',
    claim: 'C1-determinism',
    run: () => {
      const check = run(process.execPath, ['scripts/plugin-engine-check.mjs']);
      if (check.status !== 0) throw new Error(`plugin-engine-check failed:\n${check.out}`);
      for (const want of [
        '✔ engine bundle fresh vs committed receipt',
        '✔ headless generate: Badge v',
        'stored specHash equals the engine mirror',
        '✔ bundle order: ds.card plans 4 component scripts, dependencies first (ds.avatar → ds.button → ds.badge → ds.card)',
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
        '✔ apply: Badge amended in place (same node ',
        '+prop Experimental, markers updated to v9.9.9',
      ]) {
        if (!check.out.includes(want)) throw new Error(`missing "${want}" in:\n${check.out}`);
      }
      console.log('plugin-update-report: exact plain-words report before apply, amend-in-place after');
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
        [cli, 'generate', 'contracts/badge.contract.json', 'contracts/button.contract.json',
          '--out', 'wc-out', '--target', 'web-components',
          '--emitter', 'packages/emitter-web-components/dist/index.js',
          '--tokens', 'tokens/primitives.tokens.json', '--icons', 'assets/icons'],
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
      console.log('wc-emitter-roundtrip: 5-contract CEM round trip survived (props/enums/defaults/events; non-survivors named), registry + CLI --target web-components proven on the built dist bundle');
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
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const results: Array<{ id: string; claim: string; pass: boolean; error?: string }> = [];
for (const c of cases) {
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
writeFileSync(
  path.join(ROOT, 'evals', 'results.json'),
  JSON.stringify({ passed, total: results.length, results }, null, 2) + '\n',
);
console.log(`\n${passed}/${results.length} evals passed — evals/results.json`);
process.exit(passed === results.length ? 0 : 1);
