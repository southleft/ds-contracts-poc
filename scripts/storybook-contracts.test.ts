import assert from 'node:assert/strict';
import test from 'node:test';
import { conventionSet } from '../core/profile-conventions.js';
import { readProfile, type StoryComponent } from './storybook-reader.js';
import { createHash } from 'node:crypto';
import { DECLARED_CHANNELS } from './contract-schema.js';
import { reconstructSvg } from '../extract/computed/anatomy.js';
import { captureRootPath, carryAlignSelfCenter, carryTextWrap, shrunkTextWrap, MEASURE_TEXT_LINES, carriedChannel, MEASURE_BASELINES, paintedPx, declaredShow, lowerSingleRowGrid, profileDeclarations, carryLineBox, carryTextBaseline, drawnBaselines, carryGeneratedText, mintedObservations, carryRootHugEvidence, carrySvgViewports, carryVariantText, closedSelectLabels, declare, liftToContainingBlock, paintedFirst, profileClassPrefix, profileConventions, readerPreload, seed, spellSvgRotation, spellNormalLineHeight, textLostByPosition, liftSvgOwnFill } from './storybook-contracts.js';

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
  // Grammar decision 5: a reference read from one instance of a story keeps that instance, so the case captures it.
  const several = declare({ storybook: 'x', components: [component('a/Tag', { axes: ['type'], references: [0, 2].map((i) =>
    ({ ...ref('tag--a', { type: `t${i}` }), instance: i }) as StoryComponent['references'][number]) })] }).components[0]!.cases;
  assert.deepEqual(several.map((k) => k.story), [{ id: 'tag--a', args: {}, instance: 0 }, { id: 'tag--a', args: {}, instance: 2 }]);
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

