/**
 * G6 — draft capture-config generation, unit-pinned (plain node:test,
 * tsx-run, the figma-receive.test.ts discipline).
 *
 * Load-bearing pins:
 *   · determinism — same extraction, byte-same draft (the pure core rule);
 *   · every non-inferable field carries an explicit "__review:*" marker;
 *   · the capture runner REFUSES a draft by name until the top-level marker
 *     is deleted — draft ≠ approved, proved here rather than hoped for.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  DRAFT_MARKER_KEY,
  draftCaptureConfig,
  draftRefusalMessage,
} from '../../../extract/draft-capture-config.js';
import { loadConfig as loadCaptureConfig } from '../../../extract/computed/capture.js';
import type { ExtractedComponent } from '../../../extract/types.js';

const EXTRACTION: ExtractedComponent[] = [
  {
    name: 'Badge',
    source: 'src/components/Badge/Badge.tsx',
    adapter: 'react-tsx',
    props: [
      { name: 'tone', kind: 'enum', values: ['info', 'success', 'critical'], optional: true, confidence: 'declared' },
      { name: 'size', kind: 'enum', values: ['sm', 'md'], optional: true, confidence: 'declared' },
      { name: 'disabled', kind: 'boolean', optional: true, confidence: 'declared' },
      { name: 'rounded', kind: 'boolean', optional: true, confidence: 'declared' },
      { name: 'label', kind: 'string', optional: false, confidence: 'declared' },
      { name: 'onDismiss', kind: 'event', optional: true, confidence: 'declared' },
    ],
  },
  {
    name: 'CardStack',
    source: 'src/components/CardStack/CardStack.tsx',
    adapter: 'react-tsx',
    props: [
      { name: 'elevation', kind: 'enum', values: ['0', '1', '8'], optional: true, confidence: 'declared' },
      { name: 'checked', kind: 'boolean', optional: true, confidence: 'declared' },
    ],
  },
];

const OPTS = {
  libraryPackage: '@acme/kit',
  libraryVersion: '2.0.0',
  contractsDir: 'ds-contracts/out/contracts',
  tokensDtcg: ['tokens/acme.dtcg.json'],
};

test('draft is deterministic — same extraction, byte-same draft', () => {
  const a = draftCaptureConfig(EXTRACTION, OPTS);
  const b = draftCaptureConfig(structuredClone(EXTRACTION), { ...OPTS });
  assert.equal(JSON.stringify(a.config, null, 2), JSON.stringify(b.config, null, 2));
  assert.equal(a.reviewFields, b.reviewFields);
});

test('components prefill: axes from enum props, contract path, sampleText, inferable stateProps', () => {
  const { config, components } = draftCaptureConfig(EXTRACTION, OPTS);
  assert.equal(components, 2);
  const comps = config.components as Record<string, unknown>[];
  const badge = comps[0];
  assert.equal(badge.name, 'Badge');
  assert.equal(badge.importName, 'Badge');
  assert.equal(badge.contract, 'ds-contracts/out/contracts/badge.contract.json');
  assert.equal(badge.sampleText, 'Badge');
  assert.deepEqual(badge.axes, ['tone', 'size']);
  // disabled is the inferable state boolean; checked on the second component
  assert.deepEqual(badge.stateProps, [{ prop: 'disabled', state: 'disabled' }]);
  assert.deepEqual((comps[1] as { stateProps: unknown }).stateProps, [{ prop: 'checked', state: 'checked' }]);
  // kebab in the contract path for multi-word names
  assert.equal(comps[1].contract, 'ds-contracts/out/contracts/card-stack.contract.json');
});

test('every non-inferable field carries an explicit __review marker with guidance', () => {
  const { config, reviewFields } = draftCaptureConfig(EXTRACTION, OPTS);
  const lib = config.library as Record<string, string>;
  for (const key of ['__review:classPrefix', '__review:classAllow', '__review:varPrefix']) {
    assert.ok(typeof lib[key] === 'string' && lib[key].length > 20, `library.${key} guidance present`);
  }
  assert.ok((config.mount as Record<string, string>)['__review:mount'].includes('mount recipe'));
  assert.ok((config.tokens as Record<string, string>)['__review:tokens'].length > 0);
  const badge = (config.components as Record<string, string>[])[0];
  assert.ok(badge['__review:stateProps'].includes('rounded'), 'unmapped boolean named for review');
  assert.ok(badge['__review:fixedProps'].includes('label'), 'required prop named for review');
  assert.ok(badge['__review:callbackProps'].includes('onDismiss'), 'event prop named for review');
  const stack = (config.components as Record<string, string>[])[1];
  assert.ok(stack['__review:axisValueMap'].includes('elevation'), 'numeric-looking axis named for review');
  assert.ok(reviewFields >= 9, `all markers counted (got ${reviewFields})`);
});

test('detected package/version still carries a confirm-me marker (detected ≠ confirmed)', () => {
  const detected = draftCaptureConfig(EXTRACTION, OPTS).config.library as Record<string, unknown>;
  assert.equal(detected.package, '@acme/kit');
  assert.ok(String(detected['__review:version']).includes('NOT confirmed'));
  const blank = draftCaptureConfig(EXTRACTION, { ...OPTS, libraryPackage: null, libraryVersion: null })
    .config.library as Record<string, unknown>;
  assert.ok(String(blank['__review:package']).includes('could not be read'));
});

test('capture runner REFUSES an unreviewed draft by name; marker removal opens the gate', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-draft-'));
  const { config } = draftCaptureConfig(EXTRACTION, OPTS);
  const draftPath = path.join(dir, 'capture-config.draft.json');
  writeFileSync(draftPath, JSON.stringify(config, null, 2));
  assert.throws(
    () => loadCaptureConfig(dir, draftPath),
    (err: Error) => err.message.includes('UNREVIEWED DRAFT') && err.message.includes(DRAFT_MARKER_KEY),
    'draft must be refused with the named message',
  );
  assert.ok(draftRefusalMessage(draftPath).includes('A draft never captures'));
  // the human's approval act: delete the marker (contract paths stubbed empty
  // here — the marker gate is the thing under test, it must fire FIRST)
  const approved = structuredClone(config) as Record<string, unknown>;
  delete approved[DRAFT_MARKER_KEY];
  approved.components = [];
  const approvedPath = path.join(dir, 'capture-config.json');
  writeFileSync(approvedPath, JSON.stringify(approved, null, 2));
  assert.doesNotThrow(() => loadCaptureConfig(dir, approvedPath));
});

test('a committed hand-authored config is NOT a draft — the gate is marker-keyed, not heuristic', () => {
  // HERMETIC (eval-scratch finding): loadConfig also checks each component's
  // referenced contract file exists — the committed configs point into
  // examples/, which the eval scratch does not stage. A synthetic
  // hand-authored config (no draft marker) with a real temp contract proves
  // the gate is marker-keyed without repo-layout coupling.
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-handauthored-'));
  writeFileSync(path.join(dir, 'x.contract.json'), JSON.stringify({ id: 'x.a', name: 'A' }));
  const cfg = {
    library: { package: 'x', version: '0', framework: 'react', classPrefix: '' },
    mount: { imports: [], wrapperOpen: '<>', wrapperClose: '</>' },
    tokens: { dtcg: [], css: 'x.css' },
    browser: { viewport: { width: 100, height: 100 }, deviceScaleFactor: 1, colorScheme: 'light' },
    stage: { width: 100, height: 50, padding: 8 },
    enumeration: { cartesianLimit: 8, unsetLabel: '__unset' },
    components: [{ name: 'A', importName: 'A', contract: 'x.contract.json', sampleText: 'A', axes: [] }],
  };
  const cfgPath = path.join(dir, 'hand.json');
  writeFileSync(cfgPath, JSON.stringify(cfg));
  assert.doesNotThrow(() => loadCaptureConfig(dir, cfgPath));
});
