import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { extractCem, readCemDeclarations } from './cem.js';

// Selected actual declarations from Altitude 0639eccd15. These fixtures test
// metadata ingestion only; declared slots/booleans do not prove runtime support.
const button = {
  kind: 'class', customElement: true, name: 'ALButton', tagName: 'al-button',
  description: 'Component: al-button',
  members: [
    { kind: 'field', name: 'el', static: true, type: { text: 'string' }, default: "'al-button'" },
    { kind: 'field', name: 'formController', privacy: 'protected', default: 'new FormController(this)' },
    { kind: 'field', name: 'variant', type: { text: "'secondary' | 'tertiary' | 'bare' | 'danger'" }, attribute: 'variant' },
    { kind: 'field', name: 'isDisabled', type: { text: 'boolean' }, attribute: 'isDisabled' },
    { kind: 'field', name: 'isPressed', type: { text: "boolean | 'mixed'" }, attribute: 'isPressed' },
    { kind: 'method', name: 'handleOnClick' },
  ],
  attributes: [
    { name: 'variant', fieldName: 'variant', type: { text: "'secondary' | 'tertiary' | 'bare' | 'danger'" } },
    { name: 'isDisabled', fieldName: 'isDisabled', type: { text: 'boolean' } },
    { name: 'isPressed', fieldName: 'isPressed', type: { text: "boolean | 'mixed'" } },
  ],
  slots: [{ name: '', description: 'The button text content.' }, { name: 'before' }, { name: 'after' }],
  cssParts: [{ name: 'button', description: '' }],
};
const card = {
  kind: 'class', customElement: true, name: 'ALCard', tagName: 'al-card',
  members: [
    { kind: 'field', name: 'el', static: true, type: { text: 'string' }, default: "'al-card'" },
    { kind: 'field', name: 'layout', type: { text: "'inline'" }, attribute: 'layout' },
    { kind: 'field', name: 'variant', type: { text: "'bare'" }, attribute: 'variant' },
  ],
  attributes: [
    { name: 'layout', fieldName: 'layout', type: { text: "'inline'" } },
    { name: 'variant', fieldName: 'variant', type: { text: "'bare'" } },
  ],
  slots: ['', 'actions-start', 'actions-end', 'action-right', 'image', 'header'].map(name => ({ name })),
};
const manifest = (declaration: unknown) => ({
  modules: [{ path: 'components/button/button.ts', declarations: [declaration] }],
});

test('actual-shaped Altitude declarations preserve exact identity, API and slots without inference', () => {
  const input = { modules: [
    { path: 'components/button/button.ts', declarations: [button] },
    { path: 'components/card/card.ts', declarations: [card] },
  ] };
  const before = JSON.stringify(input);
  const result = readCemDeclarations(input);
  assert.deepEqual(result.problems, []);
  assert.equal(JSON.stringify(input), before, 'pure reader does not mutate source metadata');
  assert.deepEqual(readCemDeclarations(input), result, 'same input yields exact same facts');
  const [b, c] = result.declarations;
  assert.deepEqual([b.modulePath, b.className, b.tagName], ['components/button/button.ts', 'ALButton', 'al-button']);
  assert.deepEqual(b.properties.map(p => p.name), ['variant', 'isDisabled', 'isPressed']);
  assert.equal(b.properties[0].typeText, "'secondary' | 'tertiary' | 'bare' | 'danger'");
  assert.equal(b.properties[2].typeText, "boolean | 'mixed'");
  assert.equal(Object.hasOwn(b.properties[1], 'default'), false, 'no fabricated false default');
  assert.deepEqual(b.attributes[1], { name: 'isDisabled', fieldName: 'isDisabled', typeText: 'boolean' });
  assert.deepEqual(b.slots.map(s => s.name), ['', 'before', 'after']);
  assert.deepEqual(b.cssParts, [{ name: 'button', description: '' }]);
  assert.deepEqual(b.events, []);
  assert.equal(c.properties[0].typeText, "'inline'", 'singleton literal is not widened to string or row');
  assert.equal(c.properties[1].typeText, "'bare'");
  assert.ok(c.slots.some(s => s.name === 'action-right'), 'declaration is preserved; runtime slot coverage must be measured separately');
});

