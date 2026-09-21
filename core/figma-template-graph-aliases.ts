import type { DumpSet, DumpTemplateVariableGraph, DumpVariableConsumer } from '../extract/figma/types.js';
import { canonicalJson, revisionOf } from './contract-provenance.js';
import { deriveNativeRootTextRouting } from './native-root-text-template-graph.js';
import { fail, object, equivalent, edge, pathOf, spell, type TemplateSourceToken } from './figma-template-values.js';

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const reserved = (name: string) => name.startsWith('dsc-native-template/');
const fields = { fontSizeVar: ['fontSize', 'font-size'], lineHeightVar: ['lineHeight', 'line-height'],
  fontWeightVar: ['fontWeight', 'font-weight'], fillVar: ['fill', 'fill'] } as const;
type Channel = (typeof fields)[keyof typeof fields][0];
type Variable = DumpTemplateVariableGraph['variables'][number];

/** Verify the complete finite routing shape, not just the edges this main
 * happens to select. The source leaf values are captured design data; routing
 * is reconstructed only from source identities and public binding tuples. */
export function projectRootTextTemplateGraphAliases(set: DumpSet): {
  set: DumpSet; tokens: TemplateSourceToken[]; syntheticNames: string[];
} {
  const g = set.templateVariableGraph!;
  if (!object(g) || g.version !== 1 || typeof g.fileKey !== 'string' || !g.fileKey ||
      !Array.isArray(g.collections) || g.collections.length < 2 || g.collections.length > 64 ||
      !Array.isArray(g.variables) || !g.variables.length || g.variables.length > 16384 ||
      !Array.isArray(g.consumers) || g.consumers.length !== set.variants.length * 3 ||
      !set.variants.length || set.variants.length > 1024) fail('raw graph inventory required');
  const identity = (v: unknown) => typeof v === 'string' && v.length > 0;
  if (g.collections.some(c => !object(c) || !identity(c.id) || !identity(c.key) || !identity(c.name) ||
        !Array.isArray(c.modes) || c.modes.some(m => !object(m) || !identity(m.modeId) || !identity(m.name))) ||
      g.variables.some(v => !object(v) || !identity(v.id) || !identity(v.key) || !identity(v.name)) ||
      g.consumers.some(c => !object(c) || !identity(c.nodeId) || !identity(c.variantName) ||
        !Array.isArray(c.specPath) || c.specPath.some(i => !Number.isInteger(i) || i < 0)))
    fail('malformed raw graph identity');
  const cols = new Map(g.collections.map(c => [c.id, c])), vars = new Map(g.variables.map(v => [v.id, v]));
  const names = new Map(g.variables.map(v => [v.name, v])), keys = new Set(g.variables.map(v => v.key));
  if (cols.size !== g.collections.length || vars.size !== g.variables.length || names.size !== vars.size || keys.size !== vars.size ||
      new Set(g.collections.map(c => c.key)).size !== cols.size || new Set(g.collections.map(c => c.name)).size !== cols.size)
    fail('ambiguous raw graph identity');
  for (const c of cols.values()) {
    if (!c.id || !c.key || !c.name || c.remote !== false || !Array.isArray(c.modes) || !c.modes.length ||
        new Set(c.modes.map(m => m.modeId)).size !== c.modes.length || new Set(c.modes.map(m => m.name)).size !== c.modes.length ||
        c.modes.some(m => !m.modeId || !m.name) || !c.modes.some(m => m.modeId === c.defaultModeId) ||
        !Array.isArray(c.variableIds) || new Set(c.variableIds).size !== c.variableIds.length ||
        !same([...c.variableIds].sort(), g.variables.filter(v => v.collectionId === c.id).map(v => v.id).sort()))
      fail('incomplete raw collection');
  }
  for (const v of vars.values()) {
    const c = cols.get(v.collectionId);
    if (!v.id || !v.key || !v.name || v.remote !== false || !c || !object(v.valuesByMode) || !Array.isArray(v.scopes) ||
        v.scopes.some(s => !identity(s)) || new Set(v.scopes).size !== v.scopes.length ||
        !['FLOAT', 'COLOR', 'STRING', 'BOOLEAN'].includes(v.resolvedType) ||
        !same(Object.keys(v.valuesByMode).sort(), c!.modes.map(m => m.modeId).sort())) fail('incomplete raw variable');
    for (const raw of Object.values(v.valuesByMode)) {
      if (object(raw) && raw.type === 'VARIABLE_ALIAS') {
        const id = edge(raw), target = id ? vars.get(id) : undefined;
        if (!target || target.resolvedType !== v.resolvedType) fail('missing or mismatched raw alias');
      } else {
        const valid = v.resolvedType === 'FLOAT' ? typeof raw === 'number' && Number.isFinite(raw)
          : v.resolvedType === 'STRING' ? typeof raw === 'string' : v.resolvedType === 'BOOLEAN' ? typeof raw === 'boolean'
          : object(raw) && Object.keys(raw).every(k => ['r','g','b','a'].includes(k)) &&
            ['r','g','b','a'].every(k => typeof (raw[k] ?? (k === 'a' ? 1 : undefined)) === 'number' &&
              Number.isFinite(raw[k] ?? 1) && Number(raw[k] ?? 1) >= 0 && Number(raw[k] ?? 1) <= 1);
        if (!valid) fail('invalid raw native value');
      }
    }
  }
  const consumerByPath = new Map(g.consumers.map(c => [canonicalJson([c.variantName, c.specPath]), c]));
  if (consumerByPath.size !== g.consumers.length || new Set(g.consumers.map(c => c.nodeId)).size !== g.consumers.length ||
      g.consumers.some(c => !c.nodeId || !object(c.explicitVariableModes) || !object(c.resolvedVariableModes))) fail('ambiguous raw consumer');
  const copy = structuredClone(set), sources = new Map<string, TemplateSourceToken>();
  const aliases = {} as Record<Channel, string>, tuples = new Map<string, Record<Channel, string>>();
  const selections: Array<{ name: string; modeKey: string; modes: Record<string, string> }> = [];
  let prefix: string | undefined, sourceCollection: string | undefined;
  for (const root of copy.variants) {
    const node = root.children?.[0]?.children?.[0], text = node?.text;
    const main = consumerByPath.get(canonicalJson([root.name, []]));
    if (!node || !text || !object(node.variableConsumers) || Object.keys(node.variableConsumers).length !== 4 ||
        Object.values(node.variableConsumers).some(c => !object(c)) || !main)
      fail('raw graph template consumer missing');
    const targets = {} as Record<Channel, string>, projected: Record<string, DumpVariableConsumer> = {};
    for (const [field, [channel, suffix]] of Object.entries(fields) as Array<[keyof typeof fields, readonly [Channel, string]]>) {
      const name = text[field], match = typeof name === 'string' ? /^dsc-native-template\/([a-f0-9]{64})\/([a-z-]+)$/.exec(name) : null;
      if (!match || match[2] !== suffix || prefix && prefix !== match[1] || aliases[channel] && aliases[channel] !== name)
        fail('invalid graph carrier identity');
      prefix = match![1]; aliases[channel] = name!;
      const carrier = names.get(name!), entries = Object.entries(node.variableConsumers).filter(([, c]) => c.name === name);
      if (!carrier || entries.length !== 1 || entries[0][0] !== carrier.id) fail('graph carrier not independently captured');
      const direct = entries[0][1], chain = direct.aliasChain;
      if (!Array.isArray(chain) || !chain.length || chain.length > 16 || chain.some(c => !object(c))) fail('complete graph chain required');
      const type = channel === 'fill' ? 'color' : channel === 'fontWeight' ? 'number' : 'dimension';
      spell(direct, type);
      const hops = [{ id: carrier.id, ...direct }, ...chain];
      const seen = new Set<string>(); let original = -1;
      for (const [index, hop] of hops.entries()) {
        const raw = vars.get(hop.id), c = raw && cols.get(raw.collectionId);
        if (!raw || !c || seen.has(hop.id) || hop.name !== raw.name || hop.collectionId !== c.id ||
            hop.modeId !== main.resolvedVariableModes[c.id] || hop.modeName !== c.modes.find(m => m.modeId === hop.modeId)?.name ||
            hop.resolvedType !== raw.resolvedType || hop.resolvedType !== direct.resolvedType ||
            !same(hop.selectedValue, raw.valuesByMode[hop.modeId]) || !equivalent(hop.value, direct.value))
          fail('raw and consuming graph evidence disagree');
        seen.add(hop.id);
        const next = hops[index + 1], target = edge(hop.selectedValue);
        if (next ? target !== next.id : target !== undefined || !equivalent(hop.selectedValue, hop.value))
          fail('incomplete selected graph path');
        if (reserved(hop.name)) {
          if (original >= 0 || !hop.name.startsWith(`dsc-native-template/${prefix}/`)) fail('routing mixed into source aliases');
        } else {
          if (original < 0) original = index;
          if (sourceCollection && sourceCollection !== c.id || c.modes.length !== 1) fail('source alias collection changed');
          sourceCollection = c.id;
          const path = pathOf(hop.name), token: TemplateSourceToken = { id: hop.id, name: hop.name, path, type, value: spell(hop, type),
            ...(next ? { reference: `{${pathOf(next.name)}}` } : {}) };
          if (sources.has(hop.id) && !same(sources.get(hop.id), token)) fail('source definition changes between variants');
          sources.set(hop.id, token);
        }
      }
      if (original < 1 || hops.length - original > 10) fail('source path missing or beyond corpus limit');
      const first = hops[original]; targets[channel] = first.name; text[field] = first.name;
      if (field === 'fillVar') node.fill = { var: first.name };
      projected[first.id] = { name: first.name, collectionId: first.collectionId, modeId: first.modeId, modeName: first.modeName,
        resolvedType: first.resolvedType, value: first.value, selectedValue: first.value };
    }
    const modeKey = revisionOf(targets); tuples.set(modeKey, targets);
    selections.push({ name: root.name, modeKey, modes: main.explicitVariableModes });
    node.variableConsumers = projected;
  }
  const source = sourceCollection ? cols.get(sourceCollection) : undefined;
  if (!source) fail('original source collection missing');
  const originalVariables = g.variables.filter(v => v.collectionId === source!.id);
  if (originalVariables.some(v => reserved(v.name))) fail('synthetic route in source collection');
  const sourcePaths = Object.fromEntries(originalVariables.map(v => [v.name, pathOf(v.name)]));
  if (new Set(Object.values(sourcePaths)).size !== originalVariables.length) fail('source token path collision');
  const allPaths = Object.values(sourcePaths);
  if (allPaths.some((p, i) => allPaths.some((q, j) => i !== j && p.startsWith(q + '.')))) fail('source token path overlap');
  for (const variable of originalVariables) {
    let v = variable; const seen = new Set<string>();
    for (;;) {
      if (v.collectionId !== source.id || seen.has(v.id) || seen.size >= 10) fail('source alias closure unqualified');
      seen.add(v.id);
      const target = edge(v.valuesByMode[source.modes[0].modeId]);
      if (!target) break;
      v = vars.get(target)!;
    }
  }
  const routing = deriveNativeRootTextRouting({ aliases, modes: [...tuples].map(([key, targets]) => ({ key, name: key, targets })) }, sourcePaths, source!.name);
  const selectors = routing.selectors.map(s => {
    const c = g.collections.find(c => c.name === s.collectionName);
    if (!c || c.id === source!.id || !same(c.modes.map(m => m.name), ['0', '1']) || c.defaultModeId !== c.modes[0].modeId)
      fail('selector mode inventory differs from routing');
    return { ...s, collection: c! };
  });
  if (cols.size !== selectors.length + 1) fail('foreign graph collection');
  const synthetic = g.variables.filter(v => v.collectionId !== source!.id);
  if (!same(synthetic.map(v => v.name).sort(), routing.routes.map(v => v.name).sort())) fail('missing or unused routing variable');
  for (const route of routing.routes) {
    const variable = names.get(route.name)!, selector = selectors.find(s => s.key === route.selector)!;
    if (variable.collectionId !== selector.collection.id || variable.resolvedType !== route.resolvedType) fail('routing variable placement changed');
    const expected = Object.fromEntries(route.targets.map((target, bit) => {
      const v: Variable | undefined = 'route' in target ? names.get(target.route) : originalVariables.find(v => sourcePaths[v.name] === target.sourcePath);
      if (!v) fail('routing terminal missing');
      return [selector.collection.modes[bit].modeId, { type: 'VARIABLE_ALIAS', id: v!.id }];
    }));
    if (!same(variable.valuesByMode, expected)) fail('raw routing edge differs from deterministic projection');
  }
  for (const selected of selections) {
    const logical = routing.selections.find(m => m.modeKey === selected.modeKey)!;
    const modes = Object.fromEntries([[source!.id, source!.modes[0].modeId],
      ...selectors.map(s => [s.collection.id, s.collection.modes[Number(logical.modes[s.key])].modeId])]);
    for (const path of [[], [0], [0, 0]]) {
      const consumer = consumerByPath.get(canonicalJson([selected.name, path]));
      if (!consumer || !same(consumer.explicitVariableModes, path.length ? {} : modes) || !same(consumer.resolvedVariableModes, modes))
        fail('complete public selector vector differs');
    }
  }
  const tokens = [...sources.values()].sort((a, b) => a.path.localeCompare(b.path));
  if (tokens.some((t, i) => tokens.some((u, j) => i !== j && (t.path === u.path || t.path.startsWith(u.path + '.'))))) fail('source paths overlap');
  return { set: copy, tokens, syntheticNames: routing.routes.map(r => r.name).sort() };
}
