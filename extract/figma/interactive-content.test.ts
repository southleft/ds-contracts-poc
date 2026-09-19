// THE INFERRED <button> NEVER HOLDS INTERACTIVE CONTENT (docs/23 §D.44).
//
// HTML forbids interactive content inside <button> and <a>. The structural
// row of the semantics table (an interaction-state axis and no name signal →
// "button") made Altitude's `Tab Panel` a <button> whose variants hold an
// instance of Altitude's `Button` — itself a <button>. The generated DOM was
// <button><button>…. The rule: when the drawing renders interactive content
// (a child contract the proposer already holds — proposed earlier in this
// batch, or in the caller's scope — that is an interactive element / role,
// carries interaction states, or is a container whose NAME the table reads as
// interactive; transitively), the inference is withheld and the set stays the
// default container, with a named note. The name-matched row obeys the same
// rule; a stamped element is never withheld.
import test from 'node:test';
import assert from 'node:assert/strict';
import { interactiveContentOf, proposeBatchFromDump } from '../../core/propose-figma.js';
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

/** An interactive child (State axis, no name signal → structural button) and
 *  a plain one (no state axis, no name signal → div). */
const Action = set('Action', 'State', ['Default', 'Hover'], () => [text('Go')]);
const Glyph = set('Glyph', 'Tone', ['A', 'B'], () => []);

const propose = (dump: Record<string, unknown>, contractsById?: Map<string, unknown>, contractIdByName?: Map<string, string>) =>
  proposeBatchFromDump({ _provenance: { note: 'fixture' }, ...dump } as never, {
    corpus,
    contractIdByName: contractIdByName ?? new Map(),
    ...(contractsById ? { contractsById: contractsById as never } : {}),
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
const withheldNote = (p: { notes: string[] }) => p.notes.find((n) => n.includes('withheld — the set contains interactive content'));

test('positive: a structural button whose variants hold an instance of an interactive sibling stays a div, by name', () => {
  const r = propose({ Action, Panel: set('Panel', 'State', ['Default', 'Focus'], () => [instance('Action')]) });
  assert.equal(elementOf(bySet(r, 'Action')), 'button', 'the child is still the structural button');
  const panel = bySet(r, 'Panel');
  assert.equal(elementOf(panel), 'div');
  const note = withheldNote(panel);
  assert.ok(note, 'the withhold is a named note');
  assert.match(note!, /^semantics: structural "button" withheld — the set contains interactive content \(an instance of "ds\.action" — its contract's element is "button"\)/);
  assert.ok(!panel.notes.some((n) => n.includes('inferred STRUCTURALLY')), 'the structural note is replaced, not duplicated');
  assert.ok(!panel.notes.some((n) => n.startsWith('semantics.element defaulted to "div"')), 'the generic default note does not stand in for the reason');
});

test('negative: a structural button holding only non-interactive content is unchanged', () => {
  const r = propose({ Glyph, Panel: set('Panel', 'State', ['Default', 'Focus'], () => [instance('Glyph')]) });
  assert.equal(elementOf(bySet(r, 'Glyph')), 'div');
  const panel = bySet(r, 'Panel');
  assert.equal(elementOf(panel), 'button');
  assert.equal(withheldNote(panel), undefined);
  assert.ok(panel.notes.some((n) => n.includes('inferred STRUCTURALLY')));
});

test('the name-matched row obeys the same rule: "Split Button" holding an interactive instance is a div; "Icon Button" holding a glyph stays a button', () => {
  const r = propose({
    Action,
    Glyph,
    'Split Button': set('Split Button', 'Size', ['Sm', 'Md'], () => [instance('Action'), instance('Action')]),
    'Icon Button': set('Icon Button', 'Size', ['Sm', 'Md'], () => [instance('Glyph')]),
  });
  const split = bySet(r, 'Split Button');
  assert.equal(elementOf(split), 'div');
  assert.match(withheldNote(split)!, /^semantics: name-matched \(set "Split Button"\) "button" withheld/);
  assert.equal(elementOf(bySet(r, 'Icon Button')), 'button');
});

test('interactive content is decided from contracts the proposer holds: order matters, and an unknown child is never assumed interactive', () => {
  // Panel BEFORE Action: the child is not proposed yet, so nothing is known about it — a stub, not interactive.
  const r = propose({ Panel: set('Panel', 'State', ['Default', 'Focus'], () => [instance('Action')]), Action });
  assert.equal(elementOf(bySet(r, 'Panel')), 'button');
  assert.equal(withheldNote(bySet(r, 'Panel')), undefined);
});

test('interactiveContentOf: element, role, interaction states, name table (containers only), transitivity, cycles', () => {
  const root = (ids: string[]) => ({ parts: Object.fromEntries(ids.map((id, i) => [`p${i}`, { component: { id } }])) });
  const byId = new Map<string, unknown>([
    ['x.link', { id: 'x.link', name: 'Anchor', semantics: { element: 'a' }, props: [] }],
    ['x.tab', { id: 'x.tab', name: 'Tab', semantics: { element: 'div', role: 'tab' }, props: [] }],
    ['x.row', { id: 'x.row', name: 'Row', semantics: { element: 'div' }, states: ['hover'], props: [] }],
    ['x.stub', { id: 'x.stub', name: 'Checkbox', semantics: { element: 'span' }, props: [] }],
    ['x.heading', { id: 'x.heading', name: 'Button Title', semantics: { element: 'h2' }, props: [] }],
    ['x.plain', { id: 'x.plain', name: 'Plain', semantics: { element: 'div' }, props: [] }],
    ['x.wrap', { id: 'x.wrap', name: 'Wrap', semantics: { element: 'div' }, props: [], anatomy: { root: root(['x.plain', 'x.link']) } }],
    ['x.loop', { id: 'x.loop', name: 'Loop', semantics: { element: 'div' }, props: [], anatomy: { root: root(['x.loop']) } }],
    ['x.slotted', { id: 'x.slotted', name: 'Slotted', semantics: { element: 'div' }, props: [], anatomy: { root: { parts: { s: { slot: { name: 's', defaultContent: [{ id: 'x.tab' }] } } } } } }],
  ]);
  const of = (ids: string[]) => interactiveContentOf(root(ids), byId, new Map());
  assert.match(of(['x.link'])!, /"x\.link" — its contract's element is "a"/);
  assert.match(of(['x.tab'])!, /its contract's role is "tab"/);
  assert.match(of(['x.row'])!, /interaction state\(s\) "hover"/);
  assert.match(of(['x.stub'])!, /its name "Checkbox" matches the element table \(element "input"\)/);
  assert.equal(of(['x.heading']), null, 'a contract that names a non-container element keeps its own word');
  assert.equal(of(['x.plain']), null);
  assert.match(of(['x.wrap'])!, /an instance of "x\.wrap" → "x\.link"/);
  assert.equal(of(['x.loop']), null, 'a cycle terminates');
  assert.match(of(['x.slotted'])!, /"x\.slotted" → "x\.tab"/, 'slot defaultContent renders, so it counts');
  assert.equal(of(['x.unknown']), null, 'a contract the proposer does not hold is not assumed interactive');
  assert.equal(interactiveContentOf(root(['x.link']), undefined, undefined), null);
});
