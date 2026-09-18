import { flatten, type CapturedNode } from "../extract/computed/lib.js";
/** Version-bounded read-only renderer observation. It never selects a component
 * by display name, changes source files, injects DOM attributes, or accepts a
 * contract. The host must compare this separate observation render to originals.
 * Protocol reference: react/packages/react-devtools-shared/src/hook.js.
 */
import path from "node:path";
import {
  buildReactReference,
  reactReferenceUnchanged,
  type ReactReference,
} from "./react-reference.js";
import {
  reactSourceProgramUnchanged,
  type ReactSourceProgram,
} from "./react-source-program.js";

export async function buildReactOwnershipReference(
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
        (c) =>
          `{identity:${JSON.stringify(c)},value:__dscModule${modules.indexOf(c.module)}[${JSON.stringify(c.exportName)}]}`,
      )
      .join(",") +
    "];\nwindow.__DSC_REACT_CLONE_ELEMENT = React.cloneElement;";
  const reference = await buildReactReference(root, original.cohort, entry);
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
  nodes: Array<{
    path: string;
    tag: string;
    nearestComponent?: string;
    createdBy?: string;
  }>;
  problems: string[];
}
/** Element-index paths match flatten(CapturedNode) under the selected root.
 * Unknown owner/portal/renderer states are kept as problems, never guessed. */
export const reactOwnershipRead = (selector: string) => `(() => {
 const state=window.__DSC_REACT_OWNERSHIP, exports=window.__DSC_REACT_EXPORTS;
 const out={version:1,rendererVersions:[],components:[],nodes:[],problems:[]};
 const fail=code=>{out.problems.push(code);return out;};
 if(!state||!Array.isArray(exports))return fail('react-ownership-instrumentation-missing');
 const values=new Map();for(const entry of exports){
  if(!entry.value)return fail('react-ownership-export-missing');
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
 const fibers=new Map(),hostFibers=new Map();let sequence=0;
 const plainProps=props=>Object.fromEntries(Object.entries(props||{}).map(([key,value])=>[key,
  value===null||['string','number','boolean'].includes(typeof value)?value:
  value===undefined?{kind:'undefined'}:typeof value==='function'?{kind:'function'}:
  {kind:Array.isArray(value)?'array':'object'}]));
 const walk=(fiber,parent)=>{for(let node=fiber;node;node=node.sibling){
  const identity=values.get(node.elementType)||values.get(node.type);
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
  out.nodes.push({path,tag:element.localName.toLowerCase(),...(host.nearestComponent?{nearestComponent:host.nearestComponent}:{}),...(createdBy?{createdBy}:{})});
 }
 // Roots are actual topmost DOM descendants of each exported instance, not
 // class/attribute matches. Multiple roots and co-owned wrapper roots survive.
 for(const [fiber,id] of fibers){const c=out.components.find(c=>c.id===id);
  const visit=node=>{for(let n=node;n;n=n.sibling){if(n.stateNode instanceof Element){if(paths.has(n.stateNode))c.roots.push(paths.get(n.stateNode));}else if(n.child)visit(n.child);}};
  visit(fiber.child);
 }
 out.components=out.components.filter(c=>c.roots.length);
 const ids=new Set(out.components.map(c=>c.id));
 for(const [element,host] of hostFibers)if(ids.has(host.nearestComponent)&&!paths.has(element))out.problems.push('react-ownership-host-outside-selection:'+host.nearestComponent);
 for(const c of out.components)if(c.parent&&!ids.has(c.parent))out.problems.push('react-ownership-parent-outside-selection:'+c.id);
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
