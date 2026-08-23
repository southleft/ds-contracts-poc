/**
 * G14 — bulk candidate acceptance, unit-pinned (plain node:test, tsx-run).
 *
 * Load-bearing pins:
 *   · `exact` accepts ONLY the unambiguous unique-candidate raw values —
 *     multi-candidate, zero-candidate, axis-scoped, and non-root-state items
 *     are refused BY NAME (the resolve.ts rule: guessing names is forbidden);
 *   · nothing is silently accepted — every acceptance is ledgered, every
 *     refusal carries its reason;
 *   · the generated proposals are never mutated: the shell writes
 *     contracts-accepted/, and the pure apply never touches its input;
 *   · determinism — same extraction, same plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  acceptanceLedgerMarkdown,
  applyAcceptances,
  planAcceptances,
  runAcceptCommand,
  type PlannedAcceptance,
} from '../../../extract/accept-candidates.js';
import { ContractSchema, type Contract } from '../../../scripts/contract-schema.js';
import type { ExtractedComponent } from '../../../extract/types.js';

// One component exercising every triage class in a single extraction.
const CHIP: ExtractedComponent = {
  name: 'Chip',
  source: 'src/components/Chip/Chip.tsx',
  adapter: 'react-tsx',
  props: [],
  anatomy: {
    root: { parts: { label: {} } },
    element: 'span',
    states: ['hover'],
    rawValues: [
      // unique exact-value candidate → bulk-acceptable
      { selector: '.chip', property: 'background-color', value: '#ff0000', candidates: ['color.bg.danger'] },
      // two tokens share the value → ambiguous, refused by name
      { selector: '.chip', property: 'border-color', value: '#eeeeee', candidates: ['color.border.subtle', 'color.bg.surface'] },
      // no token has the value → refused by name
      { selector: '.chip', property: 'padding-left', value: '13px', candidates: [] },
      // unique candidate on a state rule (root) → accepted as a state binding
      { selector: '.chip:hover', property: 'color', value: '#111111', candidates: ['color.text.hover'] },
      // unique candidate but axis-scoped → refused (tokensByProp is review work)
      { selector: '.chip-tone-info', property: 'color', value: '#0000ff', candidates: ['color.text.info'] },
      // unique candidate, state on a NON-root part → refused (root-only rule)
      { selector: '.label:hover', property: 'color', value: '#222222', candidates: ['color.text.label'] },
      // unique candidate but NO mintable join → refused (no part context)
      { selector: '.orphan', property: 'color', value: '#333333', candidates: ['color.text.orphan'] },
    ],
    notes: [],
    mintables: [
      { selector: '.chip', part: 'root', cssProperty: 'background-color', raw: '#ff0000' },
      { selector: '.chip', part: 'root', cssProperty: 'border-color', raw: '#eeeeee' },
      { selector: '.chip', part: 'root', cssProperty: 'padding-left', raw: '13px' },
      { selector: '.chip:hover', part: 'root', cssProperty: 'color', state: 'hover', raw: '#111111' },
      { selector: '.chip-tone-info', part: 'root', cssProperty: 'color', axis: { prop: 'tone', value: 'info' }, raw: '#0000ff' },
      { selector: '.label:hover', part: 'label', cssProperty: 'color', state: 'hover', raw: '#222222' },
    ],
  },
};

const CONTRACT = {
  id: 'acme.chip',
  name: 'Chip',
  version: '0.1.0',
  status: 'draft',
  description: 'test fixture',
  semantics: { element: 'span' },
  props: [],
  states: ['hover'],
  anatomy: { root: { parts: { label: {} } } },
  bindings: {
    figma: { anchors: { fileKey: null, componentSetKey: null } },
    code: { anchors: { importPath: 'src/components/Chip/Chip', export: 'Chip' } },
  },
};

// ---------------------------------------------------------------------------
// planAcceptances — the triage referee
// ---------------------------------------------------------------------------

test('exact mode: only the unambiguous unique-candidate items are accepted', () => {
  const { accepted, refused } = planAcceptances([CHIP], { kind: 'exact' });
  assert.deepEqual(
    accepted.map((a) => `${a.part}${a.state ? `:${a.state}` : ''}.${a.property}=${a.to}`),
    ['root.background-color={color.bg.danger}', 'root:hover.color={color.text.hover}'],
  );
  assert.equal(refused.length, 5);
});

test('every refusal is BY NAME — reason strings pin the five triage classes', () => {
  const { refused } = planAcceptances([CHIP], { kind: 'exact' });
  const reasonFor = (selector: string) => refused.find((r) => r.selector === selector)?.reason ?? '';
  assert.ok(reasonFor('.chip').includes('2 tokens share the value'), 'ambiguity named with the candidate list');
  assert.ok(reasonFor('.chip').includes('color.border.subtle'), 'candidates listed in the refusal');
  assert.match(reasonFor('.chip'), /never picks among equals/);
  assert.ok(refused.find((r) => r.property === 'padding-left')!.reason.includes('no token in the tree'));
  assert.ok(reasonFor('.chip-tone-info').includes('axis-scoped (behind tone=info)'));
  assert.ok(reasonFor('.label:hover').includes('root only'));
  assert.ok(reasonFor('.orphan').includes('no part context'));
});

test('plan is deterministic — same extraction, same plan', () => {
  const a = planAcceptances([CHIP], { kind: 'exact' });
  const b = planAcceptances([structuredClone(CHIP)], { kind: 'exact' });
  assert.deepEqual(a, b);
});

test('list mode: explicit ack accepts an ambiguous item; override outside candidates is FLAGGED', () => {
  const { accepted, refused } = planAcceptances([CHIP], {
    kind: 'list',
    items: [
      { component: 'Chip', selector: '.chip', property: 'border-color', value: '#eeeeee', to: '{color.border.subtle}' },
      { component: 'Chip', selector: '.chip', property: 'background-color', value: '#ff0000', to: '{color.bg.brand}' },
    ],
  });
  assert.equal(refused.length, 0);
  assert.equal(accepted[0].to, '{color.border.subtle}');
  assert.equal(accepted[0].explicitOverride, false, 'named one of the candidates — not an override');
  assert.equal(accepted[1].explicitOverride, true, 'token outside the candidate list is an explicit override, named');
});

test('list mode refusals: unknown component, unmatched item, malformed token ref, axis-scoped', () => {
  const { accepted, refused } = planAcceptances([CHIP], {
    kind: 'list',
    items: [
      { component: 'Nope', selector: '.x', property: 'color', value: '#000', to: '{a.b}' },
      { component: 'Chip', selector: '.chip', property: 'color', value: '#999999', to: '{a.b}' },
      { component: 'Chip', selector: '.chip', property: 'background-color', value: '#ff0000', to: 'color.bg.danger' },
      { component: 'Chip', selector: '.chip-tone-info', property: 'color', value: '#0000ff', to: '{color.text.info}' },
    ],
  });
  assert.equal(accepted.length, 0);
  assert.ok(refused[0].reason.includes('not in the extraction'));
  assert.ok(refused[1].reason.includes('no reported raw value matches'));
  assert.ok(refused[2].reason.includes('brace-wrapped token ref'));
  assert.ok(refused[3].reason.includes('axis-scoped'));
});

// ---------------------------------------------------------------------------
// applyAcceptances — bindings land, nothing overwritten, input untouched
// ---------------------------------------------------------------------------

test('apply: base binding + root state binding land; the input contract is never mutated', () => {
  const base = ContractSchema.parse(structuredClone(CONTRACT));
  const before = JSON.stringify(base);
  const { accepted } = planAcceptances([CHIP], { kind: 'exact' });
  const r = applyAcceptances(base, accepted);
  assert.equal(JSON.stringify(base), before, 'input contract untouched (pure apply)');
  assert.equal(r.refused.length, 0);
  const root = (r.contract.anatomy as Record<string, { tokens?: Record<string, string>; states?: Record<string, Record<string, string>> }>).root;
  assert.equal(root.tokens?.['background-color'], '{color.bg.danger}');
  assert.equal(root.states?.hover?.color, '{color.text.hover}');
  assert.doesNotThrow(() => ContractSchema.parse(r.contract), 'accepted contract stays schema-valid');
});

test('apply refuses to overwrite an existing binding, by name', () => {
  const bound = structuredClone(CONTRACT) as unknown as Contract;
  (bound.anatomy as Record<string, { tokens?: Record<string, string> }>).root.tokens = {
    'background-color': '{color.bg.existing}',
  };
  const { accepted } = planAcceptances([CHIP], { kind: 'exact' });
  const r = applyAcceptances(ContractSchema.parse(bound), accepted);
  const refusal = r.refused.find((x) => x.property === 'background-color');
  assert.ok(refusal?.reason.includes('already bound to {color.bg.existing}'));
  assert.ok(refusal?.reason.includes('nothing overwritten'));
  assert.equal(r.applied.length, accepted.length - 1, 'the other acceptance still lands');
});

test('apply refuses a part the contract anatomy does not carry', () => {
  const acc: PlannedAcceptance = {
    component: 'Chip', part: 'ghost', selector: '.ghost', property: 'color',
    value: '#000', to: '{a.b}', candidates: ['a.b'], explicitOverride: false,
  };
  const r = applyAcceptances(ContractSchema.parse(structuredClone(CONTRACT)), [acc]);
  assert.ok(r.refused[0].reason.includes('part "ghost" not in the proposed contract anatomy'));
});

// ---------------------------------------------------------------------------
// Ledger — every acceptance named, provenance carried
// ---------------------------------------------------------------------------

test('ledger markdown names component, channel, literal, token, and the ack', () => {
  const { accepted } = planAcceptances([CHIP], { kind: 'exact' });
  const md = acceptanceLedgerMarkdown(accepted.map((a) => ({ ...a, ack: 'explicit CLI --accept-candidates exact' })));
  assert.ok(md.includes('| Chip | root.background-color | — | `#ff0000` | `{color.bg.danger}` | 1 | explicit CLI --accept-candidates exact |'));
  assert.ok(md.includes('| Chip | root.color | hover |'), 'state acceptance rendered with its state');
  assert.ok(md.includes('`.chip { background-color: #ff0000 }`'), 'selector provenance listed');
  assert.ok(md.includes('refused by name'), 'the ledger states the refusal doctrine');
});

// ---------------------------------------------------------------------------
// Shell integration — real fs round trip, proposals never move
// ---------------------------------------------------------------------------

test('runAcceptCommand: contracts-accepted/ written, proposals untouched, ledger appended, re-run is a no-op', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-accept-'));
  const out = path.join(dir, 'out');
  mkdirSync(path.join(out, 'contracts'), { recursive: true });
  writeFileSync(path.join(out, 'code-extraction.json'), JSON.stringify([CHIP], null, 2));
  const proposalPath = path.join(out, 'contracts', 'chip.contract.json');
  writeFileSync(proposalPath, JSON.stringify(CONTRACT, null, 2) + '\n');
  const proposalBytes = readFileSync(proposalPath, 'utf8');
  const cfgPath = path.join(dir, 'extract.config.json');
  writeFileSync(cfgPath, JSON.stringify({ code: { adapter: 'react-tsx', root: 'src' }, out }));

  const first = runAcceptCommand('exact', cfgPath);
  assert.equal(first.accepted, 2);
  assert.equal(first.refused, 5);
  assert.equal(readFileSync(proposalPath, 'utf8'), proposalBytes, 'the generated proposal never moves');
  const acceptedContract = ContractSchema.parse(
    JSON.parse(readFileSync(path.join(out, 'contracts-accepted', 'chip.contract.json'), 'utf8')),
  );
  assert.equal(
    (acceptedContract.anatomy as Record<string, { tokens?: Record<string, string> }>).root.tokens?.['background-color'],
    '{color.bg.danger}',
  );
  const ledger = JSON.parse(readFileSync(path.join(out, 'accepted-candidates.json'), 'utf8')) as { ack: string }[];
  assert.equal(ledger.length, 2);
  assert.ok(ledger.every((e) => e.ack === 'explicit CLI --accept-candidates exact'));
  assert.ok(existsSync(path.join(out, 'accepted-candidates.md')));

  // second run: everything already ledgered — nothing re-applied, ledger stable
  const second = runAcceptCommand('exact', cfgPath);
  assert.equal(second.accepted, 0);
  const ledgerAfter = JSON.parse(readFileSync(path.join(out, 'accepted-candidates.json'), 'utf8')) as unknown[];
  assert.equal(ledgerAfter.length, 2, 'ledger does not double-book on re-run');
});

test('runAcceptCommand list mode: a refused explicit request FAILS the run (nothing partial hidden)', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-accept-list-'));
  const out = path.join(dir, 'out');
  mkdirSync(path.join(out, 'contracts'), { recursive: true });
  writeFileSync(path.join(out, 'code-extraction.json'), JSON.stringify([CHIP], null, 2));
  writeFileSync(path.join(out, 'contracts', 'chip.contract.json'), JSON.stringify(CONTRACT, null, 2) + '\n');
  const cfgPath = path.join(dir, 'extract.config.json');
  writeFileSync(cfgPath, JSON.stringify({ code: { adapter: 'react-tsx', root: 'src' }, out }));
  const listPath = path.join(dir, 'acceptances.json');
  writeFileSync(
    listPath,
    JSON.stringify([{ component: 'Chip', selector: '.nope', property: 'color', value: '#000', to: '{a.b}' }]),
  );
  assert.throws(() => runAcceptCommand(listPath, cfgPath), /refused/);
});
