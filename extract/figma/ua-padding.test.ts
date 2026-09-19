// UA PADDING, CARRIED BY THE PROPOSER (docs/23 §D.44 rule B, as revised by its
// adversarial review, H2). A Figma frame's padding side is a DRAWN fact. When a
// proposal's root renders as an element the user agent pads (UA_PADDING_ELEMENTS,
// re-measured below in the repo's Chromium) and every variant draws 0 on a side
// the contract does not declare, the proposer writes `padding-<side>: 0px`. A
// side the canvas draws NONZERO that the proposal left undeclared was REFUSED;
// it stays undeclared and is named. The emitters add nothing: a hand-written
// `<button>` with partial padding keeps UA padding, exactly as CSS does.
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { proposeBatchFromDump, settleUaPadding } from '../../core/propose-figma.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';
import { emitReact } from '../../core/emit-react.js';
import { tokenInventoryFromJson } from '../../core/tokens.js';
import { ContractSchema } from '../../scripts/contract-schema.js';
import { UA_PADDING_BY_ELEMENT, UA_PADDING_ELEMENTS } from '../../packages/core/src/anatomy.js';
import type { DumpSet } from './types.js';

const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });
const SOLID = [{ type: 'SOLID', color: { r: 0.2, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }];
const set = (setName: string, axis: string, values: string[], padding: (v: string) => number[], children: unknown[] = []) => ({
  setName, type: 'COMPONENT_SET',
  variants: values.map((v) => ({
    name: `${axis}=${v}`, type: 'COMPONENT', fills: SOLID, children,
    layout: { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER', spacing: 0, padding: padding(v), primarySizing: 'AUTO', counterSizing: 'AUTO' },
  })),
});
const propose = (dump: Record<string, unknown>) =>
  proposeBatchFromDump({ _provenance: { note: 'fixture' }, ...dump } as never, { corpus, contractIdByName: new Map(), fileKey: null, mintUnbound: true, projectionMode: 'reviewable-inversion' } as never);
const rootOf = (p: { contract: unknown }) => (p.contract as { anatomy: { root: Record<string, Record<string, string> | undefined> } }).anatomy.root;
const padKeys = (o: Record<string, string> | undefined) => Object.keys(o ?? {}).filter((k) => k.startsWith('padding')).sort();

test('the element list is the Chromium measurement, not a recollection', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><body></body>');
    const padded = await page.evaluate((candidates) => {
      const out: string[] = [];
      for (const tag of candidates) {
        const el = document.createElement(tag);
        if (tag === 'td' || tag === 'th') document.body.appendChild(document.createElement('table')).insertRow().appendChild(el);
        else if (tag === 'legend') document.body.appendChild(document.createElement('fieldset')).appendChild(el);
        else if (tag === 'option') document.body.appendChild(document.createElement('select')).appendChild(el);
        else { if (tag === 'dialog') el.setAttribute('open', ''); document.body.appendChild(el); }
        const cs = getComputedStyle(el);
        if (['top', 'right', 'bottom', 'left'].some((s) => cs.getPropertyValue(`padding-${s}`) !== '0px')) out.push(tag);
      }
      return out;
    }, ['a', 'button', 'div', 'span', 'label', 'p', 'h2', 'li', 'section', 'select', 'input', 'textarea', 'fieldset', 'legend', 'ul', 'ol', 'menu', 'dialog', 'td', 'th', 'option']);
    assert.deepEqual(new Set(padded), UA_PADDING_ELEMENTS);
    // …and the per-side values the notes quote are the measured ones (one table, anatomy.ts).
    const measured = await page.evaluate((tags) => tags.map((tag) => {
      const el = document.createElement(tag);
      if (tag === 'td' || tag === 'th') document.body.appendChild(document.createElement('table')).insertRow().appendChild(el);
      else if (tag === 'legend') document.body.appendChild(document.createElement('fieldset')).appendChild(el);
      else if (tag === 'option') document.body.appendChild(document.createElement('select')).appendChild(el);
      else { if (tag === 'dialog') el.setAttribute('open', ''); document.body.appendChild(el); }
      const cs = getComputedStyle(el);
      return ['top', 'right', 'bottom', 'left'].map((s) => cs.getPropertyValue(`padding-${s}`).replace(/^0px$/, '0'));
    }), Object.keys(UA_PADDING_BY_ELEMENT));
    assert.deepEqual(measured, Object.values(UA_PADDING_BY_ELEMENT));
  } finally {
    await browser.close();
  }
});

test('a proposed <button> that draws padding only on top carries padding-right / bottom / left: 0px, with a note', () => {
  const r = propose({ Button: set('Button', 'Size', ['Sm', 'Md'], () => [8, 0, 0, 0]) });
  const p = r.proposals[0];
  assert.equal((p.contract as { semantics: { element: string } }).semantics.element, 'button');
  const root = rootOf(p);
  assert.deepEqual(
    Object.fromEntries(padKeys(root.literals).map((k) => [k, root.literals![k]])),
    { 'padding-bottom': '0px', 'padding-left': '0px', 'padding-right': '0px' },
  );
  assert.notEqual(root.literals?.['padding-top'], '0px', 'the drawn side is never zeroed');
  assert.ok(p.notes.some((n) => n.startsWith('ua-padding: padding-right / padding-bottom / padding-left = 0px carried as literals')));
  // The emitted sheet says it too (the emitter adds nothing of its own).
  const c = ContractSchema.parse(p.contract);
  const css = emitReact(c, { contracts: new Map([[c.id, c]]), icons: new Map(), tokens: tokenInventoryFromJson([p.mintedTokens?.tree ?? {}]), tokenValues: { primitives: p.mintedTokens?.tree ?? {} } } as never).css;
  for (const side of ['right', 'bottom', 'left']) assert.match(css, new RegExp(`padding-${side}: 0px;`));
});

