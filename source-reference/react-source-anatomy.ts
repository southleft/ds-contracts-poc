import { flatten, type CapturedNode } from '../extract/computed/lib.js';
import { reactOwnershipMatchesTree, type ReactOwnership } from './react-ownership.js';
import type { ReactRootFact, ReactSourceProgram } from './react-source-program.js';
import {verifiedReactContextualContent,type ReactContextualContent} from './react-contextual-content.js';

export interface ReactSourceAnatomy {
  version: 1;
  status: 'linked' | 'refused';
  acceptedContract: null;
  /** Observed structure only. Computed values are not authored token bindings. */
  qualification: 'observed-source-correspondence';
  ancestors?: ReactOwnership['ancestors'];
  instances: Array<{
    instanceId: string;
    source: ReactOwnership['components'][number]['source'];
    parentInstanceId?: string;
    /** A recorded enclosing context, not a component inside this selection. */
    ancestorInstanceId?: string;
    roots: Array<{
      path: string;
      tag: string;
      correspondence: 'source-host' | 'observed-host-branch' | 'delegated-host' | 'runtime-dependent';
      /** The source-owned box, without sample children or sample text. The
       * computed style remains measured evidence, never a reusable rule. */
      observation: Omit<CapturedNode, 'nodes'>;
    }>;
    content: 'caller-slot' | 'nested-caller-slot' | 'authored-or-runtime' | 'unresolved';
    contentContext?: {revision:string;helperId:string};
    /** Actual same-host implementation chain, including this public instance.
     * Every instance and creator remains in the observation. */
    rootDelegation?: { instanceIds: string[]; hostOwner: string; forwardsChildren: boolean };
    /** Observed host container for a proved nested input. Root-only consumers
     * must not discard its surrounding source-owned hosts. */
    callerSlotPath?: string;
    /** Paths are addresses in this observation, not permanent part names. */
    sourceOwnedPaths: string[];
    callerContentPaths: string[];
    runtimeDependentPaths: string[];
    dependencies: Array<{ instanceId: string; roots: string[]; placement: 'caller-content' | 'root-delegation' | 'authored-or-runtime' }>;
    problems: string[];
  }>;
  problems: string[];
}

const contains = (root: string, path: string) => root === '' || path === root || path.startsWith(root + '.');
const hostBranches = (root: ReactRootFact): string[] => root.kind === 'host' && root.name
  ? [root.name]
  : root.kind === 'conditional'
    ? [root.whenTrue, root.whenFalse].flatMap(branch => branch ? hostBranches(branch) : [])
    : [];
const identity = (source: ReactOwnership['components'][number]['source']) => JSON.stringify([
  source.module, source.exportName, source.sourceSha256, source.span.start, source.span.end,
]);

/** Logical component boundaries exclude only proved same-host implementation
 * instances. Unqualified chains remain visible and cannot become composition. */
export function reactCompositionInstances(anatomy: ReactSourceAnatomy) {
  const implementations = new Set(anatomy.instances.filter(i => i.content === 'caller-slot' && i.rootDelegation?.forwardsChildren)
    .flatMap(i => i.rootDelegation!.instanceIds.slice(1)));
  return anatomy.instances.filter(i => !implementations.has(i.instanceId));
}

/** Only hosts whose nested source path has already been proved need extra
 * style observations. Existing root-only captures keep their exact scope. */
export function nestedReactHostPaths(program: ReactSourceProgram, ownership: ReactOwnership, tree: CapturedNode): string[] {
  const anatomy = linkReactSourceAnatomy(program, ownership, tree);
  return [...new Set(anatomy.instances.filter(instance => instance.content === 'nested-caller-slot')
    .flatMap(instance => instance.sourceOwnedPaths))].sort();
}

/** Joins the installed source program to the actual rendered exports and
 * original captured tree. No names/classes/text are used as matching guesses.
 * The host must first authenticate source/evidence identity and paired-render
 * equality. This pure join repeats the structural checks before projecting. */
