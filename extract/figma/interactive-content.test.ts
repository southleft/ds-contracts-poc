// THE INFERRED <button> NEVER HOLDS INTERACTIVE CONTENT (docs/23 §D.44, as
// revised by its adversarial review). HTML forbids interactive content inside
// <button> and <a>. A child counts as interactive content only on a FACT (a
// declared element/role, an authored nested interactive part / role /
// tabindex, a text-drawing set whose button/a comes from its own name, a stub
// whose name ends in "button"), never on a structural or icon-name GUESS.
// Only a STRUCTURAL parent is demoted; inside a NAME-matched parent a child's
// interactive guess is withheld instead. The pass runs over the whole batch,
// so the result does not depend on dump order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { interactiveContentOf, interactiveFactOf, nameWords, proposeBatchFromDump } from '../../core/propose-figma.js';
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
const withheld = (p: { notes: string[] }) => p.notes.find((n) => / withheld — /.test(n));

/** The Tabs shape: a named, text-drawing Button, and a structural panel that holds it. */
const Button = set('Button', 'Size', ['Sm', 'Md'], () => [text('Go')]);
const Panel = set('Tab Panel', 'State', ['Default', 'Focus'], () => [text('Body'), instance('Button')]);

test('Tabs: a STRUCTURAL button holding a named, text-drawing Button is demoted to a div, by name — in either dump order', () => {
  for (const dump of [{ Button, 'Tab Panel': Panel }, { 'Tab Panel': Panel, Button }]) {
    const r = propose(dump);
    assert.equal(elementOf(bySet(r, 'Button')), 'button');
    const panel = bySet(r, 'Tab Panel');
    assert.equal(elementOf(panel), 'div', Object.keys(dump).join(' → '));
    const note = withheld(panel)!;
    assert.match(note, /^semantics: structural "button" withheld — the set contains interactive content \(an instance of "ds\.button" — its element "button" comes from its own name "Button" and it draws text\)/);
    assert.match(note, /no keyboard access, no focus and no :disabled behaviour/);
    assert.ok(!panel.notes.some((n) => n.includes('inferred STRUCTURALLY')), 'the structural note is replaced, not duplicated');
  }
});

test('H1: a named Button holding an Icon with a State axis STAYS a button; the Icon\'s structural guess is withheld instead', () => {
  for (const states of [['Default', 'Disabled'], ['Default', 'Hover']]) {
    const r = propose({ Icon: set('Icon', 'State', states, () => []), Button: set('Button', 'Size', ['Sm', 'Md'], () => [instance('Icon'), text('Go')]) });
    assert.equal(elementOf(bySet(r, 'Button')), 'button');
    const icon = bySet(r, 'Icon');
    assert.equal(elementOf(icon), 'div');
    assert.match(withheld(icon)!, /^semantics: structural "button" withheld — the set is drawn inside "Button", whose "button" comes from its own name; a thing drawn inside a button is not itself a control/);
  }
});

test('H1: icon children named like controls never demote a named Button; their own guess is withheld', () => {
  for (const [iconName, guess] of [['Link', 'a'], ['external-link', 'a'], ['Dropdown Arrow', 'select'], ['Select Arrow', 'select'], ['Toggle Thumb', 'input'], ['Checkbox Icon', 'input']] as const) {
    const r = propose({ [iconName]: set(iconName, 'Tone', ['A', 'B'], () => []), 'Dropdown Button': set('Dropdown Button', 'Size', ['Sm', 'Md'], () => [text('Go'), instance(iconName)]) });
    assert.equal(elementOf(bySet(r, 'Dropdown Button')), 'button', iconName);
    const icon = bySet(r, iconName);
    assert.equal(elementOf(icon), 'div', iconName);
    assert.match(withheld(icon)!, new RegExp(`^semantics: name-matched \\(set "${iconName}"\\) "${guess}" withheld`));
  }
});

test('H1: a structural Card holding a structural Text Label is unchanged from before §D.44 (a guess is never evidence)', () => {
  const r = propose({ 'Text Label': set('Text Label', 'State', ['Default', 'Disabled'], () => [text('x')]), Card: set('Card', 'State', ['Default', 'Hover'], () => [instance('Text Label')]) });
  assert.equal(elementOf(bySet(r, 'Card')), 'button');
  assert.equal(elementOf(bySet(r, 'Text Label')), 'button');
  for (const name of ['Card', 'Text Label']) assert.equal(withheld(bySet(r, name)), undefined);
});

test('a named button holding a named, text-drawing button leaves both in place and NAMES the nesting on the parent', () => {
  const r = propose({ 'Radio button': set('Radio button', 'Size', ['Sm', 'Md'], () => [text('Option')]), 'Radio button-icon': set('Radio button-icon', 'Size', ['Sm', 'Md'], () => [instance('Radio button')]) });
  assert.equal(elementOf(bySet(r, 'Radio button')), 'button');
  const parent = bySet(r, 'Radio button-icon');
  assert.equal(elementOf(parent), 'button');
  assert.ok(parent.notes.some((n) => n.startsWith('semantics: nested interactive content LEFT IN PLACE — "Radio button-icon"')));
});

