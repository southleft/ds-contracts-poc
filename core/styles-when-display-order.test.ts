import assert from 'node:assert/strict';
import test from 'node:test';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';

/** Profile convention styles-when-display-last-wins: the stylesWhen display rules that match a variant apply in order,
 *  the later rule winning as in CSS: a rule hiding a part on one axis is undone by a later one showing it on another (a
 *  date field hidden for `range`, shown again for `md`), and a part whose last matching rule hides it is not drawn. With
 *  no matching rule, the declared display decides. Off, any matching display:none hides the part, as before. */
test('with the convention, the last matching stylesWhen display decides whether a part draws; off, any none hides it', () => {
  const values = (name: string, options: string[]) => ({ name, type: { enum: options }, default: options[0],
    bindings: { code: { prop: name }, figma: { kind: 'VARIANT', property: name, values: Object.fromEntries(options.map((o) => [o, o])) } } });
  const contract = ContractSchema.parse({
    id: 'test.display-order', name: 'DisplayOrder', version: '0.1.0', status: 'draft', description: 'Presence by ordered rules',
    states: [], semantics: { element: 'div' }, props: [values('type', ['single', 'range']), values('size', ['sm', 'md'])],
    anatomy: { root: { layout: { display: 'flex' }, parts: {
      field: { text: 'mm/dd/yyyy', stylesWhen: [{ prop: 'type', equals: 'range', styles: { display: 'none' } }, { prop: 'size', equals: 'md', styles: { display: 'block' } }] },
      hint: { text: 'Hint', declared: { display: 'none' }, stylesWhen: [{ prop: 'size', equals: 'md', styles: { display: 'block' } }, { prop: 'type', equals: 'range', styles: { display: 'none' } }] },
    } } },
    bindings: { code: { anchors: { importPath: 'test/DisplayOrder', export: 'DisplayOrder' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const drawn = (conventions: Set<string>) => (createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    icons: new Map(), conventions }).compileComponentData(contract, new Map([[contract.id, contract]])) as any).variants
    .map((v: any) => [v.name, (v.spec.children ?? []).map((c: any) => c.name).join(',')]);
  assert.deepEqual(drawn(new Set(['styles-when-display-last-wins'])), [['type=single, size=sm', 'field'], ['type=single, size=md', 'field,hint'],
    ['type=range, size=sm', ''], ['type=range, size=md', 'field']]);
  assert.deepEqual(drawn(new Set()), [['type=single, size=sm', 'field'], ['type=single, size=md', 'field,hint'],
    ['type=range, size=sm', ''], ['type=range, size=md', '']]);
});
