/**
 * SYNC OBSERVE — the headless canvas half of the drift arithmetic.
 *
 * Builds `SetObservation`s (sync/ledger.ts) from a Figma REST nodes response:
 *   - the v6 STAMP read back verbatim from sharedPluginData
 *     ds_contracts/canvasFingerprint (REST `plugin_data=shared`) — never
 *     recomputed headlessly (see the domain note in sync/ledger.ts);
 *   - the observation-domain dump fingerprint: djb2 over canonicalJson of the
 *     set's dump-v1 projection via extract/figma/rest/map.ts — the mapper
 *     built to be byte-compatible with the plugin dump, so the channels it
 *     carries are exactly the channels this repo treats as canvas facts.
 *
 * Works identically over a COMMITTED FIXTURE (a saved RestNodesResponse —
 * the gate-shaped offline path, sync:ledger:check) and over the live API
 * (fetchObservation, FIGMA_TOKEN). Pure except fetchObservation.
 */
import {
  mapRestToDump,
  REST_DUMP_VERSION,
  type RestNode,
  type RestNodesResponse,
} from '../extract/figma/rest/map.js';
import { FIGMA_API_BASE, type FetchLike } from '../extract/figma/rest/fetch.js';
import { dumpFingerprint, type SetObservation } from './ledger.js';

/** The REST shape when `plugin_data=shared` rides the query — the typed
 *  RestNode predates plugin data, so the namespace is read defensively. */
type RestNodeWithPluginData = RestNode & {
  sharedPluginData?: Record<string, Record<string, unknown>>;
};

function dsMarker(doc: RestNode, key: string): string | null {
  const ns = (doc as RestNodeWithPluginData).sharedPluginData?.ds_contracts;
  const v = ns?.[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** One RestNodesResponse → observations, one per COMPONENT_SET/COMPONENT
 *  document. PURE and deterministic: the dump's volatile `_provenance`
 *  sibling (it carries extractedAt) never enters the fingerprint — only the
 *  per-set dump entry does. */
export function observationsFromRestNodes(
  response: RestNodesResponse,
  fileKey: string | null,
  fileVersionId: string | null,
): SetObservation[] {
  const out: SetObservation[] = [];
  for (const [id, entry] of Object.entries(response.nodes ?? {})) {
    if (!entry) continue;
    const doc = entry.document;
    if (doc.type !== 'COMPONENT_SET' && doc.type !== 'COMPONENT') continue;
    // Map THIS node alone so name collisions across a big fetch cannot merge
    // two sets into one dump key.
    const single: RestNodesResponse = { name: response.name, nodes: { [id]: entry } };
    const { dump } = mapRestToDump(single, { fileKey });
    const entryDump = (dump as Record<string, unknown>)[doc.name];
    if (entryDump === undefined) continue; // e.g. the "Slot" utility set — mapper skips it by rule
    out.push({
      fileKey,
      setNodeId: doc.id,
      setName: doc.name,
      stamp: dsMarker(doc, 'canvasFingerprint'),
      dumpFingerprint: dumpFingerprint(entryDump),
      dumpVersion: REST_DUMP_VERSION,
      fileVersionId,
    });
  }
  return out.sort((a, b) => (a.setNodeId < b.setNodeId ? -1 : a.setNodeId > b.setNodeId ? 1 : 0));
}

/** A committed observation fixture: the raw RestNodesResponse plus the two
 *  facts the response body itself does not carry. */
export interface ObservationFixture {
  fileKey: string | null;
  /** REST file `version` at capture time (null = fixture carries none). */
  fileVersionId: string | null;
  response: RestNodesResponse;
}

export function observationsFromFixture(fixture: ObservationFixture): SetObservation[] {
  return observationsFromRestNodes(fixture.response, fixture.fileKey, fixture.fileVersionId);
}

// ---------------------------------------------------------------------------
// Live shell — the only impure code in this module.
// ---------------------------------------------------------------------------

const CHUNK = 40; // ids per /nodes call — well under URL limits

/** The raw fetch half of a live observation: file version + the chunked
 *  `/nodes?plugin_data=shared` responses, RETURNED whole so a caller that
 *  needs the full node subtrees (sync pull maps them to dump v1) does not
 *  fetch the same bytes twice. */
export async function fetchNodesResponses(
  fileKey: string,
  nodeIds: readonly string[],
  token: string,
  opts: { fetchImpl?: FetchLike; apiBase?: string } = {},
): Promise<{ responses: RestNodesResponse[]; fileVersionId: string | null }> {
  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const base = opts.apiBase ?? FIGMA_API_BASE;
  // 429 is a rate limit, not a refusal: wait what Figma asks (Retry-After,
  // default 15 s) and retry, bounded. Measured 2026-08-23: ten back-to-back
  // live observes (3 files × 4 chunks each) trip it; without this every
  // later verb in the same minute crashes with exit 2.
  const RETRIES = 5;
  const get = async (p: string): Promise<unknown> => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(`${base}${p}`, { headers: { 'X-Figma-Token': token } });
      if (res.status === 429 && attempt < RETRIES) {
        const headers = (res as { headers?: { get?: (k: string) => string | null } }).headers;
        const after = Number(headers?.get?.('retry-after') ?? '') || 15;
        await res.text().catch(() => '');
        await new Promise((r) => setTimeout(r, after * 1000));
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Figma API ${res.status} on ${p}${body ? ` — ${body.slice(0, 200)}` : ''}`);
      }
      return res.json();
    }
  };
  const file = (await get(`/v1/files/${fileKey}?depth=1`)) as { version?: unknown };
  const fileVersionId = typeof file.version === 'string' ? file.version : null;
  const responses: RestNodesResponse[] = [];
  for (let i = 0; i < nodeIds.length; i += CHUNK) {
    const ids = encodeURIComponent(nodeIds.slice(i, i + CHUNK).join(','));
    responses.push(
      (await get(`/v1/files/${fileKey}/nodes?ids=${ids}&plugin_data=shared`)) as RestNodesResponse,
    );
  }
  return { responses, fileVersionId };
}

export async function fetchObservation(
  fileKey: string,
  nodeIds: readonly string[],
  token: string,
  opts: { fetchImpl?: FetchLike; apiBase?: string } = {},
): Promise<{ observations: SetObservation[]; fileVersionId: string | null }> {
  const { responses, fileVersionId } = await fetchNodesResponses(fileKey, nodeIds, token, opts);
  const observations: SetObservation[] = [];
  for (const response of responses) {
    observations.push(...observationsFromRestNodes(response, fileKey, fileVersionId));
  }
  return { observations, fileVersionId };
}
