/**
 * Desktop-MCP import: REST structure + Dev-Mode-MCP variable NAMES → dump v1.
 *
 * ARCHITECTURE — augmentation, not a parallel dump path. The Dev Mode MCP
 * server exposes no per-node style/binding tree: get_metadata is an id/name/
 * geometry skeleton, get_design_context is GENERATED React+Tailwind (variant
 * conditionals collapsed — not invertible without guessing), and
 * get_variable_defs is a FLAT name→resolved-value map scoped to a node's
 * subtree. None of that can carry dump v1 alone. What the MCP uniquely has is
 * the thing the REST path is missing on non-Enterprise plans: variable NAMES
 * (GET /v1/files/:key/variables/local is Enterprise-only; the nodes endpoint
 * is not). So this module:
 *
 *   1. pulls the node tree over REST (reusing extract/figma/rest/fetch.ts),
 *   2. collects every VARIABLE_ALIAS the REST→dump mapper will consume,
 *      together with the field's RESOLVED LITERAL (paint hex, padding px, …),
 *   3. joins alias ids to MCP variable names BY VALUE — first at whole-set
 *      scope, then, for still-ambiguous ids, at per-node scope (calling
 *      get_variable_defs with the exact node id narrows the candidate set to
 *      the variables actually used in that subtree),
 *   4. feeds the recovered id→name table to the EXISTING mapper
 *      (extract/figma/rest/map.ts) as if the Enterprise endpoint had answered.
 *
 * The join NEVER guesses: an id resolves only when exactly one name survives
 * the intersection of every occurrence's candidate set at the tightest
 * available scope. Anything else is an unresolved receipt with the candidate
 * NAMES listed — the mapper degrades it to its resolved literal as before,
 * and the minting engine (`mintUnbound`) keeps the style at literal fidelity.
 * Known residual ambiguity, by construction: two same-valued variables bound
 * to different fields of the SAME node (the node-scope defs cannot tell them
 * apart), and same-valued variables where one aliases the other.
 *
 * Instance internals are out of scope exactly as in map.ts (an instance's
 * insides belong to the child contract) — which also dodges the MCP's node-id
 * grammar limit (`^\d+[:-]\d+$` rejects the `I…;…` ids instance internals
 * carry).
 *
 * Browser-pure: no node builtins; HTTP arrives via injected fetch (REST) and
 * an McpConnection (client.ts). The CLI (cli.ts) owns fs/env.
 */
import type { McpConnection } from './client.js';
import {
  fetchNodes,
  fetchVariables,
  parseFigmaUrl,
  type ClientOptions,
} from '../rest/fetch.js';
import {
  mapRestToDump,
  type MapResult,
  type RestNode,
  type RestNodesResponse,
  type RestPaint,
  type RestVariableAlias,
  type RestVariablesResponse,
} from '../rest/map.js';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** get_variable_defs payload: flat name → resolved value, subtree-scoped.
 *  Observed value spellings: `#dbeafe` / `#0000330f` (colors), `"12"` (numbers
 *  as strings), `Font(family: …)` (text styles), `Effect(…)`, `""`. */
export type VariableDefs = Record<string, string>;

/** nodeId → defs. Implementations: live MCP call (importFromUrlViaMcp) or
 *  fixture replay (replayImport). Results are cached per node id. */
export type VariableDefsLookup = (nodeId: string) => Promise<VariableDefs>;

/** One VARIABLE_ALIAS the mapper will consume, with its join literal. */
export interface AliasOccurrence {
  variableId: string;
  nodeId: string;
  /** Same spelling as map.ts report paths: `Set:variant/child/…`. */
  nodePath: string;
  /** Dump-side field name (fill, stroke, paddingLeft, width, …). */
  field: string;
  /** The resolved literal to join on: `rrggbb` (lowercase, no #) for paints,
   *  a number for dimensions. Undefined = no literal on the REST node — the
   *  occurrence cannot vote in the join. */
  value: string | number | undefined;
}

export interface AugmentResolution {
  variableId: string;
  name: string;
  via: 'rest-variables' | 'set-scope' | 'node-scope';
  occurrences: number;
}

export interface AugmentUnresolved {
  variableId: string;
  reason: string;
  /** Candidate NAMES the join could not choose between (reported, never guessed). */
  candidates: string[];
  occurrences: Array<Pick<AliasOccurrence, 'nodePath' | 'field' | 'value'>>;
}

