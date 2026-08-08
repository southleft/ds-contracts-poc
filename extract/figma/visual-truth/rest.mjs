/**
 * Track-1 headless REST access for visual-truth — no desktop app, no plugin
 * bridge. Two endpoints only:
 *
 *   GET /v1/files/<fileKey>/nodes?ids=…&depth=1   set subtree (variant cells)
 *   GET /v1/images/<fileKey>?ids=…&format=png&scale=2   Figma's own renders
 *
 * Politeness: ids are batched comma-separated (IDS_PER_CALL per request),
 * fixed inter-call delay, retry with backoff on 429 (honors Retry-After).
 *
 * Cache (gitignored — lives under extract/figma/visual-parity/out/ which is
 * already ignored): nodes JSON keyed by fileKey + id-set hash, PNGs keyed by
 * fileKey + nodeId + FILE VERSION + scale, so an untouched file replays from
 * disk and an edited file re-fetches.
 *
 * The token comes from env / .env / .env.local — NEVER printed, never written
 * into any artifact.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const API_DELAY_MS = 700;
const IDS_PER_CALL = 30;
const MAX_429_RETRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function figmaToken(root) {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN;
  for (const f of [".env", ".env.local"]) {
    const p = path.join(root, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(
      /^FIGMA_TOKEN\s*=\s*"?([^"\n]+)"?\s*$/m,
    );
    if (m) return m[1].trim();
  }
  throw new Error(
    "FIGMA_TOKEN not found (env, .env, .env.local) — the headless run needs it; visual-truth:check does not",
  );
}

async function figmaFetch(url, token) {
  const headers = { "X-Figma-Token": token };
  let res = await fetch(url, { headers });
  for (let attempt = 0; res.status === 429 && attempt < MAX_429_RETRIES; attempt++) {
    const wait = Number(res.headers.get("retry-after") ?? "5") * 1000;
    console.log(`    figma API 429 — backing off ${wait}ms`);
    await sleep(wait);
    res = await fetch(url, { headers });
  }
  return res;
}

const idsHash = (ids, depth) =>
  createHash("sha256")
    .update(`${depth}:${[...ids].sort().join(",")}`)
    .digest("hex")
    .slice(0, 12);

/**
 * Fetch node documents (depth-limited subtrees) for a set of ids in one file.
 * Returns { ok:true, version, nodes: Map<id, doc|null> } — doc null when the
 * REST API no longer knows the id (stale nodeId → caller emits a named SKIP).
 * Returns { ok:false, status } on 403/404 etc (lane-level named SKIP).
 */
export async function fetchNodes(cacheDir, token, fileKey, ids, { refresh = false, depth = 1 } = {}) {
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, `nodes-${fileKey}-${idsHash(ids, depth)}.json`);
  if (refresh || !existsSync(cachePath)) {
    const all = {};
    let version = "unversioned";
    for (let i = 0; i < ids.length; i += IDS_PER_CALL) {
      const chunk = ids.slice(i, i + IDS_PER_CALL);
      const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(chunk.join(","))}&depth=${depth}`;
      const res = await figmaFetch(url, token);
      if (!res.ok) return { ok: false, status: res.status };
      const body = await res.json();
      version = body.version ?? version;
      for (const id of chunk) {
        const entry = body.nodes?.[id];
        all[id] = entry ? entry.document : null;
      }
      await sleep(API_DELAY_MS);
    }
    writeFileSync(cachePath, JSON.stringify({ version, nodes: all }, null, 1));
  }
  const { version, nodes } = JSON.parse(readFileSync(cachePath, "utf8"));
  return { ok: true, version, nodes: new Map(Object.entries(nodes)) };
}

/**
 * Fetch scale=2 PNG renders for nodes in one file, cached by node + file
 * version. Returns { ok:true, paths: Map<id, absPngPath|null> } — null when
 * the images API declined to render the id (stale/gone → named SKIP).
 * Returns { ok:false, status } when the images call itself is denied.
 */
export async function fetchImages(cacheDir, token, fileKey, version, nodeIds) {
  mkdirSync(cacheDir, { recursive: true });
  const pngPath = (id) =>
    path.join(cacheDir, `png-${fileKey}-${id.replace(/[:;]/g, "_")}@v${version}@2x.png`);
  const declinedPath = (id) => `${pngPath(id)}.declined`;

  const paths = new Map();
  const missing = nodeIds.filter(
    (id) => !existsSync(pngPath(id)) && !existsSync(declinedPath(id)),
  );

  for (let i = 0; i < missing.length; i += IDS_PER_CALL) {
    const chunk = missing.slice(i, i + IDS_PER_CALL);
    const url = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(chunk.join(","))}&format=png&scale=2`;
    const res = await figmaFetch(url, token);
    if (!res.ok) return { ok: false, status: res.status };
    const body = await res.json();
    for (const id of chunk) {
      const imageUrl = body.images?.[id];
      if (!imageUrl) {
        writeFileSync(declinedPath(id), ""); // negative-cache the decline for this version
        continue;
      }
      const png = await fetch(imageUrl);
      if (!png.ok) throw new Error(`image download ${png.status} for ${fileKey} ${id}`);
      writeFileSync(pngPath(id), Buffer.from(await png.arrayBuffer()));
    }
    await sleep(API_DELAY_MS);
  }

  for (const id of nodeIds) {
    paths.set(id, existsSync(pngPath(id)) ? pngPath(id) : null);
  }
  return { ok: true, paths };
}
