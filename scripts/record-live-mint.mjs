#!/usr/bin/env node
/**
 * Record a live mint in its evidence receipt from the writer's raw MCP
 * output: liveFigma, pageId, url, and the per-source node ids. These are the
 * NON-owned receipt fields — prepare preserves them and --check ignores them
 * (recipe/live-proof-evidence.ts), so recording a mint is safe and a re-run
 * of prepare no longer downgrades it.
 *
 *   node scripts/record-live-mint.mjs --evidence recipe/evidence/alert-live-pivot-v3 \
 *     --raw private/alert-v3b-writer.raw.json [--superseded-by alert-live-pivot-v4]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
const evidence = arg("evidence"), raw = arg("raw"), supersededBy = arg("superseded-by");
if (!evidence || !raw) throw new Error("usage: --evidence <dir> --raw <writer.raw.json> [--superseded-by <dir>]");
const out = JSON.parse(readFileSync(raw, "utf8"));
if (out.success !== true || !out.result?.pageId) throw new Error(`${raw}: not a successful mint`);
const r = out.result;
const receiptPath = path.join(evidence, "receipt.json");
const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
if (receipt.runIdentity !== r.runIdentity) throw new Error(`run identity mismatch: receipt ${receipt.runIdentity} vs raw ${r.runIdentity}`);
receipt.liveFigma = true;
receipt.pageId = r.pageId;
receipt.url = `https://www.figma.com/design/${r.fileKey}/Scratch-Project?node-id=${r.pageId.replace(":", "-")}`;
receipt.live = {
  recordedFrom: path.basename(raw),
  fileKey: r.fileKey,
  pageName: r.pageName,
  sources: (r.sources ?? []).map((s) => ({ adapterIdentity: s.adapterIdentity, sectionId: s.sectionId, setId: s.setId ?? s.componentId ?? null, collectionId: s.collectionId, variantCount: s.variantCount, comparedIrFacts: s.comparedIrFacts })),
};
if (supersededBy) receipt.supersededBy = supersededBy;
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`recorded ${evidence} ← ${r.pageId}${supersededBy ? ` (superseded by ${supersededBy})` : ""}`);
