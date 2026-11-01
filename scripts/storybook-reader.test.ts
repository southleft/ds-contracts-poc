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
  assert.deepEqual(badge!.references, [{storyId: 'badge--success', args: {}}, {storyId: 'badge--error', args: {}}]);
  assert.deepEqual(button!.references, [{storyId: 'button--basic', args: {size: 'sm'}}, {storyId: 'button--basic', args: {size: 'md'}}]);
  assert.deepEqual(box!.grammar, {grammar: 'out', reasons: ['arg-color', 'arg-object']});
  assert.deepEqual(box!.ownRender, ['box--grid']);
});

import {storyFontPreflight} from './font-preflight.js';
test('React to Figma font preflight: each face a variant is drawn with is held against Figma\'s font list, by name', () => {
  const sans = (weight: number, style: 'normal' | 'italic' = 'normal') => ({family: 'Liberation Sans', weight, style});
  const components = [
    {title: 'Content/Badge', references: [{faces: [sans(400)]}, {faces: [sans(400), sans(700)]}]},
    {title: 'Content/Prose', references: [{faces: [sans(400, 'italic')]}, {}]},
  ];
  const {required, missing} = storyFontPreflight(components, [{family: 'Liberation Sans', style: 'Regular'}, {family: 'Liberation Sans', style: 'Italic'}]);
  assert.deepEqual(required.map(f => [f.weight, f.style, f.variants]), [[400, 'italic', ['Content/Prose / 0']], [400, 'normal', ['Content/Badge / 0', 'Content/Badge / 1']], [700, 'normal', ['Content/Badge / 1']]]);
  assert.deepEqual(missing.map(f => `${f.family} ${f.weight} ${f.style}: ${f.variants.join(', ')}`), ['Liberation Sans 700 normal: Content/Badge / 1']);
  assert.equal(storyFontPreflight(components, [{family: 'Liberation Sans', style: 'Bold'}, {family: 'liberation sans', style: 'Regular'}, {family: 'Liberation Sans', style: 'Italic'}]).missing.length, 0);
});


import {REACT_TESTED} from './storybook-reader.js';
test('the reader runs only on React lines it has been tested on, prereleases of those lines included', () => {
  for (const v of ['18.3.1', '18.3.0-canary-178c267a4e-20241218', '19.2.7', '19.3.1']) assert.ok(REACT_TESTED.test(v), v);
  for (const v of ['18.2.0', '17.0.2', '20.0.0', '19']) assert.ok(!REACT_TESTED.test(v), v);
});
