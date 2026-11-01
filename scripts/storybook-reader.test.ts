import assert from 'node:assert/strict';
import test from 'node:test';
import {readStories, type LoadedStory} from './storybook-reader.js';

const story = (id: string, title: string, argTypes: LoadedStory['argTypes'], args: Record<string, unknown> = {}): LoadedStory => ({id, title, name: id, argTypes, args});

test('stories group by title; the first story is classified and its matrix computed; varying arguments are listed', () => {
  const components = readStories([
    story('badge--success', 'Content/Badge', {tone: {control: 'text', type: {name: 'string'}}, label: {control: 'text'}}, {tone: 'success', label: 'Done'}),
    story('badge--error', 'Content/Badge', {tone: {control: 'text', type: {name: 'string'}}, label: {control: 'text'}}, {tone: 'error', label: 'Done'}),
    story('button--basic', 'Forms/Button', {size: {control: 'select', options: ['sm', 'md']}, block: {type: {name: 'boolean'}}, onClick: {type: {name: 'function'}}}),
    story('box--basic', 'Foundations/Box', {background: {control: 'color'}, children: {control: 'object'}}),
  ]);
  assert.deepEqual(components.map(c => c.title), ['Content/Badge', 'Forms/Button', 'Foundations/Box']);
  const [badge, button, box] = components;
  assert.deepEqual([badge!.stories, badge!.storyId, badge!.grammar.grammar, badge!.variesAcrossStories], [2, 'badge--success', 'in', ['tone']]);
  assert.deepEqual(badge!.matrix, {status: 'ok', axes: [], variants: 1});
  assert.deepEqual(button!.matrix, {status: 'ok', axes: ['size'], variants: 2});
  assert.deepEqual(box!.grammar, {grammar: 'out', reasons: ['arg-color', 'arg-object']});
});
