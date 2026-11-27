import test from 'node:test';
import assert from 'node:assert/strict';
import { canonical, hash } from '../src/roundtrip/surface.mjs';
import { seal, resolveBundle, resolved, patchJSON } from '../src/roundtrip/model.mjs';

function fixture() {
  const bundle = seal({
    contract: 'system-aware/0.1',
    root: 'control',
    system: {
      id: 'example',
      version: '1',
      tokens: {
        primitive: { type: 'color', value: '#123456' },
        semantic: { type: 'color', alias: 'primitive' },
        component: { type: 'color', alias: 'semantic' },
      },
    },
    components: {
      glyph: { id: 'glyph', requires: [] },
      control: { id: 'control', requires: [], instances: { icon: { component: 'glyph', colorToken: 'component' } } },
    },
  });
  bundle.components.control.requires = [{ id: 'glyph', revision: bundle.components.glyph.revision }];
  return seal(bundle);
}

test('token and component dependencies resolve before their consumers', () => {
  const bundle = fixture();
  assert.deepEqual(resolveBundle(bundle), {
    status: 'ready',
    gaps: [],
    tokenOrder: ['primitive', 'semantic', 'component'],
    componentOrder: ['glyph', 'control'],
  });
  assert.equal(resolved(bundle, 'component'), '#123456');
  const reordered = {
    ...bundle,
    system: { ...bundle.system, tokens: Object.fromEntries(Object.entries(bundle.system.tokens).reverse()) },
  };
  assert.equal(canonical(seal(reordered)), canonical(bundle));
  assert.equal(hash(reordered), hash(bundle));
});

test('missing dependencies, alias cycles, and stale revisions are named', () => {
  const cases = [
    [(b) => delete b.components.glyph, 'missing-component-contract', 'glyph'],
    [(b) => delete b.system.tokens.primitive, 'missing-token', 'primitive'],
    [(b) => (b.system.tokens.primitive.alias = 'component'), 'token-cycle', 'component'],
    [(b) => (b.system.tokens.primitive.type = 'number'), 'token-type-mismatch', 'semantic'],
    [(b) => (b.components.control.requires = []), 'undeclared-component-dependency', 'glyph'],
    [(b) => (b.components.control.requires[0].revision = 'old'), 'dependency-revision-mismatch', 'glyph'],
    [(b) => (b.components.glyph.systemRef.revision = 'old'), 'system-revision-mismatch', 'glyph'],
    [
      (b) => (b.components.glyph.requires = [{ id: 'control', revision: b.components.control.revision }]),
      'component-cycle',
      'control',
    ],
  ];
  for (const [mutate, code, id] of cases) {
    const bundle = fixture();
    mutate(bundle);
    const result = resolveBundle(bundle);
    assert.equal(result.status, 'blocked', code);
    assert(
      result.gaps.some((g) => g.code === code && g.id === id),
      code,
    );
  }
});

test('JSON token edits preserve surrounding text and refuse a stale value', () => {
  const source = '{\n  // owned token\n  "semantic": "{primitive}", "keep": true\n}\n';
  assert.equal(
    patchJSON(source, ['semantic'], '{primitive}', '{replacement}'),
    source.replace('{primitive}', '{replacement}'),
  );
  assert.throws(() => patchJSON(source, ['missing'], 0, 1), /missing source path/);
  assert.throws(() => patchJSON(source, ['semantic'], '{old}', '{replacement}'), /stale source value/);
  assert.throws(
    () => patchJSON('{"semantic":"{primitive}","semantic":"{primitive}"}', ['semantic'], '{primitive}', '{replacement}'),
    /duplicate source key: semantic/,
  );
  assert.throws(
    () => patchJSON('{"semantic":"{primitive}", broken}', ['semantic'], '{primitive}', '{replacement}'),
    /invalid source JSON/,
  );
});
