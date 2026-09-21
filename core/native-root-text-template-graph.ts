/** Candidate-only projection for native root text templates whose source
 * binding tuples exceed one collection's mode capacity. No application write
 * path accepts this plan yet. Hosts must rederive it from authenticated inputs;
 * a hash on a supplied graph is not authority to allocate or adopt variables. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import type { ComponentData } from './emit-figma-script.js';
import { prepareNativeTokenContext, type NativeTokenContextInput, type NativeTokenPreparation } from './native-token-context.js';
import { planNativeRootTextTemplate, type NativeRootTextTemplatePlan, type RootTextTemplateChannel } from './native-root-text-template-plan.js';
import { flattenTokens } from './tokens.js';

const channels = ['fontSize', 'lineHeight', 'fontWeight', 'fill'] as const;
type Target = { sourcePath: string } | { route: string };
type Route = { name: string; selector: string; resolvedType: 'FLOAT' | 'COLOR'; targets: [Target, Target] };
export interface NativeRootTextTemplateGraph {
  version: 1;
  kind: 'native-root-text-template-graph';
  template: NativeRootTextTemplatePlan;
  /** Unchanged single-mode preparation, including original alias definitions. */
  sourceTokens: NativeTokenPreparation;
  selectors: Array<{ key: string; collectionName: string; modes: ['0', '1'] }>;
  routes: Route[];
  selections: Array<{ modeKey: string; modes: Record<string, '0' | '1'> }>;
  /** Counts the carrier, routing variables and original source alias chain. */
  maximumSelectedChainEntries: number;
  revision: string;
}
export interface NativeRootTextTemplateGraphInput {
  component: ComponentData;
  source: { contractRevision: string; tokenRevision: string };
  tokens: NativeTokenContextInput;
}
function fail(why: string): never { throw Error(`NATIVE_ROOT_TEXT_TEMPLATE_GRAPH_${why}`); }
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Reduced binary routing uses token identities as terminals. Two equal values
 * with different source paths remain distinct leaves. Only identical routing
 * subgraphs collapse. Unused binary addresses receive a defined branch so all
 * native mode values exist; they never become admitted public selections. */
export function planNativeRootTextTemplateGraph(input: NativeRootTextTemplateGraphInput): NativeRootTextTemplateGraph {
  const template = planNativeRootTextTemplate(input.component, input.source);
  if (!template) fail('TEMPLATE_REQUIRED');
  const base = input.tokens;
  if (base.writeProtocol || base.allocatedValues || base.allocatedValueProtocol || base.modes.length !== 1 ||
      base.modes[0].nativeSelection || base.modes[0].tokenTreeRevision !== template.tokenRevision ||
      base.source.tokensSha256 !== template.tokenRevision.slice(7)) fail('SOURCE_CONTEXT');
  const sourceTokens = prepareNativeTokenContext(base);
  if (sourceTokens.variables.some(v => v.name.startsWith('dsc-native-template/'))) fail('RESERVED_SOURCE_NAME');
  const sourceVariables = new Map(sourceTokens.variables.map(v => [v.name, v]));
  const sourceByPath = new Map(sourceTokens.variables.map(v => [v.tokenPath, v]));
  const sourceLeaves = flattenTokens(base.modes[0].tokens);
  const sourceDepth = (path: string, active = new Set<string>()): number => {
    if (active.has(path)) fail('SOURCE_ALIAS_CYCLE');
    const variable = sourceByPath.get(path);
    if (!variable) fail('SOURCE_BINDING_MISSING');
    const value = variable.values[0].value;
    if (!value || typeof value !== 'object' || !('type' in value)) return 1;
    if (value.type !== 'TOKEN_ALIAS') fail('SOURCE_ALIAS_KIND');
    return 1 + sourceDepth(value.targetPath, new Set([...active, path]));
  };
  for (const mode of template.modes) for (const channel of channels) {
    const v = sourceVariables.get(mode.targets[channel]);
    if (!v) fail('SOURCE_BINDING_MISSING');
    if (v.resolvedType !== (channel === 'fill' ? 'COLOR' : 'FLOAT')) fail('SOURCE_BINDING_TYPE');
    const types = channel === 'fill' ? ['color'] : channel === 'fontWeight' ? ['fontWeight', 'number'] : ['dimension', 'number'];
    if (!types.includes(sourceLeaves.get(v.tokenPath)?.type ?? '')) fail('SOURCE_BINDING_TYPE');
  }
  const tuple = (m: NativeRootTextTemplatePlan['modes'][number]) => canonicalJson(channels.map(c => m.targets[c]));
  const modes = [...template.modes].sort((a, b) => order(tuple(a), tuple(b)));
  // Keep allocation, validation and capture work finite. This is an explicit
  // protocol bound, not a claim about a Figma account's collection allowance.
  if (modes.length > 1024) fail('SELECTION_LIMIT');
  const levels = Math.max(1, Math.ceil(Math.log2(modes.length)));
  const selectors = Array.from({ length: levels }, (_, bit) => ({
    key: `bit-${bit}`, collectionName: `${sourceTokens.collectionName} / Text selector ${bit + 1}`, modes: ['0', '1'] as ['0', '1'],
  }));
  const routes = new Map<string, Route>();
  const prefix = template.aliases.fill.slice(0, -'/fill'.length);
  const make = (channel: RootTextTemplateChannel, level: number, start: number, carrier = false): Target | undefined => {
    if (start >= modes.length) return undefined;
    if (level < 0) return { sourcePath: sourceVariables.get(modes[start].targets[channel])!.tokenPath };
    const low = make(channel, level - 1, start), high = make(channel, level - 1, start + 2 ** level);
    if (!low) return high;
    if (!carrier && (!high || same(low, high))) return low;
    const body = { selector: selectors[level].key, resolvedType: channel === 'fill' ? 'COLOR' as const : 'FLOAT' as const,
      targets: [low, high ?? low] as [Target, Target] };
    const name = carrier ? template.aliases[channel] : `${prefix}/route/${revisionOf(body).slice(7)}`;
    if (routes.has(name) && !same(routes.get(name), { name, ...body })) fail('ROUTE_IDENTITY_COLLISION');
    routes.set(name, { name, ...body });
    return { route: name };
  };
  for (const channel of channels) make(channel, levels - 1, 0, true);
  if (routes.size > 8192) fail('ROUTE_LIMIT');
  const selections = modes.map((mode, index) => ({ modeKey: mode.key,
    modes: Object.fromEntries(selectors.map((selector, bit) => [selector.key, String(Math.floor(index / 2 ** bit) % 2) as '0' | '1'])),
  }));
  let maximumSelectedChainEntries = 0;
  for (let i = 0; i < modes.length; i++) for (const channel of channels) {
    let target: Target = { route: template.aliases[channel] }, depth = 0;
    while ('route' in target) {
      if (++depth > levels) fail('ROUTE_CYCLE');
      const route: Route = routes.get(target.route)!;
      target = route.targets[Number(selections[i].modes[route.selector]) as 0 | 1];
    }
    if (target.sourcePath !== sourceVariables.get(modes[i].targets[channel])!.tokenPath) fail('ROUTE_TARGET_CHANGED');
    maximumSelectedChainEntries = Math.max(maximumSelectedChainEntries, depth + sourceDepth(target.sourcePath));
  }
  // The canonical consuming-node producer captures at most sixteen variables.
  // Never hide source alias depth by counting only synthetic routing nodes.
  if (maximumSelectedChainEntries > 16) fail('SELECTED_CHAIN_LIMIT');
  const body = { version: 1 as const, kind: 'native-root-text-template-graph' as const, template, sourceTokens,
    selectors, routes: [...routes.values()].sort((a, b) => order(a.name, b.name)), selections, maximumSelectedChainEntries };
  return { ...body, revision: revisionOf(body) };
}

