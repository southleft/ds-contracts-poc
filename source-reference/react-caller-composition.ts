/** Project authenticated source ownership and label facts into a composed React
 * draft. Measured layout remains bounded to this source case, never a general
 * API inferred from a screenshot. No component-name dispatch. */
import { ContractSchema, walkAnatomy, type Contract, type Part } from '../scripts/contract-schema.js';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { emitReactInline } from '../core/emit-react-inline.js';
import type { NodeSpec } from '../core/emit-figma-script.js';
import { validateContract } from '../packages/core/src/validate.js';
import { flatten, type CapturedNode } from '../extract/computed/lib.js';
import { compileObservedContent, prepareObservedContentTree } from './observed-content.js';
import { deriveReactChildRoot } from './react-child-root.js';
import { linkReactSourceAnatomy } from './react-source-anatomy.js';
import { verifiedLabelAssociations, type LabelAssociationEvidence } from './label-associations.js';
import { reactComparisonVariant } from './react-comparison-plan.js';
import type { ReactOwnership } from './react-ownership.js';
import type { ReactSourceProgram } from './react-source-program.js';
import type { ReactStyleOrigin } from './react-style-origin.js';
import type { TextFontEvidence } from './text-fonts.js';
import type { SvgViewportEvidence } from './svg-viewports.js';
import type { GridConstraintEvidence } from './grid-constraints.js';

export interface ReactCallerBehavior {
  source: ReactOwnership['components'][number]['source'];
  initialContract: Contract;
  contract: Contract;
  heldProps: Record<string, unknown>;
  trees: Record<string, CapturedNode>;
  tokens: Record<string, unknown>;
  assets: Array<[string, string]>;
}
export interface ReactCallerComposition {
  status: 'generated-draft' | 'refused';
  problems: string[];
  limitations: string[];
  inputRevision: string;
  observedWidth?: number;
  contract?: Contract;
  contracts?: Contract[];
  modules?: Array<{ name: string; tsx: string }>;
  identities: Array<{ sourcePath: string; prop: string }>;
  children: Array<{ instanceId: string; sourcePath: string; exportName: string; contractId: string; behavior: boolean }>;
  contextDifferences: Array<{ sourcePath: string; field: string; generated: string; source: string }>;
}
/** What makes an operation a caller-composition root is the observed structure:
 * sealed evidence that generates a composition with nested component children.
 * A case name is never that fact; a root with no nested children is refused. */
