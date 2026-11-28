import { isDumpSet, type DumpVariableConsumer, type DumpVariable } from '../extract/figma/types.js';
import { qualifySolidFillColorBinding } from '../extract/figma/solid-fill-binding.js';
import { planSolidFillBindingTokens } from './solid-fill-binding-tokens.js';
import { cssVarName } from './emit-tokens-css.js';
import { canonicalJson } from './contract-provenance.js';
import { flattenTokens, type TokenTreeInput } from './tokens.js';
import type { CapturedTokenEntry } from './captured-tokens.js';

export const CAPTURED_ALIAS_LIMIT = 'Captured color aliases preserve native identity and the selected consuming context only; token tiers, other modes and interaction behavior are not inferred. Variables without native alias evidence remain resolved values.';

/** Native records only; projected template consumers are not evidence. */
export function capturedVariableConsumers(value: unknown): Array<[string, DumpVariableConsumer]> {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => key === 'variableConsumers'
    ? Object.entries((child ?? {}) as Record<string, DumpVariableConsumer>) : capturedVariableConsumers(child));
}

/** Validate native graphs independently of rendered paint equivalence. */
export function capturedAliasEntries(dump: Record<string, unknown>, pathFor: (name: string) => string,
  ignored: ReadonlySet<DumpVariableConsumer> = new Set()): CapturedTokenEntry[] {
  const ordinary = Object.values(dump).filter(isDumpSet).flatMap(capturedVariableConsumers).filter(([, c]) => !ignored.has(c));
  if (ordinary.some(([, c]) => !c || typeof c !== 'object')) throw Error('captured-alias-consumer-invalid');
  const aliases = ordinary.filter(([, c]) => (c.selectedValue as {type?: string})?.type === 'VARIABLE_ALIAS' || c.aliasChain?.length);
  if (!aliases.length) return [];
  const qualify = ([id, c]: [string, DumpVariableConsumer]) => {
    if (c.resolvedType !== 'COLOR' || !c.value || typeof c.value !== 'object') throw Error('captured-alias-type-unsupported:' + c.name);
    if ((c.aliasChain?.length ?? 0) >= 10) throw Error('captured-alias-depth:' + c.name);
    try { return qualifySolidFillColorBinding({variableId: id, paint: {color: {r: c.value.r, g: c.value.g, b: c.value.b}, opacity: c.value.a ?? 1, blendMode: 'NORMAL'}}, {[id]: c}); }
    catch (error) { throw Error(`captured-alias-invalid:${c.name}: ${String(error)}`); }
  };
  const bindings = aliases.map(qualify);
  const initial = planSolidFillBindingTokens(bindings);
  const ids = new Set(initial.variables.map(v => v.id)), names = new Set(initial.variables.map(v => v.name));
  // Direct consumers can contradict an identity reached through another node's alias.
  const plan = planSolidFillBindingTokens(ordinary.filter(([id, c]) => ids.has(id) || names.has(c.name)).map(qualify));
  const owners = new Map<string, string>(), rows = new Map(plan.variables.map(v => [v.id, v]));
  const table = (dump._variables ?? {}) as Record<string, DumpVariable>;
  return plan.variables.map(row => {
    const path = pathFor(row.name), owner = owners.get(path);
    if (path.split('.').some(p => !p || ['__proto__', 'constructor', 'prototype'].includes(p))) throw Error('captured-alias-path-invalid:' + row.name);
    if (owner && owner !== row.id) throw Error('captured-alias-name-conflict:' + row.name);
    owners.set(path, row.id);
    const color = row.value as {r: number; g: number; b: number; a?: number};
    const channels = [color.r, color.g, color.b, color.a ?? 1].map(v => Math.round(v * 255).toString(16).padStart(2, '0'));
    const hex = '#' + channels.slice(0, channels[3] === 'ff' ? 3 : 4).join('');
    const global = table[row.name];
    if (global && (global.type !== 'COLOR' || global.value !== hex ||
      global.modes?.[row.modeName] !== undefined && global.modes[row.modeName] !== hex)) throw Error('captured-alias-table-conflict:' + row.name);
    const selected = row.selectedValue as {type?: string; id?: string};
    return {name: row.name, path, type: 'color', value: `rgba(${color.r * 255},${color.g * 255},${color.b * 255},${color.a ?? 1})`,
      ...(selected.type === 'VARIABLE_ALIAS' ? {reference: '{' + pathFor(rows.get(selected.id!)!.name) + '}'} : {}),
      source: {variableId: row.id, collectionId: row.collectionId, modeId: row.modeId, modeName: row.modeName, scope: 'selected-mode', tier: 'unspecified'}};
  });
}

export function assertCapturedAliasPaths(paths: string[], owned: string[]): void {
  for (const other of paths) for (const path of owned)
    if (other.startsWith(path + '.') || path.startsWith(other + '.') || other !== path && cssVarName(other) === cssVarName(path))
      throw Error('captured-alias-path-conflict:' + path + ':' + other);
}

/** Captured graph paths own one selected context across every fallback layer.
 * Conflicting native provenance from another import must never be overwritten. */
export function applyCapturedAliasTrees(input: TokenTreeInput, trees: Record<string, unknown>[], replaceFallback = false): TokenTreeInput {
  const owned = new Map<string, Record<string, unknown>>();
  for (const tree of trees) for (const [path, entry] of flattenTokens(tree)) if (entry.extensions?.['ds-contracts-source']) {
    const leaf = {$value: entry.value, $type: entry.type, $extensions: entry.extensions};
    if (owned.has(path) && canonicalJson(owned.get(path)) !== canonicalJson(leaf)) throw Error('captured-alias-source-conflict:' + path);
    owned.set(path, leaf);
  }
  if (!owned.size) return input;
  const layers = [input.primitives, input.semantic, input.light, input.dark, ...Object.values(input.brands), ...trees];
  assertCapturedAliasPaths(layers.flatMap(tree => [...flattenTokens(tree).keys()]), [...owned.keys()]);
  const prune = (tree: unknown, prefix = ''): Record<string, unknown> => Object.fromEntries(Object.entries((tree ?? {}) as object).flatMap(([key, value]) => {
    const path = prefix ? prefix + '.' + key : key;
    if (owned.has(path)) {
      if (!replaceFallback && !(value as {$extensions?: Record<string, unknown>})?.$extensions?.['ds-contracts-source']) throw Error('captured-alias-unowned-conflict:' + path);
      if ((value as {$extensions?: Record<string, unknown>})?.$extensions?.['ds-contracts-source'] && canonicalJson(value) !== canonicalJson(owned.get(path))) throw Error('captured-alias-source-conflict:' + path);
      return [];
    }
    return [[key, !key.startsWith('$') && value && typeof value === 'object' ? prune(value, path) : value]];
  }));
  const result = {...input, primitives: prune(input.primitives), semantic: prune(input.semantic), light: prune(input.light), dark: prune(input.dark),
    brands: Object.fromEntries(Object.entries(input.brands).map(([name, tree]) => [name, prune(tree)]))};
  for (const [path, leaf] of owned) {
    const parts = path.split('.'); let node = result.semantic;
    for (const part of parts.slice(0, -1)) node = (node[part] ??= {}) as Record<string, unknown>;
    node[parts.at(-1)!] = leaf;
  }
  return result;
}
