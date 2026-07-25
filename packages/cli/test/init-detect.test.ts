/**
 * G14 — `init --detect`, unit-pinned (plain node:test, tsx-run).
 *
 * Load-bearing pins:
 *   · every prefill is marked DETECTED, NOT CONFIRMED (the $detected block
 *     — detection turns authoring into confirmation, never skips the human);
 *   · adapter heuristics: custom-elements manifest → cem, react dependency
 *     → react-tsx, neither → named default;
 *   · runtime-styling hints route toward `extract --draft-capture-config`
 *     (the G6 ramp) — the two gaps close into one path;
 *   · determinism — same facts, same config bytes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detectConfig, gatherDetectFacts, type DetectFacts } from '../src/commands/init.js';

const REACT_EMOTION_FACTS: DetectFacts = {
  pkg: { name: '@acme/kit', dependencies: { react: '^19.0.0', '@emotion/react': '^11.0.0' } },
  existingRoots: ['src/components', 'src'],
  cemManifest: null,
  tokenFiles: ['tokens/acme.tokens.json'],
  moduleCss: false,
};

test('determinism — same facts, same config bytes', () => {
  const a = detectConfig(REACT_EMOTION_FACTS);
  const b = detectConfig(structuredClone(REACT_EMOTION_FACTS));
  assert.equal(JSON.stringify(a.config, null, 2), JSON.stringify(b.config, null, 2));
});

test('react + emotion: react-tsx adapter, detected root/tokens, emotion hint routes to the G6 draft ramp', () => {
  const { config, detected, stylingHints } = detectConfig(REACT_EMOTION_FACTS);
  assert.deepEqual(config.code, { adapter: 'react-tsx', root: 'src/components' });
  assert.deepEqual(config.tokens, ['tokens/acme.tokens.json']);
  assert.ok(detected['code.adapter'].includes('react ^19.0.0 in package.json'));
  assert.deepEqual(stylingHints, ['emotion']);
  assert.ok(detected.styling.includes('--draft-capture-config'), 'runtime styling points at the capture-config draft');
});

test('every prefill is marked detected-not-confirmed in the $detected block', () => {
  const { config } = detectConfig(REACT_EMOTION_FACTS);
  const block = config.$detected as Record<string, string>;
  assert.ok(block.$comment.includes('NOT confirmed'));
  for (const field of ['code.adapter', 'code.root', 'tokens', 'styling']) {
    assert.ok(typeof block[field] === 'string' && block[field].length > 0, `$detected.${field} provenance present`);
  }
});

test('custom-elements manifest wins the adapter: cem + manifest path, no code.root', () => {
  const { config, detected } = detectConfig({
    pkg: { customElements: 'dist/custom-elements.json' },
    existingRoots: ['src'],
    cemManifest: 'dist/custom-elements.json',
    tokenFiles: [],
    moduleCss: false,
  });
  assert.deepEqual(config.code, { adapter: 'cem', manifest: 'dist/custom-elements.json' });
  assert.ok(detected['code.adapter'].includes('cem'));
  assert.ok(detected['code.manifest'].includes('package.json "customElements"'));
});

test('no react, no manifest: the default is NAMED as a default, not passed off as a detection', () => {
  const { config, detected } = detectConfig({
    pkg: { dependencies: { lodash: '^4.0.0' } },
    existingRoots: [],
    cemManifest: null,
    tokenFiles: [],
    moduleCss: false,
  });
  assert.deepEqual(config.code, { adapter: 'react-tsx', root: 'src/components' });
  assert.ok(detected['code.adapter'].includes('DEFAULT'));
  assert.ok(detected['code.root'].includes('DEFAULT'));
  assert.ok(detected.tokens.includes('DEFAULT'));
});

test('tailwind + stylex + module.css hints all surface; css-modules alone stays on the static path', () => {
  const base: DetectFacts = {
    pkg: { dependencies: { react: '^19.0.0', tailwindcss: '^4.0.0', '@stylexjs/stylex': '^0.7.0' } },
    existingRoots: ['src'],
    cemManifest: null,
    tokenFiles: [],
    moduleCss: true,
  };
  const multi = detectConfig(base);
  assert.deepEqual(multi.stylingHints, ['tailwind', 'stylex', 'css-modules']);
  const cssOnly = detectConfig({ ...base, pkg: { dependencies: { react: '^19.0.0' } } });
  assert.deepEqual(cssOnly.stylingHints, ['css-modules']);
  assert.ok(cssOnly.detected.styling.includes('static pass extracts anatomy'), 'css-modules does not get routed to computed capture');
});

test('gatherDetectFacts reads a real directory: pkg, roots, manifest, tokens, module.css', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ds-detect-'));
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', dependencies: { react: '^19.0.0' } }));
  mkdirSync(path.join(dir, 'src', 'components', 'Button'), { recursive: true });
  writeFileSync(path.join(dir, 'src', 'components', 'Button', 'Button.module.css'), '.root{}');
  mkdirSync(path.join(dir, 'tokens'), { recursive: true });
  writeFileSync(path.join(dir, 'tokens', 'core.tokens.json'), '{}');
  writeFileSync(path.join(dir, 'custom-elements.json'), '{}');
  const facts = gatherDetectFacts(dir);
  assert.equal(facts.pkg?.name, 'x');
  assert.equal(facts.existingRoots[0], 'src/components');
  assert.equal(facts.cemManifest, 'custom-elements.json');
  assert.deepEqual(facts.tokenFiles, ['tokens/core.tokens.json']);
  assert.equal(facts.moduleCss, true);
});