test('root-text-by-axis: a root whose own text differs between variants carries it per value of the one axis that decides it; else it is named', () => {
  const carry = (axes: string[], refs: Array<[Record<string, string>, string]>) => {
    const [c] = declare({ storybook: 'x', components: [component('a/Link', { axes, references: refs.map(([v], i) => ref(`l--${i}`, v)) })] }).components;
    const { contract, combos } = seed(c!); contract.anatomy.root.text = refs[0]![1];
    const text = new Map(combos.map((k, i) => [k.key, refs[i]![1]]));
    const off = structuredClone(contract), offRefused = carryVariantText(off, axes, combos, (key, part) => part === 'root' ? text.get(key)! : null);
    assert.deepEqual([off.anatomy.root.textByProp, offRefused], [undefined, []], 'off (no root-text-by-axis), the root keeps its first text, unnamed');
    return { root: contract.anatomy.root, refused: carryVariantText(contract, axes, combos, (key, part) => part === 'root' ? text.get(key)! : null, undefined, true) };
  };
  const one = carry(['size'], [[{ size: 'sm' }, 'Link'], [{ size: 'md' }, 'Link'], [{ size: '(default)' }, 'Lorem ipsum']]);
  assert.deepEqual([one.root.textByProp, one.refused], [{ prop: 'size', map: { sm: 'Link', md: 'Link', default: 'Lorem ipsum' } }, []]);
  const two = carry(['size', 'tone'], [[{ size: 'sm', tone: 'a' }, 'A'], [{ size: 'md', tone: 'a' }, 'B'], [{ size: 'sm', tone: 'b' }, 'B']]);
  assert.deepEqual([two.root.textByProp, two.refused], [undefined, ['per-variant-text-unqualified: root: no-single-axis']]);
  const some = carry(['level'], [[{ level: '(default)' }, 'Settings'], [{ level: '0' }, '']]);
  assert.deepEqual([some.root.textByProp, some.refused], [undefined, ['per-variant-text-unqualified: root: not-drawn-in-every-variant']]);
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

test('variant-text-owns-its-part: a part whose own text varies and that holds child parts gives the text to its own part', () => {
  const [c] = declare({ storybook: 'x', components: [component('a/List', { axes: ['nested'],
    references: [ref('l--a', { nested: 'false' }), ref('l--b', { nested: 'true' })] })] }).components;
  const built = () => { const s = seed(c!); s.contract.anatomy.root.parts = { item: { text: 'Review', declared: { display: 'list-item' },
    parts: { 'item-text': { text: '–' }, sub: { declared: { display: 'block' } } } } } as never; return s; };
  const at = (key: string, part: string) => part === 'item' ? (key.includes('true') ? 'Prepare' : 'Review') : null;
  // Off: the item keeps the first variant's text, refused as before.
  const off = built();
  assert.deepEqual(carryVariantText(off.contract, c!.axes, off.combos, at), ['per-variant-text-unqualified: item: literal-text-combination-requires-owned-literal']);
  assert.equal((off.contract.anatomy.root.parts as any).item.text, 'Review');
  // On: the text moves to a new first child part (a free name), which carries each variant's text; the children follow.
  const on = built();
  assert.deepEqual(carryVariantText(on.contract, c!.axes, on.combos, at, undefined, false, true), []);
  const item = (on.contract.anatomy.root.parts as any).item;
  assert.deepEqual([item.text, item.textByCombination, Object.keys(item.parts)], [undefined, undefined, ['item-text-run', 'item-text', 'sub']]);
  assert.deepEqual(item.parts['item-text-run'], { text: 'Review', declared: { display: 'inline' },
    textByCombination: { props: ['nested'], rows: [{ values: ['false'], text: 'Review' }, { values: ['true'], text: 'Prepare' }] } });
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
  // Convention field-value-without-axes: a value every variant draws alike, with axes or without, is a table with no props.
  const same = (on: boolean, axes: string[]) => { const s = seed({ ...c!, axes }); s.contract.anatomy.root.parts = { n: { element: 'input' } } as never;
    const refused = carryVariantText(s.contract, axes, s.combos, () => null, () => ({ value: '50', placeholder: '' }), false, false, on);
    return [refused, (s.contract.anatomy.root.parts as Record<string, { textByCombination?: unknown }>).n!.textByCombination, s.contract] as const; };
  assert.deepEqual(same(false, []).slice(0, 2), [[], undefined]);
  assert.deepEqual(same(false, c!.axes).slice(0, 2), [['per-variant-text-unqualified: n: literal-text-combination-invalid'], undefined]);
  const table = { props: [], rows: [{ values: [], text: '50' }] }, [refusedOn, carried, on] = same(true, []);
  assert.deepEqual([refusedOn, carried, same(true, c!.axes).slice(0, 2)], [[], table, [[], table]]);
  const one = ContractSchema.parse(on), oneDrawn = engine.compileComponentData(one, new Map([[one.id, one]])) as { variants: Array<{ spec: Spec }> };
  assert.deepEqual(oneDrawn.variants.map((v) => texts(v.spec)), [['value:50']]);
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

test('the contract step preloads the stories the reader loaded, in its order, from the index, profile and list it recorded', () => {
  const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex'), p = readProfile(new URL('../examples/carbon/profile.json', import.meta.url).pathname);
  const index = JSON.stringify({ entries: Object.fromEntries(['a--one', 'b--one', 'b--two', 'b--three', 'b--docs'].map((id) => [id, { id, title: id[0], type: id.endsWith('docs') ? 'docs' : 'story' }])) });
  const files: Record<string, Buffer> = { 'p.json': Buffer.from(JSON.stringify({ ...p, pairs: [], components: [{ name: 'A', stories: ['a--one'], axes: [] },
    { name: 'B', stories: ['b--one', 'b--two'], axes: [], leftOut: [{ story: 'b--three', reason: 'test' }] }] })), 'only.json': Buffer.from('["B"]') };
  const recorded = { index: { sha256: sha(index) }, profile: { path: 'p.json', sha256: sha(files['p.json']!) }, only: { path: 'only.json', sha256: sha(files['only.json']!) } };
  assert.deepEqual(readerPreload(recorded, index, (f) => files[f]!), ['b--one', 'b--two', 'b--three']);
  assert.deepEqual(readerPreload({ index: recorded.index }, index), ['a--one', 'b--one', 'b--two', 'b--three']);   // no --only: every story
  assert.deepEqual(readerPreload({}, index), []);   // an older reader output records no index: nothing is preloaded
  assert.throws(() => readerPreload(recorded, index.replace('a--one', 'a--new'), (f) => files[f]!), /^Error: index-changed-since-read$/);
  assert.throws(() => readerPreload({ ...recorded, only: { ...recorded.only, sha256: sha('["A"]') } }, index, (f) => files[f]!), /only-changed-since-read:only\.json/);
});

test('text-baseline-as-drawn: a one-line text part carries the baseline drawn per variant; the Figma writer reads it only with the convention', async () => {
  const [c] = declare({ storybook: 'x', components: [component('a/Label', { axes: ['size'], references: [ref('b--a', { size: 'sm' }), ref('b--a', { size: 'lg' }, { size: 'lg' })] })] }).components;
  const { contract, combos } = seed(c!), lit = { 'font-size': '12px', 'line-height': '16px' };
  contract.anatomy.root.parts = { label: { text: 'AI', literals: lit }, two: { text: 'Two lines', literals: lit }, once: { text: 'x', literals: lit } } as never;
  const read = (px: number) => ({ px, ascent: 1.025, descent: 0.275 }), lg = (key: string) => combos.find((k) => k.key === key)!.axisValues.size === 'lg';
  const at = (key: string, part: string) => part === 'label' ? read(lg(key) ? 13 : 12) : part === 'two' ? (lg(key) ? null : read(12)) : lg(key) ? undefined : read(12);
  // Each variant's reading over the axis that tells them apart; one variant without a reading leaves the part as it was.
  assert.deepEqual(carryTextBaseline(contract, c!.axes, combos, at), ['label', 'once']);
  const parts = contract.anatomy.root.parts as Record<string, { textBaseline?: unknown }>;
  assert.deepEqual(parts.label!.textBaseline, { props: ['size'], rows: [{ values: ['sm'], ...read(12) }, { values: ['lg'], ...read(13) }] });
  assert.deepEqual([parts.once!.textBaseline, parts.two!.textBaseline], [{ props: [], rows: [{ values: [], ...read(12) }] }, undefined]);
  // A drawn baseline belongs to one line of literal text only.
  const { ContractSchema, textBaselineIssues } = await import('./contract-schema.js'), { createFigmaEngine } = await import('../core/emit-figma-script.js');
  assert.deepEqual(textBaselineIssues(contract, { text: 'a\nb', textBaseline: parts.once!.textBaseline } as never), ['text-baseline-unqualified']);
  // Captured elements and readings are matched by capture order and tag, or not at all.
  const node = (tag: string, nodes: unknown[] = []) => ({ tag, classes: [], nodes, style: {}, pseudo: {} }) as never;
  const root = node('div', [{ t: 'el', el: node('span') }]);
  assert.equal(drawnBaselines(root, [['div', null], ['span', read(12)]])?.size, 2);
  assert.equal(drawnBaselines(root, [['div', null], ['p', read(12)]]), null);
  // The writer draws the glyph line at 2·b − (a − d)·s in a box kept at the line height; off, it does not read the field.
  const parsed = ContractSchema.parse(contract), boxes = (conventions: string[]) => {
    const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } as never, icons: new Map(), conventions: conventionSet(conventions) });
    type Spec = { name?: string; baselineBox?: unknown; children?: Spec[] };
    const find = (s: Spec): unknown[] => [...(s.name === 'label' && s.baselineBox ? [s.baselineBox] : []), ...(s.children ?? []).flatMap(find)];
    return (engine.compileComponentData(parsed, new Map([[parsed.id, parsed]])) as { variants: Array<{ spec: Spec }> }).variants.flatMap((v) => find(v.spec));
  };
  assert.deepEqual(boxes(['text-baseline-as-drawn']), [{ line: 15, height: 16 }, { line: 17, height: 16 }]);
  assert.deepEqual(boxes([]), []);
});

test('text-baseline-as-painted: the carried baseline is the laid-out one rounded half up to the whole pixel; off, the probe is unchanged', () => {
  // A line top 11.5 below the subject with a baseline 14 below it is painted at 26 (25.5 rounded half up): 14.5 below its top.
  assert.deepEqual([[11.5, 14], [11, 14], [3.25, 14], [3.75, 14], [2.5, 14]].map(([top, px]) => paintedPx(top!, px!)), [14.5, 14, 13.75, 14.25, 14.5]);
  assert.equal(MEASURE_BASELINES(undefined), MEASURE_BASELINES(undefined, false));
  assert.deepEqual([MEASURE_BASELINES(undefined).includes('px: +b.toFixed(4)'), MEASURE_BASELINES(undefined, true).includes(paintedPx.toString())], [true, true]);
});

test('hugging-space-between-packs: a row that hugs its items packs them at the start with their gap; a sized row keeps space-between', async () => {
  const [c] = declare({ storybook: 'x', components: [component('a/Btn', { references: [ref('b--a', {})] })] }).components;
  const { ContractSchema } = await import('./contract-schema.js'), { createFigmaEngine } = await import('../core/emit-figma-script.js');
  const primary = (rootLiterals: Record<string, string>, conventions: string[]) => {
    const { contract } = seed(c!);
    Object.assign(contract.anatomy.root, { layout: { display: 'inline-flex', justify: 'space-between' }, literals: rootLiterals,
      parts: { label: { text: 'Button' }, icon: { declared: { display: 'block' }, literals: { width: '16px', height: '16px', 'margin-left': '8px' } } } });
    const parsed = ContractSchema.parse(contract), engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } as never, icons: new Map(), conventions: conventionSet(conventions) });
    const spec = (engine.compileComponentData(parsed, new Map([[parsed.id, parsed]])) as { variants: Array<{ spec: { layout?: { primary?: string }; lits?: { itemSpacing?: number } } }> }).variants[0]!.spec;
    return [spec.layout?.primary, spec.lits?.itemSpacing];
  };
  assert.deepEqual(primary({}, ['hugging-space-between-packs']), ['MIN', 8]);
  assert.deepEqual(primary({}, []), ['SPACE_BETWEEN', 8]);
  assert.deepEqual(primary({ width: '200px' }, ['hugging-space-between-packs']), ['SPACE_BETWEEN', 8]);   // free space to spread
});

test('absolute-box-from-size-and-margins: a sized absolute box between two insets keeps its size, a margin in from its start inset', async () => {
  const [c] = declare({ storybook: 'x', components: [component('a/Badge', { references: [ref('b--a', {})] })] }).components;
  const { ContractSchema } = await import('./contract-schema.js'), { createFigmaEngine } = await import('../core/emit-figma-script.js');
  const placed = (conventions: string[]) => {
    const { contract } = seed(c!);
    Object.assign(contract.anatomy.root, { declared: { position: 'relative' }, literals: { width: '48px', height: '48px' }, parts: { badge: { text: '4', declared: { position: 'absolute' },
      literals: { top: '0px', right: '0px', left: '28.5px', bottom: '28px', width: '15.5px', height: '16px', 'margin-top': '4px', 'margin-right': '4px' } } } });
    const parsed = ContractSchema.parse(contract), engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } as never, icons: new Map(), conventions: conventionSet(conventions) });
    type Spec = { name?: string; absolute?: unknown; children?: Spec[] };
    const find = (s: Spec): unknown => s.name === 'badge' ? s.absolute : (s.children ?? []).map(find).find(Boolean);
    return find((engine.compileComponentData(parsed, new Map([[parsed.id, parsed]])) as { variants: Array<{ spec: Spec }> }).variants[0]!.spec);
  };
  assert.deepEqual(placed(['absolute-box-from-size-and-margins']), { h: 'MIN', v: 'MIN', left: 28.5, top: 4 });
  assert.deepEqual(placed([]), { h: 'STRETCH', v: 'STRETCH', left: 28.5, right: 0, top: 0, bottom: 28 });
});

