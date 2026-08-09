#!/usr/bin/env node
/**
 * CANVAS-DRIFT CAPTURE — emit the bridge JS that mints a lane's LIVE-SNAPSHOT.
 *
 *   node scripts/console-loop-canvas-drift-capture.mjs <lane> [stem ...]
 *
 * WHY A GENERATOR AND NOT A FETCHER
 * ---------------------------------
 * `scripts/console-loop-canvas-drift-probe.mjs` refuses to guess: without
 * `canvas-drift/LIVE-SNAPSHOT.json` it reports SNAPSHOT-PENDING rather than
 * back-deriving live facts from the committed PNGs. The snapshot therefore has
 * to be minted off the Desktop Bridge — and the bridge is only reachable from
 * an MCP `figma_execute` call, not from node. So this script does the half that
 * IS reproducible offline: it reads `<lane>/framing.json`, takes the pinned
 * `cellNodeId` for every stem, and prints a self-contained plugin-context
 * program to stdout. That program is what gets pasted into `figma_execute`
 * with the lane's `fileKey` pinned; its JSON result becomes the snapshot's
 * `stems` block verbatim.
 *
 * Keeping the reader in-tree means the next round does not have to re-derive
 * how a snapshot was taken, and the pins can never drift from framing.json --
 * they are read from it on every run.
 *
 * READ-ONLY BY CONSTRUCTION. The emitted program calls no mutating API: it
 * only walks `getNodeByIdAsync` and resolves variables. Bindings are resolved
 * by variable ID (`getVariableByIdAsync`) rather than by name-first-match, so
 * the COLLECTION a binding actually landed in is a fact and not a guess — the
 * ambiguity the carbon round had to flag by hand.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const lane = argv[0];
if (!lane) {
  console.error("usage: console-loop-canvas-drift-capture.mjs <lane> [stem ...]");
  process.exit(2);
}
const only = argv.slice(1);

const CL = path.join(ROOT, "parity/receipts/console-loop");
const framingPath = path.join(CL, lane, "framing.json");

/** Same pin sources as the probe: `<lane>/framing.json` for the foreign lanes,
 *  and `visual-truth/<lane>/<stem>.json` for first-party, which keeps the same
 *  cellNodeId/cellName pair on its headless cards instead of a framing file.
 *  Nothing here invents a pin — a stem with no recorded cell is reported as
 *  uncapturable, never guessed at from a shot. */
function loadStems() {
  if (existsSync(framingPath)) {
    return JSON.parse(readFileSync(framingPath, "utf8")).stems ?? {};
  }
  const vt = path.join(CL, "visual-truth", lane);
  if (!existsSync(vt)) return null;
  const out = {};
  for (const f of readdirSync(vt).filter((x) => x.endsWith(".json"))) {
    const card = JSON.parse(readFileSync(path.join(vt, f), "utf8"));
    out[f.replace(/\.json$/, "")] = {
      cellNodeId: card.cellNodeId ?? null,
      fileKey: card.fileKey ?? null,
    };
  }
  /** Same sole-generated-node rule the probe uses: a receipt that records no
   *  variant count built ONE standalone COMPONENT, so `generate.nodeId` is the
   *  cell and there is nothing to choose. Receipts that DO record a variant
   *  count are left unpinned. */
  const comps = path.join(CL, "components");
  if (existsSync(comps)) {
    for (const f of readdirSync(comps).filter((x) => x.endsWith(".json"))) {
      const stem = f.replace(/\.json$/, "");
      if (out[stem]?.cellNodeId) continue;
      const receipt = JSON.parse(readFileSync(path.join(comps, f), "utf8"));
      if (!receipt.generate?.nodeId) continue;
      if (receipt.generate?.result?.results?.[0]?.variants !== undefined) continue;
      out[stem] = { cellNodeId: receipt.generate.nodeId, fileKey: receipt.fileKey ?? null };
    }
  }
  return out;
}
const stemPins = loadStems();
if (!stemPins) {
  console.error(`✖ ${lane}: no framing.json and no visual-truth cards — nothing pins the cells to capture`);
  process.exit(2);
}
const pins = {};
const unpinned = [];
const fileKeys = new Set();
for (const [stem, pin] of Object.entries(stemPins)) {
  if (only.length && !only.includes(stem)) continue;
  if (!pin.cellNodeId) {
    unpinned.push(stem);
    continue;
  }
  pins[stem] = pin.cellNodeId;
  if (pin.fileKey) fileKeys.add(pin.fileKey);
}
if (fileKeys.size > 1) {
  console.error(
    `note: this lane's pinned cells span ${fileKeys.size} files (${[...fileKeys].join(", ")}) — run one capture per fileKey with the matching stem list, since figma_execute targets a single file`,
  );
}
if (unpinned.length) {
  console.error(
    `note: ${unpinned.length} stem(s) carry no cellNodeId in framing.json and cannot be captured: ${unpinned.join(", ")}`,
  );
}
if (!Object.keys(pins).length) {
  console.error(`✖ ${lane}: no pinned cells to capture`);
  process.exit(2);
}

