import type {DumpNode, DumpSet} from '../extract/figma/types.js';
import {canonicalJson} from './contract-provenance.js';
import {PresenceByCombinationSchema, VisibleWhenSchema, resolvePresence, resolveAvailability, type Part} from '../scripts/contract-schema.js';
import {inspectAuthoredTextAppearance, type QualifiedTextAppearance} from './source-text-appearance-control.js';

export interface AuthoredTextAppearanceAxis {
  property: string;
  prop: string;
  /** True only for the existing VARIANT-bound Boolean lowering. */
  boolean?: boolean;
  values: readonly string[];
  map: Readonly<Record<string, string | null>>;
}
/** Structural shape expected of the owner's new schema TextAppearanceTable. */
export interface AuthoredTextAppearanceTable {
  props: string[];
  rows: Array<{values: Array<string | null>; appearance: QualifiedTextAppearance}>;
}
const dense = (v: unknown): v is unknown[] => Array.isArray(v) &&
  Array.from({length: v.length}, (_, i) => Object.hasOwn(v, i)).every(Boolean);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Positive loss witnesses only. False grants no scalar-equivalence certificate.
 * Boundaries and run count alone do not demonstrate a dropped appearance.
 * SMALL_CAPS variants have no scalar DumpText.textCase/proposer carrier. */
export function authoredTextAppearanceNeedsCarrier(appearance: QualifiedTextAppearance): boolean {
  const channels = (r: QualifiedTextAppearance['runs'][number]) => canonicalJson({
    fontName: r.fontName, fontSize: r.fontSize, fontWeight: r.fontWeight,
    lineHeight: r.lineHeight, letterSpacing: r.letterSpacing,
    textCase: r.textCase, textDecoration: r.textDecoration, fill: r.fill.paint,
  });
  return new Set(appearance.runs.map(channels)).size > 1 ||
    appearance.runs.some(r => r.textCase === 'SMALL_CAPS' || r.textCase === 'SMALL_CAPS_FORCED');
}

/** Authenticate all original owner rows before exposing an authored default.
 * Original membership must equal preexisting admitted presence predicates.
 * No absence inference, INSTANCE traversal, caller evidence or first-row fill.
 * qualifiedDomain is host-owned exact-projection authority, never API input. */