test('inline-block-line-box-as-drawn: an atomic inline alone on its line carries its line box per variant; the writer adds it to the margin box', async () => {
  const [c] = declare({ storybook: 'x', components: [component('a/Field', { axes: ['type'], references: [ref('f--a', { type: 'default' }), ref('f--a', { type: 'inline' }, { type: 'inline' })] })] }).components;
  const { contract, combos } = seed(c!), inline = (key: string) => combos.find((k) => k.key === key)!.axisValues.type === 'inline';
  contract.anatomy.root.parts = { label: { text: 'Label', literals: { 'margin-bottom': '8px' } }, field: { declared: { display: 'block' } }, gone: { text: 'x' } } as never;
  // The label reads (2, 0) where it is inline-block and nothing where it is a block; a part with no reading anywhere is left.
  const at = (key: string, part: string) => part === 'label' ? (inline(key) ? null : { top: 2, bottom: 0 }) : part === 'gone' && inline(key) ? undefined : null;
  assert.deepEqual(carryLineBox(contract, c!.axes, combos, at), ['label']);
  const parts = contract.anatomy.root.parts as Record<string, { lineBox?: unknown }>;
  assert.deepEqual(parts.label!.lineBox, { props: ['type'], rows: [{ values: ['default'], top: 2, bottom: 0 }, { values: ['inline'], top: 0, bottom: 0 }] });
  assert.deepEqual([parts.field!.lineBox, parts.gone!.lineBox], [undefined, undefined]);
  const { ContractSchema, lineBoxIssues } = await import('./contract-schema.js'), { createFigmaEngine } = await import('../core/emit-figma-script.js');
  assert.deepEqual(lineBoxIssues(contract, { lineBox: parts.label!.lineBox } as never, false), ['line-box-unqualified']);   // never on the root
  const parsed = ContractSchema.parse(contract), margins = (conventions: string[]) => {
    const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } as never, icons: new Map(), conventions: conventionSet(conventions) });
    type Spec = { name?: string; margins?: unknown; children?: Spec[] };
    const find = (s: Spec): unknown[] => [...(s.name === 'label' ? [s.margins] : []), ...(s.children ?? []).flatMap(find)];
    return (engine.compileComponentData(parsed, new Map([[parsed.id, parsed]])) as { variants: Array<{ spec: Spec }> }).variants.flatMap((v) => find(v.spec));
  };
  assert.deepEqual(margins(['inline-block-line-box-as-drawn']), [{ bottom: 8, top: 2 }, { bottom: 8 }]);
  assert.deepEqual(margins([]), [{ bottom: 8 }, { bottom: 8 }]);
});

test('show-declared-component: a case names the component its profile declares for the story, as the reader does', () => {
  const decls = [{ name: 'Button', stories: ['b--default'] }, { name: 'ButtonSkeleton', stories: ['b--skeleton'] }, { name: 'Item', stories: ['l--item'], subcomponent: true as const }];
  assert.equal(declaredShow(decls, 'b--skeleton', { size: 'sm' }), JSON.stringify(['b--skeleton', { size: 'sm' }, 'ButtonSkeleton', false]));
  assert.equal(declaredShow(decls, 'l--item', {}), JSON.stringify(['l--item', {}, 'Item', true]));
  assert.equal(declaredShow(decls, 'x--none', {}), JSON.stringify(['x--none', {}]));   // listed by no declaration: as before
  assert.equal(declaredShow([...decls, { name: 'Later', stories: ['b--default'] }], 'b--default', {}), JSON.stringify(['b--default', {}, 'Later', false]));
  assert.throws(() => profileDeclarations({ profile: { path: 'p.json', sha256: 'recorded' } }, () => Buffer.from('{}')), /^Error: profile-changed-since-read:p\.json$/);
});

