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
      const parseVariants = (file: string) => JSON.parse(
        readFileSync(path.join(syncDir, file), 'utf8').match(/const VARIANTS = (\[[\s\S]*?\n\]);/)![1]);
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
      const variants = JSON.parse(readFileSync(path.join(SCRATCH, 'figma-sync', f), 'utf8').match(/const VARIANTS = (\[[\s\S]*?\n\])/)![1]);
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
      if (JSON.parse(script.match(/const TEXT_PROPS = (\[.*?\])/)![1]).length !== 0) throw new Error('NONE prop leaked onto the canvas');
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
      const base = JSON.parse(script.match(/const VARIANTS = (\[[\s\S]*?\n\]);/)![1]);
      if (base.length !== 12 || base[0].name !== 'Variant=Primary, Size=Medium')
        throw new Error('Base cartesian must stay the pure enum API (previews ride a separate overlay)');
      const sv = JSON.parse(script.match(/const STATE_VARIANTS = (\[[\s\S]*?\n\]);/)![1]);
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
      const variants = JSON.parse(script.match(/const VARIANTS = (\[[\s\S]*?\n\]);/)![1]);
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
