/** The clean-consumer check is an instrument: a case it mounts wrongly is a
 *  false fidelity failure. These cover case derivation only (no browser). */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { deriveCases, enterState, leaveState, paintOf, residualClass, stateProblems, variantPropValue, type Interaction } from './design-consumer-check.js';

const variantProp = (name: string, type: unknown, values: string[]) =>
  ({ name, type, bindings: { figma: { kind: 'VARIANT', property: name, values: Object.fromEntries(values.map(v => [v, v])) }, code: { prop: name } } });
const contract = { props: [variantProp('size', { enum: ['large', 'small'] }, ['large', 'small']), variantProp('rounded', 'boolean', ['false', 'true'])], anatomy: {} };
const dump = { Badge: { setName: 'Badge', variants: [{ name: 'size=large, rounded=false', nodeId: '1:1' }, { name: 'size=small, rounded=true', nodeId: '1:2' }] } };

test('a boolean prop backed by a VARIANT axis is mounted with a boolean, never the truthy string "false"', () => {
  const cases = deriveCases(dump, contract, 'Badge');
  assert.deepEqual(cases.map(c => c.props), [{ size: 'large', rounded: false }, { size: 'small', rounded: true }]);
  assert.deepEqual(cases.map(c => c.key), ['size-large_rounded-false', 'size-small_rounded-true']);
});

test('only a boolean-typed prop is coerced; an enum value spelled "true" stays a string', () => {
  assert.equal(variantPropValue({ type: 'boolean' }, 'false'), false);
  assert.equal(variantPropValue({ type: { enum: ['true', 'false'] } }, 'true'), 'true');
  assert.equal(variantPropValue({ type: 'boolean' }, 'on'), 'on');
});

// docs/23 §D.41 — a designer's INTERACTION-STATE axis is not a prop. The check
// reads it by the proposer's own table and mounts each state the way a user
// reaches it; it used to report every such variant as "State (no VARIANT prop)".
const stateContract = { props: [variantProp('Tone', { enum: ['a', 'b'] }, ['a', 'b']), { name: 'disabled', type: 'boolean', bindings: { figma: { kind: 'BOOLEAN', property: 'Disabled' }, code: { prop: 'disabled' } } }],
  states: ['hover', 'active', 'focus-visible', 'disabled'], anatomy: {} };
const stateDump = (states: string[], axis = 'State') => ({ Pill: { setName: 'Pill', variants: states.flatMap(s => ['a', 'b'].map((t, i) => ({ name: `${axis}=${s}, Tone=${t}`, nodeId: `2:${s}${i}` }))) } });

test('a state-axis variant is MOUNTED: hover / pressed / focus as the real interaction, disabled as the prop, the rest value as nothing', () => {
  const cases = deriveCases(stateDump(['Default', 'Hover', 'Pressed', 'Focus', 'Disabled']), stateContract, 'Pill');
  assert.equal(cases.length, 10);
  assert.deepEqual(cases.filter(c => c.props.Tone === 'a').map(c => [c.key, c.interaction, c.state ?? null, c.props]), [
    ['Tone-a', 'none', null, { Tone: 'a' }],
    ['Tone-a_state-hover', 'hover', 'hover', { Tone: 'a' }],
    ['Tone-a_state-active', 'active', 'active', { Tone: 'a' }],
    ['Tone-a_state-focus-visible', 'focus-visible', 'focus-visible', { Tone: 'a' }],
    ['disabled-true_Tone-a', 'none', 'disabled', { disabled: true, Tone: 'a' }],
  ]);
  assert.equal(new Set(cases.map(c => c.key)).size, 10, 'every Figma variant has its own cell');
});

test('a plain variant set derives exactly what it always did (no state, no interaction)', () => {
  assert.deepEqual(deriveCases(dump, contract, 'Badge').map(c => [c.interaction, c.state]), [['none', undefined], ['none', undefined]]);
});

// ---------------------------------------------------------------------------
// The three NAMED state problems, on a local page (no Figma token, no build).
// Review, PR 131 M4: hover/active used to count as reached whenever the root had
// a box; the paint string read one border and no decoration; releasing the mouse
// over the root synthesised a real click on every pressed cell.
// ---------------------------------------------------------------------------
const FIXTURE = `<!doctype html><html><head><style>
  body{margin:0} [data-cell]{display:inline-block;margin:24px;position:relative}
  button,a,div.c{display:inline-block;padding:4px 8px;background:#ddd;color:#111;border:0;text-decoration:none}
  .paints:hover{background:#900} .paints:active{background:#600} .paints:focus-visible{outline:2px solid #00f}
  .underline:hover{text-decoration:underline} .bottom:hover{border-bottom:2px solid #00f} .moves:active{transform:scale(.98)}
  .veil{position:absolute;inset:0;z-index:2} .ghost{pointer-events:none}
</style></head><body>
  <div data-cell="paints"><button class="paints">x</button></div>
  <div data-cell="covered"><button class="paints">x</button><span class="veil"></span></div>
  <div data-cell="ghost"><button class="paints ghost">x</button></div>
  <div data-cell="inert"><button>x</button></div>
  <div data-cell="underline"><a class="underline" href="#navigated-underline">x</a></div>
  <div data-cell="bottom"><button class="bottom">x</button></div>
  <div data-cell="moves"><a class="moves" href="#navigated">x</a></div>
  <div data-cell="unfocusable"><div class="c">x</div></div>
  <div data-cell="focusable"><button class="paints">x</button></div>
</body></html>`;

