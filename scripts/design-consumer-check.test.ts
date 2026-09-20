/** The clean-consumer check is an instrument: a case it mounts wrongly is a
 *  false fidelity failure. These cover case derivation only (no browser). */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { contentBox, alignPair, diffPair } from '../extract/figma/visual-parity/img.js';
import { NODE_SCREENSHOT_OPTIONS, contractGraph, findDumpSet, nestedInteractiveScript, deriveCases, rewriteWorkPaths, enterState, leaveState, paintOf, variantPaintOf, residualClass, stateProblems, variantPropValue, type Interaction } from './design-consumer-check.js';

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

// docs/23 §D.43 — a closure dump holds several sets; the mounted one is found by
// key, set name, or the contract's own anchor node id (`Checkbox Group` generates
// `CheckboxGroup`, so the name alone never matched and needed an alias key).
test('the mounted set is resolved by the contract anchor, and a name hit that contradicts the anchor REFUSES (review M2)', () => {
  const multi = { _provenance: {}, Checkbox: { setName: 'Checkbox', nodeId: '1:1', variants: [] }, 'Checkbox Group': { setName: 'Checkbox Group', nodeId: '2:2', variants: [{ name: 'size=large, rounded=false' }] } };
  const anchored = { ...contract, bindings: { figma: { anchors: { nodeId: '2:2' } } } };
  assert.equal(findDumpSet(multi, anchored, 'CheckboxGroup')?.setName, 'Checkbox Group');
  assert.equal(findDumpSet(multi, anchored, 'Checkbox Group')?.setName, 'Checkbox Group');
  // The child's set name with the GROUP's contract: one set's variants would be
  // mounted against another's contract — refused by name, never returned.
  assert.throws(() => findDumpSet(multi, anchored, 'Checkbox'), /dump-set-anchor-mismatch:Checkbox: .*node 1:1 .*anchored to 2:2/);
  // No anchor on the contract: the name lookup stands; no anchor match → none.
  assert.equal(findDumpSet(multi, contract, 'Checkbox')?.setName, 'Checkbox');
  assert.equal(findDumpSet(multi, contract, 'CheckboxGroup'), undefined);
  assert.equal(deriveCases(multi, anchored, 'CheckboxGroup').length, 1);
});

test('source pairing refuses conflicting files, duplicate identities and an unverified named anchor', () => {
  const root = { setName: 'Control', nodeId: '1:2', variants: [{ name: 'size=small' }] };
  const anchored = { ...contract, bindings: { figma: { anchors: { fileKey: 'file-A', nodeId: '1:2' } } } };
  const source = { _provenance: { fileKey: 'file-A' }, Control: root };
  assert.equal(findDumpSet(source, anchored, 'Control'), root);
  assert.equal(findDumpSet(source, anchored, 'GeneratedControl'), root);
  assert.throws(() => deriveCases({ ...source, _provenance: { fileKey: 'file-B' } }, anchored, 'Control'), /dump-set-file-mismatch/);
  assert.throws(() => findDumpSet({ ...source, Other: { ...root, setName: 'Other' } }, anchored, 'GeneratedControl'), /dump-set-anchor-ambiguous/);
  assert.throws(() => findDumpSet({ ...source, Other: { ...root, setName: 'Other' } }, anchored, 'Control'), /dump-set-anchor-ambiguous/);
  assert.throws(() => findDumpSet({ A: { ...root, nodeId: '1:3' }, B: root }, contract, 'Control'), /dump-set-name-ambiguous/);
  assert.throws(() => findDumpSet({ Control: { ...root, nodeId: undefined } }, anchored, 'Control'), /dump-set-anchor-mismatch/);
  assert.equal(findDumpSet({ Control: root }, contract, 'Control'), root, 'unanchored legacy inputs retain their unique name lookup');
});

