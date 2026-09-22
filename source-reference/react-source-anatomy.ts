import { flatten, type CapturedNode } from '../extract/computed/lib.js';
import { reactOwnershipMatchesTree, type ReactOwnership } from './react-ownership.js';
import type { ReactRootFact, ReactSourceProgram } from './react-source-program.js';

export interface ReactSourceAnatomy {
  version: 1;
  status: 'linked' | 'refused';
  acceptedContract: null;
  /** Observed structure only. Computed values are not authored token bindings. */
  qualification: 'observed-source-correspondence';
  instances: Array<{
    instanceId: string;
    source: ReactOwnership['components'][number]['source'];
    parentInstanceId?: string;
    roots: Array<{
      path: string;
      tag: string;
      correspondence: 'source-host' | 'observed-host-branch' | 'runtime-dependent';
      /** The source-owned box, without sample children or sample text. The
       * computed style remains measured evidence, never a reusable rule. */
      observation: Omit<CapturedNode, 'nodes'>;
    }>;
    content: 'caller-slot' | 'nested-caller-slot' | 'authored-or-runtime' | 'unresolved';
    /** Observed host container for a proved nested input. Root-only consumers
     * must not discard its surrounding source-owned hosts. */
    callerSlotPath?: string;
    /** Paths are addresses in this observation, not permanent part names. */
    sourceOwnedPaths: string[];
    callerContentPaths: string[];
    runtimeDependentPaths: string[];
    dependencies: Array<{ instanceId: string; roots: string[]; placement: 'caller-content' | 'authored-or-runtime' }>;
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
): ReactSourceAnatomy {
  const out: ReactSourceAnatomy = { version: 1, status: 'refused', acceptedContract: null,
    qualification: 'observed-source-correspondence', instances: [], problems: [] };
  function fail(reason: string): never { throw Error(reason); }
  try {
    if (program.version !== 1 || ownership.version !== 1 || program.problems.length || ownership.problems.length)
      fail('react-anatomy-source-or-observation-unresolved');
    if (ownership.rendererVersions.length !== 1 || !['19.2.4', '19.2.7'].includes(ownership.rendererVersions[0]))
      fail('react-anatomy-renderer-unsupported');
    if (!reactOwnershipMatchesTree(ownership, tree)) fail('react-anatomy-captured-paths-differ');
    const definitions = new Map(program.components.map(component => [identity(component), component]));
    if (definitions.size !== program.components.length) fail('react-anatomy-source-identity-ambiguous');
    const instances = new Map(ownership.components.map(instance => [instance.id, instance]));
    if (instances.size !== ownership.components.length || !instances.size) fail('react-anatomy-instance-identity-ambiguous');
    const flat = new Map(flatten(tree).map(element => [element.path, element.node]));
    for (const node of ownership.nodes) {
      if ((node.nearestComponent && !instances.has(node.nearestComponent)) ||
          (node.createdBy && !instances.has(node.createdBy))) fail('react-anatomy-node-owner-missing');
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
          !source.problems.includes('component-return-control-flow-unresolved') && hostBranches(source.root).includes(captured.tag);
        return { path, tag: captured.tag,
          correspondence: owned ? source.root.kind === 'host' ? 'source-host' as const : 'observed-host-branch' as const : 'runtime-dependent' as const,
          observation: structuredClone(observation) };
      });
      let content: ReactSourceAnatomy['instances'][number]['content'] = source.children.kind === 'forwarded' && roots.length === 1 && roots[0].correspondence !== 'runtime-dependent'
        ? 'caller-slot' as const : source.children.kind === 'unresolved' ? 'unresolved' as const : 'authored-or-runtime' as const;
      const nodes = ownership.nodes.filter(node => instance.roots.some(root => contains(root, node.path)));
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
        ...(instance.parent ? { parentInstanceId: instance.parent } : {}), roots, content,
        ...(callerSlotPath === undefined ? {} : {callerSlotPath}),
        sourceOwnedPaths, callerContentPaths,
        runtimeDependentPaths: nodes.filter(node => !sourceOwnedPaths.includes(node.path) && !callerContentPaths.includes(node.path)).map(node => node.path),
        dependencies, problems: [
          ...source.problems,
          ...(roots.some(root => root.correspondence === 'runtime-dependent') ? ['root-runtime-correspondence-unqualified'] : []),
          ...(roots.some(root => root.correspondence === 'observed-host-branch') ? ['other-root-branches-unqualified'] : []),
          ...(content === 'unresolved' ? ['children-flow-unresolved'] : []),
          ...(content === 'nested-caller-slot' ? ['nested-children-lowering-unqualified'] : []),
        ] });
    }
    out.status = 'linked';
  } catch (error) {
    out.instances = [];
    out.problems.push(error instanceof Error ? error.message : String(error));
  }
  return out;
}
