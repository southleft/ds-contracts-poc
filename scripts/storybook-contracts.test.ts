import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoryComponent } from './storybook-reader.js';
import { carryVariantText, declare, paintedFirst, seed } from './storybook-contracts.js';

const ref = (storyId: string, variant: Record<string, string>, args: Record<string, unknown> = {}) => ({ storyId, args, variant }) as unknown as StoryComponent['references'][number];
const component = (title: string, o: Partial<StoryComponent> & { axes?: string[] }) => ({ title, stories: 1, storyId: `${title}--a`, grammar: { grammar: 'in', reasons: [] },
  matrix: { status: 'ok', axes: o.axes ?? [], variants: o.references?.length ?? 0 }, ownRender: [], repeats: [], renderFailed: [], references: [], faces: [], ...o }) as StoryComponent;

test('ds-contracts.react.json declares one case per counted variant and refuses the rest by name', () => {
  const stories = { storybook: 'https://example.test/storybook/', environment: { react: 'react-dom 19.3.1' }, components: [
    component('content/status-badge', { axes: ['tone'], references: [ref('badge--a', { tone: '(default)' }), ref('badge--a', { tone: 'error' }, { tone: 'error' }), ref('badge--b', { tone: 'info' })] }),
    component('layout/Grid', { grammar: { grammar: 'out', reasons: ['absolute-child', 'grid'] } }),
    component('forms/Picker', { matrix: { status: 'refused', reason: 'variant-matrix-cap', axes: [], variants: 0 } as unknown as StoryComponent['matrix'] }),
    component('content/Empty', { references: [] }),
  ] };
  const d = declare(stories);
  assert.deepEqual([d.version, d.source, d.storybook, d.react], [2, 'storybook', 'https://example.test/storybook/', 'react-dom 19.3.1']);
  assert.deepEqual(d.components.map((c) => [c.subject, c.name, c.axes, c.cases.map((k) => k.id)]),
    [['content/status-badge', 'StatusBadge', ['tone'], ['badge--a.0', 'badge--a.1', 'badge--b.0']]]);
  assert.deepEqual(d.components[0]!.cases[1], { id: 'badge--a.1', story: { id: 'badge--a', args: { tone: 'error' } }, variant: { tone: 'error' } });
  assert.deepEqual(d.refused, [{ subject: 'layout/Grid', reason: 'grammar-out:absolute-child,grid' }, { subject: 'forms/Picker', reason: 'story-matrix-refused:variant-matrix-cap' },
    { subject: 'content/Empty', reason: 'no-variant' }]);
  assert.equal(declare(stories, 'http://localhost:6006/').storybook, 'http://localhost:6006/');
});

test('the seed contract names each option by a token-safe slug that its VARIANT binding maps back; no options, no props', () => {
  const [c] = declare({ storybook: 'x', components: [component('a/Badge', { axes: ['tone'],
    references: [ref('b--a', { tone: '(default)' }), ref('b--a', { tone: 'low emphasis' }), ref('b--a', { tone: 'low-emphasis' })] })] }).components;
  const { contract, drawn, combos } = seed(c!);
  const prop = contract.props[0]!;
  assert.deepEqual([contract.id, prop.name, prop.default, (prop.type as { enum: string[] }).enum], ['storybook.badge', 'tone', 'default', ['default', 'low-emphasis', 'low-emphasis-2']]);
  assert.deepEqual((prop.bindings as any).figma.values, { default: '(default)', 'low-emphasis': 'low emphasis', 'low-emphasis-2': 'low-emphasis' });
  assert.deepEqual([drawn, combos.length], [[{ tone: 'default' }, { tone: 'low-emphasis' }, { tone: 'low-emphasis-2' }], 3]);
  const [lone] = declare({ storybook: 'x', components: [component('content/Divider', { references: [ref('d--a', {})] })] }).components;
  assert.deepEqual([seed(lone!).contract.props, seed(lone!).drawn], [[], [{}]]);
});

test('a nested part whose text differs between variants carries each variant\'s text; a table the schema refuses is named', () => {
  const [c] = declare({ storybook: 'x', components: [component('a/Badge', { axes: ['tone'],
    references: [ref('b--a', { tone: 'success' }), ref('b--a', { tone: 'error' }, { tone: 'error' })] })] }).components;
  const built = () => { const s = seed(c!); s.contract.anatomy.root.parts = { label: { text: 'Success' }, mark: { text: '!' } } as never; return s; };
  const texts: Record<string, Record<string, string>> = { label: { success: 'Success', error: 'Error' }, mark: { success: '!', error: '!' } };
  const { contract, combos } = built();
  const at = (key: string, part: string) => texts[part]?.[combos.find((k) => k.key === key)!.axisValues.tone!] ?? null;
  assert.deepEqual(carryVariantText(contract, c!.axes, combos, at), []);
  const parts = contract.anatomy.root.parts as Record<string, { textByCombination?: unknown }>;
  assert.deepEqual(parts.label!.textByCombination, { props: ['tone'], rows: [{ values: ['success'], text: 'Success' }, { values: ['error'], text: 'Error' }] });
  assert.equal(parts.mark!.textByCombination, undefined); // the same text in every variant stays one literal
  // A row for a variant the part is not drawn in: the schema refuses the table, so the literal stays and is named.
  const off = built();
  const refused = carryVariantText(off.contract, c!.axes, [...off.combos, { key: 'x', axisValues: { tone: 'warning' } }], (key, part) => key === 'x' ? 'Warn' : at(key, part));
  assert.match(refused.join(), /^per-variant-text-unqualified: label: literal-text-combination-/);
  assert.equal((off.contract.anatomy.root.parts as Record<string, { textByCombination?: unknown }>).label!.textByCombination, undefined);
  assert.deepEqual(carryVariantText(seed({ ...c!, axes: [] }).contract, [], off.combos, at), []); // no options: nothing to carry
});

test('each font stack is written with the face the pinned browser painted it with first; the rest of the stack stays', () => {
  const stack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  const anatomy = { root: { declared: { 'font-family': stack }, parts: { label: { declared: { 'font-family': 'serif' },
    stylesWhen: [{ prop: 'tone', equals: 'x', styles: { 'font-family': stack } }] }, token: { tokens: { 'font-family': '{a.b}' } } } } };
  paintedFirst(anatomy, new Map([[stack, 'Arimo']]));
  assert.equal(anatomy.root.declared['font-family'], `"Arimo", ${stack}`);
  assert.equal(anatomy.root.parts.label.stylesWhen[0]!.styles['font-family'], `"Arimo", ${stack}`);
  assert.equal(anatomy.root.parts.label.declared['font-family'], 'serif'); // no painted face probed: unchanged
  assert.equal(anatomy.root.parts.token.tokens['font-family'], '{a.b}');
});

test('two components whose titles end alike take as many parent segments as it takes to differ', () => {
  const d = declare({ storybook: 'x', components: [component('forms/DatePicker/Calendar', { references: [ref('a--a', {})] }),
    component('forms/DatePickerNext/Calendar', { references: [ref('b--a', {})] }), component('content/status-badge', { references: [ref('c--a', {})] })] });
  assert.deepEqual(d.components.map((c) => c.name), ['DatePickerCalendar', 'DatePickerNextCalendar', 'StatusBadge']);
  assert.deepEqual(d.components.map((c) => seed(c).contract.id), ['storybook.date-picker-calendar', 'storybook.date-picker-next-calendar', 'storybook.status-badge']);
});
