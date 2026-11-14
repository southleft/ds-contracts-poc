import type {Page} from 'playwright-core';

export interface SourceTextLeaf {
  path: string;
  nodeId: string | null;
  characters: string;
  charactersProperty: string | null;
  visibleProperty: string | null;
  visibleAtRest: boolean;
}
export interface SourceTextControlPlan {
  rule: 'source-owned-text-controls-v1';
  textProperties: string[];
  propertyIdentities: Record<string, string>;
  booleanDefaults: Record<string, boolean>;
  variants: Array<{name: string; nodeId: string | null; leaves: SourceTextLeaf[]}>;
}
const propertyName = (name: string) => name.replace(/#[0-9]+:[0-9]+(?::[0-9]+)?$/, '');
const normalized = (text: string) => text.replace(/\s+/g, ' ').trim();
function refuse(reason: string): never { throw Error(`source-text-control-unqualified:${reason}`); }

/** The text an instance draws when the dump holds its main component (one variant of a set in the same dump, named by
 * the instance's own component id) but not its children: the main's visible text, read with the instance's component
 * properties and Figma's own text overrides (dump `textOverrides`, by name path). Where the dump cannot say exactly what
 * it draws (a visibility override inside it, an override the dump names as unplaced, a property it cannot read, no main
 * in the dump), the result is null and nothing is added, as before; a nested instance the dump cannot read adds nothing
 * and the text around it still counts. The oracle only ever gains text the design draws. None of it is the outer set's
 * API. */
const UNPLACED = ['host-override-unlocated', 'text-override-ambiguous-path', 'host-instance-properties-unavailable'];
class Unknowable extends Error {}
function instanceText(instance: any, at: string, dump: any, layers: Array<{overrides: Record<string, unknown>; prefix: string}> = [], depth = 0): string[] | null {
  try { return drawnBy(instance, at, dump, layers, depth); } catch (e) { if (e instanceof Unknowable) return null; throw e; }
}
function drawnBy(instance: any, at: string, dump: any, layers: Array<{overrides: Record<string, unknown>; prefix: string}>, depth: number): string[] {
  const id = instance?.instanceRootOverrides?.componentId;
  const main = typeof id === 'string' ? Object.values<any>(dump ?? {}).flatMap(set => (Array.isArray(set?.variants) ? set.variants : []).map((v: any) => ({set, v}))).find(({v}) => v.nodeId === id) : undefined;
  if (!main || depth > 8 || (instance.hostOverrides ?? []).some((o: any) => (o?.fields ?? []).includes('visible'))
    || Object.values<any>(dump?._degradations ?? {}).some(g => UNPLACED.includes(g?.code) && (g.nodePath === at || String(g.nodePath).startsWith(`${at}/`)))) throw new Unknowable();
  const props = instance.componentProperties ?? {}, defs = main.set.propertyDefinitions ?? {};
  const value = (ref: string, kind: 'string' | 'boolean') => {
    const name = propertyName(ref), key = Object.keys(props).find(k => propertyName(k) === name);
    const v = key !== undefined ? props[key] : Object.entries<any>(defs).find(([k]) => propertyName(k) === name)?.[1]?.defaultValue;
    if (typeof v !== kind) throw new Unknowable();
    return v;
  };
  // Overrides apply outermost first: a host's override of a nested text (keyed by its full path) wins over the nested one.
  const own = [...layers, {overrides: instance.textOverrides ?? {}, prefix: ''}], out: string[] = [];
  const walk = (n: any, path: string[], hidden: boolean) => {
    const shown = !hidden && n?.hidden !== true && (n?.propRefs?.visible === undefined || value(n.propRefs.visible, 'boolean'));
    // A nested instance is read by the same rule; one the dump cannot read adds nothing, as an outer one does today.
    if (n?.type === 'INSTANCE') {
      if (shown && !(n.children ?? []).length)
        out.push(...(instanceText(n, `${at}/${path.join('/')}`, dump, own.map(l => ({overrides: l.overrides, prefix: `${l.prefix}${path.join('/')}/`})), depth + 1) ?? []));
      return;
    }
    if (n?.type === 'TEXT' && shown) {
      const override = own.map(l => l.overrides[`${l.prefix}${path.join('/')}`]).find(v => typeof v === 'string');
      if (override === undefined && typeof (n.propRefs?.characters === undefined ? n.text?.characters : '') !== 'string') throw new Unknowable();
      out.push(typeof override === 'string' ? override : n.propRefs?.characters !== undefined ? value(n.propRefs.characters, 'string') : n.text.characters);
    }
    for (const child of n?.children ?? []) walk(child, [...path, child.name], !shown);
  };
  for (const child of main.v.children ?? []) walk(child, [child.name], false);
  return out;
}

/** The oracle reads the original captured node bindings and definitions only.
 * A set-wide TEXT property never implies a binding on an unbound source leaf.
 * Instance internals belong to their child API, so they cannot claim this API. */
export function sourceTextControlPlan(set: any, dump?: any): SourceTextControlPlan {
  if (!Array.isArray(set?.variants) || !set.variants.length) refuse('variant-domain-missing');
  const definitions = new Map<string, any>(), definitionNames = new Map<string, string>();
  for (const [raw, definition] of Object.entries(set.propertyDefinitions ?? {})) {
    const name = propertyName(raw);
    if (definitions.has(name)) refuse(`property-name-collision:${name}`);
    definitions.set(name, definition); definitionNames.set(name, raw);
  }
  const resolveProperty = (raw:string, kind:'TEXT'|'BOOLEAN') => {
    const name=propertyName(raw),definition=definitions.get(name);
    if (definition?.type !== kind) refuse(`${kind === 'TEXT' ? 'text' : 'visibility'}-definition-missing:${name}`);
    // Unsuffixed refs resolve only through the unique normalized declaration.
    // An explicit native suffix must identify that declaration exactly.
    if (name !== raw && definitionNames.get(name) !== raw) refuse(`binding-identity-mismatch:${raw}`);
    if (kind === 'TEXT' && typeof definition.defaultValue !== 'string') refuse(`text-default-unqualified:${name}`);
    return name;
  };
  const sourceIds=new Set<string>();
  const hasOwnedText = (node:any):boolean => node?.type !== 'INSTANCE' &&
    (node?.type === 'TEXT' || (node?.children ?? []).some(hasOwnedText));
  const hasInstanceText = (node:any):boolean => node?.type === 'TEXT' ||
    (node?.children ?? []).some(hasInstanceText);
  const referencedText = new Set<string>(), booleanDefaults: Record<string, boolean> = {};
  const names = new Set<string>();
  const variants = set.variants.map((variant: any) => {
    if (typeof variant.name !== 'string' || names.has(variant.name)) refuse('variant-name-ambiguous');
    names.add(variant.name);
    const leaves: SourceTextLeaf[] = [], instanceLeaves: Array<{leaf: SourceTextLeaf; at: number; boundBy: string | null}> = [];
    const walk = (node: any, path: string[], ancestorHidden: boolean) => {
      if (node?.nodeId !== undefined) {
        if (typeof node.nodeId !== 'string' || !node.nodeId.trim()) refuse('node-id-malformed');
        if (sourceIds.has(node.nodeId)) refuse(`node-id-ambiguous:${node.nodeId}`);
        sourceIds.add(node.nodeId);
      }
      if (node?.hidden !== undefined && typeof node.hidden !== 'boolean') refuse('visibility-capture-malformed');
      if (node?.type === 'INSTANCE') {
        if (hasInstanceText(node)) refuse(`instance-text-ownership-unqualified:${variant.name}:${path.join('/')}`);
        const boundBy = typeof node.propRefs?.visible === 'string' ? propertyName(node.propRefs.visible) : null;
        for (const text of instanceText(node, `${set.setName}:${variant.name}/${path.join('/')}`, dump) ?? [])
          instanceLeaves.push({leaf: {path: path.join('/'), nodeId: null, characters: text, charactersProperty: null, visibleProperty: null,
            visibleAtRest: !ancestorHidden && node.hidden !== true}, at: leaves.length, boundBy});
        return;
      }
      if (node?.type !== 'TEXT' && node?.propRefs?.visible !== undefined && hasOwnedText(node))
        refuse(`ancestor-visibility-binding-unqualified:${variant.name}:${path.join('/')}`);
      if (node?.type === 'TEXT') {
        if (typeof node.text?.characters !== 'string') refuse(`characters-missing:${variant.name}:${path.join('/')}`);
        const textRef = node.propRefs?.characters;
        const visibleRef = node.propRefs?.visible;
        if (textRef !== undefined && typeof textRef !== 'string' || visibleRef !== undefined && typeof visibleRef !== 'string') refuse('binding-identity-malformed');
        const charactersProperty = textRef === undefined ? null : resolveProperty(textRef, 'TEXT');
        const visibleProperty = visibleRef === undefined ? null : resolveProperty(visibleRef, 'BOOLEAN');
        if (charactersProperty !== null) {
          if (definitions.get(charactersProperty)?.type !== 'TEXT') refuse(`text-definition-missing:${charactersProperty}`);
          referencedText.add(charactersProperty);
        }
        if (visibleProperty !== null) {
          const definition = definitions.get(visibleProperty);
          if (definition?.type !== 'BOOLEAN' || typeof definition.defaultValue !== 'boolean') refuse(`visibility-definition-missing:${visibleProperty}`);
          if (ancestorHidden || (node.hidden !== true) !== definition.defaultValue) refuse(`visibility-default-unqualified:${variant.name}:${path.join('/')}`);
          booleanDefaults[visibleProperty] = definition.defaultValue;
        }
        leaves.push({path: path.join('/'), nodeId: typeof node.nodeId === 'string' ? node.nodeId : null,
          characters: node.text.characters, charactersProperty, visibleProperty,
          visibleAtRest: !ancestorHidden && node.hidden !== true});
      }
      for (const child of node?.children ?? []) walk(child, [...path, child.name], ancestorHidden || node.hidden === true);
    };
    walk(variant, [], false);
    return {name: variant.name, nodeId: typeof variant.nodeId === 'string' ? variant.nodeId : null, leaves, instanceLeaves};
  }).map(({name, nodeId, leaves: own, instanceLeaves}: any) => {
    // An instance's text is read at rest: where a scenario toggles the boolean its visibility is bound to, it is left out.
    const withInstances: SourceTextLeaf[] = [...own];
    for (const {leaf, at, boundBy} of [...instanceLeaves].reverse()) if (boundBy === null || !(boundBy in booleanDefaults)) withInstances.splice(at, 0, leaf);
    // Equal drawn text with distinct owners within one cell cannot establish
    // which leaf responded from the cell's full visible text observation.
    const ownersClear = (list: SourceTextLeaf[]) => { const ownersByText=new Map<string,Set<string>>();
      for (const leaf of list) {
        const text=normalized(leaf.characters);
        if (!text) continue;
        const owners=ownersByText.get(text) ?? new Set<string>();
        owners.add(JSON.stringify([leaf.charactersProperty,leaf.visibleProperty,leaf.visibleAtRest]));
        ownersByText.set(text,owners);
      }
      return ![...ownersByText.values()].some(owners=>owners.size>1); };
    // The judge's own test that no candidate text holds another (the probe's markers included).
    const observable = (list: SourceTextLeaf[]) => { const all = [...new Set([...list.map(leaf => normalized(leaf.characters)), ...[...referencedText].map(p => normalized(`Replaced by consumer: ${p}`))])].filter(Boolean);
      return !all.some((value, i) => all.some((other, j) => i !== j && other.includes(value))); };
    // Instance text never makes the oracle refuse where it judged before: a variant whose instance text would, keeps its own.
    const leaves = ownersClear(withInstances) && (observable(withInstances) || !observable(own)) ? withInstances : own;
    if (!ownersClear(leaves)) refuse(`text-owner-ambiguous:${name}`);
    return {name, nodeId, leaves};
  });
  return {rule: 'source-owned-text-controls-v1', textProperties: [...referencedText].sort(),
    propertyIdentities: Object.fromEntries(definitionNames), booleanDefaults, variants};
}

/** Bounded correction for observed mixed ownership of the same drawn text.
 * Uniform text-control and instance-override instruments retain their existing
 * checks. This predicate reads source nodes only; it never selects case rows. */
export function partialSourceTextControlPlan(set: any, dump?: any): SourceTextControlPlan | null {
  const controlsByText = new Map<string, Set<string | null>>();
  const walk = (node: any) => {
    if (node?.type === 'INSTANCE') return;
    if (node?.type === 'TEXT' && typeof node.text?.characters === 'string') {
      const text = node.text.characters;
      const controls = controlsByText.get(text) ?? new Set<string | null>();
      controls.add(typeof node.propRefs?.characters === 'string' ? node.propRefs.characters : null);
      controlsByText.set(text, controls);
    }
    for (const child of node?.children ?? []) walk(child);
  };
  for (const variant of set?.variants ?? []) walk(variant);
  if (![...controlsByText.values()].some(controls => controls.has(null) && controls.size > 1)) return null;
  return sourceTextControlPlan(set, dump);
}

export function expectedSourceText(plan: SourceTextControlPlan, variantName: string, overrides: Record<string, string | boolean> = {}): string[] {
  const variant = plan.variants.find(row => row.name === variantName);
  if (!variant) refuse(`variant-missing:${variantName}`);
  return variant!.leaves.flatMap(leaf => {
    const visible = leaf.visibleProperty !== null ? overrides[leaf.visibleProperty] ?? plan.booleanDefaults[leaf.visibleProperty] : leaf.visibleAtRest;
    if (typeof visible !== 'boolean') refuse('visibility-value-not-boolean');
    if (!visible) return [];
    const text = leaf.charactersProperty !== null ? overrides[leaf.charactersProperty] ?? leaf.characters : leaf.characters;
    if (typeof text !== 'string') refuse('characters-value-not-string');
    return normalized(text) ? [normalized(text)] : [];
  });
}
const occurrences = (text: string, needle: string): number => {
  let count = 0, at = 0;
  while ((at = text.indexOf(needle, at)) !== -1) { count++; at += needle.length; }
  return count;
};

/** Judge every original cell, including invariant literal cells. The full
 * ordered text and diagnostic counts are source-derived; neither the observed response nor generated
 * anatomy can authorize a binding or remove a cell from the check. */
export function judgeSourceTextControls(plan: SourceTextControlPlan,
  cells: ReadonlyArray<{key: string; figmaName: string; nodeId: string}>,
  observed: Readonly<Record<string, string>>, overrides: Record<string, string | boolean> = {}) {
  if (cells.length !== plan.variants.length || new Set(cells.map(cell => cell.key)).size !== cells.length ||
      new Set(cells.map(cell => cell.figmaName)).size !== plan.variants.length) refuse('cell-domain-incomplete');
  const cellIds=cells.map(cell=>cell.nodeId).filter(id=>typeof id === 'string' && id.trim());
  if (new Set(cellIds).size !== cellIds.length) refuse('cell-source-node-ambiguous');
  const rows = cells.map(cell => {
    const source = plan.variants.find(variant => variant.name === cell.figmaName);
    if (!source || source.nodeId !== null && source.nodeId !== cell.nodeId) refuse(`cell-source-identity:${cell.key}`);
    if (typeof observed[cell.key] !== 'string') refuse(`cell-observation-missing:${cell.key}`);
    const expected = expectedSourceText(plan, cell.figmaName, overrides);
    const candidates = [...new Set([...source!.leaves.map(leaf => normalized(leaf.characters)), ...Object.values(overrides).filter((value): value is string => typeof value === 'string').map(normalized)])].filter(Boolean);
    if (candidates.some((value, i) => candidates.some((other, j) => i !== j && other.includes(value)))) refuse(`text-observation-ambiguous:${cell.key}`);
    const text = normalized(observed[cell.key]);
    const counts = candidates.map(value => ({text: value, expected: expected.filter(item => item === value).length, observed: occurrences(text, value)}));
    const expectedText=normalized(expected.join(' '));
    return {key: cell.key, figmaName: cell.figmaName, counts, expectedText, observedText:text,
      passed: text === expectedText && counts.every(count => count.expected === count.observed)};
  });
  return {rows, passed: rows.every(row => row.passed)};
}

/** Contract bindings are used only to invoke the public API. Source bindings
 * above independently determine which leaves each invocation must change. */
export async function probeSourceTextControls(page: Page, plan: SourceTextControlPlan,
  cells: Array<{key: string; figmaName: string; nodeId: string}>,
  bindings: Array<{type?: unknown; bindings?: {figma?: {kind?: string; property?: string}; code?: {prop?: string}}}>) {
  const inputNames: Record<string, string> = {};
  for (const property of [...plan.textProperties, ...Object.keys(plan.booleanDefaults)]) {
    const kind = plan.textProperties.includes(property) ? 'TEXT' : 'BOOLEAN';
    const matches = bindings.filter(input => input.bindings?.figma?.kind === kind &&
      typeof input.bindings.figma.property === 'string' && propertyName(input.bindings.figma.property) === property);
    if (matches.length !== 1 || matches[0].type !== (kind === 'TEXT' ? 'text' : 'boolean')) refuse(`public-input-missing:${property}`);
    const raw=matches[0].bindings!.figma!.property!,code=matches[0].bindings?.code?.prop;
    if (propertyName(raw) !== raw && plan.propertyIdentities[property] !== raw) refuse(`public-input-identity-mismatch:${raw}`);
    if (typeof code !== 'string' || !code.trim()) refuse(`public-input-missing:${property}`);
    if (Object.values(inputNames).includes(code)) refuse(`public-input-code-alias-ambiguous:${code}`);
    inputNames[property] = code;
  }
  const scenarios: Array<{name: string; overrides: Record<string, string | boolean>}> = [{name:'defaults',overrides:{}}];
  for (const property of plan.textProperties) {
    const marker = `Replaced by consumer: ${property}`;
    if (plan.variants.some(variant => variant.leaves.some(leaf => normalized(leaf.characters).includes(marker)))) refuse(`marker-collision:${property}`);
    scenarios.push({name:`${property}:replace`,overrides:{[property]:marker}}, {name:`${property}:empty`,overrides:{[property]:''}});
    for (const visible of Object.keys(plan.booleanDefaults)) for (const value of [false, true]) {
      scenarios.push({name:`${visible}:${value}`,overrides:{[visible]:value}},
        {name:`${property}:replace,${visible}:${value}`,overrides:{[property]:marker,[visible]:value}});
    }
  }
  const set = async (overrides: Record<string, string | boolean> | null) => {
    const props = overrides === null ? null : Object.fromEntries(Object.entries(overrides).map(([property,value]) => [inputNames[property],value]));
    await page.evaluate(({keys,props}) => (window as any).__consumer.setScopedVariantOverride(props === null ? null : {keys,props}), {keys:cells.map(cell=>cell.key),props});
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  };
  const results = [];
  try {
    for (const scenario of scenarios) {
      await set(scenario.overrides);
      const observed = Object.fromEntries(await Promise.all(cells.map(async cell => [cell.key, (await page.locator(`[data-cell="${cell.key}"]`).innerText()).trim()])));
      results.push({...scenario, ...judgeSourceTextControls(plan,cells,observed,scenario.overrides)});
    }
  } finally { await set(null); }
  return {rule:plan.rule, source:plan, scenarios:results, passed:results.every(result=>result.passed)};
}
