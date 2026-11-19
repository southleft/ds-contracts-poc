import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoryComponent } from './storybook-reader.js';
import { createHash } from 'node:crypto';
import { DECLARED_CHANNELS } from './contract-schema.js';
import { reconstructSvg } from '../extract/computed/anatomy.js';
import { captureRootPath, carryGeneratedText, carryRootHugEvidence, carrySvgViewports, carryVariantText, closedSelectLabels, declare, liftToContainingBlock, paintedFirst, profileClassPrefix, profileConventions, seed, spellSvgRotation, spellNormalLineHeight, textLostByPosition } from './storybook-contracts.js';

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
