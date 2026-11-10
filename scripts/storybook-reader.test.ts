import assert from 'node:assert/strict';
import test from 'node:test';
import {readStories, type LoadedStory} from './storybook-reader.js';

const story = (id: string, title: string, argTypes: LoadedStory['argTypes'], args: Record<string, unknown> = {}, ownRender = false): LoadedStory => ({id, title, name: id, argTypes, args, ownRender, renderFailed: false});

test('stories group by title; the first story\'s arguments are classified against every story\'s values; every story is held against the matrix rule, one reference per variant', () => {
  const components = readStories([
    story('badge--success', 'Content/Badge', {tone: {control: 'text', type: {name: 'string'}}, label: {control: 'text'}}, {tone: 'success', label: 'Done'}),
    story('badge--error', 'Content/Badge', {tone: {control: 'text', type: {name: 'string'}}, label: {control: 'text'}}, {tone: 'error', label: 'Done'}),
    story('button--basic', 'Forms/Button', {size: {control: 'select', options: ['sm', 'md']}, block: {type: {name: 'boolean'}}, onClick: {type: {name: 'function'}}}),
    story('box--basic', 'Foundations/Box', {background: {control: 'color'}, children: {control: 'object'}}),
    story('box--grid', 'Foundations/Box', {}, {children: {type: 'grid'}}, true),
  ]);
  assert.deepEqual(components.map(c => c.title), ['Content/Badge', 'Forms/Button', 'Foundations/Box']);
  const [badge, button, box] = components;
  assert.deepEqual([badge!.stories, badge!.storyId, badge!.grammar.grammar], [2, 'badge--success', 'in']);
  assert.deepEqual(badge!.matrix, {status: 'ok', axes: ['tone'], variants: 2});
  assert.deepEqual(button!.matrix, {status: 'ok', axes: ['size'], variants: 2});
  // One reference to render per expected variant, in the matrix's order; the browser pass fills in image and faces.
  assert.deepEqual(badge!.references, [{storyId: 'badge--success', args: {}, variant: {tone: 'success'}}, {storyId: 'badge--error', args: {}, variant: {tone: 'error'}}]);
  assert.deepEqual(button!.references, [{storyId: 'button--basic', args: {size: 'sm'}, variant: {size: 'sm'}}, {storyId: 'button--basic', args: {size: 'md'}, variant: {size: 'md'}}]);
  // Grammar decision 1: no story sets `background`, so it refuses nothing; one story sets `children`, so it still refuses.
  assert.deepEqual(box!.grammar, {grammar: 'out', reasons: ['arg-object']});
  assert.deepEqual(box!.ownRender, ['box--grid']);
});

test('grammar decision 4: a profile assigns stories to components and names their axes; it may only select stories that exist, once each', () => {
  const sizes = {size: {control: 'select', options: ['sm', 'md']}};
  const tags = [story('tag--read-only', 'Components/Tag', {...sizes, type: {control: 'select', options: ['red', 'blue']}}),
    story('tag--selectable', 'Components/Tag', sizes), story('tag--snapshot', 'Components/Tag', sizes)];
  const tag = {name: 'Tag', stories: ['tag--read-only'], axes: ['size', 'type'], leftOut: [{story: 'tag--snapshot', reason: 'test'}]};
  const components = readStories(tags, [tag, {name: 'SelectableTag', stories: ['tag--selectable'], axes: ['size']}]);
  // The profile owns the title: every story is assigned, or left out with a fixed reason that is reported.
  assert.deepEqual(components.map(c => [c.title, c.stories, c.matrix, c.leftOut]), [
    ['SelectableTag', 1, {status: 'ok', axes: ['size'], variants: 2}, undefined],
    ['Tag', 1, {status: 'ok', axes: ['size', 'type'], variants: 4}, [{story: 'tag--snapshot', reason: 'test'}]],
  ]);
  const selectable = {name: 'SelectableTag', stories: ['tag--selectable'], axes: ['size']};
  assert.throws(() => readStories(tags, [{...tag, leftOut: []}, selectable]), /profile-story-unaccounted:tag--snapshot/);
  assert.throws(() => readStories(tags, [{...tag, leftOut: [{story: 'tag--snapshot', reason: 'hard'}]}, selectable]), /profile-left-out-reason:hard:tag--snapshot/);
  assert.throws(() => readStories(tags, [{...tag, leftOut: [{story: 'tag--snapshot', reason: 'other-component'}]}, selectable]), /profile-left-out-reason:other-component/);
  assert.throws(() => readStories(tags, [{name: 'Tag', stories: ['tag--missing'], axes: []}]), /profile-story-unknown:tag--missing/);
  assert.throws(() => readStories(tags, [{name: 'A', stories: ['tag--snapshot'], axes: []}, {name: 'B', stories: ['tag--snapshot'], axes: []}]), /profile-story-twice:tag--snapshot/);
});