test('state cells on a local page: reach is the REAL pseudo-class, paint is every channel a state may carry, and no click is ever synthesised', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 400 } });
    await page.setContent(FIXTURE);
    const clicks: string[] = [];
    await page.exposeFunction('__clicked', (what: string) => { clicks.push(what); });
    await page.evaluate("document.addEventListener('click', e => window.__clicked(e.target.closest('[data-cell]')?.dataset.cell ?? e.target.tagName), true)");
    const ALL = ['hover', 'active', 'focus-visible', 'disabled'];
    const exercise = async (key: string, interaction: Interaction, declared: string[] = ALL) => {
      const cell = page.locator(`[data-cell="${key}"]`);
      const entered = await enterState(page, cell, interaction);
      const changed = (await cell.evaluate(paintOf)) !== entered.restPaint;
      await leaveState(page, interaction);
      return { reached: entered.reached, changed, problems: stateProblems({ key, interaction, state: interaction === 'none' ? undefined : interaction }, declared, entered.reached, changed) };
    };
    // Reached and painted: no problem.
    assert.deepEqual(await exercise('paints', 'hover'), { reached: true, changed: true, problems: [] });
    assert.deepEqual(await exercise('paints', 'active'), { reached: true, changed: true, problems: [] });
    assert.deepEqual(await exercise('focusable', 'focus-visible'), { reached: true, changed: true, problems: [] });
    // state-unreachable: a box is not reach — a covered root and a pointer-events:none root never match :hover / :active.
    assert.deepEqual((await exercise('covered', 'hover')).problems, ['state-unreachable:hover:covered']);
    assert.deepEqual((await exercise('ghost', 'active')).problems, ['state-unreachable:active:ghost']);
    assert.deepEqual((await exercise('unfocusable', 'focus-visible')).problems, ['state-unreachable:focus-visible:unfocusable'], 'nothing in the cell can take keyboard focus');
    // state-inert: reached, the contract declares the state, and nothing the cell paints changed.
    assert.deepEqual(await exercise('inert', 'hover'), { reached: true, changed: false, problems: ['state-inert:hover:inert'] });
    // …but a state that changes ONLY text-decoration, ONLY the bottom border, or ONLY transform is not inert.
    assert.deepEqual((await exercise('underline', 'hover')).problems, []);
    assert.deepEqual((await exercise('bottom', 'hover')).problems, []);
    assert.deepEqual((await exercise('moves', 'active')).problems, []);
    // state-not-carried: the contract declares no such state (the cell renders rest; the pixels judge) — and then inert is NOT claimed.
    assert.deepEqual((await exercise('inert', 'hover', ['focus-visible'])).problems, ['state-not-carried:hover']);
    // The pressed cells were released with the pointer parked off the component: no click on any cell, no navigation.
    assert.deepEqual(clicks.filter((c) => c !== 'HTML' && c !== 'BODY'), [], `clicks landed on: ${clicks.join(', ')}`);
    assert.equal(await page.evaluate('location.hash'), '');
    // No residue: nothing is hovered or focused after the last cell.
    assert.equal(await page.evaluate("document.querySelectorAll('[data-cell]:hover, [data-cell] :hover').length + (document.activeElement === document.body ? 0 : 1)"), 0);
  } finally { await browser.close(); }
});

test('a fixed-size control with a typography-only hover is reached and visibly changes', async () => {
  const browser = await chromium.launch();
  try {
    for (const [property, value] of [['font-size', '24px'], ['font-family', 'serif'], ['line-height', '30px']]) {
      const page = await browser.newPage({ viewport: { width: 900, height: 400 } });
      await page.setContent(`<!doctype html><style>
        body { margin: 24px } [data-cell] { display: inline-block }
        button { display: block; width: 140px; height: 80px; border: 0; font: 12px/14px monospace }
        button:hover { ${property}: ${value} }
      </style><div data-cell><button>One<br>two</button></div>`);
      const cell = page.locator('[data-cell]');
      const beforeBox = await cell.locator('button').boundingBox();
      const before = await cell.screenshot();
      const entered = await enterState(page, cell, 'hover');
      const after = await cell.screenshot();
      const changed = (await cell.evaluate(paintOf)) !== entered.restPaint;
      assert.deepEqual(await cell.locator('button').boundingBox(), beforeBox, `${property}: the control kept its bounds`);
      assert.notDeepEqual(after, before, `${property}: the browser really painted different text`);
      assert.equal(await cell.locator('button').evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property), value);
      assert.deepEqual(stateProblems({ key: property, interaction: 'hover', state: 'hover' }, ['hover'], entered.reached, changed), []);
      await leaveState(page, 'hover');
      await page.close();
    }
  } finally { await browser.close(); }
});

test('the text-masked number only NAMES an over-limit row: at the limit is text-only, a hair over is beyond-text, a full mask claims nothing', () => {
  assert.equal(residualClass(0, 40), 'text-only');
  assert.equal(residualClass(5, 40), 'text-only');
  assert.equal(residualClass(5.0001, 40), 'beyond-text');
  // The mask covered every pixel: there is no remainder to measure, so no font claim is made.
  assert.equal(residualClass(null, 100), 'text-covers-canvas');
  // No text was drawn: an over-limit row cannot be a text residual.
  assert.equal(residualClass(12, 0), 'no-text');
});
