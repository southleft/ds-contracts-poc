/**
 * Thin Figma REST client for the no-plugin import path: figma.com URL + user
 * token → dump v1 (via extract/figma/rest/map.ts).
 *
 * Browser-pure by construction: global `fetch` only (injectable), no node
 * builtins, no process.env at module scope — a playground page can import
 * this directly. The CLI wrapper (extract/figma/rest/cli.ts) owns the
 * filesystem and env concerns.
 *
 * Endpoints (https://www.figma.com/developers/api):
 *   GET /v1/files/:key/nodes?ids=…        node documents + components/styles metadata
 *   GET /v1/files/:key/variables/local    variable id → name (Enterprise-only; 403 is
 *                                         an expected DEGRADATION, not an error)
 *   GET /v1/files/:key                    full document — only when the URL has no
 *                                         node-id and the target set must be found by name
 */
import {
  mapRestToDump,
  type MapOptions,
  type MapResult,
  type RestNode,
  type RestNodesResponse,
  type RestVariablesResponse,
} from './map.js';

export const FIGMA_API_BASE = 'https://api.figma.com';

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

export interface ParsedFigmaUrl {
  /** The key API calls use — the branch key when the URL is a branch URL. */
  fileKey: string;
  /** The main file's key (differs from fileKey only on branch URLs). */
  mainFileKey: string;
  branchKey?: string;
  /** API-form node id ("123:456") — URLs spell it "123-456". */
  nodeId?: string;
}

/**
 * Accepts the figma.com URL forms that carry a file:
 *   https://www.figma.com/file/:key/:title?node-id=1-23
 *   https://www.figma.com/design/:key/:title?node-id=1-23
 *   https://www.figma.com/design/:key/branch/:branchKey/:title
 *   https://www.figma.com/proto|board/:key/…
 * node-id URL encoding: "1-23" (and %3A) ↔ API "1:23".
 */
export function parseFigmaUrl(url: string): ParsedFigmaUrl {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`Not a URL: ${url}`);
  }
  if (!/(^|\.)figma\.com$/.test(u.hostname)) {
    throw new Error(`Not a figma.com URL: ${u.hostname}`);
  }
  const segments = u.pathname.split('/').filter(Boolean);
  const kind = segments[0];
  if (!['file', 'design', 'proto', 'board'].includes(kind) || !segments[1]) {
    throw new Error(
      `Unrecognized figma.com URL shape "/${segments.join('/')}" — expected /file/:key/…, /design/:key/…, /design/:key/branch/:branchKey/…, /proto/:key/… or /board/:key/…`,
    );
  }
  const mainFileKey = segments[1];
  const branchKey = segments[2] === 'branch' && segments[3] ? segments[3] : undefined;
  const rawNodeId = u.searchParams.get('node-id') ?? undefined;
  return {
    fileKey: branchKey ?? mainFileKey,
    mainFileKey,
    ...(branchKey ? { branchKey } : {}),
    ...(rawNodeId ? { nodeId: decodeURIComponent(rawNodeId).replace(/-/g, ':') } : {}),
  };
}

// ---------------------------------------------------------------------------
// Endpoint calls
// ---------------------------------------------------------------------------

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface ClientOptions {
  /** Injectable for tests / non-browser runtimes. Defaults to global fetch. */
  fetchImpl?: FetchLike;
  apiBase?: string;
}

async function get(path: string, token: string, opts: ClientOptions): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const res = await fetchImpl(`${opts.apiBase ?? FIGMA_API_BASE}${path}`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Figma API ${res.status} on ${path}${body ? ` — ${body.slice(0, 200)}` : ''}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchNodes(
  fileKey: string,
  nodeIds: string[],
  token: string,
  opts: ClientOptions = {},
): Promise<RestNodesResponse> {
  const ids = encodeURIComponent(nodeIds.join(','));
  return (await get(`/v1/files/${fileKey}/nodes?ids=${ids}`, token, opts)) as RestNodesResponse;
}

/**
 * Local variables — Enterprise-only. A 403 (plan) or 404 is the EXPECTED
 * degraded path: returns undefined and the mapper names every consequence as
 * a variable-unresolved report entry with the resolved value used instead.
 */
export async function fetchVariables(
  fileKey: string,
  token: string,
  opts: ClientOptions = {},
): Promise<RestVariablesResponse | undefined> {
  try {
    return (await get(`/v1/files/${fileKey}/variables/local`, token, opts)) as RestVariablesResponse;
  } catch (e) {
    const status = (e as Error & { status?: number }).status;
    if (status === 403 || status === 404) return undefined;
    throw e;
  }
}

interface RestFileResponse {
  name?: string;
  document?: RestNode;
  components?: Record<string, { name: string; componentSetId?: string; key?: string }>;
  componentSets?: Record<string, { name: string; key?: string }>;
  styles?: Record<string, { name: string; styleType?: string }>;
}

export async function fetchFile(fileKey: string, token: string, opts: ClientOptions = {}): Promise<RestFileResponse> {
  return (await get(`/v1/files/${fileKey}`, token, opts)) as RestFileResponse;
}

// ---------------------------------------------------------------------------
// URL → dump
// ---------------------------------------------------------------------------

export interface ImportOptions extends ClientOptions {
  /** Set/component name to map when the URL has no node-id (or to filter). */
  target?: string;
}

const findSets = (node: RestNode, out: RestNode[] = []): RestNode[] => {
  if (node.type === 'COMPONENT_SET' || node.type === 'COMPONENT') {
    // Variants live inside their set; the set is the unit.
    out.push(node);
    if (node.type === 'COMPONENT_SET') return out;
  }
  for (const child of node.children ?? []) findSets(child, out);
  return out;
};

/**
 * The whole no-plugin path: parse the URL, pull the component set, tolerate
 * the variables endpoint being unavailable, and map to dump v1 + MapReport.
 */
export async function importFromUrl(url: string, token: string, opts: ImportOptions = {}): Promise<MapResult> {
  const parsed = parseFigmaUrl(url);
  const variables = await fetchVariables(parsed.fileKey, token, opts);
  const mapOptions: MapOptions = {
    ...(variables ? { variables } : {}),
    ...(opts.target ? { target: opts.target } : {}),
    fileKey: parsed.fileKey,
  };

  if (parsed.nodeId) {
    const nodes = await fetchNodes(parsed.fileKey, [parsed.nodeId], token, opts);
    return mapRestToDump(nodes, mapOptions);
  }

  // No node-id: fetch the document and synthesize a nodes-response around the
  // sets found (by name when a target is given, all sets otherwise).
  const file = await fetchFile(parsed.fileKey, token, opts);
  if (!file.document) throw new Error(`GET /v1/files/${parsed.fileKey} returned no document`);
  const sets = findSets(file.document).filter((s) => (opts.target ? s.name === opts.target : true));
  if (sets.length === 0) {
    throw new Error(
      opts.target
        ? `No COMPONENT_SET or COMPONENT named "${opts.target}" in ${file.name ?? parsed.fileKey} — pass a node-id URL or a valid --target`
        : `No COMPONENT_SET or COMPONENT in ${file.name ?? parsed.fileKey}`,
    );
  }
  const synthesized: RestNodesResponse = {
    name: file.name,
    nodes: Object.fromEntries(
      sets.map((s) => [
        s.id,
        { document: s, components: file.components, componentSets: file.componentSets, styles: file.styles },
      ]),
    ),
  };
  return mapRestToDump(synthesized, mapOptions);
}
