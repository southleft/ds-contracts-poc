import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoryComponent } from './storybook-reader.js';
import { createHash } from 'node:crypto';
import { DECLARED_CHANNELS } from './contract-schema.js';
import { carryVariantText, declare, paintedFirst, profileConventions, seed, spellSvgRotation } from './storybook-contracts.js';

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

test('a text field carries the text it draws: one placeholder as attrs.placeholder, values per variant, drawn by the Figma engine', async () => {
  const [c] = declare({ storybook: 'x', components: [component('a/Field', { axes: ['tone'],
    references: [ref('f--a', { tone: 'success' }), ref('f--a', { tone: 'error' }, { tone: 'error' })] })] }).components;
  const { contract, combos } = seed(c!);
  contract.anatomy.root.parts = { box: { element: 'textarea' }, plain: { element: 'input' }, mixed: { element: 'input' } } as never;
  const tone = (key: string) => combos.find((k) => k.key === key)!.axisValues.tone!;
  const fields: Record<string, Record<string, { value: string; placeholder: string }>> = {
    box: { success: { value: '', placeholder: 'Write…' }, error: { value: 'Oops', placeholder: 'Write…' } },
    plain: { success: { value: '', placeholder: 'Search' }, error: { value: '', placeholder: 'Search' } },
    mixed: { success: { value: '', placeholder: 'A' }, error: { value: '', placeholder: 'B' } } };
  assert.deepEqual(carryVariantText(contract, c!.axes, combos, () => null, (key, part) => fields[part]![tone(key)]!), ['field-placeholder-per-variant: mixed']);
  const parts = contract.anatomy.root.parts as Record<string, { attrs?: unknown; textByCombination?: unknown }>;
  assert.deepEqual([parts.box!.attrs, parts.box!.textByCombination], [{ placeholder: 'Write…' }, { props: ['tone'], rows: [{ values: ['success'], text: '' }, { values: ['error'], text: 'Oops' }] }]);
  assert.deepEqual([parts.plain!.attrs, parts.plain!.textByCombination, parts.mixed!.attrs], [{ placeholder: 'Search' }, undefined, undefined]);
  const { ContractSchema } = await import('./contract-schema.js'), { createFigmaEngine } = await import('../core/emit-figma-script.js');
  const parsed = ContractSchema.parse(contract), engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } as never, icons: new Map() });
  type Spec = { name?: string; characters?: string; children?: Spec[] };
  const texts = (s: Spec): string[] => [...(s.characters !== undefined ? [`${s.name}:${s.characters}`] : []), ...(s.children ?? []).flatMap(texts)];
  const drawn = (engine.compileComponentData(parsed, new Map([[parsed.id, parsed]])) as { variants: Array<{ spec: Spec }> }).variants.map((v) => texts(v.spec));
  assert.deepEqual(drawn, [['placeholder:Write…', 'placeholder:Search', 'placeholder:'], ['value:Oops', 'placeholder:Search', 'placeholder:']]);
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

test('a set width or height is read only when the converter asks, and survives the read boundary', async () => {
  const { captureJs } = await import('../extract/computed/capture.js'), { normalizeNode } = await import('../extract/computed/lib.js');
  assert.equal(captureJs('[x]').includes('asizeOf'), false); // every other pipeline's capture is unchanged
  assert.equal(captureJs('[x]', undefined, undefined, undefined, true).includes('const asizeOf'), true);
  const node = { tag: 'span', classes: [], nodes: [], style: {}, pseudo: {} };
  assert.deepEqual(normalizeNode({ ...node, asize: { height: '2rem' } }).asize, { height: '2rem' });
  assert.equal('asize' in normalizeNode(node), false);
  assert.equal(captureJs('[x]', undefined, undefined, undefined, true).includes('out.field'), false); // field text: its own opt-in
  assert.equal(captureJs('[x]', undefined, undefined, undefined, false, true).includes('out.field = '), true);
  assert.deepEqual(normalizeNode({ ...node, field: { value: '', placeholder: 'Search' } }).field, { value: '', placeholder: 'Search' });
});

test('the contract step switches on the conventions of the profile the reader recorded, refusing changed bytes and unknown names', () => {
  const profile = (conventions: string[]) => Buffer.from(JSON.stringify({ conventions })), sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const on = profile(['icon-box-keeps-glyph-size']), read = (bytes: Buffer) => () => bytes;
  assert.deepEqual([...profileConventions({ profile: { path: 'p.json', sha256: sha(on) } }, read(on))], ['icon-box-keeps-glyph-size']);
  assert.deepEqual([...profileConventions({ profile: null }), ...profileConventions({})], []);
  assert.throws(() => profileConventions({ profile: { path: 'p.json', sha256: sha(on) } }, read(profile([]))), /profile-changed-since-read:p\.json/);
  const odd = profile(['no-such-convention']);
  assert.throws(() => profileConventions({ profile: { path: 'p.json', sha256: sha(odd) } }, read(odd)), /profile-convention-unknown:no-such-convention/);
});

test('svg-rotation-carried spells an svg pure rotation as rotate(<n>deg), the declared form, and leaves every other transform', () => {
  const el = (tag: string, transform: string, nodes: unknown[] = []) => ({ tag, classes: [], style: { transform }, pseudo: {}, nodes }) as any;
  const cases: Array<[string, string, string]> = [['svg', 'matrix(0, 1, -1, 0, 0, 0)', 'rotate(90deg)'], ['svg', 'matrix(-1, 0, 0, -1, 0, 0)', 'rotate(180deg)'],
    ['svg', 'matrix(0.707107, -0.707107, 0.707107, 0.707107, 0, 0)', 'rotate(-45deg)'], ['svg', 'matrix(1, 0, 0, 1, 0, 0)', 'matrix(1, 0, 0, 1, 0, 0)'],
    ['svg', 'matrix(0, 1, -1, 0, 4, 0)', 'matrix(0, 1, -1, 0, 4, 0)'], ['svg', 'matrix(0.75, 0, 0, 0.75, 0, 0)', 'matrix(0.75, 0, 0, 0.75, 0, 0)'],
    ['div', 'matrix(0, 1, -1, 0, 0, 0)', 'matrix(0, 1, -1, 0, 0, 0)'], ['svg', 'none', 'none']];
  for (const [tag, before, after] of cases) {
    const root = el('div', 'none', [{ t: 'el', el: el(tag, before) }]);
    spellSvgRotation(root);
    assert.equal(root.nodes[0].el.style.transform, after, `${tag} ${before}`);
    if (after.startsWith('rotate(')) assert.ok(DECLARED_CHANNELS.transform!.value.test(after), after);
  }
});
