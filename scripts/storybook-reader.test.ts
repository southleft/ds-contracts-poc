import assert from 'node:assert/strict';
import test from 'node:test';
import {readStories, type LoadedStory} from './storybook-reader.js';

const story = (id: string, title: string, argTypes: LoadedStory['argTypes'], args: Record<string, unknown> = {}, ownRender = false): LoadedStory => ({id, title, name: id, argTypes, args, ownRender, renderFailed: false});

test('stories group by title; the first story is classified; every story is held against the matrix rule, one reference per variant', () => {
  const components = readStories([
    story('badge--success', 'Content/Badge', {tone: {control: 'text', type: {name: 'string'}}, label: {control: 'text'}}, {tone: 'success', label: 'Done'}),
    story('badge--error', 'Content/Badge', {tone: {control: 'text', type: {name: 'string'}}, label: {control: 'text'}}, {tone: 'error', label: 'Done'}),
    story('button--basic', 'Forms/Button', {size: {control: 'select', options: ['sm', 'md']}, block: {type: {name: 'boolean'}}, onClick: {type: {name: 'function'}}}),
    story('box--basic', 'Foundations/Box', {background: {control: 'color'}, children: {control: 'object'}}),
    story('box--grid', 'Foundations/Box', {}, {}, true),
  ]);
  assert.deepEqual(components.map(c => c.title), ['Content/Badge', 'Forms/Button', 'Foundations/Box']);
  const [badge, button, box] = components;
  assert.deepEqual([badge!.stories, badge!.storyId, badge!.grammar.grammar], [2, 'badge--success', 'in']);
  assert.deepEqual(badge!.matrix, {status: 'ok', axes: ['tone'], variants: 2});
  assert.deepEqual(button!.matrix, {status: 'ok', axes: ['size'], variants: 2});
  // One reference to render per expected variant, in the matrix's order; the browser pass fills in image and faces.
  assert.deepEqual(badge!.references, [{storyId: 'badge--success', args: {}, variant: {tone: 'success'}}, {storyId: 'badge--error', args: {}, variant: {tone: 'error'}}]);
  assert.deepEqual(button!.references, [{storyId: 'button--basic', args: {size: 'sm'}, variant: {size: 'sm'}}, {storyId: 'button--basic', args: {size: 'md'}, variant: {size: 'md'}}]);
  assert.deepEqual(box!.grammar, {grammar: 'out', reasons: ['arg-color', 'arg-object']});
  assert.deepEqual(box!.ownRender, ['box--grid']);
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