export function requireReactCallerComposition(draft: ReactCallerComposition) {
  if (draft.status !== 'generated-draft' || !draft.children.length)
    throw Error('react-caller-source-frame-composition-required');
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const omitted = (value: unknown) => value === undefined || same(value, { kind: 'undefined' });
/** A preview may expose a non-painting typography discrepancy explicitly.
 * This never grants native reuse, a fidelity pass or an accepted contract. */
export function compareReactCallerContext(generated: CapturedNode | undefined, source: CapturedNode | undefined) {
  if (!generated || !source) return undefined;
  if (same(generated, source)) return [];
  const allowedTags = new Set(['button', 'span', 'div', 'svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon']);
  const noText = (tree: CapturedNode) => flatten(tree).every(({ node }) => allowedTags.has(node.tag) &&
    node.nodes.every(n => n.t !== 'text' || n.v === '') && Object.values(node.pseudo).every(p => !p.content || ['none', 'normal', '""'].includes(p.content)));
  if (!noText(generated) || !noText(source)) return undefined;
  const a = structuredClone(generated), b = structuredClone(source), differences: Array<{ field: string; generated: string; source: string }> = [];
  const af = flatten(a), bf = flatten(b);
  if (af.length !== bf.length) return undefined;
  af.forEach((entry, i) => {
    const other = bf[i];
    for (const [kind, left, right] of [['style', entry.node.style, other.node.style],
      ...(Object.keys(entry.node.pseudo) as Array<keyof CapturedNode['pseudo']>).map(key => [key, entry.node.pseudo[key]!, other.node.pseudo[key]] as const)] as const) {
      if (!right) continue;
      for (const field of ['font-size', 'line-height']) if (typeof left[field] === 'string' && typeof right[field] === 'string' && left[field] !== right[field]) {
        differences.push({ field: `${entry.path || 'root'}.${kind}.${field}`, generated: left[field], source: right[field] });
        left[field] = right[field];
      }
    }
  });
  return same(a, b) ? differences : undefined;
}
export interface ReactCallerCompositionInput {
  program: ReactSourceProgram; ownership: ReactOwnership; tree: CapturedNode; origin: ReactStyleOrigin;
  fonts: TextFontEvidence; svg: SvgViewportEvidence; grids?: GridConstraintEvidence; labels: LabelAssociationEvidence;
  behaviors: ReactCallerBehavior[];
}
export interface ReactCallerCompositionResources {
  contractId: string;
  tokens: Record<string, unknown>;
  assets: Array<[string, string]>;
}
/** Host-side resources are kept separate from the public React preview. */
export function projectReactCallerComposition(input: ReactCallerCompositionInput): ReactCallerComposition {
  return projectReactCallerCompositionGraph(input).draft;
}
export function projectReactCallerCompositionGraph(input: ReactCallerCompositionInput): {
  draft: ReactCallerComposition; resources: ReactCallerCompositionResources[];
} {
  let resources: ReactCallerCompositionResources[] = [];
  const result: ReactCallerComposition = { status: 'refused', problems: [], identities: [], children: [], contextDifferences: [], inputRevision: revisionOf(input),
    limitations: ['observed-composition-context-only', 'unobserved-layout-and-property-planes-unqualified', 'native-caller-property-mapping-unqualified',
      'external-fonts-not-bundled', 'generated-consumer-not-installed', 'visual-fidelity-not-qualified'] };
  try {
    const { program, ownership, tree, origin, fonts, svg, grids } = input;
    if (/^\d+(?:\.\d+)?px$/.test(tree.style.width)) result.observedWidth = Number.parseFloat(tree.style.width);
    const anatomy = linkReactSourceAnatomy(program, ownership, tree);
    if (anatomy.status !== 'linked' || anatomy.problems.length) throw Error('react-caller-source-correspondence-unavailable');
    if (anatomy.instances.some(instance => instance.content === 'nested-caller-slot'))
      throw Error('react-caller-nested-slot-lowering-unqualified');
    const labels = verifiedLabelAssociations(tree, input.labels);
    const boundaries = ownership.components.flatMap(c => c.roots).filter(path => path !== '');
    const content = compileObservedContent(tree, fonts, svg, true, boundaries);
    if (content.status !== 'compiled-comparison-draft' || content.problems.length || !content.contract || !content.tokens || !content.sourcePaths || content.component?.variants.length !== 1)
      throw Error('react-caller-content-unavailable');
    const contract = structuredClone(content.contract);
    contract.id = 'observed.caller-' + result.inputRevision.slice(7, 23); contract.name = 'GeneratedSourceComposition';
    contract.bindings.code.anchors = { importPath: './GeneratedSourceComposition', export: contract.name };
    contract.description = 'Source-owned nested components and caller relationships at the observed context; wider API and native qualification remain pending.';
    const parts = new Map(walkAnatomy(contract).map(w => [w.name, w.part]));
    const partAt = (path: string): Part => {
      const matches = content.sourcePaths!.filter(p => p.sourcePath === path);
      if (matches.length !== 1 || !parts.has(matches[0].partName)) throw Error('react-caller-compiler-correspondence-unavailable:' + path);
      return parts.get(matches[0].partName)!;
    };
    const flat = new Map(flatten(tree).map(n => [n.path, n.node]));
    const prepared = new Map(flatten(prepareObservedContentTree(tree, fonts, svg)).map(n => [n.path, n.node]));
    const contracts = new Map([[contract.id, contract]]);
    const contexts = new Map([[contract.id, { tokens: content.tokens, assets: new Map(content.assets) }]]);
    const idFor = new Map<string, string>();
    for (const label of labels) {
      const node = flat.get(label.labelPath)!;
      if (node.nodes.some(n => n.t !== 'text')) throw Error('react-caller-formatted-label-unqualified');
      const part = partAt(label.labelPath);
      part.element = 'label';
      if (label.mode === 'explicit') {
        let prop = idFor.get(label.controlPath);
        if (!prop) {
          prop = `control${idFor.size + 1}Id`; idFor.set(label.controlPath, prop);
          contract.props.push({ name: prop, type: 'text', required: true, default: '',
            bindings: { code: { prop }, figma: { kind: 'NONE' } } });
          result.identities.push({ sourcePath: label.controlPath, prop });
        }
        part.attrs = { ...part.attrs, for: `{${prop}}` };
      }
    }
    // Text is caller-owned content. The copy is a default, not a child main's
    // private anatomy; keep the public text field in the composing contract.
    const ownedParts = new Set<Part>();
    const own = (part: Part) => { ownedParts.add(part); Object.values(part.parts ?? {}).forEach(own); };
    for (const child of anatomy.instances.filter(c => c.content === 'authored-or-runtime'))
      for (const root of child.roots) own(partAt(root.path));
    // The content compiler has already resolved CSS aliases against the
    // observed painted fonts. Keep that identity on caller text before its
    // ancestor is replaced with a dependency: the dependency's empty slot can
    // otherwise reintroduce a CSS font-family alias that is not a native font.
    const nativeParts = new Map<string, NodeSpec[]>();
    const indexNativePart = (spec: NodeSpec) => {
      nativeParts.set(spec.name, [...(nativeParts.get(spec.name) ?? []), spec]);
      spec.children?.forEach(indexNativePart);
    };
    indexNativePart(content.component.variants[0].spec);
    let textIndex = 0;
    for (const { part, name } of walkAnatomy(contract)) if (!ownedParts.has(part) && typeof part.text === 'string') {
      const matches = nativeParts.get(name) ?? [], texts: NodeSpec[] = [];
      const collectText = (spec: NodeSpec) => {
        if (spec.type === 'text' && spec.characters === part.text) texts.push(spec);
        spec.children?.forEach(collectText);
      };
      if (matches.length === 1) collectText(matches[0]);
      if (texts.length !== 1 || !texts[0].fontFamily)
        throw Error('react-caller-text-font-correspondence-unavailable:' + name);
      part.declared = { ...part.declared, 'font-family': JSON.stringify(texts[0].fontFamily) };
      const prop = `content${++textIndex}`;
      contract.props.push({ name: prop, type: 'text', default: part.text,
        bindings: { code: { prop }, figma: { kind: 'NONE' } } });
      part.content = { prop }; delete part.text;
    }
    const children = anatomy.instances.filter(c => !c.roots.some(r => r.path === ''));
    for (const [index, child] of children.entries()) {
      if (child.roots.length !== 1 || child.content === 'unresolved') throw Error('react-caller-child-correspondence-unqualified');
      const sourcePath = child.roots[0].path, target = partAt(sourcePath), observed = ownership.components.find(c => c.id === child.instanceId)!;
      let dependency: Contract, childTokens: Record<string, unknown>, childAssets: Array<[string, string]> = [];
      const ref: NonNullable<Part['component']> = { id: '', props: {} };
      if (child.content === 'authored-or-runtime') {
        if (child.dependencies.length) throw Error('react-caller-runtime-composition-unqualified');
        const compatible = input.behaviors.filter(candidate => {
          if (!same(candidate.source, child.source)) return false;
          try {
            const variant = reactComparisonVariant(candidate.initialContract, observed.props);
            const axes = new Set(candidate.initialContract.props.map(p => p.bindings.code.prop));
            const held = (values: Record<string, unknown>) => Object.fromEntries(Object.entries(values).filter(([key]) => !axes.has(key) && key !== 'children' && !(key === 'id' && idFor.has(sourcePath))));
            return same(held(candidate.heldProps), held(observed.props)) && compareReactCallerContext(candidate.trees[variant], prepared.get(sourcePath)) !== undefined;
          } catch { return false; }
        });
        const exact = compatible.filter(candidate =>
          compareReactCallerContext(candidate.trees[reactComparisonVariant(candidate.initialContract, observed.props)], prepared.get(sourcePath))?.length === 0);
        const matches = exact.length ? exact : compatible;
        if (matches.length !== 1) throw Error('react-caller-behavior-context-unavailable:' + sourcePath);
        const candidate = matches[0]; dependency = structuredClone(candidate.contract); childTokens = candidate.tokens; childAssets = candidate.assets;
        const context = compareReactCallerContext(candidate.trees[reactComparisonVariant(candidate.initialContract, observed.props)], prepared.get(sourcePath))!;
        result.contextDifferences.push(...context.map(d => ({ sourcePath, ...d })));
        for (const prop of dependency.props) {
          const inputName = prop.bindings.code.initial?.prop ?? prop.bindings.code.prop;
          const value = observed.props[inputName];
          if (omitted(value)) continue;
          const name = `control${index + 1}${prop.name[0].toUpperCase()}${prop.name.slice(1)}`;
          if (prop.type === 'boolean' && typeof value === 'boolean' && !prop.bindings.code.initial) {
            contract.props.push({ ...structuredClone(prop), name, default: value, bindings: { code: { prop: name }, figma: { ...prop.bindings.figma, unsetValue: undefined, property: name } } });
            ref.props![prop.name] = `{${name}}`; continue;
          }
          if (typeof prop.type !== 'object' || !('enum' in prop.type)) throw Error('react-caller-input-domain-unqualified');
          const choices = prop.type.enum.filter(key => same(prop.bindings.code.values ? prop.bindings.code.values[key] : key, value));
          if (choices.length !== 1) throw Error('react-caller-input-value-unqualified');
          contract.props.push({ ...structuredClone(prop), name, default: choices[0], bindings: { code: { prop: name }, figma: { ...prop.bindings.figma, unsetValue: undefined, property: name } } });
          (prop.bindings.code.initial ? (ref.initialProps ??= {}) : ref.props!)[prop.name] = `{${name}}`;
        }
      } else {
        const derived = deriveReactChildRoot(program, ownership, tree, origin, child.instanceId,
          grids?.status === 'observed' ? { gridConstraints: grids } : undefined, { fonts, svg });
        dependency = structuredClone(derived.draft.contract!); childTokens = derived.draft.tokens!; childAssets = derived.assets ?? [];
        ref.id = dependency.id;
      }
      const identity = idFor.get(sourcePath);
      if (identity) {
        if (dependency.props.some(p => p.name === 'sourceControlId' || p.bindings.code.prop === 'id') || dependency.anatomy.root.attrs?.id)
          throw Error('react-caller-control-id-collision');
        dependency.props.push({ name: 'sourceControlId', type: 'text', required: true, default: '',
          bindings: { code: { prop: 'id' }, figma: { kind: 'NONE' } } });
        dependency.anatomy.root.attrs = { ...dependency.anatomy.root.attrs, id: '{sourceControlId}' };
        ref.props!.sourceControlId = `{${identity}}`;
      }
      ref.id = dependency.id;
      const existing = contracts.get(dependency.id);
      if (existing && !same(existing, dependency)) throw Error('react-caller-dependency-context-conflict');
      if ([...contracts.values()].some(c => c.id !== dependency.id && c.name === dependency.name)) throw Error('react-caller-dependency-name-conflict');
      contracts.set(dependency.id, dependency);
      const context = { tokens: childTokens, assets: new Map(childAssets) };
      if (contexts.has(dependency.id) && (!same(contexts.get(dependency.id)!.tokens, childTokens) || !same([...contexts.get(dependency.id)!.assets], childAssets)))
        throw Error('react-caller-dependency-context-conflict');
      contexts.set(dependency.id, context);
      const callerParts = target.parts;
      if (child.content === 'caller-slot' && (target.content || target.text !== undefined)) throw Error('react-caller-content-box-unqualified');
      for (const key of Object.keys(target)) delete (target as Record<string, unknown>)[key];
      target.component = ref;
      if (child.content === 'caller-slot') target.parts = callerParts ?? {};
      result.children.push({ instanceId: child.instanceId, sourcePath, exportName: child.source.exportName, contractId: dependency.id, behavior: child.content === 'authored-or-runtime' });
    }
    if (result.identities.some(id => !result.children.some(child => child.sourcePath === id.sourcePath))) throw Error('react-caller-label-control-not-generated');
    const errors: string[] = [];
    for (const c of contracts.values()) validateContract(c, contracts, errors, contexts.get(c.id)!.assets);
    if (errors.length) throw Error('react-caller-contract-invalid:' + errors.join(';'));
    const modules = [...contracts.values()].map(c => ({ name: c.name, tsx: emitReactInline(c,
      { contracts, icons: contexts.get(c.id)!.assets, tokens: { primitives: contexts.get(c.id)!.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } } }).tsx }));
    result.contract = ContractSchema.parse(contract); result.contracts = [...contracts.values()]; result.modules = modules;
    resources = [...contexts].map(([contractId, context]) => ({ contractId,
      tokens: structuredClone(context.tokens), assets: [...context.assets] }));
    result.status = 'generated-draft';
  } catch (error) { result.problems.push(error instanceof Error ? error.message : String(error)); }
  return { draft: result, resources };
}
