/** The clean-consumer check is an instrument: a case it mounts wrongly is a
 *  false fidelity failure. These cover case derivation only (no browser). */
import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveCases, variantPropValue } from './design-consumer-check.js';

const variantProp = (name: string, type: unknown, values: string[]) =>
  ({ name, type, bindings: { figma: { kind: 'VARIANT', property: name, values: Object.fromEntries(values.map(v => [v, v])) }, code: { prop: name } } });
const contract = { props: [variantProp('size', { enum: ['large', 'small'] }, ['large', 'small']), variantProp('rounded', 'boolean', ['false', 'true'])], anatomy: {} };
const dump = { Badge: { setName: 'Badge', variants: [{ name: 'size=large, rounded=false', nodeId: '1:1' }, { name: 'size=small, rounded=true', nodeId: '1:2' }] } };

test('a boolean prop backed by a VARIANT axis is mounted with a boolean, never the truthy string "false"', () => {
  const cases = deriveCases(dump, contract, 'Badge');
  assert.deepEqual(cases.map(c => c.props), [{ size: 'large', rounded: false }, { size: 'small', rounded: true }]);
  assert.deepEqual(cases.map(c => c.key), ['size-large_rounded-false', 'size-small_rounded-true']);
});

test('only a boolean-typed prop is coerced; an enum value spelled "true" stays a string', () => {
  assert.equal(variantPropValue({ type: 'boolean' }, 'false'), false);
  assert.equal(variantPropValue({ type: { enum: ['true', 'false'] } }, 'true'), 'true');
  assert.equal(variantPropValue({ type: 'boolean' }, 'on'), 'on');
});

// docs/23 §D.41 — a designer's INTERACTION-STATE axis is not a prop. The check
// reads it by the proposer's own table and mounts each state the way a user
// reaches it; it used to report every such variant as "State (no VARIANT prop)".
const stateContract = { props: [variantProp('Tone', { enum: ['a', 'b'] }, ['a', 'b']), { name: 'disabled', type: 'boolean', bindings: { figma: { kind: 'BOOLEAN', property: 'Disabled' }, code: { prop: 'disabled' } } }],
  states: ['hover', 'active', 'focus-visible', 'disabled'], anatomy: {} };
const stateDump = (states: string[], axis = 'State') => ({ Pill: { setName: 'Pill', variants: states.flatMap(s => ['a', 'b'].map((t, i) => ({ name: `${axis}=${s}, Tone=${t}`, nodeId: `2:${s}${i}` }))) } });

test('a state-axis variant is MOUNTED: hover / pressed / focus as the real interaction, disabled as the prop, the rest value as nothing', () => {
  const cases = deriveCases(stateDump(['Default', 'Hover', 'Pressed', 'Focus', 'Disabled']), stateContract, 'Pill');
  assert.equal(cases.length, 10);
  assert.deepEqual(cases.filter(c => c.props.Tone === 'a').map(c => [c.key, c.interaction, c.state ?? null, c.props]), [
    ['Tone-a', 'none', null, { Tone: 'a' }],
    ['Tone-a_state-hover', 'hover', 'hover', { Tone: 'a' }],
    ['Tone-a_state-active', 'active', 'active', { Tone: 'a' }],
    ['Tone-a_state-focus-visible', 'focus-visible', 'focus-visible', { Tone: 'a' }],
    ['disabled-true_Tone-a', 'none', 'disabled', { disabled: true, Tone: 'a' }],
  ]);
  assert.equal(new Set(cases.map(c => c.key)).size, 10, 'every Figma variant has its own cell');
});

test('a plain variant set derives exactly what it always did (no state, no interaction)', () => {
  assert.deepEqual(deriveCases(dump, contract, 'Badge').map(c => [c.interaction, c.state]), [['none', undefined], ['none', undefined]]);
});