test('exact event names, attribute mapping, raw default expressions and CSS overrides survive', () => {
  const result = readCemDeclarations(manifest({
    kind: 'class', customElement: true, name: 'ALCheckbox', tagName: 'al-checkbox',
    attributes: [{ name: 'is-checked', fieldName: 'isChecked', type: { text: 'boolean' }, default: 'false' }],
    members: [
      { kind: 'field', name: 'isChecked', attribute: 'is-checked', type: { text: 'boolean' }, default: 'false' },
      { kind: 'field', name: 'readonlyValue', readonly: true, type: { text: 'string' }, default: "compute('value')" },
      { kind: 'field', name: 'privateValue', privacy: 'private' },
    ],
    events: [{ name: 'onCheckboxChange', type: { text: 'CustomEvent<{ checked: boolean }>' }, description: '' }],
    cssProperties: [{ name: '--component-override', type: { text: '<color>' }, default: 'var(--theme-accent)' }],
  }));
  assert.deepEqual(result.problems, []);
  const [facts] = result.declarations;
  assert.equal(facts.events[0].name, 'onCheckboxChange', 'no onOnCheckboxChange inference');
  assert.equal(facts.events[0].typeText, 'CustomEvent<{ checked: boolean }>');
  assert.equal(facts.properties[0].default, 'false', 'raw source spelling is not evaluated');
  assert.equal(facts.properties[1].default, "compute('value')");
  assert.equal(facts.properties[1].readonly, true);
  assert.equal(facts.attributes[0].name, 'is-checked');
  assert.equal(facts.attributes[0].fieldName, 'isChecked');
  assert.equal(facts.cssProperties[0].default, 'var(--theme-accent)');
});

test('duplicate and conflicting field mappings remain visible with named problems', () => {
  const input = structuredClone(button);
  input.attributes.push({ name: 'disabled', fieldName: 'isDisabled', type: { text: 'string' } });
  input.attributes.push({ ...input.attributes[0] });
  input.members.push({ kind: 'field', name: 'isDisabled', type: { text: 'boolean' }, attribute: 'isDisabled' });
  const result = readCemDeclarations(manifest(input));
  assert.equal(result.declarations[0].attributes.length, 5, 'ambiguous declarations are not deduplicated');
  assert.equal(result.declarations[0].properties.length, 4);
  for (const code of ['duplicate-name', 'conflicting-field-mapping', 'unresolved-field-mapping', 'unresolved-attribute-mapping'])
    assert.ok(result.problems.some(p => p.code === code), code);
  assert.ok(result.problems.some(p => p.path === '$.modules[0].declarations[0].members[6].name'), 'path retains original index after excluded static/protected/method members');
});

test('mapped type/default conflicts are reported instead of choosing an answer', () => {
  const input = structuredClone(button);
  input.attributes[1].type.text = 'string';
  Object.assign(input.attributes[1], { default: 'false' });
  Object.assign(input.members[3], { default: 'true' });
  const result = readCemDeclarations(manifest(input));
  assert.equal(result.problems.filter(p => p.code === 'conflicting-field-declaration').length, 2);
  assert.equal(result.declarations[0].attributes[1].typeText, 'string');
  assert.equal(result.declarations[0].properties[1].typeText, 'boolean');
  assert.equal(result.declarations[0].attributes[1].default, 'false');
  assert.equal(result.declarations[0].properties[1].default, 'true');
});

test('two fields cannot silently claim an attribute whose fieldName was omitted', () => {
  const result = readCemDeclarations(manifest({ ...button,
    attributes: [{ name: 'checked', type: { text: 'boolean' } }],
    members: [
      { kind: 'field', name: 'checked', attribute: 'checked', type: { text: 'boolean' } },
      { kind: 'field', name: 'isChecked', attribute: 'checked', type: { text: 'boolean' } },
    ],
  }));
  assert.equal(result.declarations[0].properties.length, 2);
  assert.ok(result.problems.some(p => p.code === 'conflicting-attribute-mapping'));
});