export interface AugmentReport {
  resolved: AugmentResolution[];
  unresolved: AugmentUnresolved[];
  /** get_variable_defs calls made (set-scope + per-node refinements). */
  defsCalls: number;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Occurrence collection — mirrors exactly what map.ts consumes
// ---------------------------------------------------------------------------

/** Raw-response fields the join needs beyond the mapper's RestNode view. */
interface RawRestNode extends RestNode {
  absoluteBoundingBox?: { width?: number; height?: number };
  individualStrokeWeights?: { top?: number; right?: number; bottom?: number; left?: number };
  children?: RawRestNode[];
}

const isAlias = (v: unknown): v is RestVariableAlias =>
  typeof v === 'object' && v !== null && (v as RestVariableAlias).type === 'VARIABLE_ALIAS';

/** Mirror of rest/map.ts rgbToHex: 0–1 channels → lowercase rrggbb. */
const rgbToHex = (c: { r: number; g: number; b: number }): string => {
  const h = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return h(c.r) + h(c.g) + h(c.b);
};

/** map.ts BOUND_FIELDS_SKIPPED — paint/text bindings ride their own channels. */
const BOUND_FIELDS_SKIPPED = new Set(['fills', 'strokes', 'characters', 'textRangeFills', 'componentProperties', 'effects', 'layoutGrids']);

/** Nested boundVariables groups → [dump field, literal getter]. Spellings per
 *  rest/map.ts NESTED_BOUND_FIELDS; the literal is the node's resolved value
 *  for that same field. rectangleCornerRadii order per spec: [TL, TR, BR, BL]. */
const NESTED_LITERALS: Record<string, Record<string, [string, (n: RawRestNode) => number | undefined]>> = {
  size: {
    x: ['width', (n) => n.absoluteBoundingBox?.width],
    y: ['height', (n) => n.absoluteBoundingBox?.height],
  },
  individualStrokeWeights: {
    top: ['strokeTopWeight', (n) => n.individualStrokeWeights?.top ?? n.strokeWeight],
    right: ['strokeRightWeight', (n) => n.individualStrokeWeights?.right ?? n.strokeWeight],
    bottom: ['strokeBottomWeight', (n) => n.individualStrokeWeights?.bottom ?? n.strokeWeight],
    left: ['strokeLeftWeight', (n) => n.individualStrokeWeights?.left ?? n.strokeWeight],
  },
  rectangleCornerRadii: {
    RECTANGLE_TOP_LEFT_CORNER_RADIUS: ['topLeftRadius', (n) => n.rectangleCornerRadii?.[0] ?? n.cornerRadius],
    RECTANGLE_TOP_RIGHT_CORNER_RADIUS: ['topRightRadius', (n) => n.rectangleCornerRadii?.[1] ?? n.cornerRadius],
    RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS: ['bottomLeftRadius', (n) => n.rectangleCornerRadii?.[3] ?? n.cornerRadius],
    RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS: ['bottomRightRadius', (n) => n.rectangleCornerRadii?.[2] ?? n.cornerRadius],
  },
};

function collectPaintAlias(
  paints: RestPaint[] | undefined,
  node: RawRestNode,
  nodePath: string,
  field: 'fill' | 'stroke',
  out: AliasOccurrence[],
): void {
  if (!Array.isArray(paints)) return;
  // The mapper's selection rule: first visible SOLID paint.
  const p = paints.find((x) => x.visible !== false && x.type === 'SOLID');
  const alias = p?.boundVariables?.color;
  if (!p || !alias || !isAlias(alias)) return;
  out.push({
    variableId: alias.id,
    nodeId: node.id,
    nodePath,
    field,
    value: p.color ? rgbToHex(p.color) : undefined,
  });
}

function collectNode(node: RawRestNode, nodePath: string, out: AliasOccurrence[]): void {
  collectPaintAlias(node.fills, node, nodePath, 'fill', out);
  collectPaintAlias(node.strokes, node, nodePath, 'stroke', out);

  for (const [field, value] of Object.entries(node.boundVariables ?? {})) {
    if (value === undefined || BOUND_FIELDS_SKIPPED.has(field)) continue;
    const nested = NESTED_LITERALS[field];
    if (nested) {
      for (const [key, [dumpField, literal]] of Object.entries(nested)) {
        const alias = (value as Record<string, RestVariableAlias | undefined>)[key];
        if (!alias || !isAlias(alias)) continue;
        out.push({ variableId: alias.id, nodeId: node.id, nodePath, field: dumpField, value: literal(node) });
      }
      continue;
    }
    if (Array.isArray(value) || !isAlias(value)) continue;
    const literal = (node as unknown as Record<string, unknown>)[field];
    out.push({
      variableId: value.id,
      nodeId: node.id,
      nodePath,
      field,
      value: typeof literal === 'number' ? literal : undefined,
    });
  }

  if (node.type === 'INSTANCE') return; // internals belong to the child contract
  for (const child of node.children ?? []) collectNode(child, `${nodePath}/${child.name}`, out);
}

/** Every alias the mapper will consume, per COMPONENT_SET/COMPONENT document,
 *  with the document's own node id (the set-scope defs target). */
export function collectAliasOccurrences(
  nodesResponse: RestNodesResponse,
  target?: string,
): Array<{ docId: string; docName: string; occurrences: AliasOccurrence[] }> {
  const out: Array<{ docId: string; docName: string; occurrences: AliasOccurrence[] }> = [];
  for (const entry of Object.values(nodesResponse.nodes ?? {})) {
    if (!entry) continue;
    const doc = entry.document as RawRestNode;
    if (doc.type !== 'COMPONENT_SET' && doc.type !== 'COMPONENT') continue;
    if (doc.name === 'Slot') continue;
    if (target && doc.name !== target) continue;
    const occurrences: AliasOccurrence[] = [];
    const variants = doc.type === 'COMPONENT_SET' ? (doc.children ?? []) : [doc];
    for (const variant of variants) collectNode(variant, `${doc.name}:${variant.name}`, occurrences);
    out.push({ docId: doc.id, docName: doc.name, occurrences });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The value join
// ---------------------------------------------------------------------------

/** Does an MCP def value denote this occurrence literal? Colors compare on
 *  the leading rrggbb (defs may carry rrggbbaa; dump paints are opaque hex);
 *  numbers compare numerically ("12" ↔ 12). Font(…)/Effect(…)/"" never match
 *  a dump-consumed literal. */
export function valueMatches(defValue: string, occValue: string | number): boolean {
  if (typeof occValue === 'number') {
    if (defValue === '' || defValue.startsWith('#')) return false;
    const n = Number(defValue);
    return !Number.isNaN(n) && n === occValue;
  }
  if (!defValue.startsWith('#')) return false;
  const hex = defValue.slice(1).toLowerCase();
  return hex === occValue || (hex.length === 8 && hex.slice(0, 6) === occValue);
}

const candidatesIn = (defs: VariableDefs, value: string | number): Set<string> => {
  const names = new Set<string>();
  for (const [name, defValue] of Object.entries(defs)) {
    if (valueMatches(defValue, value)) names.add(name);
  }
  return names;
};

const intersect = (sets: Set<string>[]): Set<string> =>
  sets.length === 0 ? new Set() : sets.reduce((acc, s) => new Set([...acc].filter((x) => s.has(x))));

export interface ResolveOptions {
  /** Only join within the set/component with this name. */
  target?: string;
  /** id → name already known (the Enterprise variables endpoint answered) —
   *  these ids skip the MCP join and are reported via 'rest-variables'. */
  knownNames?: Map<string, string>;
}

/**
 * The whole join: occurrences → id→name table + receipt. Set-scope defs are
 * fetched once per document; per-node defs only for ids the set scope left
 * ambiguous. Every lookup result is memoized, so a fixture replay is exactly
 * as many "calls" as the live run made.
 */
export async function resolveVariableNames(
  nodesResponse: RestNodesResponse,
  lookup: VariableDefsLookup,
  opts: ResolveOptions = {},
): Promise<{ variables: RestVariablesResponse; report: AugmentReport }> {
  const report: AugmentReport = { resolved: [], unresolved: [], defsCalls: 0, notes: [] };
  const defsCache = new Map<string, VariableDefs>();
  const getDefs = async (nodeId: string): Promise<VariableDefs> => {
    const cached = defsCache.get(nodeId);
    if (cached) return cached;
    report.defsCalls++;
    const defs = await lookup(nodeId);
    defsCache.set(nodeId, defs);
    return defs;
  };

  const known = opts.knownNames ?? new Map<string, string>();
  const nameById = new Map<string, string>(known);

  for (const { docId, docName, occurrences } of collectAliasOccurrences(nodesResponse, opts.target)) {
    const byId = new Map<string, AliasOccurrence[]>();
    for (const occ of occurrences) {
      byId.set(occ.variableId, [...(byId.get(occ.variableId) ?? []), occ]);
    }
    if (byId.size === 0) continue;
    const unknownIds: string[] = [];
    for (const [id, occ] of byId) {
      if (known.has(id)) report.resolved.push({ variableId: id, name: known.get(id)!, via: 'rest-variables', occurrences: occ.length });
      else unknownIds.push(id);
    }
    if (unknownIds.length === 0) continue;

    const setDefs = await getDefs(docId);
    for (const id of unknownIds) {
      const occ = byId.get(id)!;
      const voting = occ.filter((o): o is AliasOccurrence & { value: string | number } => o.value !== undefined);
      const strip = (o: AliasOccurrence) => ({ nodePath: o.nodePath, field: o.field, value: o.value });
      if (voting.length === 0) {
        report.unresolved.push({
          variableId: id,
          reason: `no resolved literal on any of its ${occ.length} REST occurrence(s) — nothing to join on`,
          candidates: [],
          occurrences: occ.map(strip),
        });
        continue;
      }

      // Set scope first — one defs call covers most ids.
      const setCands = intersect(voting.map((o) => candidatesIn(setDefs, o.value)));
      let name: string | undefined;
      let via: AugmentResolution['via'] = 'set-scope';
      let finalCands = setCands;
      if (setCands.size === 1) {
        name = [...setCands][0];
      } else {
        // Node scope: the defs of each occurrence's own node list only the
        // variables its subtree uses — usually a singleton candidate set.
        const nodeCands = await Promise.all(
          voting.map(async (o) => candidatesIn(await getDefs(o.nodeId), o.value)),
        );
        const narrowed = intersect(setCands.size > 0 ? [setCands, ...nodeCands] : nodeCands);
        finalCands = narrowed;
        if (narrowed.size === 1) {
          name = [...narrowed][0];
          via = 'node-scope';
        }
      }

      if (name !== undefined) {
        nameById.set(id, name);
        report.resolved.push({ variableId: id, name, via, occurrences: occ.length });
      } else {
        report.unresolved.push({
          variableId: id,
          reason:
            finalCands.size === 0
              ? 'no variable in the MCP defs carries this value — the value join has no candidate'
              : `value ${JSON.stringify(voting[0].value)} matches ${finalCands.size} variables even at node scope — ambiguous, not guessed`,
          candidates: [...finalCands].sort(),
          occurrences: occ.map(strip),
        });
      }
    }
    report.notes.push(`${docName}: ${byId.size} distinct variable id(s) across ${occurrences.length} bound occurrence(s)`);
  }

  // A value join that lands two different ids on the SAME name proved itself
  // wrong at least once (two variables, one value, one name won both) — demote
  // both to unresolved rather than ship a coin-flip.
  const idsByName = new Map<string, string[]>();
  for (const [id, name] of nameById) {
    if (known.has(id)) continue;
    idsByName.set(name, [...(idsByName.get(name) ?? []), id]);
  }
  for (const [name, ids] of idsByName) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      nameById.delete(id);
      const i = report.resolved.findIndex((r) => r.variableId === id);
      if (i >= 0) report.resolved.splice(i, 1);
      report.unresolved.push({
        variableId: id,
        reason: `value join landed ${ids.length} distinct variable ids on the same name "${name}" — collision, none kept`,
        candidates: [name],
        occurrences: [],
      });
    }
  }

  const variables: RestVariablesResponse = {
    meta: {
      variables: Object.fromEntries([...nameById].map(([id, name]) => [id, { id, name }])),
    },
  };
  return { variables, report };
}

// ---------------------------------------------------------------------------
// Whole-path orchestration + fixture recording / replay
// ---------------------------------------------------------------------------

/** Everything a later replay needs to reproduce the run byte-for-byte. */
export interface McpImportFixture {
  url: string;
  fileKey: string | null;
  nodeId: string;
  /** GET /v1/files/:key/nodes response, as fetched. */
  nodes: RestNodesResponse;
  /** Present only when the Enterprise variables endpoint answered. */
  restVariables?: RestVariablesResponse;
  /** Live get_variable_defs responses, keyed by the node id asked for. */
  variableDefs: Record<string, VariableDefs>;
}

export interface McpImportResult extends MapResult {
  augment: AugmentReport;
  fixture: McpImportFixture;
}

/** The Dev Mode server refused a tool call (node not in the active tab, …). */
export class McpToolError extends Error {}

export interface McpImportOptions extends ClientOptions {
  target?: string;
}

/**
 * URL + REST token + live MCP connection → dump v1 (+ receipts + fixture).
 *
 * Desktop UX constraint, verified live: the Dev Mode MCP server answers only
 * for the document open in the desktop app's ACTIVE tab — tools take a bare
 * nodeId, no file key. A miss surfaces as an McpToolError carrying the
 * server's own wording; callers should tell the user to open the file.
 */
export async function importFromUrlViaMcp(
  url: string,
  token: string,
  mcp: Pick<McpConnection, 'callTool'>,
  opts: McpImportOptions = {},
): Promise<McpImportResult> {
  const parsed = parseFigmaUrl(url);
  if (!parsed.nodeId) {
    throw new Error(
      'The MCP import path targets a node — use a URL with ?node-id=… (in Figma: select the component set, right-click → Copy link to selection).',
    );
  }
  const clientOpts: ClientOptions = { ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}), ...(opts.apiBase ? { apiBase: opts.apiBase } : {}) };
  const nodes = await fetchNodes(parsed.fileKey, [parsed.nodeId], token, clientOpts);
  const restVariables = await fetchVariables(parsed.fileKey, token, clientOpts);

  const fixture: McpImportFixture = {
    url,
    fileKey: parsed.fileKey,
    nodeId: parsed.nodeId,
    nodes,
    ...(restVariables ? { restVariables } : {}),
    variableDefs: {},
  };

  const lookup: VariableDefsLookup = async (nodeId) => {
    const result = await mcp.callTool('get_variable_defs', { nodeId, clientLanguages: 'typescript', clientFrameworks: 'react' });
    if (result.isError) throw new McpToolError(result.text);
    let defs: VariableDefs;
    try {
      defs = JSON.parse(result.text) as VariableDefs;
    } catch {
      throw new McpToolError(`get_variable_defs(${nodeId}) returned non-JSON text: ${result.text.slice(0, 200)}`);
    }
    fixture.variableDefs[nodeId] = defs;
    return defs;
  };

  const knownNames = new Map<string, string>();
  for (const [id, v] of Object.entries(restVariables?.meta?.variables ?? {})) knownNames.set(v.id ?? id, v.name);

  const { variables, report: augment } = await resolveVariableNames(nodes, lookup, {
    ...(opts.target ? { target: opts.target } : {}),
    knownNames,
  });
  const { dump, report } = mapRestToDump(nodes, {
    variables,
    ...(opts.target ? { target: opts.target } : {}),
    fileKey: parsed.fileKey,
  });
  return { dump, report, augment, fixture };
}

/**
 * Replay a recorded fixture through the exact live code path — no network, no
 * desktop app. A defs request the live run never made (fixture miss) throws:
 * the replay must not be able to see MORE than the live run did.
 */
export async function replayImport(fixture: McpImportFixture, opts: { target?: string } = {}): Promise<Omit<McpImportResult, 'fixture'>> {
  const lookup: VariableDefsLookup = async (nodeId) => {
    const defs = fixture.variableDefs[nodeId];
    if (!defs) throw new Error(`fixture has no get_variable_defs recording for node ${nodeId} — the live run never asked`);
    return defs;
  };
  const knownNames = new Map<string, string>();
  for (const [id, v] of Object.entries(fixture.restVariables?.meta?.variables ?? {})) knownNames.set(v.id ?? id, v.name);
  const { variables, report: augment } = await resolveVariableNames(fixture.nodes, lookup, {
    ...(opts.target ? { target: opts.target } : {}),
    knownNames,
  });
  const { dump, report } = mapRestToDump(fixture.nodes, {
    variables,
    ...(opts.target ? { target: opts.target } : {}),
    fileKey: fixture.fileKey,
  });
  return { dump, report, augment };
}