test('filled-child-keeps-margin-box: a growing child keeps its margin box, which takes its FILL; off, the margin is named', async () => {
  const { ContractSchema } = await import('./contract-schema.js'), { createFigmaEngine } = await import('../core/emit-figma-script.js');
  const { createFigmaMock } = await import('./plugin-engine-mock-figma.mjs'), vm = await import('node:vm');
  const tokens = { primitives: { m: { $type: 'dimension', four: { $value: '4px' }, sixty: { $value: '60px' } } }, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const contract = ContractSchema.parse({ id: 'test.grow-margin', name: 'GrowMargin', version: '0.1.0', status: 'draft', description: 'A growing child with a margin',
    states: [], semantics: { element: 'div' }, props: [], anatomy: { root: { layout: { display: 'flex', direction: 'column' }, tokens: { height: '{m.sixty}' }, parts: {
      help: { text: 'Help', layout: { grow: true }, tokens: { 'margin-top': '{m.four}' } } } } },
    bindings: { code: { anchors: { importPath: 'test/GrowMargin', export: 'GrowMargin' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  const write = async (on: boolean) => {
    const engine = createFigmaEngine({ tokens: tokens as never, icons: new Map(), conventions: conventionSet(on ? ['filled-child-keeps-margin-box'] : []) }), { figma, root } = createFigmaMock();
    const script = engine.buildComponentScript(contract, new Map([[contract.id, contract]])), context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
    for (const s of [engine.buildTokensScript(null), script]) await vm.runInContext(`(async()=>{${s}\n})()`, context);
    return { script, box: root.findOne((n: any) => n.name === 'help (margin box)') as any };
  };
  const off = await write(false), on = await write(true);
  assert.deepEqual([off.box, off.script.includes('FC-EMIT-MARGIN-BOX-SKIPPED'), off.script.includes('marginBoxFills')], [null, true, false]);
  assert.deepEqual([on.box.paddingTop, on.box.layoutSizingVertical, on.box.children[0].layoutSizingVertical, on.script.includes('FC-EMIT-MARGIN-BOX-SKIPPED')], [4, 'FILL', 'FILL', false]);
});

test('sized-text-baseline-as-drawn: a sized text keeps its box at the carried line height inside its run-time box; off, it is skipped', async () => {
  const { ContractSchema } = await import('./contract-schema.js'), { createFigmaEngine } = await import('../core/emit-figma-script.js');
  const { createFigmaMock } = await import('./plugin-engine-mock-figma.mjs'), vm = await import('node:vm');
  const tokens = { primitives: { m: { $type: 'dimension', w: { $value: '66.4062px' }, h: { $value: '24px' } } }, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const textBaseline = { props: [], rows: [{ values: [], px: 12, ascent: 1.025, descent: 0.275 }] }, literals = { 'font-size': '12px', 'line-height': '16px' };
  const contract = ContractSchema.parse({ id: 'test.sized-baseline', name: 'SizedBaseline', version: '0.1.0', status: 'draft', description: 'Sized one-line texts',
    states: [], semantics: { element: 'div' }, props: [], anatomy: { root: { layout: { display: 'flex', direction: 'row' }, parts: {
      wide: { text: 'Tag content', literals, tokens: { width: '{m.w}' }, textBaseline }, tall: { text: 'Tall', literals, tokens: { height: '{m.h}' }, textBaseline } } } },
    bindings: { code: { anchors: { importPath: 'test/SizedBaseline', export: 'SizedBaseline' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  const write = async (conventions: string[]) => {
    const engine = createFigmaEngine({ tokens: tokens as never, icons: new Map(), conventions: conventionSet(conventions) }), { figma, root } = createFigmaMock();
    const script = engine.buildComponentScript(contract, new Map([[contract.id, contract]])), context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
    for (const s of [engine.buildTokensScript(null), script]) await vm.runInContext(`(async()=>{${s}\n})()`, context);
    // The run-time box of each sized text, and the text inside it.
    const box = (name: string) => { const wrap = root.findOne((n: any) => n.name === name && n.type === 'FRAME') as any, text = wrap.children[0];
      return { box: [wrap.width, wrap.height, wrap.counterAxisAlignItems], text: [text.textAutoResize, text.lineHeight.value, text.height, text.textAlignVertical] }; };
    return [box('wide'), box('tall')];
  };
  // On: the glyph line is 2·12 − (1.025 − 0.275)·12 = 15, top-aligned in a text box held at the carried 16; the fixed width
  // box hugs that 16, and the fixed 24-high box centers it as before.
  assert.deepEqual(await write(['text-baseline-as-drawn', 'sized-text-baseline-as-drawn']), [
    { box: [66.4062, 16, 'CENTER'], text: ['NONE', 15, 16, 'TOP'] },
    { box: [29, 24, 'CENTER'], text: ['NONE', 15, 16, 'TOP'] }]);
  // Off: the line height stays 16 and the text box is never set (it sizes itself, as createText makes it).
  assert.deepEqual((await write(['text-baseline-as-drawn'])).map((b) => [b.text[0], b.text[1], b.box[2]]), [[undefined, 16, 'CENTER'], [undefined, 16, 'CENTER']]);
});

test('table-short-row-leaves-columns-empty: a short row takes the columns from the left and keeps the table width; off, the table is refused', async () => {
  const { tableGeometry } = await import('../extract/computed/fuse.js');
  // table > header row (2 cells) + body row (3 cells; the third, a 32 px selection cell, is drawn only with selection).
  const names = ['root', 'head', 'h1', 'h2', 'body', 'b1', 'b2', 'b3'], kids: Record<number, number[]> = { 0: [1, 4], 1: [2, 3], 4: [5, 6, 7] };
  const display = ['table', 'table-row', 'table-cell', 'table-cell', 'table-row', 'table-cell', 'table-cell', 'table-cell'];
  const sweep = (headWidth: number) => {
    const widths: Record<string, Array<number | null>> = { plain: [300, 300, 120, 180, 300, 120, 180, null], selection: [300, headWidth, 100, 168, 300, 100, 168, 32] };
    return { baseFlat: names.map(() => ({})), partNames: names, union: { entries: names.map((_, i) => ({ id: i, children: (kids[i] ?? []).map((id) => ({ id })) })) },
      getAligned: (key: string) => widths[key.replace('__default', '')]!.map((w, i) => w === null ? null : { node: { style: { display: display[i]!, width: `${w}px` } } }) } as never;
  };
  const space = { enumeration: { combos: ['plain', 'selection'].map((key) => ({ key, stateFlags: {} })) } } as never;
  const off = tableGeometry(sweep(300), space);
  assert.deepEqual([off.cellAdmit.size, off.rowAdmit.size, off.refusals[0]?.split(':')[0]], [0, 0, 'table-column-arity-disagreement']);
  const on = tableGeometry(sweep(300), space, true);
  assert.deepEqual([[...on.cellAdmit].sort(), [...on.rowAdmit], on.refusals], [[2, 3, 5, 6, 7], [1], []]);
  assert.match(on.receipts.join('\n'), /table-short-row-spans-table: "head" \(2 of 3 cells\)/);
  // A short row that does not span the table (268 of 300 where the selection cell is drawn) leaves the table as it was.
  const shrunk = tableGeometry(sweep(268), space, true);
  assert.deepEqual([shrunk.cellAdmit.size, shrunk.rowAdmit.size, shrunk.refusals.at(-1)?.split(':')[0]], [0, 0, 'table-short-row-unspanned']);
});

test('align-self-center-in-stretched-box: a centered flex child carries alignSelf center and is drawn in a stretched centering box', async () => {
  const [c] = declare({ storybook: 'x', components: [component('a/Btn', { axes: ['kind'], references: [ref('b--a', { kind: 'primary' }), ref('b--a', { kind: 'ghost' }, { kind: 'ghost' })] })] }).components;
  const el = (style: Record<string, string>) => ({ tag: 'div', classes: [], style, nodes: [], pseudo: {} }) as never as import('../extract/computed/lib.js').CapturedNode;
  const carry = (parentDisplay: string) => { const { contract, combos } = seed(c!), ghost = (key: string) => combos.find((k) => k.key === key)!.axisValues.kind === 'ghost';
    contract.anatomy.root.parts = { icon: { declared: { display: 'block' } } } as never;
    return [carryAlignSelfCenter(contract, combos, (key, part) => part === 'root' ? el({ display: parentDisplay })
      : el(ghost(key) ? { 'align-self': 'center', position: 'static' } : { 'align-self': 'auto', position: 'absolute' })), contract] as const; };
  const [[receipts, refused], contract] = carry('inline-flex');
  assert.deepEqual([receipts, refused, (contract.anatomy.root.parts as any).icon.layoutByProp], [['align-self-center-carried: icon: kind=ghost'], [], { prop: 'kind', map: { ghost: { alignSelf: 'center' } } }]);
  assert.deepEqual(carry('block')[0], [[], ['align-self-center-uncarried: icon: not-an-in-flow-flex-child']]);
  // The writer: a 64-high row; the 16 px icon with a 1 px top margin is drawn in a box that fills the row's height,
  // centers it and holds the margin as its padding. Off, the icon sits in the row, its margin as before.
  const { ContractSchema } = await import('./contract-schema.js'), { createFigmaEngine } = await import('../core/emit-figma-script.js');
  const { createFigmaMock } = await import('./plugin-engine-mock-figma.mjs'), vm = await import('node:vm');
  const row = ContractSchema.parse({ id: 'test.center-self', name: 'CenterSelf', version: '0.1.0', status: 'draft', description: 'A centered flex child',
    states: [], semantics: { element: 'div' }, props: [], anatomy: { root: { layout: { display: 'flex', direction: 'row' }, literals: { height: '64px' }, parts: {
      icon: { layout: { alignSelf: 'center' }, literals: { width: '16px', height: '16px' }, tokens: { 'margin-top': '{m.one}' } } } } },
    bindings: { code: { anchors: { importPath: 'test/CenterSelf', export: 'CenterSelf' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  const write = async (conventions: string[]) => {
    const tokens = { primitives: { m: { $type: 'dimension', one: { $value: '1px' } } }, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
    const engine = createFigmaEngine({ tokens: tokens as never, icons: new Map(), conventions: conventionSet(conventions) }), { figma, root } = createFigmaMock();
    const script = engine.buildComponentScript(row, new Map([[row.id, row]])), context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
    for (const s of [engine.buildTokensScript(null), script]) await vm.runInContext(`(async()=>{${s}\n})()`, context);
    return [root.findOne((n: any) => n.name === 'icon (center box)') as any, root.findOne((n: any) => n.name === 'icon') as any];
  };
  const [box, icon] = await write(['align-self-center-in-stretched-box']), [none, plain] = await write([]);
  assert.deepEqual([box.layoutMode, box.primaryAxisAlignItems, box.paddingTop, box.layoutSizingVertical, box.fills.length, box.clipsContent, icon.parent === box],
    ['VERTICAL', 'CENTER', 1, 'FILL', 0, false, true]);
  // The icon itself is drawn as with the convention off: its own layout and size are not the parent's alignment.
  assert.deepEqual([none, [icon.layoutMode, icon.primaryAxisAlignItems, icon.counterAxisAlignItems, icon.width, icon.height]],
    [null, [plain.layoutMode, plain.primaryAxisAlignItems, plain.counterAxisAlignItems, plain.width, plain.height]]);
});

test('svg-box-snapped-as-painted: once laid out, an svg off the whole pixel has its drawing moved onto it; under 0.05 px is left', async () => {
  const { ContractSchema } = await import('./contract-schema.js'), { createFigmaEngine } = await import('../core/emit-figma-script.js');
  const { createFigmaMock } = await import('./plugin-engine-mock-figma.mjs'), vm = await import('node:vm');
  const icon = (left: string, top: string) => ({ icon: { asset: 'glyph', size: 16 }, declared: { position: 'absolute' }, literals: { left, top } });
  const contract = ContractSchema.parse({ id: 'test.snap', name: 'Snap', version: '0.1.0', status: 'draft', description: 'Placed icons', states: [], semantics: { element: 'div' }, props: [],
    anatomy: { root: { layout: { display: 'flex', direction: 'row' }, declared: { position: 'relative' }, literals: { width: '40px', height: '40px' },
      parts: { half: icon('10.5px', '4.5px'), near: icon('20.03px', '2px') } } },
    bindings: { code: { anchors: { importPath: 'test/Snap', export: 'Snap' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  const moved = async (conventions: string[]) => {
    const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } as never, icons: new Map([['glyph', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>']]),
      conventions: conventionSet(conventions) }), { figma, root } = createFigmaMock();
    const f = figma as any, svg = f.createNodeFromSvg; f.createNodeFromSvg = (s: string) => { const n = svg(s); n.appendChild(f.createRectangle()); return n; };   // the mock's svg has no drawing
    const script = engine.buildComponentScript(contract, new Map([[contract.id, contract]])), context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
    for (const s of [engine.buildTokensScript(null), script]) await vm.runInContext(`(async()=>{${s}\n})()`, context);
    return ['half', 'near'].map((name) => { const n = root.findOne((x: any) => x.name === name) as any; return [n.children[0].x, n.children[0].y]; });
  };
  // At (10.5, 4.5) in its variant, Chromium paints the svg at (11, 5): its drawing moves by half a pixel each way.
  assert.deepEqual(await moved(['svg-box-snapped-as-painted']), [[0.5, 0.5], [0, 0]]);
  assert.deepEqual(await moved([]), [[0, 0], [0, 0]]);
});

test('set-cell-pads-variant-overhang: each edge and gap of the variant grid holds what the variants draw outside themselves', async () => {
  const { ContractSchema } = await import('./contract-schema.js'), { createFigmaEngine } = await import('../core/emit-figma-script.js');
  const { createFigmaMock } = await import('./plugin-engine-mock-figma.mjs'), vm = await import('node:vm');
  // A 24 px button whose open tip (117 x 22) sits 47 px to its left, as IconButton's tooltip does at xs.
  const contract = ContractSchema.parse({ id: 'test.tip', name: 'Tip', version: '0.1.0', status: 'draft', description: 'A tip past its box', states: [], semantics: { element: 'div' },
    props: [{ name: 'kind', type: { enum: ['a', 'b'] }, default: 'a', bindings: { code: { prop: 'kind' }, figma: { kind: 'VARIANT', property: 'kind', values: { a: 'a', b: 'b' } } } }],
    anatomy: { root: { layout: { display: 'flex', direction: 'row' }, declared: { position: 'relative' }, literals: { width: '24px', height: '24px' },
      parts: { tip: { declared: { position: 'absolute' }, literals: { left: '-47px', top: '32px', width: '117px', height: '22px', 'background-color': '#161616' } },
        // a floating layer's viewport-sized container, which draws nothing: it reaches nowhere
        float: { declared: { position: 'absolute' }, literals: { left: '0px', top: '0px', width: '1280px', height: '720px' } } } } },
    bindings: { code: { anchors: { importPath: 'test/Tip', export: 'Tip' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
  const grid = async (conventions: string[]) => {
    const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } as never, icons: new Map(), conventions: conventionSet(conventions) }), { figma, root } = createFigmaMock();
    const script = engine.buildComponentScript(contract, new Map([[contract.id, contract]])), context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
    for (const s of [engine.buildTokensScript(null), script]) await vm.runInContext(`(async()=>{${s}\n})()`, context);
    const set = root.findOne((n: any) => n.type === 'COMPONENT_SET') as any;
    return { cells: set.children.map((c: any) => [c.x, c.y]), size: [set.width, set.height] };
  };
  const off = await grid([]), on = await grid(['set-cell-pads-variant-overhang']);
  assert.deepEqual(off, { cells: [[40, 40], [40, 104]], size: [104, 168] });   // one column, a row per value
  // The column's left edge holds the tip's 47 px and its right edge the tip's 117 - 47 - 24 = 46; the rows keep 40, as the
  // tip reaches only 32 + 22 - 24 = 30 px below its variant.
  assert.deepEqual(on, { cells: [[47, 40], [47, 104]], size: [117, 168] });
});

test('single-row-grid-as-row: a one-row grid value draws as a row with its gap and empty trailing row; any other grid is named', async () => {
  const [c] = declare({ storybook: 'x', components: [component('a/Field', { axes: ['type'], references: [ref('f--a', { type: 'default' }), ref('f--a', { type: 'inline' }, { type: 'inline' })] })] }).components;
  const el = (style: Record<string, string>, nodes: unknown[] = []) => ({ tag: 'div', classes: [], style, nodes, pseudo: {} }) as never as import('../extract/computed/lib.js').CapturedNode;
  const kid = (width: string) => ({ t: 'el', el: el({ width, 'margin-left': '0px', 'margin-right': '0px', 'grid-row-start': 'auto', 'grid-row-end': 'auto', 'grid-column-start': 'auto', 'grid-column-end': 'auto' }) });
  const box = Object.fromEntries(['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'].map((k) => [k, '0px']));
  const inline = (label: string) => el({ ...box, display: 'inline-grid', 'grid-template-columns': '34.8906px 127.297px', 'grid-template-rows': '24px 0px', 'column-gap': '4px', 'row-gap': '4px',
    'grid-template-areas': 'none', 'grid-auto-flow': 'row', 'align-items': 'center', 'justify-content': 'normal', 'align-content': 'normal' }, [kid(label), kid('127.297px')]);
  const run = (label: string) => { const { contract, combos } = seed(c!), type = (key: string) => combos.find((k) => k.key === key)!.axisValues.type;
    contract.anatomy.root.parts = { label: { text: 'Label' }, field: { text: 'Pick' } } as never;
    return [lowerSingleRowGrid(contract, combos, (key, part) => part === 'root' ? (type(key) === 'inline' ? inline(label) : el({ display: 'block' })) : null), contract] as const; };
  const [[receipts, refused], contract] = run('34.8906px');
  assert.deepEqual([receipts, refused], [['grid-lowered-to-row: root: type=inline'], []]);
  assert.deepEqual(contract.anatomy.root.layoutByProp, { prop: 'type', map: { inline: { display: 'inline-flex', direction: 'row', align: 'center', gridAsRow: { gap: 4, paddingBottom: 4 } } } });
  assert.deepEqual(run('30px')[0], [[], ['grid-row-unlowered: root: columns-not-children']]);
  const { ContractSchema } = await import('./contract-schema.js'), { createFigmaEngine } = await import('../core/emit-figma-script.js');
  const parsed = ContractSchema.parse(contract), engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } as never, icons: new Map() });
  const roots = (engine.compileComponentData(parsed, new Map([[parsed.id, parsed]])) as { variants: Array<{ spec: { layout: unknown; lits?: Record<string, unknown> } }> }).variants.map((v) => [v.spec.layout, v.spec.lits?.itemSpacing, v.spec.lits?.paddingBottom]);
  assert.deepEqual(roots[1], [{ mode: 'HORIZONTAL', primary: 'MIN', counter: 'CENTER', stretchChildren: undefined }, 4, 4]);
  assert.notDeepEqual(roots[0]![0], roots[1]![0]);
});

test('svg-own-fill-on-host: an element holding only an svg with its own fill takes that fill; text or a shared fill leaves it', () => {
  const el = (tag: string, style: Record<string, string>, nodes: unknown[] = []) => ({ tag, classes: [], nodes, style, pseudo: {} }) as never as Parameters<typeof liftSvgOwnFill>[0];
  const svg = (fill: string) => ({ t: 'el', el: el('svg', { fill }) });
  const button = el('button', { fill: 'rgb(0, 0, 0)', color: 'rgb(15, 98, 254)' }, [svg('rgb(22, 22, 22)')]);
  const labelled = el('button', { fill: 'rgb(0, 0, 0)' }, [{ t: 'text', v: 'Menu' }, svg('rgb(22, 22, 22)')]);
  const inherited = el('button', { fill: 'rgb(22, 22, 22)' }, [svg('rgb(22, 22, 22)')]);
  assert.equal(liftSvgOwnFill(el('div', {}, [{ t: 'el', el: button }, { t: 'el', el: labelled }, { t: 'el', el: inherited }])), 1);
  assert.deepEqual([button.style.fill, labelled.style.fill, inherited.style.fill], ['rgb(22, 22, 22)', 'rgb(0, 0, 0)', 'rgb(22, 22, 22)']);
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

test('svg-viewbox-carried: each svg takes the viewBox its page authored, in tree order, where the reconstruction reads it', () => {
  const el = (tag: string, style: Record<string, string>, nodes: unknown[] = []) => ({ tag, classes: [], style, pseudo: {}, nodes }) as any;
  const svg = (size: string, d: string) => el('svg', { width: size, height: size }, [{ t: 'el', el: el('path', { d: `path("${d}")` }) }]);
  // A 32-unit close glyph (extent 24) drawn on a 16 px svg, and a 16-unit glyph on a 16 px svg, inside a wrapper.
  const close = 'M 17.4 16 L 24 9.4 L 22.6 8 L 16 14.6 L 9.4 8 L 8 9.4 L 14.6 16 L 8 22.6 L 9.4 24 L 16 17.4 L 22.6 24 L 24 22.6 Z';
  const tree = () => el('div', {}, [{ t: 'el', el: svg('16px', close) }, { t: 'el', el: el('span', {}, [{ t: 'el', el: svg('16px', 'M 3 3 L 13 13 Z') }]) }]);
  const svgsOf = (r: any) => [r.nodes[0].el, r.nodes[1].el.nodes[0].el];
  const viewBoxes = (r: any) => svgsOf(r).map((n: any) => /viewBox="([^"]+)"/.exec(reconstructSvg(n, [], 'icon')!.markup)![1]);
  // Off: the reconstruction from the computed size bumps the 32-unit glyph to its path extent, a third too large.
  assert.deepEqual(viewBoxes(tree()), ['0 0 24 24', '0 0 16 16']);
  // On: the authored viewBox wins.
  const on = tree();
  assert.equal(carrySvgViewports(on, [['0 0 32 32', null], ['0 0 16 16', 'xMidYMid meet']]), true);
  assert.deepEqual(viewBoxes(on), ['0 0 32 32', '0 0 16 16']);
  // A viewBox the reconstruction cannot read as observed (not square, another aspect mapping, absent) keeps the old one.
  for (const seen of [['0 0 32 16', null], ['0 0 32 32', 'none'], [null, null]] as const) {
    const r = tree();
    assert.equal(carrySvgViewports(r, [seen, ['0 0 16 16', null]]), true);
    assert.equal(svgsOf(r)[0].svgViewport, undefined, JSON.stringify(seen));
  }
  // svg-viewbox-meets-oblong-box: a square viewBox on a 16 x 40 svg (a select's chevron, as tall as its field) is taken
  // only with the convention; its glyph square is centered at the short side, inside the 40 px square asset.
  const chevron = () => el('div', {}, [{ t: 'el', el: el('svg', { width: '16px', height: '40px' }, [{ t: 'el', el: el('path', { d: 'path("M 3 5.3 L 13 5.3 L 8 11 Z")' }) }]) }]);
  const tall = chevron(), wide = chevron();
  assert.equal(carrySvgViewports(tall, [['0 0 16 16', null]]), true);
  assert.equal(tall.nodes[0].el.svgViewport, undefined);
  assert.equal(carrySvgViewports(wide, [['0 0 16 16', null]], true), true);
  const drawn = reconstructSvg(wide.nodes[0].el, [], 'icon')!;
  assert.deepEqual([/viewBox="([^"]+)"/.exec(drawn.markup)![1], drawn.size], ['-12 -12 40 40', 40]);
  // An oblong viewport attached any other way (source-reference evidence carries no mark) is still refused, by name.
  const unmarked = chevron(), receipts: string[] = [];
  unmarked.nodes[0].el.svgViewport = { viewBox: [0, 0, 16, 16], preserveAspectRatio: 'xMidYMid meet' };
  assert.equal(reconstructSvg(unmarked.nodes[0].el, receipts, 'icon'), null);
  assert.ok(receipts.some((r) => r.startsWith('svg-observed-viewport-unqualified: icon')), receipts.join());
  // The page and the capture disagree on how many svgs there are: nothing is attached.
  const short = tree();
  assert.equal(carrySvgViewports(short, [['0 0 32 32', null]]), false);
  assert.deepEqual(svgsOf(short).map((n: any) => n.svgViewport), [undefined, undefined]);
});

test('generated-text-carried: the text a ::marker, ::before or ::after draws becomes an absolute span in its element', () => {
  const clear = { 'background-color': 'rgba(0, 0, 0, 0)', 'background-image': 'none', 'box-shadow': 'none', 'border-left-width': '0px', 'margin-left': '-24px' };
  const li = (pseudo: Record<string, Record<string, string>>) => ({ tag: 'LI', classes: [], style: { 'border-left-width': '1px' }, pseudo, nodes: [{ t: 'text', v: 'Item' }] }) as any;
  const tree = () => ({ tag: 'ol', classes: [], style: {}, pseudo: {}, nodes: [
    { t: 'el', el: li({ '::marker': { ...clear }, '::after': { ...clear, color: 'red' } }) },
    { t: 'el', el: li({ '::before': { ...clear, 'background-color': 'rgb(0, 0, 0)' } }) },
    { t: 'el', el: li({ '::before': { ...clear } }) },
    { t: 'el', el: li({ '::before': { ...clear, content: 'url("dot.png") "x"' } }) }, { t: 'el', el: li({ '::before': { ...clear } }) }] }) as any;
  // Page coordinates: each li's border box, and what its pseudo-elements drew (the third draws only a space, the fourth
  // an image and then text; the layout holds no text for the fifth).
  const drawn = { boxes: new Map([[0, [42, 42]], [1, [66, 42]], [2, [66, 62]], [3, [66, 82]], [4, [66, 102]], [5, [66, 122]]]), texts: new Map([
    [1, [{ pe: '::after' as const, text: '*', x: 120, y: 42 }, { pe: '::marker' as const, text: '1. ', x: 50, y: 42 }]],
    [2, [{ pe: '::before' as const, text: '2.', x: 42, y: 62 }]], [3, [{ pe: '::before' as const, text: ' ', x: 42, y: 82 }]],
    [4, [{ pe: '::before' as const, text: 'x', x: 42, y: 102 }]]]), };
  const on = tree(), add = carryGeneratedText(on, ['ol', 'li', 'li', 'li', 'li', 'li'], drawn);
  assert.ok(add);
  // Matched as captured, added later: an element another pass moves meanwhile keeps its own spans.
  const [first, painted, blank, image, unread] = on.nodes.map((k: any) => k.el);
  on.nodes.reverse();
  add();
  assert.deepEqual(first.nodes.map((k: any) => k.t === 'text' ? k.v : [k.el.nodes[0].v, k.el.style.position, k.el.style.left, k.el.style.top, k.el.style['margin-left']]),
    [['1. ', 'absolute', '-17px', '0px', '0px'], 'Item', ['*', 'absolute', '53px', '0px', '0px']]);
  assert.deepEqual(first.pseudo, {});
  assert.equal(first.nodes[2].el.style.color, 'red');
  // A pseudo-element that paints a box, draws only spaces, draws an image or has no text in the layout stays as captured.
  for (const kept of [painted, blank, image, unread]) { assert.equal(kept.nodes.length, 1); assert.ok(kept.pseudo['::before']); }
  // The page's elements and the capture's differ: nothing is carried.
  const off = tree();
  assert.equal(carryGeneratedText(off, ['ol', 'li', 'li'], drawn), null);
  assert.deepEqual(off, tree());
});

test('capture-marked-subject: every case is captured from the marked subject; off, only a selected instance is', () => {
  const on = new Set(['capture-marked-subject']), subject = ['[data-ds-reader-subject]'];
  assert.deepEqual([captureRootPath(undefined, on), captureRootPath(2, on)], [subject, subject]);
  // Off: the cell's first drawn child (no path), unless the reader selected one of the story's instances.
  assert.deepEqual([captureRootPath(undefined, new Set()), captureRootPath(0, new Set())], [undefined, subject]);
});

test('normal-line-height-as-drawn: a one-line text element whose line-height is normal takes the height it was drawn at', () => {
  const el = (style: Record<string, string>, nodes: unknown[]) => ({ tag: 'span', classes: [], style, pseudo: {}, nodes }) as any;
  const text = (v: string) => ({ t: 'text', v });
  const box = { 'line-height': 'normal', 'font-size': '12px', 'box-sizing': 'border-box', 'padding-top': '1px', 'padding-bottom': '0px' };
  const label = el({ ...box, height: '16px' }, [text('AI')]);
  const tree = el({ 'line-height': 'normal', 'font-size': '12px', height: '17px' }, [{ t: 'el', el: label },
    { t: 'el', el: el({ ...box, height: '40px' }, [text('Two lines')]) }, { t: 'el', el: el({ ...box, height: 'auto' }, [text('inline')]) },
    { t: 'el', el: el({ ...box, 'line-height': '20px', height: '20px' }, [text('px')]) }, { t: 'el', el: el({ ...box, height: '1px' }, [text('Hidden')]) }]);
  // The label's content box (16 - 1 px padding) is its one line; the wrapper holds elements, the second box two lines,
  // the third is inline, the fourth already names a px line height and the fifth is a 1 px clipped box: none changes.
  assert.equal(spellNormalLineHeight(tree), 1);
  assert.deepEqual(tree.nodes.map((k: any) => k.el.style['line-height']), ['15px', 'normal', 'normal', '20px', 'normal']);
  assert.equal(tree.style['line-height'], 'normal');
});

test('unregistered-channel-not-minted: a channel no registry carries is not minted; off, everything is', () => {
  // A flex item's `order` has no token, literal or declared channel; registered channels of each kind are minted as before.
  assert.deepEqual(['order', 'z-index', 'flex-grow', 'background-color', 'border-style'].map(carriedChannel), [false, true, true, true, true]);
  const base = [{ part: 'up-icon', cssProperty: 'order' }, { part: 'up-icon', cssProperty: 'z-index' }, { part: '', cssProperty: '--grid-columns' }];
  const state = [{ part: 'up-icon', cssProperty: 'order' }];
  const on = mintedObservations(base, state, true);
  assert.deepEqual([on.baseObs.map((o) => o.cssProperty), on.stateObs, on.named.map((n) => n.split(' —')[0])],
    [['z-index'], [], ['channel-unregistered: up-icon order', 'channel-unregistered: root --grid-columns']]);
  // Off: the old mint, every observation kept and nothing named (validation then refuses as before).
  assert.deepEqual(mintedObservations(base, state, false), { baseObs: base, stateObs: state, named: [] });
});

test('absolute-in-containing-block: an absolute element whose parent is not its containing block moves to the ancestor that is', () => {
  const el = (tag: string, classes: string[], style: Record<string, string>, nodes: unknown[] = []) =>
    ({ tag, classes, style, pseudo: {}, nodes: nodes.map((n) => (typeof n === 'string' ? { t: 'text', v: n } : { t: 'el', el: n })) }) as any;
  const names = (n: any): unknown => [n.classes[0] ?? n.tag, ...n.nodes.filter((k: any) => k.t === 'el').map((k: any) => names(k.el))];
  // A positioned field wrapper: the text box, then a static 0-wide holder whose absolute badge is inset from the wrapper.
  const tree = (holder: Record<string, string> = {}) => el('div', ['wrapper'], { position: 'relative', display: 'flex' }, [
    el('textarea', ['field'], { 'flex-grow': '1' }),
    el('div', ['holder'], { width: '0px', ...holder }, [el('div', ['badge'], { position: 'absolute', left: '1164px', top: '12px', right: '16px' }, [el('span', ['dot'], {})])]),
    el('div', ['rule'], { position: 'absolute', left: '0px' }),
  ]);
  const on = tree();
  assert.equal(liftToContainingBlock(on), 1);
  assert.deepEqual(names(on), ['wrapper', ['field'], ['holder'], ['badge', ['dot']], ['rule']]);
  // An ancestor between them that clips, hides or fades what it draws keeps the element where it is.
  for (const holder of [{ 'overflow-x': 'hidden' }, { display: 'none' }, { opacity: '0.5' }, { visibility: 'hidden' }] as Record<string, string>[]) {
    const r = tree(holder);
    assert.equal(liftToContainingBlock(r), 0, JSON.stringify(holder));
    assert.deepEqual(names(r), ['wrapper', ['field'], ['holder', ['badge', ['dot']]], ['rule']]);
  }
  // A holder that is itself positioned is the containing block; no ancestor in the tree is one: nothing moves.
  assert.equal(liftToContainingBlock(tree({ position: 'relative' })), 0);
  const bare = tree();
  bare.style.position = 'static';
  assert.equal(liftToContainingBlock(bare), 0);
  assert.deepEqual(names(bare), ['wrapper', ['field'], ['holder', ['badge', ['dot']]], ['rule']]);
});

test('closed-select-draws-selected-label: a closed single select draws its selected label, never its options', () => {
  const option = (text: string) => ({ element: 'option', text, declared: { display: 'block' } });
  const anatomy = { root: { parts: {
    pick: { element: 'select', parts: { o1: option('Choose a region'), o2: option('Dallas'), group: { element: 'optgroup', parts: { o3: option('Sydney') } } } },
    overflow: { element: 'select', parts: { o4: option(''), o5: option('9') } },
    open: { element: 'select', parts: { o6: option('a'), o7: option('b') } },
    hint: { text: 'Region' },
  } } };
  const contract = { anatomy } as any, labels: Record<string, string | null> = { pick: 'Choose a region', overflow: '', open: null, hint: 'x' };
  assert.deepEqual(closedSelectLabels(contract, (part) => labels[part] ?? null), ['pick', 'overflow']);
  const parts = contract.anatomy.root.parts;
  assert.deepEqual([parts.pick.text, parts.pick.parts], ['Choose a region', undefined]);
  assert.deepEqual([parts.overflow.text, parts.overflow.parts], [undefined, undefined]);
  assert.deepEqual(Object.keys(parts.open.parts), ['o6', 'o7'], 'a select the capture did not read as closed and single keeps its options');
  assert.equal(parts.hint.text, 'Region');
});

test('a root measured hugging beneath its max-width in every combo carries hugsBelowMaxWidth, as the harness route does', () => {
  const root = (extra: object) => ({ anatomy: { root: { tokens: { 'max-width': '{w.cap}' }, parts: { label: { tokens: { 'max-width': '{w.cap}' } } }, ...extra } } }) as any;
  const hugs = (v: boolean) => new Map([['root', v], ['label', true]]);
  const hugging = root({});
  assert.equal(carryRootHugEvidence(hugging, hugs(true)), true);
  assert.deepEqual([hugging.anatomy.root.hugsBelowMaxWidth, hugging.anatomy.root.parts.label.hugsBelowMaxWidth], [true, undefined]);
  for (const [c, h] of [[root({}), new Map([['label', true]])], [root({}), hugs(false)], [{ anatomy: { root: { tokens: {} } } } as any, hugs(true)]] as const) {
    assert.equal(carryRootHugEvidence(c, h), false);
    assert.equal(c.anatomy.root.hugsBelowMaxWidth, undefined);
  }
});

test('lost-text-realigns-by-class: a variant\'s own text on a part whose base element draws none is named; the prefix is the profile capture config\'s', () => {
  const el = (texts: string[]) => ({ node: { nodes: texts.map((v) => ({ t: 'text', v })) } as never });
  const aligned = (rows: Record<string, Array<ReturnType<typeof el> | null>>) => ({ getAligned: (key: string) => rows[key.replace(/__default$/, '')]! });
  // The base's wrapper (no text of its own) and another variant's label sit in one slot: that label's text is lost.
  assert.equal(textLostByPosition(aligned({ red: [el([]), el([])], blue: [el(['Tag content']), null] }), 'red', ['red', 'blue']), true);
  // Text in the base too, or a whitespace-only run, or a slot the other variant does not draw: nothing is lost.
  assert.equal(textLostByPosition(aligned({ a: [el(['A'])], b: [el(['B'])] }), 'a', ['a', 'b']), false);
  assert.equal(textLostByPosition(aligned({ a: [el([])], b: [el([' \n'])], c: [null] }), 'a', ['a', 'b', 'c']), false);
  const files: Record<string, string> = { 'p.json': JSON.stringify({ setup: { captureConfig: 'c.json' } }), 'c.json': JSON.stringify({ library: { classPrefix: 'x--' } }) };
  assert.equal(profileClassPrefix({ profile: { path: 'p.json', sha256: '' } }, (f) => files[f]!), 'x--');
  assert.equal(profileClassPrefix({ profile: null }), '');
});

test('shrunk-text-wraps-at-drawn-width: a text its flex row shrank until it wrapped carries that width and line count; the writer wraps it there', async () => {
  // Select inline: the helper is an item of a flex row that leaves it 178.547 px; it wraps to 2 lines. Not inline, a block.
  const st = (o: Record<string, string> = {}) => ({ width: '180.547px', 'box-sizing': 'border-box', 'padding-left': '2px', 'padding-right': '0px', 'border-left-width': '0px',
    'border-right-width': '0px', ...o }), row = { display: 'flex', 'flex-direction': 'row' };
  assert.deepEqual(shrunkTextWrap(st(), row, 2), { width: 178.547, lines: 2 });
  assert.deepEqual([shrunkTextWrap(st(), row, 0), shrunkTextWrap(st(), { display: 'flex', 'flex-direction': 'column' }, 2), shrunkTextWrap(st({ 'flex-grow': '1' }), row, 2),
    shrunkTextWrap(st({ position: 'absolute' }), row, 2)], [null, null, null, null]);
  assert.match(MEASURE_TEXT_LINES(undefined), /getClientRects/);
  const [c] = declare({ storybook: 'x', components: [component('a/Select', { axes: ['inline', 'size'], references: ['false', 'true'].flatMap((inline) => ['sm', 'lg'].map((size) =>
    ref('s--a', { inline, size }, { inline, size }))) })] }).components;
  const { contract, combos } = seed(c!), inline = (key: string) => combos.find((k) => k.key === key)!.axisValues.inline === 'true';
  contract.anatomy.root.layout = { display: 'flex', direction: 'row' } as never;
  contract.anatomy.root.parts = { helper: { text: 'Select the region where your resources will be hosted.', literals: { 'font-size': '12px', 'line-height': '16px' } },
    other: { text: 'x' } } as never;
  // Rows only where it wraps, over the axis that tells wrapping from not; a reading the axes do not decide is named.
  assert.deepEqual(carryTextWrap(contract, c!.axes, combos, (key, part) => part === 'helper' && inline(key) ? { width: 178.547, lines: 2 } : null), [['helper'], []]);
  const parts = contract.anatomy.root.parts as Record<string, { textWrap?: unknown }>;
  assert.deepEqual([parts.helper!.textWrap, parts.other!.textWrap], [{ props: ['inline'], rows: [{ values: ['true'], width: 178.547, lines: 2 }] }, undefined]);
  const twice = [...combos, { ...combos.at(-1)!, key: 'again' }], [, named] = carryTextWrap(structuredClone(contract), c!.axes, twice, (key, part) =>
    part === 'helper' && twice.find((k) => k.key === key)!.axisValues.inline === 'true' ? { width: key === 'again' ? 170 : 178.547, lines: 2 } : null);
  assert.match(named.join('\n'), /^text-wrap-undecided: helper — it wraps at 178\.547 px in \{"inline":"true","size":"lg"\}/);
  // The writer gives the TEXT that width once laid out and lets it grow; a line count other than the browser's is named.
  const { ContractSchema } = await import('./contract-schema.js'), { createFigmaEngine } = await import('../core/emit-figma-script.js');
  const { createFigmaMock } = await import('./plugin-engine-mock-figma.mjs'), vm = await import('node:vm'), parsed = ContractSchema.parse(contract);
  const drawn = async (conventions: string[], lineAt: number) => {
    const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } } as never, icons: new Map(), conventions: conventionSet(conventions) });
    const { figma, root } = createFigmaMock(), f = figma as any, text = f.createText;   // the mock has no font metrics: a line breaks every lineAt px
    f.createText = () => { const n = text(); const resize = n.resize.bind(n); n.resize = (w: number, h: number) => resize(w, w < 300 ? 16 * Math.ceil(308 / lineAt) : h); return n; };
    const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
    await vm.runInContext(`(async()=>{${engine.buildTokensScript(null)}\n})()`, context);
    const out = await vm.runInContext(`(async()=>{${engine.buildComponentScript(parsed, new Map([[parsed.id, parsed]]))}\n})()`, context) as { results: Array<{ degradations?: Array<{ code: string }> }> };
    const helpers = root.findAll((x: any) => x.name === 'helper') as any[];
    return [helpers.filter((n) => n.textAutoResize === 'HEIGHT').map((n) => [n.width, n.height]), Array.from(out.results.flatMap((r) => r.degradations ?? []), (d) => d.code)];
  };
  assert.deepEqual(await drawn(['shrunk-text-wraps-at-drawn-width'], 178.547), [[[178.547, 32], [178.547, 32]], []]);
  assert.deepEqual(await drawn(['shrunk-text-wraps-at-drawn-width'], 120), [[[178.547, 48], [178.547, 48]], ['FC-RT-TEXT-WRAP-LINES', 'FC-RT-TEXT-WRAP-LINES']]);
  assert.deepEqual((await drawn([], 178.547))[0], []);
});
