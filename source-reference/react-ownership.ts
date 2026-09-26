import type {ReactRenderGraphHost} from './react-render-graph-runtime.js';
import { flatten, type CapturedNode } from "../extract/computed/lib.js";
/** Version-bounded read-only renderer observation. It never selects a component
 * by display name, changes source files, injects DOM attributes, or accepts a
 * contract. The host must compare this separate observation render to originals.
 * Protocol reference: react/packages/react-devtools-shared/src/hook.js.
 */
import path from "node:path";
import type {ReactElementCreationSite,ReactElementLineage} from './react-element-creation.js';
import type {ReactElementInvocation} from './react-element-invocation.js';
import {
  buildReactReference,
  reactReferenceUnchanged,
  type ReactReference,
} from "./react-reference.js";
import {
  reactSourceProgramUnchanged,
  type ReactSourceProgram,
} from "./react-source-program.js";

export function reactOwnershipEntry(
  root: string,
  original: ReactReference,
  program: ReactSourceProgram,
) {
  if (
    !reactReferenceUnchanged(original) ||
    !reactSourceProgramUnchanged(program) ||
    program.problems.length
  )
    throw Error("react-ownership-source-changed-or-unreadable");
  const entries = program.components.map((c) => {
    const file = path.resolve(root, c.module);
    if (
      original.files[file] !== c.sourceSha256 ||
      !file.startsWith(path.resolve(root) + path.sep)
    )
      throw Error("react-ownership-source-not-in-reference");
    return {
      module: c.module,
      exportName: c.exportName,
      sourceSha256: c.sourceSha256,
      span: c.span,
      runtimeObservationOnly: c.problems.includes('runtime-export-binding-only'),
    };
  });
  if (
    new Set(entries.map((c) => JSON.stringify([c.module, c.exportName])))
      .size !== entries.length
  )
    throw Error("react-ownership-duplicate-export");
  const modules = [...new Set(entries.map((c) => c.module))];
  // The observed program is the original's own cohort entry plus read-only
  // export identities. The cohort is never re-read from disk here.
  const entry =
    original.cohort.entry +
    "\n" +
    modules
      .map(
        (m, i) =>
          `import * as __dscModule${i} from ${JSON.stringify("./" + m)};`,
      )
      .join("\n") +
    "\nwindow.__DSC_REACT_EXPORTS = [" +
    entries
      .map(
        ({runtimeObservationOnly,...c}) =>
          `{identity:${JSON.stringify(c)},value:__dscModule${modules.indexOf(c.module)}[${JSON.stringify(c.exportName)}]${runtimeObservationOnly?',runtimeObservationOnly:true':''}}`,
      )
      .join(",") +
    "];\nwindow.__DSC_REACT_CLONE_ELEMENT = React.cloneElement;";
  return entry;
}

export async function buildReactOwnershipReference(
  root: string,
  original: ReactReference,
  program: ReactSourceProgram,
  observer?: Parameters<typeof buildReactReference>[3],
) {
  const entry = reactOwnershipEntry(root, original, program);
  const reference = await buildReactReference(root, original.cohort, entry, observer);
  if (
    JSON.stringify(reference.files) !== JSON.stringify(original.files) ||
    !reactSourceProgramUnchanged(program)
  )
    throw Error("react-ownership-reference-inputs-differ");
  return reference;
}

/** Installed before source code in a new isolated browser context. This is a
 * bounded adapter for the verified renderer version, not a stable React API. */
export const reactOwnershipHook = `(() => {
 if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) throw Error('react-ownership-existing-hook');
 const renderers=new Map(), roots=new Map();let next=0, revision=0;
 const hook={supportsFiber:true,renderers,
  inject(renderer){const id=++next;renderers.set(id,renderer);return id;},
  onCommitFiberRoot(id,root,_priority,didError){roots.set(root,{id,root,didError,revision:++revision});},
  onCommitFiberUnmount(){},onPostCommitFiberRoot(){}
 };
 Object.defineProperty(window,'__REACT_DEVTOOLS_GLOBAL_HOOK__',{value:hook});
 window.__DSC_REACT_OWNERSHIP = {renderers,roots};
})();`;

export interface ReactOwnership {
  version: 1;
  rendererVersions: string[];
  components: Array<{
    id: string;
    source: {
      module: string;
      exportName: string;
      sourceSha256: string;
      span: { start: number; end: number };
    };
    parent?: string;
    props: Record<string, unknown>;
    roots: string[];
  }>;
  /** Registered render ancestors outside the selected DOM subtree. They are
   * context, not generated component roots; parent links are never erased. */
  ancestors?: Array<Omit<ReactOwnership['components'][number], 'roots'> & {
    hostAncestor: { tag: string; distance: number };
  }>;
  nodes: Array<{
    path: string;
    tag: string;
    nearestComponent?: string;
    createdBy?: string;
    /** Exact current factory invocation only; does not prove source semantics. */
    creationSite?: ReactElementCreationSite;
    creationInvocation?: ReactElementInvocation;
    creationLineage?: ReactElementLineage;
    renderGraph?: ReactRenderGraphHost;
  }>;
  problems: string[];
}
/** Different observers retain different factory journals. Pair their complete
 * renderer/source/props/host structure separately; retain and hash both full
 * observations so this comparison never authenticates the omitted journals. */
