/** Combine independently observed contract resources without conflating equal
 * token/asset names. This is a compiler projection, never native write authority.
 * Contract IDs, public property domains and the original inputs stay intact. */
import { ContractSchema, walkAnatomy, tokensByPropEntries, type Contract, type Part } from '../scripts/contract-schema.js';
import { revisionOf } from './contract-provenance.js';
import { flattenTokens, aliasTarget, makeResolveLiteral } from './tokens.js';
import { enumCombos, placeholdersIn } from '../packages/core/src/anatomy.js';

export interface ContractResources {
  contractId: string;
  tokens: Record<string, unknown>;
  assets: Array<[string, string]>;
}
export function scopeContractResources(contracts: Contract[], resources: ContractResources[]) {
  const fail = (reason: string): never => { throw Error('SCOPED_CONTRACT_RESOURCES_' + reason); };
  const ids = new Set(contracts.map(c => c.id));
  if (ids.size !== contracts.length || resources.length !== ids.size ||
      new Set(resources.map(r => r.contractId)).size !== ids.size || resources.some(r => !ids.has(r.contractId)))
    fail('IDENTITIES_INVALID');
  const contexts = new Map(resources.map(r => [r.contractId, r]));
  const tokens: Record<string, unknown> = {}, icons = new Map<string, string>();
  const mappings: Array<{ contractId: string; contractRevision: string; resourceRevision: string;
    tokenPrefix: string; tokenPaths: Array<{ original: string; scoped: string }>;
    assets: Array<{ original: string; scoped: string }> }> = [];
  const projected = [...contracts].sort((a, b) => a.id.localeCompare(b.id)).map(original => {
    const context = contexts.get(original.id)!;
    const resourceRevision = revisionOf({ tokens: context.tokens, assets: [...context.assets].sort(([a], [b]) => a.localeCompare(b)) });
    // The contract identity prevents two equal resources from accidentally
    // becoming one shared variable whose later edit affects both components.
    const namespace = 'c' + revisionOf({ contractId: original.id, resourceRevision }).slice(7);
    const leaves = flattenTokens(context.tokens), resolve = makeResolveLiteral(leaves);
    for (const tokenPath of leaves.keys()) resolve(tokenPath); // dangling/cyclic aliases refuse before a plan exists
    const remapValue = (value: unknown): unknown => {
      const alias = aliasTarget(value);
      if (alias !== null) {
        if (!leaves.has(alias)) fail('ALIAS_UNRESOLVED:' + original.id + ':' + alias);
        return `{${namespace}.${alias}}`;
      }
      if (Array.isArray(value)) return value.map(remapValue);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, remapValue(v)]));
      return value;
    };
    const remapTree = (value: unknown): unknown => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      return Object.fromEntries(Object.entries(value).map(([key, v]) => [key,
        key === '$value' ? remapValue(v) : key.startsWith('$') ? structuredClone(v) : remapTree(v)]));
    };
    tokens[namespace] = remapTree(context.tokens);
    const contract = ContractSchema.parse(structuredClone(original));
    const domains = new Map<string, string[]>();
    for (const prop of contract.props) {
      if (typeof prop.type === 'object' && 'enum' in prop.type) domains.set(prop.name, prop.type.enum);
      else if (prop.type === 'boolean') domains.set(prop.name, ['false', 'true']);
    }
    const ref = (value: string): string => {
      const path = value.slice(1, -1), placeholders = placeholdersIn(path);
      if (placeholders.some(p => !domains.has(p))) fail('TOKEN_DOMAIN_UNAVAILABLE:' + original.id);
      for (const combination of enumCombos(placeholders, domains)) {
        let expanded = path;
        for (const [name, v] of combination) expanded = expanded.replaceAll(`{${name}}`, v);
        if (!leaves.has(expanded)) fail('TOKEN_UNRESOLVED:' + original.id + ':' + expanded);
      }
      return `{${namespace}.${path}}`;
    };
    const refs = (record: Record<string, string> | undefined) => {
      if (record) for (const [key, value] of Object.entries(record)) record[key] = ref(value);
    };
    const assetMap = new Map<string, string>();
    for (const [name, svg] of context.assets) {
      if (assetMap.has(name)) fail('ASSET_IDENTITY_DUPLICATE:' + original.id);
      const scoped = `${namespace}-${name}`;
      assetMap.set(name, scoped); icons.set(scoped, svg);
    }
    const layout = (value: Part['layout']) => {
      if (value?.gap) for (const key of ['row', 'column'] as const) {
        const gap = value.gap[key]; if (typeof gap === 'string') value.gap[key] = ref(gap);
      }
    };
    for (const { part } of walkAnatomy(contract)) {
      refs(part.tokens); refs(part.component?.overrides);
      for (const entry of tokensByPropEntries(part)) Object.values(entry.map).forEach(refs);
      for(const table of part.tokensByCombination??[])for(const row of table.rows)refs(row.tokens);
      Object.values(part.states ?? {}).forEach(refs);
      for (const entry of part.statesByProp ?? []) Object.values(entry.map).forEach(refs);
      layout(part.layout);
      for (const value of Object.values(part.layoutByProp?.map ?? {})) layout(value);
      if (part.icon) {
        // Changing an icon enum's public values would change the component API.
        // Literal assets can be scoped; a dynamic asset requires an explicit map.
        if (part.icon.asset.includes('{')) fail('DYNAMIC_ASSET_UNQUALIFIED:' + original.id);
        const scoped = assetMap.get(part.icon.asset);
        if (!scoped) fail('ASSET_UNRESOLVED:' + original.id + ':' + part.icon.asset);
        part.icon.asset = scoped!;
      }
    }
    mappings.push({ contractId: original.id, contractRevision: revisionOf(original), resourceRevision, tokenPrefix: namespace,
      tokenPaths: [...leaves.keys()].sort().map(path => ({ original: path, scoped: `${namespace}.${path}` })),
      assets: [...assetMap].sort(([a], [b]) => a.localeCompare(b)).map(([original, scoped]) => ({ original, scoped })) });
    return ContractSchema.parse(contract);
  });
  return { contracts: new Map(projected.map(c => [c.id, c])), tokens, icons, mappings,
    revision: revisionOf({ contracts: projected, tokens, assets: [...icons].sort(([a], [b]) => a.localeCompare(b)), mappings }) };
}
