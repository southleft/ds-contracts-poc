/**
 * Track-1 HEADLESS canvas-vs-code comparator (visual-truth).
 *
 * With only a FIGMA_TOKEN — no Figma desktop app, no plugin bridge — score
 * every console-loop stem's canvas rendition (Figma REST images API, scale=2)
 * against its code-side reference render, under the SAME bar the receipts
 * gate uses (pctAAMasked ≤ 5 AND compositionOk; see
 * extract/figma/visual-truth/score-policy.mjs, kept in lockstep with
 * console-loop-developed-score.mjs).
 *
 * Usage (run via tsx — it dynamically imports the canvas-gate TS scorer):
 *   npm run visual-truth:run                       # every lane
 *   npm run visual-truth:run -- --lib altitude     # one lane
 *   npm run visual-truth:run -- --lib altitude --stem button
 *   npm run visual-truth:run -- --refresh          # re-fetch nodes (new file version)
 *
 * Per stem:
 *   1. canvas node id ← receipt generate.nodeId; the COMPONENT_SET subtree is
 *      fetched (depth 1) and the VARIANT cell matching the reference's
 *      variant tokens is rendered — like-for-like with the bridge's
 *      shots/<stem>-cell.png discipline. Stale id → named SKIP "node-gone".
 *   2. reference ← receipt.visual.reference → trap-corpus manifest →
 *      gate-shots probe (extract/computed/out/…/gate-shots). None → named
 *      SKIP "no-reference".
 *   3. scored with canvas-gate alignPair/scoreCell + the developed-score
 *      normalization/guard policy.
 *   4. v3-compatible scorecard → parity/receipts/console-loop/visual-truth/
 *      <lane>/<stem>.json with sha256 pins and source:"rest-images-api" so
 *      bridge-scored and headless-scored cards are distinguishable.
 *
 * A lane whose fileKey the token cannot read (403/404) becomes named SKIPs
 * ("file-inaccessible-<status>"), never a crash. The token is NEVER printed.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { figmaToken, fetchNodes, fetchImages } from "../extract/figma/visual-truth/rest.mjs";
import { PASS_AA_MASKED, scoreStemPair } from "../extract/figma/visual-truth/score-policy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CL = path.join(ROOT, "parity/receipts/console-loop");
const OUT = path.join(CL, "visual-truth");
// Cache lives under the already-gitignored visual-parity out/ tree.
const CACHE = path.join(ROOT, "extract/figma/visual-parity/out/visual-truth-cache");
const TRAP_MANIFEST = path.join(CL, "trap-corpus/manifest.json");

const sha256File = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const norm = (s) => s.replace(/-/g, "");

/** lane → { receiptsDir, gateShotDir(stem) } */
const LANES = {
  "first-party": {
    receiptsDir: path.join(CL, "components"),
    gateShotDir: (stem) => path.join(ROOT, "extract/computed/out", norm(stem), "gate-shots"),
  },
  mui: {
    receiptsDir: path.join(CL, "mui/components"),
    gateShotDir: (stem) => path.join(ROOT, "extract/computed/out/mui", norm(stem), "gate-shots"),
  },
  ...Object.fromEntries(
    ["tailwind", "altitude", "astryx", "carbon", "polaris"].map((lib) => [
      lib,
      {
        receiptsDir: path.join(CL, lib, "components"),
        gateShotDir: (stem) => path.join(ROOT, "extract/computed/out", lib, norm(stem), "gate-shots"),
      },
    ]),
  ),
};

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const onlyLib = argValue("--lib");
const onlyStem = argValue("--stem");
const refresh = process.argv.includes("--refresh");

