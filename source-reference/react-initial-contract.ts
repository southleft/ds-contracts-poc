/** Assemble a complete observed initial-state domain through the shared computed
 * compiler. Runtime behavior and reusable child identities are separate work. */
import { revisionOf } from '../core/contract-provenance.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { enumerate, comboKey, normalizeValue, type CapturedNode } from '../extract/computed/lib.js';
import type { PropSpace, SweepResult } from '../extract/computed/capture.js';
import type { ReactSourceProgram } from './react-source-program.js';
import type { ReactOwnership } from './react-ownership.js';
import type { ReactPropertySnapshot } from './react-root-variants.js';
import type { TextFontEvidence } from './text-fonts.js';
import type { SvgViewportEvidence } from './svg-viewports.js';
import { classifyReactProperty } from './react-program-proposal.js';
import { planReactInitialStates, type observeReactInitialStates } from './react-initial-state.js';
import { prepareObservedContentTree, compileObservedContentSweep } from './observed-content.js';
import { evidenceSha } from './react-validation-evidence.js';
import { validateContract } from '../packages/core/src/validate.js';

type Snapshot = ReactPropertySnapshot & { fonts: TextFontEvidence; svg: SvgViewportEvidence };
export function compileReactInitialContract(program: ReactSourceProgram, ownership: ReactOwnership, tree: CapturedNode,
  observation: Awaited<ReturnType<typeof observeReactInitialStates>>, snapshots: Record<string, Snapshot>) {
  const result = { version: 1 as const, qualification: 'observed-initial-state-contract' as const,
    acceptedContract: null, nativeQualification: 'unqualified' as const, status: 'refused' as 'refused' | 'compiled-draft',
    problems: [] as string[], limitations: ['observed-initial-inputs-only', 'runtime-interactions-not-projected',
      'nested-component-identity-not-projected', 'source-token-identities-not-retained', 'native-output-not-verified'],
    compiled: undefined as ReturnType<typeof compileObservedContentSweep> | undefined };
  try {
    const expected = planReactInitialStates(program, ownership, tree, observation.instanceId);
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
    const roots = new Map<string, CapturedNode>(), sizes = new Map<string, Set<string>>();
    for (const row of observation.rows) {
      const snap = snapshots[row.id];
      if (row.status !== 'observed' || !row.restored || !snap || snap.image !== row.image || snap.treeSha256 !== row.treeSha256 ||
          evidenceSha(JSON.stringify(snap.tree)) !== row.treeSha256 || snap.ownership.problems.length)
        throw Error('react-initial-contract-observation-unverified');
      const instance = snap.ownership.components.find(c => c.id === observation.instanceId);
      if (!instance || revisionOf(instance.source) !== revisionOf(expected.source) || instance.roots.length !== 1 || instance.roots[0] !== '')
        throw Error('react-initial-contract-source-root-mismatch');
      if (snap.ownership.components.length !== 1) throw Error('react-initial-contract-nested-identity-unqualified');
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
      const root = prepareObservedContentTree(snap.tree, snap.fonts, snap.svg);
      const origin = snap.styleOrigin.roots.find(r => r.path === '' && r.tag === root.tag);
      for (const channel of ['width', 'height']) {
        const size = origin?.sizes?.find(s => s.channel === channel);
        if (size?.status !== 'fixed' || !size.value || normalizeValue(size.value) !== root.style[channel])
          throw Error('react-initial-contract-root-sizing-unqualified:' + channel);
        const values = sizes.get(channel) ?? new Set<string>(); values.add(root.style[channel]); sizes.set(channel, values);
      }
      // CSS normal gaps have zero used value in non-multicol flex containers.
      if (['flex', 'inline-flex'].includes(root.style.display)) for (const channel of ['row-gap', 'column-gap'])
        if (root.style[channel] === 'normal') root.style[channel] = '0px';
      roots.set(key, root);
    }
    if (enumeration.combos.some(c => !roots.has(c.key)) || new Set([...roots.values()].map(r => r.tag)).size !== 1)
      throw Error('react-initial-contract-host-or-domain-changed');
    const suffix = revisionOf({ source: expected.source, axes, observations: observation.rows }).slice(7, 23), name = `InitialStates${suffix}`;
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
      { captures: enumeration.combos.map(c => ({ combo: `${name}:${c.key}`, interaction: 'default', root: roots.get(c.key)! })) } as SweepResult, [...sizes.keys()]);
    result.problems.push(...result.compiled.problems);
    if (result.compiled.contract) validateContract(result.compiled.contract,
      new Map([[result.compiled.contract.id, result.compiled.contract]]), result.problems, new Map(result.compiled.assets));
    if (!result.problems.length) result.status = 'compiled-draft';
  } catch (e) { result.problems.push(e instanceof Error ? e.message : String(e)); }
  return result;
}
