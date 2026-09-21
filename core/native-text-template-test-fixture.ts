import assert from 'node:assert/strict';
import vm from 'node:vm';
import { nativeFixtureHost } from '../source-reference/native-operation-test-fixture.js';
import { emitNativeTemplateGraphScript, emitNativeTemplateGraphReadbackScript, verifyNativeTemplateGraphReceipt } from './native-root-text-template-graph-native.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { revisionOf } from './contract-provenance.js';
import { flattenTokens } from './tokens.js';
import type { NativeRootTextTemplateGraphInput } from './native-root-text-template-graph.js';

// Native TextNode uses uniform range arrays and PIXELS objects for these
// fields. Keep this explicit until the older general mock adopts that API.
export function nativeTextBindings(figma: any) {
  const create = figma.createText.bind(figma);
  figma.createText = () => nativeTextNodeBindings(create());
}
/** The general mock clones native text once. Apply the same measured live
 * binding behavior to a retained instance child for update tests. */
export function nativeTextNodeBindings(node: any, resolve?: (id: string) => any) {
    const bind = node.setBoundVariable.bind(node);
    delete node.clipsContent; // TextNode has no frame clipping field.
    const linked = new Map<string, any>();
    for (const field of ['fontSize', 'fontWeight', 'lineHeight']) {
      const bindings = node.boundVariables[field];
      const alias = Array.isArray(bindings) && bindings.length === 1 ? bindings[0] : bindings;
      const variable = alias?.type === 'VARIABLE_ALIAS' && resolve?.(alias.id);
      if (variable) linked.set(field, variable);
    }
    for (const field of ['fontSize', 'fontWeight', 'lineHeight']) {
      const storage = field === 'fontSize' ? '_fontSize' : field;
      let fallback = node[storage];
      Object.defineProperty(node, storage, { configurable: true, enumerable: true,
        get() {
          const variable = linked.get(field); if (!variable) return fallback;
          const value = variable.resolveForConsumer(node).value;
          return field === 'lineHeight' ? { unit: 'PIXELS', value } : value;
        },
        set(value) { fallback = value; },
      });
    }
    // Evaluations native probe: changing a bound Inter weight 400 -> 700
    // updates fontName.style as well as fontWeight; keep the fixture read live.
    let fontName = node.fontName;
    Object.defineProperty(node, 'fontName', { configurable: true, enumerable: true,
      get() {
        const weight = linked.get('fontWeight')?.resolveForConsumer(node).value;
        if (weight === undefined) return fontName;
        const styles: Record<number, string> = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular',
          500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };
        const style = styles[weight];
        if (!style || fontName.family !== 'Inter') throw Error('fixture-font-weight-unqualified');
        return { family: fontName.family, style: fontName.style.includes('Italic') ?
          (style === 'Regular' ? 'Italic' : style + ' Italic') : style };
      },
      set(value) { fontName = value; },
    });
    node.setBoundVariable = (field: string, variable: any) => {
      bind(field, variable);
      if (variable) linked.set(field, variable); else linked.delete(field);
      if (variable && ['fontSize', 'fontWeight', 'lineHeight'].includes(field)) {
        node.boundVariables[field] = [{ type: 'VARIABLE_ALIAS', id: variable.id }];
        const value = variable.resolveForConsumer(node).value;
        node[field] = field === 'lineHeight' ? { unit: 'PIXELS', value } : value;
      }
    };
    return node;
}