test('the contract graph follows the generator\'s own edges — component refs, slot accepts AND slot defaultContent (review M3) — and names an unclaimed id', () => {
  const ref = (id: string) => ({ component: { id } });
  const root = { id: 'ds.tabs', anatomy: { root: { parts: { tab: ref('ds.tab'), panel: ref('ds.tab-panel') } } } };
  const siblings = [
    { id: 'ds.tab', name: 'Tab', anatomy: {}, __stub: true },
    { id: 'ds.tab-panel', name: 'TabPanel', anatomy: { root: { parts: { b: ref('ds.button'), gone: ref('ds.missing') } } } },
    { id: 'ds.button', name: 'Button', anatomy: { root: { parts: { i: ref('ds.icon') } } } },
    // Altitude's Icon: its glyph is slot DEFAULT CONTENT, not a component ref.
    { id: 'ds.icon', name: 'Icon', anatomy: { root: { parts: { box: { slot: { name: 'icon', accepts: ['ds.star'], defaultContent: [{ id: 'ds.arrow-arc-left' }] } } } } } },
    { id: 'ds.arrow-arc-left', name: 'ArrowArcLeft', anatomy: {}, __stub: true },
  ];
  assert.deepEqual(contractGraph(root, siblings), [
    { id: 'ds.arrow-arc-left', name: 'ArrowArcLeft', stub: true },
    { id: 'ds.button', name: 'Button', stub: false },
    { id: 'ds.icon', name: 'Icon', stub: false },
    { id: 'ds.missing', name: null, stub: false },
    { id: 'ds.star', name: null, stub: false },
    { id: 'ds.tab', name: 'Tab', stub: true },
    { id: 'ds.tab-panel', name: 'TabPanel', stub: false },
  ]);
});

test('interactive content nested in interactive content is found in the page; a label around its control is not (review H1)', async (t) => {
  let browser;
  try { browser = await chromium.launch(); } catch { t.skip('chromium unavailable'); return; }
  try {
    const page = await browser.newPage();
    await page.setContent(`
            <div data-cell="link"><a href="#">x <input type="checkbox"></a></div>
      <div data-cell="focus"><div role="tab"><span tabindex="0">t</span></div></div>
      <div data-cell="ok"><fieldset><label><input type="checkbox"> a</label><button>b</button></fieldset></div>`);
    // The HTML PARSER closes an open <button> at a nested one; React builds the
    // DOM with createElement, which does not — so build the panel the same way.
    await page.evaluate(`(() => { const cell = document.createElement('div'); cell.setAttribute('data-cell', 'panel');
      const outer = document.createElement('button'); const inner = document.createElement('button'); inner.textContent = 'Button';
      outer.append(document.createElement('span'), inner); cell.append(outer); document.body.prepend(cell); })()`);
    assert.deepEqual(await page.evaluate(nestedInteractiveScript), ['panel:button>button', 'link:a>input', 'focus:div[role=tab]>span']);
  } finally { await browser.close(); }
});

test('rewriteWorkPaths: whole path occurrences only — absolute and relative spellings, list commas, never a bare substring', () => {
  const abs = '/private/tmp/work/out';
  const rel = '../../../../private/tmp/work/out';
  const text = [
    `- contract: ${rel}/a.contract.proposed.json`,
    `npx ds-contracts generate ${rel}/a.json --tokens tokens/x.json,${rel}/minted.dtcg.json --out ${abs}/generated`,
    'layout: out/ stays, "without/" stays, checkout/x stays',
    `quoted "${abs}/b.json" and (${abs}/c.json)`,
  ].join('\n');
  assert.equal(
    rewriteWorkPaths(text, abs, rel),
    [
      '- contract: ./a.contract.proposed.json',
      'npx ds-contracts generate ./a.json --tokens tokens/x.json,./minted.dtcg.json --out ./generated',
      'layout: out/ stays, "without/" stays, checkout/x stays',
      'quoted "./b.json" and (./c.json)',
    ].join('\n'),
  );
  // A relative spelling that is a bare word is only replaced at a path boundary.
  assert.equal(rewriteWorkPaths('out/x layout/y "out/z"', '/abs/out', 'out'), './x layout/y "./z"');
});