export function linkReactSourceAnatomy(
  program: ReactSourceProgram,
  ownership: ReactOwnership,
  tree: CapturedNode,
  contentContext?:ReactContextualContent,
): ReactSourceAnatomy {
  const out: ReactSourceAnatomy = { version: 1, status: 'refused', acceptedContract: null,
    qualification: 'observed-source-correspondence', instances: [], problems: [] };
  function fail(reason: string): never { throw Error(reason); }
  try {
    const contextual=new Map(verifiedReactContextualContent(contentContext,program,ownership,tree).map(fact=>[fact.instanceId,fact]));
    if (program.version !== 1 || ownership.version !== 1 || program.problems.length || ownership.problems.length)
      fail('react-anatomy-source-or-observation-unresolved');
    if (ownership.rendererVersions.length !== 1 || !['19.2.4', '19.2.7'].includes(ownership.rendererVersions[0]))
      fail('react-anatomy-renderer-unsupported');
    if (!reactOwnershipMatchesTree(ownership, tree)) fail('react-anatomy-captured-paths-differ');
    const definitions = new Map(program.components.map(component => [identity(component), component]));
    if (definitions.size !== program.components.length) fail('react-anatomy-source-identity-ambiguous');
    const instances = new Map(ownership.components.map(instance => [instance.id, instance]));
    if (instances.size !== ownership.components.length || !instances.size) fail('react-anatomy-instance-identity-ambiguous');
    const external = new Map((ownership.ancestors ?? []).map(ancestor => [ancestor.id, ancestor]));
    if (external.size !== (ownership.ancestors?.length ?? 0) || [...external.keys()].some(id => instances.has(id)))
      fail('react-anatomy-ancestor-identity-ambiguous');
    for (const ancestor of external.values()) {
      const source = definitions.get(identity(ancestor.source));
      if (!source || !ancestor.hostAncestor || !Number.isInteger(ancestor.hostAncestor.distance) || ancestor.hostAncestor.distance <= 0 ||
          typeof ancestor.hostAncestor.tag !== 'string' || !ancestor.hostAncestor.tag || (source.root.kind === 'host' && source.root.name !== ancestor.hostAncestor.tag) ||
          ('roots' in ancestor) || (ancestor.parent && !external.has(ancestor.parent)))
        fail('react-anatomy-ancestor-context-invalid');
      const parent = ancestor.parent && external.get(ancestor.parent);
      if (parent && parent.hostAncestor.distance < ancestor.hostAncestor.distance)
        fail('react-anatomy-ancestor-containment-mismatch');
    }
    const usedAncestors = new Set<string>();
    const parentOf = (id: string) => (instances.get(id) ?? external.get(id))?.parent;
    const isExternalAncestor = (id: string, owner: string | undefined): boolean => {
      const seen = new Set<string>();
      while (owner && !seen.has(owner)) { seen.add(owner); if (owner === id) return true; owner = parentOf(owner); }
      return false;
    };
    const flat = new Map(flatten(tree).map(element => [element.path, element.node]));
    for (const node of ownership.nodes) {
      if ((node.nearestComponent && !instances.has(node.nearestComponent)) ||
          (node.createdBy && !instances.has(node.createdBy) &&
            !(external.has(node.createdBy) && isExternalAncestor(node.createdBy, node.nearestComponent))))
        fail('react-anatomy-node-owner-missing');
    }
    for (const instance of ownership.components) {
      const source = definitions.get(identity(instance.source));
      if (!source) fail('react-anatomy-source-identity-mismatch');
      if (!source.children) fail('react-anatomy-source-content-facts-missing');
      if (!instance.roots.length || new Set(instance.roots).size !== instance.roots.length)
        fail('react-anatomy-root-identity-ambiguous');
      if (instance.roots.some((root, index) => instance.roots.some((other, otherIndex) =>
        index !== otherIndex && contains(root, other))))
        fail('react-anatomy-roots-overlap');
      const ancestors = new Set([instance.id]);
      let parent = instance.parent;
      while (parent) {
        if (ancestors.has(parent)) fail('react-anatomy-component-cycle');
        ancestors.add(parent);
        const context = external.get(parent);
        if (context) { usedAncestors.add(parent); parent = context.parent; continue; }
        const definition = instances.get(parent);
        if (!definition || !instance.roots.every(path => definition.roots.some(root => contains(root, path))))
          fail('react-anatomy-parent-containment-mismatch');
        parent = definition.parent;
      }
      const roots = instance.roots.map(path => {
        const captured = flat.get(path), observed = ownership.nodes.find(node => node.path === path);
        if (!captured || !observed) fail('react-anatomy-root-missing');
        if (source.root.kind === 'host' && source.root.name !== captured.tag)
          fail('react-anatomy-source-host-contradiction');
        const { nodes: _sampleContent, ...observation } = captured;
        const owned = observed.createdBy === instance.id &&
          source.implementation !== 'unresolved' &&
          !source.problems.includes('component-return-control-flow-unresolved') && hostBranches(source.root).includes(captured.tag);
        return { path, tag: captured.tag,
          correspondence: owned ? source.root.kind === 'host' ? 'source-host' as const : 'observed-host-branch' as const : 'runtime-dependent' as const,
          observation: structuredClone(observation) };
      });
      let content: ReactSourceAnatomy['instances'][number]['content'] = source.children.kind === 'forwarded' && roots.length === 1 && roots[0].correspondence !== 'runtime-dependent'
        ? 'caller-slot' as const : source.children.kind === 'unresolved' ? 'unresolved' as const : 'authored-or-runtime' as const;
      const nodes = ownership.nodes.filter(node => instance.roots.some(root => contains(root, node.path)));
      const contextFact=contextual.get(instance.id);
      if(contextFact){
        if(roots.length!==1||roots[0].correspondence==='runtime-dependent'||roots[0].tag!==contextFact.tag||
          nodes.some(node=>node.path!==roots[0].path&&node.createdBy===instance.id))fail('react-anatomy-contextual-content-root-mismatch');
        content='caller-slot';
      }
      let callerSlotPath: string | undefined;
      if (source.children.kind === 'nested-forwarded') {
        const slot = source.children.nestedSlot;
        if (!slot || !slot.path || roots.length !== 1 || roots[0].correspondence !== 'source-host' ||
            !slot.hosts.length || new Set(slot.hosts.map(host => host.path)).size !== slot.hosts.length ||
            slot.hosts.some(host => !/^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))*$/.test(host.path) && host.path !== ''))
          fail('react-anatomy-nested-slot-source-unqualified');
        const hosts = new Map(slot.hosts.map(host => [host.path, host]));
        if (!hosts.has('') || !hosts.has(slot.path) || slot.hosts.some(host => host.path !== slot.path && contains(slot.path, host.path)))
          fail('react-anatomy-nested-slot-source-unqualified');
        for (const host of slot.hosts) {
          const children = slot.hosts.filter(child => child.path !== '' && child.path.split('.').slice(0, -1).join('.') === host.path);
          if (children.some((child, index) => child.path !== (host.path ? `${host.path}.${index}` : String(index))))
            fail('react-anatomy-nested-slot-source-unqualified');
          if (host.path && !hosts.has(host.path.split('.').slice(0, -1).join('.')))
            fail('react-anatomy-nested-slot-source-unqualified');
        }
        const absolute = (path: string) => [roots[0].path, path].filter(Boolean).join('.');
        callerSlotPath = absolute(slot.path);
        const inside = (path: string) => path !== callerSlotPath && contains(callerSlotPath!, path);
        const shell = nodes.filter(node => !inside(node.path));
        if (shell.length !== slot.hosts.length || slot.hosts.some(host => {
          const node = shell.find(node => node.path === absolute(host.path));
          return !node || node.tag !== host.tag || node.createdBy !== instance.id;
        }) || nodes.some(node => inside(node.path) && node.createdBy === instance.id) ||
            ownership.components.some(child => child.parent === instance.id && !child.roots.every(inside)))
          fail('react-anatomy-nested-slot-observation-mismatch');
        content = 'nested-caller-slot';
      }
      const sourceOwnedPaths = nodes.filter(node => node.createdBy === instance.id).map(node => node.path);
      const callerContentPaths = content === 'caller-slot' ? nodes.filter(node => !instance.roots.includes(node.path) && node.createdBy !== instance.id).map(node => node.path)
        : content === 'nested-caller-slot' ? nodes.filter(node => node.path !== callerSlotPath && contains(callerSlotPath!, node.path)).map(node => node.path) : [];
      const dependencies = ownership.components.filter(child => child.parent === instance.id).map(child => ({
        instanceId: child.id, roots: [...child.roots],
        placement: content === 'caller-slot' || content === 'nested-caller-slot' ? 'caller-content' as const : 'authored-or-runtime' as const,
      }));
      out.instances.push({ instanceId: instance.id, source: structuredClone(instance.source),
        ...(instance.parent ? external.has(instance.parent) ? { ancestorInstanceId: instance.parent } : { parentInstanceId: instance.parent } : {}), roots, content,
        ...(callerSlotPath === undefined ? {} : {callerSlotPath}),
        ...(contextFact?{contentContext:{revision:contentContext!.revision,helperId:contextFact.helperId}}:{}),
        sourceOwnedPaths, callerContentPaths,
        runtimeDependentPaths: nodes.filter(node => !sourceOwnedPaths.includes(node.path) && !callerContentPaths.includes(node.path)).map(node => node.path),
        dependencies, problems: [
          ...source.problems,
          ...(roots.some(root => root.correspondence === 'runtime-dependent') ? ['root-runtime-correspondence-unqualified'] : []),
          ...(roots.some(root => root.correspondence === 'observed-host-branch') ? ['other-root-branches-unqualified'] : []),
          ...(content === 'unresolved' ? ['children-flow-unresolved'] : []),
          ...(contextFact?['caller-content-observed-input-context-only']:[]),
          ...(content === 'nested-caller-slot' ? ['nested-children-lowering-unqualified'] : []),
        ] });
    }
    const linked = new Map(out.instances.map(instance => [instance.instanceId, instance]));
    const resolved = new Set<string>();
    const resolveDelegation = (instance: ReactSourceAnatomy['instances'][number]) => {
      if (resolved.has(instance.instanceId)) return;
      resolved.add(instance.instanceId);
      const source = definitions.get(identity(instance.source))!;
      if (source.root.kind !== 'component' || !source.root.definition || instance.roots.length !== 1) return;
      const refuse = (reason: string) => instance.problems.push(reason);
      if (source.implementation !== 'source-checked' || source.problems.includes('component-return-control-flow-unresolved')) {
        refuse('root-delegation-implementation-unqualified'); return;
      }
      const targetIdentity = identity(source.root.definition);
      if (!definitions.has(targetIdentity) || !source.componentReferences.some(reference => reference.target.definition && identity(reference.target.definition) === targetIdentity)) {
        refuse('root-delegation-source-unqualified'); return;
      }
      const path = instance.roots[0].path;
      const children = out.instances.filter(child => child.parentInstanceId === instance.instanceId && child.roots.some(root => root.path === path));
      if (children.length !== 1 || children[0].roots.length !== 1 || identity(children[0].source) !== targetIdentity) {
        refuse('root-delegation-observation-unqualified'); return;
      }
      const child = children[0];
      resolveDelegation(child);
      const childSource = definitions.get(identity(child.source))!;
      if (childSource.implementation !== 'source-checked' || child.roots[0].correspondence === 'runtime-dependent' || child.roots[0].tag !== instance.roots[0].tag) {
        refuse('root-delegation-host-unqualified'); return;
      }
      const chain = [instance.instanceId, ...(child.rootDelegation?.instanceIds ?? [child.instanceId])];
      const hostOwner = child.rootDelegation?.hostOwner ?? child.instanceId;
      const observed = ownership.nodes.find(node => node.path === path)!;
      if (observed.createdBy !== hostOwner || observed.nearestComponent !== hostOwner) {
        refuse('root-delegation-owner-unqualified'); return;
      }
      const childrenValue = (id: string) => instances.get(id)!.props.children ??
        (Object.hasOwn(instances.get(id)!.props, 'children') ? null : {kind:'undefined'});
      const childrenAgree = JSON.stringify(childrenValue(instance.instanceId)) === JSON.stringify(childrenValue(child.instanceId));
      const forwardsChildren = source.children.kind === 'forwarded' && child.content === 'caller-slot' && childrenAgree;
      instance.rootDelegation = { instanceIds: chain, hostOwner, forwardsChildren };
      instance.roots[0].correspondence = 'delegated-host';
      instance.problems = instance.problems.filter(problem => problem !== 'root-runtime-correspondence-unqualified');
      instance.problems.push('delegated-root-observed-context-only');
      if (linked.get(hostOwner)!.roots[0].correspondence === 'observed-host-branch') instance.problems.push('other-root-branches-unqualified');
      if (forwardsChildren) {
        instance.content = 'caller-slot';
        if(child.contentContext){instance.contentContext={...child.contentContext};instance.problems.push('caller-content-observed-input-context-only');}
        instance.callerContentPaths = [...child.callerContentPaths];
        instance.runtimeDependentPaths = ownership.nodes.filter(node => contains(path, node.path) && node.path !== path && !instance.callerContentPaths.includes(node.path)).map(node => node.path);
      } else {
        if (source.children.kind === 'forwarded' && child.content === 'unresolved') instance.content = 'unresolved';
        instance.problems.push(childrenAgree ? 'root-delegation-content-unqualified' : 'root-delegation-children-observation-mismatch');
      }
      const dependency = instance.dependencies.find(dependency => dependency.instanceId === child.instanceId)!;
      dependency.placement = 'root-delegation';
    };
    for (const instance of out.instances) resolveDelegation(instance);
    if (usedAncestors.size !== external.size) fail('react-anatomy-ancestor-context-unused');
    if (external.size) out.ancestors = structuredClone(ownership.ancestors);
    out.status = 'linked';
  } catch (error) {
    out.instances = [];
    out.problems.push(error instanceof Error ? error.message : String(error));
  }
  return out;
}
