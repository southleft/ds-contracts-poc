// THE INFERRED <button> NEVER HOLDS INTERACTIVE CONTENT (docs/23 §D.44, final
// form after two adversarial reviews). A snapshot of every set's ORIGINAL element
// is taken first; declared elements are preserved; name-matched and
// STRUCTURAL (state-axis) button guesses are withheld when their drawing contains any
// interactive content by the snapshot (guesses included); a kept button / a that
// still nests interactive content is NAMED. Every expectation runs in both dump
// orders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { interactiveContentOf, nameWords, inferSemantics, proposeBatchFromDump } from '../../core/propose-figma.js';
import { readFileSync } from 'node:fs';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';

const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });
const LAYOUT = { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER', spacing: 0, padding: [4, 8, 4, 8], primarySizing: 'AUTO', counterSizing: 'AUTO' };
const SOLID = (r: number) => [{ type: 'SOLID', color: { r, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }];

/** A set of variants `<axis>=<value>`, each a frame holding `children`. */
const set = (setName: string, axis: string, values: string[], children: (value: string) => unknown[]) => ({
  setName,
  type: 'COMPONENT_SET',
  variants: values.map((v, i) => ({
    name: `${axis}=${v}`,
    type: 'COMPONENT',
    layout: LAYOUT,
    fills: SOLID(0.2 + i * 0.2),
    children: children(v),
  })),
});
const instance = (of: string) => ({ name: of, type: 'INSTANCE', instanceOf: of, componentProperties: {} });
const text = (characters: string) => ({ name: 'Label', type: 'TEXT', characters });

const propose = (dump: Record<string, unknown>) =>
  proposeBatchFromDump({ _provenance: { note: 'fixture' }, ...dump } as never, {
    corpus,
    contractIdByName: new Map(),
    fileKey: null,
    mintUnbound: true,
    projectionMode: 'reviewable-inversion',
  } as never);
const bySet = (r: ReturnType<typeof propose>, name: string) => {
  const p = r.proposals.find((x) => x.setName === name);
  assert.ok(p, `${name} proposed (skipped: ${JSON.stringify(r.skipped)})`);
  return p!;
};
const elementOf = (p: { contract: unknown }) => (p.contract as { semantics: { element: string } }).semantics.element;
const semNotes = (p: { notes: string[] }) => p.notes.filter((n) => n.startsWith('semantics:'));
const withheld = (p: { notes: string[] }) => p.notes.find((n) => /^semantics: (structural|name-inferred) "button" withheld/.test(n));
const nested = (p: { notes: string[] }) => p.notes.find((n) => n.startsWith('semantics: nested interactive content left in place'));
/** Propose in the given order AND reversed; assert both give identical semantics + semantics notes; return the first. */
const both = (dump: Record<string, unknown>) => {
  const fwd = propose(dump);
  const rev = propose(Object.fromEntries(Object.entries(dump).reverse()));
  for (const p of fwd.proposals) {
    const q = bySet(rev, p.setName);
    assert.deepEqual((q.contract as { semantics: unknown }).semantics, (p.contract as { semantics: unknown }).semantics, `${p.setName}: semantics in reversed order`);
    assert.deepEqual(semNotes(q), semNotes(p), `${p.setName}: semantics notes in reversed order`);
  }
  return fwd;
};
const Button = set('Button', 'Size', ['Sm', 'Md'], () => [text('Go')]);

test('Tab Panel(State) > Button → Tab Panel div, with the withhold note (keyboard / focus / :disabled)', () => {
  const r = both({ Button, 'Tab Panel': set('Tab Panel', 'State', ['Default', 'Focus'], () => [text('Body'), instance('Button')]) });
  assert.equal(elementOf(bySet(r, 'Button')), 'button');
  const panel = bySet(r, 'Tab Panel');
  assert.equal(elementOf(panel), 'div');
  assert.match(withheld(panel)!, /^semantics: structural "button" withheld — the set draws interactive content \("Button": <button>\); HTML forbids interactive content inside <button>, so the set is proposed as the default container "div" — a div provides no keyboard access, no focus and no :disabled behaviour of its own/);
  assert.ok(!panel.notes.some((n) => n.includes('inferred STRUCTURALLY')), 'the structural note is replaced, not duplicated');
});

test('T1: Tab Panel(State) > Button > Label instance → Tab Panel div', () => {
  const r = both({ Label: set('Label', 'Tone', ['A', 'B'], () => [text('Go')]), Button: set('Button', 'Size', ['Sm', 'Md'], () => [instance('Label')]), 'Tab Panel': set('Tab Panel', 'State', ['Default', 'Focus'], () => [text('Body'), instance('Button')]) });
  assert.equal(elementOf(bySet(r, 'Tab Panel')), 'div');
  assert.equal(elementOf(bySet(r, 'Button')), 'button');
});

test('Button > Icon(State=Disabled) → outer guess withheld, Icon unchanged', () => {
  const r = both({ Icon: set('Icon', 'State', ['Default', 'Disabled'], () => []), Button: set('Button', 'Size', ['Sm', 'Md'], () => [instance('Icon'), text('Go')]) });
  assert.equal(elementOf(bySet(r, 'Button')), 'div');
  assert.equal(elementOf(bySet(r, 'Icon')), 'button');
  assert.equal(withheld(bySet(r, 'Icon')), undefined, 'the Icon draws no interactive content, so its guess stands');
  assert.match(withheld(bySet(r, 'Button'))!, /name-inferred.*"Icon": <button>/);
  assert.equal(nested(bySet(r, 'Button')), undefined);
});

test('Dropdown Button > Dropdown Arrow → outer name guess withheld', () => {
  const r = both({ 'Dropdown Arrow': set('Dropdown Arrow', 'Tone', ['A', 'B'], () => []), 'Dropdown Button': set('Dropdown Button', 'Size', ['Sm', 'Md'], () => [text('Go'), instance('Dropdown Arrow')]) });
  assert.equal(elementOf(bySet(r, 'Dropdown Button')), 'div');
  assert.equal(elementOf(bySet(r, 'Dropdown Arrow')), 'select');
  assert.match(withheld(bySet(r, 'Dropdown Button'))!, /"Dropdown Arrow": <select>/);
});

test('Split Button > Icon Button and Toolbar > Icon Button → Icon Button button; Split Button container + inference note; Toolbar unchanged', () => {
  const r = both({
    'Icon Button': set('Icon Button', 'Size', ['Sm', 'Md'], () => []),
    'Split Button': set('Split Button', 'Size', ['Sm', 'Md'], () => [text('Save'), instance('Icon Button')]),
    Toolbar: set('Toolbar', 'Size', ['Sm', 'Md'], () => [instance('Icon Button'), instance('Icon Button')]),
  });
  assert.equal(elementOf(bySet(r, 'Icon Button')), 'button');
  assert.equal(nested(bySet(r, 'Icon Button')), undefined);
  assert.equal(elementOf(bySet(r, 'Split Button')), 'div');
  assert.match(withheld(bySet(r, 'Split Button'))!, /"Icon Button": <button>/);
  assert.equal(elementOf(bySet(r, 'Toolbar')), 'div');
  assert.deepEqual(semNotes(bySet(r, 'Toolbar')).filter((n) => /withheld|nested/.test(n)), []);
});

test('Tab Item(State) > Close Button (icon-only) → Tab Item div; List Row(State) > Checkbox → Row div', () => {
  const tab = both({ 'Close Button': set('Close Button', 'Size', ['Sm', 'Md'], () => []), 'Tab Item': set('Tab Item', 'State', ['Default', 'Hover'], () => [text('T'), instance('Close Button')]) });
  assert.equal(elementOf(bySet(tab, 'Tab Item')), 'div');
  assert.equal(elementOf(bySet(tab, 'Close Button')), 'button');
  const row = both({ Checkbox: set('Checkbox', 'Tone', ['A', 'B'], () => []), 'List Row': set('List Row', 'State', ['Default', 'Hover'], () => [instance('Checkbox'), text('Row')]) });
  assert.equal(elementOf(bySet(row, 'List Row')), 'div');
  assert.match(withheld(bySet(row, 'List Row'))!, /\("Checkbox": <input>\)/);
});

test('Card(State) > Text Label(State) → Card div (a guess withheld because of a guess, noted); Text Label unchanged', () => {
  const r = both({ 'Text Label': set('Text Label', 'State', ['Default', 'Disabled'], () => [text('x')]), Card: set('Card', 'State', ['Default', 'Hover'], () => [instance('Text Label')]) });
  assert.equal(elementOf(bySet(r, 'Card')), 'div');
  assert.match(withheld(bySet(r, 'Card'))!, /\("Text Label": <button>\)/);
  assert.equal(elementOf(bySet(r, 'Text Label')), 'button');
  assert.equal(withheld(bySet(r, 'Text Label')), undefined);
});

test('Alpha Button ↔ Beta Button cycle → both guesses withheld, identical in either order', () => {
  const r = both({
    'Alpha Button': set('Alpha Button', 'Size', ['Sm', 'Md'], () => [instance('Beta Button')]),
    'Beta Button': set('Beta Button', 'Size', ['Sm', 'Md'], (v) => (v === 'Sm' ? [instance('Alpha Button')] : [])),
  });
  assert.deepEqual(r.proposals.map(elementOf), ['div', 'div']);
  assert.match(withheld(bySet(r, 'Alpha Button'))!, /"Beta Button"/);
  assert.match(withheld(bySet(r, 'Beta Button'))!, /"Alpha Button"/);
});

test('the real CBDS dump in file order and reversed: identical semantics and semantics notes on every set; Radio button ↔ Radio button-icon both guesses withheld', () => {
  const dump = JSON.parse(readFileSync('extract/figma/fixtures/cbds-plugin-all-sets.dump.json', 'utf8')) as Record<string, unknown>;
  const r = both(dump);
  for (const [name, other] of [['Radio button', 'Radio button-icon'], ['Radio button-icon', 'Radio button']]) {
    const p = bySet(r, name);
    assert.equal(elementOf(p), 'div', name);
    assert.ok(withheld(p)?.includes(`"${other}": <button>`));
    assert.equal(nested(p), undefined);
  }
});

test('stubs are read by their name with camel / Pascal case split; own and nested parts, attrs and summary count', () => {
  for (const [child, demoted] of [['IconButton', true], ['CloseButton', true], ['close_btn', true], ['Link', true], ['Chevron', false]] as const) {
    const r = propose({ Panel: set('Panel', 'State', ['Default', 'Hover'], () => [instance(child)]) });
    assert.equal(elementOf(bySet(r, 'Panel')), demoted ? 'div' : 'button', child);
  }
  assert.deepEqual(nameWords('IconButton'), ['icon', 'button']);
  assert.deepEqual(nameWords('HTMLButton v2'), ['html', 'button', 'v2']);
  const root = (ids: string[]) => ({ parts: Object.fromEntries(ids.map((id, i) => [`p${i}`, { component: { id } }])) });
  const byId = new Map<string, unknown>([
    ['x.link', { id: 'x.link', name: 'Anchor', semantics: { element: 'a' } }],
    ['x.tab', { id: 'x.tab', name: 'Tab', semantics: { element: 'div', role: 'tab' } }],
    ['x.chip', { id: 'x.chip', name: 'Chip', semantics: { element: 'div' }, anatomy: { root: { parts: { close: { element: 'button' } } } } }],
    ['x.tabbable', { id: 'x.tabbable', name: 'Card', semantics: { element: 'div' }, anatomy: { root: { attrs: { tabindex: '0' } } } }],
    ['x.summary', { id: 'x.summary', name: 'S', semantics: { element: 'summary' } }],
    ['x.plain', { id: 'x.plain', name: 'Plain', semantics: { element: 'div' } }],
    ['x.wrap', { id: 'x.wrap', name: 'Wrap', semantics: { element: 'div' }, anatomy: { root: root(['x.plain', 'x.link']) } }],
    ['x.loop', { id: 'x.loop', name: 'Loop', semantics: { element: 'div' }, anatomy: { root: root(['x.loop']) } }],
    ['x.slotted', { id: 'x.slotted', name: 'Slotted', semantics: { element: 'div' }, anatomy: { root: { parts: { s: { slot: { name: 's', defaultContent: [{ id: 'x.tab' }] } } } } } }],
  ]);
  const of = (ids: string[]) => interactiveContentOf(root(ids), byId);
  assert.deepEqual(of(['x.link']), { child: 'Anchor', what: '<a>' });
  assert.deepEqual(of(['x.tab']), { child: 'Tab', what: 'role "tab"' });
  assert.deepEqual(of(['x.chip']), { child: 'Chip', what: 'part "close" is a <button>' });
  assert.deepEqual(of(['x.tabbable']), { child: 'Card', what: 'part "root" carries tabindex' });
  assert.deepEqual(of(['x.summary']), { child: 'S', what: '<summary>' });
  assert.equal(of(['x.plain']), null);
  assert.deepEqual(of(['x.wrap']), { child: 'Anchor', what: '<a>' }, 'transitive');
  assert.equal(of(['x.loop']), null, 'a cycle terminates');
  assert.deepEqual(of(['x.slotted']), { child: 'Tab', what: 'role "tab"' }, 'slot defaultContent renders');
  assert.equal(of(['x.unknown']), null);
  assert.deepEqual(interactiveContentOf({ parts: { close: { element: 'button' } } }, byId), { child: 'its own anatomy', what: 'part "close" is a <button>' });
});

test('stub namespace segments do not become control names, while the observed leaf still identifies a control', () => {
  for (const [child, interactive] of [
    ['Button / Decoration / Chevron', false],
    ['Controls / CloseButton', true],
    ['__button/helper/loading / spinner', false],
    ['Button / Icon / Link', true],
  ] as const) {
    const r = both({
      Panel: set('Panel', 'State', ['Default', 'Hover'], () => [instance(child)]),
      Button: set('Button', 'Size', ['Sm', 'Md'], () => [instance(child), text('Go')]),
    });
    assert.equal(elementOf(bySet(r, 'Panel')), interactive ? 'div' : 'button', child);
    assert.equal(!!withheld(bySet(r, 'Button')), interactive, child);
    for (const p of r.proposals) for (const stub of p.childStubs ?? []) {
      assert.equal((stub as {semantics:{element:string}}).semantics.element, 'span', 'name evidence does not rewrite the stub contract');
    }
  }
});

test('an observed control layer name survives a variant-qualified main name', () => {
  for (const controlName of ['Button (Icon)', 'Controls / CloseButton']) {
    const control = () => ({...instance('Button (Icon)/Default/sm'), name:controlName});
    const r=both({
      Panel:set('Panel','State',['Default','Hover'],()=>[control()]),
      Button:set('Button','Size',['Sm','Md'],()=>[control(),text('Go')]),
    });
    assert.equal(elementOf(bySet(r,'Panel')),'div',controlName);
    assert.ok(withheld(bySet(r,'Button')),controlName);
  }
});


test('group member inference needs member name, positions and states, and still refuses nested controls', () => {
  const axes:any=[{property:'Position',propName:'position',values:['Left','Middle','Right']}];
  assert.equal(inferSemantics('Button Group Icon Button - Nova',axes,true)?.element,'button');
  assert.equal(inferSemantics('Button Group Icon Button - Nova',axes,true)?.structural,true);
  for(const [name,a,interactive] of [
    ['Button Group',axes,true],['Button Group Icon Button',[],true],
    ['Button Group Icon Button',axes,false],['Button Group Icon Button',[{...axes[0],values:['Primary','Secondary']}],true],
  ] as const)assert.equal(inferSemantics(name,a as any,interactive),null);
  const member=(children:()=>unknown[])=>({setName:'Group Icon Button',type:'COMPONENT_SET',
    variants:['Left','Right'].flatMap(position=>['Default','Hover','Focus'].map(state=>({
      name:`Position=${position}, State=${state}`,type:'COMPONENT',layout:LAYOUT,children:children(),
    })))});
  const plain=propose({'Group Icon Button':member(()=>[text('Action')])});
  assert.equal((bySet(plain,'Group Icon Button').contract as any).semantics.element,'button');
  const nested=propose({'Group Icon Button':member(()=>[instance('Button')]),Button:set('Button','Variant',['A'],()=>[text('Nested')])});
  assert.equal((bySet(nested,'Group Icon Button').contract as any).semantics.element,'div');
});

test('declared outer button is preserved and invalid nesting remains named',()=>{
 const parent={...set('Help Button','Size',['Sm','Md'],()=>[instance('Button')]),semantics:{element:'button'}};
 const r=both({'Help Button':parent,Button});
 const p=bySet(r,'Help Button');
 assert.equal(elementOf(p),'button');
 assert.equal(withheld(p),undefined);
 assert.match(nested(p)!, /HTML forbids this; author one of them/);
 assert.equal(elementOf(bySet(r,'Button')),'button');
});

test('name-inferred Help Button wrapping a linked Button retains the child control',()=>{
 const parent=set('Help Button','State',['Default','Hover'],()=>[instance('Button')]);
 const r=both({'Help Button':parent,Button});
 const p=bySet(r,'Help Button');
 assert.equal(elementOf(p),'div');
 assert.match(withheld(p)!, /name-inferred.*"Button": <button>/);
 assert.equal(nested(p),undefined);
 assert.equal(elementOf(bySet(r,'Button')),'button');
 assert.ok((p.contract as any).anatomy.root.parts.Button.component);
});