/** Requires the source inputs again, not a self-reported plan hash. */
export function verifyNativeRootTextTemplateGraph(input: NativeRootTextTemplateGraphInput, graph: NativeRootTextTemplateGraph): void {
  if (!same(planNativeRootTextTemplateGraph(input), graph)) fail('PLAN_CHANGED');
}

/** Exact logical selector vector for one declared public variant. Mode IDs are
 * intentionally absent: an eventual host must map through independently saved
 * allocation identities and prove the complete vector, including unused bits. */
export function nativeRootTextTemplateGraphSelection(graph: NativeRootTextTemplateGraph, variantName: string): Record<string, '0' | '1'> {
  const variant = graph.template.variants.find(v => v.name === variantName);
  const selected = variant && graph.selections.find(s => s.modeKey === variant.modeKey);
  if (!selected) fail('VARIANT_UNKNOWN');
  return { ...selected.modes };
}

export function verifyNativeRootTextTemplateGraphSelection(graph: NativeRootTextTemplateGraph, variantName: string, modes: Record<string, string>): void {
  if (!same(nativeRootTextTemplateGraphSelection(graph, variantName), modes)) fail('SELECTION_CHANGED');
}

/** Picker scopes are derived from all consuming channels, including shared
 * routing subgraphs. They never replace identity or alias-edge verification. */
export function nativeRootTextTemplateGraphScopes(graph: NativeRootTextTemplateGraph): Record<string, string[]> {
  const scopes = { fontSize: 'FONT_SIZE', lineHeight: 'LINE_HEIGHT', fontWeight: 'FONT_WEIGHT', fill: 'TEXT_FILL' };
  const routes = new Map(graph.routes.map(r => [r.name, r])), found = new Map<string, Set<string>>();
  const visit = (name: string, scope: string) => {
    const values = found.get(name) ?? new Set<string>();
    if (values.has(scope)) return;
    values.add(scope); found.set(name, values);
    const route = routes.get(name);
    if (!route) fail('ROUTE_MISSING');
    for (const target of route.targets) if ('route' in target) visit(target.route, scope);
  };
  for (const channel of channels) visit(graph.template.aliases[channel], scopes[channel]);
  return Object.fromEntries([...found].sort(([a], [b]) => order(a, b)).map(([name, values]) => [name, [...values].sort()]));
}

/** This transport creates a text-routing candidate, so unused source leaves
 * have no picker scope. A future component host must separately derive the
 * scopes of any additional root paint/layout consumers before admitting them. */
export function nativeRootTextTemplateGraphSourceScopes(graph: NativeRootTextTemplateGraph): Record<string, string[]> {
  const routeScopes = nativeRootTextTemplateGraphScopes(graph);
  const variables = new Map(graph.sourceTokens.variables.map(v => [v.tokenPath, v]));
  const found = new Map(graph.sourceTokens.variables.map(v => [v.tokenPath, new Set<string>()]));
  const visit = (path: string, scopes: string[]) => {
    const variable = variables.get(path);
    if (!variable) fail('SOURCE_BINDING_MISSING');
    for (const scope of scopes) found.get(path)!.add(scope);
    const value = variable.values[0].value;
    if (value && typeof value === 'object' && 'type' in value) visit(value.targetPath, scopes);
  };
  for (const route of graph.routes) for (const target of route.targets)
    if ('sourcePath' in target) visit(target.sourcePath, routeScopes[route.name]);
  return Object.fromEntries([...found].map(([path, values]) => [path, [...values].sort()]));
}
