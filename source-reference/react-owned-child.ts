/** Complete source-owned leaf at one authenticated usage. No interaction or
 * wider property domain is inferred from this observed initial rendering. */
import { revisionOf } from '../core/contract-provenance.js';
import { authoredLengthIsUsed } from './layout-unit.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { enumerate, flatten, normalizeValue, type CapturedNode } from '../extract/computed/lib.js';
import type { PropSpace, SweepResult } from '../extract/computed/capture.js';
import { linkReactSourceAnatomy } from './react-source-anatomy.js';
import type { ReactSourceProgram } from './react-source-program.js';
import type { ReactOwnership } from './react-ownership.js';
import type { ReactStyleOrigin } from './react-style-origin.js';
import { prepareObservedContentTree, compileObservedContentSweep } from './observed-content.js';
import { observeReactSourceBindings } from './react-source-bindings.js';
import type { TextFontEvidence } from './text-fonts.js';
import type { SvgViewportEvidence } from './svg-viewports.js';
import type { ReactChildRoot } from './react-child-root.js';

export interface ReactOwnedChildEvidence { fonts: TextFontEvidence; svg: SvgViewportEvidence }
export function deriveReactOwnedChild(program: ReactSourceProgram, ownership: ReactOwnership, tree: CapturedNode,
  styleOrigin: ReactStyleOrigin, instanceId: string, evidence: ReactOwnedChildEvidence): ReactChildRoot {
  const anatomy = linkReactSourceAnatomy(program, ownership, tree);
  const instance = anatomy.instances.find(i => i.instanceId === instanceId);
  const observed = ownership.components.find(i => i.id === instanceId);
  if (anatomy.status !== 'linked' || !instance || !observed?.parent || instance.content !== 'authored-or-runtime' ||
      instance.roots.length !== 1 || instance.dependencies.length || instance.roots[0].path === '')
    throw Error('react-owned-child-leaf-required');
  for (const key of ['style','className']) if (Object.hasOwn(observed.props,key) && observed.props[key] !== null &&
      observed.props[key] !== '' && revisionOf(observed.props[key]) !== revisionOf({kind:'undefined'}))
    throw Error('react-owned-child-caller-style-unqualified');
  const prepared = prepareObservedContentTree(tree,evidence.fonts,evidence.svg);
  const rootPath = instance.roots[0].path;
  const sourceTree = flatten(prepared).find(n => n.path === rootPath)!.node;
  const root = structuredClone(sourceTree);
  const origin = styleOrigin.roots.find(r => r.path === rootPath && r.tag === root.tag);
  for (const channel of ['width','height']) {
    const size = origin?.sizes?.find(s => s.channel === channel);
    if (size?.status !== 'fixed' || !size.value || !authoredLengthIsUsed(size.value, root.style[channel]))
      throw Error('react-owned-child-source-size-required:' + channel);
  }
  if (['flex','inline-flex'].includes(root.style.display)) for (const key of ['row-gap','column-gap'])
    if (root.style[key] === 'normal') root.style[key] = '0px';
  const inputRevision = revisionOf({program,ownership,tree,styleOrigin,instanceId,evidence});
  const suffix = inputRevision.slice(7,23),name = instance.source.exportName;
  const seed = ContractSchema.parse({id:'observed.react-owned-'+suffix,name,version:'0.1.0',status:'draft',
    description:`Observed ${name} at this exact nested usage; other inputs and runtime interactions remain unqualified.`,
    props:[],states:[],semantics:{element:root.tag},anatomy:{root:{}},
    bindings:{code:{anchors:{importPath:'observed/'+suffix,export:name}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
  const enumeration=enumerate([],[],1,{}),key=enumeration.combos[0].key;
  const space:PropSpace={contract:seed,axes:[],presence:new Map(),stateProps:[],enumeration,baseComboKey:key,baseAxisValues:{},heldFixed:[]};
  const compiled=compileObservedContentSweep(space,{name,importName:name,contract:'',sampleText:'',axes:[]},
    {captures:[{combo:name+':'+key,interaction:'default',root}]} as SweepResult,['width','height']);
  if(compiled.problems.length || !compiled.contract || !compiled.tokens || !compiled.component)
    throw Error('react-owned-child-projection-unavailable:'+compiled.problems.join(','));
  const contract=compiled.contract,tokens=compiled.tokens;
  const bindings=observeReactSourceBindings(root,contract.anatomy.root,tokens,styleOrigin,rootPath);
  if(bindings.sourceBindings.some(b=>b.variable&&!b.tokenPath)) throw Error('react-owned-child-source-binding-unresolved');
  for(const binding of bindings.sourceBindings) if(binding.tokenPath)
    (contract.anatomy.root.tokens??={})[binding.channel]='{'+binding.tokenPath+'}';
  if(bindings.tokens.source)tokens.source=bindings.tokens.source;
  const assets=compiled.assets??[];
  const engine=createFigmaEngine({tokens:{primitives:tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(assets)});
  const contracts=new Map([[contract.id,contract]]),native=engine.compileComponentData(contract,contracts);
  // Enforce the same complete-native ownership boundary before offering an action.
  engine.compileNativeContractDraft(contract,contracts,{revision:revisionOf(tree),programSha256:revisionOf(program).slice(7),evidenceRevision:inputRevision});
  return {version:1,qualification:'observed-child-root-draft',acceptedContract:null,inputRevision,instanceId,
    contentMode:'source-owned',sourceOwnedTree:sourceTree,assets,heldProps:structuredClone(observed.props),problems:[],
    draft:{instanceId,source:instance.source,status:'native-compiled',contract,tokens,native,channels:[],
      sourceSizing:origin!.sizes,sourceBindings:bindings.sourceBindings,residuals:compiled.residuals,problems:[],
      limitations:['observed-child-inputs-only','runtime-interactions-not-projected','descendant-source-bindings-not-observed',
        'source-variable-modes-and-aliases-not-assembled','native-fidelity-not-verified']}};
}