export function qualifyAuthoredTextAppearanceTable(
  source: DumpSet,
  fileKey: string | null,
  occurrences: readonly {variant: string; node: DumpNode}[],
  axes: readonly AuthoredTextAppearanceAxis[],
  declaredDomain: readonly (readonly (string | null)[])[] | undefined,
  qualifiedDomain: boolean,
  part: Pick<Part, 'visibleWhen' | 'presenceByCombination' | 'availabilityByCombination'>,
): AuthoredTextAppearanceTable | undefined {
  if (!fileKey || source.type !== 'COMPONENT_SET' || !source.key || !source.nodeId ||
      source.contractId || source.remoteSnapshot || source.detachedSnapshot || source.captureAlias ||
      !qualifiedDomain || !declaredDomain || !dense(declaredDomain) ||
      !declaredDomain.length || declaredDomain.length > 4096 || !dense(axes) ||
      !axes.length || axes.length > 8 ||
      new Set(axes.map(a => a.property)).size !== axes.length ||
      new Set(axes.map(a => a.prop)).size !== axes.length ||
      !dense(source.variants) || !source.variants.length || source.variants.length > 4096 ||
      !dense(occurrences) || !occurrences.length || occurrences.length > source.variants.length ||
      axes.some(a => !a.property || !a.prop || !dense(a.values) || !a.values.length ||
        new Set(a.values).size !== a.values.length || !object(a.map) ||
        Object.keys(a.map).length !== a.values.length ||
        a.boolean !== undefined && typeof a.boolean !== 'boolean' ||
        a.boolean === true && (a.values.length !== 2 ||
          !a.values.every(raw => a.map[raw] === 'true' || a.map[raw] === 'false')) || a.values.some(raw =>
          typeof raw !== 'string' || !Object.hasOwn(a.map, raw) ||
          a.map[raw] !== null && typeof a.map[raw] !== 'string') ||
        new Set(a.values.map(raw => a.map[raw])).size !== a.values.length)) return;

  const safe = (n: DumpNode) => (n.hidden === undefined || n.hidden === false) &&
    n.propRefs?.visible === undefined && n.bound?.visible === undefined &&
    n.propRefs?.mainComponent === undefined;
  type Segment = {name: string; type: string; ordinal: number};
  type Hit = {node: DumpNode; path: Segment[]; ancestors: DumpNode[]};
  const allIds = new Set<string>([source.nodeId]);
  const indexed = new Map<string, {root: DumpNode; values: Array<string | null>; nodes: Map<string, Hit>}>();
  const originalTuples = new Set<string>();
  for (const main of source.variants) {
    if (main.type !== 'COMPONENT' || !main.nodeId || !main.name || indexed.has(main.name) ||
        !safe(main) || !object(main.variantProperties) ||
        Object.keys(main.variantProperties).length !== axes.length ||
        axes.some(a => !Object.hasOwn(main.variantProperties!, a.property) ||
          !a.values.includes(main.variantProperties![a.property]))) return;
    const values = axes.map(a => a.map[main.variantProperties![a.property]]);
    const tuple = canonicalJson(values);
    if (originalTuples.has(tuple)) return;
    originalTuples.add(tuple);
    const nodes = new Map<string, Hit>();
    let count = 0;
    const visit = (node: DumpNode, path: Segment[], ancestors: DumpNode[], depth: number): boolean => {
      if (!node || !object(node) || ++count > 4096 || depth > 32 || !node.nodeId ||
          allIds.has(node.nodeId) || node.children !== undefined && !dense(node.children)) return false;
      allIds.add(node.nodeId);
      nodes.set(node.nodeId, {node, path, ancestors});
      // Another component's descendants confer no direct owner authority.
      if (node.type === 'INSTANCE') return (node.children?.length ?? 0) === 0;
      const ordinals = new Map<string, number>();
      return (node.children ?? []).every(child => {
        if (!child || !object(child) || typeof child.name !== 'string' || !child.name) return false;
        const ordinal = ordinals.get(child.name) ?? 0;
        ordinals.set(child.name, ordinal + 1);
        return visit(child, [...path, {name: child.name, type: child.type, ordinal}],
          [...ancestors, node], depth + 1);
      });
    };
    if (!visit(main, [], [], 0)) return;
    indexed.set(main.name, {root: main, values, nodes});
  }
  const declared = new Set<string>();
  for (const row of declaredDomain) {
    if (!dense(row) || row.length !== axes.length || row.some((value, i) =>
      value !== null && typeof value !== 'string' ||
      !axes[i].values.some(raw => axes[i].map[raw] === value))) return;
    const tuple = canonicalJson(row);
    if (declared.has(tuple) || !originalTuples.has(tuple)) return;
    declared.add(tuple);
  }
  if (declared.size !== originalTuples.size) return;

  const joined = new Set<string>();
  const rows: AuthoredTextAppearanceTable['rows'] = [];
  let lineage: string | undefined;
  let path: Segment[] | undefined;
  let positivelyLossy = false;
  for (const occurrence of occurrences) {
    if (!occurrence || !occurrence.node || joined.has(occurrence.variant) ||
        occurrence.node.type !== 'TEXT' || !occurrence.node.nodeId) return;
    const main = indexed.get(occurrence.variant);
    const hit = main?.nodes.get(occurrence.node.nodeId);
    if (!main || !hit || !hit.path.length || hit.node.type !== 'TEXT' || !safe(hit.node) ||
        hit.node.children?.length || hit.ancestors.some(n => !safe(n)) ||
        hit.path.some((s, i) => !s.name || i < hit.path.length - 1 && !['FRAME', 'GROUP'].includes(s.type)) ||
        canonicalJson(hit.node) !== canonicalJson(occurrence.node)) return;
    const currentLineage = canonicalJson(hit.path);
    if (lineage !== undefined && lineage !== currentLineage) return;
    lineage = currentLineage;
    path = hit.path;
    const text = hit.node.text;
    if (!text || typeof text.characters !== 'string' || !text.sourceAppearance) return;
    let appearance: QualifiedTextAppearance;
    try { appearance = inspectAuthoredTextAppearance(text.sourceAppearance); }
    catch { return; }
    if (appearance.characters !== text.characters) return;
    positivelyLossy ||= authoredTextAppearanceNeedsCarrier(appearance);
    joined.add(occurrence.variant);
    rows.push({values: [...main.values], appearance: structuredClone(appearance)});
  }
  if (!positivelyLossy || !path || !rows.length || rows.length !== joined.size) return;
  // Predicate tables must cover their exact projection of the complete owner
  // domain. They already exist on this physical part; no new absence is authored.
  const qualifyPredicateTable = (table: Part['presenceByCombination']): boolean => {
    if (!table) return true;
    if (!PresenceByCombinationSchema.safeParse(table).success ||
        table.props.some(name => !axes.some(a => a.prop === name))) return false;
    const expected = new Set([...indexed.values()].map(main => canonicalJson(
      table.props.map(name => main.values[axes.findIndex(a => a.prop === name)]))));
    return expected.size === table.rows.length &&
      table.rows.every(row => expected.has(canonicalJson(row.values)));
  };
  if (!qualifyPredicateTable(part.presenceByCombination) ||
      !qualifyPredicateTable(part.availabilityByCombination) ||
      part.visibleWhen && (!VisibleWhenSchema.safeParse(part.visibleWhen).success ||
        !axes.some(a => a.prop === part.visibleWhen!.prop))) return;

  // Missing a named/ordinal member from an authenticated dense original child
  // list proves this physical path absent. A changed type or INSTANCE boundary
  // is ambiguous ownership and is refused, never converted into an absent row.
  const originalMember = (root: DumpNode): 'present' | 'absent' | 'unqualified' => {
    let node = root;
    for (const [index, segment] of path!.entries()) {
      if (node.type === 'INSTANCE') return 'unqualified';
      const matches = (node.children ?? []).filter(child => child.name === segment.name);
      const selected = matches[segment.ordinal];
      if (!selected) return 'absent';
      if (selected.type !== segment.type || !safe(selected) ||
          index < path!.length - 1 && !['FRAME', 'GROUP'].includes(selected.type)) return 'unqualified';
      node = selected;
    }
    return node.type === 'TEXT' && !node.children?.length ? 'present' : 'unqualified';
  };
  let presentCount = 0;
  for (const [name, main] of indexed) {
    const membership = originalMember(main.root);
    if (membership === 'unqualified') return;
    const subst = Object.fromEntries(axes.map((a, i) => [a.prop,
      a.boolean === true && main.values[i] !== null ? main.values[i] === 'true' : main.values[i]]));
    let predicatePresent: boolean, available: boolean;
    try {
      const when = part.visibleWhen;
      const visible = !when || (when.equals !== undefined
        ? (Array.isArray(when.equals) ? when.equals : [when.equals]).map(String).includes(String(subst[when.prop]))
        : typeof subst[when.prop] !== 'boolean' || subst[when.prop] === true);
      predicatePresent = visible && resolvePresence(part, subst);
      available = resolveAvailability(part, subst);
    } catch { return; }
    const physicallyPresent = membership === 'present';
    if (predicatePresent !== physicallyPresent || joined.has(name) !== physicallyPresent ||
        physicallyPresent && !available) return;
    // Availability never supplies an additional row-omission waiver. The
    // existing visibleWhen/presence predicates must independently match it.
    if (physicallyPresent) presentCount++;
  }
  if (presentCount !== rows.length) return;
  rows.sort((a, b) => compare(canonicalJson(a.values), canonicalJson(b.values)));
  return {props: axes.map(a => a.prop), rows};
}
