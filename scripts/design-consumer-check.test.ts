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
