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
  for (const dir of ['contracts', 'tokens', 'scripts', 'core', 'parity', 'src', 'catalog', 'context', 'assets', 'extract', 'playground', 'workers']) {
    cpSync(path.join(ROOT, dir), path.join(SCRATCH, dir), { recursive: true });
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
  claim: 'C1-determinism' | 'C2-refusal' | 'C3-detection' | 'C4-convergence' | 'C5-extraction' | 'C6-theming';
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
      // Banner title rides Text headingSm the same way.
      const banner = JSON.parse(readFileSync(path.join(ROOT, 'examples/polaris/contracts/banner.contract.json'), 'utf8'));
      if (banner.anatomy.root.parts?.title?.tokens?.['font-size'] !== '{p.text-heading-sm-font-size}') {
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
      if (!comp.description.includes('Cursor changes (pointer on hover) exist only in the coded component.')) {
        throw new Error('annotate-verdict declared facts must land as description annotation copy');
      }
      if (!comp.description.includes('[disabled]')) throw new Error('state-plane declared facts must be annotated with their state');
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
      const button = readFileSync(path.join(ROOT, 'examples/polaris/figma/button.figma.js'), 'utf8');
      if (!button.includes('li.fillClear && !spec.fill')) throw new Error('committed button script must carry the runtime fillClear guard');
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
        validateContract(enriched, new Map([[enriched.id, enriched]]), errs, new Map());
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