if (onlyLib && !LANES[onlyLib]) {
  console.error(`✖ unknown lane "${onlyLib}" (lanes: ${Object.keys(LANES).join(", ")})`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Reference resolution: receipt.visual.reference → trap manifest → gate-shots
// ---------------------------------------------------------------------------
const trapStems = existsSync(TRAP_MANIFEST)
  ? (JSON.parse(readFileSync(TRAP_MANIFEST, "utf8")).stems ?? [])
  : [];

function pickGateShot(dir) {
  if (!existsSync(dir)) return null;
  const pngs = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
  if (pngs.length === 0) return null;
  const defaults = pngs.filter((f) => f.endsWith("__default.png"));
  return path.join(dir, (defaults[0] ?? pngs[0]));
}

function resolveReference(lane, stem, receipt) {
  const vRef = receipt.visual?.reference;
  if (typeof vRef === "string" && vRef.trim() && vRef.trim() !== "none") {
    const rel = vRef.split(";")[0].trim().split("#")[0];
    if (existsSync(path.join(ROOT, rel))) {
      return { rel, source: "receipt.visual.reference" };
    }
  }
  const hit = trapStems.find((s) => s.lib === lane && s.stem === stem);
  if (hit?.reference) {
    const rel = String(hit.reference).split("#")[0];
    if (existsSync(path.join(ROOT, rel))) {
      return { rel, source: "trap-corpus-manifest" };
    }
  }
  const probe = pickGateShot(LANES[lane].gateShotDir(stem));
  if (probe) {
    return { rel: path.relative(ROOT, probe), source: "gate-shots-probe" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Variant-cell selection: match reference variant tokens against set children
// ---------------------------------------------------------------------------
function refTokens(receipt, referenceRel) {
  const pick = (s) => {
    const base = s.split("#")[0].split("/").pop() ?? "";
    if (base.endsWith(".png")) return base.slice(0, -4);
    return base.includes("__") ? base : null;
  };
  let name = null;
  const src = receipt.visual?.referenceSource;
  if (typeof src === "string") name = pick(src);
  if (!name && referenceRel) name = pick(referenceRel);
  if (!name) return [];
  const n = name.replace(/^pair--/, "");
  const [variantPart, statePart] = n.split("__");
  return (variantPart ?? "")
    .split(".")
    .concat(statePart ? [statePart] : [])
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
}

function chooseCell(doc, tokens) {
  if (doc.type !== "COMPONENT_SET") {
    return { id: doc.id, name: doc.name, how: "standalone-node" };
  }
  const comps = (doc.children ?? []).filter((c) => c.type === "COMPONENT");
  if (comps.length === 0) return { id: doc.id, name: doc.name, how: "set-without-components" };
  let best = comps[0];
  let bestScore = -1;
  for (const c of comps) {
    const values = c.name
      .split(",")
      .map((s) => {
        const eq = s.split("=");
        return (eq[1] ?? eq[0]).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      })
      .filter(Boolean);
    const score = tokens.filter((t) => values.includes(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = c; // first-in-canvas-order wins ties — deterministic
    }
  }
  return {
    id: best.id,
    name: best.name,
    how: bestScore > 0 ? "variant-token-match" : "first-cell",
    matchScore: Math.max(bestScore, 0),
  };
}

// ---------------------------------------------------------------------------
// Scorecards
// ---------------------------------------------------------------------------
function writeScorecard(lane, stem, card) {
  const dir = path.join(OUT, lane);
  mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${stem}.json`);
  writeFileSync(p, `${JSON.stringify(card, null, 2)}\n`);
  return p;
}

const base = (lane, stem, receiptRel) => ({
  version: 3,
  source: "rest-images-api",
  lane,
  stem,
  passBar: { pctAAMaskedMax: PASS_AA_MASKED, compositionOk: true },
  receipt: receiptRel,
});

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
const laneNames = onlyLib ? [onlyLib] : Object.keys(LANES);
const inventory = []; // { lane, stem, receiptPath, receipt }
for (const lane of laneNames) {
  const dir = LANES[lane].receiptsDir;
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".json")) continue;
    const stem = f.slice(0, -5);
    if (onlyStem && stem !== onlyStem) continue;
    const receiptPath = path.join(dir, f);
    let receipt;
    try {
      receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    } catch (e) {
      console.warn(`⚠ ${lane}/${stem}: unreadable receipt (${e.message}) — skipped entirely`);
      continue;
    }
    inventory.push({ lane, stem, receiptPath, receipt });
  }
}
if (inventory.length === 0) {
  console.error("✖ no stems in scope (check --lib/--stem)");
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const scorerMod = await import(
  pathToFileURL(path.join(ROOT, "extract/figma/canvas-gate/score.ts")).href
);
const { readPngBuffer, alignPair, scoreCell } = scorerMod;

const token = figmaToken(ROOT);
const counts = { pass: 0, fail: 0, skip: 0, error: 0 };
const skipReasons = new Map();

const recordSkip = (lane, stem, receiptRel, reason, extra = {}) => {
  counts.skip += 1;
  skipReasons.set(`${lane}/${stem}`, reason);
  writeScorecard(lane, stem, {
    ...base(lane, stem, receiptRel),
    status: "skip",
    skipReason: reason,
    ...extra,
  });
  console.log(`− ${lane}/${stem}: SKIP (${reason})`);
};

// Group by lane so a 403 lane short-circuits by name; group REST calls per fileKey.
for (const lane of laneNames) {
  const stems = inventory.filter((r) => r.lane === lane);
  if (stems.length === 0) continue;
  console.log(`\n== ${lane} (${stems.length} stems)`);

  // Phase 1: local resolution (nodeId + reference)
  const ready = [];
  for (const row of stems) {
    const receiptRel = path.relative(ROOT, row.receiptPath);
    const nodeId = row.receipt.generate?.nodeId;
    if (typeof nodeId !== "string" || !nodeId) {
      recordSkip(lane, row.stem, receiptRel, "no-node-id");
      continue;
    }
    const ref = resolveReference(lane, row.stem, row.receipt);
    if (!ref) {
      recordSkip(lane, row.stem, receiptRel, "no-reference");
      continue;
    }
    ready.push({ ...row, receiptRel, nodeId, ref });
  }
  if (ready.length === 0) continue;

  // Phase 2: nodes fetch per fileKey (batched inside fetchNodes)
  const byFile = new Map();
  for (const row of ready) {
    const fk = row.receipt.fileKey;
    if (!byFile.has(fk)) byFile.set(fk, []);
    byFile.get(fk).push(row);
  }

  for (const [fileKey, rows] of byFile) {
    const nodesRes = await fetchNodes(
      CACHE,
      token,
      fileKey,
      rows.map((r) => r.nodeId),
      { refresh, depth: 1 },
    );
    if (!nodesRes.ok) {
      for (const row of rows) {
        recordSkip(lane, row.stem, row.receiptRel, `file-inaccessible-${nodesRes.status}`, { fileKey });
      }
      continue;
    }
    const { version, nodes } = nodesRes;

    // Phase 3: choose cells, then one batched images pass
    const toRender = [];
    for (const row of rows) {
      const doc = nodes.get(row.nodeId);
      if (!doc) {
        recordSkip(lane, row.stem, row.receiptRel, "node-gone", { fileKey, setNodeId: row.nodeId });
        continue;
      }
      const tokens = refTokens(row.receipt, row.ref.rel);
      const cell = chooseCell(doc, tokens);
      toRender.push({ ...row, doc, cell, tokens });
    }
    if (toRender.length === 0) continue;

    const imgRes = await fetchImages(
      CACHE,
      token,
      fileKey,
      version,
      toRender.map((r) => r.cell.id),
    );
    if (!imgRes.ok) {
      for (const row of toRender) {
        recordSkip(lane, row.stem, row.receiptRel, `images-api-${imgRes.status}`, { fileKey });
      }
      continue;
    }

    // Phase 4: score
    for (const row of toRender) {
      const cachedPng = imgRes.paths.get(row.cell.id);
      if (!cachedPng) {
        recordSkip(lane, row.stem, row.receiptRel, "render-declined", {
          fileKey,
          setNodeId: row.nodeId,
          cellNodeId: row.cell.id,
        });
        continue;
      }
      const shotsDir = path.join(OUT, lane, "shots");
      const diffsDir = path.join(OUT, lane, "diffs");
      mkdirSync(shotsDir, { recursive: true });
      mkdirSync(diffsDir, { recursive: true });
      const canvasShotAbs = path.join(shotsDir, `${row.stem}.png`);
      copyFileSync(cachedPng, canvasShotAbs);
      const refAbs = path.join(ROOT, row.ref.rel);

      const provenance = {
        fileKey,
        fileVersion: version,
        setNodeId: row.nodeId,
        cellNodeId: row.cell.id,
        cellName: row.cell.name,
        cellPick: row.cell.how,
        referenceResolvedFrom: row.ref.source,
      };

      try {
        const canvasPng = readPngBuffer(readFileSync(canvasShotAbs));
        const refPng = readPngBuffer(readFileSync(refAbs));
        const s = scoreStemPair(canvasPng, refPng, { alignPair, scoreCell });
        const diffAbs = path.join(diffsDir, `${row.stem}.diff.png`);
        if (s.cell.diff) writeFileSync(diffAbs, PNG.sync.write(s.cell.diff));

        const card = {
          ...base(lane, row.stem, row.receiptRel),
          status: s.pass ? "pass" : "fail",
          ...provenance,
          metrics: {
            pctExactUnmasked: s.cell.pctExactUnmasked,
            pctAAUnmasked: s.cell.pctAAUnmasked,
            pctAAMasked: s.cell.pctAAMasked,
            maskCoveragePct: s.cell.maskCoveragePct,
            canvasPx: s.cell.canvasPx,
            realPx: s.cell.realPx,
            inkCanvasPct: s.cell.inkCanvasPct,
            inkRealPct: s.cell.inkRealPct,
          },
          reference: row.ref.rel,
          referenceSha256: sha256File(refAbs),
          canvasShot: path.relative(ROOT, canvasShotAbs),
          canvasShotSha256: sha256File(canvasShotAbs),
          diff: path.relative(ROOT, diffAbs),
          compositionOk: s.compositionOk,
          strictCompositionOk: s.strictCompositionOk,
          framingTolerant: s.framingTolerant,
          reliedOnFramingTolerant: s.reliedOnFramingTolerant,
          scaleRatio: s.scaleRatio,
          inkDelta: s.inkDelta,
          dprNormalized: s.dprNormalized,
          sizeNormalized: s.sizeNormalized,
          note: !s.compositionOk
            ? `composition mismatch (scaleRatio=${s.scaleRatio.toFixed(2)}, inkDelta=${s.inkDelta.toFixed(1)})`
            : s.pass
              ? s.reliedOnFramingTolerant
                ? "pixel bar met — PASS RELIED ON framingTolerant relaxation"
                : "pixel bar met (headless REST render vs code reference)"
              : `pixel bar missed (pctAAMasked=${s.aaMasked?.toFixed?.(2) ?? s.aaMasked} > ${PASS_AA_MASKED})`,
        };
        writeScorecard(lane, row.stem, card);
        counts[s.pass ? "pass" : "fail"] += 1;
        console.log(
          `${s.pass ? "✔" : "✖"} ${lane}/${row.stem}: pctAAMasked=${Number(s.aaMasked).toFixed(2)}% compositionOk=${s.compositionOk} (cell ${row.cell.id} "${row.cell.name}" via ${row.cell.how})`,
        );
      } catch (e) {
        counts.error += 1;
        writeScorecard(lane, row.stem, {
          ...base(lane, row.stem, row.receiptRel),
          status: "error",
          ...provenance,
          reference: row.ref.rel,
          error: String(e && e.message ? e.message : e),
        });
        console.warn(`⚠ ${lane}/${row.stem}: score error — ${e.message}`);
      }
    }
  }
}

console.log(
  `\nvisual-truth:run — pass ${counts.pass}, fail ${counts.fail}, skip ${counts.skip}, error ${counts.error}`,
);
if (skipReasons.size > 0) {
  const byReason = {};
  for (const [k, v] of skipReasons) (byReason[v] ??= []).push(k);
  for (const [reason, ks] of Object.entries(byReason)) {
    console.log(`  skip[${reason}]: ${ks.join(", ")}`);
  }
}
process.exit(0);