export function nativeTextGraphFixture(sizes = 10, colors = 10) {
  const names = (length: number) => Array.from({ length }, (_, i) => `v${i}`);
  const tokens = {
    size: Object.fromEntries(names(sizes).map((key, i) => [key, { $type: 'dimension', $value: `${12 + i}px` }])),
    line: Object.fromEntries(names(sizes).map((key, i) => [key, { $type: 'dimension', $value: `${18 + i}px` }])),
    // Deliberately equal values: all ten source identities must survive.
    ink: Object.fromEntries(names(colors).map(key => [key, { $type: 'color', $value: '#123456' }])),
    weight: { $type: 'fontWeight', $value: 400 },
  };
  const contract = ContractSchema.parse({ id: 'test.template-graph', name: 'TemplateGraph', description: 'Finite template routing fixture', version: '0.1.0', status: 'draft',
    props: [{ name: 'size', type: { enum: names(sizes) }, default: 'v0', bindings: { code: { prop: 'size' }, figma: { kind: 'VARIANT', property: 'Size' } } },
      { name: 'ink', type: { enum: names(colors) }, default: 'v0', bindings: { code: { prop: 'ink' }, figma: { kind: 'VARIANT', property: 'Ink' } } }],
    states: [], semantics: { element: 'span' }, anatomy: { root: {
      slot: { name: 'children', bindings: { figma: { textTemplate: true } } },
      layout: { display: 'inline-flex', direction: 'row' }, declared: { 'font-family': 'Inter' },
      tokens: { color: '{ink.{ink}}', 'font-size': '{size.{size}}', 'line-height': '{line.{size}}', 'font-weight': '{weight}' },
    } }, bindings: { code: { anchors: { importPath: 'test/TemplateGraph', export: 'TemplateGraph' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const compile = () => {
    const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
    const tokenRevision = revisionOf(tokens);
    return { component: engine.compileComponentData(contract, new Map([[contract.id, contract]])),
      source: { contractRevision: revisionOf(contract), tokenRevision },
      tokens: { fileKey: 'test-file', scopeId: 'template-graph-probe',
        source: { revision: revisionOf('source'), sourceProgramSha256: 'a'.repeat(64), tokensSha256: tokenRevision.slice(7) },
        tokenPaths: [...flattenTokens(tokens).keys()].sort(),
        modes: [{ sourceMode: 'light', brand: 'default', nativeModeName: 'Source', tokens, tokenTreeRevision: tokenRevision }],
      },
    } satisfies NativeRootTextTemplateGraphInput;
  };
  return { tokens, contract, compile };
}

export async function nativeTextGraphComponentFixture(sizes = 3, colors = 3, configure?: (f: ReturnType<typeof nativeTextGraphFixture>) => void) {
  const f = nativeTextGraphFixture(sizes, colors), h = nativeFixtureHost({ modeLimit: 2, consumerVariableModes: true });
  nativeTextBindings(h.figma);
  Object.getPrototypeOf(h.figma.currentPage).setExplicitVariableModeForCollection = function(c: any, mode: string) {
    this.explicitVariableModes = { ...this.explicitVariableModes, [c.id]: mode };
  };
  Object.assign(f.contract.anatomy.root.tokens!, { 'background-color': '{ink.{ink}}', 'border-color': '{ink.{ink}}',
    'padding-inline': '{size.v0}', 'border-radius': '{size.v0}' });
  configure?.(f);
  const engine = createFigmaEngine({ tokens: { primitives: f.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
  const operation = { id: '10000000-0000-4000-8000-000000000099', fileKey: h.figma.fileKey };
  const source = { revision: revisionOf('graph component source'), programSha256: 'a'.repeat(64), evidenceRevision: revisionOf('graph evidence') };
  const tokens = f.compile().tokens;
  tokens.fileKey = operation.fileKey; tokens.scopeId = 'source-' + operation.id;
  tokens.source.revision = source.revision;
  const byId = new Map([[f.contract.id, f.contract]]);
  const { input, graph } = engine.compileNativeContractTemplateGraph(f.contract, byId, source, tokens);
  const run = async (code: string) => JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${code}\n})()`, { figma: h.figma, console }, { timeout: 5000 })));
  const created = await run(emitNativeTemplateGraphScript(input).script);
  assert.equal(created.status, 'created-candidate', JSON.stringify(created));
  const observed = await run(emitNativeTemplateGraphReadbackScript(input, created.identity));
  verifyNativeTemplateGraphReceipt(input, created.identity, observed.receipt);
  const context = { operation, tokens: { input: tokens, identity: created.identity.source, receipt: observed.receipt.source },
    templateGraph: { identity: created.identity, receipt: observed.receipt } };
  const script = () => engine.buildNativeContractDraftScript(f.contract, byId, source, context);
  return { ...h, ...f, engine, operation, source, byId, input, graph, created, observed, context, run, script };
}
