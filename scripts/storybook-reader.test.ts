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
