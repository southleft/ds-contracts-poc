/**
 * Figma REST access for the visual-parity harness — variant enumeration
 * (nodes API) and ground-truth PNGs (images API), disk-cached so a re-run is
 * resumable and an unchanged file costs zero image renders.
 *
 * Cache layout (under out/_cache/, gitignored):
 *   nodes-<fileKey>-<setId>.json          full set subtree + file version
 *   png-<fileKey>-<setId>-<nodeId>@v<version>@2x.png
 *
 * PNGs are keyed by node + FILE VERSION (the nodes response carries it), so
 * an edited file re-fetches and an untouched one replays from disk. Pass
 * --refresh to re-fetch the nodes JSON (and thereby pick up a new version).
 *
 * Politeness: node ids are batched per call (comma-separated ids — one nodes
 * call and one images call per file per run, chunked at 30 ids), with a
 * fixed inter-call delay and one retry on 429.
 *
 * The token comes from .env.local / env (fidelity-matrix env.ts) — node-side
 * only, NEVER printed, never written into any artifact.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { figmaToken } from '../../fidelity-matrix/scripts/env.js';

const API_DELAY_MS = 700;
const IDS_PER_CALL = 30;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** REST node subtree — only the fields the harness reads. */
export interface RestNode {
  id: string;
  name: string;
  type: string;
  style?: { fontFamily?: string };
  children?: RestNode[];
}

export interface SetInfo {
  fileKey: string;
  setId: string;
  setName: string;
  /** File version the subtree was fetched at (PNG cache key component). */
  version: string;
  /** The set's variant COMPONENT children, canvas order. */
  variants: Array<{ nodeId: string; name: string }>;
  /** Every distinct fontFamily on TEXT nodes inside the set. */
  fontFamilies: string[];
}

async function figmaFetch(url: string): Promise<Response> {
  const headers = { 'X-Figma-Token': figmaToken() };
  let res = await fetch(url, { headers });
  if (res.status === 429) {
    const wait = Number(res.headers.get('retry-after') ?? '5') * 1000;
    console.log(`    figma API 429 — backing off ${wait}ms`);
    await sleep(wait);
    res = await fetch(url, { headers });
  }
  return res;
}

const collectFonts = (node: RestNode, into: Set<string>): void => {
  if (node.type === 'TEXT' && node.style?.fontFamily) into.add(node.style.fontFamily);
  for (const c of node.children ?? []) collectFonts(c, into);
};

/**
 * Enumerate the variant COMPONENT children (and font families) of each set,
 * one nodes call per fileKey. Cached per set; `refresh` re-fetches.
 */
export async function fetchSetInfos(
  cacheDir: string,
  fileKey: string,
  setIds: string[],
  refresh: boolean,
): Promise<Map<string, SetInfo>> {
  mkdirSync(cacheDir, { recursive: true });
  const out = new Map<string, SetInfo>();
  const cachePath = (setId: string) =>
    path.join(cacheDir, `nodes-${fileKey}-${setId.replace(/:/g, '_')}.json`);

  const missing = setIds.filter((id) => refresh || !existsSync(cachePath(id)));
  if (missing.length > 0) {
    const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(missing.join(','))}`;
    const res = await figmaFetch(url);
    if (!res.ok) throw new Error(`nodes API ${res.status} for file ${fileKey} (ids ${missing.join(', ')})`);
    const body = (await res.json()) as {
      version?: string;
      nodes: Record<string, { document: RestNode } | null>;
    };
    for (const setId of missing) {
      const entry = body.nodes[setId];
      if (!entry) throw new Error(`nodes API returned no node for ${fileKey} ${setId} — anchor stale?`);
      writeFileSync(
        cachePath(setId),
        JSON.stringify({ version: body.version ?? 'unversioned', document: entry.document }, null, 1),
      );
    }
    await sleep(API_DELAY_MS);
  }

  for (const setId of setIds) {
    const { version, document } = JSON.parse(readFileSync(cachePath(setId), 'utf8')) as {
      version: string;
      document: RestNode;
    };
    const fonts = new Set<string>();
    collectFonts(document, fonts);
    const variants =
      document.type === 'COMPONENT_SET'
        ? (document.children ?? [])
            .filter((c) => c.type === 'COMPONENT')
            .map((c) => ({ nodeId: c.id, name: c.name }))
        : [{ nodeId: document.id, name: document.name }]; // standalone COMPONENT
    out.set(setId, {
      fileKey,
      setId,
      setName: document.name,
      version,
      variants,
      fontFamilies: [...fonts].sort(),
    });
  }
  return out;
}

/**
 * Fetch scale=2 PNGs for the given nodes (all in one file), disk-cached by
 * node + file version. Returns nodeId → absolute PNG path (null when the
 * images API declined to render the node — reported, never guessed).
 */
export async function fetchNodePngs(
  cacheDir: string,
  fileKey: string,
  setId: string,
  version: string,
  nodeIds: string[],
): Promise<Map<string, string | null>> {
  mkdirSync(cacheDir, { recursive: true });
  const pngPath = (nodeId: string) =>
    path.join(
      cacheDir,
      `png-${fileKey}-${setId.replace(/:/g, '_')}-${nodeId.replace(/[:;]/g, '_')}@v${version}@2x.png`,
    );

  const out = new Map<string, string | null>();
  const missing = nodeIds.filter((id) => !existsSync(pngPath(id)));

  for (let i = 0; i < missing.length; i += IDS_PER_CALL) {
    const chunk = missing.slice(i, i + IDS_PER_CALL);
    const url = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(chunk.join(','))}&format=png&scale=2`;
    const res = await figmaFetch(url);
    if (!res.ok) throw new Error(`images API ${res.status} for file ${fileKey}`);
    const body = (await res.json()) as { images: Record<string, string | null> };
    for (const nodeId of chunk) {
      const imageUrl = body.images[nodeId];
      if (!imageUrl) {
        out.set(nodeId, null);
        continue;
      }
      const png = await fetch(imageUrl);
      if (!png.ok) throw new Error(`image download ${png.status} for ${fileKey} ${nodeId}`);
      writeFileSync(pngPath(nodeId), Buffer.from(await png.arrayBuffer()));
    }
    await sleep(API_DELAY_MS);
  }

  for (const nodeId of nodeIds) {
    if (out.get(nodeId) === null) continue; // declined above
    out.set(nodeId, existsSync(pngPath(nodeId)) ? pngPath(nodeId) : null);
  }
  return out;
}
