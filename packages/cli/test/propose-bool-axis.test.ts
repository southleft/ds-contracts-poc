/**
 * A boolean prop that SELECTS A RENDERING (`checked`) must seed as an enum
 * axis, in lockstep with the capture-config drafter. Before 2026-09-01 the
 * proposer seeded `checked` as `type: 'boolean'` while the drafter emitted a
 * `checked` STATE, and the capture runner refused the pair on the first
 * `onboard --continue` of any library with a checkbox/switch/radio.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proposeContract } from '../../../extract/propose.js';
import { AXIS_BY_BOOL_PROP, boolAxisValueMap } from '../../../extract/bool-axis-props.js';
import type { ExtractedComponent } from '../../../extract/types.js';

const CHECKBOX: ExtractedComponent = {
  name: 'Checkbox',
  source: 'src/Checkbox.tsx',
  adapter: 'react-tsx',
  props: [
    { name: 'checked', kind: 'boolean', optional: true, confidence: 'declared', description: 'Whether the box is checked' },
    { name: 'disabled', kind: 'boolean', optional: true, confidence: 'declared' },
    { name: 'onChange', kind: 'event', optional: true, confidence: 'declared' },
  ],
};

test('checked seeds as the enum axis every committed seed hand-authors; disabled stays boolean', () => {
  const { contract, notes } = proposeContract(CHECKBOX, 'acme') as { contract: { props: Array<Record<string, unknown>> }; notes: string[] };
  const checked = contract.props.find((p) => p.name === 'checked')!;
  assert.deepEqual(checked.type, { enum: ['unchecked', 'checked'] });
  assert.equal(checked.default, 'unchecked');
  assert.deepEqual(checked.bindings, {
    figma: { kind: 'VARIANT', property: 'Checked', values: { unchecked: 'Unchecked', checked: 'Checked' } },
    code: { prop: 'checked' },
  });
  assert.equal(checked.description, 'Whether the box is checked');
  const disabled = contract.props.find((p) => p.name === 'disabled')!;
  assert.equal(disabled.type, 'boolean');
  assert.ok(notes.some((n) => n.includes('`checked`') && n.includes('selects a rendering')), 'the seed says why');
});

test('a declared default: true seeds the "on" label', () => {
  const withDefault: ExtractedComponent = {
    ...CHECKBOX,
    props: [{ name: 'checked', kind: 'boolean', default: true, optional: true, confidence: 'declared' }],
  };
  const { contract } = proposeContract(withDefault, 'acme') as { contract: { props: Array<Record<string, unknown>> } };
  assert.equal(contract.props[0].default, 'checked');
});

test('the drafter and the proposer read ONE table', () => {
  assert.deepEqual(Object.keys(AXIS_BY_BOOL_PROP), ['checked']);
  assert.deepEqual(boolAxisValueMap('checked'), {
    unchecked: { $props: { checked: false } },
    checked: { $props: { checked: true } },
  });
});