test('a profile may exclude a whole title only for a fixed reason; it stays visible, with what it would have been', () => {
  const list = [story('box--default', 'Foundations/Box', {}), story('flag--on', 'Components/Tag/Feature Flag', {size: {control: 'select', options: ['sm', 'md']}})];
  const [flag, box] = readStories(list, [], [{title: 'Components/Tag/Feature Flag', reason: 'feature-flag-copy'}]);
  assert.equal(box!.excludedBy, undefined);
  assert.deepEqual([flag!.title, flag!.excludedBy, flag!.matrix], ['Components/Tag/Feature Flag', 'feature-flag-copy', {status: 'ok', axes: ['size'], variants: 2}]);
  assert.throws(() => readStories(list, [], [{title: 'Components/Tag/Feature Flag', reason: 'too-hard'}]), /profile-excluded-reason:too-hard/);
  assert.throws(() => readStories(list, [], [{title: 'Components/Nope', reason: 'deprecated'}]), /profile-title-unknown:Components\/Nope/);
  assert.throws(() => readStories(list, [{name: 'Flag', stories: ['flag--on'], axes: []}], [{title: 'Components/Tag/Feature Flag', reason: 'preview'}]), /profile-title-excluded-and-declared/);
});

import {readProfile, SystemProfile} from './storybook-reader.js';
test('Carbon profile v0.1 holds to its schema; every story is used once; a feature-flag copy names a counted title; a utility names its receipt', () => {
  const p = readProfile(new URL('../examples/carbon/profile.json', import.meta.url).pathname);
  const used = [...p.components.flatMap(c => c.stories), ...p.components.flatMap(c => (c.leftOut ?? []).map(l => l.story))];
  assert.equal(new Set(used).size, used.length);
  const excluded = new Set(p.excluded.map(e => e.title));
  for (const e of p.excluded) {
    if (e.reason === 'feature-flag-copy') assert.ok(e.copies && !excluded.has(e.copies), e.title);
    if (e.reason === 'non-visual-utility') assert.ok(e.receipt, e.title);
  }
  for (const l of p.components.flatMap(c => c.leftOut ?? [])) if (l.reason === 'left-out-variant') assert.ok(l.adds, l.story);
  assert.ok(p.tuning.code.every(n => p.components.some(c => c.name === n)));
  // A mark is `true` or absent; a misspelled key on a component is refused, never dropped.
  for (const bad of [{subcomponent: false}, {skeleton: false}, {subcomponents: true}]) assert.throws(() => SystemProfile.parse({...p, components: [{...p.components[0], ...bad}]}));
  assert.equal(new Set(p.figmaSkeleton!.sets).size, p.figmaSkeleton!.sets!.length);
});

import {storyFontPreflight} from './font-preflight.js';
test('React to Figma font preflight: each face a variant is drawn with is held against Figma\'s font list, by name', () => {
  const sans = (weight: number, style: 'normal' | 'italic' = 'normal') => ({family: 'Arimo', weight, style});
  const components = [
    {title: 'Content/Badge', references: [{faces: [sans(400)]}, {faces: [sans(400), sans(700)]}]},
    {title: 'Content/Prose', references: [{faces: [sans(400, 'italic')]}, {}]},
  ];
  const {required, missing} = storyFontPreflight(components, [{family: 'Arimo', style: 'Regular'}, {family: 'Arimo', style: 'Italic'}]);
  assert.deepEqual(required.map(f => [f.weight, f.style, f.variants]), [[400, 'italic', ['Content/Prose / 0']], [400, 'normal', ['Content/Badge / 0', 'Content/Badge / 1']], [700, 'normal', ['Content/Badge / 1']]]);
  assert.deepEqual(missing.map(f => `${f.family} ${f.weight} ${f.style}: ${f.variants.join(', ')}`), ['Arimo 700 normal: Content/Badge / 1']);
  assert.equal(storyFontPreflight(components, [{family: 'Arimo', style: 'Bold'}, {family: 'arimo', style: 'Regular'}, {family: 'Arimo', style: 'Italic'}]).missing.length, 0);
});


