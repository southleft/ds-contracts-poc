import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { generateCss } from '../packages/core/src/css.js';

function contract(anatomy: unknown) {
  const template = JSON.parse(readFileSync(new URL('../contracts/badge.contract.json', import.meta.url), 'utf8'));
  template.props = [];
  template.states = ['focus-visible'];
  template.semantics = { element: 'div' };
  template.anatomy = anatomy;
  return template;
}

function css(anatomy: unknown) {
  const errors: string[] = [];
  const out = generateCss(contract(anatomy), new Set(['shadow']), errors);
  assert.deepEqual(errors, []);
  return out;
}

test('a descendant focus shadow owns the indicator, so the root does not add a browser outline', () => {
  const out = css({
    root: {
      parts: {
        Box: { element: 'span', states: { 'focus-visible': { 'box-shadow': '{shadow}' } } },
      },
    },
  });
  assert.match(out, /\.root:focus-visible \{\s*outline-style: none;/);
  assert.doesNotMatch(out, /\.root:focus-visible \{\s*outline-style: solid;/);
});

test('a captured focus border keeps the outline flush with the box', () => {
  const out = css({
    root: {
      states: { 'focus-visible': { 'border-width': '{shadow}' } },
    },
  });
  assert.match(out, /\.root:focus-visible \{\s*outline-style: solid;\s*\}/);
  assert.doesNotMatch(out, /outline-offset: 2px;/);
});

test('a zero focus border turns off the generic outline for that variant', () => {
  const template = JSON.parse(readFileSync(new URL('../contracts/badge.contract.json', import.meta.url), 'utf8'));
  template.props = [{ name: 'variant', type: 'enum', values: ['link', 'ellipsis'], default: 'link', bindings: { figma: { kind: 'VARIANT', property: 'Variant' }, code: { prop: 'variant' } } }];
  template.states = ['focus-visible'];
  template.semantics = { element: 'button' };
  template.anatomy = { root: { statesByProp: [{ state: 'focus-visible', prop: 'variant', map: {
    link: { 'border-width': '{edge.link}' },
    ellipsis: { 'border-width': '{edge.ellipsis}' },
  } }] } };
  const errors: string[] = [];
  const tokens = { edge: { link: { $value: '1px' }, ellipsis: { $value: '0px' } } };
  const out = generateCss(template, new Set(['edge.link', 'edge.ellipsis']), errors, tokens);
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.match(out, /\.variant-ellipsis:focus-visible \{[^}]*border-width:[^}]*outline-style: none;/);
  assert.doesNotMatch(out, /\.variant-link:focus-visible \{[^}]*outline-style: none;/);
});

test('a content run centers its glyphs inside the stretched box', () => {
  const out = css({
    root: {
      layout: { display: 'flex', direction: 'row' },
      parts: { Label: { content: { prop: 'text' }, layout: { grow: true, align: 'center' } } },
    },
  });
  assert.match(out, /\.Label \{[^}]*display: flex;[^}]*align-items: center;/);
});

test('centered text stays centered when its glyphs are centered in the box', () => {
  const out = css({
    root: {
      layout: { display: 'flex', direction: 'row' },
      parts: { Label: { content: { prop: 'text' }, declared: { 'text-align': 'center' }, layout: { grow: true, align: 'center' } } },
    },
  });
  assert.match(out, /\.Label \{[^}]*display: flex;[^}]*align-items: center;[^}]*justify-content: center;/);
});

test('a color-only descendant focus state still gets the root outline', () => {
  const out = css({
    root: {
      parts: {
        Label: { element: 'span', states: { 'focus-visible': { color: '{shadow}' } } },
      },
    },
  });
  assert.match(out, /\.root:focus-visible \{\s*outline-style: solid;\s*outline-offset: 2px;/);
});