/* The emitted program. Depth 3 matches the carbon snapshot's walk. */
const program = `
const PINS = ${JSON.stringify(pins)};
const DEPTH = 3;
const vcache = new Map();
function fmt(v) {
  if (v && typeof v === "object") {
    if (v.type === "VARIABLE_ALIAS") return "ALIAS " + v.id;
    if (typeof v.r === "number") {
      const c = (x) => Math.round(x * 255);
      return v.a !== undefined && v.a < 1
        ? "rgba(" + c(v.r) + "," + c(v.g) + "," + c(v.b) + "," + Number(v.a.toFixed(3)) + ")"
        : "#" + [v.r, v.g, v.b].map((x) => c(x).toString(16).padStart(2, "0")).join("");
    }
  }
  return v;
}
async function vinfo(id) {
  if (vcache.has(id)) return vcache.get(id);
  let out = null;
  try {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (v) {
      const c = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
      const modeId = c ? c.defaultModeId : null;
      out = { name: v.name, coll: c ? c.name : "?", val: fmt(modeId ? v.valuesByMode[modeId] : undefined) };
    }
  } catch (e) {
    out = { name: "?", coll: "?", val: "ERR " + String(e && e.message ? e.message : e) };
  }
  vcache.set(id, out);
  return out;
}
async function bindingsOf(node) {
  const out = {};
  const bv = node.boundVariables || {};
  for (const k of Object.keys(bv)) {
    const raw = bv[k];
    if (Array.isArray(raw)) {
      for (let i = 0; i < raw.length; i++) {
        const a = raw[i];
        if (a && a.id) {
          const info = await vinfo(a.id);
          if (info) out[raw.length > 1 ? k + "[" + i + "]" : k] = info;
        }
      }
    } else if (raw && raw.id) {
      const info = await vinfo(raw.id);
      if (info) out[k] = info;
    }
  }
  return out;
}
const stems = {};
const missing = [];
for (const stem of Object.keys(PINS)) {
  const node = await figma.getNodeByIdAsync(PINS[stem]);
  if (!node) { missing.push(stem + "=" + PINS[stem]); continue; }
  const rec = {
    cellNodeId: node.id,
    name: node.name,
    type: node.type,
    w: Number(node.width.toFixed(4)),
    h: Number(node.height.toFixed(4)),
    pl: node.paddingLeft ?? 0, pr: node.paddingRight ?? 0,
    pt: node.paddingTop ?? 0, pb: node.paddingBottom ?? 0,
    gap: node.itemSpacing ?? 0,
    sizingH: node.layoutSizingHorizontal ?? null,
    sizingV: node.layoutSizingVertical ?? null,
    bound: await bindingsOf(node),
    descendantBound: {},
    fonts: [],
  };
  const walk = async (n, depth, prefix) => {
    if (depth > DEPTH || !("children" in n)) return;
    for (const ch of n.children) {
      const label = (prefix ? prefix + "." : "") + ch.name;
      const b = await bindingsOf(ch);
      for (const k of Object.keys(b)) rec.descendantBound[label + "." + k] = b[k];
      if (ch.type === "TEXT") {
        const fn = ch.fontName;
        rec.fonts.push({
          node: ch.name,
          chars: String(ch.characters).slice(0, 60),
          family: fn && fn.family ? fn.family : String(fn),
          style: fn && fn.style ? fn.style : null,
          size: ch.fontSize,
          w: Number(ch.width.toFixed(2)),
          h: Number(ch.height.toFixed(2)),
        });
      }
      await walk(ch, depth + 1, label);
    }
  };
  await walk(node, 1, "");
  if (!rec.fonts.length) rec.fontsNote = "no TEXT node within the depth-" + DEPTH + " walk";
  stems[stem] = rec;
}
return { lane: ${JSON.stringify(lane)}, file: figma.root.name, missing, stems };
`.trim();

process.stdout.write(program + "\n");