test('variant observation catches descendant paint, arrangement and text without counting a class-name-only change', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><style>
      .root { width: 120px; height: 40px; display: flex; color: black; background: white; font: 16px monospace }
      .root span { width: 30px; height: 20px }
      .tone span { color: red }
      .reorder { flex-direction: row-reverse }
    </style><div class="root"><span>AA</span><span>BB</span></div>`);
    const root = page.locator('.root');
    const baseline = await root.evaluate(variantPaintOf);
    const before = await root.screenshot();
    const box = await root.boundingBox();
    await root.evaluate(el => el.classList.add('unreferenced-class'));
    assert.equal(await root.evaluate(variantPaintOf), baseline, 'a different class is not an observed visual effect');
    for (const cls of ['tone', 'reorder']) {
      await root.evaluate((el, name) => el.classList.add(name), cls);
      assert.deepEqual(await root.boundingBox(), box, 'root bounds did not explain the change');
      assert.notEqual(await root.evaluate(variantPaintOf), baseline, cls + ' changes descendant paint or relative placement');
      assert.notDeepEqual(await root.screenshot(), before, cls + ' actually changes browser pixels');
      await root.evaluate((el, name) => el.classList.remove(name), cls);
      assert.equal(await root.evaluate(variantPaintOf), baseline, 'restoring the variant restores the observation');
    }
    await root.locator('span').first().evaluate(el => { el.textContent = 'CC'; });
    assert.deepEqual(await root.boundingBox(), box);
    assert.notEqual(await root.evaluate(variantPaintOf), baseline, 'equal-width replacement text is still a rendered difference');
    assert.notDeepEqual(await root.screenshot(), before);
  } finally { await browser.close(); }
});


test('node capture preserves transparent margins and actual geometry while restoring the review page background', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<style>body{background:#fff}#sample{padding:10px;width:40px;height:20px}#ink{width:40px;height:20px;background:#f1f0ea}</style><div id="sample"><div id="ink"></div></div>');
    const root = page.locator('#sample');
    const shot = PNG.sync.read(await root.screenshot(NODE_SCREENSHOT_OPTIONS));
    assert.equal(shot.data[3], 0, 'the opaque review page is not part of the node export');
    assert.deepEqual(contentBox(shot), { x: 10, y: 10, width: 40, height: 20 });
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)', 'screenshot-only style is restored');
    await page.locator('#ink').evaluate(el => (el as HTMLElement).style.width = '44px');
    const changed = PNG.sync.read(await root.screenshot(NODE_SCREENSHOT_OPTIONS));
    assert.equal(contentBox(changed).width, 44, 'a real geometry error remains measurable; capture does not normalize it');
  } finally { await browser.close(); }
});


test('a second background exposes missing pale ink while the original white comparison stays unchanged', () => {
  const source = new PNG({ width: 20, height: 20 });
  const missing = new PNG({ width: 20, height: 20 });
  for (const png of [source, missing]) {
    for (const [x, y] of [[0, 0], [19, 19]]) { const i = (y * 20 + x) * 4; png.data[i + 3] = 255; }
  }
  for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) {
    const i = (y * 20 + x) * 4; source.data[i] = 241; source.data[i + 1] = 240; source.data[i + 2] = 234; source.data[i + 3] = 255;
  }
  const white = alignPair(missing, source);
  const explicitWhite = alignPair(missing, source, 255);
  assert.deepEqual(white.a.data, explicitWhite.a.data, 'default consumer pixels remain the explicit white compositor');
  assert.deepEqual(white.b.data, explicitWhite.b.data, 'default source pixels remain the explicit white compositor');
  assert.ok(diffPair(white, []).unmaskedPct <= 5, 'the planted pale block is missed on white');
  assert.ok(diffPair(alignPair(missing, source, 0), []).unmaskedPct > 5, 'the same unchanged pixel metric sees the missing block on black');
  assert.equal(diffPair(alignPair(source, source, 0), []).unmaskedPct, 0);
  assert.equal(diffPair(alignPair(source, source), []).unmaskedPct, 0);
});
