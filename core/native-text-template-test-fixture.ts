import { ContractSchema } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { revisionOf } from './contract-provenance.js';
import { flattenTokens } from './tokens.js';
import type { NativeRootTextTemplateGraphInput } from './native-root-text-template-graph.js';

// Native TextNode uses uniform range arrays and PIXELS objects for these
// fields. Keep this explicit until the older general mock adopts that API.
export function nativeTextBindings(figma: any) {
  const create = figma.createText.bind(figma);
  figma.createText = () => {
    const node = create(), bind = node.setBoundVariable.bind(node);
    delete node.clipsContent; // TextNode has no frame clipping field.
    const linked = new Map<string, any>();
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
  };
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