/** The case subject among the components that own the rendered root. Ownership
 * traces into dependencies, so a library primitive (e.g. Radix Switch.Root) can
 * share the root with the workspace component that renders it; the subject is
 * the OUTERMOST owner. Unrelated owners are returned together so callers refuse. */
export function outermostRootOwners<T extends { id: string; parent?: string | null; roots: string[] }>(components: T[]): T[] {
  const owners = components.filter(c => c.roots.includes(''));
  return owners.filter(c => !owners.some(o => o.id === c.parent));
}
export function reactOwnershipStructure(ownership:ReactOwnership):ReactOwnership {
  return {...ownership,nodes:ownership.nodes.map(({creationSite:_site,creationInvocation:_invocation,creationLineage:_lineage,renderGraph:_graph,...node})=>node)};
}
/** Element-index paths match flatten(CapturedNode) under the selected root.
 * Unknown owner/portal/renderer states are kept as problems, never guessed. */
export const reactOwnershipRead = (selector: string, renderGraph = false) => `(() => {
 const state=window.__DSC_REACT_OWNERSHIP, exports=window.__DSC_REACT_EXPORTS;
 const out={version:1,rendererVersions:[],components:[],nodes:[],problems:[]};
 const fail=code=>{out.problems.push(code);return out;};
 if(!state||!Array.isArray(exports))return fail('react-ownership-instrumentation-missing');
 const values=new Map(),runtimeValues=new Set();for(const entry of exports){
  if(!entry.value)return fail('react-ownership-export-missing');
  if(entry.runtimeObservationOnly){
   if(!['function','object'].includes(typeof entry.value))return fail('react-ownership-runtime-export-not-component');
   runtimeValues.add(entry.value);
  }
  if(values.has(entry.value))return fail('react-ownership-export-alias-ambiguous');
  values.set(entry.value,entry.identity);
 }
 out.rendererVersions=[...state.renderers.values()].map(r=>r.version);
 if(out.rendererVersions.length!==1||!['19.2.4','19.2.7'].includes(out.rendererVersions[0]))return fail('react-ownership-renderer-unsupported');
 const committed=[...state.roots.values()].filter(r=>r.root.current?.child);
 if(committed.length!==1||committed[0].didError)return fail('react-ownership-root-ambiguous-or-failed');
 const selected=document.querySelector(${JSON.stringify(selector)});
 if(!selected)return fail('react-ownership-selected-root-missing');
 const paths=new Map();const map=(node,path)=>{paths.set(node,path);if(node.shadowRoot||node.localName.includes('-'))out.problems.push('react-ownership-custom-element-boundary:'+path);[...node.children].forEach((child,i)=>map(child,path===''?String(i):path+'.'+i));};map(selected,'');
 const fibers=new Map(),hostFibers=new Map(),componentHosts=new Map();let sequence=0;
 const plainProps=props=>Object.fromEntries(Object.entries(props||{}).map(([key,value])=>[key,
  value===null||['string','number','boolean'].includes(typeof value)?value:
  value===undefined?{kind:'undefined'}:typeof value==='function'?{kind:'function'}:
  {kind:Array.isArray(value)?'array':'object'}]));
 const walk=(fiber,parent)=>{for(let node=fiber;node;node=node.sibling){
  const value=values.has(node.elementType)?node.elementType:node.type;
  let identity=values.get(value);
  // A runtime export can be a host tag or context provider. An unresolved
  // source binding does not make it a component. These are the committed
  // function/class/forwardRef/memo tags in the supported renderer versions.
  if(identity&&runtimeValues.has(value)&&![0,1,11,14,15].includes(node.tag)){
   out.problems.push('react-ownership-runtime-boundary-kind-unsupported');identity=undefined;
  }
  let current=parent;
  if(identity){const component={id:'instance-'+sequence++,source:identity,...(parent?{parent}:{}),props:plainProps(node.memoizedProps),roots:[]};
   out.components.push(component);fibers.set(node,component.id);current=component.id;}
  if(node.stateNode instanceof Element){
   if(hostFibers.has(node.stateNode))out.problems.push('react-ownership-duplicate-host');
   hostFibers.set(node.stateNode,{fiber:node,nearestComponent:current});
  }
  if(node.child)walk(node.child,current);
 }};walk(committed[0].root.current,undefined);
 for(const [element,path] of paths){
  const host=hostFibers.get(element);if(!host){out.problems.push('react-ownership-dom-without-fiber:'+path);continue;}
  // React can retain a host's creation owner in the other buffer when only a
  // descendant renders. Accept only a reciprocal alternate of a known current
  // fiber; never infer source ownership from a name or the nearest component.
  const owner=host.fiber._debugOwner;
  const createdBy=fibers.get(owner)??(owner?.alternate?.alternate===owner?fibers.get(owner.alternate):undefined);
  const creationSite=window.__DSC_ELEMENT_CREATION?.read(host.fiber);
  const creationInvocation=window.__DSC_ELEMENT_CREATION?.readInvocation(host.fiber);
  const creationLineage=window.__DSC_ELEMENT_CREATION?.readLineage(host.fiber);
  const renderGraph=${renderGraph?'window.__DSC_RUNTIME_PROOF?.renderGraphHost(host.fiber.memoizedProps,host.fiber.type,owner,owner?.alternate?.alternate===owner?owner.alternate:undefined)':'undefined'};
  out.nodes.push({path,tag:element.localName.toLowerCase(),...(host.nearestComponent?{nearestComponent:host.nearestComponent}:{}),...(createdBy?{createdBy}:{}),...(creationSite?{creationSite}:{}),...(creationInvocation?{creationInvocation}:{}),...(creationLineage?{creationLineage}:{}),...(renderGraph?{renderGraph}:{})});
 }
 // Roots are actual topmost DOM descendants of each exported instance, not
 // class/attribute matches. Multiple roots and co-owned wrapper roots survive.
 for(const [fiber,id] of fibers){const c=out.components.find(c=>c.id===id);
  const hosts=[];
  const visit=node=>{for(let n=node;n;n=n.sibling){if(n.stateNode instanceof Element){hosts.push(n.stateNode);if(paths.has(n.stateNode))c.roots.push(paths.get(n.stateNode));}else if(n.child)visit(n.child);}};
  visit(fiber.child);componentHosts.set(id,hosts);
 }
 const all=new Map(out.components.map(c=>[c.id,c]));
 out.components=out.components.filter(c=>c.roots.length);
 const ids=new Set(out.components.map(c=>c.id)),external=new Set();
 // Preserve only actual registered ancestors of selected instances. Each must
 // have one enclosing host; fragments, sibling roots and portal escapes are
 // not an enclosing render context. No display name or selector proves this.
 for(const c of out.components){let parent=c.parent;const seen=new Set([c.id]);
  while(parent){if(seen.has(parent)||!all.has(parent)){out.problems.push('react-ownership-parent-unresolved:'+c.id);break;}
   seen.add(parent);if(!ids.has(parent))external.add(parent);parent=all.get(parent).parent;
  }
 }
 const ancestors=[];
 for(const [id,c] of all){if(!external.has(id))continue;
  const hosts=componentHosts.get(id),enclosing=hosts?.length===1?hosts[0]:undefined;
  let distance=0;for(let node=selected;node&&node!==enclosing;node=node.parentElement)distance++;
  if(!enclosing||enclosing===selected||!enclosing.contains(selected)){
   out.problems.push('react-ownership-parent-outside-selection:'+id);continue;
  }
  // An ancestor's unselected descendants may exist within its enclosing host,
  // but may not escape it through portals or a reparented DOM subtree.
  for(const [element,host] of hostFibers){let owner=host.nearestComponent;const seen=new Set();
   while(owner&&!seen.has(owner)){seen.add(owner);if(owner===id){if(!enclosing.contains(element))out.problems.push('react-ownership-ancestor-host-outside-container:'+id);break;}owner=all.get(owner)?.parent;}
  }
  const {roots,...identity}=c;ancestors.push({...identity,hostAncestor:{tag:enclosing.localName.toLowerCase(),distance}});
 }
 if(ancestors.length)out.ancestors=ancestors;
 const ancestorIds=new Set(ancestors.map(c=>c.id));
 // A registered descendant is still part of its selected ancestor. Following
 // that chain prevents an exported portal child from hiding an outside host.
 for(const [element,host] of hostFibers){if(paths.has(element))continue;
  let owner=host.nearestComponent;const seen=new Set();
  while(owner&&!seen.has(owner)){seen.add(owner);if(ids.has(owner)){out.problems.push('react-ownership-host-outside-selection:'+owner);break;}owner=all.get(owner)?.parent;}
 }
 for(const c of out.components)if(c.parent&&!ids.has(c.parent)&&!ancestorIds.has(c.parent))out.problems.push('react-ownership-parent-outside-selection:'+c.id);
 return out;
})()`;

/** The compiler reader can exclude nodes such as non-painting SVG metadata.
 * Never join using browser child indices unless the entire path/tag census
 * agrees with the actual captured tree. A mismatch requires explicit lowering. */
export function reactOwnershipMatchesTree(
  ownership: ReactOwnership,
  tree: CapturedNode,
): boolean {
  return (
    JSON.stringify(ownership.nodes.map(({ path, tag }) => ({ path, tag }))) ===
    JSON.stringify(
      flatten(tree).map(({ path, node }) => ({ path, tag: node.tag })),
    )
  );
}
