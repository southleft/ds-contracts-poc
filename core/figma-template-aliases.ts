import type { DumpSet, DumpVariableConsumer } from '../extract/figma/types.js';
import { canonicalJson } from './contract-provenance.js';

export type { TemplateSourceToken } from './figma-template-values.js';
import { fail, object, equivalent, edge, pathOf, spell, type TemplateSourceToken } from './figma-template-values.js';
import { projectRootTextTemplateGraphAliases } from './figma-template-graph-aliases.js';

/** Invert only the compiler's four reserved carrier aliases on an explicit
 * empty root template. Every selected edge is independently corroborated.
 * Physical variant modes may change the carrier edge, but must not change
 * the definition or value of any original source token. The returned clone
 * is a token-reference projection for the fuser, never a replacement capture. */
export function projectRootTextTemplateAliases(set: DumpSet): {
  set: DumpSet; tokens: TemplateSourceToken[]; syntheticNames: string[];
} | undefined {
  if (!object(set.rootSlot) || set.rootSlot.textTemplate !== 1) return undefined;
  const fields = { fontSizeVar: 'font-size', lineHeightVar: 'line-height', fontWeightVar: 'font-weight', fillVar: 'fill' } as const;
  const reserved = set.variants.some(root => Object.keys(fields).some(field => {
    const name = root.children?.[0]?.children?.[0]?.text?.[field as keyof typeof fields];
    return typeof name === 'string' && name.startsWith('dsc-native-template/');
  }));
  if (!reserved) return undefined;
  if (set.templateVariableGraph) return projectRootTextTemplateGraphAliases(set);
  const copy = structuredClone(set), byName = new Map<string, string>(), byId = new Map<string, string>();
  const sources = new Map<string, { token: TemplateSourceToken; consumer: DumpVariableConsumer; target?: string }>();
  const carriers = new Map<string, string>(), syntheticNames = new Set<string>(), modeNames = new Map<string, string>();
  let prefix: string | undefined, collection: string | undefined;
  const identity = (id: string, c: DumpVariableConsumer) => {
    if (typeof id !== 'string' || !id || !object(c) ||
        ['name','collectionId','modeId','modeName'].some(k => typeof c[k as keyof DumpVariableConsumer] !== 'string' || !c[k as keyof DumpVariableConsumer]) ||
        !['FLOAT', 'COLOR'].includes(c.resolvedType)) fail('incomplete selected alias identity');
    if (byName.has(c.name) && byName.get(c.name) !== id || byId.has(id) && byId.get(id) !== c.name)
      fail(`duplicate native identity ${c.name}`);
    byName.set(c.name, id); byId.set(id, c.name);
    const key = canonicalJson([c.collectionId, c.modeId]);
    if (modeNames.has(key) && modeNames.get(key) !== c.modeName) fail('conflicting native mode name');
    modeNames.set(key, c.modeName);
  };
  for (const root of copy.variants) {
    const node = root.children?.[0]?.children?.[0], text = node?.text;
    if (!node || !text || !object(node.variableConsumers)) fail('missing template alias consumers');
    const consumers = Object.entries(node!.variableConsumers!), projected: Record<string, DumpVariableConsumer> = {};
    if (consumers.length !== 4) fail('carrier aliases require exactly four consuming bindings');
    let mode: string | undefined;
    for (const [field, suffix] of Object.entries(fields) as Array<[keyof typeof fields, string]>) {
      const name = text![field], match = typeof name === 'string' ? name.match(/^dsc-native-template\/([a-f0-9]{64})\/([a-z-]+)$/) : null;
      if (!match || match[2] !== suffix || prefix && prefix !== match[1]) fail('mixed or invalid compiler carrier names');
      prefix = match![1]; syntheticNames.add(name!);
      if (consumers.some(([, c]) => !object(c))) fail('invalid carrier consumer');
      const matches = consumers.filter(([, c]) => c.name === name);
      if (matches.length !== 1) fail('missing or duplicate carrier alias');
      const [id, direct] = matches[0]; identity(id, direct);
      if (Object.keys(direct).some(k => !['name','collectionId','modeId','modeName','resolvedType','value','selectedValue','aliasChain'].includes(k)))
        fail('unknown carrier evidence');
      if (collection && collection !== direct.collectionId || mode && mode !== direct.modeId ||
          carriers.has(field) && carriers.get(field) !== id) fail('carrier collection, mode, or identity changed');
      collection = direct.collectionId; mode = direct.modeId; carriers.set(field, id);
      const chain = direct.aliasChain;
      if (!Array.isArray(chain) || chain.length < 1 || chain.length > 16) fail('missing or excessive selected alias chain');
      // The shared token corpus resolves at most ten source entries. Capture
      // retains deeper evidence, but this projection must not emit a tree the
      // existing consumer cannot resolve.
      if (chain!.length > 10) fail('source alias depth exceeds the token corpus limit');
      const type = field === 'fillVar' ? 'color' : field === 'fontWeightVar' ? 'number' : 'dimension';
      spell(direct, type);
      let previous = direct; const seen = new Set([id]);
      for (let index = 0; index < chain!.length; index++) {
        const hop = chain![index];
        if (!object(hop) || Object.keys(hop).some(k => !['id','name','collectionId','modeId','modeName','resolvedType','value','selectedValue'].includes(k)) ||
            typeof hop.id !== 'string' || edge(previous.selectedValue) !== hop.id || seen.has(hop.id)) fail('invalid selected alias edge');
        identity(hop.id, hop); seen.add(hop.id);
        if (hop.collectionId !== collection || hop.modeId !== mode || hop.resolvedType !== direct.resolvedType ||
            !equivalent(hop.value, direct.value)) fail('selected source alias disagrees with consumer');
        const path = pathOf(hop.name), target = edge(hop.selectedValue), next = chain![index + 1];
        if (target ? !next || next.id !== target : index !== chain!.length - 1 || !equivalent(hop.selectedValue, hop.value))
          fail('incomplete or contradictory terminal source value');
        const token: TemplateSourceToken = { id: hop.id, name: hop.name, path, type, value: spell(hop, type),
          ...(target ? { reference: `{${pathOf(next!.name)}}` } : {}) };
        const old = sources.get(hop.id);
        if (old && (old.token.name !== token.name || old.token.type !== type || old.token.value !== token.value || old.target !== target ||
            old.consumer.collectionId !== hop.collectionId || !equivalent(old.consumer.value, hop.value)))
          fail(`original source token changes across variant modes: ${hop.name}`);
        sources.set(hop.id, { token, consumer: hop, target }); previous = hop;
      }
      const first = chain![0]; text![field] = first.name;
      if (field === 'fillVar') node!.fill = { var: first.name };
      // Validated selected value is sufficient for the ordinary literal guard;
      // the original alias definition stays in tokens and the untouched input.
      const { id: sourceId, ...source } = first;
      projected[sourceId] = { ...source, selectedValue: source.value };
    }
    node!.variableConsumers = projected;
  }
  const tokens = [...sources.values()].map(s => s.token).sort((a, b) => a.path.localeCompare(b.path));
  if (tokens.some((t, i) => tokens.some((u, j) => i !== j && (t.path === u.path || t.path.startsWith(u.path + '.')))))
    fail('source token paths collide');
  return { set: copy, tokens, syntheticNames: [...syntheticNames].sort() };
}