import {REACT_TESTED} from './storybook-reader.js';
test('the reader runs only on React lines it has been tested on, prereleases of those lines included', () => {
  for (const v of ['18.3.1', '18.3.0-canary-178c267a4e-20241218', '19.2.7', '19.3.1']) assert.ok(REACT_TESTED.test(v), v);
  for (const v of ['18.2.0', '17.0.2', '20.0.0', '19']) assert.ok(!REACT_TESTED.test(v), v);
});

import {chromium} from 'playwright-core';
import {domContentOf} from './design-consumer-content.js';
import {INSTANCE_CONTAINER} from './storybook-reader.js';
test('a reference\'s content is read inside the instance\'s own container, never beside it', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<div id="theme"><div id="one"><button style="color:#123456">Save</button></div></div>
      <div id="two"><span>Left</span><span>Right</span></div><div id="beside"><span>Instance</span><em>Caption</em></div>`);
    const pick = (ids: string[]) => page.evaluate(`(${INSTANCE_CONTAINER})([${ids.map(id => `document.querySelector(${JSON.stringify(id)})`).join(',')}])?.id ?? null`);
    assert.equal(await pick(['#one > button']), 'one');
    assert.equal(await pick(['#two > span:first-child', '#two > span:last-child']), 'two');
    // A sibling the instance did not render, or top elements under different parents: no container.
    assert.equal(await pick(['#beside > span']), null);
    assert.equal(await pick(['#one > button', '#two > span']), null);
    const content = await page.locator('#one').evaluate(domContentOf);
    assert.equal(content.text, 'Save');
    assert.deepEqual(content.runs!.map(r => [r.text, r.color]), [['Save', 'rgb(18, 52, 86)']]);
  } finally { await browser.close(); }
});

import {PNG} from 'pngjs';
import {captureSubjectWithoutBackdrop} from './design-consumer-observed-capture.js';
import {MARK_SUBJECT} from './storybook-reader.js';
test('a reference is the instance alone: page and decorator backgrounds cleared then restored, its painted extent kept', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport: {width: 400, height: 300}});
    await page.setContent(`<style>html, body {background: #fff; margin: 0}</style><div id="theme" style="background: #fff; padding: 16px">
      <button id="b" style="all: unset; display: inline-block; width: 40px; height: 20px; background: #123456; box-shadow: 4px 4px 0 #000"></button></div>`);
    await page.evaluate(`window.__dsReaderTops = [document.getElementById('b')]`);
    assert.equal(await page.evaluate(MARK_SUBJECT), true);
    const captured = await captureSubjectWithoutBackdrop(page, '[data-ds-reader-subject]', '[data-ds-reader-cell]');
    assert.ok(!('refused' in captured), JSON.stringify(captured));
    const png = PNG.sync.read(captured.bytes), alpha = (x: number, y: number) => png.data[(y * png.width + x) * 4 + 3];
    // The shadow past the 40 x 20 box is kept; beside it, where the decorator painted white, is transparent.
    assert.deepEqual([png.width, png.height, alpha(42, 10), alpha(42, 1), alpha(1, 22)], [44, 24, 255, 0, 0]);
    for (const id of ['theme']) assert.equal(await page.evaluate(`getComputedStyle(document.getElementById('${id}')).backgroundColor`), 'rgb(255, 255, 255)');
    assert.equal(await page.evaluate(`getComputedStyle(document.body).backgroundColor`), 'rgb(255, 255, 255)');
    // Focus guards (empty boxes) beside it are left aside; two painting top elements have no single subject.
    await page.evaluate(`(() => { for (const at of ['beforebegin', 'afterend']) document.getElementById('b').insertAdjacentHTML(at, '<div data-focus-guard style="position: fixed; width: 1px; height: 0"></div>');
      window.__dsReaderTops = [...document.querySelectorAll('[data-focus-guard], #b')]; })()`);
    assert.equal(await page.evaluate(MARK_SUBJECT), true);
    assert.equal(await page.locator('#b[data-ds-reader-subject]').count(), 1);
    await page.evaluate(`window.__dsReaderTops = [document.getElementById('b'), document.getElementById('theme')]`);
    assert.equal(await page.evaluate(MARK_SUBJECT), false);
    assert.equal(await page.locator('[data-ds-reader-subject], [data-ds-reader-cell]').count(), 0);
  } finally { await browser.close(); }
});

import {paintRuns} from './storybook-reader.js';
test('each content run keeps the families Chromium painted it with; the marks are removed, and the Figma to React collector marks nothing', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<div id="c"><p style="font-family: monospace">Ab<span style="font-family: serif">cd</span></p></div>`);
    assert.deepEqual((await page.locator('#c').evaluate(domContentOf)).runs!.map(r => r.painted), [undefined, undefined]);
    assert.equal(await page.locator('[data-ds-run]').count(), 0);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const content = await page.locator('#c').evaluate(domContentOf, true);
    assert.deepEqual(await page.locator('[data-ds-run]').evaluateAll(es => es.map(e => e.getAttribute('data-ds-run'))), ['0', '1']);
    await paintRuns(cdp, content);
    assert.equal(await page.locator('[data-ds-run]').count(), 0);
    // A monospace and a serif run: one family each, and not the same one.
    const [mono, serif] = content.runs!.map(r => r.painted!);
    assert.deepEqual([mono!.length, serif!.length, mono![0] === serif![0]], [1, 1, false]);
    // Form fields draw their text in a user-agent shadow root; generated content is its own node; a checkbox never
    // draws its value, so it reads as painted with no font.
    await page.setContent(`<style>.b::before{content:"Before"}</style><div id="f"><input value="Value" disabled><textarea>Area</textarea><input placeholder="Hint"><input type="checkbox"><span class="b"></span></div>`);
    const fields = await page.locator('#f').evaluate(domContentOf, true);
    await paintRuns(cdp, fields);
    assert.deepEqual(fields.runs!.map(r => [r.text, r.painted!.length]), [['Value', 1], ['Area', 1], ['Hint', 1], ['on', 0], ['Before', 1]]);
  } finally { await browser.close(); }
});

