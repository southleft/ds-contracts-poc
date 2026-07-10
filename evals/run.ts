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
  for (const dir of ['contracts', 'tokens', 'scripts', 'core', 'parity', 'src', 'catalog', 'context', 'assets', 'extract']) {
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
      if (disabled?.spec.bindings?.opacity !== 'opacity/disabled')
        throw new Error('Disabled preview must bind opacity/disabled');
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
