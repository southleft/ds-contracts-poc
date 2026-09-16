import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContractSchema, type Part } from '../scripts/contract-schema.js';
import { enumerate, type CapturedNode } from '../extract/computed/lib.js';
import type { PropSpace, SweepResult } from '../extract/computed/capture.js';
import { alignSweep } from '../extract/computed/fuse.js';
import { promoteAnatomy } from '../extract/computed/anatomy.js';
import { preserveOrderedFlexText } from '../extract/computed/ordered-text.js';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { emitHtml } from './emit-html.js';
import { createFigmaEngine } from './emit-figma-script.js';

const text = (v: string): CapturedNode['nodes'][number] => ({ t: 'text', v });
const element = (el: CapturedNode): CapturedNode['nodes'][number] => ({ t: 'el', el });
const node = (nodes: CapturedNode['nodes'], style: Record<string, string> = {}): CapturedNode => ({
  tag: 'div', classes: [], pseudo: {}, nodes,
  style: { display: 'flex', 'white-space-collapse': 'collapse', ...style },
});
const marker = () => element(node([text('MARK')]));
const tokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };

function promote(root: CapturedNode) {
  const contract = ContractSchema.parse({
    id: 'ordered.content', name: 'OrderedContent', version: '0.1.0', status: 'draft',
    description: 'Synthetic interleaved content regression', props: [], states: [],
    semantics: { element: 'div' }, anatomy: { root: { layout: { display: 'flex', direction: 'row' } } },
    bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: './OrderedContent', export: 'OrderedContent' } } },
  });
  const enumeration = enumerate([], [], 1, {}), key = enumeration.combos[0].key;
  const space: PropSpace = { contract, axes: [], presence: new Map(), stateProps: [], enumeration, baseComboKey: key, baseAxisValues: {}, heldFixed: [] };
  const comp = { name: contract.name, importName: contract.name, contract: '', sampleText: '', axes: [] };
  const sweep = { captures: [{ combo: `${comp.name}:${key}`, interaction: 'default', root }] } as SweepResult;
  return promoteAnatomy(space, comp, alignSweep(sweep, comp, space, '').union, 'ordered-content');
}

const require = createRequire(import.meta.url);
function render(tsx: string): string {
  const module = { exports: {} as { OrderedContent: Parameters<typeof createElement>[0] } };
  vm.runInNewContext(transformSync(tsx, { loader: 'tsx', format: 'cjs', jsx: 'automatic' }).code, {
    module, exports: module.exports,
    require: (id: string) => id.endsWith('.css') ? {} : require(id),
  });
  return renderToStaticMarkup(createElement(module.exports.OrderedContent));
}

test('observed mixed content survives promotion, both React emitters, HTML and native compilation', () => {
  for (const [nodes, expected] of [
    [[marker(), text('AFTER')], ['MARK', 'AFTER']],
    [[text('BEFORE'), marker()], ['BEFORE', 'MARK']],
    [[text('BEFORE'), marker(), text('AFTER')], ['BEFORE', 'MARK', 'AFTER']],
    [[marker(), text('AF'), text('TER')], ['MARK', 'AFTER']],
    [[text('OUTER'), element(node([marker(), text('INNER')]))], ['OUTER', 'MARK', 'INNER']],
  ] as Array<[CapturedNode['nodes'], string[]]>) {
    const source = node(nodes), before = structuredClone(source);
    const result = promote(source);
    assert.deepEqual(result.refusals, []);
    assert.deepEqual(source, before, 'promotion does not modify captured evidence');
    const contract = ContractSchema.parse(result.contract), contracts = new Map([[contract.id, contract]]);
    const ctx = { contracts, icons: result.assets, tokens: new Set<string>() };
    for (const html of [render(emitReact(contract, ctx).tsx), render(emitReactInline(contract, { ...ctx, tokens }).tsx), emitHtml(contract, ctx).html]) {
      const actual = html.replace(/<p class="showcase__label">[^<]*<\/p>/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, '');
      assert.equal(actual, expected.join(''));
    }
    const compiled = createFigmaEngine({ tokens, icons: result.assets }).compileComponentData(contract, contracts);
    const strings = (spec: { characters?: string; children?: unknown[] }): string[] => [
      ...(spec.characters === undefined ? [] : [spec.characters]),
      ...(spec.children ?? []).flatMap(child => strings(child as typeof spec)),
    ];
    assert.deepEqual(strings(compiled.variants[0].spec), expected);
  }
});

test('anonymous text retains NBSP and single-run bindings without stealing existing part names', () => {
  const p: Part = { content: { prop: 'label' }, parts: { mark: { text: 'MARK' } } };
  const used = new Set(['root-text-1']);
  const result = preserveOrderedFlexText(p, [{ node: node([marker(), text('label')]), elementParts: ['mark'] }], 'root', used);
  assert.equal(result.changed, true);
  assert.deepEqual(p.parts?.['root-text-1-run'], { content: { prop: 'label' } });
  assert.equal(p.content, undefined);
  const literal: Part = { text: '\u00a0after\u00a0', parts: { mark: {} } };
  preserveOrderedFlexText(literal, [{ node: node([marker(), text(' \t\u00a0after\u00a0\n')]), elementParts: ['mark'] }], 'root', new Set());
  assert.equal(literal.parts?.['root-text-1'].text, '\u00a0after\u00a0');
});

test('unsupported flow, ambiguous bindings, missing joins and changing order refuse without mutation', () => {
  const base = { node: node([marker(), text('after')]), elementParts: ['mark'] };
  const cases: Array<{ part?: Part; observations: typeof base[]; problem: string }> = [
    { observations: [{ ...base, node: node([marker(), text('after')], { display: 'block' }) }], problem: 'flow-unqualified' },
    { observations: [{ ...base, node: node([marker(), text('after')], { 'white-space-collapse': 'preserve' }) }], problem: 'flow-unqualified' },
    { observations: [{ ...base, elementParts: [] }], problem: 'element-join-unqualified' },
    { observations: [{ node: node([text('after'), marker()]), elementParts: ['mark'] }, base], problem: 'sequence-varies' },
    { observations: [base, { ...base, node: node([marker(), text('changed')]) }], problem: 'sequence-varies' },
    { part: { content: { prop: 'label' }, parts: { mark: {} } }, observations: [{ node: node([text('before'), marker(), text('after')]), elementParts: ['mark'] }], problem: 'binding-spans-elements' },
    { part: { text: 'after', parts: { mark: {}, extra: {} } }, observations: [base], problem: 'element-join-unqualified' },
  ];
  for (const c of cases) {
    const part = c.part ?? { text: 'after', parts: { mark: {} } }, before = structuredClone(part);
    assert.deepEqual(preserveOrderedFlexText(part, c.observations, 'root', new Set()), { changed: false, problem: `ordered-text-${c.problem}: root` });
    assert.deepEqual(part, before);
  }
});
