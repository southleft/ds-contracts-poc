/** Compile the sealed source composition using the shared native engine.
 * This host-side bridge creates no operation, variables or Figma nodes. */
import { walkAnatomy } from '../scripts/contract-schema.js';
import { createFigmaEngine, nativeCallerContentMappings, nativeCallerPropertyBlockers } from '../core/emit-figma-script.js';
import { scopeContractResources } from '../core/scoped-contract-resources.js';
import { revisionOf } from '../core/contract-provenance.js';
import type { projectReactCallerCompositionGraph } from './react-caller-composition.js';

export interface ReactCallerNativeCompilation {
  status: 'compiled-draft';
  inputRevision: string;
  graphRevision: string;
  observedWidth: number;
  /** The first native variant is the contract-default combination and therefore
   * depicts the unchanged source inputs used to derive this composition. */
  observedVariant: string;
  components: Array<{ contractId: string; name: string; variants: number; editableTextProperties: string[];
    editableCanvasText: Array<{ property: string; nodeName: string }> }>;
  resources: Array<{ contractId: string; tokens: number; assets: number }>;
  unsupportedPropertyBindings: Array<{ contractId: string; property: string; kind: 'TEXT' | 'BOOLEAN'; nodeName: string }>;
  blockers: string[];
}
export function compileReactCallerNative(graph: ReturnType<typeof projectReactCallerCompositionGraph>) {
  const { draft } = graph;
  if (draft.status !== 'generated-draft' || draft.problems.length || !draft.contract || !draft.contracts ||
      !Number.isFinite(draft.observedWidth) || draft.observedWidth! <= 0)
    throw Error('react-caller-native-source-unavailable');
  const contracts = structuredClone(draft.contracts), parent = contracts.find(c => c.id === draft.contract!.id);
  if (!parent) throw Error('react-caller-native-parent-unavailable');
  // This draft depicts the archived viewport, not an inferred responsive API.
  // The React preview already uses this same source-observed container width.
  parent.anatomy.root.literals = { ...parent.anatomy.root.literals, width: `${draft.observedWidth}px` };
  const content = new Set(walkAnatomy(parent).flatMap(({ part }) => part.content ? [part.content.prop] : []));
  for (const prop of parent.props) if (content.has(prop.name)) {
    if (prop.type !== 'text') throw Error('react-caller-native-content-domain-unqualified');
    prop.bindings.figma = { kind: 'TEXT', property: prop.name };
  }
  const scoped = scopeContractResources(contracts, graph.resources);
  const engine = createFigmaEngine({ tokens: { primitives: scoped.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: scoped.icons });
  const components = [...scoped.contracts.values()].map(contract => engine.compileComponentData(contract, scoped.contracts));
  const unsupportedPropertyBindings = components.flatMap(component => nativeCallerPropertyBlockers(component)
    .map(binding => ({ contractId: component.contractId, ...binding })));
  const report: ReactCallerNativeCompilation = {
    status: 'compiled-draft', inputRevision: draft.inputRevision,
    graphRevision: revisionOf({ resources: scoped.revision, components }), observedWidth: draft.observedWidth!,
    observedVariant: components.find(component => component.contractId === parent.id)!.variants[0].name,
    components: components.map(c => ({ contractId: c.contractId, name: c.setName, variants: c.variants.length,
      editableTextProperties: scoped.contracts.get(c.contractId)!.props
        .filter(p => p.type === 'text' && p.bindings.figma.kind === 'TEXT' &&
          !unsupportedPropertyBindings.some(binding => binding.contractId === c.contractId && binding.property === p.bindings.figma.property))
        .filter(p => !nativeCallerContentMappings(c).some(binding => binding.property === p.bindings.figma.property))
        .map(p => p.bindings.figma.property!),
      editableCanvasText: nativeCallerContentMappings(c) })),
    unsupportedPropertyBindings,
    resources: scoped.mappings.map(m => ({ contractId: m.contractId, tokens: m.tokenPaths.length, assets: m.assets.length })),
    blockers: [...(draft.contextDifferences.length ? ['source-context-differences-unqualified'] : []),
      ...(unsupportedPropertyBindings.length ? ['native-caller-slot-property-bindings-unsupported'] : []),
      'native-composition-delivery-unverified', 'live-editability-and-fidelity-unverified'],
  };
  return { report, scoped, components };
}
