import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { chromium } from 'playwright-core';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { validateContract } from '../packages/core/src/validate.js';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { emitHtml } from './emit-html.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { emitWebComponent } from '../packages/emitter-web-components/src/emit-wc.js';
import { generatedTypeErrors, mountGenerated } from './react-test-runtime.js';

const anchors = { code: { anchors: { importPath: './probe', export: 'Probe' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } };
const child = ContractSchema.parse({ id: 'probe.entry', name: 'Entry', version: '1.0.0', status: 'draft', archetype: 'none',
  description: 'An independently stateful child for collection identity checks.', semantics: { element: 'button' },
  props: [
    { name: 'text', type: 'text', default: 'Item', bindings: { code: { prop: 'children' }, figma: { kind: 'TEXT', property: 'Text' } } },
    { name: 'expanded', type: { enum: ['closed', 'open'] }, default: 'closed', bindings: { code: { prop: 'expanded' },
      figma: { kind: 'VARIANT', property: 'Expanded', values: { closed: 'Closed', open: 'Open' } } } },
  ], states: [], anatomy: { root: { parts: { label: { content: { prop: 'children' } } } } },
  events: [{ name: 'toggle', trigger: 'root', toggles: { prop: 'expanded', between: ['closed', 'open'], aria: 'expanded' },
    bindings: { code: { prop: 'onToggle' } } }], bindings: anchors });
function fixture(keyed = true): Contract {
  return ContractSchema.parse({ id: 'probe.collection', name: 'Collection', version: '1.0.0', status: 'draft', archetype: 'none',
    description: 'A declared repeated collection; names carry no behavior.', semantics: { element: 'div' },
    props: [{ name: 'items', type: { arrayOf: { ...(keyed ? { identity: 'text' } : {}), text: 'text' } },
      bindings: { code: { prop: 'entries' }, figma: { kind: 'NONE' } } }], states: [],
    anatomy: { root: { parts: { entry: { component: { id: child.id },
      repeat: { itemsProp: 'items', ...(keyed ? { keyField: 'identity' } : {}), sample: [
        { ...(keyed ? { identity: 'one' } : {}), text: 'First' },
        { ...(keyed ? { identity: 'two' } : {}), text: 'Second' },
      ] } } } } }, bindings: anchors });
}
const tokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const icons = new Map<string, string>();
const context = (parent: Contract) => ({ contracts: new Map([[child.id, child], [parent.id, parent]]), icons, tokens: new Set<string>() });
const errors = (parent: Contract) => {
  const errors: string[] = []; validateContract(parent, context(parent).contracts, errors, icons); return errors;
};
function server(parent: Contract) {
  const ctx = context(parent), modules = new Map<string, any>(), require = createRequire(import.meta.url);
  const load = (c: Contract): any => {
    if (modules.has(c.name)) return modules.get(c.name);
    const output = { exports: {} };
    const js = ts.transpileModule(emitReact(c, ctx).tsx, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    vm.runInNewContext(js, { exports: output.exports, require: (name: string) => {
      if (name === 'react' || name === 'react/jsx-runtime') return require(name);
      if (name.endsWith('.module.css')) return {};
      if (name === '../Entry') return load(child);
      throw Error('Unexpected generated import ' + name);
    } });
    modules.set(c.name, output.exports); return output.exports;
  };
  return load(parent).Collection as React.ComponentType<any>;
}

test('declared identities retain actual generated child state and DOM focus when items move', async t => {
  const parent = fixture(), ctx = context(parent), output = emitReact(parent, ctx), dependency = emitReact(child, ctx);
  assert.deepEqual(errors(parent), []);
  assert.deepEqual(generatedTypeErrors(parent.name, output.tsx + `
    const valid = <Collection entries={[{identity:'a',text:'A'}]}/>;
    // @ts-expect-error identity is a required string field in each supplied record
    const missing = <Collection entries={[{text:'A'}]}/>;
  `, { Entry: dependency.tsx }), []);
  const browser = await chromium.launch(); t.after(() => browser.close());
  const page = await browser.newPage(); page.setDefaultTimeout(3000);
  await mountGenerated(page, parent.name, output.tsx, output.css, { Entry: dependency });
  await page.evaluate(`window.renderSubject({entries:[{identity:'one',text:'First'},{identity:'two',text:'Second'}]});`);
  await page.getByRole('button', { name: 'First', exact: true }).click();
  await page.evaluate(`window.retainedButton=document.activeElement;`);
  await page.evaluate(`window.renderSubject({entries:[{identity:'two',text:'Second'},{identity:'one',text:'Renamed'},{identity:'three',text:'Third'}]});`);
  assert.equal(await page.getByRole('button', { name: 'Renamed', exact: true }).getAttribute('aria-expanded'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Second', exact: true }).getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate('window.retainedButton===document.activeElement && window.retainedButton.textContent==="Renamed"'), true);
  assert.equal(await page.locator('[identity]').count(), 0);
  await page.evaluate(`window.renderSubject({entries:[{identity:'two',text:'Second'}]});`);
  await page.evaluate(`window.renderSubject({entries:[{identity:'one',text:'Reinserted'},{identity:'two',text:'Second'}]});`);
  assert.equal(await page.getByRole('button', { name: 'Reinserted', exact: true }).getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate('window.retainedButton.isConnected'), false);
  await page.evaluate('window.renderSubject({entries:[]});');
  assert.equal(await page.getByRole('button').count(), 0);
  await page.evaluate('window.renderSubject({});');
  assert.equal(await page.getByRole('button').count(), 0);
});

test('invalid declared and supplied identities refuse before reconciliation', () => {
  for (const key of [undefined, '', 0, false]) {
    const parent = fixture();
    if (key === undefined) delete parent.anatomy.root.parts!.entry.repeat!.sample[0].identity;
    else parent.anatomy.root.parts!.entry.repeat!.sample[0].identity = key;
    assert.match(errors(parent).join('\n'), /repeat-key-invalid/);
  }
  const duplicate = fixture(); duplicate.anatomy.root.parts!.entry.repeat!.sample[1].identity = 'one';
  assert.match(errors(duplicate).join('\n'), /repeat-key-duplicate/);
  for (const keyField of ['missing', 'expanded']) {
    const parent = fixture(); parent.anatomy.root.parts!.entry.repeat!.keyField = keyField;
    assert.match(errors(parent).join('\n'), /repeat-key-field-invalid/);
  }
  const Component = server(fixture());
  for (const entries of [[{text:'Missing'}], [{identity:'',text:'Empty'}], [{identity:0,text:'Number'}],
    [{identity:'a',text:'A'},{identity:'a',text:'B'}], [Object.assign(Object.create({identity:'inherited'}),{text:'Inherited'})], null, {}]) {
    assert.throws(() => renderToString(React.createElement(Component, {entries})), /repeat-(key-invalid|key-duplicate|items-invalid)/);
  }
  const html = renderToString(React.createElement(Component, {entries:[{identity:'a',text:'Same'},{identity:'b',text:'Same'}]}));
  assert.equal((html.match(/<button/g) ?? []).length, 2);
  assert.doesNotMatch(html, /identity=/);
});

test('key metadata is excluded from child inputs across static and native projections', () => {
  const plain = fixture(false), keyed = fixture(true);
  const staticHtml = (p: Contract) => emitHtml(p, context(p));
  assert.deepEqual(staticHtml(keyed), staticHtml(plain));
  const inline = (p: Contract) => emitReactInline(p, {...context(p), tokens});
  // The public record type includes identity; its sample JSX is unchanged.
  assert.equal(inline(keyed).tsx.split('return (')[1], inline(plain).tsx.split('return (')[1]);
  assert.deepEqual(generatedTypeErrors(keyed.name, inline(keyed).tsx, {Entry: inline(child).tsx}), []);
  const engine = createFigmaEngine({tokens, icons});
  const original = engine.compileComponentData(plain, context(plain).contracts);
  const identified = engine.compileComponentData(keyed, context(keyed).contracts);
  assert.deepEqual(identified.variants, original.variants);
  assert.ok(identified.codeOnlyFacts?.some(f => f.channel === 'repeat.keyField' && f.value === 'identity'));
  const wc = emitWebComponent(keyed, context(keyed));
  assert.doesNotMatch(wc.element, /__rec\["identity"\]/);
  // A non-identity extra field still refuses, so this is not a blanket escape.
  (keyed.props[0].type as {arrayOf:Record<string,string>}).arrayOf.unknown = 'text';
  assert.match(errors(keyed).join('\n'), /repeat field "unknown" names no/);
});

test('old repeats retain positional generation and do not infer identities from labels', () => {
  const parent = fixture(false), output = emitReact(parent, context(parent));
  assert.match(output.tsx, /key=\{index\}/);
  assert.doesNotMatch(output.tsx, /__dscRepeatItems/);
});
