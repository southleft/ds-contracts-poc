/** Observed root projections, not reusable source contracts. The source API,
 * behavior, caller composition and unobserved planes remain separate work. */
import { observeReactSourceBindings } from './react-source-bindings.js';
import type { ReactStyleOrigin, ReactSizeOrigin } from './react-style-origin.js';
import { revisionOf } from '../core/contract-provenance.js';
import { createFigmaEngine, type ComponentData } from '../core/emit-figma-script.js';
import { mintTokens } from '../core/mint-tokens.js';
import { validateContract } from '../packages/core/src/validate.js';
import { ContractSchema, DECLARED_CHANNELS, LITERAL_CHANNELS, type Contract } from '../scripts/contract-schema.js';
import { enrichLayout, prepareMint, applyMintToContract, type AlignedSweep } from '../extract/computed/fuse.js';
import { enumerate, isFusable, normalizeValue, CHANNEL_TO_COMPUTED, type CapturedNode, type Capture, type FlatEl } from '../extract/computed/lib.js';
import type { PropSpace } from '../extract/computed/capture.js';
import { linkReactSourceAnatomy } from './react-source-anatomy.js';
import type { ReactOwnership } from './react-ownership.js';
import type { ReactSourceProgram } from './react-source-program.js';

export interface ReactRootVisual {
  version: 1;
  qualification: 'observed-root-only';
  acceptedContract: null;
  inputRevision: string;
  roots: Array<{
    instanceId: string;
    source: ReactOwnership['components'][number]['source'];
    status: 'refused' | 'style-prepared' | 'native-compiled';
    /** Only the observed box. Never adopt as the source component's API. */
    contract?: Contract;
    tokens?: Record<string, unknown>;
    native?: ComponentData;
    channels: Array<{ channel: string; status: 'observed' | 'excluded'; reason: string }>;
    sourceSizing?: ReactSizeOrigin[];
    sourceBindings?: Array<{channel: string; variable?: string; tokenPath?: string; reason?: string}>;
    residuals?: ReturnType<typeof prepareMint>['codeOnly'];
    problems: string[];
    limitations: string[];
  }>;
  problems: string[];
}
const vocabulary = new Set([
  ...LITERAL_CHANNELS, ...Object.keys(DECLARED_CHANNELS), ...Object.values(CHANNEL_TO_COMPUTED).flat(),
  'display', 'flex-direction', 'align-items', 'justify-content', 'flex-wrap',
]);
const sampleGeometry = /^(?:(?:min-|max-)?(?:width|height)|margin(?:-|$)|inset(?:-|$)|top$|right$|bottom$|left$|translate(?:-|$)|transform(?:-|$)|flex-basis$)/;
const exclusion = (channel: string): string | undefined => channel.startsWith('--')
  ? 'custom-property-environment-is-not-a-binding'
  : sampleGeometry.test(channel) ? 'sample-geometry-needs-source-constraint'
  : !isFusable(channel) ? 'existing-fusion-exclusion'
  : !vocabulary.has(channel) ? 'outside-visual-channel-vocabulary' : undefined;

/** The host authenticates the paired observation first. Repeat the source join
 * here rather than accepting an HTTP-supplied matched/linked flag. No sample
 * descendants, synthesized public axes, authored token names or behavior are
 * inferred from these measured values. Every instance stays in the result. */
