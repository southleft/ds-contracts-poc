import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoryComponent } from './storybook-reader.js';
import { declare, seed } from './storybook-contracts.js';

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