import {LAYOUT_FLAGS} from './storybook-reader.js';
test('grammar decision 2, code side: grid, wrapping rows and a drawn part placed outside a row or column are flagged; a pinned, hidden or empty part is not', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>.box{width:20px;height:20px;background:#123}</style>
      <label id="in" style="display:flex;position:relative"><span class="box" style="position:absolute;inset:0"></span>
        <input style="position:absolute;opacity:0;width:20px;height:20px"><span class="sr" style="position:absolute;width:1px;height:1px;clip:rect(0 0 0 0)">x</span>
        <span id="pin" style="position:relative;display:block;width:20px;height:20px"></span>
        <span style="position:relative"><span class="empty" style="position:absolute;display:block;width:30px;height:30px"></span></span></label>
      <div id="out"><div class="grid" style="display:grid"><span>a</span></div><div class="wrap" style="display:flex;flex-wrap:wrap"><span>b</span></div>
        <span class="inline" style="position:relative"><b class="box" style="position:absolute;display:block"></b></span><i class="loose box" style="position:fixed;display:block"></i></div>`);
    const flags = (id: string) => page.evaluate(`${LAYOUT_FLAGS}([document.getElementById(${JSON.stringify(id)})])`);
    assert.deepEqual(await flags('in'), []);
    assert.deepEqual(await flags('out'), [['grid-layout', 'div.grid'], ['layout-wrap', 'div.wrap'], ['absolute-child', 'b.box'], ['absolute-child', 'i.loose.box']]);
  } finally { await browser.close(); }
});

import {HIDE_CONTEXT, SELECT_INSTANCE} from './storybook-reader.js';
test('grammar decision 5: one instance of several is the subject; other instances and story context are hidden, then restored', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<div id="row" style="display:flex;gap:8px"><button id="trigger" style="visibility:visible">Open</button>
      <span class="tag" id="a" style="width:40px;height:20px;display:block">Red</span><span class="tag" id="b" style="width:50px;height:20px;display:block">Blue</span></div>`);
    await page.evaluate(`window.__dsReaderInstances = [{tops: [document.getElementById('a')]}, {tops: [document.getElementById('b')]}]`);
    const box = await page.evaluate(`${SELECT_INSTANCE}(1)`) as {width: number};
    assert.ok(box.width >= 50 && box.width <= 51, String(box.width)); // outward to whole pixels, as the reader frames every box
    assert.equal(await page.evaluate(`${SELECT_INSTANCE}(2)`), null);
    await page.evaluate(`${SELECT_INSTANCE}(1)`);
    await page.evaluate(`${HIDE_CONTEXT}(true)`);
    const vis = (id: string) => page.evaluate(`getComputedStyle(document.getElementById(${JSON.stringify(id)})).visibility`);
    assert.deepEqual([await vis('a'), await vis('trigger'), await vis('b'), await vis('row')], ['hidden', 'hidden', 'visible', 'visible']);
    await page.evaluate(`${HIDE_CONTEXT}(false)`);
    assert.deepEqual([await vis('a'), await vis('trigger'), await page.evaluate(`document.getElementById('trigger').style.visibility`)], ['visible', 'visible', 'visible']);
  } finally { await browser.close(); }
});