test('a proposed <button> that draws all four sides gains no zero; a <div> never does', () => {
  const four = propose({ Button: set('Button', 'Size', ['Sm', 'Md'], () => [4, 8, 4, 8]) }).proposals[0];
  assert.deepEqual(Object.values(rootOf(four).literals ?? {}).filter((v) => v === '0px'), []);
  assert.ok(!four.notes.some((n) => n.startsWith('ua-padding:')));
  const div = propose({ Box: set('Box', 'Tone', ['A', 'B'], () => [8, 0, 0, 0]) }).proposals[0];
  assert.equal((div.contract as { semantics: { element: string } }).semantics.element, 'div');
  assert.deepEqual(padKeys(rootOf(div).literals), []);
});

test('H2: a side the canvas DRAWS but the proposal left undeclared (refused) is not zeroed — it is named, and the UA default is what renders', () => {
  const p = { contract: { semantics: { element: 'button' }, anatomy: { root: { tokens: { 'padding-top': '{x}', 'padding-bottom': '{x}' } } } }, notes: [] as string[] };
  const dumpSet = set('Tag', 'Tone', ['A', 'B'], (v) => (v === 'A' ? [6, 12, 6, 12] : [6, 8, 6, 8])) as unknown as DumpSet;
  settleUaPadding(p, dumpSet);
  assert.equal((p.contract.anatomy.root as { literals?: unknown }).literals, undefined, 'nothing is zeroed');
  assert.deepEqual(p.notes, [
    'ua-padding: padding-right is not declared (no value carried) although the canvas draws 8 / 12px there — on a <button> root the user agent\'s default (6px) renders on that side in code, not the drawn value; review',
    'ua-padding: padding-left is not declared (no value carried) although the canvas draws 8 / 12px there — on a <button> root the user agent\'s default (6px) renders on that side in code, not the drawn value; review',
  ]);
  // Idempotent.
  settleUaPadding(p, dumpSet);
  assert.equal(p.notes.length, 2);
  // "refused" only when a refusal for that side is on record.
  const refusedP = { contract: { semantics: { element: 'button' }, anatomy: { root: { tokens: { 'padding-top': '{x}', 'padding-bottom': '{x}' } } } }, notes: ['Tag:root paddingLeft: bindings differ across variants … NAMED, not proposed'] };
  settleUaPadding(refusedP, dumpSet);
  assert.match(refusedP.notes[1], /^ua-padding: padding-right is not declared \(no value carried\)/);
  assert.match(refusedP.notes[2], /^ua-padding: padding-left is not declared \(the value was refused above\)/);
});

test('a side declared by only SOME enum values is declared (no base zero); a single logical side counts only its own physical side', () => {
  const byProp = { contract: { semantics: { element: 'button' }, anatomy: { root: { literalsByProp: [{ prop: 'size', map: { sm: { 'padding-inline': '4px' } } }] } } }, notes: [] as string[] };
  settleUaPadding(byProp, set('B', 'Size', ['Sm', 'Md'], () => [0, 0, 0, 0]) as unknown as DumpSet);
  assert.deepEqual(padKeys((byProp.contract.anatomy.root as { literals?: Record<string, string> }).literals), ['padding-bottom', 'padding-top']);
  const logical = { contract: { semantics: { element: 'button' }, anatomy: { root: { literals: { 'padding-inline-start': '4px' } as Record<string, string> } } }, notes: [] as string[] };
  settleUaPadding(logical, set('B', 'Size', ['Sm', 'Md'], () => [0, 0, 0, 4]) as unknown as DumpSet);
  assert.deepEqual(padKeys(logical.contract.anatomy.root.literals), ['padding-bottom', 'padding-inline-start', 'padding-right', 'padding-top']);
});

test('a withheld element takes its zeros back: Tab Panel (a structural button around a named Button) ends a div with no padding literal', () => {
  const r = propose({
    Button: set('Button', 'Size', ['Sm', 'Md'], () => [4, 8, 4, 8], [{ name: 'Label', type: 'TEXT', characters: 'Go' }]),
    'Tab Panel': set('Tab Panel', 'State', ['Default', 'Focus'], () => [8, 0, 0, 0], [{ name: 'Button', type: 'INSTANCE', instanceOf: 'Button', componentProperties: {} }]),
  });
  const panel = r.proposals.find((p) => p.setName === 'Tab Panel')!;
  assert.equal((panel.contract as { semantics: { element: string } }).semantics.element, 'div');
  assert.deepEqual(Object.values(rootOf(panel).literals ?? {}).filter((v) => v === '0px'), []);
  assert.ok(!panel.notes.some((n) => n.startsWith('ua-padding:')));
});