export function projectReactRootVisual(
  program: ReactSourceProgram,
  ownership: ReactOwnership,
  tree: CapturedNode,
  styleOrigin?: ReactStyleOrigin,
  instanceIds?: ReadonlySet<string>,
): ReactRootVisual {
  const out: ReactRootVisual = { version: 1, qualification: 'observed-root-only', acceptedContract: null,
    inputRevision: revisionOf({ program, ownership, tree, ...(styleOrigin ? {styleOrigin} : {}) }), roots: [], problems: [] };
  const anatomy = linkReactSourceAnatomy(program, ownership, tree);
  if (anatomy.status !== 'linked') { out.problems = [...anatomy.problems]; return out; }
  for (const instance of anatomy.instances) {
    // A child operation needs this root only. Still authenticate the complete
    // source/ownership join above and retain the same whole-input revision.
    if (instanceIds && !instanceIds.has(instance.instanceId)) continue;
    const result: ReactRootVisual['roots'][number] = { instanceId: instance.instanceId,
      source: structuredClone(instance.source), status: 'refused', channels: [], problems: [],
      limitations: [...instance.problems, 'source-api-and-behavior-not-projected',
        'observed-case-only-not-all-property-planes', 'provisional-values-not-authored-token-bindings',
        'caller-composition-not-assembled', 'native-fidelity-not-verified'] };
    out.roots.push(result);
    try {
      if (instance.content !== 'caller-slot' || instance.roots.length !== 1 ||
          instance.roots[0].correspondence === 'runtime-dependent')
        throw Error('react-root-visual-source-content-unqualified');
      const observation = instance.roots[0].observation;
      if (Object.keys(observation.pseudo).length) throw Error('react-root-visual-pseudo-content-unprojected');
      const root: CapturedNode = { ...structuredClone(observation), nodes: [],
        style: Object.fromEntries(Object.entries(observation.style).map(([key, value]) => [key, normalizeValue(value)])) };
      const suffix = revisionOf({ source: instance.source, observation }).slice(7, 23);
      const name = `ObservedRoot${suffix}`;
      const contract = ContractSchema.parse({ id: `observed.react-${suffix}`, name, version: '0.1.0', status: 'draft',
        description: 'Observed source root only; API, behavior and composition are not projected.',
        props: [], states: [], semantics: { element: root.tag }, anatomy: { root: { slot: { name: 'children' } } },
        bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } },
          code: { anchors: { importPath: `observed/${suffix}`, export: name } } } });
      const enumeration = enumerate([], [], 1, {}), combo = enumeration.combos[0].key;
      const capture: Capture = { combo, interaction: 'default', root };
      const flat: FlatEl = { path: '', sig: 'root', partName: 'root', node: root };
      const aligned: AlignedSweep = { captures: [capture], byKey: new Map([[`${combo}__default`, capture]]),
        base: capture, baseFlat: [flat], inBase: [true], partNames: ['root'],
        union: { entries: [{ id: 0, sig: 'root', rep: root, repPath: '', repKey: '', inBase: true,
          parent: null, children: [], partName: 'root' }], alignedByKey: new Map([[`${combo}__default`, [flat]]]), receipts: [] },
        getAligned: key => key === `${combo}__default` ? [flat] : [null],
        structureReceipts: [], anatomyJoin: [{ part: 'root', join: 'matched' }], staticOnlyParts: [] };
      const space: PropSpace = { contract, axes: [], presence: new Map(), stateProps: [], enumeration,
        baseComboKey: combo, baseAxisValues: {}, heldFixed: [] };
      const channels = new Set<string>();
      for (const channel of Object.keys(root.style).sort()) {
        const reason = exclusion(channel);
        result.channels.push({ channel, status: reason ? 'excluded' : 'observed', reason: reason ?? 'measured-value-only' });
        if (!reason) channels.add(channel);
      }
      const styled = new Map([['root', channels]]);
      const layout = enrichLayout(aligned, space, styled, contract);
      if (layout.contradictions.length) throw Error('react-root-visual-layout-contradiction');
      const prep = prepareMint(aligned, { name, importName: name, contract: '', sampleText: '', axes: [] },
        space, styled, [], layout.handled, contract);
      const minted = mintTokens(name, prep.baseObs, prep.axes, { nestedPairs: true });
      const states = mintTokens(name, prep.stateObs, prep.axes, { nestedPairs: true });
      const applied = applyMintToContract(contract, space, minted, prep.baseObs, states, prep.stateObs,
        layout.enriched, prep.declared, prep.declaredStates, prep.setPlaneLiterals,
        { only: prep.inheritanceOnly, stateDeltas: prep.inheritanceStateDeltas }, prep.stateCodeOnly);
      const enriched = ContractSchema.parse(applied.enriched);
      if (enriched.props.length || enriched.states.length || enriched.anatomy.root.parts || enriched.anatomy.root.content ||
          enriched.anatomy.root.slot?.name !== 'children') throw Error('react-root-visual-content-boundary-changed');
      const tokens = structuredClone(minted.tree);
      if (styleOrigin) {
        if (styleOrigin.version !== 1) throw Error('react-root-visual-style-origin-version');
        const origin = styleOrigin.roots.find(r => r.path === instance.roots[0].path);
        if (!origin || origin.tag !== root.tag) throw Error('react-root-visual-style-origin-mismatch');
        const props=ownership.components.find(c=>c.id===instance.instanceId)!.props;
        const callerStyle=['style','className'].some(key=>Object.hasOwn(props,key)&&props[key]!==null&&props[key]!==''&&JSON.stringify(props[key])!==JSON.stringify({kind:'undefined'}));
        result.sourceSizing=origin.sizes?.map(size=>callerStyle
          ? {...size,status:'unresolved',reason:'caller-style-input-needs-ownership-proof'}
          : size.status==='fixed'&&normalizeValue(size.value??'')!==root.style[size.channel]
            ? {...size,status:'unresolved',reason:'size-observation-mismatch'} : size);
        const bindings = observeReactSourceBindings(root, enriched.anatomy.root, tokens, styleOrigin, instance.roots[0].path);
        result.sourceBindings = bindings.sourceBindings;
        for (const binding of bindings.sourceBindings) if (binding.tokenPath)
          enriched.anatomy.root.tokens![binding.channel] = '{' + binding.tokenPath + '}';
        if (bindings.tokens.source) tokens.source = bindings.tokens.source;
        result.limitations.push('source-variable-bindings-current-case-only', 'source-variable-modes-and-aliases-not-assembled');
      }
      const errors: string[] = [];
      validateContract(enriched, new Map([[enriched.id, enriched]]), errors, new Map());
      if (errors.length) throw Error(`react-root-visual-contract-invalid: ${errors.join('; ')}`);
      result.contract = enriched;
      result.tokens = tokens;
      result.residuals = [...prep.codeOnly, ...prep.stateCodeOnly];
      result.status = 'style-prepared';
      const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
      result.native = engine.compileComponentData(enriched, new Map([[enriched.id, enriched]]));
      result.status = 'native-compiled';
    } catch (error) {
      result.problems.push(error instanceof Error ? error.message : String(error));
    }
  }
  return out;
}

/** Shared channel boundary for multi-observation root style assembly. */
export { exclusion as reactRootStyleExclusion };
