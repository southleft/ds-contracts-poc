/** Assemble a complete observed initial-state domain through the shared computed
 * compiler. Runtime behavior and reusable child identities are separate work. */
import { revisionOf } from '../core/contract-provenance.js';
import { authoredLengthIsUsed } from './layout-unit.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { enumerate, comboKey, normalizeValue, flatten, type CapturedNode } from '../extract/computed/lib.js';
import type { PropSpace, SweepResult } from '../extract/computed/capture.js';
import type { ReactSourceProgram } from './react-source-program.js';
import { reactOwnershipMatchesTree, type ReactOwnership } from './react-ownership.js';
import type { ReactPropertySnapshot } from './react-root-variants.js';
import type { TextFontEvidence } from './text-fonts.js';
import type { SvgViewportEvidence } from './svg-viewports.js';
import { classifyReactProperty } from './react-program-proposal.js';
import { planReactInitialStates, type observeReactInitialStates } from './react-initial-state.js';
import { prepareObservedContentTree, compileObservedContentSweep } from './observed-content.js';
import { evidenceSha } from './react-validation-evidence.js';
import { validateContract } from '../packages/core/src/validate.js';
import { observeReactSourceBindings, type ReactSourceBindingProjection } from './react-source-bindings.js';
import { retainReactRootSourceBindings } from './react-root-sweep.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import { linkReactSourceAnatomy } from './react-source-anatomy.js';
import { descendantFixedSizes, descendantTranslateRefusal, lowerDescendantTranslations, type DescendantAlignment, type DescendantSizing } from './react-descendant-geometry.js';