test('M1: the result does not depend on dump order — two named Buttons over an unproposed "Link" come out the same', () => {
  const r = propose({
    'Primary Button': set('Primary Button', 'Size', ['Sm', 'Md'], () => [instance('Link')]),
    'Secondary Button': set('Secondary Button', 'Size', ['Sm', 'Md'], () => [instance('Link')]),
  });
  assert.deepEqual(r.proposals.map(elementOf), ['button', 'button']);
});

test('M2: stubs named IconButton / CloseButton are evidence (PascalCase split); a stub named Link is not', () => {
  for (const [child, demoted] of [['IconButton', true], ['CloseButton', true], ['close_btn', true], ['Link', false], ['external-link', false]] as const) {
    const r = propose({ Panel: set('Panel', 'State', ['Default', 'Hover'], () => [instance(child)]) });
    assert.equal(elementOf(bySet(r, 'Panel')), demoted ? 'div' : 'button', child);
  }
  assert.deepEqual(nameWords('IconButton'), ['icon', 'button']);
  assert.deepEqual(nameWords('HTMLButton v2'), ['html', 'button', 'v2']);
});

test('interactiveContentOf / interactiveFactOf: declared facts, nested parts, attrs, summary, own parts, transitivity, cycles', () => {
  const root = (ids: string[]) => ({ parts: Object.fromEntries(ids.map((id, i) => [`p${i}`, { component: { id } }])) });
  const byId = new Map<string, unknown>([
    ['x.link', { id: 'x.link', name: 'Anchor', semantics: { element: 'a' }, props: [] }],
    ['x.tab', { id: 'x.tab', name: 'Tab', semantics: { element: 'div', role: 'tab' }, props: [] }],
    ['x.row', { id: 'x.row', name: 'Row', semantics: { element: 'div' }, states: ['hover'], props: [] }],
    ['x.chip', { id: 'x.chip', name: 'Chip', semantics: { element: 'div' }, props: [], anatomy: { root: { parts: { close: { element: 'button' } } } } }],
    ['x.tabbable', { id: 'x.tabbable', name: 'Card', semantics: { element: 'div' }, props: [], anatomy: { root: { attrs: { tabindex: '0' } } } }],
    ['x.attrrole', { id: 'x.attrrole', name: 'Thing', semantics: { element: 'div' }, props: [], anatomy: { root: { attrs: { role: 'button' } } } }],
    ['x.summary', { id: 'x.summary', name: 'S', semantics: { element: 'div' }, props: [], anatomy: { root: { parts: { s: { element: 'summary' } } } } }],
    ['x.plain', { id: 'x.plain', name: 'Plain', semantics: { element: 'div' }, props: [] }],
    ['x.wrap', { id: 'x.wrap', name: 'Wrap', semantics: { element: 'div' }, props: [], anatomy: { root: root(['x.plain', 'x.link']) } }],
    ['x.loop', { id: 'x.loop', name: 'Loop', semantics: { element: 'div' }, props: [], anatomy: { root: root(['x.loop']) } }],
    ['x.slotted', { id: 'x.slotted', name: 'Slotted', semantics: { element: 'div' }, props: [], anatomy: { root: { parts: { s: { slot: { name: 's', defaultContent: [{ id: 'x.tab' }] } } } } } }],
  ]);
  // Contracts the proposer did not propose are DECLARED facts.
  const of = (ids: string[]) => interactiveContentOf(root(ids), byId);
  assert.match(of(['x.link'])!, /"x\.link" — its declared element is "a"/);
  assert.match(of(['x.tab'])!, /its declared role is "tab"/);
  assert.equal(of(['x.row']), null, 'interaction states are the structural guess\'s own evidence, not a fact about a child');
  assert.match(of(['x.chip'])!, /part "close" is a <button>/);
  assert.match(of(['x.tabbable'])!, /part "root" carries tabindex/);
  assert.match(of(['x.attrrole'])!, /part "root" carries role "button"/);
  assert.match(of(['x.summary'])!, /part "s" is a <summary>/);
  assert.equal(of(['x.plain']), null);
  assert.match(of(['x.wrap'])!, /an instance of "x\.wrap" → "x\.link"/);
  assert.equal(of(['x.loop']), null, 'a cycle terminates');
  assert.match(of(['x.slotted'])!, /"x\.slotted" → "x\.tab"/, 'slot defaultContent renders, so it counts');
  assert.equal(of(['x.unknown']), null, 'a contract nobody holds is not assumed interactive');
  assert.match(interactiveContentOf({ parts: { close: { element: 'button' } } }, byId)!, /^its own part "close" is a <button>/);
  // Session-proposed guesses are not facts; a name match is a fact only when it draws text.
  const named = { name: 'Link', semantics: { element: 'a' }, anatomy: { root: {} } };
  assert.equal(interactiveFactOf(named, 'name', false), null);
  assert.match(interactiveFactOf({ ...named, anatomy: { root: { parts: { l: { content: { prop: 'label' } } } } } }, 'name', false)!, /comes from its own name/);
  assert.equal(interactiveFactOf({ name: 'Action', semantics: { element: 'button' }, anatomy: { root: { parts: { l: { text: 'Go' } } } } }, 'structural', false), null);
});