test('malformed documents/declarations are named and do not erase valid sibling evidence', () => {
  for (const input of [null, [], 'not a manifest', {}, { modules: {} }, { modules: [null] }]) {
    const result = readCemDeclarations(input);
    assert.ok(result.problems.length > 0, JSON.stringify(input));
    assert.deepEqual(result.declarations, []);
  }
  const result = readCemDeclarations({ modules: [{ path: 'components.ts', declarations: [
    null,
    { kind: 'class', customElement: true, name: 'MissingTag', attributes: 'not an array' },
    { kind: 'class', customElement: 'yes', name: 'BadMarker' },
    { kind: 'function', name: 'ordinaryUtility' },
    { ...button, attributes: [null, { name: 'variant', type: 'string', default: false }, { name: 2 }],
      members: [null, { kind: 'field', name: 'unknownVisibility', privacy: 'maybe' },
        { kind: 'field', name: 'unknownStatic', static: 'yes' }, { kind: 'field', name: 'missingType', type: {} }] },
    card,
  ] }] });
  assert.deepEqual(result.declarations.map(d => d.className), ['ALButton', 'ALCard']);
  for (const code of ['invalid-declaration', 'invalid-array', 'invalid-string', 'invalid-entry', 'invalid-type', 'invalid-member', 'invalid-privacy', 'invalid-static', 'invalid-custom-element'])
    assert.ok(result.problems.some(p => p.code === code), code);
  assert.equal(result.declarations[0].attributes[0].name, 'variant', 'valid identity survives malformed type/default');
  assert.equal(Object.hasOwn(result.declarations[0].attributes[0], 'default'), false);
  assert.equal(result.declarations[0].properties[0].name, 'missingType');
});

test('slots require explicit identity, preserve default empty name and reject ambiguity', () => {
  const result = readCemDeclarations(manifest({ ...button,
    slots: [{ description: 'Nameless is not implicitly the default' }, { name: '' }, { name: '' }, { name: 3 }, { name: 'before' }, { name: 'Before' }],
    events: [{ name: '' }],
  }));
  assert.deepEqual(result.declarations[0].slots.map(s => s.name), ['', '', 'before', 'Before']);
  assert.ok(result.problems.some(p => p.path.endsWith('.slots[0].name') && p.code === 'invalid-string'));
  assert.ok(result.problems.some(p => p.path.endsWith('.slots[2].name') && p.code === 'duplicate-name'));
  assert.ok(result.problems.some(p => p.path.endsWith('.events[0].name') && p.code === 'invalid-string'));
});

test('duplicate tags and module/class identities are not resolved by manifest order', () => {
  const result = readCemDeclarations({ modules: [{ path: 'components.ts', declarations: [button, button] }] });
  assert.equal(result.declarations.length, 2);
  assert.ok(result.problems.some(p => p.code === 'duplicate-tag'));
  assert.ok(result.problems.some(p => p.code === 'duplicate-class'));
});

test('legacy file adapter projection remains byte-compatible, including its historical limitations', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'dsc-cem-legacy-'));
  const filename = path.join(directory, 'custom-elements.json');
  try {
    writeFileSync(filename, JSON.stringify(manifest({
      kind: 'class', customElement: true, name: 'Example', tagName: 'x-example',
      members: [{ kind: 'field', name: 'el', static: true, type: { text: 'string' }, default: "'x-example'" }],
      attributes: [{ name: 'checked', type: { text: 'boolean' }, default: 'false' }],
      slots: [{ name: '' }], events: [{ name: 'onCheckboxChange' }],
    })));
    assert.equal(JSON.stringify(extractCem(filename)), JSON.stringify([{
      name: 'Example', source: `${filename} (components/button/button.ts)`, adapter: 'cem', props: [
        { name: 'checked', optional: true, kind: 'boolean', default: false, confidence: 'declared' },
        { name: 'el', optional: true, kind: 'string', default: 'x-example', confidence: 'declared' },
        { name: 'onOnCheckboxChange', kind: 'event', optional: true, description: 'CEM event "onCheckboxChange"', confidence: 'inferred' },
      ],
    }]));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