type Snapshot = ReactPropertySnapshot & { fonts: TextFontEvidence; svg: SvgViewportEvidence };
const unjoined = 'descendant-sizes-not-joined:census-differs-from-captured-tree';
export function reactInitialObservedRoot(snapshot: Snapshot, instanceId: string) {
  const instance = snapshot.ownership.components.find(c => c.id === instanceId);
  if (!instance || instance.roots.length !== 1) throw Error('react-initial-contract-source-root-mismatch');
  const rootPath = instance.roots[0], prepared = prepareObservedContentTree(snapshot.tree, snapshot.fonts, snapshot.svg);
  const root = flatten(prepared).find(row => row.path === rootPath)?.node;
  if (!root) throw Error('react-initial-contract-source-root-mismatch');
  return { rootPath, root: structuredClone(root) };
}
export function compileReactInitialContract(program: ReactSourceProgram, ownership: ReactOwnership, tree: CapturedNode,
  observation: Awaited<ReturnType<typeof observeReactInitialStates>>, snapshots: Record<string, Snapshot>,
  /** Contract id of an EXISTING native component. Its name and token namespace
   * are that component's identity; a later observation of the same source case
   * compiles under them instead of minting a name from its own content. */
  identity?: string) {
  const draft = { version: 1 as const, qualification: 'observed-initial-state-contract' as const,
    acceptedContract: null, nativeQualification: 'unqualified' as const, status: 'refused' as 'refused' | 'compiled-draft',
    problems: [] as string[], limitations: ['observed-initial-inputs-only', 'runtime-interactions-not-projected',
      'nested-component-identity-not-projected', 'source-variable-modes-and-aliases-not-assembled', 'descendant-source-bindings-not-observed', 'native-output-not-verified'],
    sourceBindings: [] as Array<{ observation: string; bindings: ReactSourceBindingProjection['sourceBindings'] }>,
    nativeVariants: [] as Array<{ observation: string; variant: string }>,
    compiled: undefined as ReturnType<typeof compileObservedContentSweep> | undefined };
  /** `descendants` exists only when something below the root was admitted: own fixed sizes per plane, and lowered translations. */
  const result: typeof draft & { descendants?: { sizes: Array<{ observation: string; path: string; channels: string[] }>; alignments: DescendantAlignment[] } } = draft;
  try {
    const expected = planReactInitialStates(program, ownership, tree, observation.instanceId);
    const originalInstance = ownership.components.find(c => c.id === observation.instanceId)!;
    const originalPath = originalInstance.roots[0];
    const nested = originalPath !== '';
    if (nested) {
      const linked = linkReactSourceAnatomy(program, ownership, tree).instances.find(c => c.instanceId === observation.instanceId);
      if (!originalInstance.parent || !linked || linked.content !== 'authored-or-runtime' || linked.dependencies.length)
        throw Error('react-initial-contract-nested-leaf-required');
    }
    if (observation.version !== 1 || observation.qualification !== 'finite-initial-mounts-only' || observation.problems.length ||
        !expected.plan.length || expected.plan.length !== observation.planned || expected.plan.length !== observation.rows.length ||
        revisionOf(expected.source) !== revisionOf(observation.source) || revisionOf(expected.heldProps) !== revisionOf(observation.heldProps) ||
        revisionOf(expected.axes) !== revisionOf(observation.axes) ||
        observation.rows.some((row, i) => row.id !== String(i) || revisionOf(row.changes) !== revisionOf(expected.plan[i].changes)))
      throw Error('react-initial-contract-domain-mismatch');
    const source = program.components.find(c => c.module === expected.source.module && c.exportName === expected.source.exportName &&
      c.sourceSha256 === expected.source.sourceSha256 && c.span.start === expected.source.span.start && c.span.end === expected.source.span.end)!;
    const definitions = expected.axes.map(({ property }) => {
      const prop = source.props.find(p => p.name === property)!, classified = classifyReactProperty(prop.type)!;
      const values = classified.kind === 'boolean' ? ['false', 'true'] : classified.values!;
      const codeValues = classified.kind === 'boolean' ? { false: false, true: true } : classified.codeValues ?? Object.fromEntries(values.map(v => [v, v]));
      let unset = 'unset'; while (values.includes(unset)) unset += '-unset';
      // Keep omission distinct. Similar-looking samples do not establish an
      // equivalent source default or authorize collapsing an API value.
      const axis = { prop: property, values: prop.optional ? [unset, ...values] : values, ...(prop.optional ? { unset } : {}) };
      return { property, prop, classified, values, codeValues, axis, base: prop.optional ? unset : values[0] };
    });
    const axes = definitions.map(d => d.axis), baseAxisValues = Object.fromEntries(definitions.map(d => [d.property, d.base]));
    const enumeration = enumerate(axes, [], 64, baseAxisValues);
    if (enumeration.policy !== 'full-cartesian' || enumeration.combos.length !== observation.rows.length) throw Error('react-initial-contract-domain-incomplete');
    const roots = new Map<string, CapturedNode>(), sizes = new Set<string>();
    const sizeModes = new Map<string, string>();
    const planes = new Map<string, { snapshot: Snapshot; assignment: Record<string, string>; rowId: string; rootPath: string; sizing: DescendantSizing }>();
    for (const row of observation.rows) {
      const snap = snapshots[row.id];
      if (row.status !== 'observed' || !row.restored || !snap || snap.image !== row.image || snap.treeSha256 !== row.treeSha256 ||
          evidenceSha(JSON.stringify(snap.tree)) !== row.treeSha256 || snap.ownership.problems.length)
        throw Error('react-initial-contract-observation-unverified');
      const instance = snap.ownership.components.find(c => c.id === observation.instanceId);
      if (!instance || revisionOf(instance.source) !== revisionOf(expected.source) || instance.roots.length !== 1 || instance.roots[0] !== originalPath || instance.parent !== originalInstance.parent)
        throw Error('react-initial-contract-source-root-mismatch');
      if (!nested && snap.ownership.components.length !== 1) throw Error('react-initial-contract-nested-identity-unqualified');
      if (nested) {
        const linked = linkReactSourceAnatomy(program, snap.ownership, snap.tree);
        const child = linked.instances.find(c => c.instanceId === observation.instanceId);
        if (linked.status !== 'linked' || !child || child.content !== 'authored-or-runtime' || child.dependencies.length)
          throw Error('react-initial-contract-nested-leaf-required');
      }
      const held = { ...instance.props }, original = { ...expected.heldProps }, assignment: Record<string, string> = {};
      for (const d of definitions) {
        const requested = row.changes[d.property]; delete held[d.property]; delete original[d.property];
        if (requested.kind === 'omit' ? Object.hasOwn(instance.props, d.property) : !Object.is(instance.props[d.property], requested.value))
          throw Error('react-initial-contract-property-mismatch');
        const value = requested.kind === 'omit' ? d.axis.unset : d.values.find(v => Object.is(d.codeValues[v as keyof typeof d.codeValues], requested.value));
        if (value === undefined) throw Error('react-initial-contract-value-unmapped'); assignment[d.property] = value;
      }
      if (revisionOf(held) !== revisionOf(original)) throw Error('react-initial-contract-held-props-changed');
      const key = comboKey(axes, [], assignment, {});
      if (roots.has(key)) throw Error('react-initial-contract-duplicate-combination');
      const { root, rootPath } = reactInitialObservedRoot(snap, observation.instanceId);
      const origin = snap.styleOrigin.roots.find(r => r.path === rootPath && r.tag === root.tag);
      for (const channel of ['width', 'height']) {
        const size = origin?.sizes?.find(s => s.channel === channel);
        // An unconstrained inline flex row owns its content-sized width. Never
        // mint the current label's measured width as a fixed component size.
        // Block fill, wrapping, flex allocation and mixed fixed/auto domains
        // need their own evidence and remain refused here.
        const intrinsic = channel === 'width' && size?.status === 'auto' && size.value === 'auto' &&
          root.style.display === 'inline-flex' && root.style['flex-direction'] === 'row' &&
          root.style['flex-wrap'] === 'nowrap' && root.style['flex-grow'] === '0' &&
          root.style['flex-shrink'] === '0' && root.style['flex-basis'] === 'auto' &&
          root.style['min-width'] === '0px' && root.style['max-width'] === 'none' &&
          root.style['writing-mode'] === 'horizontal-tb' && root.style.position === 'static';
        if (!intrinsic && (size?.status !== 'fixed' || !size.value || !authoredLengthIsUsed(size.value, root.style[channel])))
          throw Error('react-initial-contract-root-sizing-unqualified:' + channel);
        const mode = intrinsic ? 'intrinsic' : 'fixed';
        if (sizeModes.has(channel) && sizeModes.get(channel) !== mode)
          throw Error('react-initial-contract-root-sizing-mixed:' + channel);
        sizeModes.set(channel, mode);
        if (!intrinsic) sizes.add(channel);
      }
      // CSS normal gaps have zero used value in non-multicol flex containers.
      if (['flex', 'inline-flex'].includes(root.style.display)) for (const channel of ['row-gap', 'column-gap'])
        if (root.style[channel] === 'normal') root.style[channel] = '0px';
      roots.set(key, root);
      // Evidence paths are browser child indices: they join the captured tree only when the whole path/tag census agrees.
      const joined = !snap.descendantSizes || reactOwnershipMatchesTree(snap.ownership, snap.tree);
      if (!joined && !result.limitations.includes(unjoined)) result.limitations.push(unjoined);
      planes.set(key, { snapshot: snap, assignment, rowId: row.id, rootPath, sizing: descendantFixedSizes(root, rootPath, joined ? snap.descendantSizes : undefined) });
    }
    if (enumeration.combos.some(c => !roots.has(c.key)) || new Set([...roots.values()].map(r => r.tag)).size !== 1)
      throw Error('react-initial-contract-host-or-domain-changed');
    // After every plane is sized: a translated descendant lowers to a per-plane main-axis alignment or refuses.
    const alignments = lowerDescendantTranslations(new Map([...planes].map(([key, plane]) => [key, { root: roots.get(key)!, sizing: plane.sizing }])), sizes);
    const admitted = [...planes.values()].flatMap(plane => [...plane.sizing].map(([path, channels]) => ({ observation: plane.rowId, path, channels: [...channels].sort() })));
    // Named only when something was admitted: a re-observed component this rule does not touch keeps its draft revision.
    if (alignments.length || admitted.length) result.descendants = { sizes: admitted, alignments };
    const existing = identity === undefined ? undefined : /^observed\.react-initial-([a-f0-9]{16})$/.exec(identity)?.[1];
    if (identity !== undefined && !existing) throw Error('react-initial-contract-identity-invalid');
    const suffix = existing ?? revisionOf({ source: expected.source, axes, observations: observation.rows }).slice(7, 23), name = `InitialStates${suffix}`;
    const contract = ContractSchema.parse({ id: `observed.react-initial-${suffix}`, name, version: '0.1.0', status: 'draft',
      description: 'Observed finite React initial states; runtime behavior and reusable child mappings remain unqualified.',
      props: definitions.map(d => ({ name: d.property, type: d.classified.kind === 'boolean' ? 'boolean' : { enum: d.values },
        ...(!d.prop.optional ? { required: true } : {}), bindings: { code: { prop: d.property,
          ...(d.classified.kind === 'boolean' ? {} : { values: d.codeValues }) }, figma: { kind: 'VARIANT', property: d.property,
          values: Object.fromEntries(d.values.map(v => [v, v])), ...(d.prop.optional ? { unsetValue: '(unset)' } : {}) } } })),
      states: [], semantics: { element: [...roots.values()][0].tag }, anatomy: { root: {} },
      bindings: { code: { anchors: { importPath: `observed/${suffix}`, export: name } }, figma: { anchors: { fileKey: null, componentSetKey: null } } } });
    const baseComboKey = enumeration.combos.find(c => axes.every(a => c.axisValues[a.prop] === baseAxisValues[a.prop]))!.key;
    const space: PropSpace = { contract, axes, presence: new Map(), stateProps: [], enumeration, baseComboKey, baseAxisValues, heldFixed: [] };
    result.compiled = compileObservedContentSweep(space, { name, importName: name, contract: '', sampleText: '', axes: axes.map(a => a.prop) },
      { captures: enumeration.combos.map(c => ({ combo: `${name}:${c.key}`, interaction: 'default', root: roots.get(c.key)! })) } as SweepResult, [...sizes.keys()],
      false, [], new Map([...planes].map(([key, plane]) => [key, plane.sizing])));
    result.problems.push(...result.compiled.problems);
    if (result.compiled.contract && result.compiled.tokens && !result.problems.length) {
      const projections = new Map<string, ReactSourceBindingProjection>();
      for (const [key, plane] of planes) {
        const projection = observeReactSourceBindings(roots.get(key)!, result.compiled.contract.anatomy.root,
          result.compiled.tokens, plane.snapshot.styleOrigin, plane.rootPath, plane.assignment);
        projections.set(key, projection);
        result.sourceBindings.push({ observation: plane.rowId, bindings: projection.sourceBindings });
        // A declared direct-variable relationship must survive or refuse;
        // other unresolved channels stay explicitly reported as unresolved.
        if (projection.sourceBindings.some(b => b.variable && !b.tokenPath))
          throw Error('react-initial-contract-source-binding-unresolved');
      }
      retainReactRootSourceBindings(result.compiled.contract, result.compiled.tokens, axes, baseAxisValues, projections);
      const engine = createFigmaEngine({ tokens: { primitives: result.compiled.tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map(result.compiled.assets) });
      result.compiled.component = engine.compileComponentData(result.compiled.contract, new Map([[result.compiled.contract.id, result.compiled.contract]]));
      result.nativeVariants = [...planes.values()].map(plane => ({ observation: plane.rowId,
        variant: definitions.map(d => d.property + '=' + (plane.assignment[d.property] === d.axis.unset ? '(unset)' : plane.assignment[d.property])).join(', ') }));
      if (result.nativeVariants.length !== result.compiled.component.variants.length ||
          new Set(result.nativeVariants.map(v => v.variant)).size !== result.nativeVariants.length ||
          result.nativeVariants.some(v => !result.compiled!.component!.variants.some(c => c.name === v.variant)))
        throw Error('react-initial-contract-native-domain-mismatch');
      // The lowering is believed only as COMPILED: each plane's variant must hold the alignment it was given.
      for (const alignment of alignments) for (const [key, plane] of planes) {
        const variant = result.nativeVariants.find(v => v.observation === plane.rowId)!;
        if (result.compiled.component.variants.find(c => c.name === variant.variant)!.spec.layout?.primary !== (alignment.planes[key] === 'end' ? 'MAX' : 'MIN'))
          throw Error(descendantTranslateRefusal + ':alignment-not-carried');
      }
    }
    if (result.compiled.contract) validateContract(result.compiled.contract,
      new Map([[result.compiled.contract.id, result.compiled.contract]]), result.problems, new Map(result.compiled.assets));
    if (!result.problems.length) result.status = 'compiled-draft';
  } catch (e) { result.problems.push(e instanceof Error ? e.message : String(e)); }
  return result;
}
